"use client";

import { useState } from "react";

import { fetchLomatonFile } from "@/lib/pocketbase/browser-api";
import type { TeamDeliverableProjection } from "@/lib/team-deliverables-contract";

export const deliverableStatusLabels = {
  none: "Sin entrega",
  draft_incomplete: "Borrador incompleto",
  draft_complete: "Borrador completo",
  finalized: "Finalizada",
} as const;

function formatDate(value: string) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(new Date(value));
}

export function DeliverableReadonly({ delivery, heading = true }: { delivery: TeamDeliverableProjection; heading?: boolean }) {
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  async function download(path: string, kind: string) {
    setBusy(kind);
    setError("");
    try {
      const result = await fetchLomatonFile(path);
      const url = URL.createObjectURL(result.blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = result.filename;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo descargar el archivo.");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="deliverable-readonly">
      {heading ? <div className="section-heading"><div><h2>{delivery.teamName}</h2><p className="muted">Actualizada: {formatDate(delivery.updatedAt)}</p></div><span className={delivery.summaryStatus === "finalized" ? "student-status is-approved" : "student-status is-pending"}>{deliverableStatusLabels[delivery.summaryStatus]}</span></div> : null}
      {delivery.lifecycle === "draft" ? <div className="alert" role="status">Esta entrega es un borrador y todavía puede cambiar hasta el plazo.</div> : null}
      {error ? <div className="alert" role="alert">{error}</div> : null}
      <dl className="deliverable-metadata">
        <div><dt>Versión</dt><dd>{delivery.version}</dd></div>
        <div><dt>Finalizada</dt><dd>{formatDate(delivery.finalizedAt)}</dd></div>
        <div><dt>Faltantes obligatorios</dt><dd>{delivery.missingRequired.length ? delivery.missingRequired.length : "Ninguno"}</dd></div>
      </dl>
      <div className="deliverable-product-list">
        {delivery.products.map((product) => (
          <article className="deliverable-product-card" key={product.kind}>
            <div className="section-heading"><h3>{product.label}</h3><span className={product.medium === "none" ? "student-status is-pending" : "student-status is-approved"}>{product.medium === "none" ? "No presentado" : product.medium === "file" ? "Archivo" : "Enlace"}</span></div>
            {product.medium === "file" && product.downloadPath ? <><p><strong>{product.originalName}</strong></p><p className="muted">{Math.ceil((product.sizeBytes ?? 0) / 1024)} KiB · {product.mimeType} · {formatDate(product.updatedAt ?? "")}</p><button type="button" className="secondary-button" disabled={Boolean(busy)} onClick={() => void download(product.downloadPath!, product.kind)}>{busy === product.kind ? "Descargando…" : "Descargar"}</button></> : null}
            {product.medium === "link" ? <><p className="muted">Actualizado: {formatDate(product.updatedAt ?? "")}</p><a className="secondary-button link-button" href={product.url} target="_blank" rel="noreferrer">Abrir enlace</a></> : null}
            {product.medium === "none" ? <p className="muted">{product.required ? "Producto obligatorio pendiente." : "Producto opcional no presentado."}</p> : null}
          </article>
        ))}
      </div>
    </div>
  );
}
