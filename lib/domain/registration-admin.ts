import "server-only";

import { randomBytes } from "node:crypto";

import PocketBase, { ClientResponseError } from "pocketbase";

import { projectTeam } from "@/lib/domain/team-rules";
import {
  addAudit,
  requireReasonWhenClosed,
} from "@/lib/domain/admin-commands";
import type { LomatonUser } from "@/lib/pocketbase/server";
import { ApiError } from "@/lib/server/api-error";

type TriState = "yes" | "no" | "not_provided";
type Relationship = "student_ftca" | "student_external" | "teacher";

export type AdminRegistrationUpdate = {
  fullName: string;
  dni: string;
  phone: string;
  email: string;
  relationship: Relationship;
  ftcaStatus: "confirmed" | "not_ftca" | "pending";
  department: string;
  academicUnit: string;
  career: string;
  externalTeacherDescription: string;
  mentorInterest: TriState;
  declaredTeamStatus: "complete" | "none" | "partial" | "not_provided";
  declaredTeamMembers: string;
  termsAccepted: TriState;
  mediaAuthorized: TriState;
  active: boolean;
  reason: string;
};

function recordId() {
  return randomBytes(12).toString("hex").slice(0, 15);
}

function digits(value: string) {
  return value.replace(/\D/g, "");
}

async function send(batch: ReturnType<PocketBase["createBatch"]>) {
  try {
    await batch.send();
  } catch (error) {
    if (error instanceof ClientResponseError && [400, 409].includes(error.status)) {
      throw new ApiError(
        409,
        "La edición entró en conflicto con otro registro.",
        "registration_update_conflict",
        error.response?.data,
      );
    }
    throw error;
  }
}

export async function listAdminRegistrations(pb: PocketBase, query: string) {
  const normalized = query.trim();
  const filter = normalized
    ? pb.filter(
        "fullName ~ {:query} || email ~ {:query} || dniNormalized ~ {:digits}",
        { query: normalized, digits: digits(normalized) || normalized },
      )
    : "";
  const result = await pb.collection("registrations").getList(1, 100, {
    filter,
    sort: "fullName",
  });
  const registrationIds = new Set(result.items.map((item) => item.id));
  const [candidates, mentors] = await Promise.all([
    pb.collection("candidates").getFullList(),
    pb.collection("mentor_profiles").getFullList(),
  ]);
  const candidateByRegistration = new Map(
    candidates
      .filter((candidate) => registrationIds.has(String(candidate.registration)))
      .map((candidate) => [String(candidate.registration), candidate]),
  );
  const mentorByRegistration = new Map(
    mentors
      .filter((mentor) => registrationIds.has(String(mentor.registration)))
      .map((mentor) => [String(mentor.registration), mentor]),
  );
  return {
    page: result.page,
    perPage: result.perPage,
    totalItems: result.totalItems,
    items: result.items.map((registration) => {
      const candidate = candidateByRegistration.get(registration.id);
      const mentor = mentorByRegistration.get(registration.id);
      return {
        ...registration,
        candidateId: candidate?.id ?? "",
        candidateActive: Boolean(candidate?.active),
        mentorId: mentor?.id ?? "",
        mentorActive: Boolean(mentor?.active),
      };
    }),
  };
}

export async function updateAdminRegistration(
  pb: PocketBase,
  admin: LomatonUser,
  registrationId: string,
  input: AdminRegistrationUpdate,
) {
  const settings = await requireReasonWhenClosed(pb, input.reason);
  const registration = await pb.collection("registrations").getOne(registrationId);
  const [candidates, mentors] = await Promise.all([
    pb.collection("candidates").getFullList({
      filter: pb.filter(
        "registration = {:registration} || emailNormalized = {:email}",
        { registration: registrationId, email: String(registration.emailNormalized) },
      ),
    }),
    pb.collection("mentor_profiles").getFullList({
      filter: pb.filter("registration = {:registration}", { registration: registrationId }),
    }),
  ]);
  const candidate = candidates[0] ?? null;
  const mentor = mentors[0] ?? null;
  const membership = candidate
    ? await pb.collection("team_memberships").getFullList({
        filter: pb.filter("candidate = {:candidate}", { candidate: candidate.id }),
      }).then((items) => items[0] ?? null)
    : null;
  const users = await pb.collection("users").getFullList({
    filter: candidate
      ? pb.filter("registration = {:registration} || candidate = {:candidate}", { registration: registration.id, candidate: candidate.id })
      : pb.filter("registration = {:registration}", { registration: registration.id }),
  });
  const mentorship = mentor
    ? await pb.collection("team_mentorships").getFullList({ filter: pb.filter("mentor = {:mentor}", { mentor: mentor.id }) }).then((items) => items[0] ?? null)
    : null;

  if (input.relationship === "teacher" && membership) {
    throw new ApiError(
      409,
      "Retirá a la persona de su equipo antes de reclasificarla como docente.",
      "candidate_has_team",
    );
  }
  if (mentorship && (input.relationship !== "teacher" || !input.active)) {
    throw new ApiError(409, "Resolvé la mentoría vigente antes de desactivar o reclasificar al docente.", "mentor_has_team");
  }

  const email = input.email.trim();
  const emailNormalized = email.toLowerCase();
  const dniNormalized = digits(input.dni);
  const phoneNormalized = digits(input.phone);
  const nextRegistration = {
    fullName: input.fullName.trim(),
    dni: input.dni.trim(),
    dniNormalized,
    phone: input.phone.trim(),
    phoneNormalized,
    email,
    emailNormalized,
    relationship: input.relationship,
    ftcaStatus: input.ftcaStatus,
    department: input.department.trim(),
    academicUnit: input.academicUnit.trim(),
    career: input.career.trim(),
    externalTeacherDescription: input.externalTeacherDescription.trim(),
    mentorInterest: input.mentorInterest,
    declaredTeamStatus: input.declaredTeamStatus,
    declaredTeamMembers: input.declaredTeamMembers.trim(),
    termsAccepted: input.termsAccepted,
    mediaAuthorized: input.mediaAuthorized,
    reviewStatus: "ready",
    selfManagedFields: [],
    profileVersion: Number(registration.profileVersion || 0) + 1,
  };
  const batch = pb.createBatch();
  batch.collection("registrations").update(registration.id, nextRegistration);

  let affectedTeamId = "";
  if (input.relationship === "teacher") {
    if (candidate?.active) {
      batch.collection("candidates").update(candidate.id, { active: false });
    }
    for (const user of users) {
      batch.collection("users").update(user.id, {
        candidate: "",
        registration: input.active ? registration.id : "",
        enabled: input.active,
        displayName: input.fullName.trim(),
      });
    }
    const mentorData = {
      registration: registration.id,
      department: input.department.trim(),
      externalDescription: input.externalTeacherDescription.trim(),
      mentorInterest: input.mentorInterest,
      active: input.active,
    };
    if (mentor) batch.collection("mentor_profiles").update(mentor.id, mentorData);
    else batch.collection("mentor_profiles").create({ id: recordId(), ...mentorData });
  } else {
    if (mentor?.active) {
      batch.collection("mentor_profiles").update(mentor.id, { active: false });
    }
    const candidateData = {
      registration: registration.id,
      fullName: input.fullName.trim(),
      email,
      emailNormalized,
      ftcaStatus: input.ftcaStatus,
      active: input.active,
    };
    const candidateId = candidate?.id ?? recordId();
    if (candidate) batch.collection("candidates").update(candidate.id, candidateData);
    else batch.collection("candidates").create({ id: candidateId, ...candidateData });

    const emailChanged = String(registration.emailNormalized) !== emailNormalized;
    for (const user of users) {
      batch.collection("users").update(user.id, {
        candidate: emailChanged ? "" : candidateId,
        registration: emailChanged ? "" : registration.id,
        enabled: input.active && !emailChanged,
        displayName: input.fullName.trim(),
      });
    }

    if (membership) {
      affectedTeamId = String(membership.team);
      const [team, memberships] = await Promise.all([
        pb.collection("teams").getOne(affectedTeamId),
        pb.collection("team_memberships").getFullList({
          filter: pb.filter("team = {:team}", { team: affectedTeamId }),
          expand: "candidate",
        }),
      ]);
      const statuses = memberships.map((item) =>
        item.candidate === candidateId
          ? input.ftcaStatus
          : String(item.expand?.candidate?.ftcaStatus ?? "pending"),
      );
      batch.collection("teams").update(team.id, projectTeam(statuses), {
        query: { expected_member_count: Number(team.memberCount) },
      });
    }
  }

  addAudit(batch, {
    actorId: admin.id,
    action: "registration.admin.update",
    entityType: "registrations",
    entityId: registration.id,
    before: registration,
    after: { id: registration.id, ...nextRegistration },
    reason: input.reason,
    metadata: { affectedTeamId },
  });
  batch.collection("hackathon_settings").update(settings.id, { "dataVersion+": 1 });
  await send(batch);

  return {
    registration: await pb.collection("registrations").getOne(registration.id),
    affectedTeamId,
    warning: affectedTeamId ? "Se recalculó el estado del equipo asociado." : "",
  };
}
