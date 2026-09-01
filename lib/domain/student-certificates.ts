import "server-only";

import { randomBytes } from "node:crypto";

import PocketBase, { ClientResponseError, type RecordModel } from "pocketbase";

import { addAudit, defaultSettings } from "@/lib/domain/admin-commands";
import type { ValidatedCertificate } from "@/lib/domain/student-certificate-validation";
import type { LomatonUser } from "@/lib/pocketbase/server";
import { ApiError } from "@/lib/server/api-error";

export type StudentCertificateMetadata = {
  present: boolean;
  originalName?: string;
  sizeBytes?: number;
  uploadedAt?: string;
};

function recordId() {
  return randomBytes(12).toString("hex").slice(0, 15);
}

function isConflict(error: unknown) {
  return error instanceof ClientResponseError && [400, 409].includes(error.status);
}

export async function findStudentCertificate(pb: PocketBase, candidateId: string) {
  try {
    return await pb.collection("student_certificates").getFirstListItem(
      pb.filter("candidate = {:candidate}", { candidate: candidateId }),
    );
  } catch (error) {
    if (error instanceof ClientResponseError && error.status === 404) return null;
    throw error;
  }
}

export function studentCertificateMetadata(record: RecordModel | null): StudentCertificateMetadata {
  if (!record) return { present: false };
  return {
    present: true,
    originalName: String(record.originalName),
    sizeBytes: Number(record.sizeBytes),
    uploadedAt: String(record.updated || record.created),
  };
}

export async function requireActiveCandidate(pb: PocketBase, candidateId: string) {
  const candidate = await pb.collection("candidates").getOne(candidateId);
  if (!candidate.active) {
    throw new ApiError(403, "El perfil de candidato está inactivo.", "candidate_inactive");
  }
  return candidate;
}

async function sendUploadBatch(
  pb: PocketBase,
  actor: LomatonUser,
  candidateId: string,
  validated: ValidatedCertificate,
  current: RecordModel | null,
) {
  const settings = await defaultSettings(pb);
  const id = current?.id ?? recordId();
  const data = {
    candidate: candidateId,
    certificate: validated.file,
    originalName: validated.originalName,
    sizeBytes: validated.sizeBytes,
    sha256: validated.sha256,
    uploadedBy: actor.id,
  };
  const batch = pb.createBatch();
  if (current) {
    batch.collection("student_certificates").update(id, data, {
      query: { expected_sha256: String(current.sha256) },
    });
  } else {
    batch.collection("student_certificates").create({ id, ...data });
  }
  addAudit(batch, {
    actorId: actor.id,
    action: current ? "student_certificate.replace" : "student_certificate.upload",
    entityType: "student_certificates",
    entityId: id,
    before: current
      ? { originalName: current.originalName, sizeBytes: current.sizeBytes, sha256: current.sha256 }
      : null,
    after: {
      candidateId,
      originalName: validated.originalName,
      sizeBytes: validated.sizeBytes,
      sha256: validated.sha256,
    },
  });
  batch.collection("hackathon_settings").update(settings.id, { "dataVersion+": 1 });
  await batch.send();
}

export async function upsertStudentCertificate(
  pb: PocketBase,
  actor: LomatonUser,
  candidateId: string,
  validated: ValidatedCertificate,
) {
  let current = await findStudentCertificate(pb, candidateId);
  try {
    await sendUploadBatch(pb, actor, candidateId, validated, current);
  } catch (error) {
    if (!isConflict(error)) throw error;
    current = await findStudentCertificate(pb, candidateId);
    if (!current) {
      throw new ApiError(409, "La carga entró en conflicto. Intentá nuevamente.", "certificate_conflict");
    }
    try {
      await sendUploadBatch(pb, actor, candidateId, validated, current);
    } catch (retryError) {
      if (isConflict(retryError)) {
        throw new ApiError(409, "El certificado cambió mientras se procesaba. Intentá nuevamente.", "certificate_conflict");
      }
      throw retryError;
    }
  }
  return studentCertificateMetadata(await findStudentCertificate(pb, candidateId));
}

export async function getStudentCertificateDownload(pb: PocketBase, candidateId: string) {
  const record = await findStudentCertificate(pb, candidateId);
  if (!record) {
    throw new ApiError(404, "El candidato no cargó un certificado.", "certificate_not_found");
  }
  const token = await pb.files.getToken();
  const url = pb.files.getURL(record, String(record.certificate), { token });
  return { record, url };
}
