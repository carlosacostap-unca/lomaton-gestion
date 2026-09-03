"use client";

import { useEffect, useState } from "react";

import { JURY_CRITERIA, type CriterionKey } from "@/lib/jury-evaluation-contract";
import { callLomatonApi } from "@/lib/pocketbase/browser-api";

type Result =
  | { published: false; teamId: string | null }
  | {
      published: true;
      teamId: string;
      teamName: string;
      jurorCount: number;
      scores: Record<CriterionKey, number>;
      total: number;
      publishedAt: string;
    };

export function StudentEvaluationResult() {
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    callLomatonApi<Result>("/api/lomaton/me/evaluation-result")
      .then((value) => { if (active) setResult(value); })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : "No se pudo consultar el resultado."); });
    return () => { active = false; };
  }, []);

  if (error) return <section className="panel"><h2>Resultado de la evaluación</h2><div className="alert" role="alert">{error}</div></section>;
  if (!result) return <section className="panel" aria-live="polite">Consultando resultado de evaluación…</section>;
  if (!result.published) {
    return (
      <section className="panel">
        <h2>Resultado de la evaluación</h2>
        <p className="muted">{result.teamId ? "Los resultados todavía no fueron publicados por la administración." : "Cuando formes parte de un equipo, aquí podrás ver su resultado una vez publicado."}</p>
      </section>
    );
  }

  return (
    <section className="panel evaluation-result-card">
      <p className="eyebrow">Resultado publicado</p>
      <div className="section-heading"><h2>{result.teamName}</h2><strong className="evaluation-result-total">{result.total.toFixed(2)} / 10</strong></div>
      <p className="muted">Promedio consolidado de {result.jurorCount} evaluadores.</p>
      <dl className="evaluation-result-grid">
        {JURY_CRITERIA.map((criterion) => (
          <div key={criterion.key}><dt>{criterion.label} ({criterion.weight}%)</dt><dd>{result.scores[criterion.key].toFixed(2)}</dd></div>
        ))}
      </dl>
    </section>
  );
}
