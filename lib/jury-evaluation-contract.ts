export const LEGACY_JURY_CRITERIA_VERSION = "lomaton-2026-v1" as const;
export const PLANILLA_JURY_CRITERIA_VERSION = "lomaton-2026-planilla-v2" as const;
export const CURRENT_JURY_CRITERIA_VERSION = PLANILLA_JURY_CRITERIA_VERSION;
export const MAX_ASPECT_OBSERVATION_LENGTH = 1000;

export const JURY_CRITERIA = [
  { key: "innovation", field: "scoreInnovation", label: "Innovación y originalidad", weight: 25 },
  { key: "impact", field: "scoreImpact", label: "Impacto potencial", weight: 25 },
  { key: "viability", field: "scoreViability", label: "Viabilidad técnica", weight: 20 },
  { key: "presentation", field: "scorePresentation", label: "Presentación y comunicación", weight: 15 },
  { key: "teamwork", field: "scoreTeamwork", label: "Trabajo en equipo", weight: 15 },
] as const;

export type CriterionKey = typeof JURY_CRITERIA[number]["key"];

export const JURY_SCORE_SCALE = [
  { value: 1, label: "Muy bajo / insuficiente" },
  { value: 2, label: "Bajo" },
  { value: 3, label: "Adecuado" },
  { value: 4, label: "Muy bueno" },
  { value: 5, label: "Excelente" },
] as const;

export const JURY_PLANILLA_CRITERIA = [
  {
    key: "innovation",
    label: "Innovación y originalidad",
    weight: 25,
    aspects: [
      { key: "innovationNovelty", label: "Grado de novedad de la propuesta frente al desafío" },
      { key: "innovationDifferentiation", label: "Diferenciación respecto de alternativas convencionales" },
      { key: "innovationIntegration", label: "Integración original de ideas, tecnologías o enfoques" },
    ],
  },
  {
    key: "impact",
    label: "Impacto potencial",
    weight: 25,
    aspects: [
      { key: "impactRelevance", label: "Relevancia del problema que busca resolver" },
      { key: "impactContribution", label: "Aporte económico, social, ambiental y/o productivo" },
      { key: "impactMeasurability", label: "Posibilidad de medir y sostener el impacto esperado" },
    ],
  },
  {
    key: "viability",
    label: "Viabilidad técnica",
    weight: 20,
    aspects: [
      { key: "viabilityCoherence", label: "Coherencia técnica entre problema y solución" },
      { key: "viabilityResources", label: "Factibilidad de acceso a recursos, tecnologías y conocimientos necesarios" },
      { key: "viabilityRisks", label: "Identificación de riesgos o aspectos por validar" },
    ],
  },
  {
    key: "presentation",
    label: "Presentación y comunicación",
    weight: 15,
    aspects: [
      { key: "presentationClarity", label: "Claridad para explicar problema, solución y funcionamiento" },
      { key: "presentationSynthesis", label: "Organización y capacidad de síntesis en el tiempo disponible" },
      { key: "presentationEvidence", label: "Calidad y utilidad de recursos visuales/evidencias" },
    ],
  },
  {
    key: "teamwork",
    label: "Trabajo en equipo",
    weight: 15,
    aspects: [
      { key: "teamworkIntegration", label: "Integración de conocimientos, disciplinas y perspectivas diversas" },
    ],
  },
] as const;

export type AspectKey = typeof JURY_PLANILLA_CRITERIA[number]["aspects"][number]["key"];
export type JuryCriteriaVersion =
  | typeof LEGACY_JURY_CRITERIA_VERSION
  | typeof PLANILLA_JURY_CRITERIA_VERSION;
export type JuryScores = Partial<Record<CriterionKey, number>>;
export type JuryAspectScores = Partial<Record<AspectKey, number>>;
export type JuryAspectObservations = Partial<Record<AspectKey, string>>;
export type EvaluationStatus = "pending" | "draft" | "finalized";

export const JURY_PLANILLA_ASPECTS = JURY_PLANILLA_CRITERIA.flatMap((criterion) =>
  criterion.aspects.map((aspect) => ({
    ...aspect,
    criterionKey: criterion.key,
    criterionLabel: criterion.label,
    weight: criterion.weight,
  })),
);

export const JURY_PLANILLA_RUBRIC = {
  version: PLANILLA_JURY_CRITERIA_VERSION,
  scoreMinimum: 1,
  scoreMaximum: 5,
  scale: JURY_SCORE_SCALE,
  criteria: JURY_PLANILLA_CRITERIA,
} as const;

export type JuryPlanillaRubric = typeof JURY_PLANILLA_RUBRIC;

export function isPlanillaCriteriaVersion(value: unknown): value is typeof PLANILLA_JURY_CRITERIA_VERSION {
  return value === PLANILLA_JURY_CRITERIA_VERSION;
}

export function normalizeCriteriaVersion(value: unknown): JuryCriteriaVersion {
  return isPlanillaCriteriaVersion(value)
    ? PLANILLA_JURY_CRITERIA_VERSION
    : LEGACY_JURY_CRITERIA_VERSION;
}

export function isAspectKey(value: string): value is AspectKey {
  return JURY_PLANILLA_ASPECTS.some((aspect) => aspect.key === value);
}

export function roundFractionTo2(numerator: number, denominator: number) {
  if (!Number.isSafeInteger(numerator) || !Number.isSafeInteger(denominator) || denominator <= 0) {
    throw new RangeError("La fracción debe usar enteros seguros y un denominador positivo.");
  }
  return Math.floor((numerator * 200 + denominator) / (denominator * 2)) / 100;
}

function gcd(left: number, right: number) {
  let a = Math.abs(left);
  let b = Math.abs(right);
  while (b) [a, b] = [b, a % b];
  return a || 1;
}

export function calculatePlanillaEvaluation(scores: Record<AspectKey, number>) {
  const criterionAverages = {} as Record<CriterionKey, number>;
  const weightedScores = {} as Record<CriterionKey, number>;
  const criterionSums = {} as Record<CriterionKey, number>;
  let totalNumeratorCommon = 0;
  const totalDenominatorCommon = 15;

  for (const criterion of JURY_PLANILLA_CRITERIA) {
    const sum = criterion.aspects.reduce((subtotal, aspect) => {
      const score = scores[aspect.key];
      if (!Number.isInteger(score) || score < 1 || score > 5) {
        throw new RangeError("Los puntajes por aspecto deben ser números enteros entre 1 y 5.");
      }
      return subtotal + score;
    }, 0);
    const aspectCount = criterion.aspects.length;
    criterionSums[criterion.key] = sum;
    criterionAverages[criterion.key] = roundFractionTo2(sum, aspectCount);
    weightedScores[criterion.key] = roundFractionTo2(sum * criterion.weight, aspectCount * 5);
    totalNumeratorCommon += sum * criterion.weight * (totalDenominatorCommon / (aspectCount * 5));
  }

  const divisor = gcd(totalNumeratorCommon, totalDenominatorCommon);
  const totalNumerator = totalNumeratorCommon / divisor;
  const totalDenominator = totalDenominatorCommon / divisor;
  return {
    criterionSums,
    criterionAverages,
    weightedScores,
    totalNumerator,
    totalDenominator,
    total: roundFractionTo2(totalNumerator, totalDenominator),
  };
}

type EvaluationDtoBase = {
  id: string;
  teamId: string;
  teamName: string;
  jurorId?: string;
  jurorName?: string;
  status: EvaluationStatus;
  version: number;
  finalizedAt: string;
};

export type LegacyEvaluationDto = EvaluationDtoBase & {
  criteriaVersion: typeof LEGACY_JURY_CRITERIA_VERSION;
  mode: "v1";
  scores: Record<CriterionKey, number | null>;
  total: number | null;
  completedCriteria: CriterionKey[];
};

export type PlanillaEvaluationDto = EvaluationDtoBase & {
  criteriaVersion: typeof PLANILLA_JURY_CRITERIA_VERSION;
  mode: "v2";
  aspectScores: Record<AspectKey, number | null>;
  aspectObservations: Record<AspectKey, string>;
  criterionAverages: Record<CriterionKey, number | null>;
  weightedScores: Record<CriterionKey, number | null>;
  total: number | null;
  completedAspects: AspectKey[];
};

export type EvaluationDto = LegacyEvaluationDto | PlanillaEvaluationDto;
