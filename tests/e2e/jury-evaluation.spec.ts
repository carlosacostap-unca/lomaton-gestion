import { expect, test, type BrowserContext, type Route } from "@playwright/test";

type Evaluation = {
  id: string;
  jurorId: string;
  jurorName: string;
  teamId: string;
  teamName: string;
  status: "pending" | "draft" | "finalized";
  scores: Record<string, number | null>;
  version: number;
};

const teams = [
  { id: "team1", name: "Equipo Norte" },
  { id: "team2", name: "Equipo Sur" },
];

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
}

test("two jurors complete every team before private results can be published", async ({ browser }) => {
  test.setTimeout(120_000);
  const jurors: Array<{ id: string; fullName: string; email: string; active: boolean }> = [];
  let evaluations: Evaluation[] = [];
  let cycle: null | { id: string; status: "open" | "published"; version: number } = null;

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
        cycle = { id: "cycle1", status: "open", version: 1 };
        evaluations = jurors.flatMap((juror) => teams.map((team) => ({
          id: juror.id + "-" + team.id,
          jurorId: juror.id,
          jurorName: juror.fullName,
          teamId: team.id,
          teamName: team.name,
          status: "pending" as const,
          scores: { innovation: null, impact: null, viability: null, presentation: null, teamwork: null },
          version: 1,
          completedCriteria: [],
          total: null,
          finalizedAt: "",
        })));
        return json(route, dashboard(), 201);
      }
      if (path === "/api/lomaton/jury/evaluations" && method === "GET") {
        const own = evaluations.filter((item) => item.jurorId === record.juror);
        return json(route, { cycle, evaluations: own, progress: { finalized: own.filter((item) => item.status === "finalized").length, total: own.length } });
      }
      if (path.startsWith("/api/lomaton/jury/evaluations/") && method === "PATCH") {
        const id = path.split("/").at(-1);
        const input = request.postDataJSON() as { scores: Record<string, number>; finalize: boolean };
        const item = evaluations.find((row) => row.id === id && row.jurorId === record.juror);
        if (!item) return json(route, { error: "evaluation_forbidden", message: "Evaluación ajena." }, 403);
        item.scores = input.scores;
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
        const average = (key: string) => rows.reduce((sum, item) => sum + Number(item.scores[key]), 0) / rows.length;
        const resultScores = { innovation: average("innovation"), impact: average("impact"), viability: average("viability"), presentation: average("presentation"), teamwork: average("teamwork") };
        const total = resultScores.innovation * .25 + resultScores.impact * .25 + resultScores.viability * .2 + resultScores.presentation * .15 + resultScores.teamwork * .15;
        return json(route, { published: true, teamId, teamName: teams.find((team) => team.id === teamId)?.name, jurorCount: rows.length, scores: resultScores, total, publishedAt: "2026-09-03T15:00:00Z" });
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
      await page.setViewportSize({ width: 390, height: 844 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
      for (let teamIndex = 0; teamIndex < teams.length; teamIndex += 1) {
        await page.locator(".jury-team-button").filter({ hasText: teams[teamIndex].name }).click();
        const inputs = page.locator(".jury-evaluation-card input");
        for (let index = 0; index < 5; index += 1) await inputs.nth(index).fill(values[index]);
        if (saveDraftFirst && teamIndex === 0) {
          await page.getByRole("button", { name: "Guardar borrador" }).click();
          await expect(page.getByText("Borrador guardado.")).toBeVisible();
        }
        page.once("dialog", (dialog) => dialog.accept());
        await page.getByRole("button", { name: "Finalizar evaluación" }).click();
        await expect(page.getByText("Evaluación finalizada.")).toBeVisible();
      }
      return page;
    }

    const juryOne = await completeJuror("juror1", ["8", "7", "9", "6", "10"], true);
    await admin.reload();
    await expect(admin.getByText("2/4")).toBeVisible();
    await expect(admin.getByRole("button", { name: "Publicar resultados" })).toBeDisabled();
    const earlyStatus = await admin.evaluate(async () => {
      const response = await fetch("/api/lomaton/admin/evaluation/cycle1/publish", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ expectedVersion: 3 }) });
      return response.status;
    });
    expect(earlyStatus).toBe(409);

    await completeJuror("juror2", ["6", "9", "7", "10", "8"]);
    await admin.reload();
    await expect(admin.getByText("4/4")).toBeVisible();
    await admin.getByLabel("Motivo administrativo").fill("Corrección solicitada");
    const northOne = admin.locator(".evaluation-admin-card").filter({ hasText: "Equipo Norte" }).filter({ hasText: "Jurado Uno" });
    admin.once("dialog", (dialog) => dialog.accept());
    await northOne.getByRole("button", { name: "Reabrir" }).click();
    await expect(admin.getByText("3/4")).toBeVisible();
    await expect(admin.getByRole("button", { name: "Publicar resultados" })).toBeDisabled();

    await juryOne.reload();
    pageLoop: for (const team of teams) {
      const button = juryOne.locator(".jury-team-button").filter({ hasText: team.name });
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
      expect(JSON.stringify(result)).not.toContain("Jurado Uno");
      expect(JSON.stringify(result)).not.toContain("jurorId");
    }
  } finally {
    await Promise.all(contexts.map((context) => context.close().catch(() => undefined)));
  }
});
