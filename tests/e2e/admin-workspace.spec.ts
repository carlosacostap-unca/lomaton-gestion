import { expect, test, type Page } from "@playwright/test";

const adminRecord = {
  id: "admin000000001",
  collectionId: "users000000001",
  collectionName: "users",
  email: "admin@example.test",
  displayName: "Administración E2E",
  enabled: true,
  isAdmin: true,
  registration: "",
  verified: true,
};

async function installAdminSession(page: Page) {
  await page.addInitScript(({ record }) => {
    localStorage.setItem("pocketbase_auth", JSON.stringify({ token: "admin-e2e-token", record }));
  }, { record: adminRecord });
  await page.route("**/api/collections/users/auth-refresh", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ token: "admin-e2e-token", record: adminRecord }),
  }));
  await page.route("**/api/lomaton/auth/bootstrap", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ user: adminRecord, participantRole: null }),
  }));
  await page.route("**/api/lomaton/admin/report-snapshot", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      generatedAtUtc: "2026-09-02T12:00:00.000Z",
      candidates: [], teams: [], memberships: [], invitations: [], mentors: [], mentorInvitations: [], mentorships: [],
    }),
  }));
  await page.route("**/api/lomaton/admin/teams", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      teams: [
        { id: "team0000000001", name: "Equipo Uno", status: "complete", memberCount: 3, ftcaConfirmedCount: 1, mentorName: "Docente Uno", warning: "" },
        { id: "team0000000002", name: "Equipo Dos", status: "draft", memberCount: 1, ftcaConfirmedCount: 0, mentorName: "", warning: "Faltan 2 integrante(s)" },
      ],
      availableCandidates: [],
    }),
  }));
  await page.route("**/api/lomaton/admin/teams/team0000000001", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      team: { id: "team0000000001", name: "Equipo Uno", owner: "candidate000001", status: "complete", memberCount: 3, ftcaConfirmedCount: 1 },
      members: [{ id: "candidate000001", name: "Ada Integrante", email: "ada@example.test", ftcaStatus: "confirmed" }],
      invitations: [],
      mentorship: { id: "mentorship0001", mentorId: "mentor000000001", mentorName: "Docente Uno", department: "FTyCA" },
      availableCandidates: [],
      availableMentors: [{ id: "mentor000000001", name: "Docente Uno", department: "FTyCA" }],
    }),
  }));
  await page.route("**/api/lomaton/admin/certificates?*", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      items: [{ id: "certificate0001", candidateId: "candidate000001", candidateName: "Ada Integrante", candidateEmail: "ada@example.test", present: true, originalName: "regular.pdf", sizeBytes: 32, reviewStatus: "pending", version: "a".repeat(64) }],
      page: 1, perPage: 20, totalItems: 1, totalPages: 1,
    }),
  }));
  await page.route("**/api/lomaton/admin/candidates/candidate000001/certificate", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ present: true, originalName: "regular.pdf", sizeBytes: 32, reviewStatus: "pending", version: "a".repeat(64) }),
  }));
  await page.route("**/api/lomaton/admin/candidates/candidate000001/certificate/download", (route) => route.fulfill({
    status: 200,
    headers: { "Content-Type": "application/pdf", "Content-Disposition": "attachment; filename=\"regular.pdf\"", "Cache-Control": "private, no-store" },
    body: "%PDF-1.7\n1 0 obj<</Type/Catalog>>endobj\n%%EOF",
  }));
  await page.route("**/api/lomaton/admin/students", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      students: [
        { registrationId: "registration0001", candidateId: "candidate000001", name: "Ada Integrante", faculty: "FTyCA", certificateStatus: "approved", team: { id: "team0000000001", name: "Equipo Uno" }, pendingInvitations: [] },
        { registrationId: "registration0002", candidateId: "candidate000002", name: "Bea Invitada", faculty: "FACEN", certificateStatus: "pending", team: null, pendingInvitations: [{ id: "invite00000001", teamId: "team0000000002", teamName: "Equipo Dos" }] },
      ],
    }),
  }));
}

test("admin navigates sections, previews a certificate, and manages one team", async ({ page }) => {
  const cspErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error" && message.text().includes("Content Security Policy")) cspErrors.push(message.text());
  });
  await installAdminSession(page);
  await page.goto("/admin");

  const navigation = page.getByRole("navigation", { name: "Secciones de administración" });
  await expect(navigation.getByRole("link")).toHaveCount(6);
  await expect(navigation).not.toContainText("Reportes");
  await expect(navigation).not.toContainText("Auditoría");
  await expect(navigation).not.toContainText("Personas");
  await expect(navigation.getByRole("link", { name: "Resumen" })).toHaveAttribute("aria-current", "page");

  await navigation.getByRole("link", { name: "Estudiantes" }).click();
  await expect(page).toHaveURL(/\/admin\/estudiantes$/);
  await expect(page.getByText("Ada Integrante")).toBeVisible();
  await expect(page.getByText("Bea Invitada")).toBeVisible();
  await expect(page.getByText("Validado")).toBeVisible();
  await expect(page.getByText("Equipo Dos")).toBeVisible();
  await expect(page.getByText("12345678")).toHaveCount(0);
  await expect(navigation.getByRole("link", { name: "Estudiantes" })).toHaveAttribute("aria-current", "page");
  await page.reload();
  await expect(page.getByText("Ada Integrante")).toBeVisible();

  await page.goto("/admin/personas");
  await expect(page).toHaveURL(/\/admin\/estudiantes$/);
  await expect(page.getByText("Ada Integrante")).toBeVisible();

  await navigation.getByRole("link", { name: "Equipos" }).click();
  await expect(page).toHaveURL(/\/admin\/equipos$/);
  await expect(page.getByRole("heading", { name: "Equipo Uno" })).toBeVisible();
  await expect(page.getByLabel("Mentor de Equipo Uno")).toHaveCount(0);
  await page.getByLabel("Buscar equipo o mentor").fill("Uno");
  await expect(page.getByRole("heading", { name: "Equipo Dos" })).toHaveCount(0);
  await page.getByRole("link", { name: "Ver y gestionar" }).click();
  await expect(page).toHaveURL(/\/admin\/equipos\/team0000000001\?buscar=Uno$/);
  await expect(page.getByRole("heading", { name: "Equipo Uno" })).toBeVisible();
  await expect(page.getByText("Ada Integrante · FTCA · responsable")).toBeVisible();
  await page.getByRole("link", { name: /Volver a equipos/ }).click();
  await expect(page.getByLabel("Buscar equipo o mentor")).toHaveValue("Uno");

  await navigation.getByRole("link", { name: "Certificados" }).click();
  await expect(page).toHaveURL(/\/admin\/certificados$/);
  await expect(page.getByText("Ada Integrante")).toBeVisible();
  await page.getByRole("button", { name: "Revisar" }).click();
  await expect(page.locator("object[type='application/pdf']")).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Descargar PDF" })).toBeVisible();
  expect(cspErrors).toEqual([]);
  await page.reload();
  await expect(navigation.getByRole("link", { name: "Certificados" })).toHaveAttribute("aria-current", "page");
  await expect(page.locator("object[type='application/pdf']")).toHaveCount(1);

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(navigation).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);

  await page.goto("/admin/seccion-inexistente");
  await expect(page.getByRole("heading", { name: "La sección no existe" })).toBeVisible();
  await page.getByRole("link", { name: "Ir al resumen" }).click();
  await expect(page).toHaveURL(/\/admin$/);
});
