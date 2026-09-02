export type SnapshotRecord = Record<string, unknown> & { id: string };
export type ReportSnapshot = {
  generatedAtUtc: string;
  candidates: SnapshotRecord[];
  teams: SnapshotRecord[];
  memberships: SnapshotRecord[];
  invitations: SnapshotRecord[];
  mentors: SnapshotRecord[];
  mentorInvitations: SnapshotRecord[];
  mentorships: SnapshotRecord[];
};

export type TeamFilter = "all" | "problematic" | "draft" | "missing_ftca" | "complete" | "invalid";

export function teamWarning(team: SnapshotRecord) {
  if (team.status === "complete") return "";
  if (team.status === "missing_ftca") return "Falta al menos un integrante FTCA confirmado";
  if (team.status === "invalid") return "El equipo supera el máximo de cuatro integrantes";
  return `Faltan ${Math.max(0, 3 - Number(team.memberCount ?? 0))} integrante(s)`;
}

export function summarizeSnapshot(snapshot: ReportSnapshot) {
  const occupied = new Set(snapshot.memberships.map((membership) => String(membership.candidate)));
  const active = snapshot.candidates.filter((candidate) => Boolean(candidate.active));
  return {
    candidates: snapshot.candidates.length,
    activeCandidates: active.length,
    availableCandidates: active.filter((candidate) => !occupied.has(candidate.id)).length,
    teams: snapshot.teams.length,
    completeTeams: snapshot.teams.filter((team) => team.status === "complete").length,
    problematicTeams: snapshot.teams.filter((team) => team.status !== "complete").length,
    pendingInvitations: snapshot.invitations.filter((invitation) => invitation.status === "pending").length,
  };
}

export function filterTeams(teams: SnapshotRecord[], filter: TeamFilter) {
  if (filter === "all") return teams;
  if (filter === "problematic") return teams.filter((team) => team.status !== "complete");
  return teams.filter((team) => team.status === filter);
}
