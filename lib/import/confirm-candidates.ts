import "server-only";

import { randomBytes } from "node:crypto";

import PocketBase, { ClientResponseError } from "pocketbase";

import { projectTeam } from "@/lib/domain/team-rules";
import type { LomatonUser } from "@/lib/pocketbase/server";
import { ApiError } from "@/lib/server/api-error";

export type ConfirmCandidateRow = {
  firstName: string;
  lastName: string;
  email: string;
  emailNormalized: string;
  ftcaStatus: "confirmed" | "not_ftca" | "pending";
};

export type ConfirmCandidateImport = {
  fileName: string;
  fileType: "csv" | "xlsx";
  digest: string;
  reason: string;
  rows: ConfirmCandidateRow[];
  invalidRows: number;
  pendingFtcaRows: number;
};

function recordId() {
  return randomBytes(12).toString("hex").slice(0, 15);
}

function candidateData(row: ConfirmCandidateRow) {
  return {
    firstName: row.firstName.trim(),
    lastName: row.lastName.trim(),
    email: row.email.trim(),
    emailNormalized: row.emailNormalized.trim().toLowerCase(),
    ftcaStatus: row.ftcaStatus,
    active: true,
  };
}

function candidateChanged(record: Record<string, unknown>, next: ReturnType<typeof candidateData>) {
  return Object.entries(next).some(([key, value]) => record[key] !== value);
}

export async function confirmCandidateImport(
  pb: PocketBase,
  admin: LomatonUser,
  input: ConfirmCandidateImport,
) {
  const seen = new Set<string>();
  for (const row of input.rows) {
    const email = row.emailNormalized.trim().toLowerCase();
    if (!email || seen.has(email)) {
      throw new ApiError(400, "El lote contiene emails vacíos o duplicados.", "duplicate_import_email");
    }
    seen.add(email);
  }

  const [candidates, memberships, teams, currentSettings] = await Promise.all([
    pb.collection("candidates").getFullList(),
    pb.collection("team_memberships").getFullList(),
    pb.collection("teams").getFullList(),
    pb.collection("hackathon_settings").getFirstListItem(
      pb.filter("key = {:key}", { key: "default" }),
    ),
  ]);
  const candidateByEmail = new Map<string, Record<string, unknown> & { id: string }>(
    candidates.map((candidate) => [String(candidate.emailNormalized), candidate]),
  );
  const ftcaByCandidateId = new Map(
    candidates.map((candidate) => [candidate.id, String(candidate.ftcaStatus)]),
  );
  const membershipByCandidate = new Map(
    memberships.map((membership) => [String(membership.candidate), membership]),
  );
  const affectedTeamIds = new Set<string>();
  const result = { created: 0, updated: 0, unchanged: 0, total: input.rows.length };
  const batch = pb.createBatch();

  for (const row of input.rows) {
    const data = candidateData(row);
    const existing = candidateByEmail.get(data.emailNormalized);
    if (existing) {
      if (candidateChanged(existing, data)) {
        batch.collection("candidates").update(existing.id, data);
        result.updated += 1;
        const membership = membershipByCandidate.get(existing.id);
        if (membership && existing.ftcaStatus !== data.ftcaStatus) {
          affectedTeamIds.add(String(membership.team));
        }
        Object.assign(existing, data);
        ftcaByCandidateId.set(existing.id, data.ftcaStatus);
      } else {
        result.unchanged += 1;
      }
      continue;
    }

    const id = recordId();
    const candidate = { id, ...data };
    candidateByEmail.set(data.emailNormalized, candidate);
    ftcaByCandidateId.set(id, data.ftcaStatus);
    batch.collection("candidates").create(candidate);
    result.created += 1;
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

  const importBatchId = recordId();
  const importBatch = {
    id: importBatchId,
    fileName: input.fileName,
    fileType: input.fileType,
    totalRows: input.rows.length + input.invalidRows,
    validRows: input.rows.length,
    invalidRows: input.invalidRows,
    pendingFtcaRows: input.pendingFtcaRows,
    createdBy: admin.id,
  };
  batch.collection("import_batches").create(importBatch);
  batch.collection("audit_logs").create({
    id: recordId(),
    actor: admin.id,
    action: "candidates.import",
    entityType: "import_batches",
    entityId: importBatchId,
    after: importBatch,
    reason: input.reason.trim(),
    metadata: { digest: input.digest, result },
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
