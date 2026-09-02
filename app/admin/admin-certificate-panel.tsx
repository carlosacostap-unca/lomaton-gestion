"use client";

import { useCallback, useEffect, useState } from "react";

import type { CertificateMetadata } from "@/app/candidate/student-certificate-card";
import { BrowserApiError, callLomatonApi, downloadLomatonFile } from "@/lib/pocketbase/browser-api";

export type AdminCertificateMetadata = CertificateMetadata & {
  version?: string;
  reviewedAt?: string;
};

const labels = {
  pending: "Pendiente de revisión",
  approved: "Aprobado",
  rejected: "Rechazado",
} as const;

export function AdminCertificatePanel({ candidateId, onReviewed }: { candidateId: string; onReviewed?: (metadata: AdminCertificateMetadata) => void }) {
  const [metadata, setMetadata] = useState<AdminCertificateMetadata | null>(null);
  const [message, setMessage] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const value = await callLomatonApi<AdminCertificateMetadata>(`/api/lomaton/admin/candidates/${candidateId}/certificate`);
    setMessage("");
    setMetadata(value);
    setReason(value.reviewStatus === "rejected" ? value.rejectionReason || "" : "");
    return value;
  }, [candidateId]);

  useEffect(() => {
    let active = true;
    callLomatonApi<AdminCertificateMetadata>(`/api/lomaton/admin/candidates/${candidateId}/certificate`)
      .then((value) => {
        if (!active) return;
        setMessage("");
        setMetadata(value);
        setReason(value.reviewStatus === "rejected" ? value.rejectionReason || "" : "");
      })
      .catch((error) => { if (active) setMessage(error instanceof Error ? error.message : "No se pudo consultar el certificado."); });
    return () => { active = false; };
  }, [candidateId]);

  async function decide(decision: "approved" | "rejected") {
    if (!metadata?.version) return;
    const normalizedReason = reason.trim().replace(/\s+/g, " ");
    if (decision === "rejected" && !normalizedReason) {
      setMessage("Indicá el motivo que verá el candidato.");
      return;
    }
    const action = decision === "approved" ? "aprobar" : "rechazar";
    if (!window.confirm(`¿Confirmás que querés ${action} este certificado?`)) return;
    setBusy(true);
    setMessage("");
    try {
      const value = await callLomatonApi<AdminCertificateMetadata>(`/api/lomaton/admin/candidates/${candidateId}/certificate`, {
        method: "PATCH",
        body: { decision, reason: normalizedReason, expectedSha256: metadata.version },
      });
      setMetadata(value);
      setReason(value.reviewStatus === "rejected" ? value.rejectionReason || "" : "");
      setMessage(decision === "approved" ? "Certificado aprobado." : "Certificado rechazado.");
      onReviewed?.(value);
    } catch (error) {
      if (error instanceof BrowserApiError && error.status === 409) {
        await load().catch(() => undefined);
        setMessage("El candidato reemplazó el certificado. Se cargó la versión vigente para que la revises.");
      } else {
        setMessage(error instanceof Error ? error.message : "No se pudo registrar la revisión.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function download() {
    setBusy(true);
    setMessage("");
    try {
      const file = await downloadLomatonFile(`/api/lomaton/admin/candidates/${candidateId}/certificate/download`);
      const url = URL.createObjectURL(file.blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = file.filename;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo descargar el certificado.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <fieldset className="certificate-admin" aria-busy={busy}>
      <legend>Certificado de alumno regular</legend>
      {message ? <div className="alert" role="status">{message}</div> : null}
      {metadata === null && !message ? <p className="muted">Consultando…</p> : null}
      {metadata && !metadata.present ? <p className="muted">No presentó certificado.</p> : null}
      {metadata?.present ? (
        <div className="certificate-metadata">
          <strong>{metadata.originalName}</strong>
          <span>{new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 }).format((metadata.sizeBytes || 0) / 1024 / 1024)} MiB</span>
          <span className="role-chip" role="status">{labels[metadata.reviewStatus || "pending"]}</span>
          <button className="secondary-button" type="button" disabled={busy} onClick={() => void download()}>Descargar PDF</button>
          <label htmlFor={`certificate-reason-${candidateId}`}>Motivo de rechazo</label>
          <textarea id={`certificate-reason-${candidateId}`} value={reason} maxLength={1000} rows={3} disabled={busy} onChange={(event) => setReason(event.target.value)} aria-describedby={`certificate-reason-help-${candidateId}`} />
          <small id={`certificate-reason-help-${candidateId}`} className="muted">Obligatorio al rechazar; será visible para el candidato.</small>
          <div className="header-actions">
            <button className="primary-button" type="button" disabled={busy} onClick={() => void decide("approved")}>Aprobar</button>
            <button className="secondary-button" type="button" disabled={busy} onClick={() => void decide("rejected")}>Rechazar</button>
          </div>
        </div>
      ) : null}
    </fieldset>
  );
}
