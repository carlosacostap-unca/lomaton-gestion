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
import type { ParticipantRole } from "@/lib/auth/bootstrap-policy";

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
  const payload = await response.json() as { user: Record<string, unknown>; participantRole: ParticipantRole };
  await pb.collection("users").authRefresh();
  return { user: pb.authStore.record, participantRole: payload.participantRole };
}

type AuthContextValue = {
  user: RecordModel | null;
  loading: boolean;
  participantRole: ParticipantRole | null;
  loginWithGoogle: () => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<RecordModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [participantRole, setParticipantRole] = useState<ParticipantRole | null>(null);

  useEffect(() => {
    const pb = getBrowserPocketBase();
    const update = () => {
      setUser(pb.authStore.record?.enabled ? pb.authStore.record : null);
    };

    const unsubscribe = pb.authStore.onChange(update);
    void (async () => {
      try {
        if (pb.authStore.isValid) {
          const session = await bootstrapSession();
          setParticipantRole(session.participantRole);
        }
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
      const session = await bootstrapSession();
      setParticipantRole(session.participantRole);
      popup?.close();
    } catch (error) {
      popup?.close();
      pb.authStore.clear();
      throw error;
    }
  }, []);

  const logout = useCallback(() => {
    getBrowserPocketBase().authStore.clear();
    setParticipantRole(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, participantRole, loginWithGoogle, logout }),
    [user, loading, participantRole, loginWithGoogle, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth debe usarse dentro de AuthProvider.");
  return context;
}
