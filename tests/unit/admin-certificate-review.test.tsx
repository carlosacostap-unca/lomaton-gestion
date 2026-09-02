// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ call: vi.fn(), download: vi.fn() }));

vi.mock("@/lib/pocketbase/browser-api", () => {
  class BrowserApiError extends Error {
    constructor(message: string, public readonly status: number, public readonly code?: string) {
      super(message);
    }
  }
  return { BrowserApiError, callLomatonApi: api.call, downloadLomatonFile: api.download };
});

import { AdminCertificatePanel } from "@/app/admin/admin-certificate-panel";
import { AdminCertificateReviewQueue } from "@/app/admin/admin-certificate-review-queue";

const sha = "a".repeat(64);

describe("administrative certificate review interface", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  afterEach(() => cleanup());

  it("keeps the version out of the UI and submits it only as the concurrency guard", async () => {
    const user = userEvent.setup();
    api.call
      .mockResolvedValueOnce({ present: true, originalName: "regular.pdf", sizeBytes: 100, reviewStatus: "pending", version: sha })
      .mockResolvedValueOnce({ present: true, originalName: "regular.pdf", sizeBytes: 100, reviewStatus: "rejected", rejectionReason: "Falta sello", version: sha });
    render(<AdminCertificatePanel candidateId="candidate000001" />);
    await screen.findByText("regular.pdf");
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

  it("loads pending records, exposes an accessible review control, and changes filters", async () => {
    const user = userEvent.setup();
    api.call
      .mockResolvedValueOnce({ items: [{ id: "cert1", candidateId: "candidate000001", candidateName: "Ada Lovelace", candidateEmail: "ada@example.test", originalName: "regular.pdf", present: true, reviewStatus: "pending", version: sha }], page: 1, perPage: 20, totalItems: 1, totalPages: 1 })
      .mockResolvedValueOnce({ items: [], page: 1, perPage: 20, totalItems: 0, totalPages: 0 });
    render(<AdminCertificateReviewQueue />);
    expect(await screen.findByText("Ada Lovelace")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Pendientes" }).getAttribute("aria-pressed")).toBe("true");
    await user.click(screen.getByRole("button", { name: "Rechazados" }));
    expect(await screen.findByText("No hay certificados en este estado.")).toBeTruthy();
    expect(api.call).toHaveBeenLastCalledWith("/api/lomaton/admin/certificates?status=rejected&page=1&perPage=20");
  });
});
