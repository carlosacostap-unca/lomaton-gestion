import "server-only";

import { getServerEnv } from "@/lib/env/server";

export async function requirePocketBaseAdmin(authorization: string | null) {
  if (!authorization) throw new Response("Falta autenticación.", { status: 401 });
  const env = getServerEnv();
  const response = await fetch(
    `${env.pocketBaseUrl}/api/collections/users/auth-refresh`,
    { method: "POST", headers: { Authorization: authorization }, cache: "no-store" },
  );
  if (!response.ok) throw new Response("La sesión no es válida.", { status: 401 });
  const auth = (await response.json()) as { record?: { isAdmin?: boolean } };
  if (!auth.record?.isAdmin) throw new Response("Se requieren permisos de administrador.", { status: 403 });
  return { env, authorization, user: auth.record };
}
