import Link from "next/link";

export default function AdminNotFound() {
  return (
    <section className="panel">
      <h2>La sección no existe</h2>
      <p className="muted">Volvé al resumen para continuar trabajando.</p>
      <Link className="primary-button link-button" href="/admin">Ir al resumen</Link>
    </section>
  );
}
