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
      admin: null,
      expectedCandidate: "candidate-1",
      isAdmin: false,
    },
    {
      label: "administrator",
      candidate: null,
      admin: { id: "admin-1", active: true },
      expectedCandidate: "",
      isAdmin: true,
    },
    {
      label: "mixed identity",
      candidate: { id: "candidate-1", firstName: "Ada", lastName: "Lovelace", active: true },
      admin: { id: "admin-1", active: true },
      expectedCandidate: "candidate-1",
      isAdmin: true,
    },
  ])("allows a $label", ({ candidate, admin, expectedCandidate, isAdmin }) => {
    const result = evaluateBootstrapAccess({
      email: "person@example.edu.ar",
      verified: true,
      candidate,
      admin,
    });

    expect(result).toMatchObject({
      allowed: true,
      patch: { candidate: expectedCandidate, isAdmin, enabled: true },
    });
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
      }),
    ).toMatchObject({ allowed: false, reason: "email_not_verified" });
  });
});
