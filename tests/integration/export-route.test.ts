import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  createServiceClient: vi.fn(),
  readSnapshot: vi.fn(),
}));

vi.mock("@/lib/pocketbase/server", () => ({
  requirePocketBaseAdmin: mocks.requireAdmin,
  createPocketBaseServiceClient: mocks.createServiceClient,
}));

vi.mock("@/lib/report/snapshot", () => ({
  readConsistentReportSnapshot: mocks.readSnapshot,
}));

import { GET } from "@/app/api/exports/[kind]/[format]/route";

describe("admin export Route Handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createServiceClient.mockResolvedValue({});
    mocks.requireAdmin.mockImplementation(async (authorization: string | null) => {
      if (!authorization) throw new Response("Falta autenticación.", { status: 401 });
      if (authorization === "Bearer candidate") {
        throw new Response("Se requieren permisos de administrador.", { status: 403 });
      }
      return { user: { id: "admin", isAdmin: true } };
    });
  });

  it("rejects an anonymous request before reading report data", async () => {
    const response = await GET(
      new Request("https://app.example/api/exports/candidates/csv"),
      { params: Promise.resolve({ kind: "candidates", format: "csv" }) },
    );
    expect(response.status).toBe(401);
    expect(mocks.readSnapshot).not.toHaveBeenCalled();
  });

  it("rejects a candidate before reading report data", async () => {
    const response = await GET(
      new Request("https://app.example/api/exports/candidates/csv", {
        headers: { Authorization: "Bearer candidate" },
      }),
      { params: Promise.resolve({ kind: "candidates", format: "csv" }) },
    );
    expect(response.status).toBe(403);
    expect(mocks.readSnapshot).not.toHaveBeenCalled();
  });

  it("returns a complete CSV to an administrator", async () => {
    mocks.readSnapshot.mockResolvedValue({
      generatedAtUtc: "2026-08-29T12:00:00.000Z",
      candidates: [{
        id: "c1", firstName: "Ana", lastName: "Pérez",
        email: "ana@example.com", ftcaStatus: "confirmed", active: true,
        reviewStatus: "rejected", rejectionReason: "privado", reviewedBy: "admin-secret", sha256: "hash-secret",
      }],
      teams: [],
      memberships: [],
      invitations: [],
    });
    const response = await GET(
      new Request("https://app.example/api/exports/candidates/csv", {
        headers: { Authorization: "Bearer admin" },
      }),
      { params: Promise.resolve({ kind: "candidates", format: "csv" }) },
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/csv");
    expect(response.headers.get("x-generated-at-argentina")).toBeTruthy();
    const csv = await response.text();
    expect(csv).toContain(
      "Ana Pérez,ana@example.com,confirmed,true,disponible",
    );
    expect(csv).not.toContain("privado");
    expect(csv).not.toContain("admin-secret");
    expect(csv).not.toContain("hash-secret");
    expect(mocks.readSnapshot).toHaveBeenCalledTimes(1);
  });
});
