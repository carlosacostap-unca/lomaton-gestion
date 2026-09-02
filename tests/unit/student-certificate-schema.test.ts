// @vitest-environment node

import { describe, expect, it } from "vitest";

import {
  certificateRejectionReasonMaxLength,
  certificateReviewStatuses,
  certificateStructuralMaxBytes,
  collectionRulePatches,
  expectedFields,
  planStudentCertificateReviewBackfill,
  studentCertificatesCollection,
  technicalRule,
} from "@/tools/pocketbase-mcp/lomaton-schema.mjs";

describe("student certificate PocketBase schema", () => {
  it("defines one protected PDF per candidate with a 10 MiB structural limit", () => {
    const collection = studentCertificatesCollection("candidates-id", "users-id");
    const file = collection.fields.find((field) => field.name === "certificate");
    expect(expectedFields.student_certificates).toEqual([
      "candidate", "certificate", "originalName", "sizeBytes", "sha256", "uploadedBy",
      "reviewStatus", "reviewedBy", "reviewedAt", "rejectionReason",
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
    expect(collection.indexes.join(" ")).toContain("INDEX idx_student_certificates_review_status");
    expect(collection.fields.find((field) => field.name === "reviewStatus")).toMatchObject({
      type: "select",
      required: false,
      maxSelect: 1,
      values: certificateReviewStatuses,
    });
    expect(collection.fields.find((field) => field.name === "reviewedBy")).toMatchObject({
      type: "relation",
      collectionId: "users-id",
      required: false,
    });
    expect(collection.fields.find((field) => field.name === "rejectionReason")).toMatchObject({
      type: "text",
      max: certificateRejectionReasonMaxLength,
    });
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

  it("plans an idempotent pending backfill without touching document metadata", () => {
    const missing = {
      id: "cert00000000001", reviewStatus: "", certificate: "one.pdf",
      sha256: "a".repeat(64), originalName: "one.pdf", sizeBytes: 10,
    };
    const approved = { ...missing, id: "cert00000000002", reviewStatus: "approved" };
    expect(planStudentCertificateReviewBackfill([])).toEqual({
      total: 0, alreadyClassified: 0, updates: [], invalid: [],
    });
    const plan = planStudentCertificateReviewBackfill([missing, approved]);
    expect(plan).toEqual({
      total: 2,
      alreadyClassified: 1,
      updates: [{ id: missing.id, data: { reviewStatus: "pending" } }],
      invalid: [],
    });
    expect(plan.updates[0].data).not.toHaveProperty("certificate");
    expect(plan.updates[0].data).not.toHaveProperty("sha256");
    expect(planStudentCertificateReviewBackfill([
      { ...missing, reviewStatus: "pending" }, approved,
    ]).updates).toEqual([]);
  });

  it("blocks unknown review states before planning writes", () => {
    expect(planStudentCertificateReviewBackfill([
      { id: "cert00000000001", reviewStatus: "unknown" },
    ])).toMatchObject({
      updates: [],
      invalid: [{ id: "cert00000000001", reviewStatus: "unknown" }],
    });
  });
});
