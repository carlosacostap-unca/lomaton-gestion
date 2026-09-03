"use client";

export default function AdminError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <section className="panel">
      <h2>No pudimos cargar esta sección</h2>
      <p className="muted">Podés reintentar o elegir otra opción del menú.</p>
      <button className="primary-button" type="button" onClick={reset}>Reintentar</button>
    </section>
  );
}
