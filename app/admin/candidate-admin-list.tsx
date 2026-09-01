"use client";

import { useState } from "react";

import { callLomatonApi } from "@/lib/pocketbase/browser-api";
import { AdminCertificatePanel } from "./admin-certificate-panel";

type TriState = "yes" | "no" | "not_provided";
type RegistrationRecord = {
  id: string;
  fullName: string;
  dni: string;
  phone: string;
  email: string;
  relationship: "student_ftca" | "student_external" | "teacher";
  ftcaStatus: "confirmed" | "not_ftca" | "pending";
  department: string;
  academicUnit: string;
  career: string;
  externalTeacherDescription: string;
  mentorInterest: TriState;
  declaredTeamStatus: "complete" | "none" | "partial" | "not_provided";
  declaredTeamMembers: string;
  termsAccepted: TriState;
  mediaAuthorized: TriState;
  candidateActive: boolean;
  mentorActive: boolean;
  candidateId: string;
};

type RegistrationList = { items: RegistrationRecord[]; totalItems: number };

const roleLabels: Record<RegistrationRecord["relationship"], string> = {
  student_ftca: "Estudiante FTCA",
  student_external: "Estudiante externo/a",
  teacher: "Docente",
};

function selectedActive(record: RegistrationRecord) {
  return record.relationship === "teacher" ? record.mentorActive : record.candidateActive;
}

function stringValue(formData: FormData, name: string) {
  return String(formData.get(name) ?? "");
}

export function CandidateAdminList() {
  const [query, setQuery] = useState("");
  const [records, setRecords] = useState<RegistrationRecord[]>([]);
  const [selected, setSelected] = useState<RegistrationRecord | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function load(search = query) {
    setLoading(true);
    setMessage("");
    try {
      const result = await callLomatonApi<RegistrationList>(
        `/api/lomaton/admin/registrations?query=${encodeURIComponent(search.trim())}`,
      );
      setRecords(result.items);
      if (result.totalItems === 0) setMessage("No se encontraron inscripciones.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo cargar el padrón privado.");
    } finally {
      setLoading(false);
    }
  }

  async function save(formData: FormData) {
    if (!selected) return;
    setLoading(true);
    setMessage("");
    try {
      const result = await callLomatonApi<{ warning?: string }>(
        `/api/lomaton/admin/registrations/${selected.id}`,
        {
          method: "PATCH",
          body: {
            fullName: stringValue(formData, "fullName"),
            dni: stringValue(formData, "dni"),
            phone: stringValue(formData, "phone"),
            email: stringValue(formData, "email"),
            relationship: stringValue(formData, "relationship"),
            ftcaStatus: stringValue(formData, "ftcaStatus"),
            department: stringValue(formData, "department"),
            academicUnit: stringValue(formData, "academicUnit"),
            career: stringValue(formData, "career"),
            externalTeacherDescription: stringValue(formData, "externalTeacherDescription"),
            mentorInterest: stringValue(formData, "mentorInterest"),
            declaredTeamStatus: stringValue(formData, "declaredTeamStatus"),
            declaredTeamMembers: stringValue(formData, "declaredTeamMembers"),
            termsAccepted: stringValue(formData, "termsAccepted"),
            mediaAuthorized: stringValue(formData, "mediaAuthorized"),
            active: formData.get("active") === "on",
            reason: stringValue(formData, "reason"),
          },
        },
      );
      setMessage(result.warning || "Inscripción actualizada.");
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
      <h2 id="roster-title">Buscar y editar inscripciones</h2>
      <p>Esta vista privada reúne candidatos y docentes, incluidos DNI, teléfono y datos académicos.</p>
      <form className="search-form" onSubmit={(event) => { event.preventDefault(); void load(); }}>
        <label htmlFor="candidate-search">Nombre, email o DNI</label>
        <input id="candidate-search" value={query} onChange={(event) => setQuery(event.target.value)} />
        <button className="primary-button" disabled={loading}>Buscar</button>
      </form>
      {message ? <div className="alert" role="status">{message}</div> : null}
      <div className="table-wrap">
        <table>
          <thead><tr><th>Persona</th><th>Email</th><th>Vínculo</th><th>FTCA</th><th>Estado</th><th></th></tr></thead>
          <tbody>
            {records.map((record) => (
              <tr key={record.id}>
                <td>{record.fullName}</td>
                <td>{record.email}</td>
                <td>{roleLabels[record.relationship]}</td>
                <td>{record.ftcaStatus}</td>
                <td>{selectedActive(record) ? "Activo" : "Inactivo"}</td>
                <td><button className="text-button" type="button" onClick={() => setSelected(record)}>Editar</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected ? (
        <form action={save} className="edit-form">
          <h3>Editar {selected.fullName}</h3>
          <label>Apellido y nombres<input name="fullName" defaultValue={selected.fullName} required /></label>
          <label>DNI<input name="dni" defaultValue={selected.dni} required /></label>
          <label>Teléfono<input name="phone" defaultValue={selected.phone} required /></label>
          <label>Email<input name="email" type="email" defaultValue={selected.email} required /></label>
          <label>Vínculo<select name="relationship" defaultValue={selected.relationship}><option value="student_ftca">Estudiante FTCA</option><option value="student_external">Estudiante externo/a</option><option value="teacher">Docente</option></select></label>
          <label>Estado FTCA<select name="ftcaStatus" defaultValue={selected.ftcaStatus}><option value="confirmed">Confirmado</option><option value="not_ftca">No pertenece</option><option value="pending">Pendiente</option></select></label>
          <label>Departamento FTCA<input name="department" defaultValue={selected.department} /></label>
          <label>Unidad académica<input name="academicUnit" defaultValue={selected.academicUnit} /></label>
          <label>Carrera<input name="career" defaultValue={selected.career} /></label>
          <label>Descripción docente externo<textarea name="externalTeacherDescription" defaultValue={selected.externalTeacherDescription} rows={2} /></label>
          <label>Interés como mentor/a<select name="mentorInterest" defaultValue={selected.mentorInterest}><option value="yes">Sí</option><option value="no">No</option><option value="not_provided">No informado</option></select></label>
          <label>Estado del equipo declarado<select name="declaredTeamStatus" defaultValue={selected.declaredTeamStatus}><option value="complete">Completo</option><option value="partial">Incompleto</option><option value="none">Sin equipo</option><option value="not_provided">No informado</option></select></label>
          <label>Integrantes declarados<textarea name="declaredTeamMembers" defaultValue={selected.declaredTeamMembers} rows={3} /></label>
          <label>Bases y condiciones<select name="termsAccepted" defaultValue={selected.termsAccepted}><option value="yes">Aceptadas</option><option value="no">No aceptadas</option><option value="not_provided">No informado</option></select></label>
          <label>Uso de imagen y voz<select name="mediaAuthorized" defaultValue={selected.mediaAuthorized}><option value="yes">Autorizado</option><option value="no">No autorizado</option><option value="not_provided">No informado</option></select></label>
          {selected.relationship === "teacher" || !selected.candidateId
            ? <fieldset className="certificate-admin"><legend>Certificado de alumno regular</legend><p className="muted">No corresponde a un perfil docente.</p></fieldset>
            : <AdminCertificatePanel key={selected.candidateId} candidateId={selected.candidateId} />}
          <label className="check-label"><input name="active" type="checkbox" defaultChecked={selectedActive(selected)} /> Perfil activo</label>
          <label>Motivo<textarea name="reason" rows={2} placeholder="Obligatorio si la formación está cerrada" /></label>
          <div className="form-actions"><button className="secondary-button" type="button" onClick={() => setSelected(null)}>Cancelar</button><button className="primary-button" disabled={loading}>Guardar</button></div>
        </form>
      ) : null}
    </section>
  );
}
