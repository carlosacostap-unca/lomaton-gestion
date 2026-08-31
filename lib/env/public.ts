import { z } from "zod";

const publicEnvSchema = z.object({
  NEXT_PUBLIC_POCKETBASE_URL: z.url(),
});

export type PublicEnv = {
  pocketBaseUrl: string;
};

export function parsePublicEnv(input: {
  NEXT_PUBLIC_POCKETBASE_URL?: string;
}): PublicEnv {
  const result = publicEnvSchema.safeParse(input);

  if (!result.success) {
    throw new Error(
      "Falta configurar NEXT_PUBLIC_POCKETBASE_URL con una URL válida en .env.local o en el entorno de build de Dokploy.",
    );
  }

  return { pocketBaseUrl: result.data.NEXT_PUBLIC_POCKETBASE_URL };
}

export function getPublicEnv(): PublicEnv {
  return parsePublicEnv({
    NEXT_PUBLIC_POCKETBASE_URL: process.env.NEXT_PUBLIC_POCKETBASE_URL,
  });
}
