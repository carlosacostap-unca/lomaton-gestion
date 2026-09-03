"use client";

import { useEffect, useMemo, useState } from "react";

import type {
  AdminTeacherAssignment,
  AdminTeacherDirectory as TeacherDirectory,
  AdminTeacherSummary,
} from "@/lib/domain/admin-teacher-views";
import { callLomatonApi } from "@/lib/pocketbase/browser-api";

const interestLabels: Record<AdminTeacherSummary["mentorInterest"], string> = {
  yes: "Interés confirmado",
  no: "Sin interés",
  not_provided: "Interés no informado",
};

export function AdminTeacherDirectory() {
  const [directory, setDirectory] = useState<TeacherDirectory>({ teachers: [], teams: [] });
  const [query, setQuery] = useState("");
  const [availability, setAvailability] = useState("all");
  const [managingRegistrationId, setManagingRegistrationId] = useState("");
  const [teamId, setTeamId] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [operationError, setOperationError] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    setLoading(true);
    setLoadError("");
    try {
      setDirectory(await callLomatonApi<TeacherDirectory>("/api/lomaton/admin/teachers"));
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "No se pudo cargar el listado de docentes.");
    } finally {
      setLoading(false);
    }
  }

  async function refresh() {
    setDirectory(await callLomatonApi<TeacherDirectory>("/api/lomaton/admin/teachers"));
  }

  useEffect(() => {
    let active = true;
    void callLomatonApi<TeacherDirectory>("/api/lomaton/admin/teachers")
      .then((result) => { if (active) setDirectory(result); })
      .catch((error: unknown) => {
        if (active) setLoadError(error instanceof Error ? error.message : "No se pudo cargar el listado de docentes.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const visibleTeachers = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("es");
    return directory.teachers.filter((teacher) => {
      if (availability === "eligible" && !teacher.eligible) return false;
      if (availability === "unavailable" && teacher.eligible) return false;
      if (!normalized) return true;
      return `${teacher.name} ${teacher.affiliation} ${teacher.assignments.map((item) => item.teamName).join(" ")}`
        .toLocaleLowerCase("es")
        .includes(normalized);
    });
  }, [availability, directory.teachers, query]);

  const selectedTeacher = directory.teachers.find(
    (teacher) => teacher.registrationId === managingRegistrationId,
  );
  const selectedTeam = directory.teams.find((team) => team.id === teamId);
  const alreadyAssigned = Boolean(
    selectedTeacher?.mentorId && selectedTeam?.currentMentor?.id === selectedTeacher.mentorId,
  );
  const replacesAnother = Boolean(
    selectedTeam?.currentMentor && selectedTeam.currentMentor.id !== selectedTeacher?.mentorId,
  );

  function manage(teacher: AdminTeacherSummary) {
    const opening = managingRegistrationId !== teacher.registrationId;
    setManagingRegistrationId(opening ? teacher.registrationId : "");
    setTeamId("");
    setReason("");
    setMessage("");
    setOperationError("");
  }

  async function assign() {
    if (!selectedTeacher?.mentorId || !selectedTeam || alreadyAssigned) return;
    setBusy(true);
    setMessage("");
    setOperationError("");
    try {
      await callLomatonApi(`/api/lomaton/admin/teams/${selectedTeam.id}/mentor`, {
        method: "PUT",
        body: { mentorId: selectedTeacher.mentorId, reason },
      });
      await refresh();
      setTeamId("");
      setMessage(replacesAnother ? "Mentoría reemplazada por administración." : "Mentoría asignada por administración.");
      window.dispatchEvent(new Event("lomaton:data-changed"));
      requestAnimationFrame(() => document.getElementById("teacher-operation-result")?.focus());
    } catch (error) {
      setOperationError(error instanceof Error ? error.message : "No se pudo asignar la mentoría.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(teacher: AdminTeacherSummary, assignment: AdminTeacherAssignment) {
    if (!window.confirm(`¿Retirar a ${teacher.name} de ${assignment.teamName}?`)) return;
    setBusy(true);
    setMessage("");
    setOperationError("");
    try {
      await callLomatonApi(`/api/lomaton/admin/team-mentorships/${assignment.mentorshipId}`, {
        method: "DELETE",
        body: { reason },
      });
      await refresh();
      setMessage("Mentoría retirada por administración.");
      window.dispatchEvent(new Event("lomaton:data-changed"));
      requestAnimationFrame(() => document.getElementById("teacher-operation-result")?.focus());
    } catch (error) {
      setOperationError(error instanceof Error ? error.message : "No se pudo retirar la mentoría.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel" aria-labelledby="teacher-directory-title">
      <div className="section-heading">
        <div>
          <h2 id="teacher-directory-title">Docentes</h2>
          <p className="muted">Consultá su disponibilidad y gestioná todos los equipos que acompañan.</p>
        </div>
        {!loading && !loadError ? <span className="role-chip">{directory.teachers.length} registros</span> : null}
      </div>

      <div className="teacher-filters">
        <label>Buscar docente, unidad académica o equipo<input value={query} onChange={(event) => setQuery(event.target.value)} /></label>
        <label>Disponibilidad<select value={availability} onChange={(event) => setAvailability(event.target.value)}><option value="all">Todos</option><option value="eligible">Disponibles</option><option value="unavailable">No disponibles</option></select></label>
      </div>

      {loading ? <p role="status">Cargando docentes…</p> : null}
      {loadError ? <div className="alert" role="alert"><p>{loadError}</p><button className="secondary-button" type="button" onClick={() => void load()}>Reintentar</button></div> : null}
      {message ? <div id="teacher-operation-result" className="alert" role="status" tabIndex={-1}>{message}</div> : null}
      {operationError ? <div className="alert" role="alert">{operationError}</div> : null}

      {!loading && !loadError && directory.teachers.length === 0 ? <p className="empty-detail">No hay docentes registrados.</p> : null}
      {!loading && !loadError && directory.teachers.length > 0 && visibleTeachers.length === 0 ? <p className="empty-detail">No hay docentes que coincidan con los filtros.</p> : null}

      <div className="teacher-directory" aria-label="Docentes registrados">
        {visibleTeachers.map((teacher) => {
          const managing = managingRegistrationId === teacher.registrationId;
          return (
            <article className="teacher-directory-card" key={teacher.registrationId}>
              <div className="teacher-directory-heading">
                <div>
                  <h3>{teacher.name}</h3>
                  <p>{teacher.affiliation}</p>
                </div>
                <div className="teacher-availability">
                  <span className={teacher.eligible ? "status-open" : "status-closed"}>{teacher.eligible ? "Disponible" : "No disponible"}</span>
                  <small>{teacher.eligible ? interestLabels[teacher.mentorInterest] : teacher.unavailableReason}</small>
                </div>
                <button className="secondary-button" type="button" onClick={() => manage(teacher)} aria-label={managing ? `Cerrar gestión de ${teacher.name}` : `Gestionar ${teacher.name}`} aria-expanded={managing} aria-controls={`teacher-management-${teacher.registrationId}`}>{managing ? "Cerrar" : "Gestionar"}</button>
              </div>

              <div className="teacher-assignments">
                <strong>Equipos asignados ({teacher.assignments.length})</strong>
                {teacher.assignments.length ? (
                  <ul>{teacher.assignments.map((assignment) => <li key={assignment.mentorshipId}><span>{assignment.teamName}</span>{managing ? <button className="text-button" type="button" disabled={busy} onClick={() => void remove(teacher, assignment)}>Retirar</button> : null}</li>)}</ul>
                ) : <p className="muted">Todavía no tiene equipos asignados.</p>}
              </div>

              {managing ? (
                <div className="teacher-management" id={`teacher-management-${teacher.registrationId}`}>
                  {teacher.eligible ? (
                    <>
                      <label>Equipo<select value={teamId} onChange={(event) => setTeamId(event.target.value)}><option value="">Elegir equipo</option>{directory.teams.map((team) => <option key={team.id} value={team.id}>{team.name}{team.currentMentor ? ` · Mentor: ${team.currentMentor.name}` : " · Sin mentor"}</option>)}</select></label>
                      {alreadyAssigned ? <p className="muted" role="status">Este equipo ya tiene a {teacher.name} como mentor.</p> : null}
                      {replacesAnother && selectedTeam?.currentMentor ? <div className="mentor-replacement-warning" role="alert"><strong>Reemplazo de mentor</strong><p>{selectedTeam.name} dejará de tener a {selectedTeam.currentMentor.name} y será asignado a {teacher.name}.</p></div> : null}
                    </>
                  ) : <p className="muted">{teacher.unavailableReason}. No admite nuevas asignaciones.</p>}
                  <label>Motivo de intervención<input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Obligatorio después del cierre" /></label>
                  {teacher.eligible ? <button className="primary-button" type="button" disabled={busy || !teamId || alreadyAssigned} onClick={() => void assign()}>{replacesAnother ? "Confirmar reemplazo" : "Asignar equipo"}</button> : null}
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}
