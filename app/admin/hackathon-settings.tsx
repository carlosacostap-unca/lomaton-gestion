"use client";

import { useEffect, useState } from "react";
import type { RecordModel } from "pocketbase";

import { getBrowserPocketBase } from "@/lib/pocketbase/client";
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
      const updated = await getBrowserPocketBase().send<RecordModel>("/api/lomaton/admin/settings", {
        method: "PATCH",
        body: {
          deadlineUtc: argentinaInputToUtc(deadlineLocal),
          formationOpen: formData.get("formationOpen") === "on",
          reason: formData.get("reason"),
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
      <h2 id="settings-title">Plazo de formación</h2>
      <p className="muted">La fecha se ingresa en hora argentina y se guarda en UTC. El cierre manual tiene efecto inmediato.</p>
      {settings ? <form action={save} className="upload-form" key={`${settings.id}-${settings.updated}`}>
        <label htmlFor="deadline-local">Fecha y hora límite (Argentina)</label>
        <input id="deadline-local" name="deadlineLocal" type="datetime-local" defaultValue={utcToArgentinaInput(settings.deadlineUtc)} />
        <label className="checkbox-row"><input name="formationOpen" type="checkbox" defaultChecked={Boolean(settings.formationOpen)} /> Formación de equipos habilitada</label>
        <label htmlFor="settings-reason">Motivo del cambio</label>
        <input id="settings-reason" name="reason" placeholder="Ej.: prórroga aprobada por organización" />
        <button className="primary-button" disabled={busy}>{busy ? "Guardando…" : "Guardar configuración"}</button>
      </form> : <p className="muted">Cargando configuración…</p>}
      {message ? <div className="alert" role="status">{message}</div> : null}
    </section>
  );
}
