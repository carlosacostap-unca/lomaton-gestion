"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useAuth } from "@/app/components/auth-provider";

export const adminDestinations = [
  { href: "/admin", label: "Resumen", exact: true },
  { href: "/admin/equipos", label: "Equipos" },
  { href: "/admin/entregas", label: "Entregas" },
  { href: "/admin/certificados", label: "Certificados" },
  { href: "/admin/estudiantes", label: "Estudiantes" },
  { href: "/admin/docentes", label: "Docentes" },
  { href: "/admin/jurados", label: "Jurados" },
  { href: "/admin/evaluacion", label: "Evaluación" },
  { href: "/admin/importacion", label: "Importación" },
  { href: "/admin/configuracion", label: "Configuración" },
] as const;

export function AdminShell({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const pathname = usePathname();

  if (loading) return <main className="loading-screen">Cargando administración…</main>;
  if (!user?.isAdmin) {
    return <main className="app-shell"><div className="alert" role="alert">Esta área requiere permisos de administrador.</div></main>;
  }

  return (
    <main className="admin-shell">
      <header className="admin-header">
        <div>
          <p className="eyebrow">Administración</p>
          <h1>Panel del Lomatón</h1>
        </div>
        <div className="header-actions">
          {user.registration ? <Link className="secondary-button link-button" href="/portal">Mi portal</Link> : <Link className="secondary-button link-button" href="/">Inicio</Link>}
          <button className="secondary-button" type="button" onClick={logout}>Cerrar sesión</button>
        </div>
      </header>
      <div className="admin-workspace">
        <nav className="admin-navigation" aria-label="Secciones de administración">
          {adminDestinations.map((destination) => {
            const active = "exact" in destination && destination.exact ? pathname === destination.href : pathname.startsWith(destination.href);
            return (
              <Link key={destination.href} href={destination.href} aria-current={active ? "page" : undefined} className={active ? "admin-navigation-link is-active" : "admin-navigation-link"}>
                {destination.label}
              </Link>
            );
          })}
        </nav>
        <div className="admin-content">{children}</div>
      </div>
    </main>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
