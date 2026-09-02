import type PocketBase from "pocketbase";
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

type SnapshotModule = typeof import("@/lib/report/snapshot");
let readConsistentReportSnapshot: SnapshotModule["readConsistentReportSnapshot"];

beforeAll(async () => {
  ({ readConsistentReportSnapshot } = await import("@/lib/report/snapshot"));
});

function fakePocketBase(beforeVersions: number[], afterVersions: number[]) {
  let beforeIndex = 0;
  let afterIndex = 0;
  const list = vi.fn(async () => []);
  const settings = {
    getFirstListItem: vi.fn(async () => ({
      id: "default-settings",
      dataVersion: beforeVersions[Math.min(beforeIndex++, beforeVersions.length - 1)],
    })),
    getOne: vi.fn(async () => ({
      id: "default-settings",
      dataVersion: afterVersions[Math.min(afterIndex++, afterVersions.length - 1)],
    })),
  };
  const pb = {
    filter: vi.fn(() => "key='default'"),
    collection: vi.fn((name: string) =>
      name === "hackathon_settings" ? settings : { getFullList: list },
    ),
  } as unknown as PocketBase;
  return { pb, list };
}

describe("consistent report snapshot", () => {
  it("retries when dataVersion changes during the first read", async () => {
    const { pb, list } = fakePocketBase([1, 2], [2, 2]);
    const snapshot = await readConsistentReportSnapshot(pb);
    expect(snapshot.generatedAtUtc).toBeTruthy();
    expect(list).toHaveBeenCalledTimes(16);
  });

  it("fails without returning partial data after repeated changes", async () => {
    const { pb } = fakePocketBase([1, 2, 3], [2, 3, 4]);
    await expect(readConsistentReportSnapshot(pb)).rejects.toMatchObject({
      status: 409,
      code: "snapshot_changed",
    });
  });
});
