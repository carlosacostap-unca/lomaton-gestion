// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/server/api-error";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  requireAdmin: vi.fn(),
  requireJuror: vi.fn(),
  createService: vi.fn(),
  own: vi.fn(),
  list: vi.fn(),
  detail: vi.fn(),
  saveFile: vi.fn(),
  saveLink: vi.fn(),
  remove: vi.fn(),
  finalize: vi.fn(),
  validateFile: vi.fn(),
  proxyFile: vi.fn(),
}));

vi.doMock("@/lib/pocketbase/server", () => ({
  requirePocketBaseUser: mocks.requireUser,
  requirePocketBaseAdmin: mocks.requireAdmin,
  requirePocketBaseJuror: mocks.requireJuror,
  createPocketBaseServiceClient: mocks.createService,
}));
vi.doMock("@/lib/domain/team-deliverables", () => ({
  finalizeOwnDeliverable: mocks.finalize,
  getOwnTeamDeliverable: mocks.own,
  getTeamDeliverable: mocks.detail,
  listTeamDeliverables: mocks.list,
  removeOwnDeliverableProduct: mocks.remove,
  saveOwnDeliverableFile: mocks.saveFile,
  saveOwnDeliverableLink: mocks.saveLink,
}));
vi.doMock("@/lib/domain/team-deliverable-validation", () => ({ validateDeliverableFile: mocks.validateFile }));
vi.doMock("@/lib/server/deliverable-routes", () => ({ proxyDeliverableFile: mocks.proxyFile }));
vi.doMock("@/lib/env/server", () => ({ getServerEnv: () => ({ deliverableMaxBytes: 1024 }) }));
vi.doMock("@/lib/domain/participant-profile", () => ({ getOwnProfile: vi.fn(), updateOwnProfile: vi.fn() }));
vi.doMock("@/lib/domain/mentor-commands", () => ({ assignAdminMentor: vi.fn(), getOwnMentorDashboard: vi.fn(), getTeamMentorState: vi.fn(), removeAdminMentorship: vi.fn() }));
vi.doMock("@/lib/domain/team-commands", () => ({ createTeam: vi.fn(), disbandOwnTeam: vi.fn(), inviteCandidate: vi.fn(), resolveOwnInvitation: vi.fn(), updateTeamChallenge: vi.fn(), withdrawInvitation: vi.fn() }));
vi.doMock("@/lib/domain/admin-commands", () => ({ addAdminTeamMember: vi.fn(), createAdminTeam: vi.fn(), disbandAdminTeam: vi.fn(), removeAdminTeamMember: vi.fn(), reconcileTeams: vi.fn(), resolveAdminInvitation: vi.fn(), updateAdminCandidate: vi.fn(), updateAdminTeam: vi.fn(), updateHackathonSettings: vi.fn() }));
vi.doMock("@/lib/domain/jury-evaluation", () => ({ cancelAdminEvaluation: vi.fn(), createAdminJuror: vi.fn(), getAdminEvaluationDashboard: vi.fn(), getJuryDashboard: vi.fn(), getOwnTeamEvaluationResult: vi.fn(), listAdminJurors: vi.fn(), openAdminEvaluation: vi.fn(), publishAdminEvaluation: vi.fn(), reopenAdminEvaluation: vi.fn(), saveOwnEvaluation: vi.fn(), updateAdminJuror: vi.fn() }));
vi.doMock("@/lib/domain/registration-admin", () => ({ getAdminRegistration: vi.fn(), listAdminRegistrations: vi.fn(), updateAdminRegistration: vi.fn() }));
vi.doMock("@/lib/domain/admin-team-views", () => ({ listAdminTeamSummaries: vi.fn(), getAdminTeamDetail: vi.fn() }));
vi.doMock("@/lib/domain/admin-student-views", () => ({ listAdminStudents: vi.fn() }));
vi.doMock("@/lib/domain/admin-teacher-views", () => ({ listAdminTeachers: vi.fn() }));
vi.doMock("@/lib/report/snapshot", () => ({ readConsistentReportSnapshot: vi.fn() }));

const route = await import("@/app/api/lomaton/[...path]/route");
const service = { service: true, collection: () => ({ getOne: vi.fn().mockResolvedValue({ id: "juror1", active: true }) }) };
const student = { id: "student", candidate: "candidate1", enabled: true };
const routeContext = (path: string[]) => ({ params: Promise.resolve({ path }) });

describe("team deliverable routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createService.mockResolvedValue(service);
    mocks.requireUser.mockResolvedValue({ user: student });
    mocks.requireAdmin.mockResolvedValue({ user: { id: "admin", isAdmin: true } });
    mocks.requireJuror.mockResolvedValue({ user: { id: "jury", juror: "juror1" } });
    mocks.own.mockResolvedValue({ teamId: "team1", version: 0, products: [] });
    mocks.list.mockResolvedValue({ items: [], counts: { none: 0 } });
    mocks.detail.mockResolvedValue({ teamId: "team1", version: 1 });
    mocks.saveLink.mockResolvedValue({ teamId: "team1", version: 1 });
    mocks.saveFile.mockResolvedValue({ teamId: "team1", version: 1 });
    mocks.remove.mockResolvedValue({ teamId: "team1", version: 2 });
    mocks.finalize.mockResolvedValue({ teamId: "team1", lifecycle: "finalized", version: 2 });
    mocks.proxyFile.mockResolvedValue(new Response("file", { status: 200 }));
    mocks.validateFile.mockResolvedValue({ file: new File(["PDF"], "presentacion.pdf", { type: "application/pdf" }), safeDownloadName: "presentacion.pdf", mimeType: "application/pdf", sizeBytes: 3, sha256: "hash" });
  });

  it("serves the shared delivery and saves a valid link with optimistic versioning", async () => {
    const own = await route.GET(new Request("https://app.test/api/lomaton/me/deliverable"), routeContext(["me", "deliverable"]));
    expect(own.status).toBe(200);
    expect(mocks.own).toHaveBeenCalledWith(service, student);

    const saved = await route.PATCH(new Request("https://app.test/api/lomaton/me/deliverable/products/presentation", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ expectedVersion: 0, url: "https://example.test/deck" }),
    }), routeContext(["me", "deliverable", "products", "presentation"]));
    expect(saved.status).toBe(200);
    expect(mocks.saveLink).toHaveBeenCalledWith(service, student, "presentation", "https://example.test/deck", 0);
  });

  it("validates multipart files and rejects oversized bodies before parsing them", async () => {
    const form = new FormData();
    form.set("expectedVersion", "0");
    form.set("file", new File(["PDF"], "canvas.pdf", { type: "application/pdf" }));
    const saved = await route.PATCH(new Request("https://app.test/api/lomaton/me/deliverable/products/canvas", { method: "PATCH", body: form }), routeContext(["me", "deliverable", "products", "canvas"]));
    expect(saved.status).toBe(200);
    expect(mocks.validateFile).toHaveBeenCalledWith("canvas", expect.any(File), 1024);
    expect(mocks.saveFile).toHaveBeenCalledWith(service, student, "canvas", expect.objectContaining({ sha256: "hash" }), 0);

    const rejected = await route.PATCH(new Request("https://app.test/api/lomaton/me/deliverable/products/canvas", {
      method: "PATCH",
      headers: { "content-type": "multipart/form-data; boundary=x", "content-length": String(1024 + 1024 * 1024 + 1) },
      body: "--x--",
    }), routeContext(["me", "deliverable", "products", "canvas"]));
    expect(rejected.status).toBe(413);
    expect(mocks.validateFile).toHaveBeenCalledTimes(1);
  });

  it("finalizes, removes products, and preserves domain conflicts", async () => {
    const finalized = await route.POST(new Request("https://app.test/api/lomaton/me/deliverable/finalize", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ expectedVersion: 1 }),
    }), routeContext(["me", "deliverable", "finalize"]));
    expect(finalized.status).toBe(200);
    expect(mocks.finalize).toHaveBeenCalledWith(service, student, 1);

    mocks.remove.mockRejectedValueOnce(new ApiError(409, "Recargá", "deliverable_version_conflict"));
    const conflict = await route.DELETE(new Request("https://app.test/api/lomaton/me/deliverable/products/video", {
      method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ expectedVersion: 1 }),
    }), routeContext(["me", "deliverable", "products", "video"]));
    expect(conflict.status).toBe(409);
    await expect(conflict.json()).resolves.toMatchObject({ error: "deliverable_version_conflict" });
  });

  it("authorizes admin and juror reads separately and proxies protected downloads", async () => {
    const admin = await route.GET(new Request("https://app.test/api/lomaton/admin/deliverables"), routeContext(["admin", "deliverables"]));
    expect(admin.status).toBe(200);
    expect(mocks.requireAdmin).toHaveBeenCalled();

    const jury = await route.GET(new Request("https://app.test/api/lomaton/jury/deliverables/team1"), routeContext(["jury", "deliverables", "team1"]));
    expect(jury.status).toBe(200);
    expect(mocks.requireJuror).toHaveBeenCalled();
    expect(mocks.detail).toHaveBeenLastCalledWith(service, "team1");

    const file = await route.GET(new Request("https://app.test/api/lomaton/deliverables/team1/files/report"), routeContext(["deliverables", "team1", "files", "report"]));
    expect(file.status).toBe(200);
    expect(mocks.proxyFile).toHaveBeenCalledWith(service, student, "team1", "report");
  });
});
