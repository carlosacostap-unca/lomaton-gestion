import ExcelJS from "exceljs";
import { formatInTimeZone } from "date-fns-tz";
import Papa from "papaparse";

export type ExportValue = string | number | boolean | null | undefined;
export type ExportRow = Record<string, ExportValue>;

export function neutralizeSpreadsheetFormula(value: ExportValue): ExportValue {
  if (typeof value !== "string") return value;
  return /^[=+\-@]/.test(value) ? `'${value}` : value;
}

export function argentinaSnapshotLabel(date = new Date()) {
  return formatInTimeZone(date, "America/Argentina/Buenos_Aires", "yyyy-MM-dd HH:mm:ssXXX");
}

function safeRows(rows: ExportRow[]) {
  return rows.map((row) =>
    Object.fromEntries(
      Object.entries(row).map(([key, value]) => [key, neutralizeSpreadsheetFormula(value)]),
    ),
  );
}

export function exportCsv(rows: ExportRow[], columns: string[]) {
  if (rows.length === 0) return columns.join(",");
  const safe = safeRows(rows);
  return Papa.unparse({ fields: columns, data: safe.map((row) => columns.map((column) => row[column] ?? "")) }, { newline: "\r\n" });
}

export async function exportXlsx(
  rows: ExportRow[],
  columns: Array<{ header: string; key: string; width?: number }>,
  sheetName: string,
  generatedAt = new Date(),
) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Lomatón Gestión";
  workbook.created = generatedAt;
  const sheet = workbook.addWorksheet(sheetName);
  sheet.addRow([`Generado: ${argentinaSnapshotLabel(generatedAt)} (hora argentina)`]);
  sheet.mergeCells(1, 1, 1, columns.length);
  sheet.getRow(1).font = { italic: true };
  sheet.addRow(columns.map((column) => column.header));
  sheet.getRow(2).font = { bold: true };
  sheet.columns = columns.map((column) => ({ key: column.key, width: column.width ?? 20 }));
  for (const row of safeRows(rows)) sheet.addRow(row);
  sheet.views = [{ state: "frozen", ySplit: 2 }];
  sheet.autoFilter = { from: { row: 2, column: 1 }, to: { row: 2, column: columns.length } };
  return new Uint8Array(await workbook.xlsx.writeBuffer());
}
