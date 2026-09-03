"use client";

import { useCallback, useEffect, useState } from "react";

import type { CertificateMetadata } from "@/app/candidate/student-certificate-card";
import { BrowserApiError, callLomatonApi, fetchLomatonFile } from "@/lib/pocketbase/browser-api";

export type AdminCertificateMetadata = CertificateMetadata & {
  version?: string;
  reviewedAt?: string;
};

type LoadedPdf = { blob: Blob; filename: string; url: string };

const labels = {
  pending: "Pendiente de revisión",
  approved: "Aprobado",
  rejected: "Rechazado",
} as const;

function startDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function AdminCertificatePanel({ candidateId, onReviewed }: { candidateId: string; onReviewed?: (metadata: AdminCertificateMetadata) => void }) {
  const [metadata, setMetadata] = useState<AdminCertificateMetadata | null>(null);
  const [pdf, setPdf] = useState<LoadedPdf | null>(null);
  const [pdfAttempt, setPdfAttempt] = useState(0);
  const [pdfLoading, setPdfLoading] = useState(true);
  const [pdfError, setPdfError] = useState("");
  const [message, setMessage] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const loadMetadata = useCallback(async () => {
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
      .catch((error) => {
        if (active) setMessage(error instanceof Error ? error.message : "No se pudo consultar el certificado.");
      });
    return () => { active = false; };
  }, [candidateId]);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    let temporaryUrl = "";
    void Promise.resolve().then(() => {
      if (!active) return;
      setPdf(null);
      setPdfError("");
      setPdfLoading(Boolean(metadata?.present));
    });
    if (!metadata?.present) {
      return () => {
        active = false;
        controller.abort();
      };
    }
    void fetchLomatonFile(`/api/lomaton/admin/candidates/${candidateId}/certificate/download`, { signal: controller.signal })
      .then((file) => {
        if (!active) return;
        temporaryUrl = URL.createObjectURL(file.blob);
        setPdf({ ...file, url: temporaryUrl });
      })
      .catch((error) => {
        if (active && error instanceof Error && error.name !== "AbortError") {
          setPdfError(error.message || "No se pudo visualizar el certificado.");
        }
      })
      .finally(() => { if (active) setPdfLoading(false); });
    return () => {
      active = false;
      controller.abort();
      if (temporaryUrl) URL.revokeObjectURL(temporaryUrl);
    };
  }, [candidateId, metadata?.present, metadata?.version, pdfAttempt]);

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
        await loadMetadata().catch(() => undefined);
        setPdfAttempt((value) => value + 1);
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
      const file = pdf ?? await fetchLomatonFile(`/api/lomaton/admin/candidates/${candidateId}/certificate/download`);
      startDownload(file.blob, file.filename);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo descargar el certificado.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <fieldset className="certificate-admin" aria-busy={busy || pdfLoading}>
      <legend>Certificado de alumno regular</legend>
      {message ? <div className="alert" role="status">{message}</div> : null}
      {metadata === null && !message ? <p className="muted">Consultando metadatos…</p> : null}
      {metadata && !metadata.present ? <p className="muted">No presentó certificado.</p> : null}
      {metadata?.present ? (
        <div className="certificate-detail">
          <div className="certificate-metadata">
            <strong>{metadata.originalName}</strong>
            <span>{new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 }).format((metadata.sizeBytes || 0) / 1024 / 1024)} MiB</span>
            <span className="role-chip" role="status">{labels[metadata.reviewStatus || "pending"]}</span>
            <button className="secondary-button" type="button" disabled={busy} onClick={() => void download()}>Descargar PDF</button>
          </div>
          <div className="certificate-viewer" aria-live="polite">
            {pdfLoading ? <p className="muted" role="status">Preparando vista previa…</p> : null}
            {pdfError ? <div className="alert" role="alert"><p>{pdfError}</p><button className="secondary-button" type="button" onClick={() => { setPdfLoading(true); setPdfError(""); setPdfAttempt((value) => value + 1); }}>Reintentar vista previa</button></div> : null}
            {pdf ? (
              <object data={pdf.url} type="application/pdf" title={`Certificado de ${metadata.originalName}`} onError={() => setPdfError("Este navegador no pudo mostrar el PDF. Podés reintentar o descargarlo.")}>
                <p>Este navegador no puede mostrar el PDF. Usá la acción Descargar PDF.</p>
              </object>
            ) : null}
          </div>
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
