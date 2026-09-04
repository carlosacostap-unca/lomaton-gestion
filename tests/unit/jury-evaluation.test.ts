// @vitest-environment node

import type PocketBase from "pocketbase";
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

type Item = Record<string, unknown> & { id: string };
type Operation = { collection: string; method: "create" | "update" | "delete"; id?: string; data?: Record<string, unknown> };
type Module = typeof import("@/lib/domain/jury-evaluation");
let jury: Module;

beforeAll(async () => {
  jury = await import("@/lib/domain/jury-evaluation");
});

function fakePocketBase(seed: Record<string, Item[]>, sendError?: Error) {
  const operations: Operation[] = [];
  const matches = (item: Item, filter = "") => {
    const checks = [...filter.matchAll(/(\w+) = ("[^"]*"|true|false|\d+)/g)];
    return checks.every((match) => {
      const raw = match[2];
      const expected = raw === "true" ? true : raw === "false" ? false : raw.startsWith('"') ? JSON.parse(raw) : Number(raw);
      return item[match[1]] === expected;
    });
  };
  const select = (name: string, options: { filter?: string; sort?: string } = {}) => {
    const records = [...(seed[name] ?? [])].filter((item) => matches(item, options.filter));
    if (options.sort) {
      const descending = options.sort.startsWith("-");
      const field = options.sort.replace(/^-/, "").split(",")[0];
      records.sort((left, right) => String(left[field] ?? "").localeCompare(String(right[field] ?? "")) * (descending ? -1 : 1));
    }
    return records;
  };
  const send = vi.fn(async () => {
    if (sendError) throw sendError;
  });
  const pb = {
    filter: (template: string, params: Record<string, unknown> = {}) =>
      template.replace(/{:(\w+)}/g, (_, key: string) => JSON.stringify(params[key])),
    collection: (name: string) => ({
      getFullList: vi.fn(async (options = {}) => select(name, options)),
      getFirstListItem: vi.fn(async (filter: string) => {
        const item = select(name, { filter })[0];
        if (!item) {
          const error = new Error("not found") as Error & { status: number };
          error.status = 404;
          throw error;
        }
        return item;
      }),
      getOne: vi.fn(async (id: string) => {
        const item = (seed[name] ?? []).find((record) => record.id === id);
        if (!item) throw new Error("missing " + name + "/" + id);
        return item;
      }),
    }),
    createBatch: () => ({
      collection: (name: string) => ({
        create: (data: Record<string, unknown>) => operations.push({ collection: name, method: "create", data }),
        update: (id: string, data: Record<string, unknown>) => operations.push({ collection: name, method: "update", id, data }),
        delete: (id: string) => operations.push({ collection: name, method: "delete", id }),
      }),
      send,
    }),
  } as unknown as PocketBase;
  return { pb, operations, send };
}

const admin = { id: "admin1", enabled: true, isAdmin: true } as never;
const jurorUser = { id: "user-j1", enabled: true, isAdmin: false, juror: "juror1" } as never;
const scores = { innovation: 8, impact: 7, viability: 9, presentation: 6, teamwork: 10 };
const aspectScores = {
  innovationNovelty: 5,
  innovationDifferentiation: 4,
  innovationIntegration: 3,
  impactRelevance: 4,
  impactContribution: 4,
  impactMeasurability: 4,
  viabilityCoherence: 3,
  viabilityResources: 3,
  viabilityRisks: 3,
  presentationClarity: 5,
  presentationSynthesis: 5,
  presentationEvidence: 4,
  teamworkIntegration: 4,
};

function openCycle() {
  return { id: "cycle1", status: "open", jurorCount: 2, teamCount: 2, requiredCount: 4, finalizedCount: 0, version: 1, created: "2026-09-03" };
}

function planillaCycle(overrides: Record<string, unknown> = {}) {
  return {
    ...openCycle(),
    criteriaVersion: "lomaton-2026-planilla-v2",
    criteriaSnapshot: jury.JURY_PLANILLA_RUBRIC,
    ...overrides,
  };
}

function evaluation(overrides: Record<string, unknown> = {}): Item {
  return {
    id: "evaluation1", cycle: "cycle1", juror: "juror1", team: "team1",
    jurorNameSnapshot: "Jurado Uno", teamNameSnapshot: "Equipo Uno",
    status: "pending", completedCriteria: [], totalCentipoints: 0, version: 1,
    ...overrides,
  };
}

function planillaEvaluation(overrides: Record<string, unknown> = {}): Item {
  return evaluation({
    aspectScores: {},
    aspectObservations: {},
    totalNumerator: 0,
    totalDenominator: 0,
    ...overrides,
  });
}

describe("jury evaluation domain", () => {
  it("calculates the official integer-weighted total and rejects invalid scores", () => {
    expect(jury.calculateTotalCentipoints(scores)).toBe(795);
    expect(jury.calculateTotalCentipoints({ innovation: 0, impact: 0, viability: 0, presentation: 0, teamwork: 0 })).toBe(0);
    expect(jury.calculateTotalCentipoints({ innovation: 10, impact: 10, viability: 10, presentation: 10, teamwork: 10 })).toBe(1000);
    expect(() => jury.calculateTotalCentipoints({ ...scores, innovation: 2.5 })).toThrow(/enteros/);
    expect(() => jury.calculateTotalCentipoints({ ...scores, impact: 11 })).toThrow(/0 y 10/);
    expect(jury.JURY_CRITERIA.reduce((sum, criterion) => sum + criterion.weight, 0)).toBe(100);
  });

  it("creates the complete juror-team matrix in one transactional batch", async () => {
    const { pb, operations, send } = fakePocketBase({
      evaluation_cycles: [],
      jurors: [
        { id: "juror1", fullName: "Jurado Uno", active: true },
        { id: "juror2", fullName: "Jurado Dos", active: true },
      ],
      teams: [
        { id: "team1", name: "Equipo Uno" },
        { id: "team2", name: "Equipo Dos" },
      ],
    });
    await expect(jury.openAdminEvaluation(pb, admin)).resolves.toMatchObject({ requiredCount: 4 });
    expect(operations).toContainEqual(expect.objectContaining({
      collection: "evaluation_cycles",
      data: expect.objectContaining({
        criteriaVersion: "lomaton-2026-planilla-v2",
        criteriaSnapshot: jury.JURY_PLANILLA_RUBRIC,
      }),
    }));
    expect(operations.filter((item) => item.collection === "jury_evaluations")).toHaveLength(4);
    expect(new Set(operations.filter((item) => item.collection === "jury_evaluations").map((item) => String(item.data?.juror) + "/" + String(item.data?.team))).size).toBe(4);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("rejects empty or already-open rosters without writing", async () => {
    const empty = fakePocketBase({ evaluation_cycles: [], jurors: [], teams: [{ id: "team1" }] });
    await expect(jury.openAdminEvaluation(empty.pb, admin)).rejects.toMatchObject({ code: "juror_roster_empty" });
    expect(empty.send).not.toHaveBeenCalled();
    const existing = fakePocketBase({ evaluation_cycles: [openCycle()], jurors: [], teams: [] });
    await expect(jury.openAdminEvaluation(existing.pb, admin)).rejects.toMatchObject({ code: "evaluation_already_open" });
  });

  it("creates and updates jurors while blocking roster changes during an open cycle", async () => {
    const create = fakePocketBase({ evaluation_cycles: [] });
    await jury.createAdminJuror(create.pb, admin, { fullName: "  Ana   Pérez ", email: "ANA@EXAMPLE.TEST", active: true });
    expect(create.operations).toContainEqual(expect.objectContaining({
      collection: "jurors", method: "create",
      data: expect.objectContaining({ fullName: "Ana Pérez", emailNormalized: "ana@example.test" }),
    }));
    const frozen = fakePocketBase({ evaluation_cycles: [openCycle()] });
    await expect(jury.createAdminJuror(frozen.pb, admin, { fullName: "Otra", email: "otra@example.test", active: true }))
      .rejects.toMatchObject({ code: "evaluation_roster_frozen" });
  });

  it("deactivates a juror and clears every linked user in the same batch", async () => {
    const current = { id: "juror1", fullName: "Ana Pérez", email: "ana@example.test", emailNormalized: "ana@example.test", active: true };
    const updated = fakePocketBase({
      evaluation_cycles: [],
      jurors: [current],
      users: [{ id: "user1", juror: "juror1" }, { id: "user2", juror: "juror1" }],
    });
    await jury.updateAdminJuror(updated.pb, admin, "juror1", { fullName: "Ana Pérez", email: "ana@example.test", active: false });
    expect(updated.operations.filter((item) => item.collection === "users")).toEqual([
      expect.objectContaining({ id: "user1", data: { juror: "" } }),
      expect.objectContaining({ id: "user2", data: { juror: "" } }),
    ]);
    expect(updated.send).toHaveBeenCalledTimes(1);
  });

  it("rejects a duplicated normalized juror email before writing", async () => {
    const duplicate = fakePocketBase({
      evaluation_cycles: [],
      jurors: [{ id: "juror1", fullName: "Existente", emailNormalized: "jury@example.test", active: true }],
    });
    await expect(jury.createAdminJuror(duplicate.pb, admin, {
      fullName: "Duplicado",
      email: " JURY@example.test ",
      active: true,
    })).rejects.toMatchObject({ code: "juror_email_duplicate" });
    expect(duplicate.send).not.toHaveBeenCalled();
  });

  it("cancels an open cycle with a reason and rejects stale versions", async () => {
    const cancelled = fakePocketBase({ evaluation_cycles: [openCycle()] });
    await jury.cancelAdminEvaluation(cancelled.pb, admin, "cycle1", { expectedVersion: 1, reason: "Cambio de nómina" });
    expect(cancelled.operations).toEqual(expect.arrayContaining([
      expect.objectContaining({ collection: "evaluation_cycles", data: expect.objectContaining({ status: "cancelled", version: 2, cancelReason: "Cambio de nómina" }) }),
      expect.objectContaining({ collection: "audit_logs", data: expect.objectContaining({ reason: "Cambio de nómina" }) }),
    ]));
    expect(cancelled.send).toHaveBeenCalledTimes(1);

    const stale = fakePocketBase({ evaluation_cycles: [{ ...openCycle(), version: 3 }] });
    await expect(jury.cancelAdminEvaluation(stale.pb, admin, "cycle1", { expectedVersion: 1, reason: "Cambio" }))
      .rejects.toMatchObject({ code: "evaluation_version_conflict" });
    expect(stale.send).not.toHaveBeenCalled();
  });

  it("saves partial zero scores and finalizes only a complete current version", async () => {
    const partial = fakePocketBase({ evaluation_cycles: [openCycle()], jury_evaluations: [evaluation()] });
    const draft = await jury.saveOwnEvaluation(partial.pb, jurorUser, "evaluation1", {
      expectedVersion: 1, scores: { innovation: 0 }, finalize: false,
    });
    expect(draft).toMatchObject({ status: "draft", scores: { innovation: 0 }, completedCriteria: ["innovation"] });
    expect(partial.operations).toContainEqual(expect.objectContaining({ data: expect.objectContaining({ scoreInnovation: 0, completedCriteria: ["innovation"] }) }));

    const incomplete = fakePocketBase({ evaluation_cycles: [openCycle()], jury_evaluations: [evaluation()] });
    await expect(jury.saveOwnEvaluation(incomplete.pb, jurorUser, "evaluation1", {
      expectedVersion: 1, scores: { innovation: 5 }, finalize: true,
    })).rejects.toMatchObject({ code: "evaluation_incomplete" });

    const complete = fakePocketBase({ evaluation_cycles: [openCycle()], jury_evaluations: [evaluation()] });
    const finalized = await jury.saveOwnEvaluation(complete.pb, jurorUser, "evaluation1", {
      expectedVersion: 1, scores, finalize: true,
    });
    expect(finalized).toMatchObject({ status: "finalized", total: 7.95 });
    expect(complete.operations).toContainEqual(expect.objectContaining({ collection: "evaluation_cycles", data: { "finalizedCount+": 1, "version+": 1 } }));
  });

  it("denies foreign, stale, and finalized evaluation writes", async () => {
    const foreign = fakePocketBase({ evaluation_cycles: [openCycle()], jury_evaluations: [evaluation({ juror: "juror2" })] });
    await expect(jury.saveOwnEvaluation(foreign.pb, jurorUser, "evaluation1", { expectedVersion: 1, scores, finalize: false }))
      .rejects.toMatchObject({ code: "evaluation_forbidden" });
    const stale = fakePocketBase({ evaluation_cycles: [openCycle()], jury_evaluations: [evaluation({ version: 2 })] });
    await expect(jury.saveOwnEvaluation(stale.pb, jurorUser, "evaluation1", { expectedVersion: 1, scores, finalize: false }))
      .rejects.toMatchObject({ code: "evaluation_version_conflict" });
    const locked = fakePocketBase({ evaluation_cycles: [openCycle()], jury_evaluations: [evaluation({ status: "finalized" })] });
    await expect(jury.saveOwnEvaluation(locked.pb, jurorUser, "evaluation1", { expectedVersion: 1, scores, finalize: false }))
      .rejects.toMatchObject({ code: "evaluation_finalized" });
  });

  it("saves private planilla observations, rejects invalid values, and finalizes thirteen aspects", async () => {
    const draftStore = fakePocketBase({
      evaluation_cycles: [planillaCycle()],
      jury_evaluations: [planillaEvaluation()],
    });
    const draft = await jury.saveOwnEvaluation(draftStore.pb, jurorUser, "evaluation1", {
      expectedVersion: 1,
      criteriaVersion: "lomaton-2026-planilla-v2",
      aspectScores: { innovationNovelty: 5 },
      aspectObservations: { impactRelevance: "  Validar con usuarios  " },
      finalize: false,
    });
    expect(draft).toMatchObject({
      mode: "v2",
      status: "draft",
      aspectScores: { innovationNovelty: 5 },
      aspectObservations: { impactRelevance: "Validar con usuarios" },
      completedAspects: ["innovationNovelty"],
    });

    const incomplete = fakePocketBase({
      evaluation_cycles: [planillaCycle()],
      jury_evaluations: [planillaEvaluation()],
    });
    await expect(jury.saveOwnEvaluation(incomplete.pb, jurorUser, "evaluation1", {
      expectedVersion: 1,
      criteriaVersion: "lomaton-2026-planilla-v2",
      aspectScores: { innovationNovelty: 5 },
      aspectObservations: {},
      finalize: true,
    })).rejects.toMatchObject({ code: "evaluation_incomplete" });

    const invalid = fakePocketBase({
      evaluation_cycles: [planillaCycle()],
      jury_evaluations: [planillaEvaluation()],
    });
    await expect(jury.saveOwnEvaluation(invalid.pb, jurorUser, "evaluation1", {
      expectedVersion: 1,
      criteriaVersion: "lomaton-2026-planilla-v2",
      aspectScores: { innovationNovelty: 2.5 },
      aspectObservations: {},
      finalize: false,
    })).rejects.toMatchObject({ code: "invalid_score" });
    await expect(jury.saveOwnEvaluation(invalid.pb, jurorUser, "evaluation1", {
      expectedVersion: 1,
      criteriaVersion: "lomaton-2026-v1",
      scores,
      finalize: false,
    })).rejects.toMatchObject({ code: "evaluation_payload_version_mismatch" });

    const complete = fakePocketBase({
      evaluation_cycles: [planillaCycle()],
      jury_evaluations: [planillaEvaluation()],
    });
    const finalized = await jury.saveOwnEvaluation(complete.pb, jurorUser, "evaluation1", {
      expectedVersion: 1,
      criteriaVersion: "lomaton-2026-planilla-v2",
      aspectScores,
      aspectObservations: { innovationNovelty: "Privada" },
      finalize: true,
    });
    expect(finalized).toMatchObject({
      mode: "v2",
      status: "finalized",
      total: 78,
      criterionAverages: { innovation: 4, presentation: 4.67 },
    });
    expect(complete.operations).toContainEqual(expect.objectContaining({
      collection: "jury_evaluations",
      data: expect.objectContaining({ totalNumerator: 78, totalDenominator: 1 }),
    }));
    const audit = complete.operations.find((item) => item.collection === "audit_logs");
    expect(JSON.stringify(audit)).not.toContain("Privada");
  });

  it("reopens one finalized evaluation and blocks publication again", async () => {
    const { pb, operations } = fakePocketBase({
      evaluation_cycles: [openCycle()],
      jury_evaluations: [evaluation({ status: "finalized", version: 3, completedCriteria: Object.keys(scores), ...Object.fromEntries(jury.JURY_CRITERIA.map((item) => [item.field, scores[item.key]])) })],
    });
    await jury.reopenAdminEvaluation(pb, admin, "evaluation1", "corregir carga");
    expect(operations).toEqual(expect.arrayContaining([
      expect.objectContaining({ collection: "jury_evaluations", method: "update", data: expect.objectContaining({ status: "draft" }) }),
      expect.objectContaining({ collection: "evaluation_cycles", data: { "finalizedCount-": 1, "version+": 1 } }),
      expect.objectContaining({ collection: "audit_logs", data: expect.objectContaining({ reason: "corregir carga" }) }),
    ]));
  });

  it("publishes only a complete matrix and stores every team aggregate atomically", async () => {
    const incomplete = fakePocketBase({ evaluation_cycles: [openCycle()], jury_evaluations: [evaluation()] });
    await expect(jury.publishAdminEvaluation(incomplete.pb, admin, "cycle1", 1))
      .rejects.toMatchObject({ code: "evaluation_incomplete" });

    const completeRows = [
      evaluation({ id: "e1", status: "finalized", juror: "juror1", completedCriteria: Object.keys(scores), totalCentipoints: 750, scoreInnovation: 7, scoreImpact: 8, scoreViability: 7, scorePresentation: 8, scoreTeamwork: 7 }),
      evaluation({ id: "e2", status: "finalized", juror: "juror2", completedCriteria: Object.keys(scores), totalCentipoints: 850, scoreInnovation: 9, scoreImpact: 8, scoreViability: 9, scorePresentation: 8, scoreTeamwork: 9 }),
      evaluation({ id: "e3", team: "team2", teamNameSnapshot: "Equipo Dos", status: "finalized", juror: "juror1", completedCriteria: Object.keys(scores), totalCentipoints: 700, scoreInnovation: 7, scoreImpact: 7, scoreViability: 7, scorePresentation: 7, scoreTeamwork: 7 }),
      evaluation({ id: "e4", team: "team2", teamNameSnapshot: "Equipo Dos", status: "finalized", juror: "juror2", completedCriteria: Object.keys(scores), totalCentipoints: 800, scoreInnovation: 8, scoreImpact: 8, scoreViability: 8, scorePresentation: 8, scoreTeamwork: 8 }),
    ];
    const published = fakePocketBase({ evaluation_cycles: [openCycle()], jury_evaluations: completeRows });
    await jury.publishAdminEvaluation(published.pb, admin, "cycle1", 1);
    const results = published.operations.filter((item) => item.collection === "evaluation_results");
    expect(results).toHaveLength(2);
    expect(results[0].data).toMatchObject({ jurorCount: 2, totalCentipointsSum: 1600 });
    expect(published.send).toHaveBeenCalledTimes(1);
  });

  it("publishes exact planilla aggregates for every juror and team", async () => {
    const allThree = Object.fromEntries(jury.JURY_PLANILLA_ASPECTS.map((aspect) => [aspect.key, 3]));
    const rows = [
      planillaEvaluation({ id: "p1", status: "finalized", juror: "juror1", aspectScores: allThree }),
      planillaEvaluation({ id: "p2", status: "finalized", juror: "juror2", aspectScores: allThree }),
      planillaEvaluation({ id: "p3", team: "team2", teamNameSnapshot: "Equipo Dos", status: "finalized", juror: "juror1", aspectScores: allThree }),
      planillaEvaluation({ id: "p4", team: "team2", teamNameSnapshot: "Equipo Dos", status: "finalized", juror: "juror2", aspectScores: allThree }),
    ];
    const store = fakePocketBase({ evaluation_cycles: [planillaCycle()], jury_evaluations: rows });
    await jury.publishAdminEvaluation(store.pb, admin, "cycle1", 1);
    const results = store.operations.filter((item) => item.collection === "evaluation_results");
    expect(results).toHaveLength(2);
    expect(results[0].data).toMatchObject({
      jurorCount: 2,
      criterionAspectScoreSums: {
        innovation: 18,
        impact: 18,
        viability: 18,
        presentation: 18,
        teamwork: 6,
      },
      totalNumeratorSum: 120,
      totalDenominator: 1,
    });
  });

  it("returns only the published aggregate for the current student's team", async () => {
    const { pb } = fakePocketBase({
      team_memberships: [{ id: "membership1", candidate: "candidate1", team: "team1" }],
      evaluation_cycles: [{ ...openCycle(), status: "published", publishedAt: "2026-09-03" }],
      evaluation_results: [{
        id: "result1", cycle: "cycle1", team: "team1", teamNameSnapshot: "Equipo Uno", jurorCount: 3,
        innovationSum: 24, impactSum: 21, viabilitySum: 27, presentationSum: 18, teamworkSum: 30,
        totalCentipointsSum: 2400, publishedAt: "2026-09-03",
        jurorName: "secreto", individualScores: [1, 2, 3],
      }],
    });
    const result = await jury.getOwnTeamEvaluationResult(pb, { candidate: "candidate1" } as never);
    expect(result).toMatchObject({ published: true, teamId: "team1", scores: { innovation: 8, impact: 7, viability: 9, presentation: 6, teamwork: 10 }, total: 8 });
    expect(result).not.toHaveProperty("jurorName");
    expect(JSON.stringify(result)).not.toContain("individual");
  });

  it("returns only consolidated planilla averages and total to the team", async () => {
    const { pb } = fakePocketBase({
      team_memberships: [{ id: "membership1", candidate: "candidate1", team: "team1" }],
      evaluation_cycles: [planillaCycle({ status: "published", publishedAt: "2026-09-03" })],
      evaluation_results: [{
        id: "result1",
        cycle: "cycle1",
        team: "team1",
        teamNameSnapshot: "Equipo Uno",
        jurorCount: 2,
        criterionAspectScoreSums: {
          innovation: 18,
          impact: 18,
          viability: 18,
          presentation: 18,
          teamwork: 6,
        },
        totalNumeratorSum: 120,
        totalDenominator: 1,
        aspectObservations: { innovationNovelty: "secreto" },
        publishedAt: "2026-09-03",
      }],
    });
    const result = await jury.getOwnTeamEvaluationResult(pb, { candidate: "candidate1" } as never);
    expect(result).toMatchObject({
      published: true,
      mode: "v2",
      criteriaVersion: "lomaton-2026-planilla-v2",
      criterionAverages: {
        innovation: 3,
        impact: 3,
        viability: 3,
        presentation: 3,
        teamwork: 3,
      },
      total: 60,
    });
    expect(JSON.stringify(result)).not.toContain("aspect");
    expect(JSON.stringify(result)).not.toContain("secreto");
  });
});
