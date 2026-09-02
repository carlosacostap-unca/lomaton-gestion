type CandidateInviteOption = {
  id: unknown;
  fullName?: unknown;
  firstName?: unknown;
  lastName?: unknown;
  email?: unknown;
};

type MentorInviteOption = {
  id: unknown;
  fullName?: unknown;
  department?: unknown;
  externalDescription?: unknown;
};

export function normalizeInviteSearch(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es")
    .replace(/\s+/g, " ")
    .trim();
}

function matchesAuthorizedFields(query: string, fields: unknown[]) {
  const normalizedQuery = normalizeInviteSearch(query);
  if (!normalizedQuery) return true;
  return normalizeInviteSearch(fields.join(" ")).includes(normalizedQuery);
}

export function candidateInviteSearchFields(candidate: CandidateInviteOption) {
  return [
    candidate.fullName,
    candidate.firstName,
    candidate.lastName,
    candidate.email,
  ];
}

export function mentorInviteSearchFields(mentor: MentorInviteOption) {
  return [
    mentor.fullName,
    mentor.department,
    mentor.externalDescription,
  ];
}

export function filterCandidateInviteOptions<T extends CandidateInviteOption>(
  candidates: T[],
  query: string,
) {
  return candidates.filter((candidate) =>
    matchesAuthorizedFields(query, candidateInviteSearchFields(candidate)),
  );
}

export function filterMentorInviteOptions<T extends MentorInviteOption>(
  mentors: T[],
  query: string,
) {
  return mentors.filter((mentor) =>
    matchesAuthorizedFields(query, mentorInviteSearchFields(mentor)),
  );
}
