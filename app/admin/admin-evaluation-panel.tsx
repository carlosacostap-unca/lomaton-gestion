"use client";

import { useEffect, useMemo, useState } from "react";

import {
  JURY_CRITERIA,
  JURY_PLANILLA_CRITERIA,
  PLANILLA_JURY_CRITERIA_VERSION,
  type EvaluationDto,
} from "@/lib/jury-evaluation-contract";
import { callLomatonApi } from "@/lib/pocketbase/browser-api";

type Dashboard = {
  cycle: null | {
    id: string;
    status: "open" | "cancelled" | "published";
    version: number;
    criteriaVersion: string;
    jurorCount: number;
    teamCount: number;
    requiredCount: number;
    finalizedCount: number;
    openedAt: string;
    publishedAt: string;
  };
  evaluations: EvaluationDto[];
  progress: { finalized: number; total: number; missing: number };
  canPublish: boolean;
};

export function AdminEvaluationPanel() {
  const [state, setState] = useState<Dashboard | null>(null);
  const [reason, setReason] = useState("");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    setState(await callLomatonApi<Dashboard>("/api/lomaton/admin/evaluation"));
  }

  useEffect(() => {
    let active = true;
    callLomatonApi<Dashboard>("/api/lomaton/admin/evaluation")
      .then((value) => { if (active) setState(value); })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : "No se pudo cargar la evaluación."); });
    return () => { active = false; };
  }, []);

  const visible = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("es");
    return (state?.evaluations || []).filter((item) =>
      !normalized || ((item.teamName || "") + " " + (item.jurorName || "")).toLocaleLowerCase("es").includes(normalized),
    );
  }, [query, state]);

  async function command(key: string, path: string, body: unknown, success: string, confirmation = "") {
    if (confirmation && !window.confirm(confirmation)) return;
    setBusy(key);
    setMessage("");
    setError("");
    try {
      await callLomatonApi(path, { method: "POST", body });
      await load();
      setReason("");
      setMessage(success);
    } catch (reasonValue) {
      setError(reasonValue instanceof Error ? reasonValue.message : "No se pudo completar la operación.");
    } finally {
      setBusy("");
    }
  }

  if (!state) return <section className="panel" aria-live="polite">{error || "Cargando evaluación…"}{error ? <button className="secondary-button" type="button" onClick={() => { setError(""); void load(); }}>Reintentar</button> : null}</section>;

  const cycle = state.cycle;
  const isOpen = cycle?.status === "open";
  const completion = state.progress.total ? Math.round(state.progress.finalized * 100 / state.progress.total) : 0;

  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Control administrativo</p>
          <h2>Evaluación</h2>
          <p className="muted">La publicación se habilita únicamente cuando todos los jurados finalizaron todos los equipos.</p>
        </div>
        <span className={isOpen ? "status-open" : "status-closed"}>
          {!cycle ? "Sin ciclo" : cycle.status === "open" ? "Abierta" : cycle.status === "published" ? "Publicada" : "Cancelada"}
        </span>
      </div>
      {message ? <div className="alert" role="status">{message}</div> : null}
      {error ? <div className="alert" role="alert">{error}</div> : null}

      {!isOpen ? (
          <div className="evaluation-actions">
          <p>Al abrir se congela la nómina vigente y la matriz oficial de trece aspectos para todas las combinaciones jurado-equipo.</p>
          <button className="primary-button" disabled={Boolean(busy)} onClick={() => command("open", "/api/lomaton/admin/evaluation/open", {}, "Evaluación abierta.", "¿Abrir la evaluación y congelar la nómina actual de jurados y equipos?")}>Abrir nueva evaluación</button>
        </div>
      ) : (
        <>
          <div className="stats-grid" aria-label="Progreso de evaluación">
            <div><strong>{cycle.jurorCount}</strong><span>jurados</span></div>
            <div><strong>{cycle.teamCount}</strong><span>equipos</span></div>
            <div><strong>{state.progress.finalized}/{state.progress.total}</strong><span>finalizadas ({completion}%)</span></div>
          </div>
          <div className="evaluation-actions">
            <label>Motivo administrativo<input value={reason} maxLength={1000} placeholder="Obligatorio para cancelar o reabrir" onChange={(event) => setReason(event.target.value)} /></label>
            <div className="form-actions">
              <button className="danger-button" disabled={Boolean(busy) || !reason.trim()} onClick={() => command("cancel", "/api/lomaton/admin/evaluation/" + cycle.id + "/cancel", { expectedVersion: cycle.version, reason }, "Evaluación cancelada.", "¿Cancelar este ciclo de evaluación?")}>Cancelar ciclo</button>
              <button className="primary-button" disabled={Boolean(busy) || !state.canPublish} onClick={() => command("publish", "/api/lomaton/admin/evaluation/" + cycle.id + "/publish", { expectedVersion: cycle.version }, "Resultados publicados.", "¿Publicar los resultados para todos los equipos? Esta acción no se puede deshacer.")}>Publicar resultados</button>
            </div>
          </div>
        </>
      )}

      {cycle ? (
        <>
          <label className="student-filter">Filtrar matriz<input type="search" value={query} placeholder="Equipo o jurado" onChange={(event) => setQuery(event.target.value)} /></label>
          <div className="evaluation-list">
            {visible.map((evaluation) => (
              <article className="evaluation-admin-card" key={evaluation.id}>
                <div>
                  <h3>{evaluation.teamName}</h3>
                  <p>{evaluation.jurorName}</p>
                </div>
                <span className={evaluation.status === "finalized" ? "student-status is-approved" : evaluation.status === "draft" ? "student-status is-pending" : "student-status"}>
                  {evaluation.status === "finalized" ? "Finalizada" : evaluation.status === "draft" ? "Borrador" : "Pendiente"}
                </span>
                <dl className="evaluation-score-summary">
                  {evaluation.mode === "v2"
                    ? JURY_PLANILLA_CRITERIA.map((criterion) => <div key={criterion.key}><dt>{criterion.label}</dt><dd>{evaluation.criterionAverages[criterion.key] === null ? "—" : evaluation.criterionAverages[criterion.key]?.toFixed(2) + " / 5"}</dd></div>)
                    : JURY_CRITERIA.map((criterion) => <div key={criterion.key}><dt>{criterion.label}</dt><dd>{evaluation.scores[criterion.key] ?? "—"} / 10</dd></div>)}
                  <div><dt>Total</dt><dd>{evaluation.total === null ? "—" : evaluation.total.toFixed(2) + (evaluation.mode === "v2" ? " / 100" : " / 10")}</dd></div>
                </dl>
                {evaluation.mode === "v2" ? (
                  <details className="evaluation-admin-detail">
                    <summary>Ver detalle de los 13 aspectos</summary>
                    <div className="evaluation-admin-criteria">
                      {JURY_PLANILLA_CRITERIA.map((criterion) => (
                        <section key={criterion.key}>
                          <h4>{criterion.label} · {criterion.weight}%</h4>
                          <dl>
                            {criterion.aspects.map((aspect) => (
                              <div key={aspect.key}>
                                <dt>{aspect.label}</dt>
                                <dd>
                                  <strong>{evaluation.aspectScores[aspect.key] ?? "Sin puntuar"}</strong>
                                  {evaluation.aspectObservations[aspect.key] ? <span>{evaluation.aspectObservations[aspect.key]}</span> : <span className="muted">Sin observación</span>}
                                </dd>
                              </div>
                            ))}
                          </dl>
                          <p>Promedio: <strong>{evaluation.criterionAverages[criterion.key]?.toFixed(2) ?? "—"} / 5</strong> · Ponderado: <strong>{evaluation.weightedScores[criterion.key]?.toFixed(2) ?? "—"} / {criterion.weight}</strong></p>
                        </section>
                      ))}
                    </div>
                  </details>
                ) : (
                  <p className="muted">Ciclo histórico con escala original 0–10.</p>
                )}
                {isOpen && evaluation.status === "finalized" ? <button className="secondary-button" disabled={Boolean(busy) || !reason.trim()} onClick={() => command(evaluation.id, "/api/lomaton/admin/evaluations/" + evaluation.id + "/reopen", { reason }, "Evaluación reabierta.", "¿Reabrir esta evaluación finalizada?")}>Reabrir</button> : null}
              </article>
            ))}
          </div>
        </>
      ) : null}
      {cycle?.criteriaVersion === PLANILLA_JURY_CRITERIA_VERSION ? <p className="muted">Matriz vigente: 13 aspectos, escala 1–5 y total ponderado sobre 100.</p> : cycle ? <p className="muted">Matriz histórica: cinco criterios en escala 0–10.</p> : null}
    </section>
  );
}
