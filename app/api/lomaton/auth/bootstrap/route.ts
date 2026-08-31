import { evaluateBootstrapAccess, normalizeEmail } from "@/lib/auth/bootstrap-policy";
import {
  createPocketBaseServiceClient,
  requirePocketBaseUser,
} from "@/lib/pocketbase/server";
import { ApiError, errorResponse } from "@/lib/server/api-error";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { user } = await requirePocketBaseUser(
      request.headers.get("authorization"),
      { requireEnabled: false },
    );
    const pb = await createPocketBaseServiceClient();
    const email = normalizeEmail(user.email);
    const filter = pb.filter("emailNormalized = {:email} && active = true", {
      email,
    });

    const [candidates, admins] = await Promise.all([
      pb.collection("candidates").getList(1, 1, { filter }),
      pb.collection("admin_allowlist").getList(1, 1, { filter }),
    ]);
    const access = evaluateBootstrapAccess({
      email,
      verified: user.verified,
      currentDisplayName: user.displayName || user.name,
      candidate: candidates.items[0] as never,
      admin: admins.items[0] as never,
    });

    if (!access.allowed) {
      throw new ApiError(
        403,
        "El email autenticado no está habilitado para este hackatón.",
        access.reason,
      );
    }

    const updated = await pb.collection("users").update(user.id, access.patch);
    return Response.json({
      user: {
        id: updated.id,
        email: updated.email,
        displayName: updated.displayName,
        candidate: updated.candidate,
        isAdmin: updated.isAdmin,
        enabled: updated.enabled,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
