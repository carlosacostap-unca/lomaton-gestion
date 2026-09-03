"use client";

import { useEffect, useMemo, useState } from "react";

import { callLomatonApi } from "@/lib/pocketbase/browser-api";

type CertificateStatus = "not_presented" | "pending" | "approved" | "rejected";
type StudentSummary = {
  registrationId: string;
  candidateId: string;
  name: string;
  faculty: string;
  certificateStatus: CertificateStatus;
  team: { id: string; name: string } | null;
  pendingInvitations: Array<{ id: string; teamId: string; teamName: string }>;
};
type StudentDirectory = { students: StudentSummary[] };
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
  candidateId: string;
};

const certificateLabels: Record<CertificateStatus, { presented: string; validation: string }> = {
  not_presented: { presented: "No", validation: "No presentado" },
  pending: { presented: "Sí", validation: "Pendiente" },
  approved: { presented: "Sí", validation: "Validado" },
  rejected: { presented: "Sí", validation: "Rechazado" },
};

function stringValue(formData: FormData, name: string) {
  return String(formData.get(name) ?? "");
}

export function AdminStudentDirectory() {
  const [directory, setDirectory] = useState<StudentDirectory>({ students: [] });
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [selected, setSelected] = useState<RegistrationRecord | null>(null);
  const [editingId, setEditingId] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    setError("");
    try {
      setDirectory(await callLomatonApi<StudentDirectory>("/api/lomaton/admin/students"));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No se pudo cargar el listado de estudiantes.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    void callLomatonApi<StudentDirectory>("/api/lomaton/admin/students")
      .then((result) => {
        if (active) setDirectory(result);
      })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : "No se pudo cargar el listado de estudiantes.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  const visibleStudents = useMemo(() => {
    const normalized = filter.trim().toLocaleLowerCase("es");
    if (!normalized) return directory.students;
    return directory.students.filter((student) =>
      `${student.name} ${student.faculty} ${student.team?.name ?? ""} ${student.pendingInvitations.map((item) => item.teamName).join(" ")}`
        .toLocaleLowerCase("es")
        .includes(normalized),
    );
  }, [directory.students, filter]);

  async function edit(student: StudentSummary) {
    setEditingId(student.registrationId);
    setError("");
    setMessage("");
    try {
      const record = await callLomatonApi<RegistrationRecord>(
        `/api/lomaton/admin/registrations/${student.registrationId}`,
      );
      if (record.relationship === "teacher") {
        setError("La inscripción ya no corresponde a un estudiante. Se actualizó el listado.");
        await load();
        return;
      }
      setSelected(record);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No se pudo cargar la inscripción.");
    } finally {
      setEditingId("");
    }
  }

  async function save(formData: FormData) {
    if (!selected) return;
    setSaving(true);
    setError("");
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
      setSelected(null);
      setMessage(result.warning || "Inscripción actualizada.");
      window.dispatchEvent(new Event("lomaton:data-changed"));
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No se pudo actualizar la inscripción.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="panel" aria-labelledby="student-directory-title">
      <div className="section-heading">
        <div>
          <h2 id="student-directory-title">Estudiantes</h2>
          <p className="muted">Consultá su facultad, certificado y situación de equipo.</p>
        </div>
        {!loading && !error ? <span className="role-chip">{directory.students.length} registros</span> : null}
      </div>

      <label className="student-filter" htmlFor="student-filter">
        Filtrar estudiantes
        <input id="student-filter" value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Nombre, facultad o equipo" />
      </label>

      {loading ? <p role="status">Cargando estudiantes…</p> : null}
      {error ? <div className="alert" role="alert"><p>{error}</p><button className="secondary-button" type="button" onClick={() => void load()}>Reintentar</button></div> : null}
      {message ? <div className="alert" role="status">{message}</div> : null}

      {!loading && !error && directory.students.length === 0 ? (
        <p className="empty-detail">No hay estudiantes registrados.</p>
      ) : null}
      {!loading && !error && directory.students.length > 0 && visibleStudents.length === 0 ? (
        <p className="empty-detail">No hay estudiantes que coincidan con el filtro.</p>
      ) : null}

      <div className="student-directory" aria-label="Estudiantes registrados">
        {visibleStudents.map((student) => {
          const certificate = certificateLabels[student.certificateStatus];
          return (
            <article className="student-directory-card" key={student.registrationId}>
              <div className="student-directory-heading">
                <h3>{student.name}</h3>
                <button
                  className="secondary-button"
                  type="button"
                  disabled={Boolean(editingId)}
                  onClick={() => void edit(student)}
                  aria-label={`Editar inscripción de ${student.name}`}
                >
                  {editingId === student.registrationId ? "Cargando…" : "Editar"}
                </button>
              </div>
              <dl className="student-directory-data">
                <div><dt>Facultad</dt><dd>{student.faculty}</dd></div>
                <div><dt>Certificado presentado</dt><dd>{certificate.presented}</dd></div>
                <div><dt>Validación</dt><dd><span className={`student-status is-${student.certificateStatus}`}>{certificate.validation}</span></dd></div>
                <div><dt>Equipo aceptado</dt><dd>{student.team?.name ?? "Sin equipo"}</dd></div>
              </dl>
              <div className="student-invitations">
                <strong>Invitaciones pendientes</strong>
                {student.pendingInvitations.length ? (
                  <ul>{student.pendingInvitations.map((invitation) => <li key={invitation.id}>{invitation.teamName}</li>)}</ul>
                ) : <span>Ninguna</span>}
              </div>
            </article>
          );
        })}
      </div>

      {selected ? (
        <form action={save} className="edit-form" aria-label={`Editar inscripción de ${selected.fullName}`}>
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
          <label className="check-label"><input name="active" type="checkbox" defaultChecked={selected.candidateActive} /> Perfil activo</label>
          <label>Motivo<textarea name="reason" rows={2} placeholder="Obligatorio si la formación está cerrada" /></label>
          <p className="muted">La revisión del certificado se realiza desde la sección Certificados.</p>
          <div className="form-actions"><button className="secondary-button" type="button" onClick={() => setSelected(null)}>Cancelar</button><button className="primary-button" disabled={saving}>{saving ? "Guardando…" : "Guardar"}</button></div>
        </form>
      ) : null}
    </section>
  );
}
