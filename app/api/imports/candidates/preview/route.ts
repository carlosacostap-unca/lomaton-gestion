import { createHash } from "node:crypto";

import { parseCandidateFile } from "@/lib/import/candidates";
import { requirePocketBaseAdmin } from "@/lib/pocketbase/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { env } = await requirePocketBaseAdmin(request.headers.get("authorization"));
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return Response.json({ error: "Seleccione un archivo CSV o XLSX." }, { status: 400 });
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const rows = await parseCandidateFile(bytes, file.name, {
      maxBytes: env.importMaxBytes,
      maxRows: env.importMaxRows,
    });
    const valid = rows.filter((row) => row.valid).map((row) => row.candidate);
    const invalid = rows.filter((row) => !row.valid);
    const pending = valid.filter((row) => row.ftcaStatus === "pending");
    const digest = createHash("sha256")
      .update(bytes)
      .update(JSON.stringify(valid))
      .digest("hex");

    return Response.json({
      fileName: file.name,
      fileType: file.name.toLowerCase().endsWith(".xlsx") ? "xlsx" : "csv",
      digest,
      summary: { total: rows.length, valid: valid.length, invalid: invalid.length, pendingFtca: pending.length },
      valid,
      invalid,
      pending,
    });
  } catch (error) {
    if (error instanceof Response) return error;
    return Response.json(
      { error: error instanceof Error ? error.message : "No se pudo analizar el archivo." },
      { status: 400 },
    );
  }
}
