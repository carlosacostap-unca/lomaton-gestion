"use client";

import { useState } from "react";

import { useAuth } from "./auth-provider";

const GOOGLE_ACCOUNT_HELP =
  "https://support.google.com/accounts/answer/27441?co=GENIE.Platform%3DDesktop&hl=es";

export function LoginScreen() {
  const { loginWithGoogle } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function login() {
    setSubmitting(true);
    setError("");
    try {
      await loginWithGoogle();
    } catch {
      setError(
        "No pudimos iniciar sesión. Verificá que elegiste el mismo email que figura en el padrón o contactá a la organización.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login-shell">
      <section className="login-card" aria-labelledby="login-title">
        <div className="brand-mark" aria-hidden="true">L</div>
        <p className="eyebrow">Hackatón UNCA</p>
        <h1 id="login-title">Formá tu equipo para Lomatón</h1>
        <p className="lead">
          Ingresá con la cuenta Google asociada al email con el que te
          inscribiste. No se usan contraseñas propias de esta aplicación.
        </p>

        {error ? <div className="alert" role="alert">{error}</div> : null}

        <button
          className="google-button"
          type="button"
          onClick={login}
          disabled={submitting}
        >
          <span aria-hidden="true" className="google-g">G</span>
          {submitting ? "Abriendo Google…" : "Continuar con Google"}
        </button>

        <details className="help-panel">
          <summary>Mi email no termina en @gmail.com</summary>
          <div>
            <p>
              No necesitás crear un Gmail nuevo. Podés crear una cuenta Google
              usando tu dirección actual:
            </p>
            <ol>
              <li>Abrí la página para crear una cuenta Google.</li>
              <li>Elegí “Crear cuenta” y “Para uso personal”.</li>
              <li>Seleccioná “Usar tu correo electrónico”.</li>
              <li>Ingresá exactamente el email que figura en el padrón.</li>
              <li>Confirmalo con el código que Google enviará a ese correo.</li>
            </ol>
            <a href={GOOGLE_ACCOUNT_HELP} target="_blank" rel="noreferrer">
              Ver la guía oficial de Google
            </a>
          </div>
        </details>

        <p className="privacy-note">
          El acceso se habilita solamente para personas importadas al padrón y
          administradores autorizados.
        </p>
      </section>
    </main>
  );
}
