"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import type { AdminTeamListView } from "@/lib/domain/admin-team-views";
import { callLomatonApi } from "@/lib/pocketbase/browser-api";

type TeamStatusFilter = "all" | "problematic" | "draft" | "missing_ftca" | "complete" | "invalid";

const statusOptions: Array<{ value: TeamStatusFilter; label: string }> = [
  { value: "all", label: "Todos los estados" },
  { value: "problematic", label: "Con alertas" },
  { value: "draft", label: "En formación" },
  { value: "missing_ftca", label: "Sin FTCA confirmado" },
  { value: "complete", label: "Completos" },
  { value: "invalid", label: "Inválidos" },
];

function validStatus(value: string): TeamStatusFilter {
  return statusOptions.some((option) => option.value === value) ? value as TeamStatusFilter : "all";
}

function writeListUrl(query: string, status: TeamStatusFilter) {
  const params = new URLSearchParams();
  if (query.trim()) params.set("buscar", query.trim());
  if (status !== "all") params.set("estado", status);
  const next = `/admin/equipos${params.size ? `?${params}` : ""}`;
  window.history.replaceState(null, "", next);
}

function listHref(query: string, status: TeamStatusFilter) {
  const params = new URLSearchParams();
  if (query.trim()) params.set("buscar", query.trim());
  if (status !== "all") params.set("estado", status);
  return params.toString();
}

export function AdminTeamList({ initialQuery = "", initialStatus = "" }: { initialQuery?: string; initialStatus?: string }) {
  const [data, setData] = useState<AdminTeamListView | null>(null);
  const [query, setQuery] = useState(initialQuery);
  const [status, setStatus] = useState<TeamStatusFilter>(validStatus(initialStatus));
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setMessage("");
    setData(await callLomatonApi<AdminTeamListView>("/api/lomaton/admin/teams"));
  }, []);

  useEffect(() => {
    let active = true;
    callLomatonApi<AdminTeamListView>("/api/lomaton/admin/teams")
      .then((value) => { if (active) { setData(value); setMessage(""); } })
      .catch((error) => { if (active) setMessage(error instanceof Error ? error.message : "No se pudieron cargar los equipos."); });
    const refresh = () => void load();
    window.addEventListener("lomaton:data-changed", refresh);
    return () => { active = false; window.removeEventListener("lomaton:data-changed", refresh); };
  }, [load]);

  useEffect(() => {
    const restoreFromHistory = () => {
      const params = new URLSearchParams(window.location.search);
      setQuery(params.get("buscar") || "");
      setStatus(validStatus(params.get("estado") || ""));
    };
    window.addEventListener("popstate", restoreFromHistory);
    return () => window.removeEventListener("popstate", restoreFromHistory);
  }, []);

  const filteredTeams = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("es");
    return (data?.teams ?? []).filter((team) => {
      const matchesText = !normalized || `${team.name} ${team.mentorName} ${team.challenge?.title ?? "Sin seleccionar"}`.toLocaleLowerCase("es").includes(normalized);
      const matchesStatus = status === "all" || (status === "problematic" ? team.status !== "complete" : team.status === status);
      return matchesText && matchesStatus;
    });
  }, [data, query, status]);

  async function createTeam(formData: FormData) {
    setBusy(true);
    setMessage("");
    try {
      await callLomatonApi("/api/lomaton/admin/teams", {
        method: "POST",
        body: { name: formData.get("name"), ownerCandidateId: formData.get("ownerCandidateId"), reason },
      });
      await load();
      window.dispatchEvent(new Event("lomaton:data-changed"));
      setMessage("Equipo creado.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo crear el equipo.");
    } finally {
      setBusy(false);
    }
  }

  const returnQuery = listHref(query, status);

  return (
    <section className="panel" aria-labelledby="teams-admin-title">
      <div className="section-heading">
        <div><h2 id="teams-admin-title">Equipos</h2><p className="muted">Buscá un equipo y entrá a su detalle para intervenirlo.</p></div>
        {data ? <span className="role-chip">{filteredTeams.length} de {data.teams.length}</span> : null}
      </div>
      <div className="team-list-filters">
        <label className="search-field">Buscar equipo o mentor<input type="search" value={query} onChange={(event) => { setQuery(event.target.value); writeListUrl(event.target.value, status); }} placeholder="Ej. Los Innovadores" /></label>
        <label className="select-field">Estado<select value={status} onChange={(event) => { const next = validStatus(event.target.value); setStatus(next); writeListUrl(query, next); }}>{statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
      </div>
      <details className="team-create-panel">
        <summary>Crear un nuevo equipo</summary>
        <form action={createTeam} className="search-form">
          <label>Nombre<input name="name" required minLength={2} maxLength={120} placeholder="Nombre del nuevo equipo" /></label>
          <label>Responsable<select name="ownerCandidateId" required><option value="">Elegir responsable</option>{data?.availableCandidates.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name} · {candidate.email}</option>)}</select></label>
          <label>Motivo de intervención<input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Obligatorio después del cierre" /></label>
          <button className="primary-button" disabled={busy || !data?.availableCandidates.length}>Crear equipo</button>
        </form>
      </details>
      {message ? <div className="alert" role={data ? "status" : "alert"}><p>{message}</p>{!data ? <button className="secondary-button" type="button" onClick={() => void load()}>Reintentar</button> : null}</div> : null}
      {!data && !message ? <p className="muted" role="status">Cargando equipos…</p> : null}
      {data ? <div className="team-summary-list">
        {filteredTeams.map((team) => {
          const detailParams = new URLSearchParams(returnQuery);
          return <article className="team-summary-card" key={team.id}>
            <div><h3>{team.name}</h3><span className={`status-pill status-${team.status}`}>{team.status}</span></div>
            <dl className="team-summary-data">
              <div><dt>Integrantes</dt><dd>{team.memberCount}</dd></div>
              <div><dt>FTCA</dt><dd>{team.ftcaConfirmedCount}</dd></div>
              <div><dt>Mentor</dt><dd>{team.mentorName || "Sin asignar"}</dd></div>
              <div><dt>Desafío</dt><dd>{team.challenge?.title || "Sin seleccionar"}</dd></div>
            </dl>
            <p className={team.warning ? "team-warning" : "muted"}>{team.warning || "Sin alertas"}</p>
            <Link className="secondary-button link-button" href={`/admin/equipos/${team.id}${detailParams.size ? `?${detailParams}` : ""}`}>Ver y gestionar</Link>
          </article>;
        })}
        {filteredTeams.length === 0 ? <div className="empty-detail"><strong>No hay resultados</strong><p className="muted">Probá con otra búsqueda o filtro.</p></div> : null}
      </div> : null}
    </section>
  );
}
