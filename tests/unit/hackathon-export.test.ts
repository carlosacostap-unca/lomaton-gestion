import ExcelJS from "exceljs";
import Papa from "papaparse";
import { describe, expect, it } from "vitest";

import { argentinaSnapshotLabel, exportCsv, exportXlsx, neutralizeSpreadsheetFormula } from "@/lib/export/hackathon";

describe("hackathon exports", () => {
  it.each(["=1+1", "+SUM(A1:A2)", "-2+3", "@cmd"])("neutralizes %s", (value) => {
    expect(neutralizeSpreadsheetFormula(value)).toBe(`'${value}`);
  });

  it("creates a Unicode-safe quoted CSV and supports no rows", () => {
    const csv = exportCsv([{ nombre: "Pérez, Ana", email: "=danger" }], ["nombre", "email"]);
    expect(csv).toContain('"Pérez, Ana"');
    expect(Papa.parse<string[]>(csv).data).toEqual([
      ["nombre", "email"],
      ["Pérez, Ana", "'=danger"],
    ]);
    expect(exportCsv([], ["nombre", "email"])).toBe("nombre,email");
  });

  it("creates an XLSX that can be opened and preserves cell types", async () => {
    const bytes = await exportXlsx(
      [{ nombre: "Álvaro", integrantes: 3, peligro: "@test" }],
      [{ header: "Nombre", key: "nombre" }, { header: "Integrantes", key: "integrantes" }, { header: "Peligro", key: "peligro" }],
      "Equipos",
      new Date("2026-08-29T12:00:00Z"),
    );
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(bytes as unknown as ExcelJS.Buffer);
    const sheet = workbook.getWorksheet("Equipos");
    expect(sheet?.getCell("A3").value).toBe("Álvaro");
    expect(sheet?.getCell("B3").value).toBe(3);
    expect(sheet?.getCell("C3").value).toBe("'@test");
    expect(argentinaSnapshotLabel(new Date("2026-08-29T12:00:00Z"))).toContain("2026-08-29");
  });
});
