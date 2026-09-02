// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/server/api-error";

vi.mock("server-only", () => ({}));

const requireUser = vi.fn();
const requireAdmin = vi.fn();
const createService = vi.fn();
const getProfile = vi.fn();
const updateProfile = vi.fn();
const getMentorDashboard = vi.fn();
const getTeamMentor = vi.fn();
const eligible = vi.fn();
const invite = vi.fn();
const resolve = vi.fn();
const withdraw = vi.fn();

vi.doMock("@/lib/pocketbase/server", () => ({
  requirePocketBaseUser: requireUser,
  requirePocketBaseAdmin: requireAdmin,
  createPocketBaseServiceClient: createService,
}));
vi.doMock("@/lib/domain/participant-profile", () => ({ getOwnProfile: getProfile, updateOwnProfile: updateProfile }));
vi.doMock("@/lib/domain/mentor-commands", () => ({
  getOwnMentorDashboard: getMentorDashboard,
  getTeamMentorState: getTeamMentor,
  listEligibleMentors: eligible,
  inviteMentor: invite,
  resolveMentorInvitation: resolve,
  withdrawMentorInvitation: withdraw,
  resolveAdminMentorInvitation: vi.fn(),
  removeAdminMentorship: vi.fn(),
}));
vi.doMock("@/lib/domain/team-commands", () => ({ createTeam: vi.fn(), disbandOwnTeam: vi.fn(), inviteCandidate: vi.fn(), resolveOwnInvitation: vi.fn(), withdrawInvitation: vi.fn() }));
vi.doMock("@/lib/domain/admin-commands", () => ({ addAdminTeamMember: vi.fn(), createAdminTeam: vi.fn(), disbandAdminTeam: vi.fn(), removeAdminTeamMember: vi.fn(), reconcileTeams: vi.fn(), resolveAdminInvitation: vi.fn(), updateAdminCandidate: vi.fn(), updateAdminTeam: vi.fn(), updateHackathonSettings: vi.fn() }));
vi.doMock("@/lib/domain/registration-admin", () => ({ listAdminRegistrations: vi.fn(), updateAdminRegistration: vi.fn() }));
vi.doMock("@/lib/report/snapshot", () => ({ readConsistentReportSnapshot: vi.fn() }));

const route = await import("@/app/api/lomaton/[...path]/route");

const user = { id: "user1", registration: "registration1", candidate: "candidate1", enabled: true };
const service = {};
const context = (path: string[]) => ({ params: Promise.resolve({ path }) });

describe("participant catch-all routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireUser.mockResolvedValue({ user });
    requireAdmin.mockResolvedValue({ user: { ...user, isAdmin: true } });
    createService.mockResolvedValue(service);
    getProfile.mockResolvedValue({ role: "student", version: 1, readOnly: { fullName: "Ada" }, editable: { phone: "12345" } });
    updateProfile.mockResolvedValue({ role: "student", version: 2 });
    getMentorDashboard.mockResolvedValue({ assignment: null, invitations: [] });
    eligible.mockResolvedValue([]);
    invite.mockResolvedValue({ id: "invite1" });
    resolve.mockResolvedValue({ assignment: null, invitations: [] });
    withdraw.mockResolvedValue({ id: "invite1", status: "withdrawn" });
  });

  it("returns 401 for an unauthenticated own-profile request", async () => {
    requireUser.mockRejectedValueOnce(new ApiError(401, "Falta autenticación.", "authentication_required"));
    const response = await route.GET(new Request("https://app.test/api/lomaton/me/profile"), context(["me", "profile"]));
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ error: "authentication_required" });
  });

  it("serves the safe profile and rejects unknown or protected patch properties", async () => {
    const response = await route.GET(new Request("https://app.test/api/lomaton/me/profile"), context(["me", "profile"]));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.not.toHaveProperty("rawSource");

    const rejected = await route.PATCH(new Request("https://app.test/api/lomaton/me/profile", {
      method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ expectedVersion: 1, email: "other@example.test" }),
    }), context(["me", "profile"]));
    expect(rejected.status).toBe(400);
    expect(updateProfile).not.toHaveBeenCalled();
  });

  it("preserves domain conflicts and exposes mentor invitation operations", async () => {
    updateProfile.mockRejectedValueOnce(new ApiError(409, "Recargá", "profile_version_conflict"));
    const conflict = await route.PATCH(new Request("https://app.test/api/lomaton/me/profile", {
      method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ expectedVersion: 1, phone: "12345" }),
    }), context(["me", "profile"]));
    expect(conflict.status).toBe(409);
    await expect(conflict.json()).resolves.toMatchObject({ error: "profile_version_conflict" });

    const created = await route.POST(new Request("https://app.test/api/lomaton/teams/team1/mentor-invitations", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ mentorId: "mentor1" }),
    }), context(["teams", "team1", "mentor-invitations"]));
    expect(created.status).toBe(201);
    expect(invite).toHaveBeenCalledWith(service, user, "team1", "mentor1");

    await route.POST(new Request("https://app.test/api/lomaton/mentor-invitations/invite1/accept", { method: "POST" }), context(["mentor-invitations", "invite1", "accept"]));
    expect(resolve).toHaveBeenCalledWith(service, user, "invite1", "accepted");
    await route.DELETE(new Request("https://app.test/api/lomaton/mentor-invitations/invite1", { method: "DELETE" }), context(["mentor-invitations", "invite1"]));
    expect(withdraw).toHaveBeenCalledWith(service, user, "invite1");
  });
});
