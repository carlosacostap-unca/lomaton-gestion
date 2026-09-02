import "server-only";

import { randomBytes } from "node:crypto";

import PocketBase, { ClientResponseError, type RecordModel } from "pocketbase";

import { normalizeTeamName, projectTeam } from "@/lib/domain/team-rules";
import { addAudit } from "@/lib/domain/admin-commands";
import type { LomatonUser } from "@/lib/pocketbase/server";
import { ApiError } from "@/lib/server/api-error";

function recordId() {
  return randomBytes(12).toString("hex").slice(0, 15);
}

function now() {
  return new Date().toISOString();
}

async function settings(pb: PocketBase) {
  try {
    return await pb
      .collection("hackathon_settings")
      .getFirstListItem(pb.filter("key = {:key}", { key: "default" }));
  } catch (error) {
    throw mapPocketBaseError(error, "No se encontró la configuración del hackatón.");
  }
}

async function assertFormationOpen(pb: PocketBase) {
  const current = await settings(pb);
  if (!current.formationOpen) {
    throw new ApiError(409, "La formación de equipos está cerrada.", "formation_closed");
  }
  if (current.deadlineUtc && new Date(current.deadlineUtc).getTime() <= Date.now()) {
    throw new ApiError(409, "Venció el plazo para formar equipos.", "deadline_passed");
  }
  return current;
}

function requireCandidateId(user: LomatonUser) {
  if (!user.candidate) {
    throw new ApiError(
      403,
      "La cuenta no está vinculada a un candidato.",
      "candidate_required",
    );
  }
  return user.candidate;
}

async function membershipByCandidate(pb: PocketBase, candidateId: string) {
  try {
    return await pb
      .collection("team_memberships")
      .getFirstListItem(pb.filter("candidate = {:candidate}", { candidate: candidateId }));
  } catch (error) {
    if (error instanceof ClientResponseError && error.status === 404) return null;
    throw error;
  }
}

async function pendingInvitation(
  pb: PocketBase,
  teamId: string,
  candidateId: string,
) {
  try {
    return await pb.collection("team_invitations").getFirstListItem(
      pb.filter(
        "team = {:team} && candidate = {:candidate} && status = 'pending'",
        { team: teamId, candidate: candidateId },
      ),
    );
  } catch (error) {
    if (error instanceof ClientResponseError && error.status === 404) return null;
    throw error;
  }
}

async function teamMemberships(pb: PocketBase, teamId: string) {
  return pb.collection("team_memberships").getFullList({
    filter: pb.filter("team = {:team}", { team: teamId }),
    sort: "created",
  });
}

async function projectionFor(
  pb: PocketBase,
  memberships: RecordModel[],
  addedCandidateId?: string,
) {
  const candidateIds = memberships.map((membership) => String(membership.candidate));
  if (addedCandidateId) candidateIds.push(addedCandidateId);
  if (!candidateIds.length) return projectTeam([]);
  const candidates = await pb.collection("candidates").getFullList({
    filter: candidateIds.map((id) => pb.filter("id = {:id}", { id })).join(" || "),
  });
  const statusById = new Map(candidates.map((candidate) => [candidate.id, String(candidate.ftcaStatus)]));
  return projectTeam(candidateIds.map((id) => statusById.get(id) ?? "pending"));
}

function updateVersion(batch: ReturnType<PocketBase["createBatch"]>, settingsId: string) {
  batch.collection("hackathon_settings").update(settingsId, { "dataVersion+": 1 });
}

async function sendBatch(batch: ReturnType<PocketBase["createBatch"]>) {
  try {
    return await batch.send();
  } catch (error) {
    throw mapPocketBaseError(
      error,
      "La operación entró en conflicto con otro cambio. Actualizá la pantalla e intentá nuevamente.",
    );
  }
}

function mapPocketBaseError(error: unknown, fallback: string): Error {
  if (error instanceof ApiError) return error;
  if (error instanceof ClientResponseError) {
    if (error.status === 404) return new ApiError(404, fallback, "not_found");
    if (error.status === 400 || error.status === 409) {
      return new ApiError(409, fallback, "concurrent_conflict", error.response?.data);
    }
  }
  return error instanceof Error ? error : new Error(fallback);
}

export async function createTeam(pb: PocketBase, user: LomatonUser, name: string) {
  const candidateId = requireCandidateId(user);
  const currentSettings = await assertFormationOpen(pb);
  const teamName = normalizeTeamName(name);
  if (teamName.display.length < 2 || teamName.display.length > 120) {
    throw new ApiError(400, "El nombre del equipo debe tener entre 2 y 120 caracteres.", "invalid_team_name");
  }
  if (await membershipByCandidate(pb, candidateId)) {
    throw new ApiError(409, "El candidato ya pertenece a un equipo.", "candidate_already_member");
  }
  const candidate = await pb.collection("candidates").getOne(candidateId);
  if (!candidate.active) throw new ApiError(409, "El candidato no está activo.", "candidate_inactive");

  const teamId = recordId();
  const projection = projectTeam([String(candidate.ftcaStatus)]);
  const batch = pb.createBatch();
  batch.collection("teams").create({
    id: teamId,
    name: teamName.display,
    nameNormalized: teamName.normalized,
    owner: candidateId,
    ...projection,
  });
  batch.collection("team_memberships").create({
    id: recordId(),
    team: teamId,
    candidate: candidateId,
    source: "owner",
  });
  updateVersion(batch, currentSettings.id);
  await sendBatch(batch);
  return pb.collection("teams").getOne(teamId);
}

export async function disbandOwnTeam(pb: PocketBase, user: LomatonUser, teamId: string) {
  const candidateId = requireCandidateId(user);
  const currentSettings = await assertFormationOpen(pb);
  const team = await pb.collection("teams").getOne(teamId).catch((error) => {
    throw mapPocketBaseError(error, "El equipo no existe.");
  });
  if (team.owner !== candidateId) {
    throw new ApiError(403, "Solamente el responsable puede disolver el equipo.", "owner_required");
  }
  const [mentorInvitations, mentorships] = await Promise.all([
    pb.collection("mentor_invitations").getFullList({ filter: pb.filter("team = {:team}", { team: team.id }) }),
    pb.collection("team_mentorships").getFullList({ filter: pb.filter("team = {:team}", { team: team.id }) }),
  ]);
  const batch = pb.createBatch();
  addAudit(batch, {
    actorId: user.id,
    action: "team.disband",
    entityType: "teams",
    entityId: team.id,
    before: { team, mentorInvitationIds: mentorInvitations.map((item) => item.id), mentorshipIds: mentorships.map((item) => item.id) },
    after: null,
  });
  batch.collection("teams").delete(team.id);
  updateVersion(batch, currentSettings.id);
  await sendBatch(batch);
}

export async function inviteCandidate(
  pb: PocketBase,
  user: LomatonUser,
  teamId: string,
  candidateId: string,
) {
  const ownerId = requireCandidateId(user);
  const currentSettings = await assertFormationOpen(pb);
  const [team, candidate] = await Promise.all([
    pb.collection("teams").getOne(teamId),
    pb.collection("candidates").getOne(candidateId),
  ]);
  if (team.owner !== ownerId) {
    throw new ApiError(403, "Solamente el responsable puede invitar candidatos.", "owner_required");
  }
  if (!candidate.active) throw new ApiError(409, "El candidato no está activo.", "candidate_inactive");
  if (await membershipByCandidate(pb, candidateId)) {
    throw new ApiError(409, "El candidato ya pertenece a un equipo.", "candidate_already_member");
  }
  if (await pendingInvitation(pb, teamId, candidateId)) {
    throw new ApiError(
      409,
      "El candidato ya tiene una invitación pendiente para este equipo.",
      "invitation_already_pending",
    );
  }
  if (Number(team.memberCount) >= 4) {
    throw new ApiError(409, "El equipo ya alcanzó cuatro integrantes.", "team_full");
  }

  const invitationId = recordId();
  const batch = pb.createBatch();
  batch.collection("team_invitations").create({
    id: invitationId,
    team: teamId,
    candidate: candidateId,
    invitedBy: user.id,
    status: "pending",
  });
  updateVersion(batch, currentSettings.id);
  await sendBatch(batch);
  return pb.collection("team_invitations").getOne(invitationId);
}

export async function withdrawInvitation(pb: PocketBase, user: LomatonUser, invitationId: string) {
  const ownerId = requireCandidateId(user);
  const currentSettings = await assertFormationOpen(pb);
  const invitation = await pb.collection("team_invitations").getOne(invitationId);
  const team = await pb.collection("teams").getOne(String(invitation.team));
  if (team.owner !== ownerId) {
    throw new ApiError(403, "Solamente el responsable puede retirar la invitación.", "owner_required");
  }
  if (invitation.status !== "pending") {
    throw new ApiError(409, "La invitación ya fue resuelta.", "invitation_resolved");
  }
  const batch = pb.createBatch();
  batch.collection("team_invitations").update(invitation.id, {
    status: "withdrawn",
    resolvedAt: now(),
  });
  updateVersion(batch, currentSettings.id);
  await sendBatch(batch);
  return pb.collection("team_invitations").getOne(invitation.id);
}

export async function resolveOwnInvitation(
  pb: PocketBase,
  user: LomatonUser,
  invitationId: string,
  resolution: "accepted" | "rejected",
) {
  const candidateId = requireCandidateId(user);
  const currentSettings = await assertFormationOpen(pb);
  const invitation = await pb.collection("team_invitations").getOne(invitationId);
  if (invitation.candidate !== candidateId) {
    throw new ApiError(403, "La invitación pertenece a otro candidato.", "invitation_owner_mismatch");
  }
  if (invitation.status !== "pending") {
    throw new ApiError(409, "La invitación ya fue resuelta.", "invitation_resolved");
  }

  const batch = pb.createBatch();
  if (resolution === "rejected") {
    batch.collection("team_invitations").update(invitation.id, {
      status: "rejected",
      resolvedAt: now(),
    });
    updateVersion(batch, currentSettings.id);
    await sendBatch(batch);
    return pb.collection("team_invitations").getOne(invitation.id);
  }

  if (await membershipByCandidate(pb, candidateId)) {
    throw new ApiError(409, "Ya pertenece a otro equipo.", "candidate_already_member");
  }
  const teamId = String(invitation.team);
  const [team, memberships, pendingInvitations] = await Promise.all([
    pb.collection("teams").getOne(teamId),
    teamMemberships(pb, teamId),
    pb.collection("team_invitations").getFullList({
      filter: pb.filter("candidate = {:candidate} && status = 'pending'", { candidate: candidateId }),
    }),
  ]);
  const expectedMemberCount = Number(team.memberCount);
  if (expectedMemberCount >= 4) {
    batch.collection("team_invitations").update(invitation.id, {
      status: "cancelled",
      resolvedAt: now(),
    });
    updateVersion(batch, currentSettings.id);
    await sendBatch(batch);
    throw new ApiError(409, "El equipo alcanzó cuatro integrantes.", "team_full");
  }
  const projection = await projectionFor(pb, memberships, candidateId);

  batch.collection("teams").update(team.id, projection, {
    query: { expected_member_count: expectedMemberCount },
  });
  batch.collection("team_memberships").create({
    id: recordId(),
    team: team.id,
    candidate: candidateId,
    source: "invitation",
  });
  for (const pending of pendingInvitations) {
    batch.collection("team_invitations").update(pending.id, {
      status: pending.id === invitation.id ? "accepted" : "cancelled",
      resolvedAt: now(),
    });
  }
  updateVersion(batch, currentSettings.id);
  await sendBatch(batch);
  return pb.collection("teams").getOne(team.id);
}
