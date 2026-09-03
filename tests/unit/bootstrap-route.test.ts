// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  UNREGISTERED_ACCOUNT_MESSAGE,
  UNVERIFIED_EMAIL_MESSAGE,
} from "@/lib/auth/access-messages";

vi.mock("server-only", () => ({}));

const requireUser = vi.fn();
const createService = vi.fn();

vi.doMock("@/lib/pocketbase/server", () => ({ requirePocketBaseUser: requireUser, createPocketBaseServiceClient: createService }));

const route = await import("@/app/api/lomaton/auth/bootstrap/route");

function createPocketBase(lists: Record<string, unknown[]>) {
  const update = vi.fn(async (_id: string, patch: Record<string, unknown>) => ({
    id: "user1",
    email: "person@example.test",
    ...patch,
  }));
  return {
    update,
    client: {
      filter: (template: string) => template,
      collection: (name: string) => ({
        getList: vi.fn(async () => ({ items: lists[name] || [] })),
        update,
      }),
    },
  };
}

describe("participant bootstrap route", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("links an active teacher registration without granting candidate permissions", async () => {
    const lists: Record<string, unknown[]> = {
      candidates: [],
      registrations: [{ id: "registration1", fullName: "Docente", relationship: "teacher" }],
      admin_allowlist: [],
      mentor_profiles: [{ id: "mentor1", registration: "registration1", active: true }],
    };
    const { client: pb, update } = createPocketBase(lists);
    requireUser.mockResolvedValue({ user: { id: "user1", email: "teacher@example.test", verified: true, candidate: "staleCandidate" } });
    createService.mockResolvedValue(pb);
    const response = await route.POST(new Request("https://app.test/api/lomaton/auth/bootstrap", { method: "POST" }));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ participantRole: "teacher", user: { registration: "registration1", candidate: "" } });
    expect(update).toHaveBeenCalledWith("user1", expect.objectContaining({ registration: "registration1", candidate: "", enabled: true }));
  });

  it("links an active juror and returns the juror role", async () => {
    const { client: pb, update } = createPocketBase({
      candidates: [],
      registrations: [],
      admin_allowlist: [],
      jurors: [{ id: "juror1", fullName: "Jurado Uno", active: true }],
    });
    requireUser.mockResolvedValue({ user: { id: "user1", email: "jury@example.test", verified: true } });
    createService.mockResolvedValue(pb);
    const response = await route.POST(new Request("https://app.test/api/lomaton/auth/bootstrap", { method: "POST" }));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ participantRole: "juror", user: { juror: "juror1", registration: "", candidate: "" } });
    expect(update).toHaveBeenCalledWith("user1", expect.objectContaining({ juror: "juror1", enabled: true }));
  });

  it("rejects an identity outside every register with the public assistance message", async () => {
    const { client: pb, update } = createPocketBase({
      candidates: [],
      registrations: [],
      admin_allowlist: [],
    });
    requireUser.mockResolvedValue({
      user: { id: "user1", email: "unknown@example.test", verified: true },
    });
    createService.mockResolvedValue(pb);

    const response = await route.POST(new Request(
      "https://app.test/api/lomaton/auth/bootstrap",
      { method: "POST" },
    ));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "email_not_authorized",
      message: UNREGISTERED_ACCOUNT_MESSAGE,
    });
    expect(update).not.toHaveBeenCalled();
  });

  it("keeps an unverified Google identity distinct from an unregistered account", async () => {
    const { client: pb } = createPocketBase({
      candidates: [{ id: "candidate1", active: true }],
      registrations: [{
        id: "registration1",
        fullName: "Alumno",
        relationship: "student_ftca",
      }],
      admin_allowlist: [],
    });
    requireUser.mockResolvedValue({
      user: { id: "user1", email: "student@example.test", verified: false },
    });
    createService.mockResolvedValue(pb);

    const response = await route.POST(new Request(
      "https://app.test/api/lomaton/auth/bootstrap",
      { method: "POST" },
    ));
    const body = await response.json() as { error: string; message: string };

    expect(response.status).toBe(403);
    expect(body).toEqual({
      error: "email_not_verified",
      message: UNVERIFIED_EMAIL_MESSAGE,
    });
    expect(body.message).not.toBe(UNREGISTERED_ACCOUNT_MESSAGE);
  });

  it("does not describe unexpected server failures as unregistered accounts", async () => {
    requireUser.mockResolvedValue({
      user: { id: "user1", email: "student@example.test", verified: true },
    });
    createService.mockRejectedValue(new Error("PocketBase unavailable"));

    const response = await route.POST(new Request(
      "https://app.test/api/lomaton/auth/bootstrap",
      { method: "POST" },
    ));
    const body = await response.json() as { error: string; message: string };

    expect(response.status).toBe(500);
    expect(body.error).toBe("internal_error");
    expect(body.message).not.toBe(UNREGISTERED_ACCOUNT_MESSAGE);
  });
});
