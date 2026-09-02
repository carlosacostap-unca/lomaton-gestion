"use client";

import { useEffect, useState } from "react";

import { callLomatonApi } from "@/lib/pocketbase/browser-api";

type Mentor = { id: string; fullName: string; department: string; externalDescription: string };
type State = { assignment: { id: string; mentor: Mentor | null } | null; invitations: Array<{ id: string; status: string; mentor: Mentor | null }> };

export function TeamMentorCard({ teamId, formationOpen }: { teamId: string; formationOpen: boolean }) {
  const [state, setState] = useState<State | null>(null);
  const [eligible, setEligible] = useState<Mentor[]>([]);
  const [mentorId, setMentorId] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function load() {
    const [nextState, nextEligible] = await Promise.all([
      callLomatonApi<State>(`/api/lomaton/teams/${teamId}/mentor`),
      callLomatonApi<Mentor[]>(`/api/lomaton/mentors/eligible?teamId=${encodeURIComponent(teamId)}`),
    ]);
    setState(nextState);
    setEligible(nextEligible);
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

  return (
    <section className="panel">
      <h2>Mentoría docente</h2>
      {state?.assignment ? <p><strong>{state.assignment.mentor?.fullName || "Docente asignado"}</strong><br /><span className="muted">{state.assignment.mentor?.department || state.assignment.mentor?.externalDescription}</span></p> : <p className="muted">Tu equipo todavía no tiene mentor. La mentoría no cuenta como integrante ni modifica el requisito FTCA.</p>}
      {!state?.assignment ? <form className="search-form" onSubmit={(event) => { event.preventDefault(); if (mentorId) void command(`/api/lomaton/teams/${teamId}/mentor-invitations`, "POST", { mentorId }, "Invitación docente enviada."); }}>
        <label htmlFor="mentor-select">Docente disponible</label>
        <select id="mentor-select" value={mentorId} required onChange={(event) => setMentorId(event.target.value)}><option value="">Seleccionar…</option>{eligible.map((mentor) => <option key={mentor.id} value={mentor.id}>{mentor.fullName}{mentor.department ? ` · ${mentor.department}` : ""}</option>)}</select>
        <button className="primary-button" disabled={busy || !formationOpen}>Invitar</button>
      </form> : null}
      {state?.invitations.filter((item) => item.status === "pending").map((invitation) => <div className="invitation-card" key={invitation.id}><span>{invitation.mentor?.fullName || "Docente"} · pendiente</span><button className="text-button" disabled={busy || !formationOpen} onClick={() => command(`/api/lomaton/mentor-invitations/${invitation.id}`, "DELETE", undefined, "Invitación retirada.")}>Retirar</button></div>)}
      {message ? <div className="alert" role="status">{message}</div> : null}
    </section>
  );
}
