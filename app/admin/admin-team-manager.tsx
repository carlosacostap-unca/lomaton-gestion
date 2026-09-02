"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { callLomatonApi } from "@/lib/pocketbase/browser-api";
import { candidateDisplayName } from "@/lib/domain/candidate-name";
import type { ReportSnapshot, SnapshotRecord } from "@/lib/report/hackathon";

function candidateName(candidate: SnapshotRecord | undefined) {
  return candidateDisplayName(candidate);
}

export function AdminTeamManager() {
  const [snapshot, setSnapshot] = useState<ReportSnapshot | null>(null);
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setSnapshot(await callLomatonApi<ReportSnapshot>("/api/lomaton/admin/report-snapshot"));
  }, []);

  useEffect(() => {
    let active = true;
    callLomatonApi<ReportSnapshot>("/api/lomaton/admin/report-snapshot")
      .then((data) => { if (active) setSnapshot(data); })
      .catch(() => { if (active) setMessage("No se pudieron cargar los equipos."); });
    const refresh = () => void load();
    window.addEventListener("lomaton:data-changed", refresh);
    return () => { active = false; window.removeEventListener("lomaton:data-changed", refresh); };
  }, [load]);

  async function command(path: string, method: string, body: Record<string, unknown> = {}, success = "Operación realizada.") {
    setBusy(true);
    setMessage("");
    try {
      await callLomatonApi(path, { method, body: { ...body, reason } });
      await load();
      window.dispatchEvent(new Event("lomaton:data-changed"));
      setMessage(success);
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "No se pudo completar la operación.");
    } finally {
      setBusy(false);
    }
  }

  const candidates = useMemo(() => new Map(snapshot?.candidates.map((item) => [item.id, item]) ?? []), [snapshot]);
  const occupied = useMemo(() => new Set(snapshot?.memberships.map((item) => String(item.candidate)) ?? []), [snapshot]);
  const available = snapshot?.candidates.filter((candidate) => candidate.active && !occupied.has(candidate.id)) ?? [];

  return (
    <section className="panel" aria-labelledby="teams-admin-title">
      <h2 id="teams-admin-title">Intervenir equipos</h2>
      <p className="muted">Después del cierre, PocketBase exige un motivo para toda intervención. Las acciones quedan auditadas.</p>
      <label htmlFor="admin-reason">Motivo de intervención</label>
      <input id="admin-reason" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Obligatorio después del cierre" />
      <form action={(formData) => command("/api/lomaton/admin/teams", "POST", { name: formData.get("name"), ownerCandidateId: formData.get("ownerCandidateId") }, "Equipo creado.")} className="search-form">
        <input name="name" required minLength={2} maxLength={120} placeholder="Nombre del nuevo equipo" aria-label="Nombre del nuevo equipo" />
        <select name="ownerCandidateId" required aria-label="Responsable del nuevo equipo"><option value="">Elegir responsable</option>{available.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidateName(candidate)} · {String(candidate.email)}</option>)}</select>
        <button className="primary-button" disabled={busy || available.length === 0}>Crear</button>
      </form>
      {message ? <div className="alert" role="status">{message}</div> : null}
      <div className="team-admin-grid">
        {snapshot?.teams.map((team) => {
          const memberships = snapshot.memberships.filter((item) => item.team === team.id);
          const members = memberships.map((item) => candidates.get(String(item.candidate))).filter(Boolean) as SnapshotRecord[];
          const invitations = snapshot.invitations.filter((item) => item.team === team.id && item.status === "pending");
          const mentorship = snapshot.mentorships.find((item) => item.team === team.id);
          const mentor = mentorship ? snapshot.mentors.find((item) => item.id === mentorship.mentor) : undefined;
          const mentorInvitations = snapshot.mentorInvitations.filter((item) => item.team === team.id && item.status === "pending");
          return <article className="team-admin-card" key={team.id}>
            <div className="section-heading"><div><h3>{String(team.name)}</h3><span className={`status-pill status-${String(team.status)}`}>{String(team.status)}</span></div><button className="danger-button" type="button" disabled={busy} onClick={() => { if (window.confirm(`¿Disolver ${String(team.name)}?`)) void command(`/api/lomaton/admin/teams/${team.id}`, "DELETE", {}, "Equipo disuelto."); }}>Disolver</button></div>
            <form action={(formData) => command(`/api/lomaton/admin/teams/${team.id}`, "PATCH", { name: formData.get("name"), ownerCandidateId: formData.get("ownerCandidateId") }, "Equipo actualizado.")} className="search-form">
              <input name="name" defaultValue={String(team.name)} required minLength={2} maxLength={120} aria-label={`Nombre de ${String(team.name)}`} />
              <select name="ownerCandidateId" defaultValue={String(team.owner)} aria-label={`Responsable de ${String(team.name)}`}>{members.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidateName(candidate)}</option>)}</select>
              <button className="secondary-button" disabled={busy}>Guardar</button>
            </form>
            <ul className="member-list">{members.map((candidate) => <li key={candidate.id}><span>{candidateName(candidate)} {candidate.ftcaStatus === "confirmed" ? "· FTCA" : ""}{candidate.id === team.owner ? " · responsable" : ""}</span>{candidate.id !== team.owner ? <button className="text-button" type="button" disabled={busy} onClick={() => void command(`/api/lomaton/admin/teams/${team.id}/members/${candidate.id}`, "DELETE", {}, "Miembro retirado.")}>Retirar</button> : null}</li>)}</ul>
            <p><strong>Mentor:</strong> {mentor ? `${String(mentor.fullName)}${mentor.department ? ` · ${String(mentor.department)}` : ""}` : "Sin asignar"}</p>
            {mentorship ? <button className="text-button" type="button" disabled={busy} onClick={() => void command(`/api/lomaton/admin/team-mentorships/${mentorship.id}`, "DELETE", {}, "Mentoría retirada por administración.")}>Retirar mentoría</button> : null}
            {mentorInvitations.map((invitation) => { const invited = snapshot.mentors.find((item) => item.id === invitation.mentor); return <div className="invitation-card" key={invitation.id}><span>Invitación docente: {String(invited?.fullName || "Docente")}</span><button className="text-button" type="button" disabled={busy} onClick={() => void command(`/api/lomaton/admin/mentor-invitations/${invitation.id}/resolve`, "POST", {}, "Invitación docente cancelada.")}>Cancelar</button></div>; })}
            {Number(team.memberCount) < 4 && available.length > 0 ? <form action={(formData) => command(`/api/lomaton/admin/teams/${team.id}/members/${String(formData.get("candidateId"))}`, "PUT", {}, "Miembro incorporado.")} className="search-form"><select name="candidateId" required aria-label={`Agregar miembro a ${String(team.name)}`}><option value="">Agregar candidato</option>{available.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidateName(candidate)}</option>)}</select><button className="secondary-button" disabled={busy}>Agregar</button></form> : null}
            {invitations.map((invitation) => <div className="invitation-card" key={invitation.id}><span>Invitación: {candidateName(candidates.get(String(invitation.candidate)))}</span><div className="form-actions"><button className="text-button" type="button" disabled={busy} onClick={() => void command(`/api/lomaton/admin/invitations/${invitation.id}/resolve`, "POST", { resolution: "rejected" }, "Invitación rechazada.")}>Rechazar</button><button className="primary-button" type="button" disabled={busy} onClick={() => void command(`/api/lomaton/admin/invitations/${invitation.id}/resolve`, "POST", { resolution: "accepted" }, "Invitación aceptada por administración.")}>Aceptar</button></div></div>)}
          </article>;
        })}
      </div>
    </section>
  );
}
