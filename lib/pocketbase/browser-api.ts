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
  const isFormData = options.body instanceof FormData;
  const requestBody: BodyInit | undefined = options.body === undefined
    ? undefined
    : isFormData
      ? options.body as FormData
      : JSON.stringify(options.body);
  const response = await fetch(path, {
    method: options.method ?? "GET",
    headers: {
      Authorization: getBrowserAuthorizationHeader(),
      ...(options.body === undefined || isFormData ? {} : { "Content-Type": "application/json" }),
    },
    body: requestBody,
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

export async function downloadLomatonFile(path: string) {
  const response = await fetch(path, {
    headers: { Authorization: getBrowserAuthorizationHeader() },
    cache: "no-store",
  });
  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as { message?: string; error?: string };
    throw new BrowserApiError(
      data.message || "No se pudo descargar el archivo.",
      response.status,
      data.error,
    );
  }
  const disposition = response.headers.get("content-disposition") || "";
  const encoded = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  const plain = disposition.match(/filename="([^"]+)"/i)?.[1];
  return {
    blob: await response.blob(),
    filename: encoded ? decodeURIComponent(encoded) : plain || "certificado-alumno-regular.pdf",
  };
}
