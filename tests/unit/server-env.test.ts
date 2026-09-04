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
      certificateMaxBytes: 10 * 1024 * 1024,
      deliverableMaxBytes: 25 * 1024 * 1024,
    });
  });

  it("acepta un límite de entregables positivo hasta 25 MiB", () => {
    const base = {
      POCKETBASE_URL: "https://pocketbase.example.edu.ar",
      POCKETBASE_SERVICE_EMAIL: "service@example.edu.ar",
      POCKETBASE_SERVICE_PASSWORD: "un-secreto-de-prueba",
    };
    expect(parseServerEnv({ ...base, LOMATON_DELIVERABLE_MAX_BYTES: "5242880" }).deliverableMaxBytes).toBe(5 * 1024 * 1024);
    expect(() => parseServerEnv({ ...base, LOMATON_DELIVERABLE_MAX_BYTES: "0" })).toThrow(/LOMATON_DELIVERABLE_MAX_BYTES/);
    expect(() => parseServerEnv({ ...base, LOMATON_DELIVERABLE_MAX_BYTES: String(25 * 1024 * 1024 + 1) })).toThrow(/LOMATON_DELIVERABLE_MAX_BYTES/);
  });

  it("acepta un límite de certificado positivo hasta 10 MiB", () => {
    const base = {
      POCKETBASE_URL: "https://pocketbase.example.edu.ar",
      POCKETBASE_SERVICE_EMAIL: "service@example.edu.ar",
      POCKETBASE_SERVICE_PASSWORD: "un-secreto-de-prueba",
    };
    expect(parseServerEnv({ ...base, LOMATON_CERTIFICATE_MAX_BYTES: "2097152" }).certificateMaxBytes).toBe(2 * 1024 * 1024);
    expect(() => parseServerEnv({ ...base, LOMATON_CERTIFICATE_MAX_BYTES: "-1" })).toThrow(/LOMATON_CERTIFICATE_MAX_BYTES/);
    expect(() => parseServerEnv({ ...base, LOMATON_CERTIFICATE_MAX_BYTES: String(10 * 1024 * 1024 + 1) })).toThrow(/LOMATON_CERTIFICATE_MAX_BYTES/);
  });

  it("informa las variables obligatorias ausentes", () => {
    expect(() => parseServerEnv({})).toThrow(
      /POCKETBASE_URL.*POCKETBASE_SERVICE_EMAIL.*POCKETBASE_SERVICE_PASSWORD.*\.env\.example.*Dokploy/,
    );
  });
});
