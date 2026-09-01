import ExcelJS from "exceljs";
import Papa from "papaparse";
import { fromZonedTime } from "date-fns-tz";
import { z } from "zod";

import { normalizeEmail, normalizeHeader } from "@/lib/import/candidates";

export type RelationshipType =
  | "student_ftca"
  | "student_external"
  | "teacher"
  | "pending";

export type DeclaredTeamStatus = "complete" | "none" | "partial" | null;
export type ReviewStatus = "valid" | "review" | "invalid" | "ignored_duplicate";

export type RegistrationImportRow = {
  rowNumber: number;
  submittedAt: string;
  fullName: string;
  dni: string;
  dniNormalized: string;
  phone: string;
  phoneNormalized: string;
  email: string;
  emailNormalized: string;
  relationshipSource: string;
  relationship: RelationshipType;
  relationshipOverride?: Exclude<RelationshipType, "pending">;
  ftcaStatus: "confirmed" | "not_ftca" | "pending";
  department: string;
  academicUnit: string;
  career: string;
  ftcaCareer: string;
  externalCareer: string;
  externalTeacherDescription: string;
  mentorInterest: boolean | null;
  declaredTeamStatus: DeclaredTeamStatus;
  declaredTeamMembers: string;
  termsAccepted: boolean | null;
  mediaAuthorized: boolean | null;
  acceptLatestDuplicate?: boolean;
  rawSource: Record<string, string>;
};

export type RegistrationPreviewItem = {
  status: ReviewStatus;
  row: RegistrationImportRow;
  errors: string[];
  warnings: string[];
  duplicate?: {
    kind: "identical" | "changed";
    sourceRows: number[];
    changedFields: string[];
  };
};

export type RegistrationImportPreview = {
  items: RegistrationPreviewItem[];
  valid: RegistrationImportRow[];
  review: RegistrationPreviewItem[];
  invalid: RegistrationPreviewItem[];
  duplicates: NonNullable<RegistrationPreviewItem["duplicate"]>[];
  summary: {
    total: number;
    valid: number;
    review: number;
    invalid: number;
    ignoredDuplicates: number;
    candidates: number;
    mentors: number;
    pendingFtca: number;
  };
};

export type ImportLimits = { maxBytes: number; maxRows: number };

type HeaderResolver = {
  headers: string[];
  normalized: string[];
  all: Map<string, number[]>;
};

const emailSchema = z.email().max(254);
const relationshipValues = ["student_ftca", "student_external", "teacher"] as const;

export const registrationImportRowSchema = z.object({
  rowNumber: z.number().int().min(2),
  submittedAt: z.string().max(80),
  fullName: z.string().max(240),
  dni: z.string().max(40),
  dniNormalized: z.string().max(20),
  phone: z.string().max(80),
  phoneNormalized: z.string().max(30),
  email: z.string().max(254),
  emailNormalized: z.string().max(254),
  relationshipSource: z.string().max(120),
  relationship: z.enum([...relationshipValues, "pending"]),
  relationshipOverride: z.enum(relationshipValues).optional(),
  ftcaStatus: z.enum(["confirmed", "not_ftca", "pending"]),
  department: z.string().max(240),
  academicUnit: z.string().max(240),
  career: z.string().max(240),
  ftcaCareer: z.string().max(240),
  externalCareer: z.string().max(240),
  externalTeacherDescription: z.string().max(2000),
  mentorInterest: z.boolean().nullable(),
  declaredTeamStatus: z.enum(["complete", "none", "partial"]).nullable(),
  declaredTeamMembers: z.string().max(4000),
  termsAccepted: z.boolean().nullable(),
  mediaAuthorized: z.boolean().nullable(),
  acceptLatestDuplicate: z.boolean().optional(),
  rawSource: z.record(z.string(), z.string().max(5000)).refine(
    (value) => Object.keys(value).length <= 30,
    "La fila contiene demasiadas columnas.",
  ),
});

const aliases = {
  submittedAt: ["marca temporal", "timestamp", "fecha"],
  fullName: ["apellido y nombres", "apellido y nombre", "nombre completo"],
  dni: ["dni", "documento"],
  phone: ["n de telefono", "numero de telefono", "telefono"],
  email: ["direccion de correo electronico", "email", "correo electronico", "correo"],
  relationship: ["que vinculo tiene con el nivel superior", "vinculo con el nivel superior"],
  department: ["de que departamento de la facultad de tecnologia y ciencias aplicadas"],
  mentorInterest: ["te interesa participar como mentor"],
  ftcaCareer: ["que carrera de la facultad de tecnologia y ciencias aplicadas esta cursando"],
  teamStatus: ["ya tenes un equipo conformado para participar del lomaton catamarca"],
  teamMembers: ["si la respuesta anterior es positiva quienes integran tu equipo"],
  termsAccepted: ["he leido y acepto las bases y condiciones de participacion del lomaton catamarca"],
  mediaAuthorized: ["autorizo el uso de mi imagen y voz en los terminos establecidos en las bases"],
  academicUnit: ["de que unidad academica proviene"],
  externalCareer: ["que carrera estudia"],
  externalTeacherDescription: ["docentes externos"],
} as const;

function text(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (value && typeof value === "object") {
    if ("text" in value) return String(value.text ?? "").trim();
    if ("result" in value) return String(value.result ?? "").trim();
    if ("richText" in value && Array.isArray(value.richText)) {
      return value.richText.map((part) => String(part?.text ?? "")).join("").trim();
    }
  }
  return String(value ?? "").trim();
}

function resolver(headers: unknown[]): HeaderResolver {
  const display = headers.map(text);
  const normalized = display.map(normalizeHeader);
  const all = new Map<string, number[]>();
  normalized.forEach((header, index) => {
    const current = all.get(header) ?? [];
    current.push(index);
    all.set(header, current);
  });
  return { headers: display, normalized, all };
}

function findIndices(header: HeaderResolver, accepted: readonly string[]) {
  const matches: number[] = [];
  for (const alias of accepted) {
    for (const [normalized, indices] of header.all) {
      if (normalized === normalizeHeader(alias) || normalized.includes(normalizeHeader(alias))) {
        matches.push(...indices);
      }
    }
  }
  return [...new Set(matches)].sort((a, b) => a - b);
}

function findIndex(header: HeaderResolver, accepted: readonly string[], occurrence = 0) {
  return findIndices(header, accepted)[occurrence] ?? -1;
}

function requiredIndex(header: HeaderResolver, accepted: readonly string[], label: string) {
  const index = findIndex(header, accepted);
  if (index === -1) throw new Error(`Falta la columna obligatoria ${label}.`);
  return index;
}

function valueAt(values: unknown[], index: number) {
  return index < 0 ? "" : text(values[index]);
}

function normalizeDigits(value: unknown) {
  return String(value ?? "").replace(/\D/g, "");
}

function parseBoolean(value: unknown): boolean | null {
  const normalized = normalizeHeader(value);
  if (!normalized) return null;
  if (
    normalized === "si" ||
    normalized.startsWith("si ") ||
    normalized === "autorizo" ||
    normalized.includes("me interesa participar")
  ) {
    return true;
  }
  if (normalized === "no" || normalized.startsWith("no ") || normalized.includes("por el momento")) {
    return false;
  }
  return null;
}

function parseTeamStatus(value: unknown): DeclaredTeamStatus {
  const normalized = normalizeHeader(value);
  if (!normalized) return null;
  if (normalized.includes("algunos integrantes") || normalized.includes("aun no esta completo")) {
    return "partial";
  }
  if (normalized.startsWith("si") || normalized.includes("equipo conformado")) return "complete";
  if (normalized.startsWith("no") || normalized.includes("todavia no tengo")) return "none";
  return null;
}

function normalizeSubmittedAt(value: unknown) {
  if (value instanceof Date) return value.toISOString();
  const raw = text(value);
  const match = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (!match) return raw;
  const [, day, month, year, hour = "0", minute = "0", second = "0"] = match;
  return fromZonedTime(
    `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}T${hour.padStart(2, "0")}:${minute}:${second}`,
    "America/Argentina/Buenos_Aires",
  ).toISOString();
}

function classifyRelationship(
  source: string,
  override?: RegistrationImportRow["relationshipOverride"],
): RelationshipType {
  if (override) return override;
  const normalized = normalizeHeader(source);
  if (normalized === "docente") return "teacher";
  if (normalized === "estudiante externo") return "student_external";
  if (normalized === "estudiante ftyca" || normalized === "estudiante ftca" || normalized === "estudiante") {
    return "student_ftca";
  }
  return "pending";
}

function rawSource(header: HeaderResolver, values: unknown[]) {
  return Object.fromEntries(
    header.headers.map((name, index) => [`${index + 1}:${name || "columna"}`, valueAt(values, index)]),
  );
}

function googleFormColumns(header: HeaderResolver) {
  const teamStatus = findIndices(header, aliases.teamStatus);
  const teamMembers = findIndices(header, aliases.teamMembers);
  const terms = findIndices(header, aliases.termsAccepted);
  const media = findIndices(header, aliases.mediaAuthorized);
  return {
    submittedAt: requiredIndex(header, aliases.submittedAt, "Marca temporal"),
    fullName: requiredIndex(header, aliases.fullName, "Apellido y nombres"),
    dni: requiredIndex(header, aliases.dni, "DNI"),
    phone: requiredIndex(header, aliases.phone, "N° de teléfono"),
    email: requiredIndex(header, aliases.email, "Dirección de correo electrónico"),
    relationship: requiredIndex(
      header,
      aliases.relationship,
      "¿Qué vínculo tiene con el nivel superior?",
    ),
    department: findIndex(header, aliases.department),
    mentorInterest: findIndex(header, aliases.mentorInterest),
    ftcaCareer: findIndex(header, aliases.ftcaCareer),
    ftcaTeamStatus: teamStatus[0] ?? -1,
    ftcaTeamMembers: teamMembers[0] ?? -1,
    ftcaTerms: terms[0] ?? -1,
    ftcaMedia: media[0] ?? -1,
    academicUnit: findIndex(header, aliases.academicUnit),
    externalCareer: findIndex(header, aliases.externalCareer),
    externalTeamStatus: teamStatus[1] ?? -1,
    externalTeamMembers: teamMembers[1] ?? -1,
    externalTerms: terms[1] ?? -1,
    externalMedia: media[1] ?? -1,
    externalTeacherDescription: findIndex(header, aliases.externalTeacherDescription),
  };
}

function mapGoogleFormRow(
  values: unknown[],
  header: HeaderResolver,
  columns: ReturnType<typeof googleFormColumns>,
  rowNumber: number,
): RegistrationImportRow {
  const relationshipSource = valueAt(values, columns.relationship);
  const relationship = classifyRelationship(relationshipSource);
  const useExternal = relationship === "student_external";
  const email = valueAt(values, columns.email);
  const dni = valueAt(values, columns.dni);
  const phone = valueAt(values, columns.phone);
  const ftcaCareer = valueAt(values, columns.ftcaCareer);
  const externalCareer = valueAt(values, columns.externalCareer);
  return {
    rowNumber,
    submittedAt: normalizeSubmittedAt(valueAt(values, columns.submittedAt)),
    fullName: valueAt(values, columns.fullName),
    dni,
    dniNormalized: normalizeDigits(dni),
    phone,
    phoneNormalized: normalizeDigits(phone),
    email,
    emailNormalized: normalizeEmail(email),
    relationshipSource,
    relationship,
    ftcaStatus:
      relationship === "student_ftca"
        ? "confirmed"
        : relationship === "student_external"
          ? "not_ftca"
          : "pending",
    department: valueAt(values, columns.department),
    academicUnit: valueAt(values, columns.academicUnit),
    career: useExternal ? externalCareer : ftcaCareer,
    ftcaCareer,
    externalCareer,
    externalTeacherDescription: valueAt(values, columns.externalTeacherDescription),
    mentorInterest: parseBoolean(valueAt(values, columns.mentorInterest)),
    declaredTeamStatus: parseTeamStatus(
      valueAt(values, useExternal ? columns.externalTeamStatus : columns.ftcaTeamStatus),
    ),
    declaredTeamMembers: valueAt(
      values,
      useExternal ? columns.externalTeamMembers : columns.ftcaTeamMembers,
    ),
    termsAccepted: parseBoolean(
      valueAt(values, useExternal ? columns.externalTerms : columns.ftcaTerms),
    ),
    mediaAuthorized: parseBoolean(
      valueAt(values, useExternal ? columns.externalMedia : columns.ftcaMedia),
    ),
    rawSource: rawSource(header, values),
  };
}

function validateRow(row: RegistrationImportRow): RegistrationPreviewItem {
  const errors: string[] = [];
  const warnings: string[] = [];
  const relationship = classifyRelationship(row.relationshipSource, row.relationshipOverride);
  const normalized: RegistrationImportRow = {
    ...row,
    fullName: row.fullName.trim(),
    dniNormalized: normalizeDigits(row.dni),
    phoneNormalized: normalizeDigits(row.phone),
    email: row.email.trim(),
    emailNormalized: normalizeEmail(row.email),
    relationship,
    career: relationship === "student_external" ? row.externalCareer : row.ftcaCareer,
    ftcaStatus:
      relationship === "student_ftca"
        ? "confirmed"
        : relationship === "student_external"
          ? "not_ftca"
          : "pending",
  };

  if (!normalized.fullName || normalized.fullName.length > 240) {
    errors.push("El nombre completo es obligatorio y admite hasta 240 caracteres.");
  }
  if (!/^\d{7,9}$/.test(normalized.dniNormalized)) {
    errors.push("El DNI debe contener entre 7 y 9 dígitos.");
  }
  if (!/^\d{8,15}$/.test(normalized.phoneNormalized)) {
    errors.push("El teléfono debe contener entre 8 y 15 dígitos.");
  }
  if (!emailSchema.safeParse(normalized.emailNormalized).success) {
    errors.push("El email no tiene un formato válido.");
  }

  const hasFtcaBranch = Boolean(normalized.ftcaCareer);
  const hasExternalBranch = Boolean(normalized.academicUnit || normalized.externalCareer);
  const sourceIsStudent = normalizeHeader(normalized.relationshipSource).startsWith("estudiante");
  const contradictory = sourceIsStudent && hasFtcaBranch && hasExternalBranch;
  const reviewReasons: string[] = [];

  if (relationship === "pending") reviewReasons.push("El vínculo institucional no es reconocible.");
  if (contradictory && !normalized.relationshipOverride) {
    reviewReasons.push("La respuesta contiene simultáneamente datos FTCA y externos.");
  }

  if (relationship === "student_ftca") {
    if (!normalized.career) errors.push("La carrera FTCA es obligatoria para este vínculo.");
    if (!normalized.declaredTeamStatus) errors.push("Falta el estado de equipo declarado.");
    if (normalized.termsAccepted === null) errors.push("Falta la aceptación de bases y condiciones.");
    if (normalized.mediaAuthorized === null) errors.push("Falta la autorización de imagen y voz.");
  }
  if (relationship === "student_external") {
    if (!normalized.academicUnit) errors.push("La unidad académica es obligatoria para estudiantes externos.");
    if (!normalized.career) errors.push("La carrera es obligatoria para estudiantes externos.");
    if (!normalized.declaredTeamStatus) errors.push("Falta el estado de equipo declarado.");
    if (normalized.termsAccepted === null) errors.push("Falta la aceptación de bases y condiciones.");
    if (normalized.mediaAuthorized === null) errors.push("Falta la autorización de imagen y voz.");
  }
  if (relationship === "teacher") {
    if (!normalized.department && !normalized.externalTeacherDescription) {
      errors.push("El docente debe indicar departamento o institución externa.");
    }
    if (normalized.mentorInterest === null) errors.push("Falta la respuesta sobre interés de mentoría.");
  }

  if (normalized.relationshipOverride) {
    warnings.push("Clasificación resuelta manualmente por administración.");
  }

  return {
    status: errors.length ? "invalid" : reviewReasons.length ? "review" : "valid",
    row: normalized,
    errors: errors.length ? errors : reviewReasons,
    warnings,
  };
}

function semanticPayload(row: RegistrationImportRow) {
  return {
    fullName: row.fullName,
    dniNormalized: row.dniNormalized,
    phoneNormalized: row.phoneNormalized,
    emailNormalized: row.emailNormalized,
    relationship: row.relationship,
    ftcaStatus: row.ftcaStatus,
    department: row.department,
    academicUnit: row.academicUnit,
    career: row.career,
    ftcaCareer: row.ftcaCareer,
    externalCareer: row.externalCareer,
    externalTeacherDescription: row.externalTeacherDescription,
    mentorInterest: row.mentorInterest,
    declaredTeamStatus: row.declaredTeamStatus,
    declaredTeamMembers: row.declaredTeamMembers,
    termsAccepted: row.termsAccepted,
    mediaAuthorized: row.mediaAuthorized,
  };
}

function changedFields(rows: RegistrationImportRow[]) {
  const payloads = rows.map(semanticPayload);
  const keys = Object.keys(payloads[0] ?? {}) as (keyof ReturnType<typeof semanticPayload>)[];
  return keys.filter((key) => payloads.some((payload) => payload[key] !== payloads[0][key]));
}

function newer(a: RegistrationImportRow, b: RegistrationImportRow) {
  const aTime = Date.parse(a.submittedAt);
  const bTime = Date.parse(b.submittedAt);
  if (Number.isFinite(aTime) && Number.isFinite(bTime) && aTime !== bTime) return aTime > bTime ? a : b;
  return a.rowNumber > b.rowNumber ? a : b;
}

export function buildRegistrationPreview(rows: RegistrationImportRow[]): RegistrationImportPreview {
  const items = rows.map(validateRow);
  const eligible = items.filter((item) => item.status !== "invalid");
  const byEmail = new Map<string, Set<string>>();
  const byDni = new Map<string, Set<string>>();

  for (const item of eligible) {
    const { emailNormalized, dniNormalized } = item.row;
    if (emailNormalized) {
      const values = byEmail.get(emailNormalized) ?? new Set<string>();
      values.add(dniNormalized);
      byEmail.set(emailNormalized, values);
    }
    if (dniNormalized) {
      const values = byDni.get(dniNormalized) ?? new Set<string>();
      values.add(emailNormalized);
      byDni.set(dniNormalized, values);
    }
  }

  for (const item of eligible) {
    if (
      (byEmail.get(item.row.emailNormalized)?.size ?? 0) > 1 ||
      (byDni.get(item.row.dniNormalized)?.size ?? 0) > 1
    ) {
      item.status = "review";
      item.errors = [...new Set([...item.errors, "El email y el DNI identifican respuestas incompatibles."])];
    }
  }

  const groups = new Map<string, RegistrationPreviewItem[]>();
  for (const item of eligible) {
    const key = `${item.row.emailNormalized}|${item.row.dniNormalized}`;
    const group = groups.get(key) ?? [];
    group.push(item);
    groups.set(key, group);
  }

  const duplicates: NonNullable<RegistrationPreviewItem["duplicate"]>[] = [];
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const rowsInGroup = group.map((item) => item.row);
    const latest = rowsInGroup.reduce(newer);
    const latestItem = group.find((item) => item.row === latest)!;
    const differences = changedFields(rowsInGroup);
    const duplicate = {
      kind: differences.length ? "changed" as const : "identical" as const,
      sourceRows: rowsInGroup.map((row) => row.rowNumber),
      changedFields: differences,
    };
    duplicates.push(duplicate);
    latestItem.duplicate = duplicate;
    latestItem.warnings.push(
      differences.length
        ? `Se propone la respuesta más reciente; cambian: ${differences.join(", ")}.`
        : `Se agruparon ${group.length} envíos idénticos.`,
    );
    if (differences.length && !latestItem.row.acceptLatestDuplicate) {
      latestItem.status = "review";
      latestItem.errors = [...new Set([...latestItem.errors, "Debe confirmar la respuesta más reciente."])];
    }
    for (const item of group) {
      if (item === latestItem) continue;
      item.status = "ignored_duplicate";
      item.duplicate = duplicate;
      item.errors = [];
      item.warnings = ["Respuesta anterior agrupada; no se importará por separado."];
    }
  }

  const validItems = items.filter((item) => item.status === "valid");
  const review = items.filter((item) => item.status === "review");
  const invalid = items.filter((item) => item.status === "invalid");
  return {
    items,
    valid: validItems.map((item) => item.row),
    review,
    invalid,
    duplicates,
    summary: {
      total: items.length,
      valid: validItems.length,
      review: review.length,
      invalid: invalid.length,
      ignoredDuplicates: items.filter((item) => item.status === "ignored_duplicate").length,
      candidates: validItems.filter((item) => item.row.relationship !== "teacher").length,
      mentors: validItems.filter((item) => item.row.relationship === "teacher").length,
      pendingFtca: review.filter((item) => item.row.ftcaStatus === "pending").length,
    },
  };
}

export function revalidateRegistrationRows(rows: RegistrationImportRow[]) {
  return buildRegistrationPreview(rows);
}

function validateGoogleFormTable(rows: unknown[][], limits: ImportLimits) {
  if (rows.length === 0 || rows.every((row) => row.every((cell) => !text(cell)))) {
    throw new Error("El archivo no contiene filas.");
  }
  const [headers, ...dataRows] = rows;
  if (dataRows.length > limits.maxRows) {
    throw new Error(`El archivo supera el límite de ${limits.maxRows} filas.`);
  }
  const header = resolver(headers);
  const columns = googleFormColumns(header);
  const mapped = dataRows
    .filter((row) => row.some((cell) => Boolean(text(cell))))
    .map((row, index) => mapGoogleFormRow(row, header, columns, index + 2));
  return buildRegistrationPreview(mapped);
}

export async function parseRegistrationFile(
  bytes: Uint8Array,
  fileName: string,
  limits: ImportLimits,
) {
  if (bytes.byteLength === 0) throw new Error("El archivo está vacío.");
  if (bytes.byteLength > limits.maxBytes) {
    throw new Error(`El archivo supera el límite de ${limits.maxBytes} bytes.`);
  }

  const extension = fileName.toLowerCase().split(".").pop();
  if (extension === "csv") {
    const parsed = Papa.parse<string[]>(new TextDecoder("utf-8").decode(bytes), {
      skipEmptyLines: "greedy",
    });
    if (parsed.errors.length) throw new Error(`CSV inválido: ${parsed.errors[0].message}`);
    return validateGoogleFormTable(parsed.data, limits);
  }

  if (extension === "xlsx") {
    const workbook = new ExcelJS.Workbook();
    try {
      await workbook.xlsx.load(bytes as unknown as ExcelJS.Buffer);
    } catch {
      throw new Error("El archivo Excel está corrupto o no es un XLSX válido.");
    }
    const worksheet = workbook.worksheets[0];
    if (!worksheet) throw new Error("El libro Excel no contiene hojas.");
    const rows: unknown[][] = [];
    worksheet.eachRow({ includeEmpty: false }, (row) => {
      rows.push(Array.isArray(row.values) ? row.values.slice(1) : []);
    });
    return validateGoogleFormTable(rows, limits);
  }

  throw new Error("Formato no admitido. Use un archivo CSV o XLSX.");
}

export const editableRelationshipSchema = z.enum(relationshipValues);
