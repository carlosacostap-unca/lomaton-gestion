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
      setUser(pb.authStore.record);
      setLoading(false);
    };

    update();
    return pb.authStore.onChange(update);
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
    } catch (error) {
      popup?.close();
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
