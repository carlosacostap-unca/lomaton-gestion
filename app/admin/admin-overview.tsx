"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { callLomatonApi } from "@/lib/pocketbase/browser-api";
import { filterTeams, summarizeSnapshot, teamWarning, type ReportSnapshot, type TeamFilter } from "@/lib/report/hackathon";

const labels: Record<TeamFilter, string> = {
  all: "Todos los equipos",
  problematic: "Incompletos o inválidos",
  draft: "En formación",
  missing_ftca: "Sin FTCA confirmado",
  complete: "Completos",
  invalid: "Inválidos",
};

export function AdminOverview() {
  const [snapshot, setSnapshot] = useState<ReportSnapshot | null>(null);
  const [filter, setFilter] = useState<TeamFilter>("all");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setError("");
      setSnapshot(await callLomatonApi<ReportSnapshot>("/api/lomaton/admin/report-snapshot"));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo cargar el tablero.");
    }
  }, []);

  useEffect(() => {
    let active = true;
    callLomatonApi<ReportSnapshot>("/api/lomaton/admin/report-snapshot")
      .then((data) => { if (active) setSnapshot(data); })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : "No se pudo cargar el tablero."); });
    const refresh = () => void load();
    window.addEventListener("lomaton:data-changed", refresh);
    return () => {
      active = false;
      window.removeEventListener("lomaton:data-changed", refresh);
    };
  }, [load]);

  const summary = useMemo(() => snapshot ? summarizeSnapshot(snapshot) : null, [snapshot]);
  const teams = useMemo(() => snapshot ? filterTeams(snapshot.teams, filter) : [], [snapshot, filter]);

  return (
    <section className="panel" aria-labelledby="overview-title">
      <div className="section-heading">
        <div><h2 id="overview-title">Estado del hackatón</h2><p className="muted">Cifras calculadas sobre una única instantánea de PocketBase.</p></div>
        <button className="secondary-button" type="button" onClick={() => void load()}>Actualizar</button>
      </div>
      {error ? <div className="alert" role="alert">{error}</div> : null}
      {summary ? <>
        <div className="stats-grid">
          <div><strong>{summary.candidates}</strong><span>candidatos</span></div>
          <div><strong>{summary.availableCandidates}</strong><span>disponibles</span></div>
          <div><strong>{summary.teams}</strong><span>equipos</span></div>
          <div><strong>{summary.completeTeams}</strong><span>completos</span></div>
          <div><strong>{summary.problematicTeams}</strong><span>con alertas</span></div>
          <div><strong>{summary.pendingInvitations}</strong><span>invitaciones pendientes</span></div>
        </div>
        <label htmlFor="team-filter">Filtrar equipos</label>
        <select id="team-filter" value={filter} onChange={(event) => setFilter(event.target.value as TeamFilter)}>
          {Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <div className="table-wrap">
          <table><thead><tr><th>Equipo</th><th>Estado</th><th>Miembros</th><th>FTCA</th><th>Observación</th></tr></thead><tbody>
            {teams.map((team) => <tr key={team.id}><td>{String(team.name)}</td><td><span className={`status-pill status-${String(team.status)}`}>{String(team.status)}</span></td><td>{Number(team.memberCount)}</td><td>{Number(team.ftcaConfirmedCount)}</td><td>{teamWarning(team) || "Válido"}</td></tr>)}
            {teams.length === 0 ? <tr><td colSpan={5}>No hay equipos para este filtro.</td></tr> : null}
          </tbody></table>
        </div>
      </> : <p className="muted">Cargando cifras…</p>}
    </section>
  );
}
