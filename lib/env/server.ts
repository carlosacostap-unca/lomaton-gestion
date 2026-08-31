import "server-only";

import { z } from "zod";

const serverEnvSchema = z.object({
  POCKETBASE_URL: z.url(),
  POCKETBASE_SERVICE_EMAIL: z.email(),
  POCKETBASE_SERVICE_PASSWORD: z.string().min(12),
  IMPORT_MAX_BYTES: z.coerce.number().int().positive().default(5 * 1024 * 1024),
  IMPORT_MAX_ROWS: z.coerce.number().int().positive().default(5_000),
});

export type ServerEnv = {
  pocketBaseUrl: string;
  pocketBaseServiceEmail: string;
  pocketBaseServicePassword: string;
  importMaxBytes: number;
  importMaxRows: number;
};

export function parseServerEnv(input: Record<string, string | undefined>): ServerEnv {
  const result = serverEnvSchema.safeParse(input);

  if (!result.success) {
    const fields = result.error.issues
      .map((issue) => issue.path.join("."))
      .filter(Boolean)
      .join(", ");
    throw new Error(
      `Configuración de servidor incompleta o inválida: ${fields || "variables desconocidas"}. Revisá .env.example y Dokploy.`,
    );
  }

  return {
    pocketBaseUrl: result.data.POCKETBASE_URL,
    pocketBaseServiceEmail: result.data.POCKETBASE_SERVICE_EMAIL.toLowerCase(),
    pocketBaseServicePassword: result.data.POCKETBASE_SERVICE_PASSWORD,
    importMaxBytes: result.data.IMPORT_MAX_BYTES,
    importMaxRows: result.data.IMPORT_MAX_ROWS,
  };
}

export function getServerEnv(): ServerEnv {
  return parseServerEnv({
    POCKETBASE_URL: process.env.POCKETBASE_URL,
    POCKETBASE_SERVICE_EMAIL: process.env.POCKETBASE_SERVICE_EMAIL,
    POCKETBASE_SERVICE_PASSWORD: process.env.POCKETBASE_SERVICE_PASSWORD,
    IMPORT_MAX_BYTES: process.env.IMPORT_MAX_BYTES,
    IMPORT_MAX_ROWS: process.env.IMPORT_MAX_ROWS,
  });
}
