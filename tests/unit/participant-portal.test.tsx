import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.fn();
const getBrowserPocketBase = vi.fn();
vi.doMock("@/lib/pocketbase/browser-api", () => ({ callLomatonApi: api }));
vi.doMock("@/lib/pocketbase/client", () => ({ getBrowserPocketBase }));
vi.doMock("@/app/candidate/student-certificate-card", () => ({
  StudentCertificateCard: () => <section>Certificado de alumno regular</section>,
}));

const { ProfileForm } = await import("@/app/portal/profile-form");
const { TeacherDashboard } = await import("@/app/portal/teacher-dashboard");
const { TeamMentorCard } = await import("@/app/portal/team-mentor-card");
const { CandidateDashboard } = await import("@/app/candidate/candidate-dashboard");

afterEach(cleanup);

const teacherProfile = {
  role: "teacher", version: 3,
  readOnly: { fullName: "Docente Ada", email: "ada@example.test", dni: "123", relationship: "teacher", ftcaStatus: "not_ftca" },
  editable: { phone: "3834000000", department: "Informática", externalTeacherDescription: "FACEN", mentorInterest: "yes" },
  editableFields: ["phone", "department", "externalTeacherDescription", "mentorInterest"],
};

describe("participant portal components", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("renders protected identity as read-only, role fields and submits the observed version", async () => {
    api.mockResolvedValueOnce(teacherProfile).mockResolvedValueOnce({ ...teacherProfile, version: 4, editable: { ...teacherProfile.editable, phone: "3834111111" } });
    render(<ProfileForm />);
    expect(await screen.findByText("Docente Ada")).toBeTruthy();
    expect(screen.queryByLabelText("Email")).toBeNull();
    const phone = screen.getByLabelText("Teléfono") as HTMLInputElement;
    fireEvent.change(phone, { target: { value: "3834111111" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await waitFor(() => expect(api).toHaveBeenLastCalledWith("/api/lomaton/me/profile", expect.objectContaining({ method: "PATCH", body: expect.objectContaining({ expectedVersion: 3, phone: "3834111111" }) })));
    expect(await screen.findByText("Perfil actualizado.")).toBeTruthy();
  });

  it("announces a version conflict and keeps the form usable", async () => {
    api.mockResolvedValueOnce(teacherProfile).mockRejectedValueOnce(new Error("El perfil cambió en otra sesión. Recargá antes de guardar."));
    render(<ProfileForm />);
    await screen.findByText("Docente Ada");
    fireEvent.change(screen.getByLabelText("Teléfono"), { target: { value: "3834222222" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    const alert = await screen.findByRole("status");
    expect(alert.textContent).toContain("Recargá");
    expect((screen.getByRole("button", { name: "Guardar cambios" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("shows safe teacher invitations and never renders certificate controls", async () => {
    api.mockResolvedValueOnce({ assignment: null, invitations: [{ id: "invite1", status: "pending", team: { id: "team1", name: "Equipo Norte" } }] });
    render(<TeacherDashboard />);
    expect(await screen.findByText("Equipo Norte")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Aceptar" })).toBeTruthy();
    expect(screen.queryByText(/certificado/i)).toBeNull();
    expect(document.body.textContent).not.toContain("DNI");
  });

  it("covers mentor selection, pending state and closed formation controls", async () => {
    api.mockImplementation((path: string) => {
      if (path.startsWith("/api/lomaton/mentors/eligible")) return Promise.resolve([{ id: "mentor1", fullName: "Docente Uno", department: "FACEN", externalDescription: "" }]);
      return Promise.resolve({ assignment: null, invitations: [{ id: "invite1", status: "pending", mentor: { id: "mentor1", fullName: "Docente Uno", department: "FACEN", externalDescription: "" } }] });
    });
    render(<TeamMentorCard teamId="team1" formationOpen={false} />);
    expect(await screen.findByText(/Docente Uno · pendiente/)).toBeTruthy();
    expect((screen.getByRole("button", { name: "Invitar" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Retirar" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("filters mentors by public fields, clears hidden selections and submits the selected id", async () => {
    const mentors = [
      { id: "mentor1", fullName: "Ángela Núñez", department: "FACEN", externalDescription: "" },
      { id: "mentor2", fullName: "Carlos Ruiz", department: "", externalDescription: "Robótica aplicada" },
    ];
    api.mockImplementation((path: string) => {
      if (path.startsWith("/api/lomaton/mentors/eligible")) return Promise.resolve(mentors);
      return Promise.resolve({ assignment: null, invitations: [] });
    });

    render(<TeamMentorCard teamId="team1" formationOpen />);
    const search = await screen.findByLabelText("Buscar docente");
    const select = screen.getByLabelText("Docente disponible") as HTMLSelectElement;
    const invite = screen.getByRole("button", { name: "Invitar" }) as HTMLButtonElement;

    fireEvent.change(search, { target: { value: "robotica" } });
    expect(screen.getByRole("option", { name: /Carlos Ruiz/ })).toBeTruthy();
    expect(screen.queryByRole("option", { name: /Ángela Núñez/ })).toBeNull();
    fireEvent.change(select, { target: { value: "mentor2" } });
    expect(invite.disabled).toBe(false);

    fireEvent.change(search, { target: { value: "facen" } });
    expect(select.value).toBe("");
    expect(invite.disabled).toBe(true);

    fireEvent.change(search, { target: { value: "robotica" } });
    fireEvent.change(select, { target: { value: "mentor2" } });
    fireEvent.click(invite);
    await waitFor(() => expect(api).toHaveBeenCalledWith(
      "/api/lomaton/teams/team1/mentor-invitations",
      { method: "POST", body: { mentorId: "mentor2" } },
    ));
  });

  it("filters available students by name or email and announces empty results", async () => {
    const owner = { id: "candidate1", fullName: "Responsable Uno", email: "owner@example.test", ftcaStatus: "confirmed" };
    const maria = { id: "candidate2", fullName: "María Álvarez", email: "maria@example.test", active: true };
    const bruno = { id: "candidate3", fullName: "Bruno Soto", email: "bruno@example.test", active: true };
    const membership = { id: "membership1", candidate: owner.id, team: "team1", expand: { candidate: owner } };
    const collections = {
      hackathon_settings: {
        getFirstListItem: vi.fn().mockResolvedValue({ formationOpen: true, deadlineUtc: "2030-12-31T23:59:59.000Z" }),
      },
      team_memberships: {
        getFirstListItem: vi.fn().mockResolvedValue(membership),
        getFullList: vi.fn((options?: { expand?: string }) => Promise.resolve(options?.expand ? [membership] : [membership])),
      },
      team_invitations: { getFullList: vi.fn().mockResolvedValue([]) },
      teams: { getOne: vi.fn().mockResolvedValue({ id: "team1", owner: owner.id, name: "Equipo Norte", status: "draft" }) },
      candidates: { getFullList: vi.fn().mockResolvedValue([owner, maria, bruno]) },
    };
    getBrowserPocketBase.mockReturnValue({
      collection: (name: keyof typeof collections) => collections[name],
      filter: (expression: string) => expression,
    });
    api.mockImplementation((path: string) => {
      if (path.startsWith("/api/lomaton/mentors/eligible")) return Promise.resolve([]);
      return Promise.resolve({ assignment: null, invitations: [] });
    });

    render(<CandidateDashboard candidateId={owner.id} />);
    const search = await screen.findByLabelText("Buscar estudiante");
    const select = screen.getByLabelText("Estudiante disponible") as HTMLSelectElement;
    const invite = screen.getAllByRole("button", { name: "Invitar" })[0] as HTMLButtonElement;

    fireEvent.change(search, { target: { value: "alvarez" } });
    expect(screen.getByRole("option", { name: /María Álvarez/ })).toBeTruthy();
    expect(screen.queryByRole("option", { name: /Bruno Soto/ })).toBeNull();
    fireEvent.change(search, { target: { value: "maria@example.test" } });
    fireEvent.change(select, { target: { value: maria.id } });
    expect(invite.disabled).toBe(false);

    fireEvent.change(search, { target: { value: "bruno" } });
    expect(select.value).toBe("");
    expect(invite.disabled).toBe(true);

    fireEvent.change(search, { target: { value: "sin coincidencias" } });
    expect(await screen.findByText("No hay estudiantes que coincidan con la búsqueda.")).toBeTruthy();
    expect(select.disabled).toBe(true);
  });

  it("keeps invite search controls reachable by keyboard", async () => {
    api.mockImplementation((path: string) => {
      if (path.startsWith("/api/lomaton/mentors/eligible")) {
        return Promise.resolve([{ id: "mentor1", fullName: "Docente Uno", department: "FACEN", externalDescription: "" }]);
      }
      return Promise.resolve({ assignment: null, invitations: [] });
    });
    render(<TeamMentorCard teamId="team1" formationOpen />);
    await screen.findByText("1 docente disponible.");
    const user = userEvent.setup();
    await user.tab();
    expect(document.activeElement).toBe(screen.getByLabelText("Buscar docente"));
    await user.tab();
    expect(document.activeElement).toBe(screen.getByLabelText("Docente disponible"));
  });

  it("keeps primary controls reachable by keyboard", async () => {
    api.mockResolvedValueOnce(teacherProfile);
    render(<ProfileForm />);
    await screen.findByText("Docente Ada");
    const user = userEvent.setup();
    await user.tab();
    expect(document.activeElement).toBe(screen.getByLabelText("Teléfono"));
  });
});
