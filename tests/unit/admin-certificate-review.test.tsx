// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ call: vi.fn(), file: vi.fn() }));

vi.mock("@/lib/pocketbase/browser-api", () => {
  class BrowserApiError extends Error {
    constructor(message: string, public readonly status: number, public readonly code?: string) {
      super(message);
    }
  }
  return { BrowserApiError, callLomatonApi: api.call, fetchLomatonFile: api.file, downloadLomatonFile: api.file };
});

import { AdminCertificatePanel } from "@/app/admin/admin-certificate-panel";
import { AdminCertificateReviewQueue } from "@/app/admin/admin-certificate-review-queue";
import { BrowserApiError } from "@/lib/pocketbase/browser-api";

const sha = "a".repeat(64);
const pdfFile = { blob: new Blob(["%PDF-1.7"], { type: "application/pdf" }), filename: "regular.pdf" };

describe("administrative certificate review interface", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.call.mockReset();
    api.file.mockReset().mockResolvedValue(pdfFile);
    vi.spyOn(window, "confirm").mockReturnValue(true);
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn(() => `blob:certificate-${Math.random()}`) });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
    window.history.replaceState(null, "", "/admin/certificados");
  });

  afterEach(() => cleanup());

  it("keeps the version out of the UI and submits it only as the concurrency guard", async () => {
    const user = userEvent.setup();
    api.call
      .mockResolvedValueOnce({ present: true, originalName: "regular.pdf", sizeBytes: 100, reviewStatus: "pending", version: sha })
      .mockResolvedValueOnce({ present: true, originalName: "regular.pdf", sizeBytes: 100, reviewStatus: "rejected", rejectionReason: "Falta sello", version: sha });
    render(<AdminCertificatePanel candidateId="candidate000001" />);
    await screen.findByTitle("Certificado de regular.pdf");
    expect(document.body.textContent).not.toContain(sha);
    await user.type(screen.getByLabelText("Motivo de rechazo"), "Falta sello");
    await user.click(screen.getByRole("button", { name: "Rechazar" }));
    await waitFor(() => expect(api.call).toHaveBeenCalledTimes(2));
    expect(api.call.mock.calls[1]).toEqual([
      "/api/lomaton/admin/candidates/candidate000001/certificate",
      { method: "PATCH", body: { decision: "rejected", reason: "Falta sello", expectedSha256: sha } },
    ]);
    expect(await screen.findByText("Certificado rechazado.")).toBeTruthy();
  });

  it("requires a visible reason before rejecting", async () => {
    const user = userEvent.setup();
    api.call.mockResolvedValueOnce({ present: true, originalName: "regular.pdf", reviewStatus: "pending", version: sha });
    render(<AdminCertificatePanel candidateId="candidate000001" />);
    await screen.findByText("regular.pdf");
    await user.click(screen.getByRole("button", { name: "Rechazar" }));
    expect(await screen.findByText("Indicá el motivo que verá el candidato.")).toBeTruthy();
    expect(api.call).toHaveBeenCalledTimes(1);
  });

  it("revokes the private object URL when the selected certificate changes and on unmount", async () => {
    api.call.mockResolvedValue({ present: true, originalName: "regular.pdf", reviewStatus: "pending", version: sha });
    const view = render(<AdminCertificatePanel candidateId="candidate000001" />);
    await screen.findByTitle("Certificado de regular.pdf");
    view.rerender(<AdminCertificatePanel candidateId="candidate000002" />);
    await waitFor(() => expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(api.file).toHaveBeenCalledWith(
      "/api/lomaton/admin/candidates/candidate000002/certificate/download",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    ));
    view.unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2);
  });

  it("loads a summarized queue, keeps only one detail selected, and stores filters in the URL", async () => {
    const user = userEvent.setup();
    api.call
      .mockResolvedValueOnce({ items: [
        { id: "cert1", candidateId: "candidate000001", candidateName: "Ada Lovelace", candidateEmail: "ada@example.test", originalName: "regular.pdf", present: true, reviewStatus: "pending", version: sha },
        { id: "cert2", candidateId: "candidate000002", candidateName: "Grace Hopper", candidateEmail: "grace@example.test", originalName: "constancia.pdf", present: true, reviewStatus: "pending", version: sha },
      ], page: 1, perPage: 20, totalItems: 2, totalPages: 1 })
      .mockResolvedValueOnce({ present: true, originalName: "regular.pdf", reviewStatus: "pending", version: sha })
      .mockResolvedValueOnce({ items: [], page: 1, perPage: 20, totalItems: 0, totalPages: 0 });
    render(<AdminCertificateReviewQueue />);
    expect(await screen.findByText("Ada Lovelace")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Pendientes" }).getAttribute("aria-pressed")).toBe("true");
    await user.click(screen.getAllByRole("button", { name: "Revisar" })[0]);
    expect(await screen.findByTitle("Certificado de regular.pdf")).toBeTruthy();
    expect(document.querySelectorAll("object[type='application/pdf']")).toHaveLength(1);
    expect(window.location.search).toContain("candidato=candidate000001");
    await user.click(screen.getByRole("button", { name: "Rechazados" }));
    expect(await screen.findByText("No hay certificados en este estado.")).toBeTruthy();
    expect(window.location.search).toBe("?estado=rejected");
    expect(api.call).toHaveBeenLastCalledWith("/api/lomaton/admin/certificates?status=rejected&page=1&perPage=20");
  });

  it("shows a retry path when the authenticated PDF cannot be loaded", async () => {
    api.call.mockResolvedValue({ present: true, originalName: "regular.pdf", reviewStatus: "pending", version: sha });
    api.file.mockRejectedValueOnce(new Error("No se pudo recuperar el PDF")).mockResolvedValueOnce(pdfFile);
    const user = userEvent.setup();
    render(<AdminCertificatePanel candidateId="candidate000001" />);
    expect(await screen.findByText("No se pudo recuperar el PDF")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Reintentar vista previa" }));
    expect(await screen.findByTitle("Certificado de regular.pdf")).toBeTruthy();
  });

  it("restores filter and page when browser history changes", async () => {
    api.call
      .mockResolvedValueOnce({ items: [], page: 1, perPage: 20, totalItems: 0, totalPages: 0 })
      .mockResolvedValueOnce({ items: [], page: 2, perPage: 20, totalItems: 21, totalPages: 2 });
    render(<AdminCertificateReviewQueue />);
    await screen.findByText("No hay certificados en este estado.");
    window.history.pushState(null, "", "/admin/certificados?estado=approved&pagina=2");
    window.dispatchEvent(new PopStateEvent("popstate"));
    await waitFor(() => expect(api.call).toHaveBeenLastCalledWith("/api/lomaton/admin/certificates?status=approved&page=2&perPage=20"));
    expect(screen.getByRole("button", { name: "Aprobados" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("reloads the current version instead of applying an obsolete decision", async () => {
    const nextSha = "b".repeat(64);
    api.call
      .mockResolvedValueOnce({ present: true, originalName: "regular.pdf", reviewStatus: "pending", version: sha })
      .mockRejectedValueOnce(new BrowserApiError("Conflicto", 409, "certificate_review_conflict"))
      .mockResolvedValueOnce({ present: true, originalName: "actualizado.pdf", reviewStatus: "pending", version: nextSha });
    const user = userEvent.setup();
    render(<AdminCertificatePanel candidateId="candidate000001" />);
    await screen.findByTitle("Certificado de regular.pdf");
    await user.click(screen.getByRole("button", { name: "Aprobar" }));
    expect(await screen.findByText(/reemplazó el certificado/)).toBeTruthy();
    expect(await screen.findByText("actualizado.pdf")).toBeTruthy();
    expect(api.call).toHaveBeenCalledTimes(3);
  });
});
