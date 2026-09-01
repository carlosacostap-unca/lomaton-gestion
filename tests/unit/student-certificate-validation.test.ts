// @vitest-environment node

import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  certificateDownloadName,
  validateStudentCertificate,
} from "@/lib/domain/student-certificate-validation";

const validPdf = new TextEncoder().encode("%PDF-1.7\ncontenido de prueba");

describe("student certificate validation", () => {
  it("accepts a PDF, sanitizes its download name and calculates SHA-256", async () => {
    const file = new File([validPdf], "Mi constancia ágil.pdf", { type: "application/pdf" });
    const result = await validateStudentCertificate(file, 1024);
    expect(result.originalName).toBe("Mi constancia ágil.pdf");
    expect(result.safeDownloadName).toBe("Mi-constancia-agil.pdf");
    expect(result.sizeBytes).toBe(validPdf.length);
    expect(result.sha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it.each([
    [new File([validPdf], "certificado.txt", { type: "application/pdf" }), "invalid_certificate_extension"],
    [new File([validPdf], "certificado.pdf", { type: "text/plain" }), "invalid_certificate_mime"],
    [new File([], "certificado.pdf", { type: "application/pdf" }), "empty_certificate"],
    [new File(["no es pdf"], "certificado.pdf", { type: "application/pdf" }), "invalid_certificate_signature"],
  ])("rejects malformed input", async (file, code) => {
    await expect(validateStudentCertificate(file, 1024)).rejects.toMatchObject({ code });
  });

  it("rejects an oversized PDF", async () => {
    const file = new File([validPdf], "certificado.pdf", { type: "application/pdf" });
    await expect(validateStudentCertificate(file, validPdf.length - 1)).rejects.toMatchObject({
      status: 413,
      code: "certificate_too_large",
    });
  });

  it("never lets a supplied path escape into Content-Disposition", () => {
    expect(certificateDownloadName("../../Certificado José.pdf")).toBe("Certificado-Jose.pdf");
  });
});
