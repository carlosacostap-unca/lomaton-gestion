// @vitest-environment node

import ExcelJS from "exceljs";
import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { POST as confirmImport } from "@/app/api/imports/candidates/confirm/route";
import { POST as previewImport } from "@/app/api/imports/candidates/preview/route";
import type { RegistrationImportRow } from "@/lib/import/registrations";
import {
  registrationCsv,
  registrationHeaders,
  registrationRow,
} from "@/tests/fixtures/registration-form";

const baseUrl = process.env.PB_INTEGRATION_URL;
const adminToken = process.env.PB_INTEGRATION_ADMIN_TOKEN;
const integration = describe.runIf(Boolean(baseUrl && adminToken));

type Preview = {
  fileName: string;
  fileType: "csv" | "xlsx";
  digest: string;
  summary: {
    valid: number;
    review: number;
    invalid: number;
    ignoredDuplicates: number;
    candidates: number;
    mentors: number;
  };
  valid: RegistrationImportRow[];
};

function authenticatedRequest(url: string, init: RequestInit = {}) {
  return new Request(url, {
    ...init,
    headers: { ...init.headers, Authorization: adminToken! },
  });
}

async function preview(file: File) {
  const formData = new FormData();
  formData.set("file", file);
  const response = await previewImport(authenticatedRequest(
    "http://app.test/api/imports/candidates/preview",
    { method: "POST", body: formData },
  ));
  expect(response.status).toBe(200);
  return response.json() as Promise<Preview>;
}

async function confirm(result: Preview) {
  return confirmImport(authenticatedRequest(
    "http://app.test/api/imports/candidates/confirm",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileName: result.fileName,
        fileType: result.fileType,
        digest: result.digest,
        rows: result.valid,
        invalidRows: result.summary.invalid,
        reviewRows: result.summary.review,
        ignoredDuplicateRows: result.summary.ignoredDuplicates,
        reason: "prueba de integración del formulario real",
      }),
    },
  ));
}

integration("20-column Google Form import through Route Handlers and PocketBase", () => {
  beforeAll(() => {
    process.env.POCKETBASE_URL = baseUrl;
    process.env.ADMIN_EMAILS = "carlosacostap@tecno.unca.edu.ar";
  });

  it("persists private registrations and projects students and teachers separately", async () => {
    const suffix = randomUUID().slice(0, 8);
    const studentEmail = `ftca-${suffix}@test.invalid`;
    const teacherEmail = `teacher-${suffix}@test.invalid`;
    const externalEmail = `external-${suffix}@test.invalid`;
    const invalidEmail = `invalid-${suffix}`;
    const csvText = registrationCsv([
      registrationRow({ email: studentEmail, dni: `31${suffix.replace(/\D/g, "").padEnd(6, "1").slice(0, 6)}` }),
      registrationRow({
        fullName: "Docente de Prueba",
        email: teacherEmail,
        dni: `32${suffix.replace(/\D/g, "").padEnd(6, "2").slice(0, 6)}`,
        relationship: "Docente",
        department: "Departamento Informática",
        mentorInterest: "Sí, me interesa participar como mentor/a.",
        ftcaCareer: "",
        ftcaTeamStatus: "",
        ftcaTerms: "",
        ftcaMedia: "",
      }),
      registrationRow({ email: invalidEmail, dni: `33${suffix.replace(/\D/g, "").padEnd(6, "3").slice(0, 6)}` }),
    ]);
    const csvPreview = await preview(new File([csvText], "respuestas.csv", { type: "text/csv" }));
    expect(csvPreview.summary).toEqual(expect.objectContaining({ candidates: 1, mentors: 1, invalid: 1, review: 0 }));
    expect(csvPreview.valid).toHaveLength(2);
    expect((await confirm(csvPreview)).status).toBe(201);

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Respuestas de formulario 1");
    sheet.addRow([...registrationHeaders]);
    sheet.addRow(registrationRow({
      fullName: "Estudiante Externo de Prueba",
      email: externalEmail,
      dni: `34${suffix.replace(/\D/g, "").padEnd(6, "4").slice(0, 6)}`,
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
    }));
    const xlsxBytes = new Uint8Array(await workbook.xlsx.writeBuffer());
    const xlsxPreview = await preview(new File(
      [xlsxBytes],
      "respuestas.xlsx",
      { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
    ));
    expect(xlsxPreview.summary).toEqual(expect.objectContaining({ candidates: 1, mentors: 0, invalid: 0, review: 0 }));
    expect((await confirm(xlsxPreview)).status).toBe(201);

    const authHeaders = { Authorization: adminToken! };
    const [registrationsResponse, candidatesResponse, mentorsResponse] = await Promise.all([
      fetch(`${baseUrl}/api/collections/registrations/records?perPage=500`, { headers: authHeaders }),
      fetch(`${baseUrl}/api/collections/candidates/records?perPage=500`, { headers: authHeaders }),
      fetch(`${baseUrl}/api/collections/mentor_profiles/records?perPage=500`, { headers: authHeaders }),
    ]);
    expect([registrationsResponse.status, candidatesResponse.status, mentorsResponse.status]).toEqual([200, 200, 200]);
    const registrations = await registrationsResponse.json() as { items: Array<{ emailNormalized: string; dni: string; phone: string; relationship: string }> };
    const candidates = await candidatesResponse.json() as { items: Array<{ emailNormalized: string; fullName: string; ftcaStatus: string }> };
    const mentors = await mentorsResponse.json() as { items: Array<{ registration: string; mentorInterest: string }> };
    const importedRegistrations = registrations.items.filter((item) => [studentEmail, teacherEmail, externalEmail].includes(item.emailNormalized));
    expect(importedRegistrations).toHaveLength(3);
    expect(importedRegistrations.every((item) => item.dni && item.phone)).toBe(true);
    expect(candidates.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ emailNormalized: studentEmail, ftcaStatus: "confirmed" }),
      expect.objectContaining({ emailNormalized: externalEmail, ftcaStatus: "not_ftca" }),
    ]));
    expect(candidates.items.some((item) => item.emailNormalized === teacherEmail)).toBe(false);
    expect(mentors.items.some((item) => item.mentorInterest === "yes")).toBe(true);
    expect(registrations.items.some((item) => item.emailNormalized === invalidEmail)).toBe(false);
  });
});
