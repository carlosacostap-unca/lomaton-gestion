// @vitest-environment node

import { describe, expect, it } from "vitest";

import {
  collectionRulePatches,
  expectedFields,
  mentorInvitationsCollection,
  participantProfileFields,
  participantSelfManagedFields,
  participantUserFields,
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

  it("keeps mentor relations private and enforces exclusivity with unique indexes", () => {
    const invitations = mentorInvitationsCollection("teams-id", "mentors-id", "users-id");
    const assignments = teamMentorshipsCollection("teams-id", "mentors-id");
    expect(invitations.indexes.join(" ")).toContain("UNIQUE INDEX idx_mentor_invitations_pending_pair");
    expect(assignments.indexes.join(" ")).toContain("UNIQUE INDEX idx_team_mentorships_team");
    expect(assignments.indexes.join(" ")).toContain("UNIQUE INDEX idx_team_mentorships_mentor");
    for (const name of ["mentor_invitations", "team_mentorships"] as const) {
      expect(collectionRulePatches[name].listRule).not.toBe('@request.auth.id != ""');
      expect(collectionRulePatches[name].createRule).toBe(technicalRule);
    }
  });

  it("authorizes active teachers through their private mentor projection", () => {
    expect(collectionRulePatches.users.authRule).toContain("mentor_profiles.registration.emailNormalized");
    expect(collectionRulePatches.users.authRule).toContain("mentor_profiles.active");
  });
});
