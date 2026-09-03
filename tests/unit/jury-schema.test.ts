// @vitest-environment node

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  evaluationCyclesCollection,
  evaluationResultsCollection,
  juryCriteria,
  juryEvaluationsCollection,
  jurorsCollection,
  juryUserField,
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
      "onlyInt" in field && field.onlyInt && field.min === 0 && field.max === 10,
    )).toBe(true);
    expect(evaluations.fields.find((field) => field.name === "completedCriteria")).toMatchObject({ maxSelect: 5 });
  });

  it("adds a unique optional juror relation and a reversible migration", () => {
    expect(juryUserField("jurors-id")).toMatchObject({ type: "relation", collectionId: "jurors-id", maxSelect: 1 });
    const migration = readFileSync(resolve(process.cwd(), "pocketbase/pb_migrations/1788408000_jury_evaluations.js"), "utf8");
    expect(migration).toContain('users.addIndex("idx_users_juror", true');
    expect(migration).toContain('users.fields.removeByName("juror")');
    expect(migration).toContain('for (const name of ["evaluation_results", "jury_evaluations", "evaluation_cycles", "jurors"])');
  });
});
