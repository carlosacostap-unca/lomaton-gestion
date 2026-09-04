import { expect, test, type BrowserContext, type Route } from "@playwright/test";

type Evaluation = {
  id: string;
  jurorId: string;
  jurorName: string;
  teamId: string;
  teamName: string;
  status: "pending" | "draft" | "finalized";
  criteriaVersion: "lomaton-2026-planilla-v2";
  mode: "v2";
  aspectScores: Record<string, number | null>;
  aspectObservations: Record<string, string>;
  criterionAverages: Record<string, number | null>;
  weightedScores: Record<string, number | null>;
  total: number | null;
  completedAspects: string[];
  version: number;
};

const teams = [
  { id: "team1", name: "Equipo Norte" },
  { id: "team2", name: "Equipo Sur" },
];

const criteria = [
  { key: "innovation", weight: 25, aspects: ["innovationNovelty", "innovationDifferentiation", "innovationIntegration"] },
  { key: "impact", weight: 25, aspects: ["impactRelevance", "impactContribution", "impactMeasurability"] },
  { key: "viability", weight: 20, aspects: ["viabilityCoherence", "viabilityResources", "viabilityRisks"] },
  { key: "presentation", weight: 15, aspects: ["presentationClarity", "presentationSynthesis", "presentationEvidence"] },
  { key: "teamwork", weight: 15, aspects: ["teamworkIntegration"] },
] as const;
const aspectKeys = criteria.flatMap((criterion) => [...criterion.aspects]);

function summarize(scores: Record<string, number | null>) {
  const criterionAverages: Record<string, number | null> = {};
  const weightedScores: Record<string, number | null> = {};
  let total = 0;
  let complete = true;
  for (const criterion of criteria) {
    const values = criterion.aspects.map((key) => scores[key]);
    if (values.some((value) => value === null || value === undefined)) {
      criterionAverages[criterion.key] = null;
      weightedScores[criterion.key] = null;
      complete = false;
      continue;
    }
    const average = values.reduce<number>((sum, value) => sum + Number(value), 0) / values.length;
    criterionAverages[criterion.key] = Math.round(average * 100) / 100;
    weightedScores[criterion.key] = Math.round(average / 5 * criterion.weight * 100) / 100;
    total += average / 5 * criterion.weight;
  }
  return {
    criterionAverages,
    weightedScores,
    total: complete ? Math.round(total * 100) / 100 : null,
  };
}

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
}

test("two jurors complete every team before private results can be published", async ({ browser }) => {
  test.setTimeout(120_000);
  const jurors: Array<{ id: string; fullName: string; email: string; active: boolean }> = [];
  let evaluations: Evaluation[] = [];
  let cycle: null | { id: string; status: "open" | "published"; version: number; criteriaVersion: "lomaton-2026-planilla-v2" } = null;

  function dashboard() {
    if (!cycle) return { cycle: null, evaluations: [], progress: { finalized: 0, total: 0, missing: 0 }, canPublish: false };
    const finalized = evaluations.filter((item) => item.status === "finalized").length;
    return {
      cycle: { ...cycle, jurorCount: jurors.length, teamCount: teams.length, requiredCount: evaluations.length, finalizedCount: finalized, openedAt: "2026-09-03T12:00:00Z", publishedAt: cycle.status === "published" ? "2026-09-03T15:00:00Z" : "" },
      evaluations,
      progress: { finalized, total: evaluations.length, missing: evaluations.length - finalized },
      canPublish: cycle.status === "open" && finalized === evaluations.length,
    };
  }

  async function installSession(context: BrowserContext, record: Record<string, unknown>, participantRole: string) {
    const page = await context.newPage();
    page.setDefaultTimeout(7_000);
    await page.addInitScript(({ authRecord }) => {
      localStorage.setItem("pocketbase_auth", JSON.stringify({ token: "e2e-token", record: authRecord }));
    }, { authRecord: record });
    await page.route("**/api/collections/users/auth-refresh", (route) => json(route, { token: "e2e-token", record }));
    await page.route("**/api/lomaton/**", async (route) => {
      const request = route.request();
      const path = new URL(request.url()).pathname;
      const method = request.method();
      if (path === "/api/lomaton/auth/bootstrap") return json(route, { user: record, participantRole });
      if (path === "/api/lomaton/admin/jurors" && method === "GET") return json(route, { jurors, rosterLocked: cycle?.status === "open" });
      if (path === "/api/lomaton/admin/jurors" && method === "POST") {
        const input = request.postDataJSON() as { fullName: string; email: string; active: boolean };
        jurors.push({ id: "juror" + (jurors.length + 1), ...input });
        return json(route, jurors.at(-1), 201);
      }
      if (path === "/api/lomaton/admin/evaluation" && method === "GET") return json(route, dashboard());
      if (path === "/api/lomaton/admin/evaluation/open" && method === "POST") {
        cycle = { id: "cycle1", status: "open", version: 1, criteriaVersion: "lomaton-2026-planilla-v2" };
        evaluations = jurors.flatMap((juror) => teams.map((team) => ({
          id: juror.id + "-" + team.id,
          jurorId: juror.id,
          jurorName: juror.fullName,
          teamId: team.id,
          teamName: team.name,
          status: "pending" as const,
          criteriaVersion: "lomaton-2026-planilla-v2" as const,
          mode: "v2" as const,
          aspectScores: Object.fromEntries(aspectKeys.map((key) => [key, null])),
          aspectObservations: Object.fromEntries(aspectKeys.map((key) => [key, ""])),
          criterionAverages: Object.fromEntries(criteria.map((criterion) => [criterion.key, null])),
          weightedScores: Object.fromEntries(criteria.map((criterion) => [criterion.key, null])),
          version: 1,
          completedAspects: [],
          total: null,
          finalizedAt: "",
        })));
        return json(route, dashboard(), 201);
      }
      if (path === "/api/lomaton/jury/evaluations" && method === "GET") {
        const own = evaluations.filter((item) => item.jurorId === record.juror);
        return json(route, { cycle, evaluations: own, progress: { finalized: own.filter((item) => item.status === "finalized").length, total: own.length } });
      }
      if (path === "/api/lomaton/jury/deliverables" && method === "GET") {
        return json(route, {
          deadlineUtc: "2030-12-31T23:59:00.000Z",
          items: teams.map((team) => ({
            teamId: team.id, teamName: team.name, lifecycle: "draft", summaryStatus: "draft_incomplete",
            version: 1, deadlineUtc: "2030-12-31T23:59:00.000Z", canEdit: false,
            missingRequired: ["presentation", "canvas", "report", "evidence"], updatedAt: "2026-09-03T12:00:00.000Z", finalizedAt: "",
            products: [
              { kind: "presentation", label: "Presentación", required: true, allowedMedia: ["file", "link"], allowedExtensions: ["pdf", "ppt", "pptx"], medium: "none" },
              { kind: "canvas", label: "Canvas", required: true, allowedMedia: ["file"], allowedExtensions: ["pdf", "png", "jpg", "jpeg"], medium: "none" },
              { kind: "report", label: "Informe", required: true, allowedMedia: ["file"], allowedExtensions: ["pdf", "doc", "docx"], medium: "none" },
              { kind: "evidence", label: "Evidencia del desarrollo alcanzado", required: true, allowedMedia: ["file", "link"], allowedExtensions: ["pdf", "png", "jpg", "jpeg", "zip"], medium: "none" },
              { kind: "video", label: "Video", required: false, allowedMedia: ["link"], allowedExtensions: [], medium: "none" },
            ],
          })),
        });
      }
      if (path.startsWith("/api/lomaton/jury/evaluations/") && method === "PATCH") {
        const id = path.split("/").at(-1);
        const input = request.postDataJSON() as {
          criteriaVersion: string;
          aspectScores: Record<string, number>;
          aspectObservations: Record<string, string>;
          finalize: boolean;
        };
        const item = evaluations.find((row) => row.id === id && row.jurorId === record.juror);
        if (!item) return json(route, { error: "evaluation_forbidden", message: "Evaluación ajena." }, 403);
        if (input.criteriaVersion !== "lomaton-2026-planilla-v2") {
          return json(route, { error: "evaluation_payload_version_mismatch", message: "Versión incorrecta." }, 409);
        }
        item.aspectScores = { ...item.aspectScores, ...input.aspectScores };
        item.aspectObservations = { ...item.aspectObservations, ...input.aspectObservations };
        item.completedAspects = aspectKeys.filter((key) => item.aspectScores[key] !== null);
        if (input.finalize && item.completedAspects.length !== aspectKeys.length) {
          return json(route, { error: "evaluation_incomplete", message: "Completá los trece aspectos." }, 400);
        }
        Object.assign(item, summarize(item.aspectScores));
        item.status = input.finalize ? "finalized" : "draft";
        item.version += 1;
        if (input.finalize && cycle) cycle.version += 1;
        return json(route, item);
      }
      if (path.endsWith("/publish") && method === "POST") {
        if (!cycle || evaluations.some((item) => item.status !== "finalized")) {
          return json(route, { error: "evaluation_incomplete", message: "Faltan evaluaciones." }, 409);
        }
        cycle.status = "published";
        cycle.version += 1;
        return json(route, cycle);
      }
      if (path.endsWith("/reopen") && method === "POST") {
        const id = path.split("/").at(-2);
        const item = evaluations.find((row) => row.id === id);
        if (!item || cycle?.status !== "open") return json(route, { error: "evaluation_not_open", message: "No disponible." }, 409);
        item.status = "draft";
        item.version += 1;
        cycle.version += 1;
        return json(route, item);
      }
      if (path === "/api/lomaton/me/evaluation-result" && method === "GET") {
        const teamId = String(record.team || "");
        if (cycle?.status !== "published") return json(route, { published: false, teamId });
        const rows = evaluations.filter((item) => item.teamId === teamId);
        const criterionAverages = Object.fromEntries(criteria.map((criterion) => [
          criterion.key,
          rows.reduce((sum, item) => sum + Number(item.criterionAverages[criterion.key]), 0) / rows.length,
        ]));
        const total = rows.reduce((sum, item) => sum + Number(item.total), 0) / rows.length;
        return json(route, {
          published: true,
          criteriaVersion: "lomaton-2026-planilla-v2",
          mode: "v2",
          teamId,
          teamName: teams.find((team) => team.id === teamId)?.name,
          jurorCount: rows.length,
          criterionAverages,
          total,
          publishedAt: "2026-09-03T15:00:00Z",
        });
      }
      return json(route, { error: "route_not_found", message: path }, 404);
    });
    return page;
  }

  const contexts: BrowserContext[] = [];
  try {
    const adminContext = await browser.newContext();
    contexts.push(adminContext);
    const admin = await installSession(adminContext, { id: "admin", collectionId: "users", collectionName: "users", email: "admin@example.test", displayName: "Admin", enabled: true, verified: true, isAdmin: true, registration: "" }, "admin");
    await admin.goto("/admin/jurados");
    for (const [name, email] of [["Jurado Uno", "uno@example.test"], ["Jurado Dos", "dos@example.test"]]) {
      await admin.getByLabel("Nombre completo").fill(name);
      await admin.getByLabel("Correo electrónico").fill(email);
      await admin.getByRole("button", { name: "Guardar jurado" }).click();
      await expect(admin.getByText("Jurado incorporado.")).toBeVisible();
    }
    await admin.getByRole("link", { name: "Evaluación" }).click();
    admin.once("dialog", (dialog) => dialog.accept());
    await admin.getByRole("button", { name: "Abrir nueva evaluación" }).click();
    await expect(admin.getByText("0/4")).toBeVisible();

    async function completeJuror(jurorId: string, values: string[], saveDraftFirst = false) {
      const context = await browser.newContext();
      contexts.push(context);
      const page = await installSession(context, { id: "user-" + jurorId, collectionId: "users", collectionName: "users", email: jurorId + "@example.test", displayName: jurorId, enabled: true, verified: true, isAdmin: false, juror: jurorId }, "juror");
      await page.goto("/jurado");
      await expect(page.getByRole("heading", { name: "Productos entregados por los equipos" })).toBeVisible();
      await page.setViewportSize({ width: 390, height: 844 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
      const evaluationPanel = page.getByRole("heading", { name: "Equipos a evaluar" }).locator("xpath=ancestor::section");
      for (let teamIndex = 0; teamIndex < teams.length; teamIndex += 1) {
        await evaluationPanel.locator(".jury-team-button").filter({ hasText: teams[teamIndex].name }).click();
        if (saveDraftFirst && teamIndex === 0) {
          await evaluationPanel.locator(".jury-evaluation-card select").first().selectOption(values[0]);
          await evaluationPanel.locator(".jury-evaluation-card textarea").first().fill("Observación E2E privada");
          await page.getByRole("button", { name: "Guardar borrador" }).click();
          await expect(page.getByText("Borrador guardado.")).toBeVisible();
          const incompleteStatus = await page.evaluate(async ({ evaluationId }) => {
            const response = await fetch("/api/lomaton/jury/evaluations/" + evaluationId, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                expectedVersion: 2,
                criteriaVersion: "lomaton-2026-planilla-v2",
                aspectScores: { innovationNovelty: 5 },
                aspectObservations: { innovationNovelty: "Observación E2E privada" },
                finalize: true,
              }),
            });
            return response.status;
          }, { evaluationId: jurorId + "-" + teams[teamIndex].id });
          expect(incompleteStatus).toBe(400);
        }
        const selects = evaluationPanel.locator(".jury-evaluation-card select");
        for (let index = 0; index < aspectKeys.length; index += 1) {
          await selects.nth(index).selectOption(values[index]);
        }
        page.once("dialog", (dialog) => dialog.accept());
        await page.getByRole("button", { name: "Finalizar evaluación" }).click();
        await expect(page.getByText("Evaluación finalizada.")).toBeVisible();
      }
      return page;
    }

    const juryOne = await completeJuror("juror1", ["5", "4", "3", "4", "4", "4", "3", "3", "3", "5", "5", "4", "4"], true);
    await admin.reload();
    await expect(admin.getByText("2/4")).toBeVisible();
    await expect(admin.getByRole("button", { name: "Publicar resultados" })).toBeDisabled();
    const earlyStatus = await admin.evaluate(async () => {
      const response = await fetch("/api/lomaton/admin/evaluation/cycle1/publish", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ expectedVersion: 3 }) });
      return response.status;
    });
    expect(earlyStatus).toBe(409);

    await completeJuror("juror2", ["4", "4", "4", "5", "4", "3", "4", "3", "3", "4", "4", "4", "5"]);
    await admin.reload();
    await expect(admin.getByText("4/4")).toBeVisible();
    await admin.getByLabel("Motivo administrativo").fill("Corrección solicitada");
    const northOne = admin.locator(".evaluation-admin-card").filter({ hasText: "Equipo Norte" }).filter({ hasText: "Jurado Uno" });
    admin.once("dialog", (dialog) => dialog.accept());
    await northOne.getByRole("button", { name: "Reabrir" }).click();
    await expect(admin.getByText("3/4")).toBeVisible();
    await expect(admin.getByRole("button", { name: "Publicar resultados" })).toBeDisabled();

    await juryOne.reload();
    const juryOneEvaluationPanel = juryOne.getByRole("heading", { name: "Equipos a evaluar" }).locator("xpath=ancestor::section");
    pageLoop: for (const team of teams) {
      const button = juryOneEvaluationPanel.locator(".jury-team-button").filter({ hasText: team.name });
      if ((await button.textContent())?.includes("Borrador")) {
        await button.click();
        juryOne.once("dialog", (dialog) => dialog.accept());
        await juryOne.getByRole("button", { name: "Finalizar evaluación" }).click();
        await expect(juryOne.getByText("Evaluación finalizada.")).toBeVisible();
        break pageLoop;
      }
    }

    await admin.reload();
    await expect(admin.getByText("4/4")).toBeVisible();
    admin.once("dialog", (dialog) => dialog.accept());
    await admin.getByRole("button", { name: "Publicar resultados" }).click();
    await expect(admin.getByText("Resultados publicados.")).toBeVisible();

    for (const team of teams) {
      const context = await browser.newContext();
      contexts.push(context);
      const student = await installSession(context, { id: "student-" + team.id, collectionId: "users", collectionName: "users", email: team.id + "@example.test", enabled: true, verified: true, candidate: "candidate-" + team.id, registration: "registration-" + team.id, team: team.id }, "student");
      await student.goto("/");
      const result = await student.evaluate(async () => {
        const response = await fetch("/api/lomaton/me/evaluation-result", { headers: { Authorization: "Bearer e2e-token" } });
        return response.json();
      }) as Record<string, unknown>;
      expect(result).toMatchObject({ published: true, teamId: team.id, jurorCount: 2 });
      expect(result).toMatchObject({ mode: "v2", criteriaVersion: "lomaton-2026-planilla-v2" });
      expect(JSON.stringify(result)).not.toContain("Jurado Uno");
      expect(JSON.stringify(result)).not.toContain("jurorId");
      expect(JSON.stringify(result)).not.toContain("Observación E2E privada");
    }
  } finally {
    await Promise.all(contexts.map((context) => context.close().catch(() => undefined)));
  }
});
