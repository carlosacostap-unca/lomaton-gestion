import "server-only";

import PocketBase, { ClientResponseError, type RecordModel } from "pocketbase";

import { addAudit, defaultSettings } from "@/lib/domain/admin-commands";
import type { LomatonUser } from "@/lib/pocketbase/server";
import { ApiError } from "@/lib/server/api-error";

export type ProfilePatch = {
  expectedVersion: number;
  phone?: string;
  department?: string;
  academicUnit?: string;
  career?: string;
  externalTeacherDescription?: string;
  mentorInterest?: "yes" | "no" | "not_provided";
};

const commonFields = new Set(["phone"]);
const studentFields = new Set(["phone", "department", "academicUnit", "career"]);
const teacherFields = new Set(["phone", "department", "externalTeacherDescription", "mentorInterest"]);

function digits(value: string) {
  return value.replace(/\D/g, "");
}

async function registrationFor(pb: PocketBase, user: LomatonUser) {
  if (!user.registration) throw new ApiError(403, "La cuenta no está vinculada a una inscripción activa.", "registration_required");
  return pb.collection("registrations").getOne(user.registration);
}

function roleFor(registration: RecordModel) {
  return registration.relationship === "teacher" ? "teacher" as const : "student" as const;
}

export function projectOwnProfile(registration: RecordModel) {
  const role = roleFor(registration);
  return {
    id: registration.id,
    role,
    version: Number(registration.profileVersion || 0),
    readOnly: {
      fullName: String(registration.fullName || ""),
      email: String(registration.email || ""),
      dni: String(registration.dni || ""),
      relationship: String(registration.relationship || ""),
      ftcaStatus: String(registration.ftcaStatus || ""),
    },
    editable: role === "teacher"
      ? {
          phone: String(registration.phone || ""),
          department: String(registration.department || ""),
          externalTeacherDescription: String(registration.externalTeacherDescription || ""),
          mentorInterest: String(registration.mentorInterest || "not_provided"),
        }
      : {
          phone: String(registration.phone || ""),
          department: String(registration.department || ""),
          academicUnit: String(registration.academicUnit || ""),
          career: String(registration.career || ""),
        },
    editableFields: [...(role === "teacher" ? teacherFields : studentFields)],
    selfManagedFields: Array.isArray(registration.selfManagedFields) ? registration.selfManagedFields : [],
    selfEditedAt: String(registration.selfEditedAt || ""),
  };
}

export async function getOwnProfile(pb: PocketBase, user: LomatonUser) {
  return projectOwnProfile(await registrationFor(pb, user));
}

export async function updateOwnProfile(pb: PocketBase, user: LomatonUser, input: ProfilePatch) {
  const registration = await registrationFor(pb, user);
  const role = roleFor(registration);
  const allowed = role === "teacher" ? teacherFields : studentFields;
  const submitted = Object.entries(input).filter(([key]) => key !== "expectedVersion");
  if (!submitted.length) throw new ApiError(400, "No se enviaron cambios de perfil.", "empty_profile_update");
  if (submitted.some(([key]) => !allowed.has(key))) {
    throw new ApiError(403, "El perfil incluye campos que no son editables para este rol.", "protected_profile_field");
  }
  const currentVersion = Number(registration.profileVersion || 0);
  if (input.expectedVersion !== currentVersion) {
    throw new ApiError(409, "El perfil cambió en otra sesión. Recargá antes de guardar.", "profile_version_conflict");
  }
  const changes = submitted.filter(([key, value]) => String(registration[key] ?? "").trim() !== String(value ?? "").trim());
  if (!changes.length) return projectOwnProfile(registration);

  const patch: Record<string, unknown> = {};
  for (const [key, value] of changes) patch[key] = typeof value === "string" ? value.trim() : value;
  if (typeof patch.phone === "string") patch.phoneNormalized = digits(patch.phone);
  const managed = new Set<string>(Array.isArray(registration.selfManagedFields) ? registration.selfManagedFields : []);
  for (const [key] of changes) managed.add(key);
  patch.selfManagedFields = [...managed];
  patch.selfEditedAt = new Date().toISOString();
  patch.profileVersion = currentVersion + 1;

  const settings = await defaultSettings(pb);
  const batch = pb.createBatch();
  if (role === "teacher") {
    const mentor = await pb.collection("mentor_profiles").getFirstListItem(
      pb.filter("registration = {:registration} && active = true", { registration: registration.id }),
    ).catch((error) => {
      if (error instanceof ClientResponseError && error.status === 404) return null;
      throw error;
    });
    if (!mentor) throw new ApiError(403, "El perfil docente no está activo.", "mentor_inactive");
    if (patch.mentorInterest && patch.mentorInterest !== "yes" && registration.mentorInterest === "yes") {
      const assignments = await pb.collection("team_mentorships").getFullList({
        filter: pb.filter("mentor = {:mentor}", { mentor: mentor.id }),
      });
      if (assignments.length) throw new ApiError(409, "Administración debe resolver la mentoría vigente antes de cambiar la disponibilidad.", "mentor_assigned");
      const invitations = await pb.collection("mentor_invitations").getFullList({
        filter: pb.filter("mentor = {:mentor} && status = {:status}", { mentor: mentor.id, status: "pending" }),
      });
      for (const invitation of invitations) batch.collection("mentor_invitations").update(invitation.id, { status: "cancelled", resolvedAt: new Date().toISOString() });
    }
    const mentorPatch: Record<string, unknown> = {};
    if (patch.department !== undefined) mentorPatch.department = patch.department;
    if (patch.externalTeacherDescription !== undefined) mentorPatch.externalDescription = patch.externalTeacherDescription;
    if (patch.mentorInterest !== undefined) mentorPatch.mentorInterest = patch.mentorInterest;
    if (Object.keys(mentorPatch).length) batch.collection("mentor_profiles").update(mentor.id, mentorPatch);
  }

  batch.collection("registrations").update(registration.id, patch, {
    query: { expected_profile_version: currentVersion },
  });
  addAudit(batch, {
    actorId: user.id,
    action: "participant.profile.update",
    entityType: "registrations",
    entityId: registration.id,
    before: projectOwnProfile(registration),
    after: { changedFields: changes.map(([key]) => key), version: currentVersion + 1 },
  });
  batch.collection("hackathon_settings").update(settings.id, { "dataVersion+": 1 });
  try {
    await batch.send();
  } catch (error) {
    if (error instanceof ClientResponseError && [400, 409].includes(error.status)) {
      throw new ApiError(409, "El perfil cambió en otra sesión. Recargá antes de guardar.", "profile_version_conflict", error.response?.data);
    }
    throw error;
  }
  return getOwnProfile(pb, user);
}

export const editableProfileFields = { commonFields, studentFields, teacherFields };
