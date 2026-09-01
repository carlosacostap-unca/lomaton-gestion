export type BootstrapCandidate = {
  id: string;
  fullName?: string;
  firstName?: string;
  lastName?: string;
  active: boolean;
};

export type BootstrapAdmin = {
  id: string;
  active: boolean;
};

export function normalizeEmail(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

export function evaluateBootstrapAccess(input: {
  email: unknown;
  verified: boolean;
  currentDisplayName?: string;
  candidate?: BootstrapCandidate | null;
  admin?: BootstrapAdmin | null;
}) {
  const email = normalizeEmail(input.email);
  const candidate = input.candidate?.active ? input.candidate : null;
  const admin = input.admin?.active ? input.admin : null;

  if (!email || !input.verified) {
    return { allowed: false as const, reason: "email_not_verified", email };
  }
  if (!candidate && !admin) {
    return { allowed: false as const, reason: "email_not_authorized", email };
  }

  const candidateName = candidate
    ? candidate.fullName?.trim() || `${candidate.firstName ?? ""} ${candidate.lastName ?? ""}`.trim()
    : "";
  return {
    allowed: true as const,
    reason: "authorized",
    email,
    patch: {
      candidate: candidate?.id ?? "",
      isAdmin: Boolean(admin),
      enabled: true,
      displayName: candidateName || input.currentDisplayName?.trim() || email,
    },
  };
}
