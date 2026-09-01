export type CandidateNameRecord = {
  fullName?: unknown;
  firstName?: unknown;
  lastName?: unknown;
  email?: unknown;
};

export function candidateDisplayName(record: unknown) {
  if (!record || typeof record !== "object") return "Candidato";
  const candidate = record as CandidateNameRecord;
  const fullName = String(candidate.fullName ?? "").trim();
  if (fullName) return fullName;
  const legacyName = `${String(candidate.firstName ?? "").trim()} ${String(candidate.lastName ?? "").trim()}`.trim();
  return legacyName || String(candidate.email ?? "").trim() || "Candidato";
}
