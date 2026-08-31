"use client";

import { useAuth } from "@/app/components/auth-provider";
import Link from "next/link";
import { CandidateDashboard } from "./candidate-dashboard";

export default function CandidatePage() {
  const { user, loading, logout } = useAuth();
  if (loading) return <main className="loading-screen">Cargando tu equipo…</main>;
  if (!user?.candidate) {
    return <main className="app-shell"><div className="alert" role="alert">Esta área requiere una identidad vinculada al padrón.</div></main>;
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <div><p className="eyebrow">Panel del candidato</p><h1>Mi equipo</h1></div>
        <div className="header-actions"><Link className="secondary-button link-button" href="/">Inicio</Link><button className="secondary-button" onClick={logout}>Cerrar sesión</button></div>
      </header>
      <CandidateDashboard candidateId={String(user.candidate)} />
    </main>
  );
}
