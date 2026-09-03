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
const assignMentor = vi.fn();
const listTeamViews = vi.fn();
const getTeamDetail = vi.fn();
const listStudents = vi.fn();
const listTeachers = vi.fn();
const getRegistration = vi.fn();

vi.doMock("@/lib/pocketbase/server", () => ({
  requirePocketBaseUser: requireUser,
  requirePocketBaseAdmin: requireAdmin,
  createPocketBaseServiceClient: createService,
}));
vi.doMock("@/lib/domain/participant-profile", () => ({ getOwnProfile: getProfile, updateOwnProfile: updateProfile }));
vi.doMock("@/lib/domain/mentor-commands", () => ({
  assignAdminMentor: assignMentor,
  getOwnMentorDashboard: getMentorDashboard,
  getTeamMentorState: getTeamMentor,
  removeAdminMentorship: vi.fn(),
}));
vi.doMock("@/lib/domain/team-commands", () => ({ createTeam: vi.fn(), disbandOwnTeam: vi.fn(), inviteCandidate: vi.fn(), resolveOwnInvitation: vi.fn(), withdrawInvitation: vi.fn() }));
vi.doMock("@/lib/domain/admin-commands", () => ({ addAdminTeamMember: vi.fn(), createAdminTeam: vi.fn(), disbandAdminTeam: vi.fn(), removeAdminTeamMember: vi.fn(), reconcileTeams: vi.fn(), resolveAdminInvitation: vi.fn(), updateAdminCandidate: vi.fn(), updateAdminTeam: vi.fn(), updateHackathonSettings: vi.fn() }));
vi.doMock("@/lib/domain/registration-admin", () => ({ getAdminRegistration: getRegistration, listAdminRegistrations: vi.fn(), updateAdminRegistration: vi.fn() }));
vi.doMock("@/lib/domain/admin-team-views", () => ({ listAdminTeamSummaries: listTeamViews, getAdminTeamDetail: getTeamDetail }));
vi.doMock("@/lib/domain/admin-student-views", () => ({ listAdminStudents: listStudents }));
vi.doMock("@/lib/domain/admin-teacher-views", () => ({ listAdminTeachers: listTeachers }));
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
    getMentorDashboard.mockResolvedValue({ assignments: [] });
    getTeamMentor.mockResolvedValue({ assignment: null });
    assignMentor.mockResolvedValue({ id: "assignment1", team: "team1", mentor: "mentor1", source: "admin" });
    listTeamViews.mockResolvedValue({ teams: [], availableCandidates: [] });
    getTeamDetail.mockResolvedValue({ team: { id: "team1" }, members: [], invitations: [] });
    listStudents.mockResolvedValue({ students: [] });
    listTeachers.mockResolvedValue({ teachers: [], teams: [] });
    getRegistration.mockResolvedValue({ id: "registration1", fullName: "Ada" });
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

  it("preserves domain conflicts and rejects legacy mentor invitation routes", async () => {
    updateProfile.mockRejectedValueOnce(new ApiError(409, "Recargá", "profile_version_conflict"));
    const conflict = await route.PATCH(new Request("https://app.test/api/lomaton/me/profile", {
      method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ expectedVersion: 1, phone: "12345" }),
    }), context(["me", "profile"]));
    expect(conflict.status).toBe(409);
    await expect(conflict.json()).resolves.toMatchObject({ error: "profile_version_conflict" });

    const legacyCreate = await route.POST(new Request("https://app.test/api/lomaton/teams/team1/mentor-invitations", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ mentorId: "mentor1" }),
    }), context(["teams", "team1", "mentor-invitations"]));
    expect(legacyCreate.status).toBe(404);

    const legacyAccept = await route.POST(
      new Request("https://app.test/api/lomaton/mentor-invitations/invite1/accept", { method: "POST" }),
      context(["mentor-invitations", "invite1", "accept"]),
    );
    expect(legacyAccept.status).toBe(404);
    const legacyDelete = await route.DELETE(
      new Request("https://app.test/api/lomaton/mentor-invitations/invite1", { method: "DELETE" }),
      context(["mentor-invitations", "invite1"]),
    );
    expect(legacyDelete.status).toBe(404);
    const legacyList = await route.GET(
      new Request("https://app.test/api/lomaton/mentors/eligible?teamId=team1"),
      context(["mentors", "eligible"]),
    );
    expect(legacyList.status).toBe(404);
    expect(assignMentor).not.toHaveBeenCalled();
  });

  it("assigns mentors only through the administrator route", async () => {
    const response = await route.PUT(new Request(
      "https://app.test/api/lomaton/admin/teams/team1/mentor",
      {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mentorId: "mentor1", reason: "coordinación" }),
      },
    ), context(["admin", "teams", "team1", "mentor"]));

    expect(response.status).toBe(200);
    expect(assignMentor).toHaveBeenCalledWith(
      service,
      expect.objectContaining({ isAdmin: true }),
      "team1",
      "mentor1",
      "coordinación",
    );

    requireAdmin.mockRejectedValueOnce(new ApiError(403, "Sin permiso.", "admin_required"));
    const denied = await route.PUT(new Request(
      "https://app.test/api/lomaton/admin/teams/team2/mentor",
      {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mentorId: "mentor1", reason: "" }),
      },
    ), context(["admin", "teams", "team2", "mentor"]));
    expect(denied.status).toBe(403);
    expect(assignMentor).toHaveBeenCalledTimes(1);
  });

  it("protects the new team summary and detail projections with admin authorization", async () => {
    const listResponse = await route.GET(
      new Request("https://app.test/api/lomaton/admin/teams", { headers: { Authorization: "Bearer admin" } }),
      context(["admin", "teams"]),
    );
    expect(listResponse.status).toBe(200);
    expect(listTeamViews).toHaveBeenCalledWith(service);

    const detailResponse = await route.GET(
      new Request("https://app.test/api/lomaton/admin/teams/team1", { headers: { Authorization: "Bearer admin" } }),
      context(["admin", "teams", "team1"]),
    );
    expect(detailResponse.status).toBe(200);
    expect(getTeamDetail).toHaveBeenCalledWith(service, "team1");

    requireAdmin.mockRejectedValueOnce(new ApiError(403, "Sin permiso.", "admin_required"));
    const denied = await route.GET(
      new Request("https://app.test/api/lomaton/admin/teams"),
      context(["admin", "teams"]),
    );
    expect(denied.status).toBe(403);
    expect(listTeamViews).toHaveBeenCalledTimes(1);
  });

  it("protects the minimal student directory and the separate registration detail", async () => {
    listStudents.mockResolvedValueOnce({
      students: [{
        registrationId: "registration1",
        candidateId: "candidate1",
        name: "Ada",
        faculty: "FTyCA",
        certificateStatus: "approved",
        team: null,
        pendingInvitations: [],
      }],
    });
    const listResponse = await route.GET(
      new Request("https://app.test/api/lomaton/admin/students"),
      context(["admin", "students"]),
    );
    expect(listResponse.status).toBe(200);
    const payload = await listResponse.json();
    expect(payload.students[0]).toEqual({
      registrationId: "registration1",
      candidateId: "candidate1",
      name: "Ada",
      faculty: "FTyCA",
      certificateStatus: "approved",
      team: null,
      pendingInvitations: [],
    });
    expect(payload.students[0]).not.toHaveProperty("dni");
    expect(payload.students[0]).not.toHaveProperty("phone");
    expect(payload.students[0]).not.toHaveProperty("certificate");

    const detailResponse = await route.GET(
      new Request("https://app.test/api/lomaton/admin/registrations/registration1"),
      context(["admin", "registrations", "registration1"]),
    );
    expect(detailResponse.status).toBe(200);
    expect(getRegistration).toHaveBeenCalledWith(service, "registration1");

    requireAdmin.mockRejectedValueOnce(new ApiError(403, "Sin permiso.", "admin_required"));
    const denied = await route.GET(
      new Request("https://app.test/api/lomaton/admin/students"),
      context(["admin", "students"]),
    );
    expect(denied.status).toBe(403);
    expect(listStudents).toHaveBeenCalledTimes(1);
  });

  it("protects the minimal teacher directory with admin authorization", async () => {
    listTeachers.mockResolvedValueOnce({
      teachers: [{
        registrationId: "registration2",
        mentorId: "mentor1",
        name: "Docente Ada",
        affiliation: "FTyCA",
        active: true,
        mentorInterest: "yes",
        eligible: true,
        unavailableReason: "",
        assignments: [{ mentorshipId: "mentorship1", teamId: "team1", teamName: "Equipo Uno" }],
      }],
      teams: [{ id: "team1", name: "Equipo Uno", currentMentor: { id: "mentor1", name: "Docente Ada" } }],
    });
    const response = await route.GET(
      new Request("https://app.test/api/lomaton/admin/teachers"),
      context(["admin", "teachers"]),
    );
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.teachers[0]).toMatchObject({ name: "Docente Ada", eligible: true });
    expect(payload.teachers[0]).not.toHaveProperty("dni");
    expect(payload.teachers[0]).not.toHaveProperty("phone");
    expect(payload.teachers[0]).not.toHaveProperty("email");
    expect(listTeachers).toHaveBeenCalledWith(service);

    requireAdmin.mockRejectedValueOnce(new ApiError(403, "Sin permiso.", "admin_required"));
    const denied = await route.GET(
      new Request("https://app.test/api/lomaton/admin/teachers"),
      context(["admin", "teachers"]),
    );
    expect(denied.status).toBe(403);
    expect(listTeachers).toHaveBeenCalledTimes(1);
  });
});
