// @vitest-environment node

import PocketBase, { ClientResponseError } from "pocketbase";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  assignAdminMentor,
  getOwnMentorDashboard,
  getTeamMentorState,
} from "@/lib/domain/mentor-commands";
import type { LomatonUser } from "@/lib/pocketbase/server";

type Item = Record<string, unknown> & { id: string };
type Operation = { collection: string; method: string; id?: string; data?: Record<string, unknown> };

function value(filter: string, field: string) {
  return filter.match(new RegExp(`${field} = "([^"]+)"`))?.[1];
}

function matching(items: Item[], filter = ""): Item[] {
  if (!filter) return items;
  if (filter.includes("||")) {
    const alternatives = filter.split("||").map((part) => part.trim());
    return items.filter((item) => alternatives.some((part): boolean => matching([item], part).length > 0));
  }
  return items.filter((item) => {
    for (const field of ["id", "key", "team", "mentor", "registration"]) {
      const expected = value(filter, field);
      if (expected && String(item[field]) !== expected) return false;
    }
    if (filter.includes("active = true") && item.active !== true) return false;
    if (filter.includes('mentorInterest = "yes"') && item.mentorInterest !== "yes") return false;
    return true;
  });
}

function fakePocketBase(seed: Record<string, Item[]>, sendError?: unknown) {
  const operations: Operation[] = [];
  const pb = {
    filter: (template: string, params: Record<string, unknown> = {}) =>
      template.replace(/\{:(\w+)\}/g, (_, key: string) => JSON.stringify(params[key])),
    collection: (name: string) => ({
      getOne: vi.fn(async (id: string) => (seed[name] || []).find((item) => item.id === id)),
      getFirstListItem: vi.fn(async (filter: string) => {
        const found = matching(seed[name] || [], filter)[0];
        if (!found) throw new ClientResponseError({ status: 404, data: { message: "not found" } });
        return found;
      }),
      getFullList: vi.fn(async (options: { filter?: string } = {}) =>
        matching(seed[name] || [], options.filter)),
    }),
    createBatch: () => ({
      collection: (name: string) => ({
        create: (data: Record<string, unknown>) => operations.push({ collection: name, method: "create", data }),
        update: (id: string, data: Record<string, unknown>) => operations.push({ collection: name, method: "update", id, data }),
        delete: (id: string) => operations.push({ collection: name, method: "delete", id }),
      }),
      send: vi.fn(async () => { if (sendError) throw sendError; }),
    }),
  } as unknown as PocketBase;
  return { pb, operations };
}

const owner = {
  id: "studentUser",
  candidate: "candidate1",
  registration: "studentRegistration",
  enabled: true,
  isAdmin: false,
} as LomatonUser;
const teacher = {
  id: "teacherUser",
  registration: "teacherRegistration",
  enabled: true,
  isAdmin: false,
} as LomatonUser;
const admin = { id: "adminUser", enabled: true, isAdmin: true } as LomatonUser;

const base = {
  hackathon_settings: [{
    id: "settings1",
    key: "default",
    formationOpen: true,
    deadlineUtc: "2030-01-01T00:00:00Z",
  }],
  teams: [
    { id: "team1", name: "Equipo Uno", status: "complete", owner: "candidate1" },
    { id: "team2", name: "Equipo Dos", status: "draft", owner: "candidate2" },
  ],
  mentor_profiles: [{
    id: "mentor1",
    registration: "teacherRegistration",
    active: true,
    mentorInterest: "yes",
    department: "Informática",
  }],
  registrations: [{ id: "teacherRegistration", fullName: "Docente Uno" }],
  mentor_invitations: [],
  team_mentorships: [],
  team_memberships: [],
};

describe("admin-managed mentorship commands", () => {
  it("creates a direct assignment with audit and version update", async () => {
    const { pb, operations } = fakePocketBase(base);
    const result = await assignAdminMentor(pb, admin, "team1", "mentor1", "");

    expect(result).toMatchObject({ team: "team1", mentor: "mentor1", source: "admin" });
    expect(operations).toEqual(expect.arrayContaining([
      expect.objectContaining({ collection: "team_mentorships", method: "create", data: expect.objectContaining({ team: "team1", mentor: "mentor1", source: "admin" }) }),
      expect.objectContaining({ collection: "audit_logs", method: "create", data: expect.objectContaining({ action: "team.mentorship.admin.assign" }) }),
      expect.objectContaining({ collection: "hackathon_settings", method: "update", id: "settings1" }),
    ]));
  });

  it("replaces the current team mentor and audits before and after", async () => {
    const seed = {
      ...base,
      team_mentorships: [{ id: "assignment1", team: "team1", mentor: "mentor2", source: "admin" }],
    };
    const { pb, operations } = fakePocketBase(seed);
    await assignAdminMentor(pb, admin, "team1", "mentor1", "coordinación");

    expect(operations).toContainEqual(expect.objectContaining({
      collection: "team_mentorships",
      method: "update",
      id: "assignment1",
      data: { mentor: "mentor1", source: "admin" },
    }));
    expect(operations).toContainEqual(expect.objectContaining({
      collection: "audit_logs",
      method: "create",
      data: expect.objectContaining({
        action: "team.mentorship.admin.replace",
        before: expect.objectContaining({ mentor: "mentor2" }),
        after: expect.objectContaining({ mentor: "mentor1" }),
      }),
    }));
  });

  it("rejects unavailable mentors and requires a reason after closing", async () => {
    const unavailable = {
      ...base,
      mentor_profiles: [{ ...base.mentor_profiles[0], mentorInterest: "no" }],
    };
    await expect(assignAdminMentor(
      fakePocketBase(unavailable).pb,
      admin,
      "team1",
      "mentor1",
      "",
    )).rejects.toMatchObject({ status: 409, code: "mentor_unavailable" });

    const closed = {
      ...base,
      hackathon_settings: [{ ...base.hackathon_settings[0], formationOpen: false }],
    };
    await expect(assignAdminMentor(
      fakePocketBase(closed).pb,
      admin,
      "team1",
      "mentor1",
      "",
    )).rejects.toMatchObject({ status: 400, code: "reason_required" });
  });

  it("assigns the same mentor to another team without altering prior assignments", async () => {
    const seed = {
      ...base,
      team_mentorships: [{ id: "assignment2", team: "team2", mentor: "mentor1", source: "admin" }],
    };
    const { pb, operations } = fakePocketBase(seed);
    await assignAdminMentor(pb, admin, "team1", "mentor1", "");

    expect(operations).toContainEqual(expect.objectContaining({
      collection: "team_mentorships",
      method: "create",
      data: expect.objectContaining({ team: "team1", mentor: "mentor1" }),
    }));
    expect(operations.some((operation) => operation.method === "delete")).toBe(false);
  });

  it("returns a safe read-only team assignment to the student owner", async () => {
    const seed = {
      ...base,
      team_mentorships: [{ id: "assignment1", team: "team1", mentor: "mentor1", source: "admin" }],
    };
    const result = await getTeamMentorState(fakePocketBase(seed).pb, owner, "team1");

    expect(result).toEqual({
      assignment: {
        id: "assignment1",
        mentor: {
          id: "mentor1",
          fullName: "Docente Uno",
          department: "Informática",
          externalDescription: "",
        },
      },
    });
    expect(JSON.stringify(result)).not.toContain("invitations");
  });

  it("returns every assigned team to a teacher without private student data", async () => {
    const seed = {
      ...base,
      team_mentorships: [
        { id: "assignment1", team: "team1", mentor: "mentor1", source: "admin" },
        { id: "assignment2", team: "team2", mentor: "mentor1", source: "admin" },
      ],
      team_memberships: [
        { id: "member1", team: "team1", candidate: "candidate1", expand: { candidate: { fullName: "Ada", email: "private@example.test", dni: "123" } } },
        { id: "member2", team: "team2", candidate: "candidate2", expand: { candidate: { fullName: "Grace", certificate: "private.pdf" } } },
      ],
    };
    const result = await getOwnMentorDashboard(fakePocketBase(seed).pb, teacher);

    expect(result.assignments).toEqual([
      expect.objectContaining({ id: "team1", name: "Equipo Uno", status: "complete", members: [{ id: "candidate1", fullName: "Ada" }] }),
      expect.objectContaining({ id: "team2", name: "Equipo Dos", status: "draft", members: [{ id: "candidate2", fullName: "Grace" }] }),
    ]);
    expect(JSON.stringify(result)).not.toMatch(/private@example|certificate|dni/i);
  });

  it("maps unique-team races to a reloadable conflict", async () => {
    const race = new ClientResponseError({ status: 400, data: { team: "unique" } });
    await expect(assignAdminMentor(
      fakePocketBase(base, race).pb,
      admin,
      "team1",
      "mentor1",
      "",
    )).rejects.toMatchObject({ status: 409, code: "mentorship_conflict" });
  });
});
