// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const authorized = vi.hoisted(() => vi.fn());
vi.doMock("@/lib/domain/team-deliverables", () => ({ getAuthorizedDeliverableFile: authorized }));

const { proxyDeliverableFile } = await import("@/lib/server/deliverable-routes");

describe("protected deliverable download proxy", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("reauthorizes, streams safe headers, and never exposes the protected token", async () => {
    authorized.mockResolvedValue({
      url: "https://storage.test/file.pdf?token=secret",
      originalName: "informe final.pdf",
      mimeType: "application/pdf",
      sizeBytes: 4,
    });
    const upstream = vi.fn().mockResolvedValue(new Response("%PDF", {
      status: 200,
      headers: { "content-type": "application/pdf", "content-length": "4" },
    }));
    vi.stubGlobal("fetch", upstream);
    const response = await proxyDeliverableFile({} as never, { id: "user1" } as never, "team1", "report");
    expect(authorized).toHaveBeenCalledWith({}, expect.objectContaining({ id: "user1" }), "team1", "report");
    expect(upstream).toHaveBeenCalledWith("https://storage.test/file.pdf?token=secret", { cache: "no-store" });
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("content-disposition")).toContain("informe%20final.pdf");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(JSON.stringify([...response.headers])).not.toContain("secret");
    await expect(response.text()).resolves.toBe("%PDF");
  });

  it("returns an error without redirecting when protected storage fails", async () => {
    authorized.mockResolvedValue({ url: "https://storage.test/missing?token=secret", originalName: "x.pdf", mimeType: "application/pdf", sizeBytes: 1 });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 404 })));
    const response = await proxyDeliverableFile({} as never, { id: "admin", isAdmin: true } as never, "team1", "report");
    expect(response.status).toBe(404);
    expect(response.headers.get("location")).toBeNull();
    expect(await response.text()).not.toContain("secret");
  });
});
