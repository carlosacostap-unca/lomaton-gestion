// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/server/api-error";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  requireAdmin: vi.fn(),
  requireJuror: vi.fn(),
  createService: vi.fn(),
  listJurors: vi.fn(),
  getJury: vi.fn(),
  getAdminEvaluation: vi.fn(),
  getResult: vi.fn(),
  save: vi.fn(),
}));

vi.doMock("@/lib/pocketbase/server", () => ({
  requirePocketBaseUser: mocks.requireUser,
  requirePocketBaseAdmin: mocks.requireAdmin,
  requirePocketBaseJuror: mocks.requireJuror,
  createPocketBaseServiceClient: mocks.createService,
}));
vi.doMock("@/lib/domain/jury-evaluation", () => ({
  cancelAdminEvaluation: vi.fn(),
  createAdminJuror: vi.fn(),
  getAdminEvaluationDashboard: mocks.getAdminEvaluation,
  getJuryDashboard: mocks.getJury,
  getOwnTeamEvaluationResult: mocks.getResult,
  listAdminJurors: mocks.listJurors,
  openAdminEvaluation: vi.fn(),
  publishAdminEvaluation: vi.fn(),
  reopenAdminEvaluation: vi.fn(),
  saveOwnEvaluation: mocks.save,
  updateAdminJuror: vi.fn(),
}));
vi.doMock("@/lib/domain/participant-profile", () => ({ getOwnProfile: vi.fn(), updateOwnProfile: vi.fn() }));
vi.doMock("@/lib/domain/mentor-commands", () => ({ assignAdminMentor: vi.fn(), getOwnMentorDashboard: vi.fn(), getTeamMentorState: vi.fn(), removeAdminMentorship: vi.fn() }));
vi.doMock("@/lib/domain/team-commands", () => ({ createTeam: vi.fn(), disbandOwnTeam: vi.fn(), inviteCandidate: vi.fn(), resolveOwnInvitation: vi.fn(), withdrawInvitation: vi.fn() }));
vi.doMock("@/lib/domain/admin-commands", () => ({ addAdminTeamMember: vi.fn(), createAdminTeam: vi.fn(), disbandAdminTeam: vi.fn(), removeAdminTeamMember: vi.fn(), reconcileTeams: vi.fn(), resolveAdminInvitation: vi.fn(), updateAdminCandidate: vi.fn(), updateAdminTeam: vi.fn(), updateHackathonSettings: vi.fn() }));
vi.doMock("@/lib/domain/registration-admin", () => ({ getAdminRegistration: vi.fn(), listAdminRegistrations: vi.fn(), updateAdminRegistration: vi.fn() }));
vi.doMock("@/lib/domain/admin-team-views", () => ({ listAdminTeamSummaries: vi.fn(), getAdminTeamDetail: vi.fn() }));
vi.doMock("@/lib/domain/admin-student-views", () => ({ listAdminStudents: vi.fn() }));
vi.doMock("@/lib/domain/admin-teacher-views", () => ({ listAdminTeachers: vi.fn() }));
vi.doMock("@/lib/report/snapshot", () => ({ readConsistentReportSnapshot: vi.fn() }));

const route = await import("@/app/api/lomaton/[...path]/route");
const routeContext = (path: string[]) => ({ params: Promise.resolve({ path }) });

describe("jury route authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createService.mockResolvedValue({ service: true });
    mocks.requireUser.mockResolvedValue({ user: { id: "student", candidate: "candidate1" } });
    mocks.requireAdmin.mockResolvedValue({ user: { id: "admin", isAdmin: true } });
    mocks.requireJuror.mockResolvedValue({ user: { id: "jury-user", juror: "juror1" } });
    mocks.listJurors.mockResolvedValue({ jurors: [], rosterLocked: false });
    mocks.getJury.mockResolvedValue({ cycle: null, evaluations: [], progress: { finalized: 0, total: 0 } });
    mocks.getAdminEvaluation.mockResolvedValue({ cycle: null, evaluations: [], canPublish: false });
    mocks.getResult.mockResolvedValue({ published: false, teamId: "team1" });
  });

  it("protects the administrative juror list", async () => {
    const response = await route.GET(new Request("https://app.test/api/lomaton/admin/jurors"), routeContext(["admin", "jurors"]));
    expect(response.status).toBe(200);
    expect(mocks.listJurors).toHaveBeenCalledWith({ service: true });
    mocks.requireAdmin.mockRejectedValueOnce(new ApiError(403, "Sin permiso.", "admin_required"));
    const denied = await route.GET(new Request("https://app.test/api/lomaton/admin/jurors"), routeContext(["admin", "jurors"]));
    expect(denied.status).toBe(403);
    expect(mocks.listJurors).toHaveBeenCalledTimes(1);
  });

  it("rejects participant and anonymous access before reading jury evaluations", async () => {
    mocks.requireJuror.mockRejectedValueOnce(new ApiError(403, "Jurado requerido.", "juror_required"));
    const participant = await route.GET(new Request("https://app.test/api/lomaton/jury/evaluations"), routeContext(["jury", "evaluations"]));
    expect(participant.status).toBe(403);
    mocks.requireJuror.mockRejectedValueOnce(new ApiError(401, "Falta autenticación.", "authentication_required"));
    const anonymous = await route.GET(new Request("https://app.test/api/lomaton/jury/evaluations"), routeContext(["jury", "evaluations"]));
    expect(anonymous.status).toBe(401);
    expect(mocks.getJury).not.toHaveBeenCalled();
  });

  it("allows a juror and rejects decimal score payloads", async () => {
    const response = await route.GET(new Request("https://app.test/api/lomaton/jury/evaluations"), routeContext(["jury", "evaluations"]));
    expect(response.status).toBe(200);
    expect(mocks.getJury).toHaveBeenCalledWith({ service: true }, expect.objectContaining({ juror: "juror1" }));

    const invalid = await route.PATCH(new Request("https://app.test/api/lomaton/jury/evaluations/e1", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ expectedVersion: 1, scores: { innovation: 7.5 }, finalize: false }),
    }), routeContext(["jury", "evaluations", "e1"]));
    expect(invalid.status).toBe(400);
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it("serves team result only through the authenticated own-result route", async () => {
    const response = await route.GET(new Request("https://app.test/api/lomaton/me/evaluation-result"), routeContext(["me", "evaluation-result"]));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ published: false, teamId: "team1" });
    expect(mocks.getResult).toHaveBeenCalledWith({ service: true }, expect.objectContaining({ candidate: "candidate1" }));
  });
});
