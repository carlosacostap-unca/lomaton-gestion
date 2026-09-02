import type PocketBase from "pocketbase";
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

type SnapshotModule = typeof import("@/lib/report/snapshot");
let readConsistentReportSnapshot: SnapshotModule["readConsistentReportSnapshot"];

beforeAll(async () => {
  ({ readConsistentReportSnapshot } = await import("@/lib/report/snapshot"));
});

function fakePocketBase(
  beforeVersions: number[],
  afterVersions: number[],
  records: Record<string, Array<Record<string, unknown> & { id: string }>> = {},
) {
  let beforeIndex = 0;
  let afterIndex = 0;
  const list = vi.fn(async (name: string) => records[name] ?? []);
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
      name === "hackathon_settings" ? settings : { getFullList: () => list(name) },
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

  it("preserves cancelled and resolved mentor invitations only as report history", async () => {
    const historical = [
      { id: "invite1", team: "team1", mentor: "mentor1", status: "accepted" },
      { id: "invite2", team: "team1", mentor: "mentor1", status: "cancelled" },
    ];
    const { pb } = fakePocketBase([4], [4], {
      mentor_invitations: historical,
      team_mentorships: [{ id: "assignment1", team: "team1", mentor: "mentor1" }],
    });
    const snapshot = await readConsistentReportSnapshot(pb);
    expect(snapshot.mentorInvitations).toEqual(historical);
    expect(snapshot.mentorships).toEqual([{ id: "assignment1", team: "team1", mentor: "mentor1" }]);
  });
});
