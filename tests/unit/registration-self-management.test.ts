// @vitest-environment node

import { describe, expect, it } from "vitest";

import { selfManagedImportDifferences } from "@/lib/import/registration-self-management";
import { registrationRow } from "@/tests/fixtures/registration-form";
import { parseRegistrationFile } from "@/lib/import/registrations";
import { registrationCsv } from "@/tests/fixtures/registration-form";

describe("registration preview self-management warnings", () => {
  it("reports only imported values that differ from participant-managed fields", async () => {
    const parsed = await parseRegistrationFile(new TextEncoder().encode(registrationCsv([registrationRow({ phone: "3834000000" })])), "registrations.csv", { maxBytes: 100000, maxRows: 10 });
    const row = parsed.valid[0];
    const result = selfManagedImportDifferences([{
      id: "registration1", emailNormalized: row.emailNormalized, dniNormalized: row.dniNormalized,
      phone: "3834999999", career: row.career, department: "Autogestionado", selfManagedFields: ["phone", "career", "department"],
    }], [row]);
    expect(result).toEqual([{ rowNumber: row.rowNumber, registrationId: "registration1", fields: ["phone", "department"] }]);
  });
});
