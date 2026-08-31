// @vitest-environment node

import ExcelJS from "exceljs";
import Papa from "papaparse";
import { describe, expect, it } from "vitest";

describe("infraestructura de planillas", () => {
  it("genera y vuelve a leer un libro Excel en memoria", async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Candidatos");
    sheet.addRow(["Nombre", "Email"]);
    sheet.addRow(["Ana", "ana@example.edu.ar"]);

    const bytes = await workbook.xlsx.writeBuffer();
    const restored = new ExcelJS.Workbook();
    await restored.xlsx.load(bytes);

    expect(restored.getWorksheet("Candidatos")?.getCell("B2").value).toBe(
      "ana@example.edu.ar",
    );
  });

  it("analiza CSV con encabezados", () => {
    const result = Papa.parse<{ Nombre: string; Email: string }>(
      "Nombre,Email\nAna,ana@example.edu.ar",
      { header: true },
    );

    expect(result.errors).toEqual([]);
    expect(result.data[0]).toEqual({
      Nombre: "Ana",
      Email: "ana@example.edu.ar",
    });
  });
});
