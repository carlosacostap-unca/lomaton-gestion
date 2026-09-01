// @vitest-environment node

import PocketBase from "pocketbase";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

type RouteModule = typeof import("@/lib/server/certificate-routes");
let proxyStudentCertificate: RouteModule["proxyStudentCertificate"];

beforeAll(async () => {
  ({ proxyStudentCertificate } = await import("@/lib/server/certificate-routes"));
});

afterEach(() => vi.restoreAllMocks());

describe("private certificate download proxy", () => {
  it("streams identical PDF bytes with private defensive headers", async () => {
    const bytes = new TextEncoder().encode("%PDF-1.7\nprivate");
    const pb = {
      filter: (value: string) => value,
      collection: () => ({
        getFirstListItem: async () => ({
          id: "cert00000000001",
          collectionName: "student_certificates",
          certificate: "internal_9f3.pdf",
          originalName: "Constancia José.pdf",
        }),
      }),
      files: {
        getToken: async () => "short-lived-secret",
        getURL: () => "https://pb.example/api/files/private?token=secret",
      },
    } as unknown as PocketBase;
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(bytes, {
      headers: { "Content-Type": "application/octet-stream", "Content-Length": String(bytes.length) },
    }));
    const response = await proxyStudentCertificate(pb, "candidate000001");
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(bytes);
    expect(response.headers.get("Content-Type")).toBe("application/pdf");
    expect(response.headers.get("Content-Disposition")).toContain("attachment");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });
});
