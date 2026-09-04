// @vitest-environment node

import type PocketBase from "pocketbase";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  createAdminTeam,
  reconcileTeams,
  resolveAdminInvitation,
  updateHackathonSettings,
} from "@/lib/domain/admin-commands";
import type { LomatonUser } from "@/lib/pocketbase/server";

type Item = Record<string, unknown> & { id: string };
type Operation = { collection: string; method: string; id?: string; data?: Record<string, unknown>; options?: unknown };

function value(filter: string, field: string) {
  return filter.match(new RegExp(`${field} = "([^"]+)"`))?.[1];
}

function fakePocketBase(seed: Record<string, Item[]>) {
  const operations: Operation[] = [];
  const send = vi.fn(async () => undefined);
  const select = (name: string, filter = "") => (seed[name] ?? []).filter((item) => {
    for (const field of ["key", "team", "candidate"]) {
      const expected = value(filter, field);
      if (expected && String(item[field]) !== expected) return false;
    }
    if (filter.includes("status = 'pending'") && item.status !== "pending") return false;
    return true;
  });
  const pb = {
    filter: (template: string, params: Record<string, unknown> = {}) =>
      template.replace(/\{:(\w+)\}/g, (_, key: string) => JSON.stringify(params[key])),
    collection: (name: string) => ({
      getOne: vi.fn(async (id: string) => (seed[name] ?? []).find((item) => item.id === id)),
      getFirstListItem: vi.fn(async (filter: string) => select(name, filter)[0]),
      getFullList: vi.fn(async (options: { filter?: string } = {}) => select(name, options.filter)),
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

function settings(formationOpen = true): Item {
  return {
    id: "settings0000001",
    key: "default",
    formationOpen,
    deadlineUtc: "2030-12-31T23:59:00.000Z",
    deliverablesDeadlineUtc: "2030-12-31T23:59:00.000Z",
    dataVersion: 1,
  };
}

describe("admin hackathon commands", () => {
  it("updates the deadline in UTC and audits the setting change in the same batch", async () => {
    const { pb, operations, send } = fakePocketBase({ hackathon_settings: [settings()] });

    await updateHackathonSettings(pb, admin, {
      deadlineUtc: "2030-09-10T21:30:00-03:00",
      formationOpen: false,
      reason: "cierre aprobado",
    });

    expect(send).toHaveBeenCalledTimes(1);
    expect(operations).toEqual(expect.arrayContaining([
      expect.objectContaining({
        collection: "hackathon_settings",
        method: "update",
        data: expect.objectContaining({ deadlineUtc: "2030-09-11T00:30:00.000Z", formationOpen: false, "dataVersion+": 1 }),
      }),
      expect.objectContaining({
        collection: "audit_logs",
        method: "create",
        data: expect.objectContaining({ action: "hackathon.settings.update", reason: "cierre aprobado" }),
      }),
    ]));
  });

  it("requires explicit confirmation before moving the delivery deadline to the past", async () => {
    const first = fakePocketBase({ hackathon_settings: [settings()] });
    await expect(updateHackathonSettings(first.pb, admin, {
      deadlineUtc: "2030-09-10T21:30:00-03:00",
      deliverablesDeadlineUtc: "2020-09-10T21:30:00-03:00",
      formationOpen: true,
      reason: "cierre extraordinario",
    })).rejects.toMatchObject({
      status: 409,
      code: "deliverables_deadline_confirmation_required",
    });
    expect(first.send).not.toHaveBeenCalled();

    const confirmed = fakePocketBase({ hackathon_settings: [settings()] });
    await updateHackathonSettings(confirmed.pb, admin, {
      deadlineUtc: "2030-09-10T21:30:00-03:00",
      deliverablesDeadlineUtc: "2020-09-10T21:30:00-03:00",
      formationOpen: true,
      reason: "cierre extraordinario",
      confirmImmediateDeliverablesClosure: true,
    });
    expect(confirmed.operations).toContainEqual(expect.objectContaining({
      collection: "hackathon_settings",
      method: "update",
      data: expect.objectContaining({ deliverablesDeadlineUtc: "2020-09-11T00:30:00.000Z" }),
    }));
  });

  it("requires a reason for an administrative team intervention after closure", async () => {
    const seed = {
      hackathon_settings: [settings(false)],
      candidates: [{ id: "candidate000001", active: true, ftcaStatus: "confirmed" }],
      team_memberships: [],
    };
    const { pb, send } = fakePocketBase(seed);

    await expect(createAdminTeam(pb, admin, {
      name: "Equipo cerrado",
      ownerCandidateId: "candidate000001",
      reason: "",
    })).rejects.toMatchObject({ status: 400, code: "reason_required" });
    expect(send).not.toHaveBeenCalled();
  });

  it("accepts an invitation administratively and cancels the candidate's alternatives", async () => {
    const seed = {
      hackathon_settings: [settings()],
      teams: [{ id: "team0000000001", owner: "candidate000001", memberCount: 2, ftcaConfirmedCount: 1, status: "draft" }],
      candidates: [{ id: "candidate000003", active: true, ftcaStatus: "pending" }],
      team_memberships: [
        { id: "membership0001", team: "team0000000001", candidate: "candidate000001", expand: { candidate: { ftcaStatus: "confirmed" } } },
        { id: "membership0002", team: "team0000000001", candidate: "candidate000002", expand: { candidate: { ftcaStatus: "not_ftca" } } },
      ],
      team_invitations: [
        { id: "invitation00001", team: "team0000000001", candidate: "candidate000003", status: "pending" },
        { id: "invitation00002", team: "team0000000002", candidate: "candidate000003", status: "pending" },
      ],
    };
    const { pb, operations, send } = fakePocketBase(seed);

    await resolveAdminInvitation(pb, admin, "invitation00001", "accepted", "problema de acceso");

    expect(send).toHaveBeenCalledTimes(1);
    expect(operations).toEqual(expect.arrayContaining([
      expect.objectContaining({ collection: "team_memberships", method: "create", data: expect.objectContaining({ candidate: "candidate000003", source: "admin" }) }),
      expect.objectContaining({ collection: "team_invitations", method: "update", id: "invitation00001", data: expect.objectContaining({ status: "accepted" }) }),
      expect.objectContaining({ collection: "team_invitations", method: "update", id: "invitation00002", data: expect.objectContaining({ status: "cancelled" }) }),
      expect.objectContaining({ collection: "audit_logs", method: "create", data: expect.objectContaining({ action: "invitation.admin.accepted", reason: "problema de acceso" }) }),
    ]));
  });

  it("reconciles only inconsistent projections with a guarded, audited batch", async () => {
    const seed = {
      hackathon_settings: [settings()],
      teams: [
        { id: "team0000000001", memberCount: 3, ftcaConfirmedCount: 0, status: "missing_ftca" },
        { id: "team0000000002", memberCount: 1, ftcaConfirmedCount: 1, status: "draft" },
      ],
      team_memberships: [
        { id: "membership0001", team: "team0000000001", candidate: "candidate000001", expand: { candidate: { ftcaStatus: "confirmed" } } },
        { id: "membership0002", team: "team0000000002", candidate: "candidate000002", expand: { candidate: { ftcaStatus: "confirmed" } } },
      ],
    };
    const { pb, operations, send } = fakePocketBase(seed);

    await expect(reconcileTeams(pb, admin, "revisión de consistencia"))
      .resolves.toEqual({ checked: 2, corrected: 1 });

    expect(send).toHaveBeenCalledTimes(1);
    expect(operations.filter((operation) => operation.collection === "teams" && operation.method === "update"))
      .toEqual([
        expect.objectContaining({
          id: "team0000000001",
          data: { memberCount: 1, ftcaConfirmedCount: 1, status: "draft" },
          options: { query: { expected_member_count: 3 } },
        }),
      ]);
    expect(operations).toContainEqual(expect.objectContaining({
      collection: "audit_logs",
      method: "create",
      data: expect.objectContaining({ action: "team.reconcile" }),
    }));
  });
});
