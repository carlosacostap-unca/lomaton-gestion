import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  getTeamChallenge,
  isTeamChallengeId,
  TEAM_CHALLENGES,
  teamChallengeTitle,
} from "@/lib/domain/team-challenges";
import {
  expectedFields,
  teamChallengeField,
} from "@/tools/pocketbase-mcp/lomaton-schema.mjs";

describe("team challenge catalog", () => {
  it("contains exactly the five official challenges", () => {
    expect(TEAM_CHALLENGES).toEqual([
      { id: "problematicas-imagenes", title: "Identificación de problemáticas operativas mediante la obtención y análisis de imágenes" },
      { id: "transito-planta", title: "Tránsito por planta" },
      { id: "sistemas-medicion", title: "Mejoras en sistemas de medición" },
      { id: "consumo-materiales", title: "Consumo de materiales en almacenes y control patrimonial" },
      { id: "edificios-sustentables", title: "Edificios sustentables y mejora de espacios" },
    ]);
  });

  it("resolves valid identifiers and normalizes missing or unknown values", () => {
    expect(isTeamChallengeId("transito-planta")).toBe(true);
    expect(isTeamChallengeId("otro")).toBe(false);
    expect(getTeamChallenge("sistemas-medicion")?.title).toBe("Mejoras en sistemas de medición");
    expect(getTeamChallenge("valor-legado")).toBeNull();
    expect(teamChallengeTitle(undefined)).toBe("Sin seleccionar");
  });

  it("keeps the base schema and reversible migration aligned with the catalog", () => {
    expect(expectedFields.teams).toContain("challenge");
    expect(teamChallengeField).toEqual({
      name: "challenge",
      type: "select",
      required: false,
      maxSelect: 1,
      values: TEAM_CHALLENGES.map((challenge) => challenge.id),
    });
    const baseSchema = readFileSync(resolve(process.cwd(), "pocketbase/pb_migrations/1787994000_initial_hackathon_schema.js"), "utf8");
    const migration = readFileSync(resolve(process.cwd(), "pocketbase/pb_migrations/1788411600_team_challenge.js"), "utf8");
    const hook = readFileSync(resolve(process.cwd(), "pocketbase/pb_hooks/30_team_commands.pb.js"), "utf8");
    expect(baseSchema).toContain('name: "challenge"');
    expect(migration).toContain('new SelectField({');
    expect(migration).toContain('fields.removeByName("challenge")');
    expect(hook).toContain('/api/lomaton/teams/{teamId}/challenge');
    expect(hook).toContain('membership.getString("team") !== teamId');
    const mcpServer = readFileSync(resolve(process.cwd(), "tools/pocketbase-mcp/server.mjs"), "utf8");
    expect(mcpServer).toContain('actions.push("updated:teams_challenge")');
    for (const challenge of TEAM_CHALLENGES) {
      expect(migration).toContain(`"${challenge.id}"`);
    }
  });
});
