// @vitest-environment node

import { describe, expect, it } from "vitest";

import {
  collectionRulePatches,
  expectedFields,
  technicalRule,
} from "@/tools/pocketbase-mcp/lomaton-schema.mjs";

describe("registration privacy schema", () => {
  it("keeps DNI, phone and form answers out of the authenticated candidate projection", () => {
    const privateFields = [
      "dni",
      "dniNormalized",
      "phone",
      "phoneNormalized",
      "department",
      "academicUnit",
      "career",
      "externalTeacherDescription",
      "declaredTeamMembers",
      "termsAccepted",
      "mediaAuthorized",
      "rawSource",
    ];

    expect(expectedFields.registrations).toEqual(expect.arrayContaining(privateFields));
    expect(expectedFields.candidates).not.toEqual(expect.arrayContaining(privateFields));
  });

  it("allows private registration and mentor reads only to admins or the technical account", () => {
    for (const collectionName of ["registrations", "mentor_profiles"] as const) {
      const rules = collectionRulePatches[collectionName];
      expect(rules.listRule).toContain("@request.auth.isAdmin = true");
      expect(rules.listRule).toContain(technicalRule);
      expect(rules.viewRule).toBe(rules.listRule);
      expect(rules.createRule).toBe(technicalRule);
      expect(rules.updateRule).toBe(technicalRule);
      expect(rules.deleteRule).toBeNull();
    }
  });

  it("exposes only the minimal candidate projection to authenticated users", () => {
    expect(collectionRulePatches.candidates.listRule).toBe('@request.auth.id != ""');
    expect(collectionRulePatches.candidates.viewRule).toBe('@request.auth.id != ""');
    expect(collectionRulePatches.candidates.createRule).toBe(technicalRule);
    expect(collectionRulePatches.candidates.updateRule).toBe(technicalRule);
  });
});
