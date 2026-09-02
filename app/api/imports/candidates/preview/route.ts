import { createHash } from "node:crypto";
import { z } from "zod";

import {
  parseRegistrationFile,
  registrationImportRowSchema,
  revalidateRegistrationRows,
} from "@/lib/import/registrations";
import { selfManagedImportDifferences } from "@/lib/import/registration-self-management";
import { createPocketBaseServiceClient, requirePocketBaseAdmin } from "@/lib/pocketbase/server";

export const runtime = "nodejs";

const revalidationSchema = z.object({
  fileName: z.string().trim().min(1).max(255),
  fileType: z.enum(["csv", "xlsx"]),
  rows: z.array(registrationImportRowSchema),
});

function digestPreview(fileDigest: string, valid: unknown[], review: unknown[]) {
  return createHash("sha256")
    .update(fileDigest)
    .update(JSON.stringify({ valid, review }))
    .digest("hex");
}

export async function POST(request: Request) {
  try {
    const { env } = await requirePocketBaseAdmin(request.headers.get("authorization"));
    const pb = await createPocketBaseServiceClient();
    const registrations = await pb.collection("registrations").getFullList({
      fields: "id,emailNormalized,dniNormalized,phone,department,academicUnit,career,externalTeacherDescription,mentorInterest,selfManagedFields",
    });
    if (request.headers.get("content-type")?.includes("application/json")) {
      const parsed = revalidationSchema.safeParse(await request.json());
      if (!parsed.success || parsed.data.rows.length > env.importMaxRows) {
        return Response.json(
          { error: "Las correcciones de la vista previa no son válidas." },
          { status: 400 },
        );
      }
      const preview = revalidateRegistrationRows(parsed.data.rows);
      return Response.json({
        fileName: parsed.data.fileName,
        fileType: parsed.data.fileType,
        digest: digestPreview("revalidated", preview.valid, preview.review),
        selfManagedDifferences: selfManagedImportDifferences(registrations, parsed.data.rows),
        ...preview,
      });
    }

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return Response.json({ error: "Seleccione un archivo CSV o XLSX." }, { status: 400 });
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const preview = await parseRegistrationFile(bytes, file.name, {
      maxBytes: env.importMaxBytes,
      maxRows: env.importMaxRows,
    });
    const fileDigest = createHash("sha256").update(bytes).digest("hex");

    return Response.json({
      fileName: file.name,
      fileType: file.name.toLowerCase().endsWith(".xlsx") ? "xlsx" : "csv",
      digest: digestPreview(fileDigest, preview.valid, preview.review),
      selfManagedDifferences: selfManagedImportDifferences(registrations, preview.items.map((item) => item.row)),
      ...preview,
    });
  } catch (error) {
    if (error instanceof Response) return error;
    return Response.json(
      { error: error instanceof Error ? error.message : "No se pudo analizar el archivo." },
      { status: 400 },
    );
  }
}
