import { requireActiveCandidate } from "@/lib/domain/student-certificates";
import { createPocketBaseServiceClient, requirePocketBaseUser } from "@/lib/pocketbase/server";
import { ApiError, errorResponse } from "@/lib/server/api-error";
import { proxyStudentCertificate } from "@/lib/server/certificate-routes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { user } = await requirePocketBaseUser(request.headers.get("authorization"));
    const candidateId = String(user.candidate || "");
    if (!candidateId) {
      throw new ApiError(403, "La cuenta no está vinculada a un candidato.", "candidate_required");
    }
    const pb = await createPocketBaseServiceClient();
    await requireActiveCandidate(pb, candidateId);
    return await proxyStudentCertificate(pb, candidateId);
  } catch (error) {
    return errorResponse(error);
  }
}
