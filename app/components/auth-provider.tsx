"use client";

import type { RecordModel } from "pocketbase";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { getBrowserPocketBase } from "@/lib/pocketbase/client";

async function bootstrapSession() {
  const pb = getBrowserPocketBase();
  if (!pb.authStore.token) throw new Error("No existe una sesión para validar.");
  const response = await fetch("/api/lomaton/auth/bootstrap", {
    method: "POST",
    headers: { Authorization: `Bearer ${pb.authStore.token}` },
    cache: "no-store",
  });
  if (!response.ok) {
    pb.authStore.clear();
    throw new Error("La identidad no está habilitada para este hackatón.");
  }
  await pb.collection("users").authRefresh();
  return pb.authStore.record;
}

type AuthContextValue = {
  user: RecordModel | null;
  loading: boolean;
  loginWithGoogle: () => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<RecordModel | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const pb = getBrowserPocketBase();
    const update = () => {
      setUser(pb.authStore.record?.enabled ? pb.authStore.record : null);
    };

    const unsubscribe = pb.authStore.onChange(update);
    void (async () => {
      try {
        if (pb.authStore.isValid) await bootstrapSession();
        else update();
      } catch {
        pb.authStore.clear();
      } finally {
        setLoading(false);
      }
    })();
    return unsubscribe;
  }, []);

  const loginWithGoogle = useCallback(async () => {
    const pb = getBrowserPocketBase();
    const popup = window.open("", "lomaton-google-oauth", "width=520,height=720");
    try {
      await pb.collection("users").authWithOAuth2({
        provider: "google",
        urlCallback: (url) => {
          if (popup) popup.location.href = url;
          else window.location.href = url;
        },
      });
      await bootstrapSession();
      popup?.close();
    } catch (error) {
      popup?.close();
      pb.authStore.clear();
      throw error;
    }
  }, []);

  const logout = useCallback(() => {
    getBrowserPocketBase().authStore.clear();
  }, []);

  const value = useMemo(
    () => ({ user, loading, loginWithGoogle, logout }),
    [user, loading, loginWithGoogle, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth debe usarse dentro de AuthProvider.");
  return context;
}
