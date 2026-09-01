import "server-only";

import type PocketBase from "pocketbase";

import { certificateDownloadName } from "@/lib/domain/student-certificate-validation";
import { getStudentCertificateDownload } from "@/lib/domain/student-certificates";
import { ApiError } from "@/lib/server/api-error";

export function validateCandidateId(value: string) {
  if (!/^[a-z0-9]{15}$/i.test(value)) {
    throw new ApiError(400, "El identificador del candidato no es válido.", "invalid_candidate_id");
  }
  return value;
}

export async function proxyStudentCertificate(pb: PocketBase, candidateId: string) {
  const { record, url } = await getStudentCertificateDownload(pb, candidateId);
  const upstream = await fetch(url, { cache: "no-store" });
  if (!upstream.ok || !upstream.body) {
    throw new ApiError(502, "No se pudo recuperar el certificado del almacenamiento.", "certificate_storage_error");
  }
  const filename = certificateDownloadName(record.originalName);
  const headers = new Headers({
    "Content-Type": "application/pdf",
    "Content-Disposition": `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  });
  const length = upstream.headers.get("content-length");
  if (length) headers.set("Content-Length", length);
  return new Response(upstream.body, { status: 200, headers });
}
