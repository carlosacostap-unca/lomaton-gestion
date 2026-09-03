export const TEAM_CHALLENGES = [
  {
    id: "problematicas-imagenes",
    title: "Identificación de problemáticas operativas mediante la obtención y análisis de imágenes",
  },
  { id: "transito-planta", title: "Tránsito por planta" },
  { id: "sistemas-medicion", title: "Mejoras en sistemas de medición" },
  {
    id: "consumo-materiales",
    title: "Consumo de materiales en almacenes y control patrimonial",
  },
  {
    id: "edificios-sustentables",
    title: "Edificios sustentables y mejora de espacios",
  },
] as const;

export type TeamChallengeId = (typeof TEAM_CHALLENGES)[number]["id"];
export type TeamChallenge = (typeof TEAM_CHALLENGES)[number];

export const TEAM_CHALLENGE_IDS = TEAM_CHALLENGES.map(
  (challenge) => challenge.id,
) as [TeamChallengeId, ...TeamChallengeId[]];

export function isTeamChallengeId(value: unknown): value is TeamChallengeId {
  return typeof value === "string" && TEAM_CHALLENGE_IDS.includes(value as TeamChallengeId);
}

export function getTeamChallenge(value: unknown): TeamChallenge | null {
  return TEAM_CHALLENGES.find((challenge) => challenge.id === value) ?? null;
}

export function teamChallengeTitle(value: unknown): string {
  return getTeamChallenge(value)?.title ?? "Sin seleccionar";
}
