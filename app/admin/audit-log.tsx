"use client";

import { useEffect, useState } from "react";
import type { RecordModel } from "pocketbase";

import { getBrowserPocketBase } from "@/lib/pocketbase/client";

export function AuditLog() {
  const [records, setRecords] = useState<RecordModel[]>([]);
  const [message, setMessage] = useState("");

  async function load() {
    try {
      const result = await getBrowserPocketBase().collection("audit_logs").getList(1, 100, { sort: "-created", expand: "actor" });
      setRecords(result.items);
      setMessage("");
    } catch {
      setMessage("No se pudo cargar la auditoría.");
    }
  }

  useEffect(() => {
    let active = true;
    getBrowserPocketBase().collection("audit_logs").getList(1, 100, { sort: "-created", expand: "actor" })
      .then((result) => { if (active) setRecords(result.items); })
      .catch(() => { if (active) setMessage("No se pudo cargar la auditoría."); });
    const refresh = () => void load();
    window.addEventListener("lomaton:data-changed", refresh);
    return () => { active = false; window.removeEventListener("lomaton:data-changed", refresh); };
  }, []);

  return (
    <section className="panel" aria-labelledby="audit-title">
      <div className="section-heading"><div><h2 id="audit-title">Auditoría</h2><p className="muted">Últimas 100 intervenciones, en orden cronológico inverso.</p></div><button className="secondary-button" type="button" onClick={() => void load()}>Actualizar</button></div>
      {message ? <div className="alert" role="alert">{message}</div> : null}
      <div className="table-wrap"><table><thead><tr><th>Fecha</th><th>Actor</th><th>Acción</th><th>Entidad</th><th>Motivo</th><th>Antes / después</th></tr></thead><tbody>
        {records.map((record) => <tr key={record.id}><td>{new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "medium", timeZone: "America/Argentina/Buenos_Aires" }).format(new Date(record.created))}</td><td>{String(record.expand?.actor?.email ?? record.actor ?? "sistema")}</td><td>{String(record.action)}</td><td>{String(record.entityType)} {String(record.entityId ?? "")}</td><td>{String(record.reason || "—")}</td><td><details><summary>Ver instantáneas</summary><pre>{JSON.stringify({ antes: record.before, despues: record.after }, null, 2)}</pre></details></td></tr>)}
        {records.length === 0 ? <tr><td colSpan={6}>Todavía no hay acciones auditadas.</td></tr> : null}
      </tbody></table></div>
    </section>
  );
}
