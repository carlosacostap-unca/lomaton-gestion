// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/server/api-error";

vi.mock("server-only", () => ({}));

const requireUser = vi.fn();
const requireAdmin = vi.fn();
const createService = vi.fn();
const requireActive = vi.fn();
const findCertificate = vi.fn();
const metadata = vi.fn((record) => record ? { present: true, originalName: record.originalName } : { present: false });
const upsert = vi.fn();
const validate = vi.fn();
const proxy = vi.fn();

vi.doMock("@/lib/pocketbase/server", () => ({
  requirePocketBaseUser: requireUser,
  requirePocketBaseAdmin: requireAdmin,
  createPocketBaseServiceClient: createService,
}));
vi.doMock("@/lib/domain/student-certificates", () => ({
  requireActiveCandidate: requireActive,
  findStudentCertificate: findCertificate,
  studentCertificateMetadata: metadata,
  upsertStudentCertificate: upsert,
}));
vi.doMock("@/lib/domain/student-certificate-validation", () => ({ validateStudentCertificate: validate }));
vi.doMock("@/lib/server/certificate-routes", () => ({
  validateCandidateId: (value: string) => value,
  proxyStudentCertificate: proxy,
}));

const ownRoute = await import("@/app/api/lomaton/certificates/me/route");
const ownDownloadRoute = await import("@/app/api/lomaton/certificates/me/download/route");
const adminRoute = await import("@/app/api/lomaton/admin/candidates/[candidateId]/certificate/route");

const service = { collection: () => ({ getOne: vi.fn().mockResolvedValue({ id: "candidate000001" }) }) };
const auth = {
  env: { certificateMaxBytes: 10 * 1024 * 1024 },
  user: { id: "user00000000001", candidate: "candidate000001", enabled: true },
};

describe("student certificate Route Handlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireUser.mockResolvedValue(auth);
    requireAdmin.mockResolvedValue(auth);
    createService.mockResolvedValue(service);
    requireActive.mockResolvedValue({ id: "candidate000001", active: true });
    findCertificate.mockResolvedValue(null);
  });

  it("denies anonymous metadata requests", async () => {
    requireUser.mockRejectedValue(new ApiError(401, "Falta autenticación.", "authentication_required"));
    const response = await ownRoute.GET(new Request("https://app.example/api/lomaton/certificates/me"));
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ error: "authentication_required" });
    expect(findCertificate).not.toHaveBeenCalled();
  });

  it("denies a user without a candidate and an inactive candidate", async () => {
    requireUser.mockResolvedValueOnce({ ...auth, user: { ...auth.user, candidate: "" } });
    expect((await ownRoute.GET(new Request("https://app.example/api/lomaton/certificates/me"))).status).toBe(403);
    requireActive.mockRejectedValueOnce(new ApiError(403, "Inactivo", "candidate_inactive"));
    expect((await ownRoute.GET(new Request("https://app.example/api/lomaton/certificates/me"))).status).toBe(403);
    expect(findCertificate).not.toHaveBeenCalled();
  });

  it("returns only allowed metadata to the owner", async () => {
    findCertificate.mockResolvedValue({ originalName: "regular.pdf", certificate: "internal.pdf", sha256: "secret" });
    const response = await ownRoute.GET(new Request("https://app.example/api/lomaton/certificates/me", {
      headers: { Authorization: "Bearer owner" },
    }));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ present: true, originalName: "regular.pdf", maxBytes: 10 * 1024 * 1024 });
    expect(findCertificate).toHaveBeenCalledWith(service, "candidate000001");
  });

  it("accepts an owner multipart upload and rejects an excessive Content-Length early", async () => {
    const form = new FormData();
    const file = new File(["%PDF-1.7"], "regular.pdf", { type: "application/pdf" });
    form.set("certificate", file);
    validate.mockResolvedValue({ file, originalName: file.name, sizeBytes: file.size, sha256: "a".repeat(64) });
    upsert.mockResolvedValue({ present: true, originalName: file.name });
    const accepted = await ownRoute.POST(new Request("https://app.example/api/lomaton/certificates/me", {
      method: "POST",
      headers: { Authorization: "Bearer owner" },
      body: form,
    }));
    expect(accepted.status).toBe(200);
    expect(upsert).toHaveBeenCalledWith(service, auth.user, "candidate000001", expect.any(Object));

    const rejected = await ownRoute.POST(new Request("https://app.example/api/lomaton/certificates/me", {
      method: "POST",
      headers: {
        Authorization: "Bearer owner",
        "Content-Type": "multipart/form-data; boundary=fake",
        "Content-Length": String(12 * 1024 * 1024),
      },
      body: "--fake--",
    }));
    expect(rejected.status).toBe(413);
  });

  it("does not let a non-admin use the candidate-id route", async () => {
    requireAdmin.mockRejectedValue(new ApiError(403, "Admin requerido", "admin_required"));
    const response = await adminRoute.GET(
      new Request("https://app.example/api/lomaton/admin/candidates/candidate000002/certificate"),
      { params: Promise.resolve({ candidateId: "candidate000002" }) },
    );
    expect(response.status).toBe(403);
    expect(findCertificate).not.toHaveBeenCalled();
  });

  it("allows an administrator to inspect another candidate and maps storage errors", async () => {
    findCertificate.mockResolvedValue({ originalName: "other.pdf" });
    const response = await adminRoute.GET(
      new Request("https://app.example/api/lomaton/admin/candidates/candidate000002/certificate", { headers: { Authorization: "Bearer admin" } }),
      { params: Promise.resolve({ candidateId: "candidate000002" }) },
    );
    expect(response.status).toBe(200);
    expect(findCertificate).toHaveBeenCalledWith(service, "candidate000002");

    proxy.mockRejectedValueOnce(new ApiError(502, "Storage no disponible", "certificate_storage_error"));
    const failed = await ownDownloadRoute.GET(new Request("https://app.example/api/lomaton/certificates/me/download", {
      headers: { Authorization: "Bearer owner" },
    }));
    expect(failed.status).toBe(502);
  });
});
