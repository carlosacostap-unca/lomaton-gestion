"use client";

import { useEffect, useState } from "react";

import {
  calculatePlanillaEvaluation,
  JURY_CRITERIA,
  JURY_PLANILLA_ASPECTS,
  JURY_PLANILLA_CRITERIA,
  JURY_SCORE_SCALE,
  LEGACY_JURY_CRITERIA_VERSION,
  MAX_ASPECT_OBSERVATION_LENGTH,
  PLANILLA_JURY_CRITERIA_VERSION,
  roundFractionTo2,
  type AspectKey,
  type CriterionKey,
  type EvaluationDto,
  type JuryAspectObservations,
  type JuryAspectScores,
  type JuryScores,
} from "@/lib/jury-evaluation-contract";
import { callLomatonApi } from "@/lib/pocketbase/browser-api";
import { JuryDeliverablesPanel } from "./jury-deliverables-panel";

type Dashboard = {
  cycle: null | { id: string; status: string; version: number; criteriaVersion: string };
  evaluations: EvaluationDto[];
  progress: { finalized: number; total: number };
};

type Draft = {
  scores: JuryScores;
  aspectScores: JuryAspectScores;
  aspectObservations: JuryAspectObservations;
};

function initialDraft(evaluation: EvaluationDto): Draft {
  if (evaluation.mode === "v1") {
    return {
      scores: Object.fromEntries(
        JURY_CRITERIA
          .filter((criterion) => evaluation.scores[criterion.key] !== null)
          .map((criterion) => [criterion.key, evaluation.scores[criterion.key]]),
      ),
      aspectScores: {},
      aspectObservations: {},
    };
  }
  return {
    scores: {},
    aspectScores: Object.fromEntries(
      JURY_PLANILLA_ASPECTS
        .filter((aspect) => evaluation.aspectScores[aspect.key] !== null)
        .map((aspect) => [aspect.key, evaluation.aspectScores[aspect.key]]),
    ),
    aspectObservations: Object.fromEntries(
      JURY_PLANILLA_ASPECTS
        .filter((aspect) => evaluation.aspectObservations[aspect.key])
        .map((aspect) => [aspect.key, evaluation.aspectObservations[aspect.key]]),
    ),
  };
}

function legacyPreview(scores: JuryScores) {
  if (!JURY_CRITERIA.every((criterion) => scores[criterion.key] !== undefined)) return null;
  return JURY_CRITERIA.reduce(
    (total, criterion) => total + Number(scores[criterion.key]) * criterion.weight,
    0,
  ) / 100;
}

function planillaPreview(scores: JuryAspectScores) {
  if (!JURY_PLANILLA_ASPECTS.every((aspect) => scores[aspect.key] !== undefined)) return null;
  return calculatePlanillaEvaluation(scores as Record<AspectKey, number>);
}

function criterionPreview(scores: JuryAspectScores, criterionKey: CriterionKey) {
  const criterion = JURY_PLANILLA_CRITERIA.find((item) => item.key === criterionKey);
  if (!criterion || !criterion.aspects.every((aspect) => scores[aspect.key] !== undefined)) return null;
  const sum = criterion.aspects.reduce(
    (total, aspect) => total + Number(scores[aspect.key]),
    0,
  );
  return {
    average: roundFractionTo2(sum, criterion.aspects.length),
    weighted: roundFractionTo2(sum * criterion.weight, criterion.aspects.length * 5),
  };
}

export function JuryDashboard() {
  const [state, setState] = useState<Dashboard | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [selectedId, setSelectedId] = useState("");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function applyLoaded(next: Dashboard) {
    setState(next);
    setDrafts(Object.fromEntries(next.evaluations.map((item) => [item.id, initialDraft(item)])));
    setSelectedId((current) => current && next.evaluations.some((item) => item.id === current)
      ? current
      : next.evaluations.find((item) => item.status !== "finalized")?.id || next.evaluations[0]?.id || "");
  }

  async function load() {
    applyLoaded(await callLomatonApi<Dashboard>("/api/lomaton/jury/evaluations"));
  }

  useEffect(() => {
    let active = true;
    callLomatonApi<Dashboard>("/api/lomaton/jury/evaluations")
      .then((next) => { if (active) applyLoaded(next); })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : "No se pudieron cargar las evaluaciones.");
      });
    return () => { active = false; };
  }, []);

  function updateLegacyScore(evaluationId: string, key: CriterionKey, value: string) {
    setDrafts((current) => {
      const draft = current[evaluationId] || { scores: {}, aspectScores: {}, aspectObservations: {} };
      const scores = { ...draft.scores };
      if (value === "") delete scores[key];
      else scores[key] = Number(value);
      return { ...current, [evaluationId]: { ...draft, scores } };
    });
  }

  function updateAspectScore(evaluationId: string, key: AspectKey, value: string) {
    setDrafts((current) => {
      const draft = current[evaluationId] || { scores: {}, aspectScores: {}, aspectObservations: {} };
      const aspectScores = { ...draft.aspectScores };
      if (value === "") delete aspectScores[key];
      else aspectScores[key] = Number(value);
      return { ...current, [evaluationId]: { ...draft, aspectScores } };
    });
  }

  function updateObservation(evaluationId: string, key: AspectKey, value: string) {
    setDrafts((current) => {
      const draft = current[evaluationId] || { scores: {}, aspectScores: {}, aspectObservations: {} };
      return {
        ...current,
        [evaluationId]: {
          ...draft,
          aspectObservations: { ...draft.aspectObservations, [key]: value },
        },
      };
    });
  }

  async function save(evaluation: EvaluationDto, finalize: boolean) {
    if (finalize && !window.confirm("¿Finalizar esta evaluación? Quedará bloqueada salvo reapertura administrativa.")) return;
    setBusy(evaluation.id);
    setMessage("");
    setError("");
    const draft = drafts[evaluation.id] || { scores: {}, aspectScores: {}, aspectObservations: {} };
    const body = evaluation.mode === "v2"
      ? {
          expectedVersion: evaluation.version,
          criteriaVersion: PLANILLA_JURY_CRITERIA_VERSION,
          aspectScores: draft.aspectScores,
          aspectObservations: draft.aspectObservations,
          finalize,
        }
      : {
          expectedVersion: evaluation.version,
          criteriaVersion: LEGACY_JURY_CRITERIA_VERSION,
          scores: draft.scores,
          finalize,
        };
    try {
      await callLomatonApi("/api/lomaton/jury/evaluations/" + evaluation.id, {
        method: "PATCH",
        body,
      });
      await load();
      setMessage(finalize ? "Evaluación finalizada." : "Borrador guardado.");
      requestAnimationFrame(() => document.getElementById("jury-operation-result")?.focus());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo guardar la evaluación.");
    } finally {
      setBusy("");
    }
  }

  if (!state) {
    return <><JuryDeliverablesPanel /><section className="panel" aria-live="polite">{error || "Cargando evaluaciones…"}{error ? <button className="secondary-button" type="button" onClick={() => { setError(""); void load(); }}>Reintentar</button> : null}</section></>;
  }
  if (!state.cycle) {
    return <><JuryDeliverablesPanel /><section className="panel"><h2>Evaluaciones</h2><p className="muted">La administración todavía no abrió la evaluación.</p></section></>;
  }
  const selected = state.evaluations.find((item) => item.id === selectedId) || state.evaluations[0];
  const selectedDraft = selected ? drafts[selected.id] || initialDraft(selected) : null;
  const selectedLegacyTotal = selected?.mode === "v1" && selectedDraft
    ? legacyPreview(selectedDraft.scores)
    : null;
  const selectedPlanilla = selected?.mode === "v2" && selectedDraft
    ? planillaPreview(selectedDraft.aspectScores)
    : null;
  const selectedLocked = selected?.status === "finalized";

  return (
    <>
      <JuryDeliverablesPanel />
      <section className="deadline-bar">
        <div><span>Tu avance</span><strong>{state.progress.finalized} de {state.progress.total} equipos finalizados</strong></div>
        <span className="status-open">Evaluación abierta</span>
      </section>
      {message ? <div className="alert" id="jury-operation-result" role="status" tabIndex={-1}>{message}</div> : null}
      {error ? <div className="alert" role="alert">{error}</div> : null}
      <section className="panel">
        <p className="eyebrow">Formulario del jurado</p>
        <h2>Equipos a evaluar</h2>
        <p className="muted">
          {state.cycle.criteriaVersion === PLANILLA_JURY_CRITERIA_VERSION
            ? "Calificá cada aspecto con un número entero de 1 a 5. Podés guardar un borrador y finalizar más adelante."
            : "Este ciclo histórico usa un número entero de 0 a 10 por criterio."}
        </p>
        {!selected || !selectedDraft ? <p className="muted">No hay equipos asignados en este ciclo.</p> : (
          <div className="jury-evaluation-workspace">
            <div className="jury-team-list" role="list" aria-label="Equipos a evaluar">
              {state.evaluations.map((evaluation) => (
                <button key={evaluation.id} type="button" className={evaluation.id === selected.id ? "jury-team-button is-selected" : "jury-team-button"} aria-pressed={evaluation.id === selected.id} onClick={() => setSelectedId(evaluation.id)}>
                  <strong>{evaluation.teamName}</strong>
                  <span>{evaluation.status === "finalized" ? "Finalizada" : evaluation.status === "draft" ? "Borrador" : "Pendiente"}</span>
                </button>
              ))}
            </div>
            <fieldset className="jury-evaluation-card" disabled={selectedLocked || busy === selected.id}>
              <legend>{selected.teamName}</legend>
              <span className={selectedLocked ? "student-status is-approved" : selected.status === "draft" ? "student-status is-pending" : "student-status"}>
                {selectedLocked ? "Finalizada" : selected.status === "draft" ? "Borrador" : "Pendiente"}
              </span>

              {selected.mode === "v2" ? (
                <>
                  <div className="jury-scale" aria-label="Escala de evaluación">
                    {JURY_SCORE_SCALE.map((item) => <span key={item.value}><strong>{item.value}</strong> {item.label}</span>)}
                  </div>
                  <div className="jury-criteria-list">
                    {JURY_PLANILLA_CRITERIA.map((criterion) => {
                      const summary = criterionPreview(selectedDraft.aspectScores, criterion.key);
                      return (
                        <section className="jury-criterion-card" key={criterion.key} aria-labelledby={"criterion-" + criterion.key}>
                          <div className="jury-criterion-heading">
                            <h3 id={"criterion-" + criterion.key}>{criterion.label}</h3>
                            <span>{criterion.weight}% · máximo {criterion.weight} puntos</span>
                          </div>
                          <div className="jury-aspect-list">
                            {criterion.aspects.map((aspect) => (
                              <div className="jury-aspect-row" key={aspect.key}>
                                <label>
                                  <span>{aspect.label}</span>
                                  <select aria-label={aspect.label + " — Puntaje"} value={selectedDraft.aspectScores[aspect.key] ?? ""} onChange={(event) => updateAspectScore(selected.id, aspect.key, event.target.value)}>
                                    <option value="">Sin puntuar</option>
                                    {JURY_SCORE_SCALE.map((item) => <option key={item.value} value={item.value}>{item.value} — {item.label}</option>)}
                                  </select>
                                </label>
                                <label>
                                  <span>Observación sobre “{aspect.label}” (opcional)</span>
                                  <textarea rows={2} maxLength={MAX_ASPECT_OBSERVATION_LENGTH} value={selectedDraft.aspectObservations[aspect.key] ?? ""} onChange={(event) => updateObservation(selected.id, aspect.key, event.target.value)} />
                                </label>
                              </div>
                            ))}
                          </div>
                          <dl className="jury-criterion-summary">
                            <div><dt>Promedio</dt><dd>{summary ? summary.average.toFixed(2) + " / 5" : "Incompleto"}</dd></div>
                            <div><dt>Ponderado</dt><dd>{summary ? summary.weighted.toFixed(2) + " / " + criterion.weight : "—"}</dd></div>
                          </dl>
                        </section>
                      );
                    })}
                  </div>
                  <p className="evaluation-total is-sticky">Total ponderado: <strong>{selectedPlanilla ? selectedPlanilla.total.toFixed(2) + " / 100" : "Completá los trece aspectos"}</strong></p>
                </>
              ) : (
                <>
                  <div className="jury-score-grid">
                    {JURY_CRITERIA.map((criterion) => (
                      <label key={criterion.key}>
                        <span>{criterion.label} ({criterion.weight}%)</span>
                        <input type="number" min={0} max={10} step={1} inputMode="numeric" value={selectedDraft.scores[criterion.key] ?? ""} onChange={(event) => updateLegacyScore(selected.id, criterion.key, event.target.value)} />
                      </label>
                    ))}
                  </div>
                  <p className="evaluation-total">Total ponderado: <strong>{selectedLegacyTotal === null ? "Completá los cinco criterios" : selectedLegacyTotal.toFixed(2) + " / 10"}</strong></p>
                </>
              )}

              {!selectedLocked ? (
                <div className="form-actions">
                  <button className="secondary-button" type="button" onClick={() => save(selected, false)}>Guardar borrador</button>
                  <button className="primary-button" type="button" disabled={selected.mode === "v2" ? selectedPlanilla === null : selectedLegacyTotal === null} onClick={() => save(selected, true)}>Finalizar evaluación</button>
                </div>
              ) : <p className="muted">Esta evaluación está bloqueada. La administración puede reabrirla antes de publicar.</p>}
            </fieldset>
          </div>
        )}
      </section>
    </>
  );
}
