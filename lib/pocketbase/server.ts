import "server-only";

import PocketBase, { ClientResponseError, type RecordModel } from "pocketbase";

import { getServerEnv } from "@/lib/env/server";
import { ApiError } from "@/lib/server/api-error";

export type LomatonUser = RecordModel & {
  email: string;
  verified: boolean;
  enabled: boolean;
  isAdmin: boolean;
  candidate?: string;
  displayName?: string;
};

function bearerToken(authorization: string | null): string {
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  if (!match?.[1]) {
    throw new ApiError(401, "Falta autenticación.", "authentication_required");
  }
  return match[1];
}

export async function requirePocketBaseUser(
  authorization: string | null,
  options: { requireEnabled?: boolean } = {},
) {
  const token = bearerToken(authorization);
  const env = getServerEnv();
  const pb = new PocketBase(env.pocketBaseUrl);
  pb.autoCancellation(false);
  pb.authStore.save(token, null);

  try {
    const auth = await pb.collection("users").authRefresh();
    const user = auth.record as LomatonUser;
    if (user.collectionName !== "users") {
      throw new ApiError(401, "La sesión no es válida.", "invalid_session");
    }
    if (options.requireEnabled !== false && !user.enabled) {
      throw new ApiError(403, "La cuenta todavía no está habilitada.", "account_disabled");
    }
    return { env, token, authorization: `Bearer ${token}`, user };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof ClientResponseError && [401, 403].includes(error.status)) {
      throw new ApiError(401, "La sesión no es válida.", "invalid_session");
    }
    throw error;
  }
}

export async function createPocketBaseServiceClient(): Promise<PocketBase> {
  const env = getServerEnv();
  const pb = new PocketBase(env.pocketBaseUrl);
  pb.autoCancellation(false);

  try {
    const auth = await pb
      .collection("service_accounts")
      .authWithPassword(
        env.pocketBaseServiceEmail,
        env.pocketBaseServicePassword,
      );
    if (auth.record.active !== true || auth.record.role !== "lomaton_server") {
      pb.authStore.clear();
      throw new ApiError(
        503,
        "La cuenta técnica de la aplicación no está habilitada.",
        "service_account_disabled",
      );
    }
    return pb;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof ClientResponseError && [400, 401, 403].includes(error.status)) {
      throw new ApiError(
        503,
        "No se pudo autenticar la cuenta técnica de la aplicación.",
        "service_account_unavailable",
      );
    }
    throw error;
  }
}

export async function requirePocketBaseAdmin(authorization: string | null) {
  const context = await requirePocketBaseUser(authorization);
  if (!context.user.isAdmin) {
    throw new ApiError(
      403,
      "Se requieren permisos de administrador.",
      "admin_required",
    );
  }
  return context;
}
