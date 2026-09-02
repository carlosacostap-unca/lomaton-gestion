import "server-only";

import { randomBytes } from "node:crypto";

import PocketBase, { ClientResponseError, type RecordModel } from "pocketbase";

import { addAudit, defaultSettings } from "@/lib/domain/admin-commands";
import type { ValidatedCertificate } from "@/lib/domain/student-certificate-validation";
import type { LomatonUser } from "@/lib/pocketbase/server";
import { ApiError } from "@/lib/server/api-error";

export const certificateReviewStatuses = ["pending", "approved", "rejected"] as const;
export type CertificateReviewStatus = (typeof certificateReviewStatuses)[number];
export const certificateRejectionReasonMaxLength = 1000;

export type StudentCertificateMetadata = {
  present: boolean;
  originalName?: string;
  sizeBytes?: number;
  uploadedAt?: string;
  reviewStatus?: CertificateReviewStatus;
  rejectionReason?: string;
};

export type AdminStudentCertificateMetadata = StudentCertificateMetadata & {
  version?: string;
  reviewedAt?: string;
};

export type CertificateReviewQueueItem = AdminStudentCertificateMetadata & {
  id: string;
  candidateId: string;
  candidateName: string;
  candidateEmail: string;
};

export type CertificateReviewQueue = {
  items: CertificateReviewQueueItem[];
  page: number;
  perPage: number;
  totalItems: number;
  totalPages: number;
};

export type ReviewStudentCertificateInput = {
  decision: "approved" | "rejected";
  reason?: string;
  expectedSha256: string;
};

function recordId() {
  return randomBytes(12).toString("hex").slice(0, 15);
}
function isConflict(error: unknown) {
  return error instanceof ClientResponseError && [400, 409].includes(error.status);
}

export function normalizeCertificateReviewStatus(value: unknown): CertificateReviewStatus {
  const normalized = String(value || "").trim();
  if (!normalized) return "pending";
  if (certificateReviewStatuses.includes(normalized as CertificateReviewStatus)) {
    return normalized as CertificateReviewStatus;
  }
  throw new ApiError(
    502,
    "El certificado tiene un estado de revisión inválido.",
    "invalid_certificate_review_status",
  );
}

export function normalizeCertificateRejectionReason(value: unknown, required = false) {
  const normalized = String(value || "").trim().replace(/\s+/g, " ");
  if (normalized.length > certificateRejectionReasonMaxLength) {
    throw new ApiError(
      400,
      `El motivo no puede superar ${certificateRejectionReasonMaxLength} caracteres.`,
      "rejection_reason_too_long",
    );
  }
  if (required && !normalized) {
    throw new ApiError(
      400,
      "Indicá el motivo que verá el candidato.",
      "rejection_reason_required",
    );
  }
  return normalized;
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
  const reviewStatus = normalizeCertificateReviewStatus(record.reviewStatus);
  return {
    present: true,
    originalName: String(record.originalName),
    sizeBytes: Number(record.sizeBytes),
    uploadedAt: String(record.updated || record.created),
    reviewStatus,
    ...(reviewStatus === "rejected"
      ? { rejectionReason: normalizeCertificateRejectionReason(record.rejectionReason) }
      : {}),
  };
}

export function adminStudentCertificateMetadata(
  record: RecordModel | null,
): AdminStudentCertificateMetadata {
  if (!record) return { present: false };
  return {
    ...studentCertificateMetadata(record),
    version: String(record.sha256),
    ...(record.reviewedAt ? { reviewedAt: String(record.reviewedAt) } : {}),
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
  const previousReviewStatus = current
    ? normalizeCertificateReviewStatus(current.reviewStatus)
    : null;
  const data = {
    candidate: candidateId,
    certificate: validated.file,
    originalName: validated.originalName,
    sizeBytes: validated.sizeBytes,
    sha256: validated.sha256,
    uploadedBy: actor.id,
    reviewStatus: "pending",
    reviewedBy: "",
    reviewedAt: "",
    rejectionReason: "",
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
      ? {
          originalName: current.originalName,
          sizeBytes: current.sizeBytes,
          sha256: current.sha256,
          reviewStatus: previousReviewStatus,
          rejectionReason: previousReviewStatus === "rejected"
            ? normalizeCertificateRejectionReason(current.rejectionReason)
            : "",
        }
      : null,
    after: {
      candidateId,
      originalName: validated.originalName,
      sizeBytes: validated.sizeBytes,
      sha256: validated.sha256,
      reviewStatus: "pending",
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

export async function reviewStudentCertificate(
  pb: PocketBase,
  actor: LomatonUser,
  candidateId: string,
  input: ReviewStudentCertificateInput,
) {
  if (!["approved", "rejected"].includes(input.decision)) {
    throw new ApiError(400, "La decisión no es válida.", "invalid_review_decision");
  }
  if (!/^[a-f0-9]{64}$/.test(String(input.expectedSha256 || ""))) {
    throw new ApiError(400, "La versión del certificado no es válida.", "invalid_certificate_version");
  }
  const reason = normalizeCertificateRejectionReason(
    input.reason,
    input.decision === "rejected",
  );
  const current = await findStudentCertificate(pb, candidateId);
  if (!current) {
    throw new ApiError(404, "El candidato no cargó un certificado.", "certificate_not_found");
  }
  const currentSha256 = String(current.sha256);
  if (currentSha256 !== input.expectedSha256) {
    throw new ApiError(
      409,
      "El certificado cambió. Revisá la versión vigente antes de decidir.",
      "certificate_review_conflict",
    );
  }
  const currentStatus = normalizeCertificateReviewStatus(current.reviewStatus);
  const currentReason = currentStatus === "rejected"
    ? normalizeCertificateRejectionReason(current.rejectionReason)
    : "";
  if (currentStatus === input.decision && currentReason === reason) {
    return adminStudentCertificateMetadata(current);
  }

  const settings = await defaultSettings(pb);
  const reviewedAt = new Date().toISOString();
  const batch = pb.createBatch();
  batch.collection("student_certificates").update(current.id, {
    reviewStatus: input.decision,
    reviewedBy: actor.id,
    reviewedAt,
    rejectionReason: input.decision === "rejected" ? reason : "",
  }, {
    query: { expected_sha256: input.expectedSha256 },
  });
  addAudit(batch, {
    actorId: actor.id,
    action: input.decision === "approved"
      ? "student_certificate.approve"
      : "student_certificate.reject",
    entityType: "student_certificates",
    entityId: current.id,
    before: {
      candidateId,
      reviewStatus: currentStatus,
      sha256: currentSha256,
      rejectionReason: currentReason,
    },
    after: {
      candidateId,
      reviewStatus: input.decision,
      sha256: currentSha256,
      rejectionReason: input.decision === "rejected" ? reason : "",
      reviewedAt,
    },
    reason: input.decision === "rejected" ? reason : "",
  });
  batch.collection("hackathon_settings").update(settings.id, { "dataVersion+": 1 });

  try {
    await batch.send();
  } catch (error) {
    if (isConflict(error)) {
      throw new ApiError(
        409,
        "El certificado cambió. Revisá la versión vigente antes de decidir.",
        "certificate_review_conflict",
      );
    }
    throw error;
  }
  return adminStudentCertificateMetadata(await findStudentCertificate(pb, candidateId));
}

export async function listStudentCertificatesForReview(
  pb: PocketBase,
  options: { status: CertificateReviewStatus; page?: number; perPage?: number },
): Promise<CertificateReviewQueue> {
  const status = normalizeCertificateReviewStatus(options.status);
  const page = Math.max(1, Math.trunc(options.page || 1));
  const perPage = Math.min(100, Math.max(1, Math.trunc(options.perPage || 20)));
  const filter = status === "pending"
    ? '(reviewStatus = "pending" || reviewStatus = "")'
    : pb.filter("reviewStatus = {:status}", { status });
  const result = await pb.collection("student_certificates").getList(page, perPage, {
    filter,
    sort: "-updated,id",
    expand: "candidate",
  });
  return {
    items: result.items.map((record) => {
      const candidate = record.expand?.candidate as RecordModel | undefined;
      return {
        id: record.id,
        candidateId: String(record.candidate),
        candidateName: String(
          candidate?.fullName
          || [candidate?.firstName, candidate?.lastName].filter(Boolean).join(" ")
          || "Candidato",
        ),
        candidateEmail: String(candidate?.email || ""),
        ...adminStudentCertificateMetadata(record),
      };
    }),
    page: result.page,
    perPage: result.perPage,
    totalItems: result.totalItems,
    totalPages: result.totalPages,
  };
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
