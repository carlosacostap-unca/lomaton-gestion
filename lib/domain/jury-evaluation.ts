import "server-only";

import { randomBytes } from "node:crypto";
import PocketBase, { ClientResponseError, type RecordModel } from "pocketbase";

import { addAudit } from "@/lib/domain/admin-commands";
import {
  calculatePlanillaEvaluation,
  CURRENT_JURY_CRITERIA_VERSION,
  isAspectKey,
  JURY_CRITERIA,
  JURY_PLANILLA_ASPECTS,
  JURY_PLANILLA_CRITERIA,
  JURY_PLANILLA_RUBRIC,
  LEGACY_JURY_CRITERIA_VERSION,
  MAX_ASPECT_OBSERVATION_LENGTH,
  PLANILLA_JURY_CRITERIA_VERSION,
  roundFractionTo2,
  type AspectKey,
  type CriterionKey,
  type JuryAspectObservations,
  type JuryAspectScores,
  type JuryCriteriaVersion,
  type JuryScores,
} from "@/lib/jury-evaluation-contract";
import type { LomatonUser } from "@/lib/pocketbase/server";
import { ApiError } from "@/lib/server/api-error";

export { JURY_CRITERIA, JURY_PLANILLA_ASPECTS, JURY_PLANILLA_CRITERIA, JURY_PLANILLA_RUBRIC };

type EvaluationSaveInput = {
  expectedVersion: number;
  criteriaVersion?: JuryCriteriaVersion;
  scores?: JuryScores;
  aspectScores?: JuryAspectScores;
  aspectObservations?: JuryAspectObservations;
  finalize: boolean;
};

function recordId() {
  return randomBytes(12).toString("hex").slice(0, 15);
}

function parseObject(value: unknown): Record<string, unknown> {
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function criteriaVersion(record: RecordModel): JuryCriteriaVersion {
  const value = String(record.criteriaVersion || "");
  if (!value) return LEGACY_JURY_CRITERIA_VERSION;
  if (value === LEGACY_JURY_CRITERIA_VERSION || value === PLANILLA_JURY_CRITERIA_VERSION) return value;
  throw new ApiError(409, "La versión de criterios del ciclo no es compatible.", "evaluation_criteria_version_invalid");
}

function validatePlanillaSnapshot(record: RecordModel) {
  const snapshot = parseObject(record.criteriaSnapshot);
  if (snapshot.version !== PLANILLA_JURY_CRITERIA_VERSION) {
    throw new ApiError(409, "La instantánea de criterios del ciclo no es válida.", "evaluation_criteria_snapshot_invalid");
  }
  const criteria = Array.isArray(snapshot.criteria) ? snapshot.criteria : [];
  const expected = JURY_PLANILLA_CRITERIA.map((criterion) => ({
    key: criterion.key,
    label: criterion.label,
    weight: criterion.weight,
    aspects: criterion.aspects.map((aspect) => ({ key: aspect.key, label: aspect.label })),
  }));
  const actual = criteria.map((criterion) => {
    const item = parseObject(criterion);
    return {
      key: item.key,
      label: item.label,
      weight: item.weight,
      aspects: Array.isArray(item.aspects)
        ? item.aspects.map((aspect) => {
            const value = parseObject(aspect);
            return { key: value.key, label: value.label };
          })
        : [],
    };
  });
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new ApiError(409, "La instantánea de criterios del ciclo fue alterada.", "evaluation_criteria_snapshot_invalid");
  }
  return JURY_PLANILLA_RUBRIC;
}

function rubricForCycle(record: RecordModel) {
  return criteriaVersion(record) === PLANILLA_JURY_CRITERIA_VERSION
    ? validatePlanillaSnapshot(record)
    : null;
}

function validateAspectScore(key: AspectKey, value: unknown) {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > 5) {
    throw new ApiError(400, "Los puntajes por aspecto deben ser números enteros entre 1 y 5.", "invalid_score", { aspect: key });
  }
  return value;
}

function aspectScoresFromRecord(record: RecordModel) {
  const raw = parseObject(record.aspectScores);
  const scores: JuryAspectScores = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!isAspectKey(key)) {
      throw new ApiError(409, "La evaluación contiene un aspecto desconocido.", "evaluation_aspects_invalid", { aspect: key });
    }
    scores[key] = validateAspectScore(key, value);
  }
  return scores;
}

function aspectObservationsFromRecord(record: RecordModel) {
  const raw = parseObject(record.aspectObservations);
  const observations: JuryAspectObservations = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!isAspectKey(key) || typeof value !== "string" || value.length > MAX_ASPECT_OBSERVATION_LENGTH) {
      throw new ApiError(409, "La evaluación contiene observaciones inválidas.", "evaluation_observations_invalid", { aspect: key });
    }
    if (value) observations[key] = value;
  }
  return observations;
}

function validateIncomingAspectScores(input: JuryAspectScores | undefined) {
  const scores: JuryAspectScores = {};
  for (const [key, value] of Object.entries(input || {})) {
    if (!isAspectKey(key)) {
      throw new ApiError(400, "El puntaje contiene un aspecto desconocido.", "invalid_aspect", { aspect: key });
    }
    scores[key] = validateAspectScore(key, value);
  }
  return scores;
}

function normalizeIncomingObservations(input: JuryAspectObservations | undefined) {
  const observations: JuryAspectObservations = {};
  for (const [key, value] of Object.entries(input || {})) {
    if (!isAspectKey(key) || typeof value !== "string") {
      throw new ApiError(400, "La observación pertenece a un aspecto desconocido.", "invalid_aspect_observation", { aspect: key });
    }
    const normalized = value.trim();
    if (normalized.length > MAX_ASPECT_OBSERVATION_LENGTH) {
      throw new ApiError(400, `Las observaciones admiten hasta ${MAX_ASPECT_OBSERVATION_LENGTH} caracteres.`, "observation_too_long", { aspect: key });
    }
    observations[key] = normalized;
  }
  return observations;
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

function gcd(left: number, right: number) {
  let a = Math.abs(left);
  let b = Math.abs(right);
  while (b) [a, b] = [b, a % b];
  return a || 1;
}

function lcm(left: number, right: number) {
  return Math.abs(left * right) / gcd(left, right);
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
    id, status: "open", criteriaVersion: CURRENT_JURY_CRITERIA_VERSION,
    criteriaSnapshot: JURY_PLANILLA_RUBRIC,
    jurorCount: jurors.length, teamCount: teams.length, requiredCount,
    finalizedCount: 0, version: 1, openedBy: admin.id, openedAt: now,
  });
  for (const juror of jurors) {
    for (const team of teams) {
      batch.collection("jury_evaluations").create({
        id: recordId(), cycle: id, juror: juror.id, team: team.id,
        jurorNameSnapshot: juror.fullName, teamNameSnapshot: team.name,
        status: "pending", completedCriteria: [], totalCentipoints: 0,
        aspectScores: {}, aspectObservations: {}, totalNumerator: 0, totalDenominator: 0,
        version: 1,
      });
    }
  }
  addAudit(batch, {
    actorId: admin.id, action: "evaluation.admin.open", entityType: "evaluation_cycles",
    entityId: id, after: {
      criteriaVersion: CURRENT_JURY_CRITERIA_VERSION,
      jurorCount: jurors.length, teamCount: teams.length, requiredCount,
    },
  });
  await sendBatch(batch);
  return {
    id, status: "open", criteriaVersion: CURRENT_JURY_CRITERIA_VERSION,
    jurorCount: jurors.length, teamCount: teams.length, requiredCount,
    finalizedCount: 0, version: 1,
  };
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

function legacyEvaluationDto(record: RecordModel, includeJuror = false) {
  const completedCriteria = completed(record);
  const scores = Object.fromEntries(JURY_CRITERIA.map((criterion) => [
    criterion.key,
    completedCriteria.includes(criterion.key) ? scoreFromRecord(record, criterion.key) : null,
  ])) as Record<CriterionKey, number | null>;
  return {
    id: record.id,
    teamId: String(record.team || ""),
    teamName: String(record.teamNameSnapshot || ""),
    ...(includeJuror ? { jurorId: String(record.juror || ""), jurorName: String(record.jurorNameSnapshot || "") } : {}),
    status: String(record.status || "pending"),
    criteriaVersion: LEGACY_JURY_CRITERIA_VERSION,
    mode: "v1" as const,
    scores,
    total: completedCriteria.length === JURY_CRITERIA.length ? Number(record.totalCentipoints || 0) / 100 : null,
    completedCriteria,
    version: Number(record.version || 0),
    finalizedAt: String(record.finalizedAt || ""),
  };
}

function planillaEvaluationDto(record: RecordModel, includeJuror = false) {
  const savedScores = aspectScoresFromRecord(record);
  const savedObservations = aspectObservationsFromRecord(record);
  const aspectScores = Object.fromEntries(JURY_PLANILLA_ASPECTS.map((aspect) => [
    aspect.key,
    savedScores[aspect.key] ?? null,
  ])) as Record<AspectKey, number | null>;
  const aspectObservations = Object.fromEntries(JURY_PLANILLA_ASPECTS.map((aspect) => [
    aspect.key,
    savedObservations[aspect.key] ?? "",
  ])) as Record<AspectKey, string>;
  const criterionAverages = {} as Record<CriterionKey, number | null>;
  const weightedScores = {} as Record<CriterionKey, number | null>;
  for (const criterion of JURY_PLANILLA_CRITERIA) {
    const values = criterion.aspects.map((aspect) => savedScores[aspect.key]);
    const criterionComplete = values.every((value) => value !== undefined);
    const sum = criterionComplete ? values.reduce((subtotal, value) => subtotal + Number(value), 0) : 0;
    criterionAverages[criterion.key] = criterionComplete ? roundFractionTo2(sum, criterion.aspects.length) : null;
    weightedScores[criterion.key] = criterionComplete
      ? roundFractionTo2(sum * criterion.weight, criterion.aspects.length * 5)
      : null;
  }
  const allComplete = JURY_PLANILLA_ASPECTS.every((aspect) => savedScores[aspect.key] !== undefined);
  const calculation = allComplete
    ? calculatePlanillaEvaluation(savedScores as Record<AspectKey, number>)
    : null;
  return {
    id: record.id,
    teamId: String(record.team || ""),
    teamName: String(record.teamNameSnapshot || ""),
    ...(includeJuror ? { jurorId: String(record.juror || ""), jurorName: String(record.jurorNameSnapshot || "") } : {}),
    status: String(record.status || "pending"),
    criteriaVersion: PLANILLA_JURY_CRITERIA_VERSION,
    mode: "v2" as const,
    aspectScores,
    aspectObservations,
    criterionAverages,
    weightedScores,
    total: calculation?.total ?? null,
    completedAspects: JURY_PLANILLA_ASPECTS
      .filter((aspect) => savedScores[aspect.key] !== undefined)
      .map((aspect) => aspect.key),
    version: Number(record.version || 0),
    finalizedAt: String(record.finalizedAt || ""),
  };
}

function evaluationDto(record: RecordModel, cycle: RecordModel, includeJuror = false) {
  return criteriaVersion(cycle) === PLANILLA_JURY_CRITERIA_VERSION
    ? planillaEvaluationDto(record, includeJuror)
    : legacyEvaluationDto(record, includeJuror);
}

export async function getJuryDashboard(pb: PocketBase, user: LomatonUser) {
  const jurorId = requireJuror(user);
  const cycle = await openCycle(pb);
  if (!cycle) {
    return {
      cycle: null, criteria: JURY_CRITERIA, rubric: JURY_PLANILLA_RUBRIC,
      evaluations: [], progress: { finalized: 0, total: 0 },
    };
  }
  const rubric = rubricForCycle(cycle);
  const evaluations = await pb.collection("jury_evaluations").getFullList({
    filter: pb.filter("cycle = {:cycle} && juror = {:juror}", { cycle: cycle.id, juror: jurorId }),
    sort: "teamNameSnapshot",
  });
  return {
    cycle: {
      id: cycle.id, status: cycle.status, version: Number(cycle.version),
      criteriaVersion: criteriaVersion(cycle),
    },
    criteria: JURY_CRITERIA,
    rubric,
    evaluations: evaluations.map((record) => evaluationDto(record, cycle)),
    progress: { finalized: evaluations.filter((record) => record.status === "finalized").length, total: evaluations.length },
  };
}

export async function saveOwnEvaluation(
  pb: PocketBase,
  user: LomatonUser,
  evaluationId: string,
  input: EvaluationSaveInput,
) {
  const jurorId = requireJuror(user);
  const evaluation = await pb.collection("jury_evaluations").getOne(evaluationId);
  if (String(evaluation.juror) !== jurorId) throw new ApiError(403, "La evaluación no pertenece a este jurado.", "evaluation_forbidden");
  const cycle = await pb.collection("evaluation_cycles").getOne(String(evaluation.cycle));
  const cycleCriteriaVersion = criteriaVersion(cycle);
  rubricForCycle(cycle);
  if (input.criteriaVersion && input.criteriaVersion !== cycleCriteriaVersion) {
    throw new ApiError(409, "El formulario pertenece a otra versión de criterios.", "evaluation_payload_version_mismatch");
  }
  if (cycle.status !== "open") throw new ApiError(409, "La evaluación ya no está abierta.", "evaluation_not_open");
  if (evaluation.status === "finalized") throw new ApiError(409, "La evaluación está finalizada.", "evaluation_finalized");
  if (Number(evaluation.version) !== input.expectedVersion) throw new ApiError(409, "La evaluación cambió. Recargá antes de guardar.", "evaluation_version_conflict");

  const patch: Record<string, unknown> = {};
  let audit: Record<string, unknown>;
  if (cycleCriteriaVersion === PLANILLA_JURY_CRITERIA_VERSION) {
    if (input.scores && Object.keys(input.scores).length) {
      throw new ApiError(400, "La nueva matriz requiere puntajes por aspecto.", "evaluation_payload_version_mismatch");
    }
    const mergedScores = { ...aspectScoresFromRecord(evaluation), ...validateIncomingAspectScores(input.aspectScores) };
    const mergedObservations = { ...aspectObservationsFromRecord(evaluation) };
    for (const [key, value] of Object.entries(normalizeIncomingObservations(input.aspectObservations))) {
      if (value) mergedObservations[key as AspectKey] = value;
      else delete mergedObservations[key as AspectKey];
    }
    const missing = JURY_PLANILLA_ASPECTS
      .filter((aspect) => mergedScores[aspect.key] === undefined)
      .map((aspect) => aspect.key);
    if (input.finalize && missing.length) {
      throw new ApiError(400, "Completá los trece aspectos antes de finalizar.", "evaluation_incomplete", { missing });
    }
    const calculation = missing.length === 0
      ? calculatePlanillaEvaluation(mergedScores as Record<AspectKey, number>)
      : null;
    const hasDraftData = Object.keys(mergedScores).length > 0 || Object.keys(mergedObservations).length > 0;
    Object.assign(patch, {
      aspectScores: mergedScores,
      aspectObservations: mergedObservations,
      status: input.finalize ? "finalized" : hasDraftData ? "draft" : "pending",
      totalNumerator: calculation?.totalNumerator ?? 0,
      totalDenominator: calculation?.totalDenominator ?? 0,
    });
    audit = {
      completedAspects: Object.keys(mergedScores),
      totalNumerator: patch.totalNumerator,
      totalDenominator: patch.totalDenominator,
    };
  } else {
    const completedSet = new Set(completed(evaluation));
    const merged = {} as Record<CriterionKey, number>;
    for (const criterion of JURY_CRITERIA) {
      const incoming = input.scores?.[criterion.key];
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
    audit = { completedCriteria: [...completedSet], totalCentipoints: patch.totalCentipoints };
  }
  patch.version = input.expectedVersion + 1;
  if (input.finalize) patch.finalizedAt = new Date().toISOString();

  const batch = pb.createBatch();
  batch.collection("jury_evaluations").update(evaluation.id, patch);
  if (input.finalize) {
    batch.collection("evaluation_cycles").update(cycle.id, { "finalizedCount+": 1, "version+": 1 });
    addAudit(batch, {
      actorId: user.id,
      action: "evaluation.juror.finalize",
      entityType: "jury_evaluations",
      entityId: evaluation.id,
      after: { status: "finalized", criteriaVersion: cycleCriteriaVersion, ...audit },
    });
  }
  await sendBatch(batch);
  return evaluationDto({ ...evaluation, ...patch } as RecordModel, cycle);
}

export async function getAdminEvaluationDashboard(pb: PocketBase) {
  const cycles = await pb.collection("evaluation_cycles").getFullList({ sort: "-created" });
  const cycle = cycles[0] ?? null;
  if (!cycle) {
    return {
      cycle: null, criteria: JURY_CRITERIA, rubric: JURY_PLANILLA_RUBRIC,
      evaluations: [], progress: { finalized: 0, total: 0, missing: 0 }, canPublish: false,
    };
  }
  const rubric = rubricForCycle(cycle);
  const evaluations = await pb.collection("jury_evaluations").getFullList({
    filter: pb.filter("cycle = {:cycle}", { cycle: cycle.id }),
    sort: "teamNameSnapshot,jurorNameSnapshot",
  });
  const finalized = evaluations.filter((record) => record.status === "finalized").length;
  return {
    cycle: {
      id: cycle.id, status: String(cycle.status), version: Number(cycle.version),
      criteriaVersion: criteriaVersion(cycle),
      jurorCount: Number(cycle.jurorCount), teamCount: Number(cycle.teamCount),
      requiredCount: Number(cycle.requiredCount), finalizedCount: finalized,
      openedAt: String(cycle.openedAt || ""), publishedAt: String(cycle.publishedAt || ""),
    },
    criteria: JURY_CRITERIA,
    rubric,
    evaluations: evaluations.map((record) => evaluationDto(record, cycle, true)),
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
  rubricForCycle(cycle);
  if (cycle.status !== "open") throw new ApiError(409, "No se puede reabrir una evaluación publicada o cancelada.", "evaluation_not_open");
  if (evaluation.status !== "finalized") throw new ApiError(409, "La evaluación todavía no está finalizada.", "evaluation_not_finalized");
  const patch = { status: "draft", finalizedAt: "", version: Number(evaluation.version) + 1 };
  const batch = pb.createBatch();
  batch.collection("jury_evaluations").update(evaluation.id, patch);
  batch.collection("evaluation_cycles").update(cycle.id, { "finalizedCount-": 1, "version+": 1 });
  addAudit(batch, { actorId: admin.id, action: "evaluation.admin.reopen", entityType: "jury_evaluations", entityId: evaluation.id, before: { status: evaluation.status }, after: patch, reason });
  await sendBatch(batch);
  return evaluationDto({ ...evaluation, ...patch } as RecordModel, cycle, true);
}

function createPlanillaResult(rows: RecordModel[]) {
  const criterionAspectScoreSums = Object.fromEntries(
    JURY_PLANILLA_CRITERIA.map((criterion) => [criterion.key, 0]),
  ) as Record<CriterionKey, number>;
  const exactRows = rows.map((row) => {
    const scores = aspectScoresFromRecord(row);
    const missing = JURY_PLANILLA_ASPECTS.filter((aspect) => scores[aspect.key] === undefined);
    if (missing.length) {
      throw new ApiError(409, "Una evaluación finalizada no contiene los trece aspectos.", "evaluation_matrix_invalid");
    }
    const calculation = calculatePlanillaEvaluation(scores as Record<AspectKey, number>);
    for (const criterion of JURY_PLANILLA_CRITERIA) {
      criterionAspectScoreSums[criterion.key] += calculation.criterionSums[criterion.key];
    }
    return calculation;
  });
  const totalDenominator = exactRows.reduce(
    (current, calculation) => lcm(current, calculation.totalDenominator),
    1,
  );
  const totalNumeratorSum = exactRows.reduce(
    (sum, calculation) =>
      sum + calculation.totalNumerator * (totalDenominator / calculation.totalDenominator),
    0,
  );
  return { criterionAspectScoreSums, totalNumeratorSum, totalDenominator };
}

export async function publishAdminEvaluation(
  pb: PocketBase,
  admin: LomatonUser,
  cycleId: string,
  expectedVersion: number,
) {
  const cycle = await pb.collection("evaluation_cycles").getOne(cycleId);
  const cycleCriteriaVersion = criteriaVersion(cycle);
  rubricForCycle(cycle);
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
    const aggregate = cycleCriteriaVersion === PLANILLA_JURY_CRITERIA_VERSION
      ? createPlanillaResult(rows)
      : (() => {
          const sum = (key: CriterionKey) => rows.reduce((total, row) => total + scoreFromRecord(row, key), 0);
          return {
            innovationSum: sum("innovation"),
            impactSum: sum("impact"),
            viabilitySum: sum("viability"),
            presentationSum: sum("presentation"),
            teamworkSum: sum("teamwork"),
            totalCentipointsSum: rows.reduce((total, row) => total + Number(row.totalCentipoints), 0),
          };
        })();
    batch.collection("evaluation_results").create({
      id: recordId(), cycle: cycle.id, team: teamId,
      teamNameSnapshot: String(rows[0].teamNameSnapshot), jurorCount: rows.length,
      ...aggregate,
      publishedAt: now,
    });
  }
  const patch = { status: "published", publishedBy: admin.id, publishedAt: now, version: expectedVersion + 1 };
  batch.collection("evaluation_cycles").update(cycle.id, patch);
  addAudit(batch, {
    actorId: admin.id,
    action: "evaluation.admin.publish",
    entityType: "evaluation_cycles",
    entityId: cycle.id,
    before: { status: cycle.status },
    after: { ...patch, criteriaVersion: cycleCriteriaVersion },
    metadata: { teamCount: byTeam.size, jurorCount: Number(cycle.jurorCount) },
  });
  await sendBatch(batch);
  return { id: cycle.id, ...patch };
}

function legacyResultDto(record: RecordModel) {
  const count = Number(record.jurorCount);
  return {
    published: true as const,
    criteriaVersion: LEGACY_JURY_CRITERIA_VERSION,
    mode: "v1" as const,
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

function planillaResultDto(record: RecordModel) {
  const count = Number(record.jurorCount);
  const sums = parseObject(record.criterionAspectScoreSums);
  const criterionAverages = {} as Record<CriterionKey, number>;
  for (const criterion of JURY_PLANILLA_CRITERIA) {
    const sum = Number(sums[criterion.key]);
    if (!Number.isSafeInteger(sum) || sum < count * criterion.aspects.length ||
        sum > count * criterion.aspects.length * 5) {
      throw new ApiError(409, "El resultado publicado no coincide con la rúbrica.", "evaluation_result_invalid");
    }
    criterionAverages[criterion.key] = roundFractionTo2(
      sum,
      count * criterion.aspects.length,
    );
  }
  const totalNumeratorSum = Number(record.totalNumeratorSum);
  const totalDenominator = Number(record.totalDenominator);
  if (!Number.isSafeInteger(totalNumeratorSum) || !Number.isSafeInteger(totalDenominator) ||
      totalNumeratorSum < 0 || totalDenominator <= 0) {
    throw new ApiError(409, "El total publicado no es válido.", "evaluation_result_invalid");
  }
  return {
    published: true as const,
    criteriaVersion: PLANILLA_JURY_CRITERIA_VERSION,
    mode: "v2" as const,
    teamId: String(record.team),
    teamName: String(record.teamNameSnapshot),
    jurorCount: count,
    criterionAverages,
    total: roundFractionTo2(totalNumeratorSum, totalDenominator * count),
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
  const cycleCriteriaVersion = criteriaVersion(cycle);
  rubricForCycle(cycle);
  const result = await firstOrNull(pb, "evaluation_results", pb.filter("cycle = {:cycle} && team = {:team}", { cycle: cycle.id, team: membership.team }));
  if (!result) return { published: false as const, teamId: String(membership.team) };
  return cycleCriteriaVersion === PLANILLA_JURY_CRITERIA_VERSION
    ? planillaResultDto(result)
    : legacyResultDto(result);
}
