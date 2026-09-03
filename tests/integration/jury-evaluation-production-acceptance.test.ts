// @vitest-environment node

import fs from "node:fs";
import { randomBytes } from "node:crypto";

import PocketBase, { ClientResponseError } from "pocketbase";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

function loadLocalEnv() {
  const values: Record<string, string> = {};
  for (const rawLine of fs.readFileSync(".env.local", "utf8").split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator < 1) continue;
    let value = line.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    values[line.slice(0, separator).trim()] = value;
  }
  return values;
}

function recordId() {
  return randomBytes(12).toString("hex").slice(0, 15);
}

async function count(pb: PocketBase, collection: string) {
  return (await pb.collection(collection).getList(1, 1, { fields: "id" })).totalItems;
}

async function missing(pb: PocketBase, collection: string, id: string) {
  try {
    await pb.collection(collection).getOne(id);
    return false;
  } catch (error) {
    return error instanceof ClientResponseError && error.status === 404;
  }
}

const enabled = process.env.LOMATON_JURY_PRODUCTION_ACCEPTANCE === "true";

describe.runIf(enabled)("jury evaluation production acceptance", () => {
  it("verifies closed permissions and transactional opening, cancellation and publication", async () => {
    const env = loadLocalEnv();
    const url = env.POCKETBASE_URL || env.NEXT_PUBLIC_POCKETBASE_URL;
    const identity = env.POCKETBASE_SUPERUSER_EMAIL || env.POCKETBASE_ADMIN_EMAIL;
    const password = env.POCKETBASE_SUPERUSER_PASSWORD || env.POCKETBASE_ADMIN_PASSWORD;
    const serviceEmail = env.POCKETBASE_SERVICE_EMAIL;
    const servicePassword = env.POCKETBASE_SERVICE_PASSWORD;
    expect(url).toBe("https://pb-lomaton.epixum.com");
    expect(identity && password && serviceEmail && servicePassword).toBeTruthy();

    process.env.POCKETBASE_URL = url;
    process.env.POCKETBASE_SERVICE_EMAIL = serviceEmail;
    process.env.POCKETBASE_SERVICE_PASSWORD = servicePassword;

    const superuser = new PocketBase(url);
    const service = new PocketBase(url);
    superuser.autoCancellation(false);
    service.autoCancellation(false);
    await superuser.collection("_superusers").authWithPassword(identity, password);
    await service.collection("service_accounts").authWithPassword(serviceEmail, servicePassword);

    const { cancelAdminEvaluation, getOwnTeamEvaluationResult, publishAdminEvaluation } = await import("@/lib/domain/jury-evaluation");
    const suffix = `${Date.now()}-${randomBytes(3).toString("hex")}`;
    const authPassword = `${randomBytes(18).toString("base64url")}Aa1!`;
    const ids: Record<string, string> = {};
    const tracked = ["users", "candidates", "teams", "team_memberships", "jurors", "evaluation_cycles", "jury_evaluations", "evaluation_results", "audit_logs"];
    const baseline = Object.fromEntries(await Promise.all(tracked.map(async (name) => [name, await count(superuser, name)])));

    const createEvaluation = (cycle: string, juror: string, team: string, jurorName: string, teamName: string, scores: [number, number, number, number, number], status: "pending" | "finalized") => ({
      id: recordId(), cycle, juror, team, jurorNameSnapshot: jurorName, teamNameSnapshot: teamName, status,
      completedCriteria: status === "finalized" ? ["innovation", "impact", "viability", "presentation", "teamwork"] : [],
      scoreInnovation: scores[0], scoreImpact: scores[1], scoreViability: scores[2], scorePresentation: scores[3], scoreTeamwork: scores[4],
      totalCentipoints: scores[0] * 25 + scores[1] * 25 + scores[2] * 20 + scores[3] * 15 + scores[4] * 15,
      version: 1, finalizedAt: status === "finalized" ? new Date().toISOString() : "",
    });

    try {
      const existingOpen = await superuser.collection("evaluation_cycles").getList(1, 1, { filter: "status = 'open'", fields: "id" });
      expect(existingOpen.totalItems, "la aceptación requiere que no haya un ciclo real abierto").toBe(0);

      ids.admin = (await superuser.collection("users").create({
        email: `e2e-jury-admin-${suffix}@example.test`, emailVisibility: false, verified: true,
        displayName: "E2E Jury Admin", isAdmin: true, enabled: true, password: authPassword, passwordConfirm: authPassword,
      })).id;
      ids.candidate1 = (await service.collection("candidates").create({ fullName: "E2E Equipo Uno", email: `e2e-jury-student1-${suffix}@example.test`, emailNormalized: `e2e-jury-student1-${suffix}@example.test`, ftcaStatus: "confirmed", active: true })).id;
      ids.candidate2 = (await service.collection("candidates").create({ fullName: "E2E Equipo Dos", email: `e2e-jury-student2-${suffix}@example.test`, emailNormalized: `e2e-jury-student2-${suffix}@example.test`, ftcaStatus: "confirmed", active: true })).id;
      ids.student = (await superuser.collection("users").create({
        email: `e2e-jury-student1-${suffix}@example.test`, emailVisibility: false, verified: true, candidate: ids.candidate1,
        displayName: "E2E Equipo Uno", isAdmin: false, enabled: true, password: authPassword, passwordConfirm: authPassword,
      })).id;
      ids.team1 = (await service.collection("teams").create({ name: `E2E Jurado Uno ${suffix}`, nameNormalized: `e2e jurado uno ${suffix}`, owner: ids.candidate1, status: "draft", memberCount: 1, ftcaConfirmedCount: 1 })).id;
      ids.team2 = (await service.collection("teams").create({ name: `E2E Jurado Dos ${suffix}`, nameNormalized: `e2e jurado dos ${suffix}`, owner: ids.candidate2, status: "draft", memberCount: 1, ftcaConfirmedCount: 1 })).id;
      ids.membership = (await service.collection("team_memberships").create({ team: ids.team1, candidate: ids.candidate1, source: "owner" })).id;
      ids.juror1 = (await service.collection("jurors").create({ fullName: "E2E Jurado Uno", email: `e2e-juror1-${suffix}@example.test`, emailNormalized: `e2e-juror1-${suffix}@example.test`, active: true })).id;
      ids.juror2 = (await service.collection("jurors").create({ fullName: "E2E Jurado Dos", email: `e2e-juror2-${suffix}@example.test`, emailNormalized: `e2e-juror2-${suffix}@example.test`, active: true })).id;

      await expect(service.collection("jurors").create({ fullName: "Duplicado", email: `otro-${suffix}@example.test`, emailNormalized: `e2e-juror1-${suffix}@example.test`, active: true })).rejects.toMatchObject({ status: 400 });

      const human = await superuser.collection("users").impersonate(ids.student, 300);
      for (const collection of ["jurors", "evaluation_cycles", "jury_evaluations", "evaluation_results"]) {
        const anonymousResponse = await fetch(`${url}/api/collections/${collection}/records?page=1&perPage=1`);
        expect(anonymousResponse.status).toBe(200);
        expect((await anonymousResponse.json()).items).toEqual([]);
        const humanResponse = await fetch(`${url}/api/collections/${collection}/records?page=1&perPage=1`, { headers: { Authorization: human.authStore.token } });
        expect(humanResponse.status).toBe(200);
        expect((await humanResponse.json()).items).toEqual([]);
      }

      const failedCycleId = recordId();
      const failedEvaluationId = recordId();
      const failedOpen = service.createBatch();
      failedOpen.collection("evaluation_cycles").create({ id: failedCycleId, status: "open", criteriaVersion: "lomaton-2026-v1", jurorCount: 1, teamCount: 1, requiredCount: 1, finalizedCount: 0, version: 1, openedBy: ids.admin, openedAt: new Date().toISOString() });
      const duplicateEvaluation = createEvaluation(failedCycleId, ids.juror1, ids.team1, "E2E Jurado Uno", `E2E Jurado Uno ${suffix}`, [8, 7, 9, 6, 10], "pending");
      duplicateEvaluation.id = failedEvaluationId;
      failedOpen.collection("jury_evaluations").create(duplicateEvaluation);
      failedOpen.collection("jury_evaluations").create({ ...duplicateEvaluation, id: recordId() });
      await expect(failedOpen.send()).rejects.toMatchObject({ status: 400 });
      expect(await missing(superuser, "evaluation_cycles", failedCycleId)).toBe(true);
      expect(await missing(superuser, "jury_evaluations", failedEvaluationId)).toBe(true);

      ids.cancelledCycle = (await service.collection("evaluation_cycles").create({ status: "open", criteriaVersion: "lomaton-2026-v1", jurorCount: 1, teamCount: 1, requiredCount: 1, finalizedCount: 0, version: 1, openedBy: ids.admin, openedAt: new Date().toISOString() })).id;
      await expect(cancelAdminEvaluation(service, { id: ids.admin } as never, ids.cancelledCycle, { expectedVersion: 1, reason: "Aceptación transaccional" })).resolves.toMatchObject({ status: "cancelled", version: 2 });
      expect(await superuser.collection("audit_logs").getFirstListItem(superuser.filter("actor = {:actor} && action = {:action}", { actor: ids.admin, action: "evaluation.admin.cancel" }))).toBeTruthy();

      ids.publishCycle = (await service.collection("evaluation_cycles").create({ status: "open", criteriaVersion: "lomaton-2026-v1", jurorCount: 2, teamCount: 2, requiredCount: 4, finalizedCount: 3, version: 1, openedBy: ids.admin, openedAt: new Date().toISOString() })).id;
      const rows = [
        createEvaluation(ids.publishCycle, ids.juror1, ids.team1, "E2E Jurado Uno", `E2E Jurado Uno ${suffix}`, [8, 7, 9, 6, 10], "finalized"),
        createEvaluation(ids.publishCycle, ids.juror2, ids.team1, "E2E Jurado Dos", `E2E Jurado Uno ${suffix}`, [8, 8, 8, 8, 8], "finalized"),
        createEvaluation(ids.publishCycle, ids.juror1, ids.team2, "E2E Jurado Uno", `E2E Jurado Dos ${suffix}`, [6, 6, 6, 6, 6], "finalized"),
        createEvaluation(ids.publishCycle, ids.juror2, ids.team2, "E2E Jurado Dos", `E2E Jurado Dos ${suffix}`, [10, 10, 10, 10, 10], "pending"),
      ];
      const evaluationBatch = service.createBatch();
      for (const row of rows) evaluationBatch.collection("jury_evaluations").create(row);
      await evaluationBatch.send();

      await expect(publishAdminEvaluation(service, { id: ids.admin } as never, ids.publishCycle, 1)).rejects.toMatchObject({ code: "evaluation_incomplete" });
      expect(await count(service, "evaluation_results")).toBe(baseline.evaluation_results);
      const finalizeBatch = service.createBatch();
      finalizeBatch.collection("jury_evaluations").update(rows[3].id, { status: "finalized", completedCriteria: ["innovation", "impact", "viability", "presentation", "teamwork"], finalizedAt: new Date().toISOString(), version: 2 });
      finalizeBatch.collection("evaluation_cycles").update(ids.publishCycle, { finalizedCount: 4 });
      await finalizeBatch.send();

      ids.sentinelResult = (await service.collection("evaluation_results").create({
        cycle: ids.publishCycle, team: ids.team1, teamNameSnapshot: `E2E Jurado Uno ${suffix}`, jurorCount: 2,
        innovationSum: 16, impactSum: 15, viabilitySum: 17, presentationSum: 14, teamworkSum: 18, totalCentipointsSum: 1595, publishedAt: new Date().toISOString(),
      })).id;
      await expect(publishAdminEvaluation(service, { id: ids.admin } as never, ids.publishCycle, 1)).rejects.toMatchObject({ code: "evaluation_conflict" });
      expect((await service.collection("evaluation_cycles").getOne(ids.publishCycle)).status).toBe("open");
      expect(await service.collection("evaluation_results").getFullList({ filter: service.filter("cycle = {:cycle}", { cycle: ids.publishCycle }) })).toHaveLength(1);
      await service.collection("evaluation_results").delete(ids.sentinelResult);
      delete ids.sentinelResult;

      await expect(publishAdminEvaluation(service, { id: ids.admin } as never, ids.publishCycle, 1)).resolves.toMatchObject({ status: "published", version: 2 });
      const results = await service.collection("evaluation_results").getFullList({ filter: service.filter("cycle = {:cycle}", { cycle: ids.publishCycle }), sort: "team" });
      expect(results).toHaveLength(2);
      expect(results.find((result) => result.team === ids.team1)).toMatchObject({ jurorCount: 2, totalCentipointsSum: 1595 });
      await expect(getOwnTeamEvaluationResult(service, { id: ids.student, candidate: ids.candidate1 } as never)).resolves.toMatchObject({
        published: true, teamId: ids.team1, jurorCount: 2, total: 7.98,
        scores: { innovation: 8, impact: 7.5, viability: 8.5, presentation: 7, teamwork: 9 },
      });
    } finally {
      if (ids.admin) {
        const audits = await superuser.collection("audit_logs").getFullList({ filter: superuser.filter("actor = {:actor}", { actor: ids.admin }), fields: "id" });
        for (const audit of audits) await superuser.collection("audit_logs").delete(audit.id).catch(() => undefined);
      }
      for (const cycleId of [ids.publishCycle, ids.cancelledCycle]) if (cycleId) await superuser.collection("evaluation_cycles").delete(cycleId).catch(() => undefined);
      if (ids.membership) await superuser.collection("team_memberships").delete(ids.membership).catch(() => undefined);
      for (const id of [ids.team1, ids.team2]) if (id) await superuser.collection("teams").delete(id).catch(() => undefined);
      for (const id of [ids.juror1, ids.juror2]) if (id) await superuser.collection("jurors").delete(id).catch(() => undefined);
      for (const id of [ids.candidate1, ids.candidate2]) if (id) await superuser.collection("candidates").delete(id).catch(() => undefined);
      for (const id of [ids.student, ids.admin]) if (id) await superuser.collection("users").delete(id).catch(() => undefined);
      for (const name of tracked) expect(await count(superuser, name), `conteo final ${name}`).toBe(baseline[name]);
    }
  }, 120_000);
});
