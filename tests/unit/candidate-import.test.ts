import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";

import {
  normalizeFtcaStatus,
  normalizeHeader,
  parseCandidateFile,
} from "@/lib/import/candidates";

const limits = { maxBytes: 100_000, maxRows: 10 };

describe("candidate import", () => {
  it("normalizes headers and varied FTCA values", () => {
    expect(normalizeHeader(" ¿Estudiante FTCA? ")).toBe("estudiante ftca");
    expect(normalizeFtcaStatus("Sí")).toBe("confirmed");
    expect(normalizeFtcaStatus(false)).toBe("not_ftca");
    expect(normalizeFtcaStatus("sin validar")).toBe("pending");
  });

  it("parses CSV and separates invalid and pending rows", async () => {
    const csv = [
      "Nombre,Apellido,Email,Estudiante FTCA",
      "Ana,Pérez,ANA@example.edu.ar,Sí",
      "Beto,Díaz,beto@example.edu.ar,",
      "Sin,Correo,no-es-email,No",
    ].join("\n");
    const rows = await parseCandidateFile(new TextEncoder().encode(csv), "padron.csv", limits);

    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({ valid: true, candidate: { emailNormalized: "ana@example.edu.ar", ftcaStatus: "confirmed" } });
    expect(rows[1]).toMatchObject({ valid: true, candidate: { ftcaStatus: "pending" } });
    expect(rows[2]).toMatchObject({ valid: false, rowNumber: 4 });
  });

  it("parses an XLSX workbook", async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Padrón");
    sheet.addRow(["Nombre", "Apellido", "Email", "FTCA"]);
    sheet.addRow(["Ada", "Lovelace", "ada@example.edu.ar", true]);
    const bytes = await workbook.xlsx.writeBuffer();

    const rows = await parseCandidateFile(new Uint8Array(bytes), "padron.xlsx", limits);
    expect(rows[0]).toMatchObject({ valid: true, candidate: { firstName: "Ada", ftcaStatus: "confirmed" } });
  });

  it.each([
    { bytes: new Uint8Array(), name: "empty.csv", message: /vacío/ },
    { bytes: new TextEncoder().encode("x"), name: "bad.xlsx", message: /corrupto/ },
    { bytes: new Uint8Array(20), name: "large.csv", message: /límite/ },
  ])("rejects $name", async ({ bytes, name, message }) => {
    await expect(
      parseCandidateFile(bytes, name, { maxBytes: name === "large.csv" ? 10 : 100, maxRows: 10 }),
    ).rejects.toThrow(message);
  });

  it("rejects files above the row limit", async () => {
    const csv = "Nombre,Apellido,Email,FTCA\nA,B,a@example.com,No\nC,D,c@example.com,No";
    await expect(
      parseCandidateFile(new TextEncoder().encode(csv), "rows.csv", { maxBytes: 1000, maxRows: 1 }),
    ).rejects.toThrow(/filas/);
  });
});
