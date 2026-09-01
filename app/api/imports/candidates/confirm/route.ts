import { z } from "zod";

import { confirmRegistrationImport } from "@/lib/import/confirm-registrations";
import {
  buildRegistrationPreview,
  registrationImportRowSchema,
} from "@/lib/import/registrations";
import {
  createPocketBaseServiceClient,
  requirePocketBaseAdmin,
} from "@/lib/pocketbase/server";
import { ApiError, errorResponse } from "@/lib/server/api-error";

export const runtime = "nodejs";

const requestSchema = z.object({
  fileName: z.string().trim().min(1).max(255),
  fileType: z.enum(["csv", "xlsx"]),
  digest: z.string().regex(/^[a-f0-9]{64}$/),
  reason: z.string().max(1000).default(""),
  rows: z.array(registrationImportRowSchema),
  invalidRows: z.number().int().min(0),
  reviewRows: z.number().int().min(0),
  ignoredDuplicateRows: z.number().int().min(0),
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
    const verified = buildRegistrationPreview(parsed.data.rows);
    if (
      verified.summary.invalid > 0 ||
      verified.summary.review > 0 ||
      verified.summary.ignoredDuplicates > 0 ||
      verified.valid.length !== parsed.data.rows.length
    ) {
      return errorResponse(
        new ApiError(
          400,
          "Las filas cambiaron o requieren una nueva validación.",
          "stale_import_preview",
        ),
      );
    }
    if (parsed.data.reviewRows > 0) {
      return errorResponse(
        new ApiError(
          400,
          "La vista previa contiene filas pendientes de revisión.",
          "import_requires_review",
        ),
      );
    }

    const pb = await createPocketBaseServiceClient();
    const result = await confirmRegistrationImport(pb, user, {
      ...parsed.data,
      rows: verified.valid,
    });
    return Response.json(result, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
