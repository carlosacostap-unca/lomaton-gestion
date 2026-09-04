"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { DeliverableReadonly } from "@/app/components/deliverable-readonly";
import { callLomatonApi } from "@/lib/pocketbase/browser-api";
import type { TeamDeliverableProjection } from "@/lib/team-deliverables-contract";

export function AdminDeliverableDetail({ teamId }: { teamId: string }) {
  const [delivery, setDelivery] = useState<TeamDeliverableProjection | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    callLomatonApi<TeamDeliverableProjection>(`/api/lomaton/admin/deliverables/${teamId}`)
      .then((next) => { if (active) setDelivery(next); })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : "No se pudo cargar la entrega."); });
    return () => { active = false; };
  }, [teamId]);
  return <section className="panel"><Link className="text-button" href="/admin/entregas">← Volver a entregas</Link>{delivery ? <DeliverableReadonly delivery={delivery} /> : <p aria-live="polite">{error || "Cargando detalle…"}</p>}</section>;
}
