"use client";

import { useState } from "react";

import { getBrowserAuthorizationHeader } from "@/lib/pocketbase/browser-api";
import type {
  RegistrationImportRow,
  RegistrationPreviewItem,
  RelationshipType,
} from "@/lib/import/registrations";

type Preview = {
  fileName: string;
  fileType: "csv" | "xlsx";
  digest: string;
  items: RegistrationPreviewItem[];
  valid: RegistrationImportRow[];
  review: RegistrationPreviewItem[];
  invalid: RegistrationPreviewItem[];
  duplicates: Array<{
    kind: "identical" | "changed";
    sourceRows: number[];
    changedFields: string[];
  }>;
  summary: {
    total: number;
    valid: number;
    review: number;
    invalid: number;
    ignoredDuplicates: number;
    candidates: number;
    mentors: number;
    pendingFtca: number;
  };
};

const relationshipLabels: Record<Exclude<RelationshipType, "pending">, string> = {
  student_ftca: "Estudiante FTCA",
  student_external: "Estudiante externo",
  teacher: "Docente mentor",
};

const statusLabels: Record<RegistrationPreviewItem["status"], string> = {
  valid: "Lista",
  review: "Revisar",
  invalid: "Inválida",
  ignored_duplicate: "Duplicada",
};

export function RegistrationImporter() {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState("");

  async function analyze(formData: FormData) {
    setBusy(true);
    setMessage("");
    setPreview(null);
    setDirty(false);
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

  function updateRow(rowNumber: number, patch: Partial<RegistrationImportRow>) {
    setPreview((current) => current ? {
      ...current,
      items: current.items.map((item) => item.row.rowNumber === rowNumber
        ? { ...item, row: { ...item.row, ...patch } }
        : item),
    } : current);
    setDirty(true);
  }

  async function revalidate() {
    if (!preview) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/imports/candidates/preview", {
        method: "POST",
        headers: {
          Authorization: getBrowserAuthorizationHeader(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fileName: preview.fileName,
          fileType: preview.fileType,
          rows: preview.items.map((item) => item.row),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudieron revalidar los cambios.");
      setPreview(data);
      setDirty(false);
      setMessage("Cambios revalidados.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudieron revalidar los cambios.");
    } finally {
      setBusy(false);
    }
  }

  async function confirmImport() {
    if (!preview || dirty || preview.summary.review > 0) return;
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
          reviewRows: preview.summary.review,
          ignoredDuplicateRows: preview.summary.ignoredDuplicates,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || data.error || "No se pudo confirmar.");
      setMessage(
        `Importación aplicada: ${data.candidatesCreated} candidatos, ${data.mentorsCreated} mentores, ${data.updated} actualizaciones y ${data.unchanged} sin cambios.`,
      );
      setPreview(null);
      window.dispatchEvent(new Event("lomaton:data-changed"));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo confirmar la importación.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <section className="panel" aria-labelledby="import-title">
        <h2 id="import-title">Importar respuestas de Google Forms</h2>
        <p className="muted">
          La vista previa no modifica PocketBase. Revisá datos privados, duplicados y
          clasificaciones antes de confirmar.
        </p>
        <form action={analyze} className="upload-form">
          <label htmlFor="candidate-file">Archivo CSV o Excel</label>
          <input id="candidate-file" name="file" type="file" accept=".csv,.xlsx" required />
          <button className="primary-button" disabled={busy}>
            {busy ? "Procesando…" : "Generar vista previa"}
          </button>
        </form>
      </section>

      {message ? <div className="alert" role="status">{message}</div> : null}

      {preview ? (
        <section className="panel" aria-labelledby="preview-title">
          <h2 id="preview-title">Vista previa · {preview.fileName}</h2>
          <div className="stats-grid">
            <div><strong>{preview.summary.valid}</strong><span>listas</span></div>
            <div><strong>{preview.summary.candidates}</strong><span>candidatos</span></div>
            <div><strong>{preview.summary.mentors}</strong><span>mentores</span></div>
            <div><strong>{preview.summary.review}</strong><span>por revisar</span></div>
            <div><strong>{preview.summary.invalid}</strong><span>inválidas</span></div>
            <div><strong>{preview.summary.ignoredDuplicates}</strong><span>duplicadas</span></div>
          </div>

          {preview.summary.review > 0 ? (
            <div className="alert" role="alert">
              Resolvé y revalidá todas las filas pendientes antes de confirmar.
            </div>
          ) : null}
          {dirty ? (
            <div className="alert" role="status">
              Hay correcciones sin revalidar.
            </div>
          ) : null}

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Fila</th><th>Estado</th><th>Persona</th><th>Contacto privado</th>
                  <th>Clasificación</th><th>Datos académicos</th><th>Observaciones</th>
                </tr>
              </thead>
              <tbody>
                {preview.items.slice(0, 150).map((item) => {
                  const row = item.row;
                  const editable = item.status !== "ignored_duplicate";
                  return (
                    <tr className={item.status === "valid" ? "" : "invalid-row"} key={row.rowNumber}>
                      <td>{row.rowNumber}</td>
                      <td>{statusLabels[item.status]}</td>
                      <td>
                        {editable ? (
                          <>
                            <input
                              aria-label={`Nombre completo fila ${row.rowNumber}`}
                              value={row.fullName}
                              onChange={(event) => updateRow(row.rowNumber, { fullName: event.target.value })}
                            />
                            <input
                              aria-label={`DNI fila ${row.rowNumber}`}
                              value={row.dni}
                              onChange={(event) => updateRow(row.rowNumber, { dni: event.target.value })}
                            />
                          </>
                        ) : row.fullName}
                      </td>
                      <td>
                        {editable ? (
                          <>
                            <input
                              aria-label={`Email fila ${row.rowNumber}`}
                              type="email"
                              value={row.email}
                              onChange={(event) => updateRow(row.rowNumber, { email: event.target.value })}
                            />
                            <input
                              aria-label={`Teléfono fila ${row.rowNumber}`}
                              value={row.phone}
                              onChange={(event) => updateRow(row.rowNumber, { phone: event.target.value })}
                            />
                          </>
                        ) : row.email}
                      </td>
                      <td>
                        <span>{relationshipLabels[row.relationship as keyof typeof relationshipLabels] ?? "Pendiente"}</span>
                        {editable ? (
                          <select
                            aria-label={`Resolver clasificación fila ${row.rowNumber}`}
                            value={row.relationshipOverride ?? ""}
                            onChange={(event) => updateRow(row.rowNumber, {
                              relationshipOverride: event.target.value
                                ? event.target.value as RegistrationImportRow["relationshipOverride"]
                                : undefined,
                            })}
                          >
                            <option value="">Clasificación automática</option>
                            {Object.entries(relationshipLabels).map(([value, label]) => (
                              <option key={value} value={value}>{label}</option>
                            ))}
                          </select>
                        ) : null}
                      </td>
                      <td>
                        <div>{row.department || row.academicUnit || "—"}</div>
                        <div>{row.career || row.externalTeacherDescription || "—"}</div>
                      </td>
                      <td>
                        {[...item.errors, ...item.warnings].map((value) => <div key={value}>{value}</div>)}
                        {editable && item.duplicate?.kind === "changed" ? (
                          <label className="check-label">
                            <input
                              type="checkbox"
                              checked={Boolean(row.acceptLatestDuplicate)}
                              onChange={(event) => updateRow(row.rowNumber, {
                                acceptLatestDuplicate: event.target.checked,
                              })}
                            />
                            Confirmar la respuesta más reciente
                          </label>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="form-actions">
            <button
              className="secondary-button"
              type="button"
              onClick={() => setPreview(null)}
              disabled={busy}
            >
              Cancelar
            </button>
            <button className="secondary-button" type="button" onClick={revalidate} disabled={busy}>
              Revalidar cambios
            </button>
            <button
              className="primary-button"
              type="button"
              onClick={confirmImport}
              disabled={busy || dirty || preview.valid.length === 0 || preview.summary.review > 0}
            >
              Confirmar importación
            </button>
          </div>
        </section>
      ) : null}
    </>
  );
}
