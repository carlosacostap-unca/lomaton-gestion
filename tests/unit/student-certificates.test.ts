// @vitest-environment node

import PocketBase, { ClientResponseError } from "pocketbase";
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

type DomainModule = typeof import("@/lib/domain/student-certificates");
let upsertStudentCertificate: DomainModule["upsertStudentCertificate"];

beforeAll(async () => {
  ({ upsertStudentCertificate } = await import("@/lib/domain/student-certificates"));
});

const actor = { id: "user00000000001" } as never;
const validated = {
  file: new File(["%PDF-1.7\ntest"], "regular.pdf", { type: "application/pdf" }),
  originalName: "regular.pdf",
  safeDownloadName: "regular.pdf",
  sizeBytes: 13,
  sha256: "a".repeat(64),
};

function notFound() {
  return new ClientResponseError({ status: 404, data: { message: "not found" } });
}

function fakePocketBase(
  certificateReads: Array<Record<string, unknown> | null>,
  sendResults: Array<unknown> = [],
) {
  const batches: Array<Array<{ collection: string; method: string; id?: string; data?: unknown; options?: unknown }>> = [];
  const pb = {
    filter: (value: string) => value,
    collection: (name: string) => ({
      getFirstListItem: async () => {
        if (name === "hackathon_settings") return { id: "settings0000001" };
        const next = certificateReads.shift();
        if (!next) throw notFound();
        return next;
      },
    }),
    createBatch: () => {
      const operations: Array<{ collection: string; method: string; id?: string; data?: unknown; options?: unknown }> = [];
      batches.push(operations);
      return {
        collection: (collection: string) => ({
          create: (data: unknown) => operations.push({ collection, method: "create", data }),
          update: (id: string, data: unknown, options?: unknown) => operations.push({ collection, method: "update", id, data, options }),
        }),
        send: async () => {
          const result = sendResults.shift();
          if (result instanceof Error) throw result;
          return [];
        },
      };
    },
  };
  return { pb: pb as unknown as PocketBase, batches };
}

describe("student certificate transactional upsert", () => {
  it("creates the first document with audit and dataVersion in one batch", async () => {
    const stored = { id: "cert00000000001", originalName: "regular.pdf", sizeBytes: 13, sha256: "a".repeat(64), created: "2030-01-01" };
    const { pb, batches } = fakePocketBase([null, stored]);
    await expect(upsertStudentCertificate(pb, actor, "candidate000001", validated)).resolves.toMatchObject({ present: true, originalName: "regular.pdf" });
    expect(batches).toHaveLength(1);
    expect(batches[0]).toEqual(expect.arrayContaining([
      expect.objectContaining({ collection: "student_certificates", method: "create" }),
      expect.objectContaining({ collection: "audit_logs", method: "create" }),
      expect.objectContaining({ collection: "hackathon_settings", method: "update" }),
    ]));
    const audit = batches[0].find((item) => item.collection === "audit_logs");
    const serialized = JSON.stringify(audit?.data);
    expect(serialized).not.toContain("%PDF-");
    expect(serialized).not.toContain("token");
    expect(serialized).not.toContain("http");
  });

  it("replaces using the prior hash as an optimistic concurrency guard", async () => {
    const current = { id: "cert00000000001", originalName: "old.pdf", sizeBytes: 9, sha256: "b".repeat(64), updated: "2029-01-01" };
    const stored = { ...current, originalName: "regular.pdf", sizeBytes: 13, sha256: "a".repeat(64), updated: "2030-01-01" };
    const { pb, batches } = fakePocketBase([current, stored]);
    await upsertStudentCertificate(pb, actor, "candidate000001", validated);
    expect(batches[0]).toContainEqual(expect.objectContaining({
      collection: "student_certificates",
      method: "update",
      options: { query: { expected_sha256: "b".repeat(64) } },
    }));
  });

  it("retries a raced first upload as a guarded replacement", async () => {
    const concurrent = { id: "cert00000000002", originalName: "other.pdf", sizeBytes: 10, sha256: "c".repeat(64), updated: "2030-01-01" };
    const stored = { ...concurrent, originalName: "regular.pdf", sizeBytes: 13, sha256: "a".repeat(64), updated: "2030-01-02" };
    const conflict = new ClientResponseError({ status: 409, data: { message: "unique" } });
    const { pb, batches } = fakePocketBase([null, concurrent, stored], [conflict]);
    await upsertStudentCertificate(pb, actor, "candidate000001", validated);
    expect(batches).toHaveLength(2);
    expect(batches[1]).toContainEqual(expect.objectContaining({
      collection: "student_certificates",
      method: "update",
      id: concurrent.id,
    }));
  });

  it("does not attempt a second transaction for a storage failure", async () => {
    const current = { id: "cert00000000001", originalName: "old.pdf", sizeBytes: 9, sha256: "b".repeat(64) };
    const { pb, batches } = fakePocketBase([current], [new Error("storage unavailable")]);
    await expect(upsertStudentCertificate(pb, actor, "candidate000001", validated)).rejects.toThrow("storage unavailable");
    expect(batches).toHaveLength(1);
  });

  it("never mutates FTCA, memberships or teams", async () => {
    const stored = { id: "cert00000000001", originalName: "regular.pdf", sizeBytes: 13, sha256: "a".repeat(64) };
    const { pb, batches } = fakePocketBase([null, stored]);
    await upsertStudentCertificate(pb, actor, "candidate000001", validated);
    const collections = batches.flat().map((item) => item.collection);
    expect(collections).not.toEqual(expect.arrayContaining(["candidates", "team_memberships", "teams"]));
  });
});
