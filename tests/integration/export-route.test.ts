import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { GET } from "@/app/api/exports/[kind]/[format]/route";

const originalEnv = { ...process.env };

describe("admin export Route Handler", () => {
  beforeEach(() => {
    process.env.POCKETBASE_URL = "https://pocketbase.example.edu.ar";
    process.env.ADMIN_EMAILS = "admin@example.edu.ar";
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.unstubAllGlobals();
  });

  it("rejects an anonymous request before reading report data", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const response = await GET(new Request("https://app.example/api/exports/candidates/csv"), {
      params: Promise.resolve({ kind: "candidates", format: "csv" }),
    });
    expect(response.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a candidate before reading report data", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(Response.json({ record: { isAdmin: false } }));
    vi.stubGlobal("fetch", fetchMock);
    const response = await GET(new Request("https://app.example/api/exports/candidates/csv", {
      headers: { Authorization: "Bearer candidate" },
    }), { params: Promise.resolve({ kind: "candidates", format: "csv" }) });
    expect(response.status).toBe(403);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns a complete CSV to an administrator", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json({ record: { isAdmin: true } }))
      .mockResolvedValueOnce(Response.json({
        generatedAtUtc: "2026-08-29T12:00:00.000Z",
        candidates: [{ id: "c1", firstName: "Ana", lastName: "Pérez", email: "ana@example.com", ftcaStatus: "confirmed", active: true }],
        teams: [], memberships: [], invitations: [],
      }));
    vi.stubGlobal("fetch", fetchMock);
    const response = await GET(new Request("https://app.example/api/exports/candidates/csv", {
      headers: { Authorization: "Bearer admin" },
    }), { params: Promise.resolve({ kind: "candidates", format: "csv" }) });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/csv");
    expect(response.headers.get("x-generated-at-argentina")).toBeTruthy();
    expect(await response.text()).toContain("Ana,Pérez,ana@example.com,confirmed,true,disponible");
    expect(fetchMock.mock.calls[1]?.[0]).toBe("https://pocketbase.example.edu.ar/api/lomaton/admin/report-snapshot");
  });
});
