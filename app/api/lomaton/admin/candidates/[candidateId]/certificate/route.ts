import {
  adminStudentCertificateMetadata,
  findStudentCertificate,
  reviewStudentCertificate,
} from "@/lib/domain/student-certificates";
import { createPocketBaseServiceClient, requirePocketBaseAdmin } from "@/lib/pocketbase/server";
import { ApiError, errorResponse } from "@/lib/server/api-error";
import { validateCandidateId } from "@/lib/server/certificate-routes";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ candidateId: string }> };

const reviewSchema = z.object({
  decision: z.enum(["approved", "rejected"]),
  reason: z.string().max(1000).optional(),
  expectedSha256: z.string().regex(/^[a-f0-9]{64}$/),
}).strict();

export async function GET(request: Request, context: Context) {
  try {
    await requirePocketBaseAdmin(request.headers.get("authorization"));
    const candidateId = validateCandidateId((await context.params).candidateId);
    const pb = await createPocketBaseServiceClient();
    await pb.collection("candidates").getOne(candidateId);
    return Response.json(adminStudentCertificateMetadata(await findStudentCertificate(pb, candidateId)));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request, context: Context) {
  try {
    const admin = await requirePocketBaseAdmin(request.headers.get("authorization"));
    const candidateId = validateCandidateId((await context.params).candidateId);
    const parsed = reviewSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new ApiError(400, "La decisión enviada no es válida.", "invalid_review_payload", parsed.error.flatten());
    }
    const pb = await createPocketBaseServiceClient();
    await pb.collection("candidates").getOne(candidateId);
    return Response.json(await reviewStudentCertificate(pb, admin.user, candidateId, parsed.data));
  } catch (error) {
    return errorResponse(error);
  }
}
