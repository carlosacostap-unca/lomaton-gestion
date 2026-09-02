import { beforeEach, describe, expect, it, vi } from "vitest";
import ExcelJS from "exceljs";

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

  it.each(["csv", "xlsx"] as const)("exports mentor columns separately in %s without private profile data", async (format) => {
    mocks.readSnapshot.mockResolvedValue({
      generatedAtUtc: "2026-09-02T12:00:00.000Z",
      candidates: [{ id: "c1", fullName: "Estudiante Uno", email: "student@example.test", ftcaStatus: "confirmed", active: true }],
      teams: [{ id: "t1", name: "Equipo Uno", status: "draft", memberCount: 1, ftcaConfirmedCount: 1 }],
      memberships: [{ id: "m1", team: "t1", candidate: "c1" }], invitations: [],
      mentors: [{ id: "mentor1", fullName: "Docente Uno", department: "FACEN", email: "private@example.test", dni: "secret-dni" }],
      mentorships: [{ id: "tm1", team: "t1", mentor: "mentor1" }],
      mentorInvitations: [
        { id: "mi1", team: "t1", mentor: "mentor1", status: "accepted" },
        { id: "mi2", team: "t1", mentor: "mentor1", status: "cancelled" },
      ],
    });
    const response = await GET(new Request(`https://app.example/api/exports/teams/${format}`, { headers: { Authorization: "Bearer admin" } }), { params: Promise.resolve({ kind: "teams", format }) });
    expect(response.status).toBe(200);
    if (format === "csv") {
      const csv = await response.text();
      expect(csv).toContain("mentor,departamento_mentor,historial_invitaciones_mentoria");
      expect(csv).toContain("Docente Uno,FACEN");
      expect(csv).toContain("Docente Uno · accepted | Docente Uno · cancelled");
      expect(csv).not.toContain("private@example.test");
      expect(csv).not.toContain("secret-dni");
    } else {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(new Uint8Array(await response.arrayBuffer()) as unknown as ExcelJS.Buffer);
      const values = workbook.getWorksheet("Equipos")?.getSheetValues().flat().join(" | ") || "";
      expect(values).toContain("Mentor");
      expect(values).toContain("Docente Uno");
      expect(values).toContain("Historial de invitaciones de mentoría");
      expect(values).toContain("cancelled");
      expect(values).not.toContain("private@example.test");
      expect(values).not.toContain("secret-dni");
    }
  });
});
