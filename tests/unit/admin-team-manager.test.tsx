import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.fn();
vi.doMock("@/lib/pocketbase/browser-api", () => ({ callLomatonApi: api }));

const { AdminTeamManager } = await import("@/app/admin/admin-team-manager");

afterEach(cleanup);

const snapshot = {
  generatedAtUtc: "2026-09-02T12:00:00.000Z",
  candidates: [
    { id: "candidate1", fullName: "Responsable Uno", email: "uno@example.test", active: true },
    { id: "candidate2", fullName: "Responsable Dos", email: "dos@example.test", active: true },
  ],
  teams: [
    { id: "team1", name: "Equipo Uno", owner: "candidate1", status: "complete", memberCount: 3 },
    { id: "team2", name: "Equipo Dos", owner: "candidate2", status: "complete", memberCount: 3 },
  ],
  memberships: [
    { id: "membership1", team: "team1", candidate: "candidate1" },
    { id: "membership2", team: "team2", candidate: "candidate2" },
  ],
  invitations: [],
  mentors: [
    { id: "mentor1", fullName: "Docente Compartido", department: "FACEN", mentorInterest: "yes", active: true },
    { id: "mentor2", fullName: "Docente Inactivo", department: "FTyCA", mentorInterest: "yes", active: false },
  ],
  mentorInvitations: [{ id: "historical1", team: "team1", mentor: "mentor1", status: "cancelled" }],
  mentorships: [{ id: "mentorship1", team: "team1", mentor: "mentor1", source: "admin" }],
};

describe("admin team mentor assignment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.mockImplementation((path: string) => {
      if (path === "/api/lomaton/admin/report-snapshot") return Promise.resolve(snapshot);
      return Promise.resolve({ ok: true });
    });
  });

  it("keeps a mentor available for multiple teams and assigns through the admin route", async () => {
    render(<AdminTeamManager />);

    const first = await screen.findByLabelText("Mentor de Equipo Uno") as HTMLSelectElement;
    const second = screen.getByLabelText("Mentor de Equipo Dos") as HTMLSelectElement;
    expect(first.value).toBe("mentor1");
    expect(screen.getAllByRole("option", { name: /Docente Compartido/ })).toHaveLength(2);
    expect(screen.queryByRole("option", { name: /Docente Inactivo/ })).toBeNull();

    fireEvent.change(second, { target: { value: "mentor1" } });
    fireEvent.submit(second.form as HTMLFormElement);

    await waitFor(() => expect(api).toHaveBeenCalledWith(
      "/api/lomaton/admin/teams/team2/mentor",
      { method: "PUT", body: { mentorId: "mentor1", reason: "" } },
    ));
    expect(await screen.findByText("Mentoría asignada por administración.")).toBeTruthy();
  });

  it("offers replacement and removal only from administration", async () => {
    render(<AdminTeamManager />);
    expect(await screen.findByRole("button", { name: "Reemplazar mentor" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Retirar mentoría" })).toBeTruthy();
    expect(screen.queryByText(/invitación.*mentor/i)).toBeNull();
  });
});
