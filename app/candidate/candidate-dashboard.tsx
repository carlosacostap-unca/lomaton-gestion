"use client";

import type { RecordModel } from "pocketbase";
import { useEffect, useState } from "react";

import { getBrowserPocketBase } from "@/lib/pocketbase/client";
import { callLomatonApi } from "@/lib/pocketbase/browser-api";
import { candidateDisplayName } from "@/lib/domain/candidate-name";

type CandidateState = {
  settings: RecordModel;
  membership: RecordModel | null;
  team: RecordModel | null;
  members: RecordModel[];
  receivedInvitations: RecordModel[];
  teamInvitations: RecordModel[];
  availableCandidates: RecordModel[];
  loadedAt: number;
};

async function loadState(candidateId: string): Promise<CandidateState> {
  const pb = getBrowserPocketBase();
  const settings = await pb.collection("hackathon_settings").getFirstListItem("key='default'");
  let membership: RecordModel | null = null;
  try {
    membership = await pb.collection("team_memberships").getFirstListItem(pb.filter("candidate={:id}", { id: candidateId }));
  } catch {
    membership = null;
  }
  const receivedInvitations = await pb.collection("team_invitations").getFullList({
    filter: pb.filter("candidate={:id} && status='pending'", { id: candidateId }),
    expand: "team",
    sort: "created",
  });

  let team: RecordModel | null = null;
  let members: RecordModel[] = [];
  let teamInvitations: RecordModel[] = [];
  if (membership) {
    const loadedTeam = await pb.collection("teams").getOne(membership.team);
    team = loadedTeam;
    members = await pb.collection("team_memberships").getFullList({
      filter: pb.filter("team={:team}", { team: loadedTeam.id }),
      expand: "candidate",
      sort: "created",
    });
    if (loadedTeam.owner === candidateId) {
      teamInvitations = await pb.collection("team_invitations").getFullList({
        filter: pb.filter("team={:team} && status='pending'", { team: loadedTeam.id }),
        expand: "candidate",
        sort: "created",
      });
    }
  }

  const [candidates, memberships] = await Promise.all([
    pb.collection("candidates").getFullList({ filter: "active=true", sort: "fullName" }),
    pb.collection("team_memberships").getFullList(),
  ]);
  const occupied = new Set(memberships.map((item) => String(item.candidate)));
  const availableCandidates = candidates.filter(
    (candidate) => candidate.id !== candidateId && !occupied.has(candidate.id),
  );
  return { settings, membership, team, members, receivedInvitations, teamInvitations, availableCandidates, loadedAt: Date.now() };
}

function candidateName(record: RecordModel | undefined) {
  return candidateDisplayName(record);
}

export function CandidateDashboard({ candidateId }: { candidateId: string }) {
  const [state, setState] = useState<CandidateState | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    loadState(candidateId)
      .then((data) => { if (active) setState(data); })
      .catch(() => { if (active) setMessage("No se pudo cargar el estado del equipo."); });
    return () => { active = false; };
  }, [candidateId]);

  async function refresh(success = "") {
    setState(await loadState(candidateId));
    setMessage(success);
  }

  async function command(path: string, method: string, body?: unknown, success = "Operación realizada.") {
    setBusy(true);
    setMessage("");
    try {
      await callLomatonApi(path, { method, body });
      await refresh(success);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo realizar la operación.");
    } finally {
      setBusy(false);
    }
  }

  if (!state) return <section className="panel">{message || "Cargando información del equipo…"}</section>;
  const deadline = state.settings.deadlineUtc
    ? new Intl.DateTimeFormat("es-AR", { dateStyle: "full", timeStyle: "short", timeZone: "America/Argentina/Buenos_Aires" }).format(new Date(state.settings.deadlineUtc))
    : "Sin fecha configurada";
  const formationOpen = Boolean(state.settings.formationOpen) &&
    (!state.settings.deadlineUtc || new Date(state.settings.deadlineUtc).getTime() > state.loadedAt);

  return (
    <>
      <section className="deadline-bar" aria-label="Plazo de formación">
        <div><span>Plazo (hora argentina)</span><strong>{deadline}</strong></div>
        <span className={formationOpen ? "status-open" : "status-closed"}>{formationOpen ? "Formación abierta" : "Formación cerrada"}</span>
      </section>
      {message ? <div className="alert" role="status">{message}</div> : null}

      {!state.team ? (
        <div className="dashboard-grid">
          <section className="panel">
            <h2>Crear un equipo</h2>
            <p className="muted">Serás el primer integrante y responsable. El equipo será válido con 3 o 4 miembros y al menos un FTCA confirmado.</p>
            <form action={(formData) => command("/api/lomaton/teams", "POST", { name: formData.get("name") }, "Equipo creado.")} className="upload-form">
              <label htmlFor="team-name">Nombre del equipo</label><input id="team-name" name="name" required minLength={2} maxLength={120} />
              <button className="primary-button" disabled={busy || !formationOpen}>Crear equipo</button>
            </form>
          </section>
          <section className="panel">
            <h2>Invitaciones recibidas</h2>
            {state.receivedInvitations.length ? state.receivedInvitations.map((invitation) => (
              <article className="invitation-card" key={invitation.id}>
                <strong>{invitation.expand?.team?.name || "Equipo"}</strong>
                <div className="form-actions"><button className="secondary-button" disabled={busy || !formationOpen} onClick={() => command(`/api/lomaton/invitations/${invitation.id}/reject`, "POST", undefined, "Invitación rechazada.")}>Rechazar</button><button className="primary-button" disabled={busy || !formationOpen} onClick={() => command(`/api/lomaton/invitations/${invitation.id}/accept`, "POST", undefined, "Te incorporaste al equipo.")}>Aceptar</button></div>
              </article>
            )) : <p className="muted">No tenés invitaciones pendientes.</p>}
          </section>
        </div>
      ) : (
        <>
          <section className="panel">
            <div className="team-heading"><div><span className="role-chip">{state.team.status}</span><h2>{state.team.name}</h2></div><strong>{state.members.length}/4 integrantes</strong></div>
            <ul className="member-list">{state.members.map((membership) => {
              const candidate = membership.expand?.candidate;
              return <li key={membership.id}><span>{candidateName(candidate)}</span><small>{candidate?.ftcaStatus === "confirmed" ? "FTCA confirmado" : candidate?.ftcaStatus === "pending" ? "FTCA pendiente" : "No FTCA"}</small></li>;
            })}</ul>
          </section>

          {state.team.owner === candidateId ? (
            <section className="panel">
              <h2>Gestionar invitaciones</h2>
              <form action={(formData) => command(`/api/lomaton/teams/${state.team?.id}/invitations`, "POST", { candidateId: formData.get("candidateId") }, "Invitación enviada.")} className="search-form">
                <label htmlFor="invite-candidate">Candidato disponible</label>
                <select id="invite-candidate" name="candidateId" required><option value="">Seleccionar…</option>{state.availableCandidates.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidateName(candidate)} · {candidate.email}</option>)}</select>
                <button className="primary-button" disabled={busy || !formationOpen || state.members.length >= 4}>Invitar</button>
              </form>
              {state.teamInvitations.map((invitation) => <div className="invitation-card" key={invitation.id}><span>{candidateName(invitation.expand?.candidate)}</span><button className="text-button" disabled={busy || !formationOpen} onClick={() => command(`/api/lomaton/invitations/${invitation.id}`, "DELETE", undefined, "Invitación retirada.")}>Retirar</button></div>)}
              <button className="danger-button" disabled={busy || !formationOpen} onClick={() => { if (window.confirm("¿Disolver el equipo y liberar a todos sus miembros?")) void command(`/api/lomaton/teams/${state.team?.id}`, "DELETE", undefined, "Equipo disuelto."); }}>Disolver equipo</button>
            </section>
          ) : <section className="panel"><p className="muted">Sólo el responsable puede invitar o disolver. Los miembros aceptados no pueden ser expulsados sin intervención administrativa.</p></section>}
        </>
      )}
    </>
  );
}
