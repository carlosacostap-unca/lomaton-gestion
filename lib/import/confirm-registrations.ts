import "server-only";

import { randomBytes } from "node:crypto";

import PocketBase, { ClientResponseError } from "pocketbase";

import { projectTeam } from "@/lib/domain/team-rules";
import type { RegistrationImportRow } from "@/lib/import/registrations";
import type { LomatonUser } from "@/lib/pocketbase/server";
import { ApiError } from "@/lib/server/api-error";

export type ConfirmRegistrationImport = {
  fileName: string;
  fileType: "csv" | "xlsx";
  digest: string;
  reason: string;
  rows: RegistrationImportRow[];
  invalidRows: number;
  reviewRows: number;
  ignoredDuplicateRows: number;
};

function recordId() {
  return randomBytes(12).toString("hex").slice(0, 15);
}

function triState(value: boolean | null) {
  return value === null ? "not_provided" : value ? "yes" : "no";
}

function registrationData(
  row: RegistrationImportRow,
  importBatch: string,
) {
  return {
    submittedAt: row.submittedAt,
    fullName: row.fullName.trim(),
    dni: row.dni.trim(),
    dniNormalized: row.dniNormalized,
    phone: row.phone.trim(),
    phoneNormalized: row.phoneNormalized,
    email: row.email.trim(),
    emailNormalized: row.emailNormalized,
    relationship: row.relationship,
    ftcaStatus: row.ftcaStatus,
    department: row.department.trim(),
    academicUnit: row.academicUnit.trim(),
    career: row.career.trim(),
    externalTeacherDescription: row.externalTeacherDescription.trim(),
    mentorInterest: triState(row.mentorInterest),
    declaredTeamStatus: row.declaredTeamStatus ?? "not_provided",
    declaredTeamMembers: row.declaredTeamMembers.trim(),
    termsAccepted: triState(row.termsAccepted),
    mediaAuthorized: triState(row.mediaAuthorized),
    sourceRole: row.relationshipSource.trim(),
    sourceRowNumber: row.rowNumber,
    rawSource: row.rawSource,
    reviewStatus: "ready",
    importBatch,
  };
}

function candidateData(row: RegistrationImportRow, registration: string) {
  return {
    registration,
    fullName: row.fullName.trim(),
    email: row.email.trim(),
    emailNormalized: row.emailNormalized,
    ftcaStatus: row.ftcaStatus,
    active: true,
  };
}

function mentorData(row: RegistrationImportRow, registration: string) {
  return {
    registration,
    department: row.department.trim(),
    externalDescription: row.externalTeacherDescription.trim(),
    mentorInterest: triState(row.mentorInterest),
    active: true,
  };
}

function recordChanged(record: Record<string, unknown>, next: Record<string, unknown>) {
  return Object.entries(next).some(([key, value]) => {
    const current = record[key];
    if (typeof value === "object" && value !== null) {
      return JSON.stringify(current ?? null) !== JSON.stringify(value);
    }
    return current !== value;
  });
}

export async function confirmRegistrationImport(
  pb: PocketBase,
  admin: LomatonUser,
  input: ConfirmRegistrationImport,
) {
  if (input.reviewRows > 0) {
    throw new ApiError(
      400,
      "La importación contiene filas pendientes de revisión.",
      "import_requires_review",
    );
  }

  const seenEmails = new Set<string>();
  const seenDnis = new Set<string>();
  for (const row of input.rows) {
    if (
      !row.emailNormalized ||
      !row.dniNormalized ||
      seenEmails.has(row.emailNormalized) ||
      seenDnis.has(row.dniNormalized)
    ) {
      throw new ApiError(
        400,
        "El lote contiene emails o DNI vacíos o duplicados.",
        "duplicate_import_identity",
      );
    }
    if (row.relationship === "pending") {
      throw new ApiError(400, "El lote contiene una clasificación pendiente.", "pending_relationship");
    }
    seenEmails.add(row.emailNormalized);
    seenDnis.add(row.dniNormalized);
  }

  const [
    registrations,
    candidates,
    mentors,
    memberships,
    teams,
    currentSettings,
  ] = await Promise.all([
    pb.collection("registrations").getFullList(),
    pb.collection("candidates").getFullList(),
    pb.collection("mentor_profiles").getFullList(),
    pb.collection("team_memberships").getFullList(),
    pb.collection("teams").getFullList(),
    pb.collection("hackathon_settings").getFirstListItem(
      pb.filter("key = {:key}", { key: "default" }),
    ),
  ]);

  const registrationByEmail = new Map<string, Record<string, unknown> & { id: string }>(
    registrations.map((record) => [String(record.emailNormalized), record]),
  );
  const registrationByDni = new Map<string, Record<string, unknown> & { id: string }>(
    registrations.map((record) => [String(record.dniNormalized), record]),
  );
  const candidateByEmail = new Map<string, Record<string, unknown> & { id: string }>(
    candidates.map((record) => [String(record.emailNormalized), record]),
  );
  const candidateByRegistration = new Map<string, Record<string, unknown> & { id: string }>(
    candidates
      .filter((record) => record.registration)
      .map((record) => [String(record.registration), record]),
  );
  const mentorByRegistration = new Map<string, Record<string, unknown> & { id: string }>(
    mentors.map((record) => [String(record.registration), record]),
  );
  const membershipByCandidate = new Map(
    memberships.map((record) => [String(record.candidate), record]),
  );
  const ftcaByCandidateId = new Map(
    candidates.map((candidate) => [candidate.id, String(candidate.ftcaStatus)]),
  );

  const batch = pb.createBatch();
  const importBatchId = recordId();
  const importBatch = {
    id: importBatchId,
    fileName: input.fileName,
    fileType: input.fileType,
    totalRows:
      input.rows.length +
      input.invalidRows +
      input.reviewRows +
      input.ignoredDuplicateRows,
    validRows: input.rows.length,
    invalidRows: input.invalidRows,
    pendingFtcaRows: 0,
    createdBy: admin.id,
  };
  batch.collection("import_batches").create(importBatch);

  const result = {
    candidatesCreated: 0,
    mentorsCreated: 0,
    updated: 0,
    unchanged: 0,
    total: input.rows.length,
  };
  const affectedTeamIds = new Set<string>();

  for (const row of input.rows) {
    const sameEmail = registrationByEmail.get(row.emailNormalized);
    const sameDni = registrationByDni.get(row.dniNormalized);
    if (sameEmail && sameDni && sameEmail.id !== sameDni.id) {
      throw new ApiError(
        409,
        "El email y el DNI corresponden a inscripciones diferentes.",
        "registration_identity_conflict",
      );
    }
    if (sameEmail && String(sameEmail.dniNormalized) !== row.dniNormalized) {
      throw new ApiError(409, "El email ya está asociado a otro DNI.", "registration_email_conflict");
    }
    if (sameDni && String(sameDni.emailNormalized) !== row.emailNormalized) {
      throw new ApiError(409, "El DNI ya está asociado a otro email.", "registration_dni_conflict");
    }

    const existingRegistration = sameEmail ?? sameDni;
    const registrationId = existingRegistration?.id ?? recordId();
    const nextRegistration = registrationData(row, importBatchId);
    let rowChanged = false;
    let rowCreated = false;

    if (existingRegistration) {
      if (recordChanged(existingRegistration, nextRegistration)) {
        batch.collection("registrations").update(registrationId, nextRegistration);
        Object.assign(existingRegistration, nextRegistration);
        rowChanged = true;
      }
    } else {
      const created = { id: registrationId, ...nextRegistration };
      batch.collection("registrations").create(created);
      registrationByEmail.set(row.emailNormalized, created);
      registrationByDni.set(row.dniNormalized, created);
      rowChanged = true;
    }

    const existingCandidate =
      candidateByRegistration.get(registrationId) ??
      candidateByEmail.get(row.emailNormalized);
    const existingMentor = mentorByRegistration.get(registrationId);

    if (row.relationship === "teacher") {
      if (existingCandidate) {
        const membership = membershipByCandidate.get(existingCandidate.id);
        if (membership) {
          throw new ApiError(
            409,
            "No se puede reclasificar como docente a una persona que integra un equipo.",
            "candidate_has_team",
          );
        }
        if (existingCandidate.active) {
          batch.collection("candidates").update(existingCandidate.id, { active: false });
          existingCandidate.active = false;
          rowChanged = true;
        }
      }

      const nextMentor = mentorData(row, registrationId);
      if (existingMentor) {
        if (recordChanged(existingMentor, nextMentor)) {
          batch.collection("mentor_profiles").update(existingMentor.id, nextMentor);
          Object.assign(existingMentor, nextMentor);
          rowChanged = true;
        }
      } else {
        const mentor = { id: recordId(), ...nextMentor };
        batch.collection("mentor_profiles").create(mentor);
        mentorByRegistration.set(registrationId, mentor);
        result.mentorsCreated += 1;
        rowCreated = true;
        rowChanged = true;
      }
    } else {
      if (existingMentor?.active) {
        batch.collection("mentor_profiles").update(existingMentor.id, { active: false });
        existingMentor.active = false;
        rowChanged = true;
      }

      const nextCandidate = candidateData(row, registrationId);
      if (existingCandidate) {
        if (recordChanged(existingCandidate, nextCandidate)) {
          batch.collection("candidates").update(existingCandidate.id, nextCandidate);
          const membership = membershipByCandidate.get(existingCandidate.id);
          if (membership && existingCandidate.ftcaStatus !== nextCandidate.ftcaStatus) {
            affectedTeamIds.add(String(membership.team));
          }
          Object.assign(existingCandidate, nextCandidate);
          ftcaByCandidateId.set(existingCandidate.id, nextCandidate.ftcaStatus);
          rowChanged = true;
        }
      } else {
        const candidate = { id: recordId(), ...nextCandidate };
        batch.collection("candidates").create(candidate);
        candidateByRegistration.set(registrationId, candidate);
        candidateByEmail.set(row.emailNormalized, candidate);
        ftcaByCandidateId.set(candidate.id, nextCandidate.ftcaStatus);
        result.candidatesCreated += 1;
        rowCreated = true;
        rowChanged = true;
      }
    }

    if (rowCreated) continue;
    if (rowChanged) result.updated += 1;
    else result.unchanged += 1;
  }

  for (const teamId of affectedTeamIds) {
    const team = teams.find((item) => item.id === teamId);
    if (!team) continue;
    const memberStatuses = memberships
      .filter((membership) => membership.team === teamId)
      .map((membership) => ftcaByCandidateId.get(String(membership.candidate)) ?? "pending");
    batch.collection("teams").update(team.id, projectTeam(memberStatuses), {
      query: { expected_member_count: Number(team.memberCount) },
    });
  }

  batch.collection("audit_logs").create({
    id: recordId(),
    actor: admin.id,
    action: "registrations.import",
    entityType: "import_batches",
    entityId: importBatchId,
    after: importBatch,
    reason: input.reason.trim(),
    metadata: {
      digest: input.digest,
      ignoredDuplicateRows: input.ignoredDuplicateRows,
      result,
    },
  });
  batch.collection("hackathon_settings").update(currentSettings.id, {
    "dataVersion+": 1,
  });

  try {
    await batch.send();
  } catch (error) {
    if (error instanceof ClientResponseError && [400, 409].includes(error.status)) {
      throw new ApiError(
        409,
        "La importación entró en conflicto con otro cambio y no se aplicó ninguna fila.",
        "import_conflict",
        error.response?.data,
      );
    }
    throw error;
  }

  return { batchId: importBatchId, ...result };
}
