"use client";

import Link from "next/link";

import { useAuth } from "./auth-provider";

export function AuthenticatedApp() {
  const { user, participantRole, logout } = useAuth();
  if (!user) return null;

  const isAdmin = Boolean(user.isAdmin);
  const isParticipant = Boolean(user.registration);
  const isJuror = Boolean(user.juror);

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">Lomatón · Gestión de equipos</p>
          <h1>Hola, {user.displayName || user.email}</h1>
        </div>
        <button className="secondary-button" type="button" onClick={logout}>
          Cerrar sesión
        </button>
      </header>

      <section className="role-grid" aria-label="Áreas disponibles">
        {isParticipant ? (
          <article className="role-card">
            <span className="role-chip">{participantRole === "teacher" ? "Docente" : "Estudiante"}</span>
            <h2>Mi portal</h2>
            <p>Gestioná tu perfil, invitaciones y {participantRole === "teacher" ? "mentoría" : "equipo y certificado"}.</p>
            <Link href="/portal">Ir al portal</Link>
          </article>
        ) : null}

        {isAdmin ? (
          <article className="role-card admin-card">
            <span className="role-chip">Administrador</span>
            <h2>Administración</h2>
            <p>Importá el padrón, resolvé excepciones, configurá el cierre y exportá resultados.</p>
            <Link href="/admin">Ir a administración</Link>
          </article>
        ) : null}

        {isJuror ? (
          <article className="role-card">
            <span className="role-chip">Jurado</span>
            <h2>Evaluación</h2>
            <p>Calificá a todos los equipos, guardá borradores y finalizá tus evaluaciones.</p>
            <Link href="/jurado">Ir a evaluación</Link>
          </article>
        ) : null}
      </section>

      {!isParticipant && !isAdmin && !isJuror ? (
        <div className="alert" role="alert">
          La cuenta está autenticada pero no tiene permisos activos. Contactá a la organización.
        </div>
      ) : null}
    </main>
  );
}
