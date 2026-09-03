// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => vi.fn());
vi.mock("@/lib/pocketbase/browser-api", () => ({ callLomatonApi: api }));

import { AdminEvaluationPanel } from "@/app/admin/admin-evaluation-panel";
import { AdminJurorDirectory } from "@/app/admin/admin-juror-directory";
import { StudentEvaluationResult } from "@/app/candidate/student-evaluation-result";
import { JuryDashboard } from "@/app/jurado/jury-dashboard";

const scores = { innovation: 8, impact: 8, viability: 7, presentation: 8, teamwork: 9 };
const evaluation = {
  id: "evaluation1",
  teamId: "team1",
  teamName: "Equipo Norte",
  status: "draft",
  scores,
  total: 7.95,
  completedCriteria: ["innovation", "impact", "viability", "presentation", "teamwork"],
  version: 2,
  finalizedAt: "",
};

describe("jury evaluation interfaces", () => {
  beforeEach(() => { api.mockReset(); });
  afterEach(cleanup);

  it("supports juror search and disables roster editing while the cycle is open", async () => {
    api.mockResolvedValueOnce({
      jurors: [{ id: "j1", fullName: "Ada Jurado", email: "ada@example.test", active: true }],
      rosterLocked: true,
    });
    render(<AdminJurorDirectory />);
    expect(await screen.findByText("Ada Jurado")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Editar" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Guardar jurado" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Buscar jurado"), { target: { value: "nadie" } });
    expect(screen.getByText("No hay jurados que coincidan con la búsqueda.")).toBeTruthy();
  });

  it("keeps publication disabled until every evaluation is finalized", async () => {
    api.mockResolvedValueOnce({
      cycle: { id: "c1", status: "open", version: 2, jurorCount: 2, teamCount: 1, requiredCount: 2, finalizedCount: 1, openedAt: "", publishedAt: "" },
      evaluations: [{ ...evaluation, jurorId: "j1", jurorName: "Ada Jurado" }],
      progress: { finalized: 1, total: 2, missing: 1 },
      canPublish: false,
    });
    render(<AdminEvaluationPanel />);
    expect(await screen.findByText("1/2")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Publicar resultados" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("preserves zero as a valid score and submits a complete final evaluation", async () => {
    const finalScores = { innovation: 0, impact: 8, viability: 7, presentation: 8, teamwork: 9 };
    api
      .mockResolvedValueOnce({
        cycle: { id: "c1", status: "open", version: 1 },
        evaluations: [{ ...evaluation, scores: finalScores }],
        progress: { finalized: 0, total: 1 },
      })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({
        cycle: { id: "c1", status: "open", version: 2 },
        evaluations: [{ ...evaluation, status: "finalized", scores: finalScores, version: 3 }],
        progress: { finalized: 1, total: 1 },
      });
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const user = userEvent.setup();
    render(<JuryDashboard />);
    const innovation = await screen.findByLabelText("Innovación y originalidad (25%)") as HTMLInputElement;
    expect(innovation.value).toBe("0");
    await user.click(screen.getByRole("button", { name: "Finalizar evaluación" }));
    await waitFor(() => expect(api).toHaveBeenCalledWith(
      "/api/lomaton/jury/evaluations/evaluation1",
      { method: "PATCH", body: { expectedVersion: 2, scores: finalScores, finalize: true } },
    ));
    expect(await screen.findByText("Evaluación finalizada.")).toBeTruthy();
  });

  it("renders only consolidated team results after publication", async () => {
    api.mockResolvedValueOnce({
      published: true,
      teamId: "team1",
      teamName: "Equipo Norte",
      jurorCount: 2,
      scores,
      total: 7.95,
      publishedAt: "2026-09-03T12:00:00Z",
    });
    render(<StudentEvaluationResult />);
    expect(await screen.findByText("7.95 / 10")).toBeTruthy();
    expect(screen.getByText("Promedio consolidado de 2 evaluadores.")).toBeTruthy();
    expect(document.body.textContent).not.toContain("Ada Jurado");
    expect(document.body.textContent).not.toContain("evaluación individual");
  });
});
