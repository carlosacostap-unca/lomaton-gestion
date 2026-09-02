import { expect, test } from "@playwright/test";

test("la ruta histórica redirige al portal y protege el área sin sesión participante", async ({ page }) => {
  await page.goto("/candidate");
  await expect(page).toHaveURL(/\/portal$/);
  await expect(page.getByText("Esta área requiere una inscripción activa.")).toBeVisible();
  const back = page.getByRole("link", { name: "Volver al inicio" });
  await expect(back).toBeVisible();
  await back.focus();
  await expect(back).toBeFocused();
});
