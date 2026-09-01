"use client";

import { useEffect, useState } from "react";

import type { CertificateMetadata } from "@/app/candidate/student-certificate-card";
import { callLomatonApi, downloadLomatonFile } from "@/lib/pocketbase/browser-api";

export function AdminCertificatePanel({ candidateId }: { candidateId: string }) {
  const [metadata, setMetadata] = useState<CertificateMetadata | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    callLomatonApi<CertificateMetadata>(`/api/lomaton/admin/candidates/${candidateId}/certificate`)
      .then((value) => { if (active) setMetadata(value); })
      .catch((error) => { if (active) setMessage(error instanceof Error ? error.message : "No se pudo consultar el certificado."); });
    return () => { active = false; };
  }, [candidateId]);

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
          <button className="secondary-button" type="button" disabled={busy} onClick={() => void download()}>Descargar PDF</button>
        </div>
      ) : null}
    </fieldset>
  );
}
