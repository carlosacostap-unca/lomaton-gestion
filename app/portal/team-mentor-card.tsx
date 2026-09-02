"use client";

import { useEffect, useMemo, useState } from "react";

import { callLomatonApi } from "@/lib/pocketbase/browser-api";
import { filterMentorInviteOptions } from "@/lib/ui/invite-option-filter";

type Mentor = { id: string; fullName: string; department: string; externalDescription: string };
type State = { assignment: { id: string; mentor: Mentor | null } | null; invitations: Array<{ id: string; status: string; mentor: Mentor | null }> };

export function TeamMentorCard({ teamId, formationOpen }: { teamId: string; formationOpen: boolean }) {
  const [state, setState] = useState<State | null>(null);
  const [eligible, setEligible] = useState<Mentor[]>([]);
  const [mentorId, setMentorId] = useState("");
  const [mentorQuery, setMentorQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const filteredMentors = useMemo(
    () => filterMentorInviteOptions(eligible, mentorQuery),
    [eligible, mentorQuery],
  );

  async function load() {
    const [nextState, nextEligible] = await Promise.all([
      callLomatonApi<State>(`/api/lomaton/teams/${teamId}/mentor`),
      callLomatonApi<Mentor[]>(`/api/lomaton/mentors/eligible?teamId=${encodeURIComponent(teamId)}`),
    ]);
    setState(nextState);
    setEligible(nextEligible);
    setMentorId("");
  }
  useEffect(() => {
    let active = true;
    Promise.all([
      callLomatonApi<State>(`/api/lomaton/teams/${teamId}/mentor`),
      callLomatonApi<Mentor[]>(`/api/lomaton/mentors/eligible?teamId=${encodeURIComponent(teamId)}`),
    ]).then(([nextState, nextEligible]) => {
      if (active) { setState(nextState); setEligible(nextEligible); }
    }).catch((error) => { if (active) setMessage(error instanceof Error ? error.message : "No se pudo cargar la mentoría."); });
    return () => { active = false; };
  }, [teamId]);

  async function command(path: string, method: string, body?: unknown, success = "Operación realizada.") {
    setBusy(true); setMessage("");
    try { await callLomatonApi(path, { method, body }); await load(); setMessage(success); }
    catch (error) { setMessage(error instanceof Error ? error.message : "No se pudo realizar la operación."); }
    finally { setBusy(false); }
  }

  function updateMentorQuery(query: string) {
    setMentorQuery(query);
    if (
      mentorId &&
      !filterMentorInviteOptions(eligible, query).some((mentor) => mentor.id === mentorId)
    ) {
      setMentorId("");
    }
  }

  return (
    <section className="panel">
      <h2>Mentoría docente</h2>
      {state?.assignment ? <p><strong>{state.assignment.mentor?.fullName || "Docente asignado"}</strong><br /><span className="muted">{state.assignment.mentor?.department || state.assignment.mentor?.externalDescription}</span></p> : <p className="muted">Tu equipo todavía no tiene mentor. La mentoría no cuenta como integrante ni modifica el requisito FTCA.</p>}
      {!state?.assignment ? <form className="search-form" onSubmit={(event) => { event.preventDefault(); if (mentorId) void command(`/api/lomaton/teams/${teamId}/mentor-invitations`, "POST", { mentorId }, "Invitación docente enviada."); }}>
        <div className="search-field">
          <label htmlFor="mentor-search">Buscar docente</label>
          <input
            id="mentor-search"
            type="search"
            value={mentorQuery}
            onChange={(event) => updateMentorQuery(event.target.value)}
            placeholder="Nombre, departamento o descripción"
            aria-controls="mentor-select"
            aria-describedby="mentor-results"
          />
        </div>
        <p id="mentor-results" className="search-results muted" role="status" aria-live="polite">
          {filteredMentors.length
            ? `${filteredMentors.length} ${filteredMentors.length === 1 ? "docente disponible" : "docentes disponibles"}.`
            : "No hay docentes que coincidan con la búsqueda."}
        </p>
        <div className="select-field">
          <label htmlFor="mentor-select">Docente disponible</label>
          <select id="mentor-select" value={mentorId} required disabled={!filteredMentors.length} onChange={(event) => setMentorId(event.target.value)}>
            <option value="">{filteredMentors.length ? "Seleccionar…" : "Sin coincidencias"}</option>
            {filteredMentors.map((mentor) => <option key={mentor.id} value={mentor.id}>{mentor.fullName}{mentor.department || mentor.externalDescription ? ` · ${mentor.department || mentor.externalDescription}` : ""}</option>)}
          </select>
        </div>
        <button className="primary-button" disabled={busy || !formationOpen || !mentorId}>Invitar</button>
      </form> : null}
      {state?.invitations.filter((item) => item.status === "pending").map((invitation) => <div className="invitation-card" key={invitation.id}><span>{invitation.mentor?.fullName || "Docente"} · pendiente</span><button className="text-button" disabled={busy || !formationOpen} onClick={() => command(`/api/lomaton/mentor-invitations/${invitation.id}`, "DELETE", undefined, "Invitación retirada.")}>Retirar</button></div>)}
      {message ? <div className="alert" role="status">{message}</div> : null}
    </section>
  );
}
