import { evaluateBootstrapAccess, normalizeEmail } from "@/lib/auth/bootstrap-policy";
import {
  GENERIC_LOGIN_ERROR_MESSAGE,
  getPublicBootstrapErrorMessage,
} from "@/lib/auth/access-messages";
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

    const [candidates, registrations, admins, jurors] = await Promise.all([
      pb.collection("candidates").getList(1, 1, { filter }),
      pb.collection("registrations").getList(1, 1, {
        filter: pb.filter("emailNormalized = {:email}", { email }),
      }),
      pb.collection("admin_allowlist").getList(1, 1, { filter }),
      pb.collection("jurors").getList(1, 1, { filter }),
    ]);
    const registration = registrations.items[0] ?? null;
    const mentors = registration
      ? await pb.collection("mentor_profiles").getList(1, 1, {
          filter: pb.filter("registration = {:registration} && active = true", {
            registration: registration.id,
          }),
        })
      : { items: [] };
    const access = evaluateBootstrapAccess({
      email,
      verified: user.verified,
      currentDisplayName: user.displayName || user.name,
      candidate: candidates.items[0] as never,
      registration: registration as never,
      mentor: mentors.items[0] as never,
      admin: admins.items[0] as never,
      juror: jurors.items[0] as never,
    });

    if (!access.allowed) {
      throw new ApiError(
        403,
        getPublicBootstrapErrorMessage(access.reason) ?? GENERIC_LOGIN_ERROR_MESSAGE,
        access.reason,
      );
    }

    const updated = await pb.collection("users").update(user.id, access.patch);
    return Response.json({
      participantRole: access.participantRole,
      user: {
        id: updated.id,
        email: updated.email,
        displayName: updated.displayName,
        candidate: updated.candidate,
        registration: updated.registration,
        juror: updated.juror,
        isAdmin: updated.isAdmin,
        enabled: updated.enabled,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
