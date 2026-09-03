// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.fn();
vi.doMock("@/lib/pocketbase/browser-api", () => ({ callLomatonApi: api }));

const { AdminTeamManager } = await import("@/app/admin/admin-team-manager");
const { AdminTeamList } = await import("@/app/admin/admin-team-list");

afterEach(cleanup);

const list = {
  teams: [
    { id: "team1", name: "Equipo Uno", status: "complete", memberCount: 3, ftcaConfirmedCount: 1, mentorName: "Docente Compartido", challenge: { id: "transito-planta", title: "Tránsito por planta" }, warning: "" },
    { id: "team2", name: "Equipo Dos", status: "draft", memberCount: 1, ftcaConfirmedCount: 0, mentorName: "", challenge: null, warning: "Faltan 2 integrante(s)" },
  ],
  availableCandidates: [{ id: "candidate3", name: "Persona Disponible", email: "disponible@example.test", ftcaStatus: "pending" }],
};

function detail(withMentor = false) {
  return {
    team: { id: "team2", name: "Equipo Dos", owner: "candidate2", status: "draft", memberCount: 1, ftcaConfirmedCount: 0 },
    challenge: null,
    members: [{ id: "candidate2", name: "Responsable Dos", email: "dos@example.test", ftcaStatus: "confirmed" }],
    invitations: [],
    mentorship: withMentor ? { id: "mentorship1", mentorId: "mentor1", mentorName: "Docente Compartido", department: "FACEN" } : null,
    availableCandidates: list.availableCandidates,
    availableMentors: [{ id: "mentor1", name: "Docente Compartido", department: "FACEN" }],
  };
}

describe("admin team list and detail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.mockReset();
    window.history.replaceState(null, "", "/admin/equipos");
  });

  it("shows compact summaries and filters without rendering team forms", async () => {
    api.mockResolvedValueOnce(list);
    const user = userEvent.setup();
    render(<AdminTeamList />);
    expect(await screen.findByRole("heading", { name: "Equipo Uno" })).toBeTruthy();
    expect(screen.getAllByRole("link", { name: "Ver y gestionar" })).toHaveLength(2);
    expect(screen.getByText("Tránsito por planta")).toBeTruthy();
    expect(screen.getByText("Sin seleccionar")).toBeTruthy();
    expect(screen.queryByLabelText("Mentor de Equipo Uno")).toBeNull();
    await user.type(screen.getByLabelText("Buscar equipo o mentor"), "Dos");
    expect(screen.queryByRole("heading", { name: "Equipo Uno" })).toBeNull();
    expect(screen.getByRole("heading", { name: "Equipo Dos" })).toBeTruthy();
    expect(window.location.search).toContain("buscar=Dos");
  });

  it("keeps a mentor available for assignment and refreshes the selected detail", async () => {
    api.mockImplementation((path: string) => path === "/api/lomaton/admin/teams/team2" ? Promise.resolve(detail(false)) : Promise.resolve({ ok: true }));
    render(<AdminTeamManager teamId="team2" />);
    expect(await screen.findByText(/Desafío:/)).toBeTruthy();
    expect(screen.getByText("Sin seleccionar")).toBeTruthy();
    const select = await screen.findByLabelText("Mentor de Equipo Dos") as HTMLSelectElement;
    expect(screen.getByRole("option", { name: /Docente Compartido/ })).toBeTruthy();
    fireEvent.change(select, { target: { value: "mentor1" } });
    fireEvent.submit(select.form as HTMLFormElement);
    await waitFor(() => expect(api).toHaveBeenCalledWith(
      "/api/lomaton/admin/teams/team2/mentor",
      { method: "PUT", body: { mentorId: "mentor1", reason: "" } },
    ));
    expect(await screen.findByText("Mentoría asignada por administración.")).toBeTruthy();
    expect(api).toHaveBeenCalledWith("/api/lomaton/admin/teams/team2");
  });

  it("offers replacement and removal only in the individual team detail", async () => {
    api.mockResolvedValue(detail(true));
    render(<AdminTeamManager teamId="team2" backHref="/admin/equipos?estado=complete" />);
    expect(await screen.findByRole("button", { name: "Reemplazar mentor" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Retirar mentoría" })).toBeTruthy();
    expect(screen.getByRole("link", { name: /Volver a equipos/ }).getAttribute("href")).toBe("/admin/equipos?estado=complete");
    expect(screen.queryByText(/invitación.*mentor/i)).toBeNull();
  });
});
