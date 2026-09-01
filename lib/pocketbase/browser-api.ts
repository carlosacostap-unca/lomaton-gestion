import { getBrowserPocketBase } from "@/lib/pocketbase/client";

export class BrowserApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "BrowserApiError";
  }
}

export function getBrowserAuthorizationHeader(): string {
  const token = getBrowserPocketBase().authStore.token;
  if (!token) throw new BrowserApiError("La sesión venció.", 401);
  return "Bearer " + token;
}

export async function callLomatonApi<T = unknown>(
  path: string,
  options: { method?: string; body?: unknown } = {},
): Promise<T> {
  const response = await fetch(path, {
    method: options.method ?? "GET",
    headers: {
      Authorization: getBrowserAuthorizationHeader(),
      ...(options.body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    cache: "no-store",
  });
  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as {
      message?: string;
      error?: string;
    };
    throw new BrowserApiError(
      data.message || "No se pudo realizar la operación.",
      response.status,
      data.error,
    );
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
