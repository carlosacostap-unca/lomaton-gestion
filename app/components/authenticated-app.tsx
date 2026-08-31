"use client";

import { useAuth } from "./auth-provider";

export function AuthenticatedApp() {
  const { user, logout } = useAuth();
  if (!user) return null;

  const isAdmin = Boolean(user.isAdmin);
  const isCandidate = Boolean(user.candidate);

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
        {isCandidate ? (
          <article className="role-card">
            <span className="role-chip">Candidato</span>
            <h2>Mi equipo</h2>
            <p>Creá un equipo, revisá invitaciones y seguí su estado antes del plazo.</p>
            <a href="/candidate">Ir al panel de candidato</a>
          </article>
        ) : null}

        {isAdmin ? (
          <article className="role-card admin-card">
            <span className="role-chip">Administrador</span>
            <h2>Administración</h2>
            <p>Importá el padrón, resolvé excepciones, configurá el cierre y exportá resultados.</p>
            <a href="/admin">Ir a administración</a>
          </article>
        ) : null}
      </section>

      {!isCandidate && !isAdmin ? (
        <div className="alert" role="alert">
          La cuenta está autenticada pero no tiene permisos activos. Contactá a la organización.
        </div>
      ) : null}
    </main>
  );
}
