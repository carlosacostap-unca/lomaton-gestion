import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

type ServerEnvModule = typeof import("@/lib/env/server");
let parseServerEnv: ServerEnvModule["parseServerEnv"];

beforeAll(async () => {
  ({ parseServerEnv } = await import("@/lib/env/server"));
});

describe("parseServerEnv", () => {
  it("normaliza administradores y aplica límites predeterminados", () => {
    expect(
      parseServerEnv({
        POCKETBASE_URL: "https://pocketbase.example.edu.ar",
        ADMIN_EMAILS: " Admin@Example.edu.ar,otro@example.edu.ar ",
      }),
    ).toEqual({
      pocketBaseUrl: "https://pocketbase.example.edu.ar",
      adminEmails: ["admin@example.edu.ar", "otro@example.edu.ar"],
      importMaxBytes: 5 * 1024 * 1024,
      importMaxRows: 5_000,
    });
  });

  it("informa las variables obligatorias ausentes", () => {
    expect(() => parseServerEnv({})).toThrow(
      /POCKETBASE_URL.*ADMIN_EMAILS.*\.env\.example.*Dokploy/,
    );
  });
});
