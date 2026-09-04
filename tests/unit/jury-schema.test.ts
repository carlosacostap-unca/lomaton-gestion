// @vitest-environment node

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  evaluationCyclesCollection,
  evaluationCycleV2Fields,
  evaluationResultsCollection,
  evaluationResultV2Fields,
  juryCriteria,
  juryEvaluationV2Fields,
  juryEvaluationsCollection,
  jurorsCollection,
  juryUserField,
  legacyEvaluationResultFieldNames,
  makeFieldsOptional,
  mergeMissingFields,
  removeFieldsByName,
} from "@/tools/pocketbase-mcp/jury-schema.mjs";

describe("jury evaluation PocketBase schema", () => {
  it("keeps juror and evaluation collections private with required unique indexes", () => {
    const jurors = jurorsCollection();
    const cycles = evaluationCyclesCollection("users-id");
    const evaluations = juryEvaluationsCollection("cycles-id", "jurors-id", "teams-id");
    const results = evaluationResultsCollection("cycles-id", "teams-id");

    for (const collection of [jurors, cycles, evaluations, results]) {
      expect(collection.listRule).toContain('role = "lomaton_server"');
      expect(collection.createRule).toContain('role = "lomaton_server"');
    }
    expect(jurors.indexes.join(" ")).toContain("UNIQUE INDEX idx_jurors_email_normalized");
    expect(cycles.indexes.join(" ")).toContain("UNIQUE INDEX idx_evaluation_cycles_single_open");
    expect(evaluations.indexes.join(" ")).toContain("UNIQUE INDEX idx_jury_evaluations_pair");
    expect(results.indexes.join(" ")).toContain("UNIQUE INDEX idx_evaluation_results_team");
  });

  it("defines five integer criteria whose weights total one hundred", () => {
    const evaluations = juryEvaluationsCollection("cycles-id", "jurors-id", "teams-id");
    expect(juryCriteria).toHaveLength(5);
    expect(juryCriteria.reduce((total, item) => total + item.weight, 0)).toBe(100);
    const scoreFields = evaluations.fields.filter((field) => field.name.startsWith("score"));
    expect(scoreFields).toHaveLength(5);
    expect(scoreFields.every((field) =>
      "onlyInt" in field && "max" in field && field.onlyInt && field.min === 0 && field.max === 10,
    )).toBe(true);
    expect(evaluations.fields.find((field) => field.name === "completedCriteria")).toMatchObject({ maxSelect: 5 });
  });

  it("adds the planilla v2 fields without removing the historical v1 columns", () => {
    const cycles = evaluationCyclesCollection("users-id");
    const evaluations = juryEvaluationsCollection("cycles-id", "jurors-id", "teams-id");
    const results = evaluationResultsCollection("cycles-id", "teams-id");
    expect(cycles.fields.find((field) => field.name === "criteriaSnapshot")).toMatchObject({ type: "json" });
    expect(evaluations.fields.map((field) => field.name)).toEqual(expect.arrayContaining([
      "scoreInnovation", "totalCentipoints", "aspectScores", "aspectObservations",
      "totalNumerator", "totalDenominator",
    ]));
    expect(results.fields.map((field) => field.name)).toEqual(expect.arrayContaining([
      "innovationSum", "totalCentipointsSum", "criterionAspectScoreSums",
      "totalNumeratorSum", "totalDenominator",
    ]));
    for (const name of legacyEvaluationResultFieldNames) {
      expect(results.fields.find((field) => field.name === name)).toMatchObject({ required: false });
    }
  });

  it("adds a unique optional juror relation and a reversible migration", () => {
    expect(juryUserField("jurors-id")).toMatchObject({ type: "relation", collectionId: "jurors-id", maxSelect: 1 });
    const migration = readFileSync(resolve(process.cwd(), "pocketbase/pb_migrations/1788408000_jury_evaluations.js"), "utf8");
    expect(migration).toContain('users.addIndex("idx_users_juror", true');
    expect(migration).toContain('users.fields.removeByName("juror")');
    expect(migration).toContain('for (const name of ["evaluation_results", "jury_evaluations", "evaluation_cycles", "jurors"])');
  });

  it("provides a reversible additive planilla v2 migration", () => {
    const migration = readFileSync(resolve(process.cwd(), "pocketbase/pb_migrations/1788494400_planilla_jury_evaluations.js"), "utf8");
    expect(migration).toContain('new JSONField({ name: "criteriaSnapshot" })');
    expect(migration).toContain('new JSONField({ name: "aspectScores" })');
    expect(migration).toContain('results.fields.removeByName("criterionAspectScoreSums")');
    expect(migration).toContain('results.fields.getByName(name).required = false');
    expect(migration).not.toContain("app.delete(");
  });

  it("makes only the historical result accumulators optional for mixed v1/v2 storage", () => {
    const fields = [
      { name: "cycle", required: true },
      { name: "innovationSum", required: true },
      { name: "totalCentipointsSum", required: true },
    ];
    const first = makeFieldsOptional(fields, legacyEvaluationResultFieldNames);
    expect(first.changed).toBe(true);
    expect(first.fields).toEqual([
      { name: "cycle", required: true },
      { name: "innovationSum", required: false },
      { name: "totalCentipointsSum", required: false },
    ]);
    expect(makeFieldsOptional(first.fields, legacyEvaluationResultFieldNames)).toMatchObject({
      changed: false,
      fields: first.fields,
    });
  });

  it("applies the additive v2 fields idempotently and models their rollback", () => {
    const legacy = [{ type: "text", name: "criteriaVersion" }];
    for (const desired of [
      evaluationCycleV2Fields,
      juryEvaluationV2Fields,
      evaluationResultV2Fields,
    ]) {
      const first = mergeMissingFields(legacy, desired);
      expect(first.added).toEqual(desired.map((field) => field.name));
      const second = mergeMissingFields(first.fields, desired);
      expect(second.added).toEqual([]);
      expect(second.fields).toEqual(first.fields);
      expect(removeFieldsByName(second.fields, desired.map((field) => field.name))).toEqual(legacy);
    }
  });
});
