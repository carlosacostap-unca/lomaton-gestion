"use client";

import { useEffect, useRef, useState } from "react";

import { callLomatonApi, downloadLomatonFile } from "@/lib/pocketbase/browser-api";

export type CertificateMetadata = {
  present: boolean;
  originalName?: string;
  sizeBytes?: number;
  uploadedAt?: string;
  maxBytes?: number;
};

function formatBytes(bytes = 0) {
  return new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 }).format(bytes / 1024 / 1024) + " MiB";
}

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function StudentCertificateCard() {
  const [metadata, setMetadata] = useState<CertificateMetadata | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const statusRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    callLomatonApi<CertificateMetadata>("/api/lomaton/certificates/me")
      .then((value) => { if (active) setMetadata(value); })
      .catch((error) => { if (active) setMessage(error instanceof Error ? error.message : "No se pudo consultar el certificado."); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (message) statusRef.current?.focus();
  }, [message]);

  async function upload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const input = form.elements.namedItem("certificate") as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return setMessage("Seleccioná un archivo PDF.");
    if (metadata?.present && !window.confirm("¿Reemplazar el certificado actual por el archivo seleccionado?")) return;
    setBusy(true);
    setMessage("");
    try {
      const body = new FormData();
      body.set("certificate", file);
      setMetadata(await callLomatonApi<CertificateMetadata>("/api/lomaton/certificates/me", { method: "POST", body }));
      input.value = "";
      setMessage(metadata?.present ? "Certificado reemplazado." : "Certificado cargado.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo cargar el certificado.");
    } finally {
      setBusy(false);
    }
  }

  async function download() {
    setBusy(true);
    setMessage("");
    try {
      const file = await downloadLomatonFile("/api/lomaton/certificates/me/download");
      saveBlob(file.blob, file.filename);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo descargar el certificado.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel certificate-card" aria-labelledby="certificate-title" aria-busy={busy}>
      <div className="section-heading">
        <div>
          <h2 id="certificate-title">Certificado de alumno regular</h2>
          <p className="muted">Cargá un único PDF de hasta {formatBytes(metadata?.maxBytes || 10 * 1024 * 1024)}. Podés reemplazarlo si necesitás corregirlo.</p>
        </div>
        <span className={metadata?.present ? "status-open" : "role-chip"}>
          {metadata === null ? "Consultando…" : metadata.present ? "Cargado" : "Pendiente"}
        </span>
      </div>
      {metadata?.present ? (
        <div className="certificate-metadata">
          <strong>{metadata.originalName}</strong>
          <span>{formatBytes(metadata.sizeBytes)}</span>
          <span>{metadata.uploadedAt ? new Intl.DateTimeFormat("es-AR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(metadata.uploadedAt)) : ""}</span>
          <button className="secondary-button" type="button" disabled={busy} onClick={() => void download()}>Descargar PDF</button>
        </div>
      ) : null}
      <form className="upload-form" onSubmit={(event) => void upload(event)}>
        <label htmlFor="student-certificate">{metadata?.present ? "Nuevo PDF" : "Archivo PDF"}</label>
        <input id="student-certificate" name="certificate" type="file" accept="application/pdf,.pdf" required />
        <button className="primary-button" disabled={busy}>{busy ? "Procesando…" : metadata?.present ? "Reemplazar certificado" : "Cargar certificado"}</button>
      </form>
      {message ? <div className="alert" role="status" tabIndex={-1} ref={statusRef}>{message}</div> : null}
    </section>
  );
}
