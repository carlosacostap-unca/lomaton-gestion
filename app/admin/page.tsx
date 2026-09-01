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

type Preview = {
  fileName: string;
  fileType: "csv" | "xlsx";
  digest: string;
  summary: { total: number; valid: number; invalid: number; pendingFtca: number };
  valid: Array<{
    rowNumber: number;
    firstName: string;
    lastName: string;
    email: string;
    emailNormalized: string;
    ftcaStatus: "confirmed" | "not_ftca" | "pending";
  }>;
  invalid: Array<{ rowNumber: number; errors: string[] }>;
};

export default function AdminPage() {
  const { user, loading, logout } = useAuth();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  if (loading) return <main className="loading-screen">Cargando administración…</main>;
  if (!user?.isAdmin) {
    return <main className="app-shell"><div className="alert" role="alert">Esta área requiere permisos de administrador.</div></main>;
  }

  async function analyze(formData: FormData) {
    setBusy(true);
    setMessage("");
    setPreview(null);
    try {
      const response = await fetch("/api/imports/candidates/preview", {
        method: "POST",
        headers: { Authorization: getBrowserAuthorizationHeader() },
        body: formData,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo analizar el archivo.");
      setPreview(data);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo analizar el archivo.");
    } finally {
      setBusy(false);
    }
  }

  async function confirmImport() {
    if (!preview) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/imports/candidates/confirm", {
        method: "POST",
        headers: {
          Authorization: getBrowserAuthorizationHeader(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fileName: preview.fileName,
          fileType: preview.fileType,
          digest: preview.digest,
          reason: "Importación confirmada desde la administración",
          rows: preview.valid,
          invalidRows: preview.summary.invalid,
          pendingFtcaRows: preview.summary.pendingFtca,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || data.error || "No se pudo confirmar.");
      setMessage(`Importación aplicada: ${data.created} altas, ${data.updated} actualizaciones y ${data.unchanged} sin cambios.`);
      setPreview(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo confirmar la importación.");
    } finally {
      setBusy(false);
    }
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
        <div className="header-actions"><Link className="secondary-button link-button" href="/">Inicio</Link><button className="secondary-button" onClick={logout}>Cerrar sesión</button></div>
      </header>

      <AdminOverview />
      <HackathonSettings />
      <AdminTeamManager />

      <section className="panel" aria-labelledby="import-title">
        <h2 id="import-title">Importar CSV o Excel</h2>
        <p className="muted">La vista previa no modifica el padrón. Revisá filas inválidas y estados FTCA pendientes antes de confirmar.</p>
        <form action={analyze} className="upload-form">
          <label htmlFor="candidate-file">Archivo del padrón</label>
          <input id="candidate-file" name="file" type="file" accept=".csv,.xlsx" required />
          <button className="primary-button" disabled={busy}>{busy ? "Procesando…" : "Generar vista previa"}</button>
        </form>
      </section>

      {message ? <div className="alert" role="status">{message}</div> : null}

      {preview ? (
        <section className="panel" aria-labelledby="preview-title">
          <h2 id="preview-title">Vista previa · {preview.fileName}</h2>
          <div className="stats-grid">
            <div><strong>{preview.summary.valid}</strong><span>válidas</span></div>
            <div><strong>{preview.summary.pendingFtca}</strong><span>FTCA pendientes</span></div>
            <div><strong>{preview.summary.invalid}</strong><span>inválidas</span></div>
          </div>
          <div className="table-wrap">
            <table><thead><tr><th>Fila</th><th>Nombre</th><th>Email</th><th>FTCA</th></tr></thead><tbody>
              {preview.valid.slice(0, 100).map((row) => (
                <tr key={row.rowNumber}><td>{row.rowNumber}</td><td>{row.firstName} {row.lastName}</td><td>{row.email}</td><td>{row.ftcaStatus}</td></tr>
              ))}
              {preview.invalid.slice(0, 100).map((row) => (
                <tr className="invalid-row" key={row.rowNumber}><td>{row.rowNumber}</td><td colSpan={3}>{row.errors.join(" · ")}</td></tr>
              ))}
            </tbody></table>
          </div>
          <div className="form-actions">
            <button className="secondary-button" type="button" onClick={() => setPreview(null)} disabled={busy}>Cancelar</button>
            <button className="primary-button" type="button" onClick={confirmImport} disabled={busy || preview.valid.length === 0}>Confirmar importación</button>
          </div>
        </section>
      ) : null}
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
