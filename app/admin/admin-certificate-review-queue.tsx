"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { callLomatonApi } from "@/lib/pocketbase/browser-api";
import { AdminCertificatePanel, type AdminCertificateMetadata } from "./admin-certificate-panel";

export type ReviewStatus = "pending" | "approved" | "rejected";
type QueueItem = AdminCertificateMetadata & { id: string; candidateId: string; candidateName: string; candidateEmail: string };
type QueueResponse = { items: QueueItem[]; page: number; perPage: number; totalItems: number; totalPages: number };

const filters: Array<{ value: ReviewStatus; label: string }> = [
  { value: "pending", label: "Pendientes" },
  { value: "approved", label: "Aprobados" },
  { value: "rejected", label: "Rechazados" },
];

function writeUrl(state: { status: ReviewStatus; page: number; candidateId: string }, mode: "push" | "replace" = "push") {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams();
  if (state.status !== "pending") params.set("estado", state.status);
  if (state.page !== 1) params.set("pagina", String(state.page));
  if (state.candidateId) params.set("candidato", state.candidateId);
  const next = `${window.location.pathname}${params.size ? `?${params}` : ""}`;
  window.history[mode === "push" ? "pushState" : "replaceState"](null, "", next);
}

function readUrl(fallback: { status: ReviewStatus; page: number; candidateId: string }) {
  if (typeof window === "undefined") return fallback;
  const params = new URLSearchParams(window.location.search);
  const requestedStatus = params.get("estado");
  const requestedPage = Number(params.get("pagina"));
  return {
    status: filters.some(({ value }) => value === requestedStatus) ? requestedStatus as ReviewStatus : "pending",
    page: Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1,
    candidateId: params.get("candidato") || "",
  };
}

export function AdminCertificateReviewQueue({ initialStatus = "pending", initialPage = 1, initialCandidateId = "" }: { initialStatus?: ReviewStatus; initialPage?: number; initialCandidateId?: string }) {
  const initial = useMemo(() => ({ status: initialStatus, page: initialPage, candidateId: initialCandidateId }), [initialCandidateId, initialPage, initialStatus]);
  const [status, setStatus] = useState<ReviewStatus>(initialStatus);
  const [page, setPage] = useState(initialPage);
  const [data, setData] = useState<QueueResponse | null>(null);
  const [selectedCandidateId, setSelectedCandidateId] = useState(initialCandidateId);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    const value = await callLomatonApi<QueueResponse>(`/api/lomaton/admin/certificates?status=${status}&page=${page}&perPage=20`);
    setMessage("");
    setData(value);
    setSelectedCandidateId((current) => current && !value.items.some((item) => item.candidateId === current) ? "" : current);
  }, [page, status]);

  useEffect(() => {
    const popstate = () => {
      const next = readUrl(initial);
      setStatus(next.status);
      setPage(next.page);
      setSelectedCandidateId(next.candidateId);
      setData(null);
      setMessage("");
    };
    window.addEventListener("popstate", popstate);
    return () => window.removeEventListener("popstate", popstate);
  }, [initial]);

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

  const selected = data?.items.find((item) => item.candidateId === selectedCandidateId);

  function changeStatus(next: ReviewStatus) {
    setData(null);
    setMessage("");
    setStatus(next);
    setPage(1);
    setSelectedCandidateId("");
    writeUrl({ status: next, page: 1, candidateId: "" });
  }

  function select(candidateId: string) {
    const next = selectedCandidateId === candidateId ? "" : candidateId;
    setSelectedCandidateId(next);
    writeUrl({ status, page, candidateId: next });
  }

  function changePage(next: number) {
    setData(null);
    setPage(next);
    setSelectedCandidateId("");
    writeUrl({ status, page: next, candidateId: "" });
  }

  return (
    <section className="panel" aria-labelledby="certificate-review-title">
      <div className="section-heading">
        <div><h2 id="certificate-review-title">Revisión de certificados</h2><p className="muted">Visualizá y revisá cada PDF sin alterar la situación FTCA ni los equipos.</p></div>
        {data ? <span className="role-chip">{data.totalItems} registros</span> : null}
      </div>
      <div className="header-actions" role="group" aria-label="Filtrar certificados por estado">
        {filters.map((filter) => <button key={filter.value} type="button" className={status === filter.value ? "primary-button" : "secondary-button"} aria-pressed={status === filter.value} onClick={() => changeStatus(filter.value)}>{filter.label}</button>)}
      </div>
      {message ? <div className="alert" role="alert"><p>{message}</p><button className="secondary-button" type="button" onClick={() => void load()}>Reintentar</button></div> : null}
      {!data && !message ? <p className="muted" role="status">Cargando certificados…</p> : null}
      {data?.items.length === 0 ? <p className="muted">No hay certificados en este estado.</p> : null}
      {data?.items.length ? (
        <div className="certificate-review-workspace">
          <div className="certificate-review-list" aria-label="Certificados encontrados">
            {data.items.map((item) => (
              <article key={item.id} className={selectedCandidateId === item.candidateId ? "certificate-review-item is-selected" : "certificate-review-item"}>
                <div><strong>{item.candidateName}</strong><p className="muted">{item.candidateEmail || "Sin correo informado"}</p><span>{item.originalName}</span></div>
                <button type="button" className="secondary-button" aria-expanded={selectedCandidateId === item.candidateId} onClick={() => select(item.candidateId)}>{selectedCandidateId === item.candidateId ? "Cerrar" : "Revisar"}</button>
              </article>
            ))}
          </div>
          <div className="certificate-review-detail">
            {selected ? <AdminCertificatePanel key={selected.candidateId} candidateId={selected.candidateId} onReviewed={() => void load()} /> : <div className="empty-detail"><strong>Elegí un certificado</strong><p className="muted">El documento y las acciones de revisión aparecerán aquí.</p></div>}
          </div>
        </div>
      ) : null}
      {data && data.totalPages > 1 ? (
        <nav className="header-actions" aria-label="Páginas de certificados">
          <button className="secondary-button" type="button" disabled={page <= 1} onClick={() => changePage(page - 1)}>Anterior</button>
          <span aria-live="polite">Página {data.page} de {data.totalPages}</span>
          <button className="secondary-button" type="button" disabled={page >= data.totalPages} onClick={() => changePage(page + 1)}>Siguiente</button>
        </nav>
      ) : null}
    </section>
  );
}
