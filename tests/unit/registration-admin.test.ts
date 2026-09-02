// @vitest-environment node

import type PocketBase from "pocketbase";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { updateAdminRegistration } from "@/lib/domain/registration-admin";
import type { LomatonUser } from "@/lib/pocketbase/server";

type RecordItem = Record<string, unknown> & { id: string };
type Operation = { collection: string; method: string; id?: string; data?: Record<string, unknown>; options?: unknown };

function fakePocketBase(seed: Record<string, RecordItem[]>) {
  const operations: Operation[] = [];
  const send = vi.fn(async () => undefined);
  const pb = {
    filter: (value: string) => value,
    collection: (name: string) => ({
      getFullList: vi.fn(async () => seed[name] ?? []),
      getOne: vi.fn(async (id: string) => (seed[name] ?? []).find((item) => item.id === id)),
      getFirstListItem: vi.fn(async () => (seed[name] ?? [])[0]),
    }),
    createBatch: () => ({
      collection: (name: string) => ({
        create: (data: Record<string, unknown>) => operations.push({ collection: name, method: "create", data }),
        update: (id: string, data: Record<string, unknown>, options?: unknown) => operations.push({ collection: name, method: "update", id, data, options }),
        delete: (id: string) => operations.push({ collection: name, method: "delete", id }),
      }),
      send,
    }),
  } as unknown as PocketBase;
  return { pb, operations, send };
}

const admin = {
  id: "admin0000000001",
  email: "admin@example.test",
  verified: true,
  enabled: true,
  isAdmin: true,
} as LomatonUser;

const update = {
  fullName: "Persona Editada",
  dni: "30.111.222",
  phone: "+54 383 4000000",
  email: "persona@example.test",
  relationship: "student_ftca" as const,
  ftcaStatus: "not_ftca" as const,
  department: "",
  academicUnit: "",
  career: "Ingeniería en Informática",
  externalTeacherDescription: "",
  mentorInterest: "not_provided" as const,
  declaredTeamStatus: "none" as const,
  declaredTeamMembers: "",
  termsAccepted: "yes" as const,
  mediaAuthorized: "yes" as const,
  active: true,
  reason: "corrección de prueba",
};

function baseSeed(): Record<string, RecordItem[]> {
  return {
    registrations: [{
      id: "registration001",
      fullName: "Persona Original",
      emailNormalized: "persona@example.test",
      dniNormalized: "30111222",
      profileVersion: 3,
      selfManagedFields: ["phone", "career"],
    }],
    candidates: [{
      id: "candidate000001",
      registration: "registration001",
      emailNormalized: "persona@example.test",
      ftcaStatus: "confirmed",
      active: true,
    }],
    mentor_profiles: [],
    team_memberships: [{ id: "membership0001", candidate: "candidate000001", team: "team0000000001", expand: { candidate: { ftcaStatus: "confirmed" } } }],
    users: [{ id: "user00000000001", candidate: "candidate000001", enabled: true }],
    teams: [{ id: "team0000000001", memberCount: 3, ftcaConfirmedCount: 1, status: "complete" }],
    hackathon_settings: [{ id: "settings0000001", key: "default", formationOpen: true, deadlineUtc: "" }],
  };
}

describe("admin registration editing", () => {
  it("audits the private correction and recalculates the affected team", async () => {
    const { pb, operations, send } = fakePocketBase(baseSeed());

    const result = await updateAdminRegistration(pb, admin, "registration001", update);

    expect(send).toHaveBeenCalledTimes(1);
    expect(result.affectedTeamId).toBe("team0000000001");
    expect(operations).toEqual(expect.arrayContaining([
      expect.objectContaining({ collection: "registrations", method: "update", id: "registration001", data: expect.objectContaining({ profileVersion: 4, selfManagedFields: [] }) }),
      expect.objectContaining({ collection: "candidates", method: "update", id: "candidate000001" }),
      expect.objectContaining({ collection: "teams", method: "update", id: "team0000000001", options: { query: { expected_member_count: 3 } } }),
      expect.objectContaining({ collection: "audit_logs", method: "create" }),
      expect.objectContaining({ collection: "hackathon_settings", method: "update" }),
    ]));
  });

  it("blocks teacher reclassification while the person belongs to a team", async () => {
    const { pb, send } = fakePocketBase(baseSeed());

    await expect(updateAdminRegistration(pb, admin, "registration001", {
      ...update,
      relationship: "teacher",
      ftcaStatus: "pending",
    })).rejects.toMatchObject({ status: 409, code: "candidate_has_team" });
    expect(send).not.toHaveBeenCalled();
  });

  it("blocks deactivating or reclassifying a mentor with a current team", async () => {
    const seed = baseSeed();
    seed.team_memberships = [];
    seed.candidates = [];
    seed.mentor_profiles = [{ id: "mentor00000001", registration: "registration001", active: true }];
    seed.team_mentorships = [{ id: "mentorship0001", mentor: "mentor00000001", team: "team0000000001" }];
    const { pb, send } = fakePocketBase(seed);
    await expect(updateAdminRegistration(pb, admin, "registration001", {
      ...update, relationship: "teacher", ftcaStatus: "pending", active: false,
    })).rejects.toMatchObject({ status: 409, code: "mentor_has_team" });
    expect(send).not.toHaveBeenCalled();
  });
});
