"use client";

import { useCallback, useEffect, useState } from "react";

import { callLomatonApi } from "@/lib/pocketbase/browser-api";
import { AdminCertificatePanel, type AdminCertificateMetadata } from "./admin-certificate-panel";

type ReviewStatus = "pending" | "approved" | "rejected";
type QueueItem = AdminCertificateMetadata & { id: string; candidateId: string; candidateName: string; candidateEmail: string };
type QueueResponse = { items: QueueItem[]; page: number; perPage: number; totalItems: number; totalPages: number };

const filters: Array<{ value: ReviewStatus; label: string }> = [
  { value: "pending", label: "Pendientes" },
  { value: "approved", label: "Aprobados" },
  { value: "rejected", label: "Rechazados" },
];

export function AdminCertificateReviewQueue() {
  const [status, setStatus] = useState<ReviewStatus>("pending");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<QueueResponse | null>(null);
  const [selectedCandidateId, setSelectedCandidateId] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    const value = await callLomatonApi<QueueResponse>(`/api/lomaton/admin/certificates?status=${status}&page=${page}&perPage=20`);
    setMessage("");
    setData(value);
    setSelectedCandidateId((current) => current && !value.items.some((item) => item.candidateId === current) ? "" : current);
  }, [page, status]);

  useEffect(() => {
    let active = true;
    callLomatonApi<QueueResponse>(`/api/lomaton/admin/certificates?status=${status}&page=${page}&perPage=20`)
      .then((value) => {
        if (!active) return;
        setMessage("");
        setData(value);
        setSelectedCandidateId((current) => current && !value.items.some((item) => item.candidateId === current) ? "" : current);
      })
      .catch((error) => { if (active) setMessage(error instanceof Error ? error.message : "No se pudo cargar la cola."); });
    return () => { active = false; };
  }, [page, status]);

  function changeStatus(next: ReviewStatus) {
    setData(null);
    setMessage("");
    setStatus(next);
    setPage(1);
    setSelectedCandidateId("");
  }

  return (
    <section className="panel" aria-labelledby="certificate-review-title">
      <div className="section-heading">
        <div><h2 id="certificate-review-title">Revisión de certificados</h2><p className="muted">Revisá cada PDF sin alterar la situación FTCA ni los equipos.</p></div>
        {data ? <span className="role-chip">{data.totalItems} registros</span> : null}
      </div>
      <div className="header-actions" role="group" aria-label="Filtrar certificados por estado">
        {filters.map((filter) => <button key={filter.value} type="button" className={status === filter.value ? "primary-button" : "secondary-button"} aria-pressed={status === filter.value} onClick={() => changeStatus(filter.value)}>{filter.label}</button>)}
      </div>
      {message ? <div className="alert" role="alert">{message}</div> : null}
      {!data && !message ? <p className="muted" role="status">Cargando certificados…</p> : null}
      {data?.items.length === 0 ? <p className="muted">No hay certificados en este estado.</p> : null}
      {data?.items.length ? (
        <div className="certificate-review-list">
          {data.items.map((item) => (
            <article key={item.id} className="certificate-review-item">
              <div><strong>{item.candidateName}</strong><p className="muted">{item.candidateEmail || "Sin correo informado"}</p><span>{item.originalName}</span></div>
              <button type="button" className="secondary-button" aria-expanded={selectedCandidateId === item.candidateId} onClick={() => setSelectedCandidateId((current) => current === item.candidateId ? "" : item.candidateId)}>{selectedCandidateId === item.candidateId ? "Cerrar revisión" : "Revisar"}</button>
              {selectedCandidateId === item.candidateId ? <AdminCertificatePanel candidateId={item.candidateId} onReviewed={() => void load()} /> : null}
            </article>
          ))}
        </div>
      ) : null}
      {data && data.totalPages > 1 ? (
        <nav className="header-actions" aria-label="Páginas de certificados">
          <button className="secondary-button" type="button" disabled={page <= 1} onClick={() => { setData(null); setPage((value) => value - 1); }}>Anterior</button>
          <span aria-live="polite">Página {data.page} de {data.totalPages}</span>
          <button className="secondary-button" type="button" disabled={page >= data.totalPages} onClick={() => { setData(null); setPage((value) => value + 1); }}>Siguiente</button>
        </nav>
      ) : null}
    </section>
  );
}
