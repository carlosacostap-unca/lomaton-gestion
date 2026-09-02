"use client";

import { useEffect, useState } from "react";

import { callLomatonApi } from "@/lib/pocketbase/browser-api";

type Assignment = {
  id: string;
  name: string;
  status: string;
  members: Array<{ id: string; fullName: string }>;
};

type Dashboard = {
  assignments: Assignment[];
};

export function TeacherDashboard() {
  const [state, setState] = useState<Dashboard | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    callLomatonApi<Dashboard>("/api/lomaton/me/mentor")
      .then((next) => { if (active) setState(next); })
      .catch((error) => {
        if (active) {
          setMessage(error instanceof Error ? error.message : "No se pudo cargar la mentoría.");
        }
      });
    return () => { active = false; };
  }, []);

  if (!state) {
    return <section className="panel" aria-live="polite">{message || "Cargando equipos asignados…"}</section>;
  }

  return (
    <section className="panel">
      <h2>Equipos acompañados</h2>
      {state.assignments.map((assignment) => (
        <article className="invitation-card" key={assignment.id}>
          <div>
            <h3>{assignment.name}</h3>
            <span className="muted">Estado: {assignment.status || "sin estado"}</span>
          </div>
          <ul className="member-list">
            {assignment.members.map((member) => <li key={member.id}>{member.fullName}</li>)}
          </ul>
        </article>
      ))}
      {!state.assignments.length ? (
        <p className="muted">Todavía no tenés equipos asignados.</p>
      ) : (
        <p className="muted">
          Se muestran únicamente nombres operativos. Los certificados y datos privados
          de integrantes no están disponibles para el mentor.
        </p>
      )}
      {message ? <div className="alert" role="status">{message}</div> : null}
    </section>
  );
}
