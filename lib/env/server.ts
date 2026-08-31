import "server-only";

import { z } from "zod";

const serverEnvSchema = z.object({
  POCKETBASE_URL: z.url(),
  ADMIN_EMAILS: z.string().min(1),
  IMPORT_MAX_BYTES: z.coerce.number().int().positive().default(5 * 1024 * 1024),
  IMPORT_MAX_ROWS: z.coerce.number().int().positive().default(5_000),
});

export type ServerEnv = {
  pocketBaseUrl: string;
  adminEmails: string[];
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

  const adminEmails = result.data.ADMIN_EMAILS.split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  if (adminEmails.length === 0) {
    throw new Error(
      "ADMIN_EMAILS debe contener al menos un email administrador válido.",
    );
  }

  return {
    pocketBaseUrl: result.data.POCKETBASE_URL,
    adminEmails,
    importMaxBytes: result.data.IMPORT_MAX_BYTES,
    importMaxRows: result.data.IMPORT_MAX_ROWS,
  };
}

export function getServerEnv(): ServerEnv {
  return parseServerEnv({
    POCKETBASE_URL: process.env.POCKETBASE_URL,
    ADMIN_EMAILS: process.env.ADMIN_EMAILS,
    IMPORT_MAX_BYTES: process.env.IMPORT_MAX_BYTES,
    IMPORT_MAX_ROWS: process.env.IMPORT_MAX_ROWS,
  });
}
