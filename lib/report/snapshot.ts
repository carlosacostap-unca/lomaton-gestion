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
    const [candidates, teams, memberships, invitations, mentorProfiles, mentorInvitations, mentorships, registrations] = await Promise.all([
      pb.collection("candidates").getFullList({ sort: "fullName" }),
      pb.collection("teams").getFullList({ sort: "name" }),
      pb.collection("team_memberships").getFullList({ sort: "created" }),
      pb.collection("team_invitations").getFullList({ sort: "created" }),
      pb.collection("mentor_profiles").getFullList(),
      pb.collection("mentor_invitations").getFullList({ sort: "created" }),
      pb.collection("team_mentorships").getFullList({ sort: "created" }),
      pb.collection("registrations").getFullList({ sort: "fullName" }),
    ]);
    const after = await pb.collection("hackathon_settings").getOne(before.id);
    if (version === Number(after.dataVersion ?? 0)) {
      const registrationById = new Map(registrations.map((registration) => [registration.id, registration]));
      return {
        generatedAtUtc: new Date().toISOString(),
        candidates,
        teams,
        memberships,
        invitations,
        mentors: mentorProfiles.map((mentor) => {
          const registration = registrationById.get(String(mentor.registration));
          return { id: mentor.id, fullName: String(registration?.fullName || ""), department: String(mentor.department || ""), active: Boolean(mentor.active), mentorInterest: String(mentor.mentorInterest || "") };
        }),
        mentorInvitations,
        mentorships,
      };
    }
  }
  throw new ApiError(
    409,
    "Los datos cambiaron durante la exportación. Intentá nuevamente.",
    "snapshot_changed",
  );
}
