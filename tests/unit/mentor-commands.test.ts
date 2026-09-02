// @vitest-environment node

import PocketBase, { ClientResponseError } from "pocketbase";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { inviteMentor, listEligibleMentors, resolveMentorInvitation, withdrawMentorInvitation } from "@/lib/domain/mentor-commands";
import type { LomatonUser } from "@/lib/pocketbase/server";

type Item = Record<string, unknown> & { id: string };
type Operation = { collection: string; method: string; id?: string; data?: Record<string, unknown> };

function value(filter: string, field: string) { return filter.match(new RegExp(`${field} = "([^"]+)"`))?.[1]; }
function containsValue(filter: string, field: string, expected: string) {
  return filter.includes(`${field} = '${expected}'`) || filter.includes(`${field} = "${expected}"`);
}
function matching(items: Item[], filter = "") {
  if (filter.includes("||")) {
    const mentor = value(filter, "mentor");
    const team = value(filter, "team");
    return items.filter((item) => (!containsValue(filter, "status", "pending") || item.status === "pending") && ((mentor && item.mentor === mentor) || (team && item.team === team)));
  }
  return items.filter((item) => {
    for (const field of ["id", "key", "team", "mentor", "registration"]) { const expected = value(filter, field); if (expected && String(item[field]) !== expected) return false; }
    if (containsValue(filter, "status", "pending") && item.status !== "pending") return false;
    if (filter.includes("active = true") && item.active !== true) return false;
    if (containsValue(filter, "mentorInterest", "yes") && item.mentorInterest !== "yes") return false;
    return true;
  });
}

function fakePocketBase(seed: Record<string, Item[]>, sendError?: unknown) {
  const operations: Operation[] = [];
  const pb = {
    filter: (template: string, params: Record<string, unknown> = {}) => template.replace(/\{:(\w+)\}/g, (_, key: string) => JSON.stringify(params[key])),
    collection: (name: string) => ({
      getOne: vi.fn(async (id: string) => (seed[name] || []).find((item) => item.id === id)),
      getFirstListItem: vi.fn(async (filter: string) => {
        const found = matching(seed[name] || [], filter)[0];
        if (!found) throw new ClientResponseError({ status: 404, data: { message: "not found" } });
        return found;
      }),
      getFullList: vi.fn(async (options: { filter?: string } = {}) => matching(seed[name] || [], options.filter)),
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

const owner = { id: "user1", candidate: "candidate1", registration: "studentRegistration", enabled: true, isAdmin: false } as LomatonUser;
const teacher = { id: "user2", registration: "teacherRegistration", enabled: true, isAdmin: false } as LomatonUser;
const base = {
  hackathon_settings: [{ id: "settings1", key: "default", formationOpen: true, deadlineUtc: "2030-01-01T00:00:00Z" }],
  teams: [{ id: "team1", name: "Equipo Uno", owner: "candidate1" }, { id: "team2", name: "Equipo Dos", owner: "candidate2" }],
  mentor_profiles: [{ id: "mentor1", registration: "teacherRegistration", active: true, mentorInterest: "yes", department: "Informática" }],
  registrations: [{ id: "teacherRegistration", fullName: "Docente Uno" }],
  mentor_invitations: [], team_mentorships: [], team_memberships: [],
};

describe("mentor commands", () => {
  it("returns only the safe eligible mentor projection", async () => {
    const { pb } = fakePocketBase(base);
    const result = await listEligibleMentors(pb, owner, "team1");
    expect(result).toEqual([{ id: "mentor1", fullName: "Docente Uno", department: "Informática", externalDescription: "" }]);
    expect(JSON.stringify(result)).not.toContain("email");
    expect(JSON.stringify(result)).not.toContain("dni");
  });

  it("creates and withdraws a pending invitation with audit and version updates", async () => {
    const { pb, operations } = fakePocketBase(base);
    await inviteMentor(pb, owner, "team1", "mentor1");
    expect(operations).toEqual(expect.arrayContaining([
      expect.objectContaining({ collection: "mentor_invitations", method: "create", data: expect.objectContaining({ team: "team1", mentor: "mentor1", status: "pending" }) }),
      expect.objectContaining({ collection: "audit_logs", method: "create" }),
      expect.objectContaining({ collection: "hackathon_settings", method: "update" }),
    ]));

    const seeded = { ...base, mentor_invitations: [{ id: "invite1", team: "team1", mentor: "mentor1", status: "pending" }] };
    const withdrawn = fakePocketBase(seeded);
    await withdrawMentorInvitation(withdrawn.pb, owner, "invite1");
    expect(withdrawn.operations).toContainEqual(expect.objectContaining({ collection: "mentor_invitations", method: "update", id: "invite1", data: expect.objectContaining({ status: "withdrawn" }) }));
  });

  it("enforces owner, formation, availability, duplicate and exclusivity rules", async () => {
    await expect(inviteMentor(fakePocketBase(base).pb, { ...owner, candidate: "otherCandidate" } as LomatonUser, "team1", "mentor1"))
      .rejects.toMatchObject({ status: 403, code: "owner_required" });

    const closed = { ...base, hackathon_settings: [{ ...base.hackathon_settings[0], formationOpen: false }] };
    await expect(inviteMentor(fakePocketBase(closed).pb, owner, "team1", "mentor1"))
      .rejects.toMatchObject({ status: 409, code: "formation_closed" });

    const unavailable = { ...base, mentor_profiles: [{ ...base.mentor_profiles[0], mentorInterest: "no" }] };
    await expect(inviteMentor(fakePocketBase(unavailable).pb, owner, "team1", "mentor1"))
      .rejects.toMatchObject({ status: 409, code: "mentor_unavailable" });

    const duplicate = { ...base, mentor_invitations: [{ id: "invite1", team: "team1", mentor: "mentor1", status: "pending" }] };
    await expect(inviteMentor(fakePocketBase(duplicate).pb, owner, "team1", "mentor1"))
      .rejects.toMatchObject({ status: 409, code: "mentor_invitation_pending" });

    const assignedTeam = { ...base, team_mentorships: [{ id: "assignment1", team: "team1", mentor: "mentor2" }] };
    await expect(inviteMentor(fakePocketBase(assignedTeam).pb, owner, "team1", "mentor1"))
      .rejects.toMatchObject({ status: 409, code: "team_has_mentor" });

    const assignedMentor = { ...base, team_mentorships: [{ id: "assignment1", team: "team2", mentor: "mentor1" }] };
    await expect(inviteMentor(fakePocketBase(assignedMentor).pb, owner, "team1", "mentor1"))
      .rejects.toMatchObject({ status: 409, code: "mentor_has_team" });
  });

  it("accepts atomically and cancels invitations incompatible by team or mentor", async () => {
    const seed = { ...base, mentor_invitations: [
      { id: "chosen", team: "team1", mentor: "mentor1", status: "pending" },
      { id: "sameMentor", team: "team2", mentor: "mentor1", status: "pending" },
      { id: "sameTeam", team: "team1", mentor: "mentor2", status: "pending" },
    ] };
    const { pb, operations } = fakePocketBase(seed);
    await resolveMentorInvitation(pb, teacher, "chosen", "accepted");
    expect(operations).toContainEqual(expect.objectContaining({ collection: "team_mentorships", method: "create", data: expect.objectContaining({ team: "team1", mentor: "mentor1", source: "invitation" }) }));
    expect(operations.filter((item) => item.collection === "mentor_invitations" && item.method === "update")).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "chosen", data: expect.objectContaining({ status: "accepted" }) }),
      expect.objectContaining({ id: "sameMentor", data: expect.objectContaining({ status: "cancelled" }) }),
      expect.objectContaining({ id: "sameTeam", data: expect.objectContaining({ status: "cancelled" }) }),
    ]));
  });

  it("rejects another teacher and maps unique-index races to a reloadable conflict", async () => {
    const seed = { ...base, mentor_invitations: [{ id: "invite1", team: "team1", mentor: "mentor1", status: "pending" }] };
    await expect(resolveMentorInvitation(fakePocketBase(seed).pb, { ...teacher, registration: "otherRegistration" } as LomatonUser, "invite1", "accepted")).rejects.toMatchObject({ status: 403, code: "mentor_required" });
    const race = new ClientResponseError({ status: 400, data: { mentor: "unique" } });
    await expect(resolveMentorInvitation(fakePocketBase(seed, race).pb, teacher, "invite1", "accepted")).rejects.toMatchObject({ status: 409, code: "mentorship_conflict" });
  });
});
