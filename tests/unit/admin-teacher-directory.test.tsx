// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.fn();
vi.doMock("@/lib/pocketbase/browser-api", () => ({ callLomatonApi: api }));

const { AdminTeacherDirectory } = await import("@/app/admin/admin-teacher-directory");

const teacher = {
  registrationId: "registration1",
  mentorId: "mentor1",
  name: "Ada Compartida",
  affiliation: "FTyCA",
  active: true,
  mentorInterest: "yes",
  eligible: true,
  unavailableReason: "",
  assignments: [
    { mentorshipId: "mentorship1", teamId: "team1", teamName: "Equipo Norte" },
    { mentorshipId: "mentorship2", teamId: "team2", teamName: "Equipo Sur" },
  ],
};
const directory = {
  teachers: [
    teacher,
    { registrationId: "registration2", mentorId: "mentor2", name: "Bea Inactiva", affiliation: "FACEN", active: false, mentorInterest: "yes", eligible: false, unavailableReason: "Perfil inactivo", assignments: [] },
    { registrationId: "registration3", mentorId: "", name: "Carla Sin Perfil", affiliation: "No informada", active: false, mentorInterest: "not_provided", eligible: false, unavailableReason: "Perfil de mentor no disponible", assignments: [] },
  ],
  teams: [
    { id: "team1", name: "Equipo Norte", currentMentor: { id: "mentor1", name: "Ada Compartida" } },
    { id: "team2", name: "Equipo Sur", currentMentor: { id: "mentor1", name: "Ada Compartida" } },
    { id: "team3", name: "Equipo Libre", currentMentor: null },
    { id: "team4", name: "Equipo Ocupado", currentMentor: { id: "mentor9", name: "Docente Actual" } },
  ],
};

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("administrative teacher directory", () => {
  beforeEach(() => { vi.clearAllMocks(); api.mockReset(); });

  it("loads every teacher state and shows all assigned teams", async () => {
    api.mockResolvedValueOnce(directory);
    render(<AdminTeacherDirectory />);
    expect(await screen.findByRole("heading", { name: "Ada Compartida" })).toBeTruthy();
    expect(screen.getByText("Bea Inactiva")).toBeTruthy();
    expect(screen.getByText("Carla Sin Perfil")).toBeTruthy();
    expect(screen.getByText("Equipo Norte")).toBeTruthy();
    expect(screen.getByText("Equipo Sur")).toBeTruthy();
    expect(screen.getAllByText("Todavía no tiene equipos asignados.")).toHaveLength(2);
    expect(document.body.textContent).not.toContain("Estudiante");
  });

  it("shows an explicit empty state and supports retry after load failure", async () => {
    api.mockRejectedValueOnce(new Error("Falló la carga")).mockResolvedValueOnce({ teachers: [], teams: [] });
    const user = userEvent.setup();
    render(<AdminTeacherDirectory />);
    expect((await screen.findByRole("alert")).textContent).toContain("Falló la carga");
    await user.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(await screen.findByText("No hay docentes registrados.")).toBeTruthy();
  });

  it("filters by team and availability and keeps the search keyboard reachable", async () => {
    api.mockResolvedValueOnce(directory);
    const user = userEvent.setup();
    render(<AdminTeacherDirectory />);
    await screen.findByText("Ada Compartida");
    await user.tab();
    const search = screen.getByLabelText("Buscar docente, unidad académica o equipo");
    expect(document.activeElement).toBe(search);
    await user.type(search, "sur");
    expect(screen.getByText("Ada Compartida")).toBeTruthy();
    expect(screen.queryByText("Bea Inactiva")).toBeNull();
    await user.clear(search);
    fireEvent.change(screen.getByLabelText("Disponibilidad"), { target: { value: "unavailable" } });
    expect(screen.queryByText("Ada Compartida")).toBeNull();
    expect(screen.getByText("Bea Inactiva")).toBeTruthy();
  });

  it("prevents a duplicate and assigns an additional team without hiding prior teams", async () => {
    const updated = { ...directory, teachers: [{ ...teacher, assignments: [...teacher.assignments, { mentorshipId: "mentorship3", teamId: "team3", teamName: "Equipo Libre" }] }, ...directory.teachers.slice(1)] };
    api.mockResolvedValueOnce(directory).mockResolvedValueOnce({ ok: true }).mockResolvedValueOnce(updated);
    const user = userEvent.setup();
    render(<AdminTeacherDirectory />);
    await screen.findByText("Ada Compartida");
    await user.click(screen.getByRole("button", { name: "Gestionar Ada Compartida", expanded: false }));
    const select = screen.getByLabelText("Equipo");
    fireEvent.change(select, { target: { value: "team1" } });
    expect(screen.getByText("Este equipo ya tiene a Ada Compartida como mentor.")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Asignar equipo" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(select, { target: { value: "team3" } });
    await user.click(screen.getByRole("button", { name: "Asignar equipo" }));
    await waitFor(() => expect(api).toHaveBeenCalledWith("/api/lomaton/admin/teams/team3/mentor", { method: "PUT", body: { mentorId: "mentor1", reason: "" } }));
    expect(await screen.findByText("Mentoría asignada por administración.")).toBeTruthy();
    expect(screen.getByText("Equipo Norte")).toBeTruthy();
    expect(screen.getByText("Equipo Sur")).toBeTruthy();
    expect(screen.getByText("Equipo Libre")).toBeTruthy();
  });

  it("requires an explicit replacement action when another mentor owns the team", async () => {
    api.mockResolvedValueOnce(directory).mockResolvedValueOnce({ ok: true }).mockResolvedValueOnce(directory);
    const user = userEvent.setup();
    render(<AdminTeacherDirectory />);
    await screen.findByText("Ada Compartida");
    await user.click(screen.getByRole("button", { name: "Gestionar Ada Compartida", expanded: false }));
    fireEvent.change(screen.getByLabelText("Equipo"), { target: { value: "team4" } });
    const warning = screen.getByRole("alert");
    expect(warning.textContent).toContain("Docente Actual");
    expect(warning.textContent).toContain("Ada Compartida");
    await user.click(screen.getByRole("button", { name: "Confirmar reemplazo" }));
    await waitFor(() => expect(api).toHaveBeenCalledWith("/api/lomaton/admin/teams/team4/mentor", { method: "PUT", body: { mentorId: "mentor1", reason: "" } }));
  });

  it("removes one assignment, keeps the other and preserves state after a failed operation", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const afterRemoval = { ...directory, teachers: [{ ...teacher, assignments: [teacher.assignments[1]] }, ...directory.teachers.slice(1)] };
    api.mockResolvedValueOnce(directory).mockResolvedValueOnce({ ok: true }).mockResolvedValueOnce(afterRemoval).mockRejectedValueOnce(new Error("Motivo obligatorio"));
    const user = userEvent.setup();
    render(<AdminTeacherDirectory />);
    await screen.findByText("Ada Compartida");
    await user.click(screen.getByRole("button", { name: "Gestionar Ada Compartida", expanded: false }));
    const north = screen.getByText("Equipo Norte").closest("li") as HTMLElement;
    await user.click(within(north).getByRole("button", { name: "Retirar" }));
    await waitFor(() => expect(api).toHaveBeenCalledWith("/api/lomaton/admin/team-mentorships/mentorship1", { method: "DELETE", body: { reason: "" } }));
    expect(await screen.findByText("Mentoría retirada por administración.")).toBeTruthy();
    const assignmentList = screen.getByText("Equipos asignados (1)").parentElement as HTMLElement;
    expect(within(assignmentList).queryByText("Equipo Norte")).toBeNull();
    expect(within(assignmentList).getByText("Equipo Sur")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Equipo"), { target: { value: "team3" } });
    await user.click(screen.getByRole("button", { name: "Asignar equipo" }));
    expect(await screen.findByRole("alert")).toHaveProperty("textContent", "Motivo obligatorio");
    expect(screen.getByText("Equipo Sur")).toBeTruthy();
  });
});
