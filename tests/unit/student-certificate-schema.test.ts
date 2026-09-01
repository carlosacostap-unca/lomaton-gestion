// @vitest-environment node

import { describe, expect, it } from "vitest";

import {
  certificateStructuralMaxBytes,
  collectionRulePatches,
  expectedFields,
  studentCertificatesCollection,
  technicalRule,
} from "@/tools/pocketbase-mcp/lomaton-schema.mjs";

describe("student certificate PocketBase schema", () => {
  it("defines one protected PDF per candidate with a 10 MiB structural limit", () => {
    const collection = studentCertificatesCollection("candidates-id", "users-id");
    const file = collection.fields.find((field) => field.name === "certificate");
    expect(expectedFields.student_certificates).toEqual([
      "candidate", "certificate", "originalName", "sizeBytes", "sha256", "uploadedBy",
    ]);
    expect(file).toMatchObject({
      type: "file",
      required: true,
      maxSelect: 1,
      maxSize: certificateStructuralMaxBytes,
      mimeTypes: ["application/pdf"],
      protected: true,
    });
    expect(collection.indexes.join(" ")).toContain("UNIQUE INDEX idx_student_certificates_candidate");
  });

  it("allows direct access only to the technical account", () => {
    const rules = collectionRulePatches.student_certificates;
    expect(rules.listRule).toBe(technicalRule);
    expect(rules.viewRule).toBe(technicalRule);
    expect(rules.createRule).toBe(technicalRule);
    expect(rules.updateRule).toContain(technicalRule);
    expect(rules.deleteRule).toBe(technicalRule);
    expect(JSON.stringify(rules)).not.toContain("isAdmin");
  });
});
