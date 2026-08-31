import { z } from "zod";

import { requirePocketBaseAdmin } from "@/lib/pocketbase/server";

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
    const { env, authorization } = await requirePocketBaseAdmin(
      request.headers.get("authorization"),
    );
    const parsed = requestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json({ error: "La vista previa ya no es válida.", issues: parsed.error.issues }, { status: 400 });
    }
    if (parsed.data.rows.length > env.importMaxRows) {
      return Response.json({ error: `La confirmación supera ${env.importMaxRows} filas.` }, { status: 400 });
    }

    const response = await fetch(`${env.pocketBaseUrl}/api/lomaton/admin/import-candidates`, {
      method: "POST",
      headers: { Authorization: authorization, "Content-Type": "application/json" },
      body: JSON.stringify(parsed.data),
      cache: "no-store",
    });
    const data = await response.json();
    return Response.json(data, { status: response.status });
  } catch (error) {
    if (error instanceof Response) return error;
    return Response.json({ error: "No se pudo confirmar la importación." }, { status: 500 });
  }
}
