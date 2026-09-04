"use client";

import { useEffect, useState } from "react";

import { DeliverableReadonly, deliverableStatusLabels } from "@/app/components/deliverable-readonly";
import { callLomatonApi } from "@/lib/pocketbase/browser-api";
import type { TeamDeliverableProjection } from "@/lib/team-deliverables-contract";

type Dashboard = { items: TeamDeliverableProjection[] };

export function JuryDeliverablesPanel() {
  const [items, setItems] = useState<TeamDeliverableProjection[] | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    callLomatonApi<Dashboard>("/api/lomaton/jury/deliverables")
      .then((dashboard) => {
        if (!active) return;
        setItems(dashboard.items);
        setSelectedTeamId(dashboard.items[0]?.teamId ?? "");
      })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : "No se pudieron cargar las entregas."); });
    return () => { active = false; };
  }, []);

  if (!items) return <section className="panel" aria-live="polite"><h2>Productos entregados</h2><p>{error || "Cargando entregas…"}</p></section>;
  const selected = items.find((item) => item.teamId === selectedTeamId) ?? items[0];
  return (
    <section className="panel" aria-labelledby="jury-deliverables-title">
      <p className="eyebrow">Material de evaluación</p>
      <h2 id="jury-deliverables-title">Productos entregados por los equipos</h2>
      <p className="muted">Esta consulta está disponible aunque todavía no se haya abierto un ciclo de evaluación. Los borradores pueden cambiar hasta el plazo.</p>
      {error ? <div className="alert" role="alert">{error}</div> : null}
      {!selected ? <p className="muted">No hay equipos disponibles.</p> : <div className="jury-evaluation-workspace">
        <div className="jury-team-list" role="list" aria-label="Entregas de equipos">
          {items.map((item) => <button key={item.teamId} type="button" className={item.teamId === selected.teamId ? "jury-team-button is-selected" : "jury-team-button"} aria-pressed={item.teamId === selected.teamId} onClick={() => setSelectedTeamId(item.teamId)}><strong>{item.teamName}</strong><span>{deliverableStatusLabels[item.summaryStatus]}</span></button>)}
        </div>
        <div className="jury-evaluation-card"><DeliverableReadonly delivery={selected} /></div>
      </div>}
    </section>
  );
}
