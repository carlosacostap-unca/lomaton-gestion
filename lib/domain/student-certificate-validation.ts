import { createHash } from "node:crypto";
import path from "node:path";

import { ApiError } from "@/lib/server/api-error";

export type ValidatedCertificate = {
  file: File;
  originalName: string;
  safeDownloadName: string;
  sizeBytes: number;
  sha256: string;
};

function safeBaseName(value: string) {
  const base = path.basename(value.replaceAll("\\", "/")).normalize("NFKD");
  const withoutMarks = base.replace(/[\u0300-\u036f]/g, "");
  const cleaned = withoutMarks
    .replace(/[^a-zA-Z0-9._ -]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(0, 220);
  const stem = cleaned.replace(/\.pdf$/i, "") || "certificado-alumno-regular";
  return `${stem}.pdf`;
}

export async function validateStudentCertificate(
  file: File,
  maxBytes: number,
): Promise<ValidatedCertificate> {
  const suppliedName = file.name.trim();
  const originalName = path
    .basename(suppliedName.replaceAll("\\", "/"))
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, 240);
  if (!originalName || !originalName.toLowerCase().endsWith(".pdf")) {
    throw new ApiError(400, "El archivo debe tener extensión .pdf.", "invalid_certificate_extension");
  }
  if (file.type.toLowerCase() !== "application/pdf") {
    throw new ApiError(400, "El archivo debe declararse como application/pdf.", "invalid_certificate_mime");
  }
  if (file.size <= 0) {
    throw new ApiError(400, "El certificado está vacío.", "empty_certificate");
  }
  if (file.size > maxBytes) {
    throw new ApiError(
      413,
      `El certificado supera el máximo permitido de ${Math.floor(maxBytes / 1024 / 1024)} MiB.`,
      "certificate_too_large",
    );
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.length < 5 || new TextDecoder("ascii").decode(bytes.subarray(0, 5)) !== "%PDF-") {
    throw new ApiError(400, "El contenido no corresponde a un PDF válido.", "invalid_certificate_signature");
  }
  return {
    file,
    originalName: originalName.slice(0, 240),
    safeDownloadName: safeBaseName(originalName),
    sizeBytes: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  };
}

export function certificateDownloadName(originalName: unknown) {
  return safeBaseName(String(originalName || "certificado-alumno-regular.pdf"));
}
