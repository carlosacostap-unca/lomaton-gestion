// @vitest-environment node

import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const policy = require("../../pocketbase/pb_hooks/lib/auth-policy.cjs") as {
  evaluateGoogleAccess: (input: Record<string, unknown>) => Record<string, unknown>;
};

describe("Google OAuth hook policy for jurors", () => {
  it("allows an imported juror and returns its relation id", () => {
    expect(policy.evaluateGoogleAccess({
      provider: "google",
      email: "jury@example.test",
      juror: { id: "juror1" },
    })).toMatchObject({ allowed: true, jurorId: "juror1", candidateId: "", isAdmin: false });
  });

  it("does not allow an unregistered identity", () => {
    expect(policy.evaluateGoogleAccess({ provider: "google", email: "unknown@example.test" }))
      .toMatchObject({ allowed: false, reason: "email_not_authorized" });
  });
});
