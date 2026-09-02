"use client";

import { useState } from "react";
import Link from "next/link";

import { useAuth } from "@/app/components/auth-provider";
import { getBrowserAuthorizationHeader } from "@/lib/pocketbase/browser-api";
import { CandidateAdminList } from "./candidate-admin-list";
import { AdminOverview } from "./admin-overview";
import { HackathonSettings } from "./hackathon-settings";
import { AdminTeamManager } from "./admin-team-manager";
import { AuditLog } from "./audit-log";
import { RegistrationImporter } from "./registration-importer";
import { AdminCertificateReviewQueue } from "./admin-certificate-review-queue";

export default function AdminPage() {
  const { user, loading, logout } = useAuth();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  if (loading) return <main className="loading-screen">Cargando administración…</main>;
  if (!user?.isAdmin) {
    return <main className="app-shell"><div className="alert" role="alert">Esta área requiere permisos de administrador.</div></main>;
  }

  async function downloadExport(kind: "candidates" | "teams", format: "csv" | "xlsx") {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/exports/${kind}/${format}`, {
        headers: { Authorization: getBrowserAuthorizationHeader() },
      });
      if (!response.ok) throw new Error("No se pudo generar la exportación.");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = response.headers.get("content-disposition")?.match(/filename="([^"]+)"/)?.[1] ?? `lomaton.${format}`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo exportar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <div><p className="eyebrow">Administración</p><h1>Padrón de candidatos</h1></div>
        <div className="header-actions">{user.registration ? <Link className="secondary-button link-button" href="/portal">Mi portal</Link> : <Link className="secondary-button link-button" href="/">Inicio</Link>}<button className="secondary-button" onClick={logout}>Cerrar sesión</button></div>
      </header>

      <AdminOverview />
      <HackathonSettings />
      <AdminTeamManager />

      <RegistrationImporter />
      <AdminCertificateReviewQueue />
      {message ? <div className="alert" role="status">{message}</div> : null}
      <CandidateAdminList />
      <section className="panel" aria-labelledby="exports-title">
        <h2 id="exports-title">Exportar resultados</h2>
        <p className="muted">Las descargas incluyen una instantánea identificada con fecha y hora argentina.</p>
        <div className="export-grid">
          {(["candidates", "teams"] as const).map((kind) => <div key={kind}><strong>{kind === "candidates" ? "Candidatos" : "Equipos"}</strong><button className="secondary-button" onClick={() => downloadExport(kind, "csv")} disabled={busy}>CSV</button><button className="primary-button" onClick={() => downloadExport(kind, "xlsx")} disabled={busy}>Excel</button></div>)}
        </div>
      </section>
      <AuditLog />
    </main>
  );
}
