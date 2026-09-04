import { describe, expect, it } from "vitest";

import {
  calculatePlanillaEvaluation,
  JURY_PLANILLA_ASPECTS,
  JURY_PLANILLA_CRITERIA,
  JURY_SCORE_SCALE,
  PLANILLA_JURY_CRITERIA_VERSION,
  roundFractionTo2,
  type AspectKey,
} from "@/lib/jury-evaluation-contract";

const all = (value: number) => Object.fromEntries(
  JURY_PLANILLA_ASPECTS.map((aspect) => [aspect.key, value]),
) as Record<AspectKey, number>;

describe("official jury spreadsheet contract", () => {
  it("keeps the exact visible matrix, order, scale, and weights", () => {
    expect(PLANILLA_JURY_CRITERIA_VERSION).toBe("lomaton-2026-planilla-v2");
    expect(JURY_PLANILLA_CRITERIA.map((criterion) => criterion.aspects.length)).toEqual([3, 3, 3, 3, 1]);
    expect(JURY_PLANILLA_CRITERIA.map((criterion) => criterion.weight)).toEqual([25, 25, 20, 15, 15]);
    expect(JURY_PLANILLA_CRITERIA.reduce((sum, criterion) => sum + criterion.weight, 0)).toBe(100);
    expect(JURY_SCORE_SCALE.map((item) => [item.value, item.label])).toEqual([
      [1, "Muy bajo / insuficiente"],
      [2, "Bajo"],
      [3, "Adecuado"],
      [4, "Muy bueno"],
      [5, "Excelente"],
    ]);
    expect(JURY_PLANILLA_ASPECTS.map((aspect) => aspect.label)).toEqual([
      "Grado de novedad de la propuesta frente al desafío",
      "Diferenciación respecto de alternativas convencionales",
      "Integración original de ideas, tecnologías o enfoques",
      "Relevancia del problema que busca resolver",
      "Aporte económico, social, ambiental y/o productivo",
      "Posibilidad de medir y sostener el impacto esperado",
      "Coherencia técnica entre problema y solución",
      "Factibilidad de acceso a recursos, tecnologías y conocimientos necesarios",
      "Identificación de riesgos o aspectos por validar",
      "Claridad para explicar problema, solución y funcionamiento",
      "Organización y capacidad de síntesis en el tiempo disponible",
      "Calidad y utilidad de recursos visuales/evidencias",
      "Integración de conocimientos, disciplinas y perspectivas diversas",
    ]);
  });

  it("calculates exact rational totals and rounds only at the boundary", () => {
    const scores = {
      innovationNovelty: 5,
      innovationDifferentiation: 4,
      innovationIntegration: 3,
      impactRelevance: 4,
      impactContribution: 4,
      impactMeasurability: 4,
      viabilityCoherence: 3,
      viabilityResources: 3,
      viabilityRisks: 3,
      presentationClarity: 5,
      presentationSynthesis: 5,
      presentationEvidence: 4,
      teamworkIntegration: 4,
    } satisfies Record<AspectKey, number>;
    expect(calculatePlanillaEvaluation(scores)).toMatchObject({
      criterionAverages: {
        innovation: 4,
        impact: 4,
        viability: 3,
        presentation: 4.67,
        teamwork: 4,
      },
      weightedScores: {
        innovation: 20,
        impact: 20,
        viability: 12,
        presentation: 14,
        teamwork: 12,
      },
      totalNumerator: 78,
      totalDenominator: 1,
      total: 78,
    });
    expect(calculatePlanillaEvaluation(all(1)).total).toBe(20);
    expect(calculatePlanillaEvaluation(all(5)).total).toBe(100);
    expect(roundFractionTo2(14, 3)).toBe(4.67);
  });

  it("rejects decimal and out-of-range aspect scores", () => {
    expect(() => calculatePlanillaEvaluation({ ...all(3), innovationNovelty: 2.5 })).toThrow(/enteros entre 1 y 5/);
    expect(() => calculatePlanillaEvaluation({ ...all(3), impactRelevance: 0 })).toThrow(/enteros entre 1 y 5/);
    expect(() => calculatePlanillaEvaluation({ ...all(3), teamworkIntegration: 6 })).toThrow(/enteros entre 1 y 5/);
  });
});
