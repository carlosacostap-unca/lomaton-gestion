"use client";

import { useEffect, useState } from "react";
import type { RecordModel } from "pocketbase";

import { getBrowserPocketBase } from "@/lib/pocketbase/client";
import { callLomatonApi } from "@/lib/pocketbase/browser-api";
import { argentinaInputToUtc, utcToArgentinaInput } from "@/lib/time/argentina";

export function HackathonSettings() {
  const [settings, setSettings] = useState<RecordModel | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    getBrowserPocketBase().collection("hackathon_settings").getFirstListItem("key='default'")
      .then((record) => { if (active) setSettings(record); })
      .catch(() => { if (active) setMessage("No se pudo cargar la configuración."); });
    return () => { active = false; };
  }, []);

  async function save(formData: FormData) {
    setBusy(true);
    setMessage("");
    try {
      const deadlineLocal = String(formData.get("deadlineLocal") ?? "");
      const deliverablesDeadlineLocal = String(formData.get("deliverablesDeadlineLocal") ?? "");
      const deliverablesDeadlineUtc = argentinaInputToUtc(deliverablesDeadlineLocal);
      const closesImmediately = Boolean(
        deliverablesDeadlineUtc && new Date(deliverablesDeadlineUtc).getTime() <= Date.now() &&
        deliverablesDeadlineUtc !== String(settings?.deliverablesDeadlineUtc ?? ""),
      );
      if (closesImmediately && !window.confirm("El plazo elegido cerrará las entregas inmediatamente. ¿Querés continuar?")) {
        return;
      }
      const updated = await callLomatonApi<RecordModel>("/api/lomaton/admin/settings", {
        method: "PATCH",
        body: {
          deadlineUtc: argentinaInputToUtc(deadlineLocal),
          deliverablesDeadlineUtc,
          formationOpen: formData.get("formationOpen") === "on",
          reason: formData.get("reason"),
          confirmImmediateDeliverablesClosure: closesImmediately,
        },
      });
      setSettings(updated);
      setMessage("Configuración guardada y auditada.");
      window.dispatchEvent(new Event("lomaton:data-changed"));
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "No se pudo guardar la configuración.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel" aria-labelledby="settings-title">
      <h2 id="settings-title">Plazos del hackathon</h2>
      <p className="muted">Las fechas se ingresan en hora argentina y se guardan en UTC. Formación y entregas se administran por separado.</p>
      {settings ? <form action={save} className="upload-form" key={`${settings.id}-${settings.updated}`}>
        <h3>Formación de equipos</h3>
        <label htmlFor="deadline-local">Fecha y hora límite de formación (Argentina)</label>
        <input id="deadline-local" name="deadlineLocal" type="datetime-local" defaultValue={utcToArgentinaInput(settings.deadlineUtc)} />
        <label className="checkbox-row"><input name="formationOpen" type="checkbox" defaultChecked={Boolean(settings.formationOpen)} /> Formación de equipos habilitada</label>
        <h3>Entrega de productos</h3>
        <label htmlFor="deliverables-deadline-local">Fecha y hora límite de entregas (Argentina)</label>
        <input id="deliverables-deadline-local" name="deliverablesDeadlineLocal" type="datetime-local" required defaultValue={utcToArgentinaInput(settings.deliverablesDeadlineUtc)} />
        <p className="muted">Después de este instante, los equipos podrán consultar su entrega pero no modificarla.</p>
        <label htmlFor="settings-reason">Motivo del cambio</label>
        <input id="settings-reason" name="reason" placeholder="Ej.: prórroga aprobada por organización" />
        <button className="primary-button" disabled={busy}>{busy ? "Guardando…" : "Guardar configuración"}</button>
      </form> : <p className="muted">Cargando configuración…</p>}
      {message ? <div className="alert" role="status">{message}</div> : null}
    </section>
  );
}
