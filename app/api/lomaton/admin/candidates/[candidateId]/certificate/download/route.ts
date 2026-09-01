import { createPocketBaseServiceClient, requirePocketBaseAdmin } from "@/lib/pocketbase/server";
import { errorResponse } from "@/lib/server/api-error";
import { proxyStudentCertificate, validateCandidateId } from "@/lib/server/certificate-routes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ candidateId: string }> };

export async function GET(request: Request, context: Context) {
  try {
    await requirePocketBaseAdmin(request.headers.get("authorization"));
    const candidateId = validateCandidateId((await context.params).candidateId);
    const pb = await createPocketBaseServiceClient();
    await pb.collection("candidates").getOne(candidateId);
    return await proxyStudentCertificate(pb, candidateId);
  } catch (error) {
    return errorResponse(error);
  }
}
