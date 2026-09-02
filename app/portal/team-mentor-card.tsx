"use client";

import { useEffect, useState } from "react";

import { callLomatonApi } from "@/lib/pocketbase/browser-api";

type Mentor = {
  id: string;
  fullName: string;
  department: string;
  externalDescription: string;
};

type State = {
  assignment: { id: string; mentor: Mentor | null } | null;
};

export function TeamMentorCard({ teamId }: { teamId: string; formationOpen: boolean }) {
  const [state, setState] = useState<State | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    callLomatonApi<State>(`/api/lomaton/teams/${teamId}/mentor`)
      .then((nextState) => { if (active) setState(nextState); })
      .catch((error) => {
        if (active) {
          setMessage(error instanceof Error ? error.message : "No se pudo cargar la mentoría.");
        }
      });
    return () => { active = false; };
  }, [teamId]);

  return (
    <section className="panel">
      <h2>Mentoría docente</h2>
      {state?.assignment ? (
        <p>
          <strong>{state.assignment.mentor?.fullName || "Docente asignado"}</strong>
          <br />
          <span className="muted">
            {state.assignment.mentor?.department || state.assignment.mentor?.externalDescription}
          </span>
        </p>
      ) : (
        <p className="muted">
          Tu equipo todavía no tiene mentor. La organización realizará la asignación.
          La mentoría no cuenta como integrante ni modifica el requisito FTCA.
        </p>
      )}
      {message ? <div className="alert" role="status">{message}</div> : null}
    </section>
  );
}
