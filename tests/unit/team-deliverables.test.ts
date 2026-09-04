// @vitest-environment node

import PocketBase, { ClientResponseError } from "pocketbase";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  finalizeOwnDeliverable,
  getAuthorizedDeliverableFile,
  getOwnTeamDeliverable,
  listTeamDeliverables,
  removeOwnDeliverableProduct,
  saveOwnDeliverableFile,
  saveOwnDeliverableLink,
} from "@/lib/domain/team-deliverables";
import type { LomatonUser } from "@/lib/pocketbase/server";

type Item = Record<string, unknown> & { id: string };
type Operation = { collection: string; method: string; id?: string; data?: Record<string, unknown>; options?: unknown };

function notFound() {
  return new ClientResponseError({ status: 404, data: { message: "not found" } });
}

function fakePocketBase(seed: Record<string, Item[]>, sendError?: unknown) {
  const operations: Operation[] = [];
  const send = vi.fn(async () => {
    if (sendError) throw sendError;
  });
  const pb = {
    filter: (template: string, params: Record<string, unknown>) =>
      template.replace(/\{:(\w+)\}/g, (_, key: string) => JSON.stringify(params[key])),
    collection: (name: string) => ({
      getOne: vi.fn(async (id: string) => {
        const item = (seed[name] ?? []).find((candidate) => candidate.id === id);
        if (!item) throw notFound();
        return item;
      }),
      getFirstListItem: vi.fn(async (filter: string) => {
        const item = name === "hackathon_settings"
          ? (seed[name] ?? []).find((entry) => entry.key === "default")
          : name === "team_memberships"
            ? (seed[name] ?? []).find((entry) => filter.includes(JSON.stringify(entry.candidate)))
            : name === "team_deliverables"
              ? (seed[name] ?? []).find((entry) => filter.includes(JSON.stringify(entry.team)))
              : (seed[name] ?? [])[0];
        if (!item) throw notFound();
        return item;
      }),
      getFullList: vi.fn(async ({ sort }: { sort?: string } = {}) => {
        const items = [...(seed[name] ?? [])];
        if (sort === "name") items.sort((a, b) => String(a.name).localeCompare(String(b.name)));
        return items;
      }),
    }),
    createBatch: () => ({
      collection: (name: string) => ({
        create: (data: Record<string, unknown>) => operations.push({ collection: name, method: "create", data }),
        update: (id: string, data: Record<string, unknown>, options?: unknown) => operations.push({ collection: name, method: "update", id, data, options }),
      }),
      send,
    }),
    files: {
      getToken: vi.fn(async () => "protected-token"),
      getURL: vi.fn((_record: Item, filename: string, options: { token: string }) => `https://storage.invalid/${filename}?token=${options.token}`),
    },
  };
  return { pb: pb as unknown as PocketBase, operations, send };
}

const member = {
  id: "user00000000001", candidate: "candidate000001", isAdmin: false, juror: "",
  email: "member@example.test", verified: true, enabled: true,
} as LomatonUser;

function baseSeed(deliverables: Item[] = []) {
  return {
    hackathon_settings: [{
      id: "settings0000001", key: "default", dataVersion: 1,
      deliverablesDeadlineUtc: "2099-12-31T23:59:59.000Z",
    }],
    teams: [
      { id: "team0000000001", name: "Alfa" },
      { id: "team0000000002", name: "Beta" },
    ],
    team_memberships: [{ id: "member000000001", candidate: "candidate000001", team: "team0000000001" }],
    jurors: [{ id: "juror000000001", active: true }],
    team_deliverables: deliverables,
  };
}

function completeRecord(overrides: Partial<Item> = {}): Item {
  return {
    id: "delivery0000001", team: "team0000000001", status: "draft", version: 4,
    presentationMedium: "link", presentationUrl: "https://example.org/slides",
    canvasFile: "canvas_secret.pdf", canvasOriginalName: "canvas.pdf", canvasSizeBytes: 10, canvasMimeType: "application/pdf",
    reportFile: "report_secret.pdf", reportOriginalName: "informe.pdf", reportSizeBytes: 11, reportMimeType: "application/pdf",
    evidenceMedium: "link", evidenceUrl: "https://example.org/repo",
    presentationSha256: "a".repeat(64), canvasSha256: "b".repeat(64),
    updated: "2030-01-01T10:00:00.000Z", ...overrides,
  };
}

describe("team deliverable projections and access", () => {
  it("projects historical teams without a record as sin entrega", async () => {
    const { pb } = fakePocketBase(baseSeed());
    await expect(getOwnTeamDeliverable(pb, member)).resolves.toMatchObject({
      teamId: "team0000000001", lifecycle: "none", summaryStatus: "none", version: 0,
      missingRequired: ["presentation", "canvas", "report", "evidence"], canEdit: true,
    });
  });

  it("lists every team with derived counts and no internal storage data", async () => {
    const { pb } = fakePocketBase(baseSeed([completeRecord()]));
    const result = await listTeamDeliverables(pb);
    expect(result.counts).toEqual({ none: 1, draftIncomplete: 0, draftComplete: 1, finalized: 0 });
    expect(result.items.map((item) => item.teamName)).toEqual(["Alfa", "Beta"]);
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("canvas_secret.pdf");
    expect(serialized).not.toContain("presentationSha256");
    expect(serialized).not.toContain("protected-token");
  });
});

describe("team deliverable mutations", () => {
  it("creates the first link with audit and dataVersion in one batch", async () => {
    const { pb, operations, send } = fakePocketBase(baseSeed());
    await expect(saveOwnDeliverableLink(pb, member, "presentation", "https://example.org/slides", 0))
      .resolves.toMatchObject({ version: 1, lifecycle: "draft" });
    expect(send).toHaveBeenCalledOnce();
    expect(operations).toEqual(expect.arrayContaining([
      expect.objectContaining({ collection: "team_deliverables", method: "create", data: expect.objectContaining({ presentationMedium: "link", version: 1 }) }),
      expect.objectContaining({ collection: "audit_logs", method: "create" }),
      expect.objectContaining({ collection: "hackathon_settings", method: "update" }),
    ]));
    expect(JSON.stringify(operations.find((operation) => operation.collection === "audit_logs"))).not.toContain("https://example.org/slides");
  });

  it("replaces a finalized link by file, clears the link and guards the version", async () => {
    const current = completeRecord({ status: "finalized", finalizedAt: "2030-01-01", finalizedBy: "user00000000001" });
    const { pb, operations } = fakePocketBase(baseSeed([current]));
    const validated = {
      file: new File(["%PDF-1.7\ntest"], "slides.pdf", { type: "application/pdf" }),
      originalName: "slides.pdf", safeDownloadName: "slides.pdf", sizeBytes: 13,
      mimeType: "application/pdf", sha256: "c".repeat(64),
    };
    await saveOwnDeliverableFile(pb, member, "presentation", validated, 4);
    expect(operations).toContainEqual(expect.objectContaining({
      collection: "team_deliverables", method: "update", id: current.id,
      options: { query: { expected_version: 4 } },
      data: expect.objectContaining({ status: "draft", version: 5, presentationMedium: "file", presentationUrl: "", finalizedAt: "" }),
    }));
  });

  it("treats identical writes and absent removals as idempotent", async () => {
    const current = completeRecord();
    const { pb, send } = fakePocketBase(baseSeed([current]));
    await saveOwnDeliverableLink(pb, member, "presentation", "https://example.org/slides", 4);
    await removeOwnDeliverableProduct(pb, member, "video", 4);
    expect(send).not.toHaveBeenCalled();
  });

  it("rejects stale versions, missing deadlines and outsiders", async () => {
    const current = completeRecord();
    const stale = fakePocketBase(baseSeed([current]));
    await expect(saveOwnDeliverableLink(stale.pb, member, "evidence", "https://example.org/new", 3))
      .rejects.toMatchObject({ code: "deliverable_version_conflict" });

    const noDeadlineSeed = baseSeed([current]);
    noDeadlineSeed.hackathon_settings[0].deliverablesDeadlineUtc = "";
    const noDeadline = fakePocketBase(noDeadlineSeed);
    await expect(removeOwnDeliverableProduct(noDeadline.pb, member, "canvas", 4))
      .rejects.toMatchObject({ code: "deliverables_deadline_missing" });

    const outsiderSeed = baseSeed([current]);
    outsiderSeed.team_memberships = [];
    const outsider = fakePocketBase(outsiderSeed);
    await expect(getOwnTeamDeliverable(outsider.pb, member)).rejects.toMatchObject({ code: "team_membership_required" });
  });

  it("finalizes only a complete package and makes repeated finalization idempotent", async () => {
    const current = completeRecord();
    const { pb, operations } = fakePocketBase(baseSeed([current]));
    await expect(finalizeOwnDeliverable(pb, member, 4)).resolves.toMatchObject({ lifecycle: "finalized", version: 5 });
    expect(operations).toContainEqual(expect.objectContaining({
      collection: "team_deliverables", method: "update", data: expect.objectContaining({ status: "finalized", version: 5, finalizedBy: member.id }),
    }));

    const finalized = fakePocketBase(baseSeed([completeRecord({ status: "finalized" })]));
    await finalizeOwnDeliverable(finalized.pb, member, 4);
    expect(finalized.send).not.toHaveBeenCalled();

    const incomplete = fakePocketBase(baseSeed([completeRecord({ reportFile: "" })]));
    await expect(finalizeOwnDeliverable(incomplete.pb, member, 4)).rejects.toMatchObject({
      code: "deliverable_incomplete", details: { missingRequired: ["report"] },
    });
  });
});

describe("protected deliverable downloads", () => {
  it.each([
    member,
    { ...member, candidate: "", isAdmin: true },
    { ...member, candidate: "", juror: "juror000000001" },
  ] as LomatonUser[])("authorizes current member, admin or juror", async (user) => {
    const record = completeRecord();
    const { pb } = fakePocketBase(baseSeed([record]));
    await expect(getAuthorizedDeliverableFile(pb, user, "team0000000001", "canvas")).resolves.toMatchObject({
      originalName: "canvas.pdf", mimeType: "application/pdf", sizeBytes: 10,
      url: expect.stringContaining("protected-token"),
    });
  });

  it("denies an outsider and missing file", async () => {
    const record = completeRecord();
    const seed = baseSeed([record]);
    seed.team_memberships = [];
    const { pb } = fakePocketBase(seed);
    await expect(getAuthorizedDeliverableFile(pb, member, "team0000000001", "canvas"))
      .rejects.toMatchObject({ code: "deliverable_forbidden" });
    await expect(getAuthorizedDeliverableFile(pb, { ...member, isAdmin: true }, "team0000000001", "presentation"))
      .rejects.toMatchObject({ code: "deliverable_file_not_found" });
  });

  it("denies a juror whose role was revoked", async () => {
    const seed = baseSeed([completeRecord()]);
    seed.jurors[0].active = false;
    const { pb } = fakePocketBase(seed);
    await expect(getAuthorizedDeliverableFile(
      pb,
      { ...member, candidate: "", juror: "juror000000001" },
      "team0000000001",
      "canvas",
    )).rejects.toMatchObject({ code: "deliverable_forbidden" });
  });
});
