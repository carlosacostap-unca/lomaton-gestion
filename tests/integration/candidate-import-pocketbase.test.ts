// @vitest-environment node

import ExcelJS from "exceljs";
import { createHash, randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { POST as confirmImport } from "@/app/api/imports/candidates/confirm/route";
import { POST as previewImport } from "@/app/api/imports/candidates/preview/route";

const baseUrl = process.env.PB_INTEGRATION_URL;
const adminToken = process.env.PB_INTEGRATION_ADMIN_TOKEN;
const integration = describe.runIf(Boolean(baseUrl && adminToken));

function authenticatedRequest(url: string, init: RequestInit = {}) {
  return new Request(url, {
    ...init,
    headers: { ...init.headers, Authorization: adminToken! },
  });
}

async function preview(file: File) {
  const formData = new FormData();
  formData.set("file", file);
  const response = await previewImport(authenticatedRequest("http://app.test/api/imports/candidates/preview", { method: "POST", body: formData }));
  expect(response.status).toBe(200);
  return response.json() as Promise<{ fileName: string; fileType: "csv" | "xlsx"; digest: string; summary: { invalid: number; pendingFtca: number }; valid: Record<string, unknown>[] }>;
}

async function confirm(result: Awaited<ReturnType<typeof preview>>) {
  return confirmImport(authenticatedRequest("http://app.test/api/imports/candidates/confirm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...result, invalidRows: result.summary.invalid, pendingFtcaRows: result.summary.pendingFtca, rows: result.valid, reason: "prueba de integración CSV/XLSX" }),
  }));
}

integration("mixed CSV/XLSX candidate import through Route Handlers and PocketBase", () => {
  beforeAll(() => {
    process.env.POCKETBASE_URL = baseUrl;
    process.env.ADMIN_EMAILS = "carlosacostap@tecno.unca.edu.ar";
  });

  it("previews, confirms and persists only the confirmed valid rows", async () => {
    const suffix = randomUUID().slice(0, 8);
    const csvEmail = `csv-${suffix}@test.invalid`;
    const xlsxEmail = `xlsx-${suffix}@test.invalid`;
    const invalidEmail = `invalid-${suffix}`;
    const csvText = `Nombre,Apellido,Email,FTCA\nÁngela,CSV,${csvEmail},sí\nInválido,CSV,${invalidEmail},no`;
    const csvPreview = await preview(new File([csvText], "mixto.csv", { type: "text/csv" }));
    expect(csvPreview.valid).toHaveLength(1);
    expect(csvPreview.summary.invalid).toBe(1);
    expect((await confirm(csvPreview)).status).toBe(201);

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Candidatos");
    sheet.addRow(["Nombre", "Apellido", "Email", "FTCA"]);
    sheet.addRow(["Óscar", "Excel", xlsxEmail, "pendiente"]);
    const xlsxBytes = new Uint8Array(await workbook.xlsx.writeBuffer());
    const xlsxPreview = await preview(new File([xlsxBytes], "mixto.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
    expect(xlsxPreview.valid).toHaveLength(1);
    expect(xlsxPreview.summary.pendingFtca).toBe(1);
    expect((await confirm(xlsxPreview)).status).toBe(201);

    const response = await fetch(`${baseUrl}/api/collections/candidates/records?perPage=500`, { headers: { Authorization: adminToken! } });
    expect(response.status).toBe(200);
    const data = await response.json() as { items: Array<{ emailNormalized: string; firstName: string; ftcaStatus: string }> };
    const imported = data.items.filter((item) => [csvEmail, xlsxEmail].includes(item.emailNormalized));
    expect(imported).toEqual(expect.arrayContaining([
      expect.objectContaining({ emailNormalized: csvEmail, firstName: "Ángela", ftcaStatus: "confirmed" }),
      expect.objectContaining({ emailNormalized: xlsxEmail, firstName: "Óscar", ftcaStatus: "pending" }),
    ]));
    expect(data.items.some((item) => item.emailNormalized === invalidEmail)).toBe(false);
    expect(createHash("sha256").update(csvPreview.digest).digest("hex")).toHaveLength(64);
  });
});
