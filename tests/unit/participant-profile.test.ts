// @vitest-environment node

import PocketBase from "pocketbase";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { projectOwnProfile, updateOwnProfile } from "@/lib/domain/participant-profile";
import type { LomatonUser } from "@/lib/pocketbase/server";

type Item = Record<string, unknown> & { id: string };
type Operation = { collection: string; method: string; id?: string; data?: Record<string, unknown>; options?: unknown };

function fakePocketBase(seed: Record<string, Item[]>) {
  const operations: Operation[] = [];
  const pb = {
    filter: (template: string) => template,
    collection: (name: string) => ({
      getOne: vi.fn(async (id: string) => (seed[name] || []).find((item) => item.id === id)),
      getFirstListItem: vi.fn(async () => (seed[name] || [])[0]),
      getFullList: vi.fn(async () => seed[name] || []),
    }),
    createBatch: () => ({
      collection: (name: string) => ({
        create: (data: Record<string, unknown>) => operations.push({ collection: name, method: "create", data }),
        update: (id: string, data: Record<string, unknown>, options?: unknown) => operations.push({ collection: name, method: "update", id, data, options }),
        delete: (id: string) => operations.push({ collection: name, method: "delete", id }),
      }),
      send: vi.fn(async () => undefined),
    }),
  } as unknown as PocketBase;
  return { pb, operations };
}

const student = { id: "user1", registration: "registration1", candidate: "candidate1", enabled: true, isAdmin: false } as LomatonUser;
const teacher = { id: "user2", registration: "registration2", enabled: true, isAdmin: false } as LomatonUser;

function settings() {
  return [{ id: "settings1", key: "default", formationOpen: true }];
}

describe("participant profile domain", () => {
  it("projects only owned, allowed fields and omits import/audit metadata", () => {
    const profile = projectOwnProfile({
      id: "registration1", relationship: "student_ftca", fullName: "Ada", email: "ada@example.test", dni: "123", ftcaStatus: "confirmed",
      phone: "3834000000", department: "Sistemas", academicUnit: "Tecnología", career: "Informática", profileVersion: 4,
      rawSource: { secret: true }, sourceRowNumber: 8, importBatch: "batch1", termsAccepted: "yes",
    } as never);
    expect(profile).toMatchObject({ role: "student", version: 4, readOnly: { fullName: "Ada" }, editable: { phone: "3834000000", career: "Informática" } });
    expect(JSON.stringify(profile)).not.toContain("rawSource");
    expect(JSON.stringify(profile)).not.toContain("sourceRowNumber");
    expect(JSON.stringify(profile)).not.toContain("termsAccepted");
  });

  it("updates allowed student fields, normalization, audit and version in one batch", async () => {
    const registration = { id: "registration1", relationship: "student_ftca", fullName: "Ada", phone: "11111", profileVersion: 2, selfManagedFields: [] };
    const { pb, operations } = fakePocketBase({ registrations: [registration], hackathon_settings: settings() });
    await updateOwnProfile(pb, student, { expectedVersion: 2, phone: "+54 383 444-555", career: "Programación" });
    expect(operations).toEqual(expect.arrayContaining([
      expect.objectContaining({ collection: "registrations", method: "update", id: "registration1", data: expect.objectContaining({ phoneNormalized: "54383444555", profileVersion: 3, selfManagedFields: ["phone", "career"] }), options: { query: { expected_profile_version: 2 } } }),
      expect.objectContaining({ collection: "audit_logs", method: "create", data: expect.objectContaining({ action: "participant.profile.update" }) }),
      expect.objectContaining({ collection: "hackathon_settings", method: "update", data: { "dataVersion+": 1 } }),
    ]));
  });

  it("rejects stale versions and protected fields before creating a batch", async () => {
    const { pb, operations } = fakePocketBase({ registrations: [{ id: "registration1", relationship: "student_ftca", profileVersion: 5 }] });
    await expect(updateOwnProfile(pb, student, { expectedVersion: 4, phone: "12345" })).rejects.toMatchObject({ status: 409, code: "profile_version_conflict" });
    await expect(updateOwnProfile(pb, student, { expectedVersion: 5, mentorInterest: "yes" })).rejects.toMatchObject({ status: 403, code: "protected_profile_field" });
    expect(operations).toEqual([]);
  });

  it("cancels pending invitations when an unassigned teacher disables interest", async () => {
    const registration = { id: "registration2", relationship: "teacher", profileVersion: 1, mentorInterest: "yes", selfManagedFields: [] };
    const { pb, operations } = fakePocketBase({
      registrations: [registration], hackathon_settings: settings(),
      mentor_profiles: [{ id: "mentor1", registration: "registration2", active: true }],
      team_mentorships: [], mentor_invitations: [{ id: "invite1", mentor: "mentor1", status: "pending" }],
    });
    await updateOwnProfile(pb, teacher, { expectedVersion: 1, mentorInterest: "no" });
    expect(operations).toContainEqual(expect.objectContaining({ collection: "mentor_invitations", method: "update", id: "invite1", data: expect.objectContaining({ status: "cancelled" }) }));
    expect(operations).toContainEqual(expect.objectContaining({ collection: "mentor_profiles", method: "update", id: "mentor1", data: { mentorInterest: "no" } }));
  });

  it("blocks disabling interest while the teacher has an assignment", async () => {
    const { pb, operations } = fakePocketBase({
      registrations: [{ id: "registration2", relationship: "teacher", profileVersion: 1, mentorInterest: "yes" }], hackathon_settings: settings(),
      mentor_profiles: [{ id: "mentor1", registration: "registration2", active: true }],
      team_mentorships: [{ id: "assignment1", mentor: "mentor1", team: "team1" }],
    });
    await expect(updateOwnProfile(pb, teacher, { expectedVersion: 1, mentorInterest: "no" })).rejects.toMatchObject({ status: 409, code: "mentor_assigned" });
    expect(operations).toEqual([]);
  });
});
