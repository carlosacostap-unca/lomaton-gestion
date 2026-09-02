type CandidateInviteOption = {
  id: unknown;
  fullName?: unknown;
  firstName?: unknown;
  lastName?: unknown;
  email?: unknown;
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

export function filterCandidateInviteOptions<T extends CandidateInviteOption>(
  candidates: T[],
  query: string,
) {
  return candidates.filter((candidate) =>
    matchesAuthorizedFields(query, candidateInviteSearchFields(candidate)),
  );
}
