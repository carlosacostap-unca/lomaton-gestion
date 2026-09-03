"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import type { AdminTeamDetailView } from "@/lib/domain/admin-team-views";
import { callLomatonApi } from "@/lib/pocketbase/browser-api";

export function AdminTeamManager({ teamId, backHref = "/admin/equipos" }: { teamId: string; backHref?: string }) {
  const [detail, setDetail] = useState<AdminTeamDetailView | null>(null);
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setDetail(await callLomatonApi<AdminTeamDetailView>(`/api/lomaton/admin/teams/${teamId}`));
  }, [teamId]);

  useEffect(() => {
    let active = true;
    callLomatonApi<AdminTeamDetailView>(`/api/lomaton/admin/teams/${teamId}`)
      .then((value) => { if (active) setDetail(value); })
      .catch((error) => { if (active) setMessage(error instanceof Error ? error.message : "No se pudo cargar el equipo."); });
    return () => { active = false; };
  }, [teamId]);

  async function command(path: string, method: string, body: Record<string, unknown> = {}, success = "Operación realizada.") {
    setBusy(true);
    setMessage("");
    try {
      await callLomatonApi(path, { method, body: { ...body, reason } });
      if (method === "DELETE" && path === `/api/lomaton/admin/teams/${teamId}`) {
        window.location.assign(backHref);
        return;
      }
      await load();
      window.dispatchEvent(new Event("lomaton:data-changed"));
      setMessage(success);
      document.getElementById("team-operation-result")?.focus();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo completar la operación.");
    } finally {
      setBusy(false);
    }
  }

  if (!detail) {
    return <section className="panel"><Link className="text-button" href={backHref}>← Volver a equipos</Link>{message ? <div className="alert" role="alert"><p>{message}</p><button className="secondary-button" type="button" onClick={() => void load()}>Reintentar</button></div> : <p className="muted" role="status">Cargando detalle del equipo…</p>}</section>;
  }

  const { team, challenge, members, invitations, mentorship, availableCandidates, availableMentors } = detail;

  return (
    <section className="panel" aria-labelledby="team-detail-title">
      <Link className="text-button" href={backHref}>← Volver a equipos</Link>
      <div className="section-heading team-detail-heading">
        <div><p className="eyebrow">Detalle del equipo</p><h2 id="team-detail-title" tabIndex={-1}>{String(team.name)}</h2><span className={`status-pill status-${String(team.status)}`}>{String(team.status)}</span></div>
        <button className="danger-button" type="button" disabled={busy} onClick={() => { if (window.confirm(`¿Disolver ${String(team.name)}?`)) void command(`/api/lomaton/admin/teams/${teamId}`, "DELETE", {}, "Equipo disuelto."); }}>Disolver equipo</button>
      </div>
      <p className="muted">Después del cierre, PocketBase exige un motivo para toda intervención. Las acciones quedan auditadas.</p>
      <label className="search-field" htmlFor="admin-reason">Motivo de intervención<input id="admin-reason" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Obligatorio después del cierre" /></label>
      {message ? <div id="team-operation-result" className="alert" role="status" tabIndex={-1}>{message}</div> : null}

      <div className="team-detail-sections">
        <section aria-labelledby="team-general-title"><h3 id="team-general-title">Datos generales</h3>
          <p><strong>Desafío:</strong> {challenge?.title || "Sin seleccionar"}</p>
          <form action={(formData) => command(`/api/lomaton/admin/teams/${teamId}`, "PATCH", { name: formData.get("name"), ownerCandidateId: formData.get("ownerCandidateId") }, "Equipo actualizado.")} className="edit-form">
            <label>Nombre<input name="name" defaultValue={String(team.name)} required minLength={2} maxLength={120} /></label>
            <label>Responsable<select name="ownerCandidateId" defaultValue={String(team.owner)}>{members.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name}</option>)}</select></label>
            <button className="secondary-button" disabled={busy}>Guardar cambios</button>
          </form>
        </section>

        <section aria-labelledby="team-members-title"><h3 id="team-members-title">Integrantes ({members.length})</h3>
          <ul className="member-list">{members.map((candidate) => <li key={candidate.id}><span>{candidate.name} {candidate.ftcaStatus === "confirmed" ? "· FTCA" : ""}{candidate.id === team.owner ? " · responsable" : ""}</span>{candidate.id !== team.owner ? <button className="text-button" type="button" disabled={busy} onClick={() => void command(`/api/lomaton/admin/teams/${teamId}/members/${candidate.id}`, "DELETE", {}, "Miembro retirado.")}>Retirar</button> : null}</li>)}</ul>
          {Number(team.memberCount) < 4 && availableCandidates.length ? <form action={(formData) => command(`/api/lomaton/admin/teams/${teamId}/members/${String(formData.get("candidateId"))}`, "PUT", {}, "Miembro incorporado.")} className="search-form"><select name="candidateId" required aria-label={`Agregar miembro a ${String(team.name)}`}><option value="">Agregar candidato</option>{availableCandidates.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name}</option>)}</select><button className="secondary-button" disabled={busy}>Agregar</button></form> : null}
        </section>

        <section aria-labelledby="team-mentor-title"><h3 id="team-mentor-title">Mentoría</h3>
          <p><strong>Mentor:</strong> {mentorship ? `${mentorship.mentorName}${mentorship.department ? ` · ${mentorship.department}` : ""}` : "Sin asignar"}</p>
          {availableMentors.length ? <form action={(formData) => command(`/api/lomaton/admin/teams/${teamId}/mentor`, "PUT", { mentorId: formData.get("mentorId") }, mentorship ? "Mentoría reemplazada por administración." : "Mentoría asignada por administración.")} className="search-form">
            <select key={mentorship?.mentorId || "unassigned"} name="mentorId" required defaultValue={mentorship?.mentorId || ""} aria-label={`Mentor de ${String(team.name)}`}><option value="">Elegir docente</option>{availableMentors.map((mentor) => <option key={mentor.id} value={mentor.id}>{mentor.name}{mentor.department ? ` · ${mentor.department}` : ""}</option>)}</select>
            <button className="secondary-button" disabled={busy}>{mentorship ? "Reemplazar mentor" : "Asignar mentor"}</button>
          </form> : <p className="muted">No hay docentes activos con interés de mentoría.</p>}
          {mentorship ? <button className="text-button" type="button" disabled={busy} onClick={() => void command(`/api/lomaton/admin/team-mentorships/${mentorship.id}`, "DELETE", {}, "Mentoría retirada por administración.")}>Retirar mentoría</button> : null}
        </section>

        <section aria-labelledby="team-invitations-title"><h3 id="team-invitations-title">Invitaciones pendientes ({invitations.length})</h3>
          {invitations.length ? invitations.map((invitation) => <div className="invitation-card" key={invitation.id}><span>{invitation.candidateName}</span><div className="form-actions"><button className="text-button" type="button" disabled={busy} onClick={() => void command(`/api/lomaton/admin/invitations/${invitation.id}/resolve`, "POST", { resolution: "rejected" }, "Invitación rechazada.")}>Rechazar</button><button className="primary-button" type="button" disabled={busy} onClick={() => void command(`/api/lomaton/admin/invitations/${invitation.id}/resolve`, "POST", { resolution: "accepted" }, "Invitación aceptada por administración.")}>Aceptar</button></div></div>) : <p className="muted">No hay invitaciones pendientes.</p>}
        </section>
      </div>
    </section>
  );
}
