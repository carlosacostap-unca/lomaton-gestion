import {
  certificateReviewStatuses,
  listStudentCertificatesForReview,
  type CertificateReviewStatus,
} from "@/lib/domain/student-certificates";
import { createPocketBaseServiceClient, requirePocketBaseAdmin } from "@/lib/pocketbase/server";
import { ApiError, errorResponse } from "@/lib/server/api-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function positiveInteger(value: string | null, fallback: number, maximum: number) {
  if (value === null || value === "") return fallback;
  if (!/^\d+$/.test(value)) throw new ApiError(400, "La paginación no es válida.", "invalid_pagination");
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > maximum) {
    throw new ApiError(400, "La paginación no es válida.", "invalid_pagination");
  }
  return parsed;
}

export async function GET(request: Request) {
  try {
    await requirePocketBaseAdmin(request.headers.get("authorization"));
    const url = new URL(request.url);
    const statusValue = url.searchParams.get("status") || "pending";
    if (!certificateReviewStatuses.includes(statusValue as CertificateReviewStatus)) {
      throw new ApiError(400, "El estado solicitado no es válido.", "invalid_review_status");
    }
    const pb = await createPocketBaseServiceClient();
    return Response.json(await listStudentCertificatesForReview(pb, {
      status: statusValue as CertificateReviewStatus,
      page: positiveInteger(url.searchParams.get("page"), 1, 1_000_000),
      perPage: positiveInteger(url.searchParams.get("perPage"), 20, 100),
    }));
  } catch (error) {
    return errorResponse(error);
  }
}
