// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  call: vi.fn(),
  download: vi.fn(),
}));

vi.mock("@/lib/pocketbase/browser-api", () => ({
  callLomatonApi: api.call,
  downloadLomatonFile: api.download,
}));

import { StudentCertificateCard } from "@/app/candidate/student-certificate-card";

describe("StudentCertificateCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.call.mockResolvedValue({ present: false });
  });

  afterEach(() => cleanup());

  it("presents an accessible empty state and accepts only PDF selection", async () => {
    render(<StudentCertificateCard />);
    expect(await screen.findByText("Sin presentar")).toBeTruthy();
    const input = screen.getByLabelText("Archivo PDF") as HTMLInputElement;
    expect(input.accept).toContain("application/pdf");
    expect(screen.getByRole("button", { name: "Cargar certificado" })).toBeTruthy();
  });

  it("uploads FormData and shows the current metadata", async () => {
    const user = userEvent.setup();
    api.call
      .mockResolvedValueOnce({ present: false })
      .mockResolvedValueOnce({ present: true, originalName: "regular.pdf", sizeBytes: 1048576, uploadedAt: "2030-09-01T12:00:00Z" });
    render(<StudentCertificateCard />);
    await screen.findByText("Sin presentar");
    const input = screen.getByLabelText("Archivo PDF") as HTMLInputElement;
    await user.upload(input, new File(["%PDF-1.7"], "regular.pdf", { type: "application/pdf" }));
    expect(input.files).toHaveLength(1);
    fireEvent.submit(input.form as HTMLFormElement);
    await waitFor(() => expect(api.call).toHaveBeenCalledTimes(2));
    expect(api.call.mock.calls[1][1]).toMatchObject({ method: "POST", body: expect.any(FormData) });
    expect(await screen.findByText("regular.pdf")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Descargar PDF" })).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByText("Certificado cargado."));
  });

  it("shows a rejection reason and warns that replacement resets review", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "confirm").mockReturnValue(false);
    api.call.mockResolvedValueOnce({ present: true, originalName: "rechazado.pdf", sizeBytes: 100, reviewStatus: "rejected", rejectionReason: "Falta sello" });
    render(<StudentCertificateCard />);
    expect(await screen.findByText("Rechazado")).toBeTruthy();
    expect(screen.getByText("Motivo: Falta sello")).toBeTruthy();
    const input = screen.getByLabelText("Nuevo PDF") as HTMLInputElement;
    await user.upload(input, new File(["%PDF-1.7"], "nuevo.pdf", { type: "application/pdf" }));
    fireEvent.submit(input.form as HTMLFormElement);
    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining("volverá a quedar pendiente"));
    expect(api.call).toHaveBeenCalledTimes(1);
  });
});
