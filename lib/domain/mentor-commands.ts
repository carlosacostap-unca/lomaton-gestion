import "server-only";

import { randomBytes } from "node:crypto";

import PocketBase, { ClientResponseError, type RecordModel } from "pocketbase";

import { addAudit, requireReasonWhenClosed } from "@/lib/domain/admin-commands";
import type { LomatonUser } from "@/lib/pocketbase/server";
import { ApiError } from "@/lib/server/api-error";

function recordId() {
  return randomBytes(12).toString("hex").slice(0, 15);
}

function candidateId(user: LomatonUser) {
  if (!user.candidate) throw new ApiError(403, "La operación requiere un estudiante activo.", "candidate_required");
  return user.candidate;
}

async function mentorForUser(pb: PocketBase, user: LomatonUser) {
  if (!user.registration) throw new ApiError(403, "La operación requiere un docente activo.", "mentor_required");
  try {
    return await pb.collection("mentor_profiles").getFirstListItem(
      pb.filter("registration = {:registration} && active = true", { registration: user.registration }),
    );
  } catch (error) {
    if (error instanceof ClientResponseError && error.status === 404) {
      throw new ApiError(403, "La operación requiere un docente activo.", "mentor_required");
    }
    throw error;
  }
}

async function ownedTeam(pb: PocketBase, user: LomatonUser, teamId: string) {
  const team = await pb.collection("teams").getOne(teamId);
  if (team.owner !== candidateId(user)) throw new ApiError(403, "Solamente el responsable del equipo puede gestionar la mentoría.", "owner_required");
  return team;
}

async function firstOrNull(pb: PocketBase, collection: string, filter: string) {
  try {
    return await pb.collection(collection).getFirstListItem(filter);
  } catch (error) {
    if (error instanceof ClientResponseError && error.status === 404) return null;
    throw error;
  }
}

async function send(batch: ReturnType<PocketBase["createBatch"]>) {
  try {
    await batch.send();
  } catch (error) {
    if (error instanceof ClientResponseError && [400, 409].includes(error.status)) {
      throw new ApiError(409, "Otra operación resolvió esta mentoría. Actualizá la pantalla.", "mentorship_conflict", error.response?.data);
    }
    throw error;
  }
}

async function registrationMap(pb: PocketBase, mentors: RecordModel[]) {
  if (!mentors.length) return new Map<string, RecordModel>();
  const ids = [...new Set(mentors.map((mentor) => String(mentor.registration)))];
  const records = await pb.collection("registrations").getFullList({
    filter: ids.map((id) => pb.filter("id = {:id}", { id })).join(" || "),
  });
  return new Map(records.map((record) => [record.id, record]));
}

function mentorDto(mentor: RecordModel, registration?: RecordModel) {
  return {
    id: mentor.id,
    fullName: String(registration?.fullName || ""),
    department: String(mentor.department || ""),
    externalDescription: String(mentor.externalDescription || ""),
  };
}

export async function getTeamMentorState(pb: PocketBase, user: LomatonUser, teamId: string) {
  await ownedTeam(pb, user, teamId);
  const assignment = await firstOrNull(
    pb,
    "team_mentorships",
    pb.filter("team = {:team}", { team: teamId }),
  );
  const mentorIds = assignment ? [String(assignment.mentor)] : [];
  const mentors = mentorIds.length ? await pb.collection("mentor_profiles").getFullList({ filter: mentorIds.map((id) => pb.filter("id = {:id}", { id })).join(" || ") }) : [];
  const byId = new Map(mentors.map((mentor) => [mentor.id, mentor]));
  const registrations = await registrationMap(pb, mentors);
  const dto = (mentorId: string) => {
    const mentor = byId.get(mentorId);
    return mentor ? mentorDto(mentor, registrations.get(String(mentor.registration))) : null;
  };
  return {
    assignment: assignment ? { id: assignment.id, mentor: dto(String(assignment.mentor)) } : null,
  };
}

export async function getOwnMentorDashboard(pb: PocketBase, user: LomatonUser) {
  const mentor = await mentorForUser(pb, user);
  const assignments = await pb.collection("team_mentorships").getFullList({
    filter: pb.filter("mentor = {:mentor}", { mentor: mentor.id }),
    sort: "created",
  });
  const teamIds = [...new Set(assignments.map((item) => String(item.team)))];
  const teams = teamIds.length ? await pb.collection("teams").getFullList({ filter: teamIds.map((id) => pb.filter("id = {:id}", { id })).join(" || ") }) : [];
  const teamById = new Map(teams.map((team) => [team.id, team]));
  const membershipsByTeam = new Map<string, Array<{ id: string; fullName: string }>>();
  await Promise.all(assignments.map(async (assignment) => {
    const teamId = String(assignment.team);
    const memberships = await pb.collection("team_memberships").getFullList({
      filter: pb.filter("team = {:team}", { team: teamId }),
      expand: "candidate",
    });
    membershipsByTeam.set(teamId, memberships.map((membership) => ({
      id: String(membership.candidate),
      fullName: String(membership.expand?.candidate?.fullName || ""),
    })));
  }));
  return {
    mentor: { id: mentor.id, mentorInterest: mentor.mentorInterest },
    assignments: assignments.map((assignment) => {
      const teamId = String(assignment.team);
      const team = teamById.get(teamId);
      return {
        id: teamId,
        name: String(team?.name || ""),
        status: String(team?.status || ""),
        members: membershipsByTeam.get(teamId) ?? [],
      };
    }),
  };
}

export async function assignAdminMentor(
  pb: PocketBase,
  admin: LomatonUser,
  teamId: string,
  mentorId: string,
  reason: string,
) {
  const settings = await requireReasonWhenClosed(pb, reason);
  await pb.collection("teams").getOne(teamId);
  const mentor = await pb.collection("mentor_profiles").getOne(mentorId);
  if (!mentor.active || mentor.mentorInterest !== "yes") throw new ApiError(409, "El docente no está disponible para mentorías.", "mentor_unavailable");
  const assignment = await firstOrNull(
    pb,
    "team_mentorships",
    pb.filter("team = {:team}", { team: teamId }),
  );
  if (assignment && String(assignment.mentor) === mentorId) {
    return { id: assignment.id, team: teamId, mentor: mentorId, source: "admin" };
  }
  const id = assignment?.id ?? recordId();
  const batch = pb.createBatch();
  const after = { team: teamId, mentor: mentorId, source: "admin" };
  if (assignment) {
    batch.collection("team_mentorships").update(id, { mentor: mentorId, source: "admin" });
  } else {
    batch.collection("team_mentorships").create({ id, ...after });
  }
  addAudit(batch, {
    actorId: admin.id,
    action: assignment ? "team.mentorship.admin.replace" : "team.mentorship.admin.assign",
    entityType: "team_mentorships",
    entityId: id,
    before: assignment ? { team: assignment.team, mentor: assignment.mentor, source: assignment.source } : null,
    after,
    reason,
  });
  batch.collection("hackathon_settings").update(settings.id, { "dataVersion+": 1 });
  await send(batch);
  return { id, ...after };
}

export async function removeAdminMentorship(
  pb: PocketBase,
  admin: LomatonUser,
  mentorshipId: string,
  reason: string,
) {
  const settings = await requireReasonWhenClosed(pb, reason);
  const mentorship = await pb.collection("team_mentorships").getOne(mentorshipId);
  const batch = pb.createBatch();
  batch.collection("team_mentorships").delete(mentorship.id);
  addAudit(batch, { actorId: admin.id, action: "team.mentorship.admin.remove", entityType: "team_mentorships", entityId: mentorship.id, before: { team: mentorship.team, mentor: mentorship.mentor }, after: null, reason });
  batch.collection("hackathon_settings").update(settings.id, { "dataVersion+": 1 });
  await send(batch);
  return { id: mentorship.id, removed: true };
}
