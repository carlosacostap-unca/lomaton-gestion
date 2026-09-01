// @vitest-environment node

import PocketBase, { ClientResponseError } from "pocketbase";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  createTeam,
  disbandOwnTeam,
  inviteCandidate,
  resolveOwnInvitation,
} from "@/lib/domain/team-commands";
import type { LomatonUser } from "@/lib/pocketbase/server";

type RecordItem = Record<string, unknown> & { id: string };
type Seed = Record<string, RecordItem[]>;
type Operation = {
  collection: string;
  method: "create" | "update" | "delete";
  id?: string;
  data?: Record<string, unknown>;
  options?: unknown;
};

function quotedValue(filter: string, field: string) {
  return filter.match(new RegExp(`${field} = "([^"]+)"`))?.[1];
}

function matching(items: RecordItem[], filter = "") {
  return items.filter((item) => {
    for (const field of ["id", "key", "team", "candidate"]) {
      const value = quotedValue(filter, field);
      if (value && String(item[field]) !== value) return false;
    }
    if (filter.includes("status = 'pending'") && item.status !== "pending") return false;
    return true;
  });
}

function fakePocketBase(seed: Seed, sendError?: unknown) {
  const operations: Operation[] = [];
  const send = vi.fn(async () => {
    if (sendError) throw sendError;
  });
  const pb = {
    filter: (template: string, params: Record<string, unknown> = {}) =>
      template.replace(/\{:(\w+)\}/g, (_, key: string) => JSON.stringify(params[key])),
    collection: (name: string) => ({
      getOne: vi.fn(async (id: string) => (seed[name] ?? []).find((item) => item.id === id)),
      getFirstListItem: vi.fn(async (filter: string) => matching(seed[name] ?? [], filter)[0]),
      getFullList: vi.fn(async (options: { filter?: string } = {}) =>
        matching(seed[name] ?? [], options.filter)),
    }),
    createBatch: () => ({
      collection: (name: string) => ({
        create: (data: Record<string, unknown>) => operations.push({ collection: name, method: "create", data }),
        update: (id: string, data: Record<string, unknown>, options?: unknown) =>
          operations.push({ collection: name, method: "update", id, data, options }),
        delete: (id: string) => operations.push({ collection: name, method: "delete", id }),
      }),
      send,
    }),
  } as unknown as PocketBase;
  return { pb, operations, send };
}

const owner = {
  id: "user00000000001",
  email: "owner@example.test",
  verified: true,
  enabled: true,
  isAdmin: false,
  candidate: "candidate000001",
} as LomatonUser;

function baseSeed(): Seed {
  return {
    hackathon_settings: [{
      id: "settings0000001",
      key: "default",
      formationOpen: true,
      deadlineUtc: "2030-12-31T23:59:00.000Z",
    }],
    candidates: [
      { id: "candidate000001", active: true, ftcaStatus: "confirmed" },
      { id: "candidate000002", active: true, ftcaStatus: "not_ftca" },
      { id: "candidate000003", active: true, ftcaStatus: "pending" },
    ],
    teams: [{
      id: "team0000000001",
      owner: "candidate000001",
      memberCount: 2,
      ftcaConfirmedCount: 1,
      status: "draft",
    }],
    team_memberships: [],
    team_invitations: [],
  };
}

describe("candidate team commands", () => {
  it("creates the team and owner membership atomically", async () => {
    const { pb, operations, send } = fakePocketBase(baseSeed());

    await createTeam(pb, owner, "  Los   Cóndores  ");

    expect(send).toHaveBeenCalledTimes(1);
    expect(operations).toEqual(expect.arrayContaining([
      expect.objectContaining({
        collection: "teams",
        method: "create",
        data: expect.objectContaining({ name: "Los Cóndores", nameNormalized: "los cóndores", memberCount: 1 }),
      }),
      expect.objectContaining({
        collection: "team_memberships",
        method: "create",
        data: expect.objectContaining({ candidate: owner.candidate, source: "owner" }),
      }),
      expect.objectContaining({ collection: "hackathon_settings", method: "update" }),
    ]));
  });

  it("does not create a duplicate pending invitation", async () => {
    const seed = baseSeed();
    seed.team_invitations = [{
      id: "invitation00001",
      team: "team0000000001",
      candidate: "candidate000002",
      status: "pending",
    }];
    const { pb, send } = fakePocketBase(seed);

    await expect(inviteCandidate(pb, owner, "team0000000001", "candidate000002"))
      .rejects.toMatchObject({ status: 409, code: "invitation_already_pending" });
    expect(send).not.toHaveBeenCalled();
  });

  it("accepts one invitation, projects the team and cancels the other pending invitations", async () => {
    const seed = baseSeed();
    seed.team_memberships = [
      { id: "membership0001", team: "team0000000001", candidate: "candidate000001" },
      { id: "membership0002", team: "team0000000001", candidate: "candidate000002" },
    ];
    seed.team_invitations = [
      { id: "invitation00001", team: "team0000000001", candidate: "candidate000003", status: "pending" },
      { id: "invitation00002", team: "team0000000002", candidate: "candidate000003", status: "pending" },
    ];
    const invited = { ...owner, id: "user00000000003", candidate: "candidate000003" } as LomatonUser;
    const { pb, operations, send } = fakePocketBase(seed);

    await resolveOwnInvitation(pb, invited, "invitation00001", "accepted");

    expect(send).toHaveBeenCalledTimes(1);
    expect(operations).toEqual(expect.arrayContaining([
      expect.objectContaining({
        collection: "teams",
        method: "update",
        id: "team0000000001",
        data: { memberCount: 3, ftcaConfirmedCount: 1, status: "complete" },
        options: { query: { expected_member_count: 2 } },
      }),
      expect.objectContaining({ collection: "team_memberships", method: "create" }),
      expect.objectContaining({ collection: "team_invitations", method: "update", id: "invitation00001", data: expect.objectContaining({ status: "accepted" }) }),
      expect.objectContaining({ collection: "team_invitations", method: "update", id: "invitation00002", data: expect.objectContaining({ status: "cancelled" }) }),
    ]));
  });

  it("cancels an invitation that can no longer be accepted because the team is full", async () => {
    const seed = baseSeed();
    seed.teams[0].memberCount = 4;
    seed.team_invitations = [{
      id: "invitation00001",
      team: "team0000000001",
      candidate: "candidate000003",
      status: "pending",
    }];
    const invited = { ...owner, id: "user00000000003", candidate: "candidate000003" } as LomatonUser;
    const { pb, operations, send } = fakePocketBase(seed);

    await expect(resolveOwnInvitation(pb, invited, "invitation00001", "accepted"))
      .rejects.toMatchObject({ status: 409, code: "team_full" });

    expect(send).toHaveBeenCalledTimes(1);
    expect(operations).toContainEqual(expect.objectContaining({
      collection: "team_invitations",
      method: "update",
      id: "invitation00001",
      data: expect.objectContaining({ status: "cancelled" }),
    }));
  });

  it("returns an actionable conflict when a concurrent acceptance wins the guarded update", async () => {
    const seed = baseSeed();
    seed.team_memberships = [
      { id: "membership0001", team: "team0000000001", candidate: "candidate000001" },
      { id: "membership0002", team: "team0000000001", candidate: "candidate000002" },
    ];
    seed.team_invitations = [{
      id: "invitation00001",
      team: "team0000000001",
      candidate: "candidate000003",
      status: "pending",
    }];
    const invited = { ...owner, id: "user00000000003", candidate: "candidate000003" } as LomatonUser;
    const race = new ClientResponseError({ status: 400, data: { memberCount: "stale" } });
    const { pb, operations } = fakePocketBase(seed, race);

    await expect(resolveOwnInvitation(pb, invited, "invitation00001", "accepted"))
      .rejects.toMatchObject({ status: 409, code: "concurrent_conflict" });

    expect(operations).toContainEqual(expect.objectContaining({
      collection: "teams",
      method: "update",
      options: { query: { expected_member_count: 2 } },
    }));
  });

  it("allows only the owner to disband a team", async () => {
    const notOwner = { ...owner, candidate: "candidate000002" } as LomatonUser;
    const { pb, send } = fakePocketBase(baseSeed());

    await expect(disbandOwnTeam(pb, notOwner, "team0000000001"))
      .rejects.toMatchObject({ status: 403, code: "owner_required" });
    expect(send).not.toHaveBeenCalled();
  });
});
