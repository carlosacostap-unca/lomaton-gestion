"use client";

import { useEffect, useState } from "react";

import { callLomatonApi } from "@/lib/pocketbase/browser-api";

type Dashboard = {
  assignment: { id: string; name: string; members: Array<{ id: string; fullName: string }> } | null;
  invitations: Array<{ id: string; status: string; team: { id: string; name: string } }>;
};

export function TeacherDashboard() {
  const [state, setState] = useState<Dashboard | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function load() { setState(await callLomatonApi<Dashboard>("/api/lomaton/me/mentor")); }
  useEffect(() => {
    let active = true;
    callLomatonApi<Dashboard>("/api/lomaton/me/mentor")
      .then((next) => { if (active) setState(next); })
      .catch((error) => { if (active) setMessage(error instanceof Error ? error.message : "No se pudo cargar la mentoría."); });
    return () => { active = false; };
  }, []);
  async function resolve(id: string, action: "accept" | "reject") {
    setBusy(true); setMessage("");
    try { await callLomatonApi(`/api/lomaton/mentor-invitations/${id}/${action}`, { method: "POST" }); await load(); setMessage(action === "accept" ? "Mentoría aceptada." : "Invitación rechazada."); }
    catch (error) { setMessage(error instanceof Error ? error.message : "No se pudo resolver la invitación."); }
    finally { setBusy(false); }
  }
  if (!state) return <section className="panel" aria-live="polite">{message || "Cargando invitaciones…"}</section>;
  return <>
    <section className="panel"><h2>Equipo acompañado</h2>{state.assignment ? <><h3>{state.assignment.name}</h3><ul className="member-list">{state.assignment.members.map((member) => <li key={member.id}>{member.fullName}</li>)}</ul><p className="muted">Se muestran únicamente nombres operativos. Los certificados y datos privados de integrantes no están disponibles para el mentor.</p></> : <p className="muted">Todavía no acompañás a un equipo.</p>}</section>
    <section className="panel"><h2>Invitaciones de mentoría</h2>{state.invitations.filter((item) => item.status === "pending").map((invitation) => <article className="invitation-card" key={invitation.id}><strong>{invitation.team.name}</strong><div className="form-actions"><button className="secondary-button" disabled={busy} onClick={() => resolve(invitation.id, "reject")}>Rechazar</button><button className="primary-button" disabled={busy || Boolean(state.assignment)} onClick={() => resolve(invitation.id, "accept")}>Aceptar</button></div></article>)}{!state.invitations.some((item) => item.status === "pending") ? <p className="muted">No tenés invitaciones pendientes.</p> : null}{message ? <div className="alert" role="status">{message}</div> : null}</section>
  </>;
}
