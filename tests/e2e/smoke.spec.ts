import { expect, test } from "@playwright/test";

test("la aplicación responde y muestra su contenido principal", async ({ page }) => {
  await page.goto("/");

  await expect(page.locator("main")).toBeVisible();
  await expect(page).toHaveTitle(/Lomatón/);
  await expect(
    page.getByRole("button", { name: "Continuar con Google" }),
  ).toBeVisible();

  for (let attempts = 0; attempts < 4 && !(await page.getByRole("button", { name: "Continuar con Google" }).evaluate((element) => element === document.activeElement)); attempts += 1) {
    await page.keyboard.press("Tab");
  }
  await expect(page.getByRole("button", { name: "Continuar con Google" })).toBeFocused();

  await page.getByText("Mi email no termina en @gmail.com").click();
  await expect(
    page.getByRole("link", { name: "Ver la guía oficial de Google" }),
  ).toBeVisible();

  const csp = await page.locator("body").evaluate(() => document.querySelector("meta[http-equiv='Content-Security-Policy']")?.getAttribute("content"));
  expect(csp ?? (await page.request.get("/")).headers()["content-security-policy"]).toContain("connect-src");

  await page.setViewportSize({ width: 375, height: 812 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});
