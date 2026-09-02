// @vitest-environment node

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  collectionRulePatches,
  expectedFields,
  mentorInvitationsCollection,
  participantProfileFields,
  participantSelfManagedFields,
  participantUserFields,
  planMentorInvitationCancellation,
  teamMentorshipsCollection,
  technicalRule,
} from "@/tools/pocketbase-mcp/lomaton-schema.mjs";

describe("participant portal PocketBase schema", () => {
  it("adds a private, versioned registration link and bounded self-managed fields", () => {
    expect(expectedFields.users).toContain("registration");
    expect(expectedFields.registrations).toEqual(expect.arrayContaining(["profileVersion", "selfManagedFields", "selfEditedAt"]));
    expect(participantUserFields("registrations-id")[0]).toMatchObject({ type: "relation", collectionId: "registrations-id", maxSelect: 1 });
    expect(participantProfileFields().find((field) => field.name === "selfManagedFields")).toMatchObject({ type: "select", values: participantSelfManagedFields });
    expect(collectionRulePatches.registrations.updateRule).toContain("expected_profile_version");
  });

  it("keeps mentor relations private and enforces one mentor per team", () => {
    const invitations = mentorInvitationsCollection("teams-id", "mentors-id", "users-id");
    const assignments = teamMentorshipsCollection("teams-id", "mentors-id");
    expect(invitations.indexes.join(" ")).toContain("UNIQUE INDEX idx_mentor_invitations_pending_pair");
    expect(assignments.indexes.join(" ")).toContain("UNIQUE INDEX idx_team_mentorships_team");
    expect(assignments.indexes.join(" ")).toContain("INDEX idx_team_mentorships_mentor_lookup");
    expect(assignments.indexes.join(" ")).not.toContain("UNIQUE INDEX idx_team_mentorships_mentor ON");
    for (const name of ["mentor_invitations", "team_mentorships"] as const) {
      expect(collectionRulePatches[name].listRule).not.toBe('@request.auth.id != ""');
      expect(collectionRulePatches[name].createRule).toBe(technicalRule);
    }
  });

  it("plans cancellation only for pending historical mentor invitations", () => {
    const resolvedAt = "2026-09-02T12:00:00.000Z";
    expect(planMentorInvitationCancellation([
      { id: "pending1", status: "pending" },
      { id: "accepted1", status: "accepted" },
      { id: "cancelled1", status: "cancelled" },
    ], resolvedAt)).toEqual([
      { id: "pending1", data: { status: "cancelled", resolvedAt } },
    ]);

    const migration = readFileSync(resolve(
      process.cwd(),
      "pocketbase/pb_migrations/1788321600_admin_managed_mentorships.js",
    ), "utf8");
    expect(migration).toContain('removeIndex("idx_team_mentorships_mentor")');
    expect(migration).toContain('invitation.set("status", "cancelled")');
    expect(migration).toContain("No se puede restaurar la unicidad");
  });

  it("authorizes active teachers through their private mentor projection", () => {
    expect(collectionRulePatches.users.authRule).toContain("mentor_profiles.registration.emailNormalized");
    expect(collectionRulePatches.users.authRule).toContain("mentor_profiles.active");
  });
});
