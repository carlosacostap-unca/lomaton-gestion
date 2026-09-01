import { z } from "zod";

import {
  addAdminTeamMember,
  createAdminTeam,
  disbandAdminTeam,
  removeAdminTeamMember,
  reconcileTeams,
  resolveAdminInvitation,
  updateAdminCandidate,
  updateAdminTeam,
  updateHackathonSettings,
} from "@/lib/domain/admin-commands";
import {
  createTeam,
  disbandOwnTeam,
  inviteCandidate,
  resolveOwnInvitation,
  withdrawInvitation,
} from "@/lib/domain/team-commands";
import {
  listAdminRegistrations,
  updateAdminRegistration,
} from "@/lib/domain/registration-admin";
import {
  createPocketBaseServiceClient,
  requirePocketBaseAdmin,
  requirePocketBaseUser,
} from "@/lib/pocketbase/server";
import { readConsistentReportSnapshot } from "@/lib/report/snapshot";
import { ApiError, errorResponse } from "@/lib/server/api-error";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ path: string[] }> };

const teamSchema = z.object({ name: z.string() });
const invitationSchema = z.object({ candidateId: z.string().min(1) });
const settingsSchema = z.object({
  deadlineUtc: z.string(),
  formationOpen: z.boolean(),
  reason: z.string().max(1000).default(""),
});
const adminTeamSchema = z.object({
  name: z.string(),
  ownerCandidateId: z.string().min(1),
  reason: z.string().max(1000).default(""),
});
const adminTeamUpdateSchema = z.object({
  name: z.string().optional(),
  ownerCandidateId: z.string().optional(),
  reason: z.string().max(1000).default(""),
});
const reasonSchema = z.object({ reason: z.string().max(1000).default("") });
const resolutionSchema = reasonSchema.extend({
  resolution: z.enum(["accepted", "rejected", "cancelled"]),
});
const candidateUpdateSchema = z.object({
  firstName: z.string().trim().min(1).max(120),
  lastName: z.string().trim().min(1).max(120),
  email: z.email().max(254),
  ftcaStatus: z.enum(["confirmed", "not_ftca", "pending"]),
  active: z.boolean(),
  reason: z.string().max(1000).default(""),
});
const registrationUpdateSchema = z.object({
  fullName: z.string().trim().min(1).max(240),
  dni: z.string().trim().min(5).max(30),
  phone: z.string().trim().min(5).max(50),
  email: z.email().max(254),
  relationship: z.enum(["student_ftca", "student_external", "teacher"]),
  ftcaStatus: z.enum(["confirmed", "not_ftca", "pending"]),
  department: z.string().max(240).default(""),
  academicUnit: z.string().max(240).default(""),
  career: z.string().max(240).default(""),
  externalTeacherDescription: z.string().max(1000).default(""),
  mentorInterest: z.enum(["yes", "no", "not_provided"]),
  declaredTeamStatus: z.enum(["complete", "none", "partial", "not_provided"]),
  declaredTeamMembers: z.string().max(2000).default(""),
  termsAccepted: z.enum(["yes", "no", "not_provided"]),
  mediaAuthorized: z.enum(["yes", "no", "not_provided"]),
  active: z.boolean(),
  reason: z.string().max(1000).default(""),
});

async function body(request: Request) {
  try {
    return await request.json();
  } catch {
    throw new ApiError(400, "El cuerpo JSON no es válido.", "invalid_json");
  }
}

async function context(request: Request) {
  const { user } = await requirePocketBaseUser(request.headers.get("authorization"));
  const pb = await createPocketBaseServiceClient();
  return { user, pb };
}

async function adminContext(request: Request) {
  const { user } = await requirePocketBaseAdmin(request.headers.get("authorization"));
  const pb = await createPocketBaseServiceClient();
  return { user, pb };
}

export async function GET(request: Request, routeContext: Context) {
  try {
    const { path } = await routeContext.params;
    const { pb } = await adminContext(request);
    if (path.length === 2 && path[0] === "admin" && path[1] === "report-snapshot") {
      return Response.json(await readConsistentReportSnapshot(pb));
    }
    if (path.length === 2 && path[0] === "admin" && path[1] === "registrations") {
      const query = new URL(request.url).searchParams.get("query") ?? "";
      return Response.json(await listAdminRegistrations(pb, query));
    }
    throw new ApiError(404, "La operación no existe.", "route_not_found");
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request, routeContext: Context) {
  try {
    const { path } = await routeContext.params;
    const { user, pb } = await adminContext(request);
    if (path.length === 2 && path[0] === "admin" && path[1] === "settings") {
      const input = settingsSchema.parse(await body(request));
      return Response.json(await updateHackathonSettings(pb, user, input));
    }
    if (path.length === 3 && path[0] === "admin" && path[1] === "teams") {
      const input = adminTeamUpdateSchema.parse(await body(request));
      return Response.json(await updateAdminTeam(pb, user, path[2], input));
    }
    if (path.length === 3 && path[0] === "admin" && path[1] === "candidates") {
      const input = candidateUpdateSchema.parse(await body(request));
      return Response.json(await updateAdminCandidate(pb, user, path[2], input));
    }
    if (path.length === 3 && path[0] === "admin" && path[1] === "registrations") {
      const input = registrationUpdateSchema.parse(await body(request));
      return Response.json(await updateAdminRegistration(pb, user, path[2], input));
    }
    throw new ApiError(404, "La operación no existe.", "route_not_found");
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(new ApiError(400, "Los datos enviados no son válidos.", "validation_error", error.issues));
    }
    return errorResponse(error);
  }
}

export async function POST(request: Request, routeContext: Context) {
  try {
    const { path } = await routeContext.params;
    if (path[0] === "admin") {
      const { user, pb } = await adminContext(request);
      if (path.length === 2 && path[1] === "teams") {
        const input = adminTeamSchema.parse(await body(request));
        return Response.json(await createAdminTeam(pb, user, input), { status: 201 });
      }
      if (path.length === 2 && path[1] === "reconcile-teams") {
        const input = reasonSchema.parse(await body(request));
        return Response.json(await reconcileTeams(pb, user, input.reason));
      }
      if (path.length === 4 && path[1] === "invitations" && path[3] === "resolve") {
        const input = resolutionSchema.parse(await body(request));
        return Response.json(
          await resolveAdminInvitation(pb, user, path[2], input.resolution, input.reason),
        );
      }
      throw new ApiError(404, "La operación no existe.", "route_not_found");
    }
    const { user, pb } = await context(request);

    if (path.length === 1 && path[0] === "teams") {
      const input = teamSchema.parse(await body(request));
      return Response.json(await createTeam(pb, user, input.name), { status: 201 });
    }
    if (path.length === 3 && path[0] === "teams" && path[2] === "invitations") {
      const input = invitationSchema.parse(await body(request));
      return Response.json(await inviteCandidate(pb, user, path[1], input.candidateId), { status: 201 });
    }
    if (path.length === 3 && path[0] === "invitations" && path[2] === "accept") {
      return Response.json(await resolveOwnInvitation(pb, user, path[1], "accepted"));
    }
    if (path.length === 3 && path[0] === "invitations" && path[2] === "reject") {
      return Response.json(await resolveOwnInvitation(pb, user, path[1], "rejected"));
    }
    throw new ApiError(404, "La operación no existe.", "route_not_found");
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(new ApiError(400, "Los datos enviados no son válidos.", "validation_error", error.issues));
    }
    return errorResponse(error);
  }
}

export async function PUT(request: Request, routeContext: Context) {
  try {
    const { path } = await routeContext.params;
    const { user, pb } = await adminContext(request);
    if (
      path.length === 5 && path[0] === "admin" && path[1] === "teams" &&
      path[3] === "members"
    ) {
      const input = reasonSchema.parse(await body(request));
      return Response.json(
        await addAdminTeamMember(pb, user, path[2], path[4], input.reason),
      );
    }
    throw new ApiError(404, "La operación no existe.", "route_not_found");
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(new ApiError(400, "Los datos enviados no son válidos.", "validation_error", error.issues));
    }
    return errorResponse(error);
  }
}

export async function DELETE(request: Request, routeContext: Context) {
  try {
    const { path } = await routeContext.params;
    if (path[0] === "admin") {
      const { user, pb } = await adminContext(request);
      if (path.length === 3 && path[1] === "teams") {
        const input = reasonSchema.parse(await body(request));
        await disbandAdminTeam(pb, user, path[2], input.reason);
        return new Response(null, { status: 204 });
      }
      if (
        path.length === 5 && path[1] === "teams" && path[3] === "members"
      ) {
        const input = reasonSchema.parse(await body(request));
        return Response.json(
          await removeAdminTeamMember(pb, user, path[2], path[4], input.reason),
        );
      }
      throw new ApiError(404, "La operación no existe.", "route_not_found");
    }
    const { user, pb } = await context(request);
    if (path.length === 2 && path[0] === "teams") {
      await disbandOwnTeam(pb, user, path[1]);
      return new Response(null, { status: 204 });
    }
    if (path.length === 2 && path[0] === "invitations") {
      return Response.json(await withdrawInvitation(pb, user, path[1]));
    }
    throw new ApiError(404, "La operación no existe.", "route_not_found");
  } catch (error) {
    return errorResponse(error);
  }
}
