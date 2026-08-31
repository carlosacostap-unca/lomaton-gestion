import { describe, expect, it } from "vitest";

import { normalizeTeamName, projectTeam } from "@/lib/domain/team-rules";

describe("team rules", () => {
  it("normaliza el nombre conservando una presentación legible", () => {
    expect(normalizeTeamName("  Los   Cóndores ")).toEqual({
      display: "Los Cóndores",
      normalized: "los cóndores",
    });
  });

  it.each([
    { statuses: ["confirmed"], status: "draft" },
    { statuses: ["pending", "not_ftca", "pending"], status: "missing_ftca" },
    { statuses: ["pending", "confirmed", "not_ftca"], status: "complete" },
    { statuses: ["confirmed", "pending", "pending", "pending", "pending"], status: "invalid" },
  ])("proyecta $status", ({ statuses, status }) => {
    expect(projectTeam(statuses).status).toBe(status);
  });
});
