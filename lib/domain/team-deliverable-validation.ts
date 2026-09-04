import "server-only";

import { createHash } from "node:crypto";
import { isIP } from "node:net";

import { fileTypeFromBuffer } from "file-type";

import { ApiError } from "@/lib/server/api-error";
import { deliverableDefinition, type TeamDeliverableKind } from "@/lib/team-deliverables-contract";

export const DELIVERABLE_URL_MAX_LENGTH = 2_048;

export type ValidatedDeliverableFile = {
  file: File;
  originalName: string;
  safeDownloadName: string;
  sizeBytes: number;
  mimeType: string;
  sha256: string;
};

function extensionOf(name: string) {
  return name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? "";
}

function normalizedExtension(extension: string) {
  return extension === "jpeg" ? "jpg" : extension;
}

export function safeDeliverableDownloadName(name: string) {
  const leaf = name.replace(/\\/g, "/").split("/").at(-1) || "archivo";
  const normalized = leaf.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const safe = normalized
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^[.-]+|[.-]+$/g, "")
    .slice(0, 180);
  return safe || "archivo";
}

function rawSignature(bytes: Uint8Array) {
  const starts = (...values: number[]) => values.every((value, index) => bytes[index] === value);
  if (new TextDecoder().decode(bytes.slice(0, 5)) === "%PDF-") return "pdf";
  if (starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return "png";
  if (starts(0xff, 0xd8, 0xff)) return "jpg";
  if (starts(0x50, 0x4b, 0x03, 0x04) || starts(0x50, 0x4b, 0x05, 0x06)) return "zip";
  if (starts(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1)) return "cfb";
  return "";
}

function signatureMatches(extension: string, detected: string) {
  const expected = normalizedExtension(extension);
  const actual = normalizedExtension(detected);
  if (expected === actual) return true;
  return ["doc", "ppt"].includes(expected) && actual === "cfb";
}

export async function validateDeliverableFile(
  kind: TeamDeliverableKind,
  file: File,
  maxBytes: number,
): Promise<ValidatedDeliverableFile> {
  const definition = deliverableDefinition(kind);
  if (!definition || !definition.media.includes("file" as never)) {
    throw new ApiError(400, "Este producto no admite archivos.", "deliverable_file_not_allowed");
  }
  if (file.size === 0) throw new ApiError(400, "El archivo está vacío.", "empty_deliverable_file");
  if (file.size > maxBytes) {
    throw new ApiError(413, `El archivo supera el máximo permitido de ${maxBytes} bytes.`, "deliverable_file_too_large");
  }
  const extension = extensionOf(file.name);
  if (!definition.extensions.includes(extension as never)) {
    throw new ApiError(400, `El formato no está permitido. Usá: ${definition.extensions.join(", ").toUpperCase()}.`, "invalid_deliverable_extension");
  }
  const mimeType = file.type.toLowerCase();
  if (!definition.mimeTypes.includes(mimeType as never)) {
    throw new ApiError(400, "El tipo declarado del archivo no coincide con los formatos permitidos.", "invalid_deliverable_mime");
  }
  const buffer = new Uint8Array(await file.arrayBuffer());
  let detected = "";
  try {
    detected = (await fileTypeFromBuffer(buffer))?.ext ?? "";
  } catch {
    detected = "";
  }
  detected ||= rawSignature(buffer);
  if (!signatureMatches(extension, detected)) {
    throw new ApiError(400, "El contenido del archivo no coincide con su extensión.", "invalid_deliverable_signature");
  }
  return {
    file,
    originalName: file.name.slice(0, 240),
    safeDownloadName: safeDeliverableDownloadName(file.name),
    sizeBytes: file.size,
    mimeType,
    sha256: createHash("sha256").update(buffer).digest("hex"),
  };
}

function isPrivateIpv4(hostname: string) {
  const octets = hostname.split(".").map(Number);
  if (octets.length !== 4 || octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const [a, b] = octets;
  return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224;
}

function isPrivateIpv6(hostname: string) {
  const host = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  return host === "::" || host === "::1" || host.startsWith("fc") || host.startsWith("fd") ||
    /^fe[89ab]/.test(host) || host.startsWith("ff") ||
    (host.startsWith("::ffff:") && isPrivateIpv4(host.slice(7)));
}

export function validateDeliverableUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > DELIVERABLE_URL_MAX_LENGTH) {
    throw new ApiError(400, "El enlace es obligatorio y admite hasta 2.048 caracteres.", "invalid_deliverable_url");
  }
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new ApiError(400, "Ingresá un enlace HTTP o HTTPS válido.", "invalid_deliverable_url");
  }
  if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password) {
    throw new ApiError(400, "El enlace debe usar HTTP(S) y no incluir credenciales.", "unsafe_deliverable_url");
  }
  const hostname = parsed.hostname.toLowerCase().replace(/\.$/, "");
  if (!hostname || hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local")) {
    throw new ApiError(400, "El enlace debe apuntar a un destino compartible.", "unsafe_deliverable_url");
  }
  const plainHost = hostname.replace(/^\[|\]$/g, "");
  const ipVersion = isIP(plainHost);
  if ((ipVersion === 4 && isPrivateIpv4(plainHost)) || (ipVersion === 6 && isPrivateIpv6(plainHost))) {
    throw new ApiError(400, "El enlace no puede apuntar a una red privada o reservada.", "unsafe_deliverable_url");
  }
  return { url: parsed.toString(), hostname: plainHost };
}
