"use client";

import { AuthenticatedApp } from "./components/authenticated-app";
import { useAuth } from "./components/auth-provider";
import { LoginScreen } from "./components/login-screen";

export default function Home() {
  const { user, loading } = useAuth();
  if (loading) return <main className="loading-screen">Cargando acceso…</main>;
  return user ? <AuthenticatedApp /> : <LoginScreen />;
}
