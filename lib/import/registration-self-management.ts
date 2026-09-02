import type { RegistrationImportRow } from "@/lib/import/registrations";

function triState(value: boolean | null) {
  return value === null ? "not_provided" : value ? "yes" : "no";
}

const importedValue = (row: RegistrationImportRow, field: string): unknown => ({
  phone: row.phone.trim(),
  department: row.department.trim(),
  academicUnit: row.academicUnit.trim(),
  career: row.career.trim(),
  externalTeacherDescription: row.externalTeacherDescription.trim(),
  mentorInterest: triState(row.mentorInterest),
})[field];

export function selfManagedImportDifferences(
  registrations: Array<Record<string, unknown> & { id: string }>,
  rows: RegistrationImportRow[],
) {
  const byEmail = new Map(registrations.map((item) => [String(item.emailNormalized || ""), item]));
  const byDni = new Map(registrations.map((item) => [String(item.dniNormalized || ""), item]));
  return rows.flatMap((row) => {
    const existing = byEmail.get(row.emailNormalized) || byDni.get(row.dniNormalized);
    if (!existing) return [];
    const managed = Array.isArray(existing.selfManagedFields) ? existing.selfManagedFields.map(String) : [];
    const fields = managed.filter((field) => String(existing[field] ?? "") !== String(importedValue(row, field) ?? ""));
    return fields.length ? [{ rowNumber: row.rowNumber, registrationId: existing.id, fields }] : [];
  });
}
