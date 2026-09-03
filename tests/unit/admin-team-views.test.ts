// @vitest-environment node

import type PocketBase from "pocketbase";
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

type Item = Record<string, unknown> & { id: string };
type Views = typeof import("@/lib/domain/admin-team-views");
let getAdminTeamDetail: Views["getAdminTeamDetail"];
let listAdminTeamSummaries: Views["listAdminTeamSummaries"];

beforeAll(async () => {
  ({ getAdminTeamDetail, listAdminTeamSummaries } = await import("@/lib/domain/admin-team-views"));
});

function fakePocketBase(seed: Record<string, Item[]>) {
  return {
    filter: (template: string, params: Record<string, unknown>) => template.replace(/\{:(\w+)\}/g, (_, key: string) => JSON.stringify(params[key])),
    collection: (name: string) => ({
      getOne: async (id: string) => (seed[name] ?? []).find((item) => item.id === id),
      getFullList: async (options: { filter?: string } = {}) => (seed[name] ?? []).filter((item) => {
        const team = options.filter?.match(/team = "([^"]+)"/)?.[1];
        if (team && item.team !== team) return false;
        if (options.filter?.includes("status = 'pending'") && item.status !== "pending") return false;
        return true;
      }),
    }),
  } as unknown as PocketBase;
}

const seed: Record<string, Item[]> = {
  teams: [
    { id: "team1", name: "Equipo Uno", owner: "candidate1", status: "complete", memberCount: 3, ftcaConfirmedCount: 1, challenge: "sistemas-medicion" },
    { id: "team2", name: "Equipo Dos", owner: "candidate3", status: "draft", memberCount: 1, ftcaConfirmedCount: 0 },
  ],
  team_memberships: [
    { id: "membership1", team: "team1", candidate: "candidate1" },
    { id: "membership2", team: "team2", candidate: "candidate3" },
  ],
  candidates: [
    { id: "candidate1", fullName: "Ada Integrante", email: "ada@example.test", active: true, ftcaStatus: "confirmed" },
    { id: "candidate2", fullName: "Grace Disponible", email: "grace@example.test", active: true, ftcaStatus: "pending" },
    { id: "candidate3", fullName: "Alan Otro Equipo", email: "alan@example.test", active: true, ftcaStatus: "not_ftca" },
    { id: "candidate4", fullName: "Inactiva", email: "inactive@example.test", active: false, ftcaStatus: "pending" },
  ],
  team_invitations: [
    { id: "invite1", team: "team1", candidate: "candidate2", status: "pending" },
    { id: "invite2", team: "team2", candidate: "candidate1", status: "pending" },
  ],
  team_mentorships: [{ id: "mentorship1", team: "team1", mentor: "mentor1" }],
  mentor_profiles: [
    { id: "mentor1", registration: "registration1", department: "FACEN", active: true, mentorInterest: "yes" },
    { id: "mentor2", registration: "registration2", department: "FTyCA", active: false, mentorInterest: "yes" },
  ],
  registrations: [
    { id: "registration1", fullName: "Docente Compartido" },
    { id: "registration2", fullName: "Docente Inactivo" },
  ],
};

describe("administrative team projections", () => {
  it("returns minimal summaries and only candidates available to create a team", async () => {
    const result = await listAdminTeamSummaries(fakePocketBase(seed));
    expect(result.teams[0]).toEqual({
      id: "team1", name: "Equipo Uno", status: "complete", memberCount: 3,
      ftcaConfirmedCount: 1, mentorName: "Docente Compartido",
      challenge: { id: "sistemas-medicion", title: "Mejoras en sistemas de medición" }, warning: "",
    });
    expect(result.availableCandidates.map((candidate) => candidate.id)).toEqual(["candidate2"]);
    expect(result.teams[0]).not.toHaveProperty("invitations");
  });

  it("returns operations for one team without leaking another team's invitations", async () => {
    const result = await getAdminTeamDetail(fakePocketBase(seed), "team1");
    expect(result.team.id).toBe("team1");
    expect(result.challenge?.title).toBe("Mejoras en sistemas de medición");
    expect(result.members.map((candidate) => candidate.id)).toEqual(["candidate1"]);
    expect(result.invitations).toEqual([{ id: "invite1", candidateId: "candidate2", candidateName: "Grace Disponible" }]);
    expect(result.availableCandidates.map((candidate) => candidate.id)).toEqual(["candidate2"]);
    expect(result.availableMentors).toEqual([{ id: "mentor1", name: "Docente Compartido", department: "FACEN" }]);
  });

  it("normalizes missing and unknown challenge values as unselected", async () => {
    const result = await listAdminTeamSummaries(fakePocketBase(seed));
    expect(result.teams[1].challenge).toBeNull();
  });
});
