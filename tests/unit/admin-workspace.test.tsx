// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ value: { user: { isAdmin: true, registration: "" }, loading: false, logout: vi.fn() } }));
const navigation = vi.hoisted(() => ({ pathname: "/admin/equipos" }));

vi.mock("@/app/components/auth-provider", () => ({ useAuth: () => auth.value }));
vi.mock("next/navigation", () => ({ usePathname: () => navigation.pathname }));

import { AdminShell } from "@/app/admin/layout";

afterEach(cleanup);

describe("administrative workspace", () => {
  it("exposes only the six agreed destinations and marks the current section", () => {
    render(<AdminShell><p>Contenido de equipos</p></AdminShell>);
    const nav = screen.getByRole("navigation", { name: "Secciones de administración" });
    expect(nav.querySelectorAll("a")).toHaveLength(6);
    expect(screen.getByRole("link", { name: "Equipos" }).getAttribute("aria-current")).toBe("page");
    expect(nav.textContent).not.toContain("Reportes");
    expect(nav.textContent).not.toContain("Auditoría");
    expect(screen.getByText("Contenido de equipos")).toBeTruthy();
  });

  it("denies the shell to a non-admin without exposing child content", () => {
    auth.value = { ...auth.value, user: { isAdmin: false, registration: "" } };
    render(<AdminShell><p>Secreto administrativo</p></AdminShell>);
    expect(screen.getByRole("alert").textContent).toContain("permisos de administrador");
    expect(screen.queryByText("Secreto administrativo")).toBeNull();
    auth.value = { ...auth.value, user: { isAdmin: true, registration: "" } };
  });
});
