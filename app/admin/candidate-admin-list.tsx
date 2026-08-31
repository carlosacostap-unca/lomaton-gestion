"use client";

import { useState } from "react";
import type { RecordModel } from "pocketbase";

import { getBrowserPocketBase } from "@/lib/pocketbase/client";
import { callLomatonApi } from "@/lib/pocketbase/browser-api";

export function CandidateAdminList() {
  const [query, setQuery] = useState("");
  const [records, setRecords] = useState<RecordModel[]>([]);
  const [selected, setSelected] = useState<RecordModel | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function load(search = query) {
    setLoading(true);
    try {
      const pb = getBrowserPocketBase();
      const normalized = search.trim();
      const filter = normalized
        ? pb.filter("firstName ~ {:q} || lastName ~ {:q} || email ~ {:q}", { q: normalized })
        : "";
      const result = await pb.collection("candidates").getList(1, 50, {
        filter,
        sort: "lastName,firstName",
      });
      setRecords(result.items);
    } catch {
      setMessage("No se pudo cargar el padrón.");
    } finally {
      setLoading(false);
    }
  }

  async function save(formData: FormData) {
    if (!selected) return;
    setLoading(true);
    setMessage("");
    try {
      const result = await callLomatonApi<{ warning?: string }>(`/api/lomaton/admin/candidates/${selected.id}`, {
        method: "PATCH",
        body: {
          firstName: formData.get("firstName"),
          lastName: formData.get("lastName"),
          email: formData.get("email"),
          ftcaStatus: formData.get("ftcaStatus"),
          active: formData.get("active") === "on",
          reason: formData.get("reason"),
        },
      });
      setMessage(result.warning || "Candidato actualizado.");
      window.dispatchEvent(new Event("lomaton:data-changed"));
      setSelected(null);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo actualizar.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="panel" aria-labelledby="roster-title">
      <h2 id="roster-title">Buscar y editar candidatos</h2>
      <form className="search-form" onSubmit={(event) => { event.preventDefault(); void load(); }}>
        <label htmlFor="candidate-search">Nombre o email</label>
        <input id="candidate-search" value={query} onChange={(event) => setQuery(event.target.value)} />
        <button className="primary-button" disabled={loading}>Buscar</button>
      </form>
      {message ? <div className="alert" role="status">{message}</div> : null}
      <div className="table-wrap">
        <table><thead><tr><th>Candidato</th><th>Email</th><th>FTCA</th><th>Estado</th><th></th></tr></thead><tbody>
          {records.map((record) => (
            <tr key={record.id}>
              <td>{record.firstName} {record.lastName}</td><td>{record.email}</td><td>{record.ftcaStatus}</td><td>{record.active ? "Activo" : "Inactivo"}</td>
              <td><button className="text-button" type="button" onClick={() => setSelected(record)}>Editar</button></td>
            </tr>
          ))}
        </tbody></table>
      </div>

      {selected ? (
        <form action={save} className="edit-form">
          <h3>Editar {selected.firstName} {selected.lastName}</h3>
          <label>Nombre<input name="firstName" defaultValue={selected.firstName} required /></label>
          <label>Apellido<input name="lastName" defaultValue={selected.lastName} required /></label>
          <label>Email<input name="email" type="email" defaultValue={selected.email} required /></label>
          <label>Estado FTCA<select name="ftcaStatus" defaultValue={selected.ftcaStatus}><option value="confirmed">Confirmado</option><option value="not_ftca">No pertenece</option><option value="pending">Pendiente</option></select></label>
          <label className="check-label"><input name="active" type="checkbox" defaultChecked={selected.active} /> Candidato activo</label>
          <label>Motivo<textarea name="reason" rows={2} placeholder="Obligatorio si la formación está cerrada" /></label>
          <div className="form-actions"><button className="secondary-button" type="button" onClick={() => setSelected(null)}>Cancelar</button><button className="primary-button" disabled={loading}>Guardar</button></div>
        </form>
      ) : null}
    </section>
  );
}
