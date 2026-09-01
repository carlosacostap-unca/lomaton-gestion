import {
  findStudentCertificate,
  requireActiveCandidate,
  studentCertificateMetadata,
  upsertStudentCertificate,
} from "@/lib/domain/student-certificates";
import { validateStudentCertificate } from "@/lib/domain/student-certificate-validation";
import {
  createPocketBaseServiceClient,
  requirePocketBaseUser,
} from "@/lib/pocketbase/server";
import { ApiError, errorResponse } from "@/lib/server/api-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function context(request: Request) {
  const auth = await requirePocketBaseUser(request.headers.get("authorization"));
  const candidateId = String(auth.user.candidate || "");
  if (!candidateId) {
    throw new ApiError(403, "La cuenta no está vinculada a un candidato.", "candidate_required");
  }
  const pb = await createPocketBaseServiceClient();
  await requireActiveCandidate(pb, candidateId);
  return { ...auth, candidateId, pb };
}

export async function GET(request: Request) {
  try {
    const { pb, candidateId, env } = await context(request);
    return Response.json({
      ...studentCertificateMetadata(await findStudentCertificate(pb, candidateId)),
      maxBytes: env.certificateMaxBytes,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const { pb, candidateId, user, env } = await context(request);
    const contentType = request.headers.get("content-type") || "";
    if (!contentType.toLowerCase().includes("multipart/form-data")) {
      throw new ApiError(415, "La carga debe enviarse como formulario multipart.", "invalid_content_type");
    }
    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > env.certificateMaxBytes + 1024 * 1024) {
      throw new ApiError(413, "La solicitud supera el límite de carga.", "certificate_request_too_large");
    }
    const formData = await request.formData();
    const file = formData.get("certificate");
    if (!(file instanceof File)) {
      throw new ApiError(400, "Seleccioná un certificado PDF.", "certificate_required");
    }
    const validated = await validateStudentCertificate(file, env.certificateMaxBytes);
    return Response.json({
      ...(await upsertStudentCertificate(pb, user, candidateId, validated)),
      maxBytes: env.certificateMaxBytes,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
