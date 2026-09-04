"use client";

import { useEffect, useState } from "react";

import {
  callLomatonApi,
  fetchLomatonFile,
  BrowserApiError,
} from "@/lib/pocketbase/browser-api";
import type {
  DeliverableProductProjection,
  TeamDeliverableKind,
  TeamDeliverableMedium,
  TeamDeliverableProjection,
} from "@/lib/team-deliverables-contract";

const statusLabels = {
  none: "Sin entrega",
  draft_incomplete: "Borrador incompleto",
  draft_complete: "Borrador completo",
  finalized: "Entrega finalizada",
} as const;

function deadlineLabel(value: string) {
  if (!value) return "La organización todavía no configuró el plazo.";
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(new Date(value));
}

function productHelp(product: DeliverableProductProjection) {
  const format = product.allowedExtensions.length
    ? `Formatos: ${product.allowedExtensions.map((item) => item.toUpperCase()).join(", ")}. Máximo: 25 MiB.`
    : "Ingresá un enlace público HTTP o HTTPS.";
  return `${product.required ? "Obligatorio." : "Opcional."} ${format}`;
}

export function TeamDeliverableCard() {
  const [delivery, setDelivery] = useState<TeamDeliverableProjection | null>(null);
  const [media, setMedia] = useState<Partial<Record<TeamDeliverableKind, TeamDeliverableMedium>>>({});
  const [busy, setBusy] = useState<TeamDeliverableKind | "finalize" | "">("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    const next = await callLomatonApi<TeamDeliverableProjection>("/api/lomaton/me/deliverable");
    setDelivery(next);
    setMedia(Object.fromEntries(next.products.map((product) => [
      product.kind,
      product.medium === "none" ? product.allowedMedia[0] : product.medium,
    ])));
  }

  useEffect(() => {
    let active = true;
    callLomatonApi<TeamDeliverableProjection>("/api/lomaton/me/deliverable")
      .then((next) => {
        if (!active) return;
        setDelivery(next);
        setMedia(Object.fromEntries(next.products.map((product) => [
          product.kind,
          product.medium === "none" ? product.allowedMedia[0] : product.medium,
        ])));
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : "No se pudo cargar la entrega.");
      });
    return () => { active = false; };
  }, []);

  function handleError(reason: unknown) {
    if (reason instanceof BrowserApiError && reason.code === "deliverable_version_conflict") {
      setError("Otro integrante modificó la entrega. Recargamos la versión más reciente.");
      void load();
      return;
    }
    setError(reason instanceof Error ? reason.message : "No se pudo actualizar la entrega.");
  }

  async function saveProduct(product: DeliverableProductProjection, formData: FormData) {
    if (!delivery || busy) return;
    setBusy(product.kind);
    setError("");
    setMessage("");
    try {
      const selected = media[product.kind] ?? product.allowedMedia[0];
      if (selected === "file") {
        const file = formData.get("file");
        if (!(file instanceof File) || !file.size) throw new Error("Seleccioná un archivo antes de guardar.");
        const upload = new FormData();
        upload.set("expectedVersion", String(delivery.version));
        upload.set("file", file);
        await callLomatonApi(`/api/lomaton/me/deliverable/products/${product.kind}`, { method: "PATCH", body: upload });
      } else {
        await callLomatonApi(`/api/lomaton/me/deliverable/products/${product.kind}`, {
          method: "PATCH",
          body: { expectedVersion: delivery.version, url: String(formData.get("url") ?? "") },
        });
      }
      await load();
      setMessage(`${product.label} guardado. La entrega quedó en borrador.`);
    } catch (reason) {
      handleError(reason);
    } finally {
      setBusy("");
    }
  }

  async function removeProduct(product: DeliverableProductProjection) {
    if (!delivery || busy || !window.confirm(`¿Retirar ${product.label} de la entrega?`)) return;
    setBusy(product.kind);
    setError("");
    try {
      await callLomatonApi(`/api/lomaton/me/deliverable/products/${product.kind}`, {
        method: "DELETE",
        body: { expectedVersion: delivery.version },
      });
      await load();
      setMessage(`${product.label} retirado.`);
    } catch (reason) {
      handleError(reason);
    } finally {
      setBusy("");
    }
  }

  async function finalize() {
    if (!delivery || busy || !window.confirm("¿Finalizar la entrega? Podrán editarla hasta el plazo, pero cualquier cambio la devolverá a borrador.")) return;
    setBusy("finalize");
    setError("");
    try {
      await callLomatonApi("/api/lomaton/me/deliverable/finalize", {
        method: "POST",
        body: { expectedVersion: delivery.version },
      });
      await load();
      setMessage("Entrega finalizada correctamente.");
    } catch (reason) {
      handleError(reason);
    } finally {
      setBusy("");
    }
  }

  async function download(product: DeliverableProductProjection) {
    if (!product.downloadPath || busy) return;
    setBusy(product.kind);
    setError("");
    try {
      const result = await fetchLomatonFile(product.downloadPath);
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

  if (!delivery) {
    return <section className="panel" aria-live="polite"><h2>Entrega del equipo</h2><p>{error || "Cargando entrega…"}</p></section>;
  }

  return (
    <section className="panel" aria-labelledby="team-deliverable-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Entrega compartida · versión {delivery.version}</p>
          <h2 id="team-deliverable-title">Productos del equipo</h2>
          <p className="muted">Plazo: {deadlineLabel(delivery.deadlineUtc)} (hora argentina).</p>
        </div>
        <span className={delivery.summaryStatus === "finalized" ? "student-status is-approved" : "student-status is-pending"}>
          {statusLabels[delivery.summaryStatus]}
        </span>
      </div>
      {delivery.lifecycle === "finalized" && delivery.canEdit ? <div className="alert">Si editás o retirás un producto, la entrega volverá a borrador y deberá finalizarse nuevamente.</div> : null}
      {!delivery.canEdit ? <div className="alert" role="status">El plazo está cerrado. La entrega queda disponible en modo de consulta.</div> : null}
      {message ? <div className="alert" role="status" tabIndex={-1}>{message}</div> : null}
      {error ? <div className="alert" role="alert">{error}</div> : null}
      <div className="deliverable-product-list">
        {delivery.products.map((product) => {
          const selected = media[product.kind] ?? product.allowedMedia[0];
          return (
            <article className="deliverable-product-card" key={product.kind}>
              <div className="section-heading">
                <div><h3>{product.label}</h3><p className="muted">{productHelp(product)}</p></div>
                <span className={product.medium === "none" ? "student-status is-pending" : "student-status is-approved"}>{product.medium === "none" ? "Pendiente" : product.medium === "file" ? "Archivo cargado" : "Enlace cargado"}</span>
              </div>
              {product.medium === "file" ? <p><strong>{product.originalName}</strong> · {Math.ceil((product.sizeBytes ?? 0) / 1024)} KiB <button className="text-button" type="button" disabled={Boolean(busy)} onClick={() => void download(product)}>Descargar</button></p> : null}
              {product.medium === "link" ? <p><a href={product.url} target="_blank" rel="noreferrer">Abrir enlace de {product.label}</a></p> : null}
              {delivery.canEdit ? (
                <form action={(formData) => saveProduct(product, formData)} className="upload-form">
                  {product.allowedMedia.length > 1 ? <label>Modalidad<select value={selected} disabled={Boolean(busy)} onChange={(event) => setMedia((current) => ({ ...current, [product.kind]: event.target.value as TeamDeliverableMedium }))}>{product.allowedMedia.map((item) => <option key={item} value={item}>{item === "file" ? "Archivo" : "Enlace"}</option>)}</select></label> : null}
                  {selected === "file" ? <label>Seleccionar archivo<input name="file" type="file" required accept={product.allowedExtensions.map((item) => `.${item}`).join(",")} /></label> : <label>Enlace HTTP(S)<input name="url" type="url" required maxLength={2048} placeholder="https://…" defaultValue={product.medium === "link" ? product.url : ""} /></label>}
                  <div className="form-actions">
                    <button className="primary-button" disabled={Boolean(busy)}>{busy === product.kind ? "Guardando…" : product.medium === "none" ? "Guardar" : "Sustituir"}</button>
                    {product.medium !== "none" ? <button className="secondary-button" type="button" disabled={Boolean(busy)} onClick={() => void removeProduct(product)}>Retirar</button> : null}
                  </div>
                </form>
              ) : null}
            </article>
          );
        })}
      </div>
      <div className="form-actions">
        <button className="primary-button" type="button" disabled={!delivery.canEdit || Boolean(busy) || delivery.missingRequired.length > 0 || delivery.lifecycle === "finalized"} onClick={() => void finalize()}>{busy === "finalize" ? "Finalizando…" : "Finalizar entrega"}</button>
        {delivery.missingRequired.length ? <p className="muted">Faltan {delivery.missingRequired.length} productos obligatorios.</p> : null}
      </div>
    </section>
  );
}
