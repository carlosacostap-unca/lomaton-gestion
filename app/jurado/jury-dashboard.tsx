"use client";

import { useEffect, useState } from "react";

import {
  JURY_CRITERIA,
  type CriterionKey,
  type EvaluationDto,
  type JuryScores,
} from "@/lib/jury-evaluation-contract";
import { callLomatonApi } from "@/lib/pocketbase/browser-api";

type Dashboard = {
  cycle: null | { id: string; status: string; version: number };
  evaluations: EvaluationDto[];
  progress: { finalized: number; total: number };
};

function initialScores(evaluation: EvaluationDto): JuryScores {
  const result: JuryScores = {};
  for (const criterion of JURY_CRITERIA) {
    const score = evaluation.scores[criterion.key];
    if (score !== null) result[criterion.key] = score;
  }
  return result;
}

function preview(scores: JuryScores) {
  if (!JURY_CRITERIA.every((criterion) => scores[criterion.key] !== undefined)) return null;
  return JURY_CRITERIA.reduce((total, criterion) => total + Number(scores[criterion.key]) * criterion.weight, 0) / 100;
}

export function JuryDashboard() {
  const [state, setState] = useState<Dashboard | null>(null);
  const [drafts, setDrafts] = useState<Record<string, JuryScores>>({});
  const [selectedId, setSelectedId] = useState("");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    const next = await callLomatonApi<Dashboard>("/api/lomaton/jury/evaluations");
    setState(next);
    setDrafts(Object.fromEntries(next.evaluations.map((item) => [item.id, initialScores(item)])));
    setSelectedId((current) => current && next.evaluations.some((item) => item.id === current)
      ? current
      : next.evaluations.find((item) => item.status !== "finalized")?.id || next.evaluations[0]?.id || "");
  }

  useEffect(() => {
    let active = true;
    callLomatonApi<Dashboard>("/api/lomaton/jury/evaluations")
      .then((next) => {
        if (!active) return;
        setState(next);
        setDrafts(Object.fromEntries(next.evaluations.map((item) => [item.id, initialScores(item)])));
        setSelectedId(next.evaluations.find((item) => item.status !== "finalized")?.id || next.evaluations[0]?.id || "");
      })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : "No se pudieron cargar las evaluaciones."); });
    return () => { active = false; };
  }, []);

  function updateScore(evaluationId: string, key: CriterionKey, value: string) {
    setDrafts((current) => {
      const next = { ...(current[evaluationId] || {}) };
      if (value === "") delete next[key];
      else next[key] = Number(value);
      return { ...current, [evaluationId]: next };
    });
  }

  async function save(evaluation: EvaluationDto, finalize: boolean) {
    if (finalize && !window.confirm("¿Finalizar esta evaluación? Quedará bloqueada salvo reapertura administrativa.")) return;
    setBusy(evaluation.id);
    setMessage("");
    setError("");
    try {
      await callLomatonApi("/api/lomaton/jury/evaluations/" + evaluation.id, {
        method: "PATCH",
        body: { expectedVersion: evaluation.version, scores: drafts[evaluation.id] || {}, finalize },
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

  if (!state) return <section className="panel" aria-live="polite">{error || "Cargando evaluaciones…"}{error ? <button className="secondary-button" type="button" onClick={() => { setError(""); void load(); }}>Reintentar</button> : null}</section>;
  if (!state.cycle) return <section className="panel"><h2>Evaluaciones</h2><p className="muted">La administración todavía no abrió la evaluación.</p></section>;
  const selected = state.evaluations.find((item) => item.id === selectedId) || state.evaluations[0];
  const selectedScores = selected ? drafts[selected.id] || {} : {};
  const selectedTotal = preview(selectedScores);
  const selectedLocked = selected?.status === "finalized";

  return (
    <>
      <section className="deadline-bar">
        <div><span>Tu avance</span><strong>{state.progress.finalized} de {state.progress.total} equipos finalizados</strong></div>
        <span className="status-open">Evaluación abierta</span>
      </section>
      {message ? <div className="alert" id="jury-operation-result" role="status" tabIndex={-1}>{message}</div> : null}
      {error ? <div className="alert" role="alert">{error}</div> : null}
      <section className="panel">
        <p className="eyebrow">Formulario del jurado</p>
        <h2>Equipos a evaluar</h2>
        <p className="muted">Asigná un número entero de 0 a 10 en cada criterio. Podés guardar un borrador y finalizar más adelante.</p>
        {!selected ? <p className="muted">No hay equipos asignados en este ciclo.</p> : (
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
              <div className="jury-score-grid">
                {JURY_CRITERIA.map((criterion) => (
                  <label key={criterion.key}>
                    <span>{criterion.label} ({criterion.weight}%)</span>
                    <input type="number" min={0} max={10} step={1} inputMode="numeric" value={selectedScores[criterion.key] ?? ""} onChange={(event) => updateScore(selected.id, criterion.key, event.target.value)} />
                  </label>
                ))}
              </div>
              <p className="evaluation-total">Total ponderado: <strong>{selectedTotal === null ? "Completá los cinco criterios" : selectedTotal.toFixed(2) + " / 10"}</strong></p>
              {!selectedLocked ? (
                <div className="form-actions">
                  <button className="secondary-button" type="button" onClick={() => save(selected, false)}>Guardar borrador</button>
                  <button className="primary-button" type="button" disabled={selectedTotal === null} onClick={() => save(selected, true)}>Finalizar evaluación</button>
                </div>
              ) : <p className="muted">Esta evaluación está bloqueada. La administración puede reabrirla antes de publicar.</p>}
            </fieldset>
          </div>
        )}
      </section>
    </>
  );
}
