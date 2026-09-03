// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.fn();
vi.doMock("@/lib/pocketbase/browser-api", () => ({ callLomatonApi: api }));

const { AdminStudentDirectory } = await import("@/app/admin/admin-student-directory");

afterEach(cleanup);

const directory = {
  students: [
    { registrationId: "registration1", candidateId: "candidate1", name: "Ada Equipo", faculty: "FTyCA", certificateStatus: "approved", team: { id: "team1", name: "Equipo Uno" }, pendingInvitations: [] },
    { registrationId: "registration2", candidateId: "candidate2", name: "Bea Invitada", faculty: "FACEN", certificateStatus: "pending", team: null, pendingInvitations: [{ id: "invite1", teamId: "team2", teamName: "Equipo Dos" }] },
    { registrationId: "registration3", candidateId: "candidate3", name: "Carla Sin Certificado", faculty: "No informada", certificateStatus: "not_presented", team: null, pendingInvitations: [] },
  ],
};

const detail = {
  id: "registration1", fullName: "Ada Equipo", dni: "12345678", phone: "3834000000", email: "ada@example.test",
  relationship: "student_ftca", ftcaStatus: "confirmed", department: "Sistemas", academicUnit: "FTyCA", career: "Informática",
  externalTeacherDescription: "", mentorInterest: "not_provided", declaredTeamStatus: "complete", declaredTeamMembers: "",
  termsAccepted: "yes", mediaAuthorized: "yes", candidateActive: true, candidateId: "candidate1",
};

describe("administrative student directory", () => {
  beforeEach(() => { vi.clearAllMocks(); api.mockReset(); });

  it("loads automatically and shows certificate, team, invitation and empty relationship states", async () => {
    api.mockResolvedValueOnce(directory);
    render(<AdminStudentDirectory />);

    expect(await screen.findByText("Ada Equipo")).toBeTruthy();
    expect(screen.getByText("Equipo Uno")).toBeTruthy();
    expect(screen.getByText("Equipo Dos")).toBeTruthy();
    expect(screen.getByText("Validado")).toBeTruthy();
    expect(screen.getByText("Pendiente")).toBeTruthy();
    expect(screen.getByText("No presentado")).toBeTruthy();
    expect(screen.getAllByText("Sin equipo")).toHaveLength(2);
    expect(document.body.textContent).not.toContain("Docente");
  });

  it("shows an explicit empty state", async () => {
    api.mockResolvedValueOnce({ students: [] });
    render(<AdminStudentDirectory />);
    expect(await screen.findByText("No hay estudiantes registrados.")).toBeTruthy();
  });

  it("offers an accessible retry after a loading error", async () => {
    api.mockRejectedValueOnce(new Error("Falló la carga")).mockResolvedValueOnce(directory);
    const user = userEvent.setup();
    render(<AdminStudentDirectory />);
    expect((await screen.findByRole("alert")).textContent).toContain("Falló la carga");
    await user.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(await screen.findByText("Ada Equipo")).toBeTruthy();
  });

  it("keeps the filter reachable by keyboard with an explicit label", async () => {
    api.mockResolvedValueOnce(directory);
    const user = userEvent.setup();
    render(<AdminStudentDirectory />);
    await screen.findByText("Ada Equipo");
    await user.tab();
    expect(document.activeElement).toBe(screen.getByLabelText("Filtrar estudiantes"));
  });

  it("loads student detail on demand, saves it and refreshes the minimal projection", async () => {
    api
      .mockResolvedValueOnce(directory)
      .mockResolvedValueOnce(detail)
      .mockResolvedValueOnce({ warning: "" })
      .mockResolvedValueOnce({ students: [{ ...directory.students[0], name: "Ada Actualizada" }] });
    render(<AdminStudentDirectory />);
    await screen.findByText("Ada Equipo");
    fireEvent.click(screen.getByRole("button", { name: "Editar inscripción de Ada Equipo" }));
    const form = await screen.findByRole("form", { name: "Editar inscripción de Ada Equipo" });
    fireEvent.change(screen.getByLabelText("Apellido y nombres"), { target: { value: "Ada Actualizada" } });
    fireEvent.submit(form);

    await waitFor(() => expect(api).toHaveBeenCalledWith(
      "/api/lomaton/admin/registrations/registration1",
      expect.objectContaining({ method: "PATCH", body: expect.objectContaining({ fullName: "Ada Actualizada" }) }),
    ));
    expect(await screen.findByText("Ada Actualizada")).toBeTruthy();
    expect(api).toHaveBeenCalledWith("/api/lomaton/admin/students");
  });
});
