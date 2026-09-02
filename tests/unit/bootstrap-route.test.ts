// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const requireUser = vi.fn();
const createService = vi.fn();

vi.doMock("@/lib/pocketbase/server", () => ({ requirePocketBaseUser: requireUser, createPocketBaseServiceClient: createService }));

const route = await import("@/app/api/lomaton/auth/bootstrap/route");

describe("participant bootstrap route", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("links an active teacher registration without granting candidate permissions", async () => {
    const update = vi.fn(async (_id: string, patch: Record<string, unknown>) => ({ id: "user1", email: "teacher@example.test", ...patch }));
    const lists: Record<string, unknown[]> = {
      candidates: [],
      registrations: [{ id: "registration1", fullName: "Docente", relationship: "teacher" }],
      admin_allowlist: [],
      mentor_profiles: [{ id: "mentor1", registration: "registration1", active: true }],
    };
    const pb = {
      filter: (template: string) => template,
      collection: (name: string) => ({ getList: vi.fn(async () => ({ items: lists[name] || [] })), update }),
    };
    requireUser.mockResolvedValue({ user: { id: "user1", email: "teacher@example.test", verified: true, candidate: "staleCandidate" } });
    createService.mockResolvedValue(pb);
    const response = await route.POST(new Request("https://app.test/api/lomaton/auth/bootstrap", { method: "POST" }));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ participantRole: "teacher", user: { registration: "registration1", candidate: "" } });
    expect(update).toHaveBeenCalledWith("user1", expect.objectContaining({ registration: "registration1", candidate: "", enabled: true }));
  });
});
