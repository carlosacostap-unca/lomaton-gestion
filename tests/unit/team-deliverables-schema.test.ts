// @vitest-environment node

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  batchSettings,
  collectionRulePatches,
  deliverableStructuralMaxBytes,
  deliverablesDeadlineField,
  expectedFields,
  teamDeliverablesCollection,
  technicalRule,
} from "@/tools/pocketbase-mcp/lomaton-schema.mjs";

describe("team deliverables PocketBase schema", () => {
  const collection = teamDeliverablesCollection("teams-id", "users-id");

  it("define un registro protegido y versionado por equipo", () => {
    expect(expectedFields.hackathon_settings).toContain("deliverablesDeadlineUtc");
    expect(deliverablesDeadlineField).toMatchObject({ type: "date", required: false });
    expect(expectedFields.team_deliverables).toEqual(expect.arrayContaining([
      "team", "status", "version", "presentationFile", "canvasFile", "reportFile",
      "evidenceFile", "videoUrl", "finalizedBy", "finalizedAt", "created", "updated",
    ]));
    expect(collection.indexes.join(" ")).toContain("UNIQUE INDEX idx_team_deliverables_team");
    expect(collection.fields.find((field) => field.name === "team")).toMatchObject({
      collectionId: "teams-id", required: true, cascadeDelete: true,
    });
    expect(collection.fields.find((field) => field.name === "version")).toMatchObject({
      required: true, min: 1, onlyInt: true,
    });
  });

  it("protege los cuatro campos de archivo y aplica 25 MiB", () => {
    for (const name of ["presentationFile", "canvasFile", "reportFile", "evidenceFile"]) {
      expect(collection.fields.find((field) => field.name === name)).toMatchObject({
        type: "file", protected: true, maxSelect: 1, maxSize: deliverableStructuralMaxBytes,
      });
    }
    expect(batchSettings.maxBodySize).toBeGreaterThan(deliverableStructuralMaxBytes);
  });

  it("admite acceso directo sólo a la cuenta técnica y guarda por versión", () => {
    const rules = collectionRulePatches.team_deliverables;
    expect(rules.listRule).toBe(technicalRule);
    expect(rules.viewRule).toBe(technicalRule);
    expect(rules.createRule).toBe(technicalRule);
    expect(rules.updateRule).toContain("expected_version");
    expect(JSON.stringify(rules)).not.toContain("isAdmin");
  });

  it("incluye una migración reversible para plazo y colección", () => {
    const source = readFileSync(join(process.cwd(), "pocketbase/pb_migrations/1788580800_team_deliverables.js"), "utf8");
    expect(source).toContain('name: "deliverablesDeadlineUtc"');
    expect(source).toContain('name: "team_deliverables"');
    expect(source).toContain('findCollectionByNameOrId("team_deliverables")');
    expect(source).toContain('removeByName("deliverablesDeadlineUtc")');
  });
});
