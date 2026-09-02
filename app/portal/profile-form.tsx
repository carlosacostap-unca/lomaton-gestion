"use client";

import { useEffect, useState } from "react";

import { callLomatonApi } from "@/lib/pocketbase/browser-api";

type Profile = {
  role: "student" | "teacher";
  version: number;
  readOnly: { fullName: string; email: string; dni: string; relationship: string; ftcaStatus: string };
  editable: Record<string, string>;
  editableFields: string[];
};

const labels: Record<string, string> = {
  phone: "Teléfono",
  department: "Departamento",
  academicUnit: "Unidad académica",
  career: "Carrera",
  externalTeacherDescription: "Descripción institucional",
  mentorInterest: "Interés en mentorizar",
};

export function ProfileForm() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    callLomatonApi<Profile>("/api/lomaton/me/profile")
      .then((next) => { if (active) { setProfile(next); setValues(next.editable); } })
      .catch((error) => { if (active) setMessage(error instanceof Error ? error.message : "No se pudo cargar el perfil."); });
    return () => { active = false; };
  }, []);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!profile) return;
    setBusy(true);
    setMessage("");
    try {
      const updated = await callLomatonApi<Profile>("/api/lomaton/me/profile", { method: "PATCH", body: { expectedVersion: profile.version, ...values } });
      setProfile(updated);
      setValues(updated.editable);
      setMessage("Perfil actualizado.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo guardar el perfil.");
    } finally {
      setBusy(false);
    }
  }

  if (!profile) return <section className="panel" aria-live="polite">{message || "Cargando tu perfil…"}</section>;
  return (
    <section className="panel">
      <h2>Mi información</h2>
      <p className="muted">Nombre, correo, DNI y clasificación se corrigen por administración. Los demás datos podés mantenerlos acá.</p>
      <dl className="profile-summary"><div><dt>Nombre</dt><dd>{profile.readOnly.fullName}</dd></div><div><dt>Email</dt><dd>{profile.readOnly.email}</dd></div><div><dt>DNI</dt><dd>{profile.readOnly.dni}</dd></div></dl>
      <form className="edit-form" onSubmit={save}>
        {profile.editableFields.map((field) => field === "mentorInterest" ? (
          <label key={field}>{labels[field]}<select value={values[field] || "not_provided"} onChange={(event) => setValues({ ...values, [field]: event.target.value })}><option value="yes">Sí</option><option value="no">No</option><option value="not_provided">Sin informar</option></select></label>
        ) : (
          <label key={field}>{labels[field]}<input required={field === "phone"} minLength={field === "phone" ? 5 : undefined} maxLength={field === "externalTeacherDescription" ? 2000 : 240} value={values[field] || ""} onChange={(event) => setValues({ ...values, [field]: event.target.value })} /></label>
        ))}
        <div className="form-actions"><button className="primary-button" disabled={busy}>{busy ? "Guardando…" : "Guardar cambios"}</button></div>
      </form>
      {message ? <div className="alert" role="status" tabIndex={-1}>{message}</div> : null}
    </section>
  );
}
