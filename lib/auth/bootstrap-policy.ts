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

export type BootstrapRegistration = {
  id: string;
  fullName: string;
  relationship: "student_ftca" | "student_external" | "teacher";
};

export type BootstrapMentor = {
  id: string;
  registration: string;
  active: boolean;
};

export type ParticipantRole = "student" | "teacher" | "admin";

export function normalizeEmail(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

export function evaluateBootstrapAccess(input: {
  email: unknown;
  verified: boolean;
  currentDisplayName?: string;
  candidate?: BootstrapCandidate | null;
  registration?: BootstrapRegistration | null;
  mentor?: BootstrapMentor | null;
  admin?: BootstrapAdmin | null;
}) {
  const email = normalizeEmail(input.email);
  const candidate = input.candidate?.active ? input.candidate : null;
  const admin = input.admin?.active ? input.admin : null;
  const registration = input.registration ?? null;
  const student = registration && registration.relationship !== "teacher" && candidate
    ? registration
    : null;
  const teacher = registration?.relationship === "teacher" && input.mentor?.active && input.mentor.registration === registration.id
    ? registration
    : null;

  if (!email || !input.verified) {
    return { allowed: false as const, reason: "email_not_verified", email };
  }
  if (!student && !teacher && !admin) {
    return { allowed: false as const, reason: "email_not_authorized", email };
  }

  const candidateName = student && candidate
    ? candidate.fullName?.trim() || `${candidate.firstName ?? ""} ${candidate.lastName ?? ""}`.trim()
    : "";
  return {
    allowed: true as const,
    reason: "authorized",
    email,
    patch: {
      candidate: student && candidate ? candidate.id : "",
      registration: student?.id ?? teacher?.id ?? "",
      isAdmin: Boolean(admin),
      enabled: true,
      displayName: registration?.fullName?.trim() || candidateName || input.currentDisplayName?.trim() || email,
    },
    participantRole: (student ? "student" : teacher ? "teacher" : "admin") as ParticipantRole,
  };
}
