import ExcelJS from "exceljs";
import Papa from "papaparse";
import { z } from "zod";

export type FtcaStatus = "confirmed" | "not_ftca" | "pending";

export type CandidateImportRow = {
  rowNumber: number;
  firstName: string;
  lastName: string;
  email: string;
  emailNormalized: string;
  ftcaStatus: FtcaStatus;
};

export type CandidateRowResult =
  | { valid: true; candidate: CandidateImportRow; warnings: string[] }
  | { valid: false; rowNumber: number; errors: string[] };

export type ImportLimits = { maxBytes: number; maxRows: number };

export type ColumnAliases = Record<"firstName" | "lastName" | "email" | "ftcaStatus", string[]>;

export const defaultColumnAliases: ColumnAliases = {
  firstName: ["nombre", "nombres", "first name", "firstname"],
  lastName: ["apellido", "apellidos", "last name", "lastname"],
  email: ["email", "e-mail", "correo", "correo electronico", "mail"],
  ftcaStatus: [
    "ftca",
    "es ftca",
    "estudiante ftca",
    "pertenece a ftca",
    "facultad de tecnologia y ciencias aplicadas",
  ],
};

const candidateSchema = z.object({
  firstName: z.string().trim().min(1).max(120),
  lastName: z.string().trim().min(1).max(120),
  email: z.email().max(254),
  ftcaStatus: z.enum(["confirmed", "not_ftca", "pending"]),
});

export function normalizeHeader(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/[^a-z0-9@ ]/g, "")
    .replace(/\s+/g, " ");
}

export function normalizeEmail(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

export function normalizeFtcaStatus(value: unknown): FtcaStatus {
  if (typeof value === "boolean") return value ? "confirmed" : "not_ftca";
  if (typeof value === "number") {
    if (value === 1) return "confirmed";
    if (value === 0) return "not_ftca";
  }

  const normalized = normalizeHeader(value);
  if (!normalized || ["pendiente", "sin validar", "no se", "ns nc"].includes(normalized)) {
    return "pending";
  }
  if (["si", "s", "true", "1", "confirmado", "confirmada", "ftca"].includes(normalized)) {
    return "confirmed";
  }
  if (["no", "n", "false", "0", "no pertenece", "otra facultad"].includes(normalized)) {
    return "not_ftca";
  }
  return "pending";
}

function resolveColumns(headers: unknown[], aliases: ColumnAliases) {
  const normalizedHeaders = headers.map(normalizeHeader);
  const result = {} as Record<keyof ColumnAliases, number>;

  for (const field of Object.keys(aliases) as (keyof ColumnAliases)[]) {
    const accepted = new Set(aliases[field].map(normalizeHeader));
    const index = normalizedHeaders.findIndex((header) => accepted.has(header));
    if (index === -1) {
      throw new Error(`Falta la columna obligatoria ${field}.`);
    }
    result[field] = index;
  }
  return result;
}

export function validateCandidateRow(
  values: unknown[],
  columns: Record<keyof ColumnAliases, number>,
  rowNumber: number,
): CandidateRowResult {
  const email = String(values[columns.email] ?? "").trim();
  const candidate = {
    firstName: String(values[columns.firstName] ?? "").trim(),
    lastName: String(values[columns.lastName] ?? "").trim(),
    email,
    ftcaStatus: normalizeFtcaStatus(values[columns.ftcaStatus]),
  };
  const parsed = candidateSchema.safeParse(candidate);

  if (!parsed.success) {
    return {
      valid: false,
      rowNumber,
      errors: parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`),
    };
  }

  return {
    valid: true,
    candidate: {
      ...parsed.data,
      rowNumber,
      emailNormalized: normalizeEmail(parsed.data.email),
    },
    warnings:
      parsed.data.ftcaStatus === "pending"
        ? ["El estado FTCA deberá confirmarse posteriormente."]
        : [],
  };
}

function validateTable(
  rows: unknown[][],
  limits: ImportLimits,
  aliases: ColumnAliases,
): CandidateRowResult[] {
  if (rows.length === 0 || rows.every((row) => row.every((cell) => !String(cell ?? "").trim()))) {
    throw new Error("El archivo no contiene filas.");
  }
  const [headers, ...dataRows] = rows;
  if (dataRows.length > limits.maxRows) {
    throw new Error(`El archivo supera el límite de ${limits.maxRows} filas.`);
  }
  const columns = resolveColumns(headers, aliases);
  return dataRows
    .filter((row) => row.some((cell) => String(cell ?? "").trim()))
    .map((row, index) => validateCandidateRow(row, columns, index + 2));
}

export async function parseCandidateFile(
  bytes: Uint8Array,
  fileName: string,
  limits: ImportLimits,
  aliases: ColumnAliases = defaultColumnAliases,
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
    return validateTable(parsed.data, limits, aliases);
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
      const values = Array.isArray(row.values) ? row.values.slice(1) : [];
      rows.push(
        values.map((value) =>
          typeof value === "object" && value && "text" in value
            ? value.text
            : value,
        ),
      );
    });
    return validateTable(rows, limits, aliases);
  }

  throw new Error("Formato no admitido. Use un archivo CSV o XLSX.");
}
