export const JURY_CRITERIA = [
  { key: "innovation", field: "scoreInnovation", label: "Innovación y originalidad", weight: 25 },
  { key: "impact", field: "scoreImpact", label: "Impacto potencial", weight: 25 },
  { key: "viability", field: "scoreViability", label: "Viabilidad técnica", weight: 20 },
  { key: "presentation", field: "scorePresentation", label: "Presentación y comunicación", weight: 15 },
  { key: "teamwork", field: "scoreTeamwork", label: "Trabajo en equipo", weight: 15 },
] as const;

export type CriterionKey = typeof JURY_CRITERIA[number]["key"];
export type JuryScores = Partial<Record<CriterionKey, number>>;
export type EvaluationStatus = "pending" | "draft" | "finalized";

export type EvaluationDto = {
  id: string;
  teamId: string;
  teamName: string;
  jurorId?: string;
  jurorName?: string;
  status: EvaluationStatus;
  scores: Record<CriterionKey, number | null>;
  total: number | null;
  completedCriteria: CriterionKey[];
  version: number;
  finalizedAt: string;
};
