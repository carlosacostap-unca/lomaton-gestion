"use client";

import { useEffect, useMemo, useState } from "react";

import { callLomatonApi } from "@/lib/pocketbase/browser-api";

type Juror = {
  id: string;
  fullName: string;
  email: string;
  active: boolean;
};

type Directory = {
  jurors: Juror[];
  rosterLocked: boolean;
};

const emptyForm = { fullName: "", email: "", active: true };

export function AdminJurorDirectory() {
  const [directory, setDirectory] = useState<Directory>({ jurors: [], rosterLocked: false });
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    setDirectory(await callLomatonApi<Directory>("/api/lomaton/admin/jurors"));
  }

  useEffect(() => {
    let active = true;
    callLomatonApi<Directory>("/api/lomaton/admin/jurors")
      .then((value) => { if (active) setDirectory(value); })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : "No se pudo cargar la nómina."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const visible = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("es");
    return directory.jurors.filter((juror) =>
      !normalized || (juror.fullName + " " + juror.email).toLocaleLowerCase("es").includes(normalized),
    );
  }, [directory.jurors, query]);

  function edit(juror: Juror) {
    setEditingId(juror.id);
    setForm({ fullName: juror.fullName, email: juror.email, active: juror.active });
    setMessage("");
    setError("");
  }

  function reset() {
    setEditingId("");
    setForm(emptyForm);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setError("");
    try {
      await callLomatonApi(
        editingId ? "/api/lomaton/admin/jurors/" + editingId : "/api/lomaton/admin/jurors",
        { method: editingId ? "PATCH" : "POST", body: form },
      );
      await load();
      setMessage(editingId ? "Jurado actualizado." : "Jurado incorporado.");
      reset();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo guardar el jurado.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Nómina evaluadora</p>
          <h2>Jurados</h2>
          <p className="muted">Cada jurado activo evaluará a todos los equipos cuando se abra el ciclo.</p>
        </div>
        <span className={directory.rosterLocked ? "status-closed" : "status-open"}>
          {directory.rosterLocked ? "Nómina congelada" : "Nómina editable"}
        </span>
      </div>
      {directory.rosterLocked ? <div className="alert" role="status">La evaluación está abierta. Cancelala para modificar nombres, correos o estado de los jurados.</div> : null}
      {message ? <div className="alert" role="status">{message}</div> : null}
      {error ? <div className="alert" role="alert">{error}</div> : null}
      {error && !loading ? <button className="secondary-button" type="button" onClick={() => { setError(""); setLoading(true); void load().finally(() => setLoading(false)); }}>Reintentar</button> : null}

      <form className="edit-form" onSubmit={submit}>
        <h3>{editingId ? "Editar jurado" : "Agregar jurado"}</h3>
        <label>Nombre completo<input value={form.fullName} minLength={2} maxLength={240} required disabled={directory.rosterLocked || busy} onChange={(event) => setForm({ ...form, fullName: event.target.value })} /></label>
        <label>Correo electrónico<input type="email" value={form.email} maxLength={254} required disabled={directory.rosterLocked || busy} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
        <label className="check-label"><input type="checkbox" checked={form.active} disabled={directory.rosterLocked || busy} onChange={(event) => setForm({ ...form, active: event.target.checked })} /> Jurado activo</label>
        <div className="form-actions">
          {editingId ? <button className="secondary-button" type="button" disabled={busy} onClick={reset}>Cancelar edición</button> : null}
          <button className="primary-button" disabled={directory.rosterLocked || busy}>{busy ? "Guardando…" : "Guardar jurado"}</button>
        </div>
      </form>

      <label className="student-filter">Buscar jurado<input type="search" value={query} placeholder="Nombre o correo" onChange={(event) => setQuery(event.target.value)} /></label>
      {loading ? <p aria-live="polite">Cargando jurados…</p> : (
        <div className="juror-directory">
          {visible.map((juror) => (
            <article className="juror-card" key={juror.id}>
              <div><h3>{juror.fullName}</h3><p className="muted">{juror.email}</p></div>
              <span className={juror.active ? "student-status is-approved" : "student-status"}>{juror.active ? "Activo" : "Inactivo"}</span>
              <button className="secondary-button" type="button" disabled={directory.rosterLocked} onClick={() => edit(juror)}>Editar</button>
            </article>
          ))}
          {!visible.length ? <p className="muted">No hay jurados que coincidan con la búsqueda.</p> : null}
        </div>
      )}
    </section>
  );
}
