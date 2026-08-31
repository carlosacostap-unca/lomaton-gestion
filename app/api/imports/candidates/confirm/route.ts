import { z } from "zod";

import { confirmCandidateImport } from "@/lib/import/confirm-candidates";
import {
  createPocketBaseServiceClient,
  requirePocketBaseAdmin,
} from "@/lib/pocketbase/server";
import { ApiError, errorResponse } from "@/lib/server/api-error";

export const runtime = "nodejs";

const rowSchema = z.object({
  firstName: z.string().trim().min(1).max(120),
  lastName: z.string().trim().min(1).max(120),
  email: z.email().max(254),
  emailNormalized: z.email().max(254),
  ftcaStatus: z.enum(["confirmed", "not_ftca", "pending"]),
});

const requestSchema = z.object({
  fileName: z.string().trim().min(1).max(255),
  fileType: z.enum(["csv", "xlsx"]),
  digest: z.string().regex(/^[a-f0-9]{64}$/),
  reason: z.string().max(1000).default(""),
  rows: z.array(rowSchema),
  invalidRows: z.number().int().min(0),
  pendingFtcaRows: z.number().int().min(0),
});

export async function POST(request: Request) {
  try {
    const { env, user } = await requirePocketBaseAdmin(
      request.headers.get("authorization"),
    );
    const parsed = requestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json({ error: "La vista previa ya no es válida.", issues: parsed.error.issues }, { status: 400 });
    }
    if (parsed.data.rows.length > env.importMaxRows) {
      return Response.json({ error: `La confirmación supera ${env.importMaxRows} filas.` }, { status: 400 });
    }

    if (parsed.data.rows.length === 0) {
      return errorResponse(new ApiError(400, "No hay filas válidas para importar.", "empty_import"));
    }
    const pb = await createPocketBaseServiceClient();
    const result = await confirmCandidateImport(pb, user, parsed.data);
    return Response.json(result, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
