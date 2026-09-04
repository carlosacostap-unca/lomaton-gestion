// @vitest-environment node

import fs from "node:fs";
import { randomBytes } from "node:crypto";

import PocketBase from "pocketbase";
import { describe, expect, it, vi } from "vitest";

import {
  JURY_PLANILLA_ASPECTS,
  JURY_PLANILLA_RUBRIC,
  PLANILLA_JURY_CRITERIA_VERSION,
  type AspectKey,
} from "@/lib/jury-evaluation-contract";

vi.mock("server-only", () => ({}));

function loadLocalEnv() {
  const values: Record<string, string> = {};
  for (const rawLine of fs.readFileSync(".env.local", "utf8").split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator < 1) continue;
    let value = line.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
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

function aspectScores(values: number[]) {
  return Object.fromEntries(
    JURY_PLANILLA_ASPECTS.map((aspect, index) => [aspect.key, values[index]]),
  ) as Record<AspectKey, number>;
}

const enabled = process.env.LOMATON_JURY_V2_PRODUCTION_ACCEPTANCE === "true";

describe.runIf(enabled)("jury evaluation v2 production acceptance", () => {
  it("completes, publishes and cleans an isolated two-juror two-team matrix", async () => {
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

    const {
      getAdminEvaluationDashboard,
      getOwnTeamEvaluationResult,
      publishAdminEvaluation,
      reopenAdminEvaluation,
      saveOwnEvaluation,
    } = await import("@/lib/domain/jury-evaluation");
    const suffix = `${Date.now()}-${randomBytes(3).toString("hex")}`;
    const authPassword = `${randomBytes(18).toString("base64url")}Aa1!`;
    const privateObservation = `Observación privada E2E ${suffix}`;
    const ids: Record<string, string> = {};
    const tracked = [
      "users", "candidates", "teams", "team_memberships", "jurors",
      "evaluation_cycles", "jury_evaluations", "evaluation_results", "audit_logs",
    ];
    const baseline = Object.fromEntries(
      await Promise.all(tracked.map(async (name) => [name, await count(superuser, name)])),
    );
    const scores78 = aspectScores([5, 4, 3, 4, 4, 4, 3, 3, 3, 5, 5, 4, 4]);
    const scores80 = aspectScores(Array(13).fill(4));

    try {
      const existingOpen = await superuser.collection("evaluation_cycles").getList(1, 1, {
        filter: "status = 'open'",
        fields: "id",
      });
      expect(existingOpen.totalItems, "la aceptación requiere que no haya un ciclo real abierto").toBe(0);

      ids.admin = (await superuser.collection("users").create({
        email: `e2e-jury-v2-admin-${suffix}@example.test`, emailVisibility: false, verified: true,
        displayName: "E2E Jury V2 Admin", isAdmin: true, enabled: true,
        password: authPassword, passwordConfirm: authPassword,
      })).id;
      for (const index of [1, 2]) {
        const email = `e2e-jury-v2-student${index}-${suffix}@example.test`;
        ids[`candidate${index}`] = (await service.collection("candidates").create({
          fullName: `E2E V2 Estudiante ${index}`, email, emailNormalized: email,
          ftcaStatus: "confirmed", active: true,
        })).id;
        ids[`team${index}`] = (await service.collection("teams").create({
          name: `E2E V2 Equipo ${index} ${suffix}`,
          nameNormalized: `e2e v2 equipo ${index} ${suffix}`,
          owner: ids[`candidate${index}`], status: "draft", memberCount: 1, ftcaConfirmedCount: 1,
        })).id;
        ids[`membership${index}`] = (await service.collection("team_memberships").create({
          team: ids[`team${index}`], candidate: ids[`candidate${index}`], source: "owner",
        })).id;
      }
      ids.student = (await superuser.collection("users").create({
        email: `e2e-jury-v2-student1-${suffix}@example.test`, emailVisibility: false, verified: true,
        candidate: ids.candidate1, displayName: "E2E V2 Estudiante 1", isAdmin: false, enabled: true,
        password: authPassword, passwordConfirm: authPassword,
      })).id;

      for (const index of [1, 2]) {
        const email = `e2e-jury-v2-juror${index}-${suffix}@example.test`;
        ids[`juror${index}`] = (await service.collection("jurors").create({
          fullName: `E2E V2 Jurado ${index}`, email, emailNormalized: email, active: true,
        })).id;
        ids[`jurorUser${index}`] = (await superuser.collection("users").create({
          email, emailVisibility: false, verified: true, juror: ids[`juror${index}`],
          displayName: `E2E V2 Jurado ${index}`, isAdmin: false, enabled: true,
          password: authPassword, passwordConfirm: authPassword,
        })).id;
      }

      ids.cycle = (await service.collection("evaluation_cycles").create({
        status: "open", criteriaVersion: PLANILLA_JURY_CRITERIA_VERSION,
        criteriaSnapshot: JURY_PLANILLA_RUBRIC, jurorCount: 2, teamCount: 2,
        requiredCount: 4, finalizedCount: 0, version: 1,
        openedBy: ids.admin, openedAt: new Date().toISOString(),
      })).id;

      const evaluations: Array<{ id: string; juror: string; team: string }> = [];
      for (const jurorIndex of [1, 2]) {
        for (const teamIndex of [1, 2]) {
          const row = await service.collection("jury_evaluations").create({
            id: recordId(), cycle: ids.cycle, juror: ids[`juror${jurorIndex}`], team: ids[`team${teamIndex}`],
            jurorNameSnapshot: `E2E V2 Jurado ${jurorIndex}`,
            teamNameSnapshot: `E2E V2 Equipo ${teamIndex} ${suffix}`,
            status: "pending", aspectScores: {}, aspectObservations: {},
            totalNumerator: 0, totalDenominator: 0, version: 1,
          });
          evaluations.push({ id: row.id, juror: String(row.juror), team: String(row.team) });
        }
      }

      await expect(getOwnTeamEvaluationResult(
        service,
        { id: ids.student, candidate: ids.candidate1 } as never,
      )).resolves.toMatchObject({ published: false, teamId: ids.team1 });

      const first = evaluations[0];
      const firstAspect = JURY_PLANILLA_ASPECTS[0].key;
      await expect(saveOwnEvaluation(
        service,
        { id: ids.jurorUser1, juror: ids.juror1 } as never,
        first.id,
        {
          criteriaVersion: PLANILLA_JURY_CRITERIA_VERSION,
          expectedVersion: 1,
          aspectScores: { [firstAspect]: 5 },
          aspectObservations: { [firstAspect]: privateObservation },
          finalize: false,
        },
      )).resolves.toMatchObject({ mode: "v2", status: "draft", version: 2, total: null });
      await expect(saveOwnEvaluation(
        service,
        { id: ids.jurorUser1, juror: ids.juror1 } as never,
        first.id,
        {
          criteriaVersion: PLANILLA_JURY_CRITERIA_VERSION,
          expectedVersion: 2,
          aspectScores: {},
          aspectObservations: {},
          finalize: true,
        },
      )).rejects.toMatchObject({ code: "evaluation_incomplete" });

      await expect(saveOwnEvaluation(
        service,
        { id: ids.jurorUser1, juror: ids.juror1 } as never,
        first.id,
        {
          criteriaVersion: PLANILLA_JURY_CRITERIA_VERSION,
          expectedVersion: 2,
          aspectScores: scores78,
          aspectObservations: {},
          finalize: true,
        },
      )).resolves.toMatchObject({ mode: "v2", status: "finalized", version: 3, total: 78 });

      await expect(reopenAdminEvaluation(
        service,
        { id: ids.admin } as never,
        first.id,
        "Aceptación E2E v2: comprobar reapertura",
      )).resolves.toMatchObject({ mode: "v2", status: "draft", version: 4 });
      await expect(saveOwnEvaluation(
        service,
        { id: ids.jurorUser1, juror: ids.juror1 } as never,
        first.id,
        {
          criteriaVersion: PLANILLA_JURY_CRITERIA_VERSION,
          expectedVersion: 4,
          aspectScores: scores78,
          aspectObservations: {},
          finalize: true,
        },
      )).resolves.toMatchObject({ mode: "v2", status: "finalized", version: 5, total: 78 });

      let cycle = await service.collection("evaluation_cycles").getOne(ids.cycle);
      await expect(publishAdminEvaluation(
        service,
        { id: ids.admin } as never,
        ids.cycle,
        Number(cycle.version),
      )).rejects.toMatchObject({ code: "evaluation_incomplete" });

      for (const evaluation of evaluations.slice(1)) {
        const user = evaluation.juror === ids.juror1
          ? { id: ids.jurorUser1, juror: ids.juror1 }
          : { id: ids.jurorUser2, juror: ids.juror2 };
        await expect(saveOwnEvaluation(
          service,
          user as never,
          evaluation.id,
          {
            criteriaVersion: PLANILLA_JURY_CRITERIA_VERSION,
            expectedVersion: 1,
            aspectScores: evaluation.juror === ids.juror1 ? scores78 : scores80,
            aspectObservations: {},
            finalize: true,
          },
        )).resolves.toMatchObject({ mode: "v2", status: "finalized" });
      }

      const adminDashboard = await getAdminEvaluationDashboard(service);
      expect(adminDashboard.progress).toMatchObject({ finalized: 4, total: 4, missing: 0 });
      expect(JSON.stringify(adminDashboard)).toContain(privateObservation);

      cycle = await service.collection("evaluation_cycles").getOne(ids.cycle);
      await expect(publishAdminEvaluation(
        service,
        { id: ids.admin } as never,
        ids.cycle,
        Number(cycle.version),
      )).resolves.toMatchObject({ status: "published" });

      const ownResult = await getOwnTeamEvaluationResult(
        service,
        { id: ids.student, candidate: ids.candidate1 } as never,
      );
      expect(ownResult).toMatchObject({
        published: true,
        criteriaVersion: PLANILLA_JURY_CRITERIA_VERSION,
        mode: "v2",
        teamId: ids.team1,
        jurorCount: 2,
        criterionAverages: {
          innovation: 4,
          impact: 4,
          viability: 3.5,
          presentation: 4.33,
          teamwork: 4,
        },
        total: 79,
      });
      expect(JSON.stringify(ownResult)).not.toContain(privateObservation);
      expect(ownResult).not.toHaveProperty("juror");
      expect(ownResult).not.toHaveProperty("jurorId");
      expect(ownResult).not.toHaveProperty("jurorName");
      expect(JSON.stringify(ownResult)).not.toContain("E2E V2 Jurado");
      const publishedRows = await service.collection("evaluation_results").getFullList({
        filter: service.filter("cycle = {:cycle}", { cycle: ids.cycle }),
      });
      expect(publishedRows).toHaveLength(2);
      expect(publishedRows.every((row) => Number(row.totalDenominator) > 0)).toBe(true);

      const jurorAudits = await superuser.collection("audit_logs").getFullList({
        filter: superuser.filter("actor = {:actor}", { actor: ids.jurorUser1 }),
      });
      expect(JSON.stringify(jurorAudits)).not.toContain(privateObservation);
    } finally {
      const actors = [ids.admin, ids.jurorUser1, ids.jurorUser2].filter(Boolean);
      for (const actor of actors) {
        const audits = await superuser.collection("audit_logs").getFullList({
          filter: superuser.filter("actor = {:actor}", { actor }), fields: "id",
        });
        for (const audit of audits) await superuser.collection("audit_logs").delete(audit.id).catch(() => undefined);
      }
      if (ids.cycle) await superuser.collection("evaluation_cycles").delete(ids.cycle).catch(() => undefined);
      for (const id of [ids.membership1, ids.membership2]) {
        if (id) await superuser.collection("team_memberships").delete(id).catch(() => undefined);
      }
      for (const id of [ids.student, ids.jurorUser1, ids.jurorUser2, ids.admin]) {
        if (id) await superuser.collection("users").delete(id).catch(() => undefined);
      }
      for (const id of [ids.team1, ids.team2]) if (id) await superuser.collection("teams").delete(id).catch(() => undefined);
      for (const id of [ids.juror1, ids.juror2]) if (id) await superuser.collection("jurors").delete(id).catch(() => undefined);
      for (const id of [ids.candidate1, ids.candidate2]) if (id) await superuser.collection("candidates").delete(id).catch(() => undefined);
      for (const name of tracked) {
        expect(await count(superuser, name), `conteo final ${name}`).toBe(baseline[name]);
      }
    }
  }, 120_000);
});
