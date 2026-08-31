import { createRequire } from "node:module";

import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const { evaluateGoogleAccess, normalizeEmail } = require(
  "../../pocketbase/pb_hooks/lib/auth-policy.cjs",
) as {
  normalizeEmail: (value: unknown) => string;
  evaluateGoogleAccess: (input: {
    provider: string;
    email: string;
    candidate?: { id: string } | null;
    admin?: { id: string } | null;
  }) => {
    allowed: boolean;
    reason: string;
    email: string;
    candidateId?: string;
    isAdmin?: boolean;
  };
};

describe("Google access policy", () => {
  it("normalizes the imported identity email", () => {
    expect(normalizeEmail("  Alumno@Tecno.UNCA.edu.ar ")).toBe(
      "alumno@tecno.unca.edu.ar",
    );
  });

  it.each([
    {
      label: "candidate",
      candidate: { id: "candidate-1" },
      admin: null,
      candidateId: "candidate-1",
      isAdmin: false,
    },
    {
      label: "administrator",
      candidate: null,
      admin: { id: "admin-1" },
      candidateId: "",
      isAdmin: true,
    },
    {
      label: "mixed identity",
      candidate: { id: "candidate-1" },
      admin: { id: "admin-1" },
      candidateId: "candidate-1",
      isAdmin: true,
    },
  ])("allows a $label", ({ candidate, admin, candidateId, isAdmin }) => {
    const result = evaluateGoogleAccess({
      provider: "google",
      email: "person@example.edu.ar",
      candidate,
      admin,
    });

    expect(result).toMatchObject({ allowed: true, candidateId, isAdmin });
  });

  it("rejects an email outside both allowlists", () => {
    expect(
      evaluateGoogleAccess({
        provider: "google",
        email: "unknown@example.edu.ar",
      }),
    ).toMatchObject({ allowed: false, reason: "email_not_authorized" });
  });

  it("rejects providers other than Google", () => {
    expect(
      evaluateGoogleAccess({
        provider: "github",
        email: "person@example.edu.ar",
        candidate: { id: "candidate-1" },
      }),
    ).toMatchObject({ allowed: false, reason: "provider_not_allowed" });
  });
});
