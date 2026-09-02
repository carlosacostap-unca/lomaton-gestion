import { describe, expect, it } from "vitest";

import { filterTeams, summarizeSnapshot, teamWarning, type ReportSnapshot } from "@/lib/report/hackathon";

const snapshot: ReportSnapshot = {
  generatedAtUtc: "2026-08-29T12:00:00Z",
  candidates: [{ id: "c1", active: true }, { id: "c2", active: true }, { id: "c3", active: false }],
  teams: [
    { id: "t1", status: "complete", memberCount: 3 },
    { id: "t2", status: "draft", memberCount: 2 },
    { id: "t3", status: "missing_ftca", memberCount: 3 },
  ],
  memberships: [{ id: "m1", candidate: "c1", team: "t1" }],
  invitations: [{ id: "i1", status: "pending" }, { id: "i2", status: "rejected" }],
  mentors: [],
  mentorInvitations: [],
  mentorships: [],
};

describe("hackathon report summary", () => {
  it("calculates known candidate, availability and team figures", () => {
    expect(summarizeSnapshot(snapshot)).toEqual({ candidates: 3, activeCandidates: 2, availableCandidates: 1, teams: 3, completeTeams: 1, problematicTeams: 2, pendingInvitations: 1 });
  });

  it("filters problematic teams and explains their status", () => {
    expect(filterTeams(snapshot.teams, "problematic").map((team) => team.id)).toEqual(["t2", "t3"]);
    expect(teamWarning(snapshot.teams[1])).toBe("Faltan 1 integrante(s)");
    expect(teamWarning(snapshot.teams[2])).toMatch(/FTCA/);
  });
});
