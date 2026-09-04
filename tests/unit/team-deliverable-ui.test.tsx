// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ api: vi.fn(), file: vi.fn(), getPb: vi.fn() }));
vi.mock("@/lib/pocketbase/browser-api", () => ({
  callLomatonApi: mocks.api,
  fetchLomatonFile: mocks.file,
  BrowserApiError: class BrowserApiError extends Error {
    constructor(message: string, public status: number, public code?: string) { super(message); }
  },
}));
vi.mock("@/lib/pocketbase/client", () => ({ getBrowserPocketBase: mocks.getPb }));

import { AdminDeliverables } from "@/app/admin/admin-deliverables";
import { HackathonSettings } from "@/app/admin/hackathon-settings";
import { TeamDeliverableCard } from "@/app/candidate/team-deliverable-card";
import { JuryDeliverablesPanel } from "@/app/jurado/jury-deliverables-panel";
import type { TeamDeliverableProjection } from "@/lib/team-deliverables-contract";

function delivery(overrides: Partial<TeamDeliverableProjection> = {}): TeamDeliverableProjection {
  return {
    teamId: "team1",
    teamName: "Equipo Norte",
    lifecycle: "draft",
    summaryStatus: "draft_complete",
    version: 4,
    deadlineUtc: "2030-12-31T23:59:00.000Z",
    canEdit: true,
    missingRequired: [],
    updatedAt: "2026-09-03T12:00:00.000Z",
    finalizedAt: "",
    products: [
      { kind: "presentation", label: "Presentación", required: true, allowedMedia: ["file", "link"], allowedExtensions: ["pdf", "ppt", "pptx"], medium: "link", url: "https://example.test/deck" },
      { kind: "canvas", label: "Canvas", required: true, allowedMedia: ["file"], allowedExtensions: ["pdf", "png", "jpg", "jpeg"], medium: "file", originalName: "canvas.pdf", sizeBytes: 1000, mimeType: "application/pdf", downloadPath: "/api/file/canvas" },
      { kind: "report", label: "Informe", required: true, allowedMedia: ["file"], allowedExtensions: ["pdf", "doc", "docx"], medium: "file", originalName: "informe.pdf", sizeBytes: 2000, mimeType: "application/pdf", downloadPath: "/api/file/report" },
      { kind: "evidence", label: "Evidencia del desarrollo alcanzado", required: true, allowedMedia: ["file", "link"], allowedExtensions: ["pdf", "png", "jpg", "jpeg", "zip"], medium: "link", url: "https://example.test/evidence" },
      { kind: "video", label: "Video", required: false, allowedMedia: ["link"], allowedExtensions: [], medium: "none" },
    ],
    ...overrides,
  };
}

describe("team delivery interfaces", () => {
  beforeEach(() => { vi.clearAllMocks(); });
  afterEach(cleanup);

  it("shows the five contracts, changes modality, and saves against the observed version", async () => {
    const initial = delivery();
    const updated = delivery({ version: 5 });
    mocks.api.mockImplementation((path: string, options?: { method?: string }) => {
      if (path === "/api/lomaton/me/deliverable" && !options) return Promise.resolve(mocks.api.mock.calls.length > 2 ? updated : initial);
      return Promise.resolve(updated);
    });
    const user = userEvent.setup();
    render(<TeamDeliverableCard />);
    const presentation = (await screen.findByRole("heading", { name: "Presentación" })).closest("article")!;
    expect(screen.getByRole("heading", { name: "Video" })).toBeTruthy();
    expect(within(presentation).getByText(/Obligatorio/)).toBeTruthy();
    await user.selectOptions(within(presentation).getByLabelText("Modalidad"), "link");
    const input = within(presentation).getByLabelText("Enlace HTTP(S)");
    await user.clear(input);
    await user.type(input, "https://demo.example/presentacion");
    await user.click(within(presentation).getByRole("button", { name: "Sustituir" }));
    await waitFor(() => expect(mocks.api).toHaveBeenCalledWith(
      "/api/lomaton/me/deliverable/products/presentation",
      { method: "PATCH", body: { expectedVersion: 4, url: "https://demo.example/presentacion" } },
    ));
    expect(await screen.findByText(/Presentación guardado/)).toBeTruthy();
  });

  it("blocks every mutation after the deadline while keeping products readable", async () => {
    mocks.api.mockResolvedValueOnce(delivery({ canEdit: false, deadlineUtc: "2020-01-01T00:00:00.000Z" }));
    render(<TeamDeliverableCard />);
    expect(await screen.findByText(/modo de consulta/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Sustituir" })).toBeNull();
    expect((screen.getByRole("button", { name: "Finalizar entrega" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("canvas.pdf")).toBeTruthy();
  });

  it("filters every team for administrators and exposes only read-only detail links", async () => {
    const complete = delivery();
    const incomplete = delivery({ teamId: "team2", teamName: "Equipo Sur", summaryStatus: "draft_incomplete", missingRequired: ["report"] });
    mocks.api.mockResolvedValueOnce({ items: [complete, incomplete], counts: { none: 0, draft_incomplete: 1, draft_complete: 1, finalized: 0 }, deadlineUtc: complete.deadlineUtc });
    render(<AdminDeliverables />);
    expect(await screen.findByText("Equipo Norte")).toBeTruthy();
    expect(screen.getByText("Equipo Sur")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /1Borrador incompleto/ }));
    expect(screen.queryByText("Equipo Norte")).toBeNull();
    expect(screen.getByRole("link", { name: "Ver detalle" }).getAttribute("href")).toBe("/admin/entregas/team2");
    expect(screen.queryByRole("button", { name: /guardar|retirar|finalizar/i })).toBeNull();
  });

  it("shows jury deliverables even outside the evaluation workflow and warns on drafts", async () => {
    mocks.api.mockResolvedValueOnce({ items: [delivery()] });
    render(<JuryDeliverablesPanel />);
    expect(await screen.findByText("Material de evaluación")).toBeTruthy();
    expect(screen.getAllByText("Equipo Norte").length).toBeGreaterThan(0);
    expect(screen.getByText(/todavía puede cambiar/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /guardar|retirar|finalizar/i })).toBeNull();
  });

  it("saves both independent deadlines and confirms an immediate delivery closure", async () => {
    const settings = { id: "settings1", updated: "1", formationOpen: true, deadlineUtc: "2030-01-01T00:00:00.000Z", deliverablesDeadlineUtc: "2030-02-01T00:00:00.000Z" };
    mocks.getPb.mockReturnValue({ collection: () => ({ getFirstListItem: vi.fn().mockResolvedValue(settings) }) });
    mocks.api.mockResolvedValue(settings);
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<HackathonSettings />);
    const deliveryDeadline = await screen.findByLabelText("Fecha y hora límite de entregas (Argentina)");
    fireEvent.change(deliveryDeadline, { target: { value: "2020-01-01T12:00" } });
    fireEvent.submit(screen.getByRole("button", { name: "Guardar configuración" }).closest("form")!);
    await waitFor(() => expect(mocks.api).toHaveBeenCalledWith(
      "/api/lomaton/admin/settings",
      expect.objectContaining({
        method: "PATCH",
        body: expect.objectContaining({
          deadlineUtc: "2030-01-01T00:00:00.000Z",
          deliverablesDeadlineUtc: "2020-01-01T15:00:00.000Z",
          confirmImmediateDeliverablesClosure: true,
        }),
      }),
    ));
    expect(window.confirm).toHaveBeenCalled();
  });
});
