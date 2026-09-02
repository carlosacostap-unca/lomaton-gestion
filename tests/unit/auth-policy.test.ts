import { describe, expect, it } from "vitest";

import {
  evaluateBootstrapAccess,
  normalizeEmail,
} from "@/lib/auth/bootstrap-policy";

describe("Google access policy", () => {
  it("normalizes the imported identity email", () => {
    expect(normalizeEmail("  Alumno@Tecno.UNCA.edu.ar ")).toBe(
      "alumno@tecno.unca.edu.ar",
    );
  });

  it.each([
    {
      label: "candidate",
      candidate: { id: "candidate-1", firstName: "Ada", lastName: "Lovelace", active: true },
      registration: { id: "registration-1", fullName: "Ada Lovelace", relationship: "student_ftca" as const },
      mentor: null,
      admin: null,
      expectedCandidate: "candidate-1",
      isAdmin: false,
    },
    {
      label: "administrator",
      candidate: null,
      registration: null,
      mentor: null,
      admin: { id: "admin-1", active: true },
      expectedCandidate: "",
      isAdmin: true,
    },
    {
      label: "mixed identity",
      candidate: { id: "candidate-1", firstName: "Ada", lastName: "Lovelace", active: true },
      registration: { id: "registration-1", fullName: "Ada Lovelace", relationship: "student_external" as const },
      mentor: null,
      admin: { id: "admin-1", active: true },
      expectedCandidate: "candidate-1",
      isAdmin: true,
    },
  ])("allows a $label", ({ candidate, registration, mentor, admin, expectedCandidate, isAdmin }) => {
    const result = evaluateBootstrapAccess({
      email: "person@example.edu.ar",
      verified: true,
      candidate,
      registration,
      mentor,
      admin,
    });

    expect(result).toMatchObject({
      allowed: true,
      patch: { candidate: expectedCandidate, isAdmin, enabled: true },
    });
  });

  it("allows an active teacher without candidate permissions", () => {
    expect(evaluateBootstrapAccess({
      email: "teacher@example.edu.ar",
      verified: true,
      registration: { id: "registration-2", fullName: "Grace Hopper", relationship: "teacher" },
      mentor: { id: "mentor-1", registration: "registration-2", active: true },
      candidate: { id: "stale-candidate", active: true },
    })).toMatchObject({
      allowed: true,
      participantRole: "teacher",
      patch: { registration: "registration-2", candidate: "", enabled: true },
    });
  });

  it("cleans stale participant links when only administrator access remains", () => {
    expect(evaluateBootstrapAccess({
      email: "admin@example.edu.ar", verified: true,
      admin: { id: "admin-1", active: true },
      candidate: { id: "candidate-1", active: false },
      registration: { id: "registration-1", fullName: "Old", relationship: "student_ftca" },
    })).toMatchObject({ participantRole: "admin", patch: { candidate: "", registration: "" } });
  });

  it("rejects an email outside both allowlists", () => {
    expect(
      evaluateBootstrapAccess({
        email: "unknown@example.edu.ar",
        verified: true,
      }),
    ).toMatchObject({ allowed: false, reason: "email_not_authorized" });
  });

  it("rejects an email not verified by the provider", () => {
    expect(
      evaluateBootstrapAccess({
        email: "person@example.edu.ar",
        verified: false,
        candidate: { id: "candidate-1", firstName: "Ada", lastName: "Lovelace", active: true },
        registration: { id: "registration-1", fullName: "Ada Lovelace", relationship: "student_ftca" },
      }),
    ).toMatchObject({ allowed: false, reason: "email_not_verified" });
  });
});
