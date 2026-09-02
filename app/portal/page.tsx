"use client";

import Link from "next/link";

import { CandidateDashboard } from "@/app/candidate/candidate-dashboard";
import { useAuth } from "@/app/components/auth-provider";
import { ProfileForm } from "./profile-form";
import { TeacherDashboard } from "./teacher-dashboard";

export default function PortalPage() {
  const { user, participantRole, loading, logout } = useAuth();
  if (loading || (user && !participantRole)) return <main className="loading-screen">Cargando tu portal…</main>;
  if (!user?.registration || !["student", "teacher"].includes(participantRole || "")) return <main className="app-shell"><div className="alert" role="alert">Esta área requiere una inscripción activa.</div><Link href="/">Volver al inicio</Link></main>;
  return <main className="app-shell">
    <header className="app-header"><div><p className="eyebrow">Portal de participantes</p><h1>{participantRole === "teacher" ? "Panel docente" : "Panel estudiantil"}</h1></div><div className="header-actions">{user.isAdmin ? <Link className="secondary-button link-button" href="/admin">Administración</Link> : <Link className="secondary-button link-button" href="/">Inicio</Link>}<button className="secondary-button" onClick={logout}>Cerrar sesión</button></div></header>
    <ProfileForm />
    {participantRole === "student" && user.candidate ? <CandidateDashboard candidateId={String(user.candidate)} /> : null}
    {participantRole === "teacher" ? <TeacherDashboard /> : null}
  </main>;
}
