"use client";

import Link from "next/link";

import { useAuth } from "@/app/components/auth-provider";
import { JuryDashboard } from "./jury-dashboard";

export default function JuryPage() {
  const { user, loading, logout } = useAuth();
  if (loading) return <main className="loading-screen">Cargando portal del jurado…</main>;
  if (!user?.juror) return <main className="app-shell"><div className="alert" role="alert">Esta área requiere un jurado activo.</div><Link href="/">Volver al inicio</Link></main>;
  return (
    <main className="app-shell">
      <header className="app-header">
        <div><p className="eyebrow">Lomatón · Jurado</p><h1>Panel de evaluación</h1></div>
        <div className="header-actions">
          {user.isAdmin ? <Link className="secondary-button link-button" href="/admin/evaluacion">Administración</Link> : <Link className="secondary-button link-button" href="/">Inicio</Link>}
          <button className="secondary-button" type="button" onClick={logout}>Cerrar sesión</button>
        </div>
      </header>
      <JuryDashboard />
    </main>
  );
}
