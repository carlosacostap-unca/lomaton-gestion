import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";

import {
  normalizeFtcaStatus,
  normalizeHeader,
  parseCandidateFile,
} from "@/lib/import/candidates";
import {
  buildRegistrationPreview,
  parseRegistrationFile,
} from "@/lib/import/registrations";
import {
  registrationCsv,
  registrationHeaders,
  registrationRow,
} from "@/tests/fixtures/registration-form";

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

describe("Google Forms registration import", () => {
  it("maps FTCA, historical, external and teacher branches", async () => {
    const csv = registrationCsv([
      registrationRow(),
      registrationRow({
        submittedAt: "19/08/2026 10:01:00",
        fullName: "Estudiante Histórico",
        dni: "30111223",
        email: "historico@example.test",
        relationship: "Estudiante",
      }),
      registrationRow({
        submittedAt: "19/08/2026 10:02:00",
        fullName: "Estudiante Externo",
        dni: "30111224",
        email: "externo@example.test",
        relationship: "Estudiante externo",
        ftcaCareer: "",
        ftcaTeamStatus: "",
        ftcaTerms: "",
        ftcaMedia: "",
        academicUnit: "Facultad de Ciencias Exactas y Naturales",
        externalCareer: "Licenciatura de prueba",
        externalTeamStatus: "No, todavía no tengo equipo.",
        externalTerms: "Sí",
        externalMedia: "Autorizo",
      }),
      registrationRow({
        submittedAt: "19/08/2026 10:03:00",
        fullName: "Docente Mentor",
        dni: "30111225",
        email: "mentor@example.test",
        relationship: "Docente",
        ftcaCareer: "",
        ftcaTeamStatus: "",
        ftcaTerms: "",
        ftcaMedia: "",
        department: "Departamento Informática",
        mentorInterest: "Sí, me interesa participar como mentor/a.",
      }),
    ]);

    const preview = await parseRegistrationFile(
      new TextEncoder().encode(csv),
      "respuestas.csv",
      { maxBytes: 100_000, maxRows: 20 },
    );

    expect(preview.summary).toMatchObject({
      total: 4,
      valid: 4,
      candidates: 3,
      mentors: 1,
      review: 0,
      invalid: 0,
    });
    expect(preview.valid.map((row) => [row.relationship, row.ftcaStatus])).toEqual([
      ["student_ftca", "confirmed"],
      ["student_ftca", "confirmed"],
      ["student_external", "not_ftca"],
      ["teacher", "pending"],
    ]);
    expect(preview.valid[0].fullName).toBe("Persona de Prueba");
  });

  it("requires review for three simultaneous FTCA/external contradictions", async () => {
    const csv = registrationCsv([
      registrationRow({
        relationship: "Estudiante",
        academicUnit: "Escuela de Arqueología",
        externalCareer: "Otra carrera",
      }),
      registrationRow({
        submittedAt: "19/08/2026 10:01:00",
        fullName: "Contradicción FTYCA",
        dni: "30111226",
        email: "contradiccion-ftyca@example.test",
        relationship: "Estudiante FTYCA",
        academicUnit: "Facultad de Humanidades",
        externalCareer: "Otra carrera externa",
      }),
      registrationRow({
        submittedAt: "19/08/2026 10:02:00",
        fullName: "Contradicción Externa",
        dni: "30111227",
        email: "contradiccion-externa@example.test",
        relationship: "Estudiante externo",
        academicUnit: "Facultad de Ciencias Agrarias",
        externalCareer: "Otra carrera externa",
        externalTeamStatus: "No, todavía no tengo equipo.",
        externalTerms: "Sí",
        externalMedia: "Autorizo",
      }),
    ]);
    const preview = await parseRegistrationFile(
      new TextEncoder().encode(csv),
      "contradiccion.csv",
      limits,
    );

    expect(preview.summary.review).toBe(3);
    expect(preview.review[0].errors.join(" ")).toMatch(/simultáneamente/);
    expect(preview.valid).toHaveLength(0);

    const resolvedRows = preview.items.map((item) => ({
      ...item.row,
      relationshipOverride:
        item.row.rowNumber === 4 ? "student_external" as const : "student_ftca" as const,
    }));
    const resolved = buildRegistrationPreview(resolvedRows);
    expect(resolved.summary.valid).toBe(3);
    expect(resolved.valid[0]).toMatchObject({
      relationship: "student_ftca",
      ftcaStatus: "confirmed",
    });
    expect(resolved.valid[2]).toMatchObject({
      relationship: "student_external",
      ftcaStatus: "not_ftca",
    });
  });

  it("groups identical submissions and requests confirmation for changed duplicates", async () => {
    const identical = registrationRow();
    const csv = registrationCsv([
      identical,
      registrationRow({ submittedAt: "19/08/2026 10:01:00" }),
      registrationRow({
        submittedAt: "19/08/2026 10:02:00",
        phone: "3834111111",
      }),
    ]);
    const preview = await parseRegistrationFile(
      new TextEncoder().encode(csv),
      "duplicados.csv",
      limits,
    );

    expect(preview.summary.ignoredDuplicates).toBe(2);
    expect(preview.summary.review).toBe(1);
    expect(preview.duplicates).toEqual([
      expect.objectContaining({
        kind: "changed",
        sourceRows: [2, 3, 4],
        changedFields: expect.arrayContaining(["phoneNormalized"]),
      }),
    ]);

    const confirmed = buildRegistrationPreview(
      preview.items.map((item) =>
        item.row.rowNumber === 4 ? { ...item.row, acceptLatestDuplicate: true } : item.row,
      ),
    );
    expect(confirmed.summary.valid).toBe(1);
    expect(confirmed.summary.review).toBe(0);
  });

  it("blocks crossed identity conflicts and invalid emails", async () => {
    const csv = registrationCsv([
      registrationRow(),
      registrationRow({
        submittedAt: "19/08/2026 10:01:00",
        dni: "30999999",
      }),
      registrationRow({
        submittedAt: "19/08/2026 10:02:00",
        dni: "30111224",
        email: "correo-invalido",
      }),
    ]);
    const preview = await parseRegistrationFile(
      new TextEncoder().encode(csv),
      "conflictos.csv",
      limits,
    );

    expect(preview.summary.review).toBe(2);
    expect(preview.summary.invalid).toBe(1);
    expect(preview.invalid[0].row.email).toBe("correo-invalido");
  });

  it("parses the anonymized twenty-column XLSX fixture", async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Respuestas de formulario 1");
    sheet.addRow([...registrationHeaders]);
    sheet.addRow(registrationRow());
    const bytes = await workbook.xlsx.writeBuffer();

    const preview = await parseRegistrationFile(
      new Uint8Array(bytes),
      "respuestas.xlsx",
      limits,
    );
    expect(preview.summary).toMatchObject({ total: 1, valid: 1, candidates: 1 });
    expect(preview.valid[0].rawSource).toHaveProperty("1:Marca temporal");
  });
});
