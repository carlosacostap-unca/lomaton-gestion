// @vitest-environment node

import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  safeDeliverableDownloadName,
  validateDeliverableFile,
  validateDeliverableUrl,
} from "@/lib/domain/team-deliverable-validation";

const pdf = new TextEncoder().encode("%PDF-1.7\ncontenido");

describe("deliverable file validation", () => {
  it("acepta un PDF permitido y calcula metadatos seguros", async () => {
    const file = new File([pdf], "../Presentación final.pdf", { type: "application/pdf" });
    await expect(validateDeliverableFile("presentation", file, 1024)).resolves.toMatchObject({
      originalName: "../Presentación final.pdf",
      safeDownloadName: "Presentacion-final.pdf",
      sizeBytes: pdf.length,
      mimeType: "application/pdf",
      sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
  });

  it.each([
    ["video", new File([pdf], "video.pdf", { type: "application/pdf" }), "deliverable_file_not_allowed"],
    ["canvas", new File([pdf], "canvas.exe", { type: "application/pdf" }), "invalid_deliverable_extension"],
    ["canvas", new File([pdf], "canvas.pdf", { type: "text/plain" }), "invalid_deliverable_mime"],
    ["canvas", new File(["MZ executable"], "canvas.pdf", { type: "application/pdf" }), "invalid_deliverable_signature"],
  ] as const)("rechaza archivos incompatibles", async (kind, file, code) => {
    await expect(validateDeliverableFile(kind, file, 1024)).rejects.toMatchObject({ code });
  });

  it("rechaza vacío y tamaño excedido", async () => {
    await expect(validateDeliverableFile("report", new File([], "informe.pdf", { type: "application/pdf" }), 100)).rejects.toMatchObject({ code: "empty_deliverable_file" });
    await expect(validateDeliverableFile("report", new File([pdf], "informe.pdf", { type: "application/pdf" }), 3)).rejects.toMatchObject({ status: 413, code: "deliverable_file_too_large" });
  });

  it("neutraliza rutas y caracteres peligrosos del nombre", () => {
    expect(safeDeliverableDownloadName("..\\..\\Informe José.pdf")).toBe("Informe-Jose.pdf");
  });
});

describe("deliverable URL validation", () => {
  it("normaliza HTTP(S) públicos sin recuperar el destino", () => {
    expect(validateDeliverableUrl(" https://Example.org/demo?q=1 ")).toEqual({
      url: "https://example.org/demo?q=1",
      hostname: "example.org",
    });
  });

  it.each([
    "javascript:alert(1)", "file:///tmp/demo", "https://user:secret@example.org/demo",
    "http://localhost:3000/demo", "http://127.0.0.1/demo", "http://10.0.0.1/demo",
    "http://192.168.1.2/demo", "http://[::1]/demo", "http://service.local/demo",
  ])("rechaza destinos inseguros: %s", (value) => {
    expect(() => validateDeliverableUrl(value)).toThrow();
  });
});
