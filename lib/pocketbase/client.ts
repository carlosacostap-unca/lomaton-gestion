import PocketBase, { BaseAuthStore } from "pocketbase";

import { parsePublicEnv } from "@/lib/env/public";

let browserClient: PocketBase | undefined;

export function createIsolatedPocketBase(url: string) {
  return new PocketBase(url, new BaseAuthStore());
}

export function getBrowserPocketBase() {
  if (typeof window === "undefined") {
    throw new Error("El cliente PocketBase del navegador no puede usarse en el servidor.");
  }

  if (!browserClient) {
    const env = parsePublicEnv({
      NEXT_PUBLIC_POCKETBASE_URL: process.env.NEXT_PUBLIC_POCKETBASE_URL,
    });
    browserClient = new PocketBase(env.pocketBaseUrl);
    browserClient.autoCancellation(false);
  }

  return browserClient;
}
