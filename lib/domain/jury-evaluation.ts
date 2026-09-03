import "server-only";

import { randomBytes } from "node:crypto";
import PocketBase, { ClientResponseError, type RecordModel } from "pocketbase";

import { addAudit } from "@/lib/domain/admin-commands";
import {
  JURY_CRITERIA,
  type CriterionKey,
  type JuryScores,
} from "@/lib/jury-evaluation-contract";
import type { LomatonUser } from "@/lib/pocketbase/server";
import { ApiError } from "@/lib/server/api-error";

export { JURY_CRITERIA };

function recordId() {
  return randomBytes(12).toString("hex").slice(0, 15);
}

function completed(record: RecordModel): CriterionKey[] {
  const value = record.completedCriteria;
  if (Array.isArray(value)) return value.filter((item): item is CriterionKey => JURY_CRITERIA.some((criterion) => criterion.key === item));
  return value ? [String(value) as CriterionKey] : [];
}

function scoreFromRecord(record: RecordModel, key: CriterionKey) {
  const criterion = JURY_CRITERIA.find((item) => item.key === key);
  return Number(record[String(criterion?.field)] ?? 0);
}

function validateScore(key: CriterionKey, value: unknown) {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > 10) {
    throw new ApiError(400, "Los puntajes deben ser números enteros entre 0 y 10.", "invalid_score", { criterion: key });
  }
  return Number(value);
}

export function calculateTotalCentipoints(scores: Record<CriterionKey, number>) {
  return JURY_CRITERIA.reduce((total, criterion) => total + validateScore(criterion.key, scores[criterion.key]) * criterion.weight, 0);
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

async function firstOrNull(pb: PocketBase, collection: string, filter: string) {
  try {
    return await pb.collection(collection).getFirstListItem(filter);
  } catch (error) {
    const status = error instanceof ClientResponseError
      ? error.status
      : typeof error === "object" && error !== null && "status" in error
        ? Number(error.status)
        : 0;
    if (status === 404) return null;
    throw error;
  }
}

async function openCycle(pb: PocketBase) {
  return firstOrNull(pb, "evaluation_cycles", pb.filter("status = {:status}", { status: "open" }));
}

async function sendBatch(batch: ReturnType<PocketBase["createBatch"]>) {
  try {
    await batch.send();
  } catch (error) {
    if (error instanceof ClientResponseError && [400, 409].includes(error.status)) {
      throw new ApiError(409, "Otra operación modificó la evaluación. Actualizá la pantalla.", "evaluation_conflict", error.response?.data);
    }
    throw error;
  }
}

function requireJuror(user: LomatonUser) {
  if (!user.juror) throw new ApiError(403, "Se requiere un jurado activo.", "juror_required");
  return user.juror;
}

async function ensureRosterEditable(pb: PocketBase) {
  if (await openCycle(pb)) throw new ApiError(409, "La nómina está congelada mientras la evaluación está abierta.", "evaluation_roster_frozen");
}

function jurorDto(record: RecordModel) {
  return {
    id: record.id,
    fullName: String(record.fullName || ""),
    email: String(record.email || ""),
    active: Boolean(record.active),
    updated: String(record.updated || ""),
  };
}

export async function listAdminJurors(pb: PocketBase) {
  const records = await pb.collection("jurors").getFullList({ sort: "fullName" });
  return { jurors: records.map(jurorDto), rosterLocked: Boolean(await openCycle(pb)) };
}

export async function createAdminJuror(
  pb: PocketBase,
  admin: LomatonUser,
  input: { fullName: string; email: string; active: boolean },
) {
  await ensureRosterEditable(pb);
  const fullName = input.fullName.trim().replace(/\s+/g, " ");
  const email = input.email.trim();
  if (fullName.length < 2) throw new ApiError(400, "Ingresá el nombre completo del jurado.", "invalid_juror_name");
  const duplicate = await firstOrNull(pb, "jurors", pb.filter("emailNormalized = {:email}", { email: email.toLowerCase() }));
  if (duplicate) throw new ApiError(409, "Ya existe un jurado con ese correo.", "juror_email_duplicate");
  const id = recordId();
  const after = { id, fullName, email, emailNormalized: email.toLowerCase(), active: input.active };
  const batch = pb.createBatch();
  batch.collection("jurors").create(after);
  addAudit(batch, { actorId: admin.id, action: "juror.admin.create", entityType: "jurors", entityId: id, after });
  await sendBatch(batch);
  return after;
}

export async function updateAdminJuror(
  pb: PocketBase,
  admin: LomatonUser,
  jurorId: string,
  input: { fullName: string; email: string; active: boolean },
) {
  await ensureRosterEditable(pb);
  const current = await pb.collection("jurors").getOne(jurorId);
  const fullName = input.fullName.trim().replace(/\s+/g, " ");
  const email = input.email.trim();
  if (fullName.length < 2) throw new ApiError(400, "Ingresá el nombre completo del jurado.", "invalid_juror_name");
  const duplicate = await firstOrNull(pb, "jurors", pb.filter("emailNormalized = {:email}", { email: email.toLowerCase() }));
  if (duplicate && duplicate.id !== current.id) {
    throw new ApiError(409, "Ya existe un jurado con ese correo.", "juror_email_duplicate");
  }
  const after = { fullName, email, emailNormalized: email.toLowerCase(), active: input.active };
  const linkedUsers = await pb.collection("users").getFullList({
    filter: pb.filter("juror = {:juror}", { juror: current.id }),
  });
  const batch = pb.createBatch();
  batch.collection("jurors").update(current.id, after);
  if (!input.active || String(current.emailNormalized) !== after.emailNormalized) {
    for (const user of linkedUsers) batch.collection("users").update(user.id, { juror: "" });
  }
  addAudit(batch, { actorId: admin.id, action: "juror.admin.update", entityType: "jurors", entityId: current.id, before: jurorDto(current), after: { id: current.id, ...after } });
  await sendBatch(batch);
  return { id: current.id, ...after };
}

export async function openAdminEvaluation(pb: PocketBase, admin: LomatonUser) {
  if (await openCycle(pb)) throw new ApiError(409, "Ya existe una evaluación abierta.", "evaluation_already_open");
  const [jurors, teams] = await Promise.all([
    pb.collection("jurors").getFullList({ filter: pb.filter("active = {:active}", { active: true }), sort: "fullName" }),
    pb.collection("teams").getFullList({ sort: "name" }),
  ]);
  if (!jurors.length) throw new ApiError(409, "No hay jurados activos.", "juror_roster_empty");
  if (!teams.length) throw new ApiError(409, "No hay equipos para evaluar.", "team_roster_empty");
  const id = recordId();
  const now = new Date().toISOString();
  const requiredCount = jurors.length * teams.length;
  const batch = pb.createBatch();
  batch.collection("evaluation_cycles").create({
    id, status: "open", criteriaVersion: "lomaton-2026-v1",
    jurorCount: jurors.length, teamCount: teams.length, requiredCount,
    finalizedCount: 0, version: 1, openedBy: admin.id, openedAt: now,
  });
  for (const juror of jurors) {
    for (const team of teams) {
      batch.collection("jury_evaluations").create({
        id: recordId(), cycle: id, juror: juror.id, team: team.id,
        jurorNameSnapshot: juror.fullName, teamNameSnapshot: team.name,
        status: "pending", completedCriteria: [], totalCentipoints: 0, version: 1,
      });
    }
  }
  addAudit(batch, {
    actorId: admin.id, action: "evaluation.admin.open", entityType: "evaluation_cycles",
    entityId: id, after: { jurorCount: jurors.length, teamCount: teams.length, requiredCount },
  });
  await sendBatch(batch);
  return { id, status: "open", jurorCount: jurors.length, teamCount: teams.length, requiredCount, finalizedCount: 0, version: 1 };
}

export async function cancelAdminEvaluation(
  pb: PocketBase,
  admin: LomatonUser,
  cycleId: string,
  input: { expectedVersion: number; reason: string },
) {
  const cycle = await pb.collection("evaluation_cycles").getOne(cycleId);
  if (cycle.status !== "open") throw new ApiError(409, "La evaluación ya no está abierta.", "evaluation_not_open");
  if (Number(cycle.version) !== input.expectedVersion) throw new ApiError(409, "La evaluación cambió. Actualizá la pantalla.", "evaluation_version_conflict");
  if (!input.reason.trim()) throw new ApiError(400, "Ingresá un motivo para cancelar.", "reason_required");
  const patch = { status: "cancelled", cancelledBy: admin.id, cancelledAt: new Date().toISOString(), cancelReason: input.reason.trim(), version: input.expectedVersion + 1 };
  const batch = pb.createBatch();
  batch.collection("evaluation_cycles").update(cycle.id, patch);
  addAudit(batch, { actorId: admin.id, action: "evaluation.admin.cancel", entityType: "evaluation_cycles", entityId: cycle.id, before: { status: cycle.status, version: cycle.version }, after: patch, reason: input.reason });
  await sendBatch(batch);
  return { id: cycle.id, ...patch };
}

function evaluationDto(record: RecordModel, includeJuror = false) {
  const completedCriteria = completed(record);
  const scores = Object.fromEntries(JURY_CRITERIA.map((criterion) => [
    criterion.key,
    completedCriteria.includes(criterion.key) ? scoreFromRecord(record, criterion.key) : null,
  ]));
  return {
    id: record.id,
    teamId: String(record.team || ""),
    teamName: String(record.teamNameSnapshot || ""),
    ...(includeJuror ? { jurorId: String(record.juror || ""), jurorName: String(record.jurorNameSnapshot || "") } : {}),
    status: String(record.status || "pending"),
    scores,
    total: completedCriteria.length === JURY_CRITERIA.length ? Number(record.totalCentipoints || 0) / 100 : null,
    completedCriteria,
    version: Number(record.version || 0),
    finalizedAt: String(record.finalizedAt || ""),
  };
}

export async function getJuryDashboard(pb: PocketBase, user: LomatonUser) {
  const jurorId = requireJuror(user);
  const cycle = await openCycle(pb);
  if (!cycle) return { cycle: null, criteria: JURY_CRITERIA, evaluations: [], progress: { finalized: 0, total: 0 } };
  const evaluations = await pb.collection("jury_evaluations").getFullList({
    filter: pb.filter("cycle = {:cycle} && juror = {:juror}", { cycle: cycle.id, juror: jurorId }),
    sort: "teamNameSnapshot",
  });
  return {
    cycle: { id: cycle.id, status: cycle.status, version: Number(cycle.version) },
    criteria: JURY_CRITERIA,
    evaluations: evaluations.map((record) => evaluationDto(record)),
    progress: { finalized: evaluations.filter((record) => record.status === "finalized").length, total: evaluations.length },
  };
}

export async function saveOwnEvaluation(
  pb: PocketBase,
  user: LomatonUser,
  evaluationId: string,
  input: { expectedVersion: number; scores: JuryScores; finalize: boolean },
) {
  const jurorId = requireJuror(user);
  const evaluation = await pb.collection("jury_evaluations").getOne(evaluationId);
  if (String(evaluation.juror) !== jurorId) throw new ApiError(403, "La evaluación no pertenece a este jurado.", "evaluation_forbidden");
  const cycle = await pb.collection("evaluation_cycles").getOne(String(evaluation.cycle));
  if (cycle.status !== "open") throw new ApiError(409, "La evaluación ya no está abierta.", "evaluation_not_open");
  if (evaluation.status === "finalized") throw new ApiError(409, "La evaluación está finalizada.", "evaluation_finalized");
  if (Number(evaluation.version) !== input.expectedVersion) throw new ApiError(409, "La evaluación cambió. Recargá antes de guardar.", "evaluation_version_conflict");

  const completedSet = new Set(completed(evaluation));
  const merged = {} as Record<CriterionKey, number>;
  const patch: Record<string, unknown> = {};
  for (const criterion of JURY_CRITERIA) {
    const incoming = input.scores[criterion.key];
    if (incoming !== undefined) {
      merged[criterion.key] = validateScore(criterion.key, incoming);
      patch[criterion.field] = merged[criterion.key];
      completedSet.add(criterion.key);
    } else if (completedSet.has(criterion.key)) {
      merged[criterion.key] = scoreFromRecord(evaluation, criterion.key);
    }
  }
  const allComplete = JURY_CRITERIA.every((criterion) => completedSet.has(criterion.key));
  if (input.finalize && !allComplete) {
    throw new ApiError(400, "Completá los cinco criterios antes de finalizar.", "evaluation_incomplete", {
      missing: JURY_CRITERIA.filter((criterion) => !completedSet.has(criterion.key)).map((criterion) => criterion.key),
    });
  }
  patch.completedCriteria = [...completedSet];
  patch.status = input.finalize ? "finalized" : completedSet.size ? "draft" : "pending";
  patch.totalCentipoints = allComplete ? calculateTotalCentipoints(merged) : 0;
  patch.version = input.expectedVersion + 1;
  if (input.finalize) patch.finalizedAt = new Date().toISOString();

  const batch = pb.createBatch();
  batch.collection("jury_evaluations").update(evaluation.id, patch);
  if (input.finalize) {
    batch.collection("evaluation_cycles").update(cycle.id, { "finalizedCount+": 1, "version+": 1 });
    addAudit(batch, { actorId: user.id, action: "evaluation.juror.finalize", entityType: "jury_evaluations", entityId: evaluation.id, after: { status: "finalized", totalCentipoints: patch.totalCentipoints } });
  }
  await sendBatch(batch);
  return evaluationDto({ ...evaluation, ...patch } as RecordModel);
}

export async function getAdminEvaluationDashboard(pb: PocketBase) {
  const cycles = await pb.collection("evaluation_cycles").getFullList({ sort: "-created" });
  const cycle = cycles[0] ?? null;
  if (!cycle) return { cycle: null, criteria: JURY_CRITERIA, evaluations: [], progress: { finalized: 0, total: 0 }, canPublish: false };
  const evaluations = await pb.collection("jury_evaluations").getFullList({
    filter: pb.filter("cycle = {:cycle}", { cycle: cycle.id }),
    sort: "teamNameSnapshot,jurorNameSnapshot",
  });
  const finalized = evaluations.filter((record) => record.status === "finalized").length;
  return {
    cycle: {
      id: cycle.id, status: String(cycle.status), version: Number(cycle.version),
      jurorCount: Number(cycle.jurorCount), teamCount: Number(cycle.teamCount),
      requiredCount: Number(cycle.requiredCount), finalizedCount: finalized,
      openedAt: String(cycle.openedAt || ""), publishedAt: String(cycle.publishedAt || ""),
    },
    criteria: JURY_CRITERIA,
    evaluations: evaluations.map((record) => evaluationDto(record, true)),
    progress: { finalized, total: evaluations.length, missing: evaluations.length - finalized },
    canPublish: cycle.status === "open" && evaluations.length > 0 && finalized === evaluations.length,
  };
}

export async function reopenAdminEvaluation(
  pb: PocketBase,
  admin: LomatonUser,
  evaluationId: string,
  reason: string,
) {
  if (!reason.trim()) throw new ApiError(400, "Ingresá un motivo para reabrir.", "reason_required");
  const evaluation = await pb.collection("jury_evaluations").getOne(evaluationId);
  const cycle = await pb.collection("evaluation_cycles").getOne(String(evaluation.cycle));
  if (cycle.status !== "open") throw new ApiError(409, "No se puede reabrir una evaluación publicada o cancelada.", "evaluation_not_open");
  if (evaluation.status !== "finalized") throw new ApiError(409, "La evaluación todavía no está finalizada.", "evaluation_not_finalized");
  const patch = { status: "draft", finalizedAt: "", version: Number(evaluation.version) + 1 };
  const batch = pb.createBatch();
  batch.collection("jury_evaluations").update(evaluation.id, patch);
  batch.collection("evaluation_cycles").update(cycle.id, { "finalizedCount-": 1, "version+": 1 });
  addAudit(batch, { actorId: admin.id, action: "evaluation.admin.reopen", entityType: "jury_evaluations", entityId: evaluation.id, before: { status: evaluation.status }, after: patch, reason });
  await sendBatch(batch);
  return evaluationDto({ ...evaluation, ...patch } as RecordModel, true);
}

export async function publishAdminEvaluation(
  pb: PocketBase,
  admin: LomatonUser,
  cycleId: string,
  expectedVersion: number,
) {
  const cycle = await pb.collection("evaluation_cycles").getOne(cycleId);
  if (cycle.status !== "open") throw new ApiError(409, "La evaluación no está abierta.", "evaluation_not_open");
  if (Number(cycle.version) !== expectedVersion) throw new ApiError(409, "La evaluación cambió. Actualizá la pantalla.", "evaluation_version_conflict");
  const evaluations = await pb.collection("jury_evaluations").getFullList({
    filter: pb.filter("cycle = {:cycle}", { cycle: cycle.id }),
  });
  if (!evaluations.length || evaluations.some((item) => item.status !== "finalized")) {
    throw new ApiError(409, "Todos los jurados deben finalizar todos los equipos antes de publicar.", "evaluation_incomplete");
  }
  if (evaluations.length !== Number(cycle.requiredCount)) {
    throw new ApiError(409, "La matriz de evaluación está incompleta.", "evaluation_matrix_invalid");
  }
  const byTeam = new Map<string, RecordModel[]>();
  for (const evaluation of evaluations) {
    const current = byTeam.get(String(evaluation.team)) ?? [];
    current.push(evaluation);
    byTeam.set(String(evaluation.team), current);
  }
  if (byTeam.size !== Number(cycle.teamCount)) throw new ApiError(409, "La matriz de evaluación está incompleta.", "evaluation_matrix_invalid");
  if ([...byTeam.values()].some((rows) => rows.length !== Number(cycle.jurorCount))) {
    throw new ApiError(409, "La matriz de evaluación está incompleta.", "evaluation_matrix_invalid");
  }
  const now = new Date().toISOString();
  const batch = pb.createBatch();
  for (const [teamId, rows] of byTeam) {
    const sum = (key: CriterionKey) => rows.reduce((total, row) => total + scoreFromRecord(row, key), 0);
    batch.collection("evaluation_results").create({
      id: recordId(), cycle: cycle.id, team: teamId,
      teamNameSnapshot: String(rows[0].teamNameSnapshot), jurorCount: rows.length,
      innovationSum: sum("innovation"), impactSum: sum("impact"), viabilitySum: sum("viability"),
      presentationSum: sum("presentation"), teamworkSum: sum("teamwork"),
      totalCentipointsSum: rows.reduce((total, row) => total + Number(row.totalCentipoints), 0),
      publishedAt: now,
    });
  }
  const patch = { status: "published", publishedBy: admin.id, publishedAt: now, version: expectedVersion + 1 };
  batch.collection("evaluation_cycles").update(cycle.id, patch);
  addAudit(batch, { actorId: admin.id, action: "evaluation.admin.publish", entityType: "evaluation_cycles", entityId: cycle.id, before: { status: cycle.status }, after: patch, metadata: { teamCount: byTeam.size, jurorCount: Number(cycle.jurorCount) } });
  await sendBatch(batch);
  return { id: cycle.id, ...patch };
}

function resultDto(record: RecordModel) {
  const count = Number(record.jurorCount);
  return {
    published: true as const,
    teamId: String(record.team),
    teamName: String(record.teamNameSnapshot),
    jurorCount: count,
    scores: {
      innovation: round2(Number(record.innovationSum) / count),
      impact: round2(Number(record.impactSum) / count),
      viability: round2(Number(record.viabilitySum) / count),
      presentation: round2(Number(record.presentationSum) / count),
      teamwork: round2(Number(record.teamworkSum) / count),
    },
    total: round2(Number(record.totalCentipointsSum) / count / 100),
    publishedAt: String(record.publishedAt),
  };
}

export async function getOwnTeamEvaluationResult(pb: PocketBase, user: LomatonUser) {
  if (!user.candidate) throw new ApiError(403, "Se requiere un estudiante activo.", "candidate_required");
  const membership = await firstOrNull(pb, "team_memberships", pb.filter("candidate = {:candidate}", { candidate: user.candidate }));
  if (!membership) return { published: false as const, teamId: null };
  const cycles = await pb.collection("evaluation_cycles").getFullList({
    filter: pb.filter("status = {:status}", { status: "published" }), sort: "-publishedAt",
  });
  const cycle = cycles[0];
  if (!cycle) return { published: false as const, teamId: String(membership.team) };
  const result = await firstOrNull(pb, "evaluation_results", pb.filter("cycle = {:cycle} && team = {:team}", { cycle: cycle.id, team: membership.team }));
  return result ? resultDto(result) : { published: false as const, teamId: String(membership.team) };
}
