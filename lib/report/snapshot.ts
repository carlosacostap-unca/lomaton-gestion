import "server-only";

import type PocketBase from "pocketbase";

import type { ReportSnapshot } from "@/lib/report/hackathon";
import { ApiError } from "@/lib/server/api-error";

export async function readConsistentReportSnapshot(
  pb: PocketBase,
  maxAttempts = 3,
): Promise<ReportSnapshot> {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const before = await pb
      .collection("hackathon_settings")
      .getFirstListItem(pb.filter("key = {:key}", { key: "default" }));
    const version = Number(before.dataVersion ?? 0);
    const [candidates, teams, memberships, invitations] = await Promise.all([
      pb.collection("candidates").getFullList({ sort: "lastName,firstName" }),
      pb.collection("teams").getFullList({ sort: "name" }),
      pb.collection("team_memberships").getFullList({ sort: "created" }),
      pb.collection("team_invitations").getFullList({ sort: "created" }),
    ]);
    const after = await pb.collection("hackathon_settings").getOne(before.id);
    if (version === Number(after.dataVersion ?? 0)) {
      return {
        generatedAtUtc: new Date().toISOString(),
        candidates,
        teams,
        memberships,
        invitations,
      };
    }
  }
  throw new ApiError(
    409,
    "Los datos cambiaron durante la exportación. Intentá nuevamente.",
    "snapshot_changed",
  );
}
