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

  it("shows every assigned team to the teacher without invitation or private controls", async () => {
    api.mockResolvedValueOnce({
      assignments: [
        { id: "team1", name: "Equipo Norte", status: "draft", members: [{ id: "candidate1", fullName: "Estudiante Uno" }] },
        { id: "team2", name: "Equipo Sur", status: "confirmed", members: [{ id: "candidate2", fullName: "Estudiante Dos" }] },
      ],
    });
    render(<TeacherDashboard />);
    expect(await screen.findByText("Equipo Norte")).toBeTruthy();
    expect(screen.getByText("Equipo Sur")).toBeTruthy();
    expect(screen.getByText("Estudiante Uno")).toBeTruthy();
    expect(screen.getByText("Estudiante Dos")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /aceptar|rechazar/i })).toBeNull();
    expect(screen.queryByText("Certificado de alumno regular")).toBeNull();
    expect(document.body.textContent).not.toContain("DNI");
  });

  it("shows an empty state when the teacher has no assigned teams", async () => {
    api.mockResolvedValueOnce({ assignments: [] });
    render(<TeacherDashboard />);
    expect(await screen.findByText("Todavía no tenés equipos asignados.")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("explains that the organization assigns a mentor and exposes no student controls", async () => {
    api.mockResolvedValueOnce({ assignment: null });
    render(<TeamMentorCard teamId="team1" formationOpen={false} />);
    expect(await screen.findByText(/La organización realizará la asignación/)).toBeTruthy();
    expect(screen.queryByLabelText("Buscar docente")).toBeNull();
    expect(screen.queryByRole("button", { name: /invitar|retirar/i })).toBeNull();
  });

  it("shows the mentor assigned by administration as read-only", async () => {
    api.mockResolvedValueOnce({
      assignment: { id: "mentorship1", mentor: { id: "mentor1", fullName: "Ángela Núñez", department: "FACEN", externalDescription: "" } },
    });
    render(<TeamMentorCard teamId="team1" formationOpen />);
    expect(await screen.findByText("Ángela Núñez")).toBeTruthy();
    expect(screen.getByText("FACEN")).toBeTruthy();
    expect(api).toHaveBeenCalledTimes(1);
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
    api.mockResolvedValue({ assignment: null });

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

  it("keeps primary controls reachable by keyboard", async () => {
    api.mockResolvedValueOnce(teacherProfile);
    render(<ProfileForm />);
    await screen.findByText("Docente Ada");
    const user = userEvent.setup();
    await user.tab();
    expect(document.activeElement).toBe(screen.getByLabelText("Teléfono"));
  });
});
