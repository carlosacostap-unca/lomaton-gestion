import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.fn();
vi.doMock("@/lib/pocketbase/browser-api", () => ({ callLomatonApi: api }));

const { ProfileForm } = await import("@/app/portal/profile-form");
const { TeacherDashboard } = await import("@/app/portal/teacher-dashboard");
const { TeamMentorCard } = await import("@/app/portal/team-mentor-card");

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

  it("keeps primary controls reachable by keyboard", async () => {
    api.mockResolvedValueOnce(teacherProfile);
    render(<ProfileForm />);
    await screen.findByText("Docente Ada");
    const user = userEvent.setup();
    await user.tab();
    expect(document.activeElement).toBe(screen.getByLabelText("Teléfono"));
  });
});
