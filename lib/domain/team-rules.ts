export type TeamProjection = {
  memberCount: number;
  ftcaConfirmedCount: number;
  status: "draft" | "missing_ftca" | "complete" | "invalid";
};

export function normalizeTeamName(value: unknown) {
  const display = String(value ?? "").trim().replace(/\s+/g, " ");
  return { display, normalized: display.toLowerCase() };
}

export function projectTeam(ftcaStatuses: string[]): TeamProjection {
  const memberCount = ftcaStatuses.length;
  const ftcaConfirmedCount = ftcaStatuses.filter(
    (status) => status === "confirmed",
  ).length;
  let status: TeamProjection["status"] = "draft";
  if (memberCount > 4) status = "invalid";
  else if (memberCount >= 3 && ftcaConfirmedCount === 0) status = "missing_ftca";
  else if (memberCount >= 3) status = "complete";
  return { memberCount, ftcaConfirmedCount, status };
}
