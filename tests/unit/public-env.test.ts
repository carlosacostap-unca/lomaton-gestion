import { describe, expect, it } from "vitest";

import { parsePublicEnv } from "@/lib/env/public";

describe("parsePublicEnv", () => {
  it("acepta una URL HTTPS de PocketBase", () => {
    expect(
      parsePublicEnv({
        NEXT_PUBLIC_POCKETBASE_URL: "https://pocketbase.example.edu.ar",
      }),
    ).toEqual({ pocketBaseUrl: "https://pocketbase.example.edu.ar" });
  });

  it("falla con un mensaje accionable cuando falta la URL", () => {
    expect(() => parsePublicEnv({})).toThrow(
      /NEXT_PUBLIC_POCKETBASE_URL.*\.env\.local.*Dokploy/,
    );
  });
});
