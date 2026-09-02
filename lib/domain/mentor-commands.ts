import "server-only";

import { randomBytes } from "node:crypto";

import PocketBase, { ClientResponseError, type RecordModel } from "pocketbase";

import { addAudit, defaultSettings } from "@/lib/domain/admin-commands";
import { requireReasonWhenClosed } from "@/lib/domain/admin-commands";
import type { LomatonUser } from "@/lib/pocketbase/server";
import { ApiError } from "@/lib/server/api-error";

function recordId() {
  return randomBytes(12).toString("hex").slice(0, 15);
}

function now() {
  return new Date().toISOString();
}

async function assertFormationOpen(pb: PocketBase) {
  const settings = await defaultSettings(pb);
  if (!settings.formationOpen) throw new ApiError(409, "La formación de equipos está cerrada.", "formation_closed");
  if (settings.deadlineUtc && new Date(settings.deadlineUtc).getTime() <= Date.now()) {
    throw new ApiError(409, "Venció el plazo para formar equipos.", "deadline_passed");
  }
  return settings;
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

export async function listEligibleMentors(pb: PocketBase, user: LomatonUser, teamId: string) {
  await ownedTeam(pb, user, teamId);
  const mentors = await pb.collection("mentor_profiles").getFullList({
    filter: pb.filter("active = true && mentorInterest = {:interest}", { interest: "yes" }),
  });
  const assignments = await pb.collection("team_mentorships").getFullList();
  const assigned = new Set(assignments.map((item) => String(item.mentor)));
  const eligible = mentors.filter((mentor) => !assigned.has(mentor.id));
  const registrations = await registrationMap(pb, eligible);
  return eligible.map((mentor) => mentorDto(mentor, registrations.get(String(mentor.registration))));
}

export async function getTeamMentorState(pb: PocketBase, user: LomatonUser, teamId: string) {
  await ownedTeam(pb, user, teamId);
  const [assignment, invitations] = await Promise.all([
    firstOrNull(pb, "team_mentorships", pb.filter("team = {:team}", { team: teamId })),
    pb.collection("mentor_invitations").getFullList({ filter: pb.filter("team = {:team}", { team: teamId }), sort: "-created" }),
  ]);
  const mentorIds = [...new Set([assignment, ...invitations].filter(Boolean).map((item) => String(item?.mentor)))];
  const mentors = mentorIds.length ? await pb.collection("mentor_profiles").getFullList({ filter: mentorIds.map((id) => pb.filter("id = {:id}", { id })).join(" || ") }) : [];
  const byId = new Map(mentors.map((mentor) => [mentor.id, mentor]));
  const registrations = await registrationMap(pb, mentors);
  const dto = (mentorId: string) => {
    const mentor = byId.get(mentorId);
    return mentor ? mentorDto(mentor, registrations.get(String(mentor.registration))) : null;
  };
  return {
    assignment: assignment ? { id: assignment.id, mentor: dto(String(assignment.mentor)) } : null,
    invitations: invitations.map((invitation) => ({ id: invitation.id, status: invitation.status, resolvedAt: invitation.resolvedAt || "", mentor: dto(String(invitation.mentor)) })),
  };
}

export async function getOwnMentorDashboard(pb: PocketBase, user: LomatonUser) {
  const mentor = await mentorForUser(pb, user);
  const [invitations, assignment] = await Promise.all([
    pb.collection("mentor_invitations").getFullList({ filter: pb.filter("mentor = {:mentor}", { mentor: mentor.id }), sort: "-created" }),
    firstOrNull(pb, "team_mentorships", pb.filter("mentor = {:mentor}", { mentor: mentor.id })),
  ]);
  const teamIds = [...new Set([assignment, ...invitations].filter(Boolean).map((item) => String(item?.team)))];
  const teams = teamIds.length ? await pb.collection("teams").getFullList({ filter: teamIds.map((id) => pb.filter("id = {:id}", { id })).join(" || ") }) : [];
  const teamById = new Map(teams.map((team) => [team.id, team]));
  let accompaniedTeam = null;
  if (assignment) {
    const memberships = await pb.collection("team_memberships").getFullList({ filter: pb.filter("team = {:team}", { team: assignment.team }), expand: "candidate" });
    const team = teamById.get(String(assignment.team));
    accompaniedTeam = {
      id: String(assignment.team),
      name: String(team?.name || ""),
      members: memberships.map((membership) => ({ id: String(membership.candidate), fullName: String(membership.expand?.candidate?.fullName || "") })),
    };
  }
  return {
    mentor: { id: mentor.id, mentorInterest: mentor.mentorInterest },
    assignment: accompaniedTeam,
    invitations: invitations.map((invitation) => ({ id: invitation.id, status: invitation.status, resolvedAt: invitation.resolvedAt || "", team: { id: String(invitation.team), name: String(teamById.get(String(invitation.team))?.name || "") } })),
  };
}

export async function inviteMentor(pb: PocketBase, user: LomatonUser, teamId: string, mentorId: string) {
  const settings = await assertFormationOpen(pb);
  await ownedTeam(pb, user, teamId);
  const mentor = await pb.collection("mentor_profiles").getOne(mentorId);
  if (!mentor.active || mentor.mentorInterest !== "yes") throw new ApiError(409, "El docente no está disponible para mentorías.", "mentor_unavailable");
  const [teamAssignment, mentorAssignment, pending] = await Promise.all([
    firstOrNull(pb, "team_mentorships", pb.filter("team = {:team}", { team: teamId })),
    firstOrNull(pb, "team_mentorships", pb.filter("mentor = {:mentor}", { mentor: mentorId })),
    firstOrNull(pb, "mentor_invitations", pb.filter("team = {:team} && mentor = {:mentor} && status = {:status}", { team: teamId, mentor: mentorId, status: "pending" })),
  ]);
  if (teamAssignment) throw new ApiError(409, "El equipo ya tiene mentor.", "team_has_mentor");
  if (mentorAssignment) throw new ApiError(409, "El docente ya acompaña a otro equipo.", "mentor_has_team");
  if (pending) throw new ApiError(409, "La invitación ya está pendiente.", "mentor_invitation_pending");
  const id = recordId();
  const batch = pb.createBatch();
  batch.collection("mentor_invitations").create({ id, team: teamId, mentor: mentorId, invitedBy: user.id, status: "pending" });
  addAudit(batch, { actorId: user.id, action: "mentor.invitation.create", entityType: "mentor_invitations", entityId: id, after: { team: teamId, mentor: mentorId } });
  batch.collection("hackathon_settings").update(settings.id, { "dataVersion+": 1 });
  await send(batch);
  return pb.collection("mentor_invitations").getOne(id);
}

export async function withdrawMentorInvitation(pb: PocketBase, user: LomatonUser, invitationId: string) {
  const settings = await assertFormationOpen(pb);
  const invitation = await pb.collection("mentor_invitations").getOne(invitationId);
  await ownedTeam(pb, user, String(invitation.team));
  if (invitation.status !== "pending") throw new ApiError(409, "La invitación ya fue resuelta.", "invitation_resolved");
  const batch = pb.createBatch();
  batch.collection("mentor_invitations").update(invitation.id, { status: "withdrawn", resolvedAt: now() });
  addAudit(batch, { actorId: user.id, action: "mentor.invitation.withdraw", entityType: "mentor_invitations", entityId: invitation.id, before: { status: "pending" }, after: { status: "withdrawn" } });
  batch.collection("hackathon_settings").update(settings.id, { "dataVersion+": 1 });
  await send(batch);
  return { id: invitation.id, status: "withdrawn" };
}

export async function resolveMentorInvitation(pb: PocketBase, user: LomatonUser, invitationId: string, resolution: "accepted" | "rejected") {
  const settings = await assertFormationOpen(pb);
  const mentor = await mentorForUser(pb, user);
  const invitation = await pb.collection("mentor_invitations").getOne(invitationId);
  if (invitation.mentor !== mentor.id) throw new ApiError(403, "La invitación pertenece a otro docente.", "invitation_owner_mismatch");
  if (invitation.status !== "pending") throw new ApiError(409, "La invitación ya fue resuelta.", "invitation_resolved");
  const batch = pb.createBatch();
  if (resolution === "accepted") {
    if (!mentor.active || mentor.mentorInterest !== "yes") throw new ApiError(409, "El perfil docente no está disponible.", "mentor_unavailable");
    const pending = await pb.collection("mentor_invitations").getFullList({
      filter: pb.filter("status = {:status} && (mentor = {:mentor} || team = {:team})", { status: "pending", mentor: mentor.id, team: invitation.team }),
    });
    batch.collection("team_mentorships").create({ id: recordId(), team: invitation.team, mentor: mentor.id, source: "invitation" });
    for (const item of pending) batch.collection("mentor_invitations").update(item.id, { status: item.id === invitation.id ? "accepted" : "cancelled", resolvedAt: now() });
  } else {
    batch.collection("mentor_invitations").update(invitation.id, { status: "rejected", resolvedAt: now() });
  }
  addAudit(batch, { actorId: user.id, action: `mentor.invitation.${resolution}`, entityType: "mentor_invitations", entityId: invitation.id, before: { status: "pending" }, after: { status: resolution } });
  batch.collection("hackathon_settings").update(settings.id, { "dataVersion+": 1 });
  await send(batch);
  return getOwnMentorDashboard(pb, user);
}

export async function resolveAdminMentorInvitation(
  pb: PocketBase,
  admin: LomatonUser,
  invitationId: string,
  reason: string,
) {
  const settings = await requireReasonWhenClosed(pb, reason);
  const invitation = await pb.collection("mentor_invitations").getOne(invitationId);
  if (invitation.status !== "pending") throw new ApiError(409, "La invitación ya fue resuelta.", "invitation_resolved");
  const batch = pb.createBatch();
  batch.collection("mentor_invitations").update(invitation.id, { status: "cancelled", resolvedAt: now() });
  addAudit(batch, { actorId: admin.id, action: "mentor.invitation.admin.cancel", entityType: "mentor_invitations", entityId: invitation.id, before: { status: "pending" }, after: { status: "cancelled" }, reason });
  batch.collection("hackathon_settings").update(settings.id, { "dataVersion+": 1 });
  await send(batch);
  return { id: invitation.id, status: "cancelled" };
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
