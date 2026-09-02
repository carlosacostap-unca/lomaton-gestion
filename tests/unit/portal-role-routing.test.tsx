import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

let authState: Record<string, unknown>;
vi.doMock("@/app/components/auth-provider", () => ({ useAuth: () => authState }));
vi.doMock("@/app/candidate/candidate-dashboard", () => ({ CandidateDashboard: () => <div data-testid="student-tools">Certificado y equipo</div> }));
vi.doMock("@/app/portal/profile-form", () => ({ ProfileForm: () => <div data-testid="profile">Perfil</div> }));
vi.doMock("@/app/portal/teacher-dashboard", () => ({ TeacherDashboard: () => <div data-testid="teacher-tools">Invitaciones docentes</div> }));

const PortalPage = (await import("@/app/portal/page")).default;

afterEach(cleanup);

describe("portal routing by current role", () => {
  it("shows certificate/team only to a student", () => {
    authState = { loading: false, participantRole: "student", logout: vi.fn(), user: { registration: "r1", candidate: "c1", isAdmin: false } };
    render(<PortalPage />);
    expect(screen.getByTestId("student-tools")).toBeTruthy();
    expect(screen.queryByTestId("teacher-tools")).toBeNull();
  });

  it("shows only teacher mentorship tools to a teacher", () => {
    authState = { loading: false, participantRole: "teacher", logout: vi.fn(), user: { registration: "r2", candidate: "", isAdmin: false } };
    render(<PortalPage />);
    expect(screen.getByTestId("teacher-tools")).toBeTruthy();
    expect(screen.queryByTestId("student-tools")).toBeNull();
    expect(document.body.textContent).not.toContain("Certificado");
  });

  it("links a participant administrator back to administration", () => {
    authState = { loading: false, participantRole: "teacher", logout: vi.fn(), user: { registration: "r2", isAdmin: true } };
    render(<PortalPage />);
    expect((screen.getByRole("link", { name: "Administración" }) as HTMLAnchorElement).getAttribute("href")).toBe("/admin");
  });
});
