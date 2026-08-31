import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

type ServerEnvModule = typeof import("@/lib/env/server");
let parseServerEnv: ServerEnvModule["parseServerEnv"];

beforeAll(async () => {
  ({ parseServerEnv } = await import("@/lib/env/server"));
});

describe("parseServerEnv", () => {
  it("normaliza la identidad técnica y aplica límites predeterminados", () => {
    expect(
      parseServerEnv({
        POCKETBASE_URL: "https://pocketbase.example.edu.ar",
        POCKETBASE_SERVICE_EMAIL: "Service@Example.edu.ar",
        POCKETBASE_SERVICE_PASSWORD: "un-secreto-de-prueba",
      }),
    ).toEqual({
      pocketBaseUrl: "https://pocketbase.example.edu.ar",
      pocketBaseServiceEmail: "service@example.edu.ar",
      pocketBaseServicePassword: "un-secreto-de-prueba",
      importMaxBytes: 5 * 1024 * 1024,
      importMaxRows: 5_000,
    });
  });

  it("informa las variables obligatorias ausentes", () => {
    expect(() => parseServerEnv({})).toThrow(
      /POCKETBASE_URL.*POCKETBASE_SERVICE_EMAIL.*POCKETBASE_SERVICE_PASSWORD.*\.env\.example.*Dokploy/,
    );
  });
});
