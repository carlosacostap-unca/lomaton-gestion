import { expect, test, type BrowserContext } from "@playwright/test";

const pocketBaseUrl = process.env.PB_E2E_BASE_URL;
const superuserIdentity = process.env.PB_E2E_SUPERUSER_IDENTITY;
const superuserPassword = process.env.PB_E2E_SUPERUSER_PASSWORD;

type SeededUser = { id: string; candidateId: string; email: string; token: string; record: Record<string, unknown> };

async function json(response: Response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${response.status}: ${JSON.stringify(data)}`);
  return data;
}

async function seed() {
  const auth = await json(await fetch(`${pocketBaseUrl}/api/collections/_superusers/auth-with-password`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ identity: superuserIdentity, password: superuserPassword }),
  }));
  const superToken = String(auth.token);
  const users = await json(await fetch(`${pocketBaseUrl}/api/collections/users/records?perPage=500`, { headers: { Authorization: superToken } }));
  const admin = users.items.find((item: Record<string, unknown>) => item.isAdmin && item.enabled);
  if (!admin) throw new Error("La instancia E2E no tiene un usuario administrador habilitado.");
  const adminToken = String((await json(await fetch(`${pocketBaseUrl}/__local-test/token/${admin.id}`, { method: "POST", headers: { Authorization: superToken } }))).token);
  const suffix = Date.now().toString(36);
  const rows = [
    { firstName: "Alma", lastName: `E2E ${suffix}`, email: `alma-${suffix}@test.invalid`, ftcaStatus: "confirmed" },
    { firstName: "Bruno", lastName: `E2E ${suffix}`, email: `bruno-${suffix}@test.invalid`, ftcaStatus: "not_ftca" },
    { firstName: "Clara", lastName: `E2E ${suffix}`, email: `clara-${suffix}@test.invalid`, ftcaStatus: "pending" },
  ].map((row, index) => ({ ...row, rowNumber: index + 2, emailNormalized: row.email }));
  await json(await fetch(`${pocketBaseUrl}/api/lomaton/admin/import-candidates`, {
    method: "POST", headers: { Authorization: adminToken, "Content-Type": "application/json" }, body: JSON.stringify({ fileName: "e2e.csv", fileType: "csv", digest: suffix.padEnd(64, "0").slice(0, 64), reason: "preparar E2E", invalidRows: 0, pendingFtcaRows: 1, rows }),
  }));
  const candidates = await json(await fetch(`${pocketBaseUrl}/api/collections/candidates/records?perPage=500`, { headers: { Authorization: adminToken } }));
  const seeded: SeededUser[] = [];
  for (const row of rows) {
    const candidate = candidates.items.find((item: Record<string, unknown>) => item.emailNormalized === row.email);
    const user = await json(await fetch(`${pocketBaseUrl}/__local-test/users`, {
      method: "POST", headers: { Authorization: superToken, "Content-Type": "application/json" }, body: JSON.stringify({ email: row.email, candidateId: candidate.id, displayName: row.firstName, isAdmin: false }),
    }));
    const token = await json(await fetch(`${pocketBaseUrl}/__local-test/token/${user.id}`, { method: "POST", headers: { Authorization: superToken } }));
    const record = await json(await fetch(`${pocketBaseUrl}/api/collections/users/records/${user.id}`, { headers: { Authorization: superToken } }));
    seeded.push({ id: String(user.id), candidateId: String(candidate.id), email: row.email, token: String(token.token), record });
  }
  await json(await fetch(`${pocketBaseUrl}/api/lomaton/admin/settings`, {
    method: "PATCH", headers: { Authorization: adminToken, "Content-Type": "application/json" }, body: JSON.stringify({ deadlineUtc: "2030-12-31T23:59:00.000Z", formationOpen: true, reason: "habilitar E2E" }),
  }));
  return { users: seeded, teamName: `Equipo E2E ${suffix}`, adminAuth: { token: adminToken, record: admin as Record<string, unknown> } };
}

async function authenticate(context: BrowserContext, auth: { token: string; record: Record<string, unknown> }) {
  await context.addInitScript(({ token, record }) => {
    localStorage.setItem("pocketbase_auth", JSON.stringify({ token, record }));
  }, auth);
}

test("varios candidatos forman un equipo válido y no pueden duplicar membresía", async ({ browser, request }) => {
  test.setTimeout(120_000);
  test.skip(!pocketBaseUrl || !superuserIdentity || !superuserPassword, "Requiere el PocketBase E2E local y su superusuario efímero.");
  const { users, teamName, adminAuth } = await seed();
  const ownerContext = await browser.newContext();
  await authenticate(ownerContext, { token: users[0].token, record: users[0].record });
  const owner = await ownerContext.newPage();
  await owner.goto("/candidate");
  await owner.getByLabel("Nombre del equipo").fill(teamName);
  await owner.getByRole("button", { name: "Crear equipo" }).click();
  await expect(owner.getByRole("status")).toContainText("Equipo creado");

  for (const invited of users.slice(1)) {
    await owner.getByLabel("Candidato disponible").selectOption(invited.candidateId);
    await owner.getByRole("button", { name: "Invitar" }).click();
    await expect(owner.getByRole("status")).toContainText("Invitación enviada");
    const invitedContext = await browser.newContext();
    await authenticate(invitedContext, { token: invited.token, record: invited.record });
    const invitedPage = await invitedContext.newPage();
    await invitedPage.goto("/candidate");
    await expect(invitedPage.getByText(teamName)).toBeVisible();
    await invitedPage.getByRole("button", { name: "Aceptar" }).click();
    await expect(invitedPage.getByRole("status")).toContainText("Te incorporaste");
    await invitedContext.close();
    await owner.reload();
  }

  await expect(owner.getByText(teamName)).toBeVisible();
  await expect(owner.getByText("complete")).toBeVisible();
  await expect(owner.getByText("3/4 integrantes")).toBeVisible();
  const duplicate = await request.post(`${pocketBaseUrl}/api/lomaton/teams`, {
    headers: { Authorization: users[1].token }, data: { name: `Segundo ${teamName}` },
  });
  expect(duplicate.status()).toBe(409);
  await owner.setViewportSize({ width: 390, height: 844 });
  expect(await owner.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);

  const adminContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await authenticate(adminContext, adminAuth);
  const adminPage = await adminContext.newPage();
  await adminPage.goto("/admin");
  await expect(adminPage.getByRole("heading", { name: "Padrón de candidatos" })).toBeVisible();
  await expect(adminPage.getByLabel("Fecha y hora límite (Argentina)")).toBeVisible();
  expect(await adminPage.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await adminContext.close();

  const snapshot = await json(await fetch(`${pocketBaseUrl}/api/lomaton/admin/report-snapshot`, { headers: { Authorization: adminAuth.token } }));
  const team = snapshot.teams.find((item: Record<string, unknown>) => item.name === teamName);
  if (team) await json(await fetch(`${pocketBaseUrl}/api/lomaton/admin/teams/${team.id}`, { method: "DELETE", headers: { Authorization: adminAuth.token, "Content-Type": "application/json" }, body: JSON.stringify({ reason: "limpieza E2E" }) }));
  await ownerContext.close();
});
