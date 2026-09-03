import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  BrowserApiError,
  callLomatonApi,
  downloadLomatonFile,
  fetchLomatonFile,
  getBrowserAuthorizationHeader,
} from "@/lib/pocketbase/browser-api";
import { getBrowserPocketBase } from "@/lib/pocketbase/client";

describe("PocketBase browser authorization", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_POCKETBASE_URL = "https://pb-lomaton.epixum.com";
    getBrowserPocketBase().authStore.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("formats the PocketBase token as an HTTP Bearer credential", () => {
    getBrowserPocketBase().authStore.save("session-token", null);

    expect(getBrowserAuthorizationHeader()).toBe("Bearer session-token");
  });

  it("rejects requests when the browser has no session", () => {
    expect(() => getBrowserAuthorizationHeader()).toThrowError(
      new BrowserApiError("La sesión venció.", 401),
    );
  });

  it("keeps JSON requests compatible", async () => {
    getBrowserPocketBase().authStore.save("session-token", null);
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json" } }),
    );
    await expect(callLomatonApi("/api/test", { method: "POST", body: { value: 1 } })).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledWith("/api/test", expect.objectContaining({
      body: JSON.stringify({ value: 1 }),
      headers: expect.objectContaining({ "Content-Type": "application/json" }),
    }));
  });

  it("sends FormData without manually setting the multipart boundary", async () => {
    getBrowserPocketBase().authStore.save("session-token", null);
    const body = new FormData();
    body.set("certificate", new File(["%PDF-1.7"], "certificate.pdf", { type: "application/pdf" }));
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ present: true }), { status: 200, headers: { "Content-Type": "application/json" } }),
    );
    await callLomatonApi("/api/certificate", { method: "POST", body });
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.body).toBe(body);
    expect(new Headers(init.headers).has("Content-Type")).toBe(false);
  });

  it("returns an authenticated blob and its UTF-8 filename", async () => {
    getBrowserPocketBase().authStore.save("session-token", null);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("%PDF-1.7", {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": "attachment; filename*=UTF-8''constancia.pdf",
      },
    }));
    const result = await downloadLomatonFile("/api/certificate/download");
    expect(result.filename).toBe("constancia.pdf");
    expect(await result.blob.text()).toBe("%PDF-1.7");
  });

  it.each([401, 403])("reports authenticated file access failures with status %s", async (status) => {
    getBrowserPocketBase().authStore.save("session-token", null);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ message: "Acceso denegado", error: "forbidden" }), {
      status,
      headers: { "Content-Type": "application/json" },
    }));
    await expect(fetchLomatonFile("/api/private.pdf")).rejects.toMatchObject({
      name: "BrowserApiError",
      status,
      code: "forbidden",
      message: "Acceso denegado",
    });
  });
});
