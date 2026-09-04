"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { deliverableStatusLabels } from "@/app/components/deliverable-readonly";
import { callLomatonApi } from "@/lib/pocketbase/browser-api";
import type { TeamDeliverableProjection, TeamDeliverableSummaryStatus } from "@/lib/team-deliverables-contract";

type Dashboard = {
  deadlineUtc: string;
  items: TeamDeliverableProjection[];
  counts: Record<TeamDeliverableSummaryStatus, number>;
};

export function AdminDeliverables() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [filter, setFilter] = useState<TeamDeliverableSummaryStatus | "all">("all");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    callLomatonApi<Dashboard>("/api/lomaton/admin/deliverables")
      .then((next) => { if (active) setDashboard(next); })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : "No se pudieron cargar las entregas."); });
    return () => { active = false; };
  }, []);

  const items = useMemo(() => dashboard?.items.filter((item) => filter === "all" || item.summaryStatus === filter) ?? [], [dashboard, filter]);
  if (!dashboard) return <section className="panel" aria-live="polite">{error || "Cargando entregas…"}</section>;

  return (
    <section className="panel" aria-labelledby="admin-deliverables-title">
      <p className="eyebrow">Supervisión</p>
      <h2 id="admin-deliverables-title">Entregas por equipo</h2>
      <p className="muted">Vista de solo lectura. Incluye todos los equipos, aunque todavía no hayan iniciado su entrega.</p>
      {error ? <div className="alert" role="alert">{error}</div> : null}
      <div className="deliverable-summary" aria-label="Resumen de entregas">
        {(["none", "draft_incomplete", "draft_complete", "finalized"] as const).map((status) => <button type="button" key={status} className={filter === status ? "jury-team-button is-selected" : "jury-team-button"} aria-pressed={filter === status} onClick={() => setFilter(status)}><strong>{dashboard.counts[status] ?? 0}</strong><span>{deliverableStatusLabels[status]}</span></button>)}
      </div>
      <div className="form-actions"><button type="button" className="text-button" aria-pressed={filter === "all"} onClick={() => setFilter("all")}>Mostrar todos ({dashboard.items.length})</button></div>
      <div className="admin-team-list" role="list" aria-live="polite">
        {items.map((delivery) => <article className="invitation-card" key={delivery.teamId}><div><strong>{delivery.teamName}</strong><small>{deliverableStatusLabels[delivery.summaryStatus]} · versión {delivery.version}</small></div><Link className="secondary-button link-button" href={`/admin/entregas/${delivery.teamId}`}>Ver detalle</Link></article>)}
        {!items.length ? <p className="muted">No hay equipos en este filtro.</p> : null}
      </div>
    </section>
  );
}
