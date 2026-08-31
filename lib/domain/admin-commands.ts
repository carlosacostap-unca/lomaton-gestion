import "server-only";

import { randomBytes } from "node:crypto";

import PocketBase, { ClientResponseError, type RecordModel } from "pocketbase";

import { normalizeTeamName, projectTeam } from "@/lib/domain/team-rules";
import type { LomatonUser } from "@/lib/pocketbase/server";
import { ApiError } from "@/lib/server/api-error";

function recordId() {
  return randomBytes(12).toString("hex").slice(0, 15);
}

async function sendAdminBatch(batch: ReturnType<PocketBase["createBatch"]>) {
  try {
    await batch.send();
  } catch (error) {
    if (error instanceof ClientResponseError && [400, 409].includes(error.status)) {
      throw new ApiError(
        409,
        "La operación entró en conflicto con otro cambio. Actualizá la pantalla e intentá nuevamente.",
        "concurrent_conflict",
        error.response?.data,
      );
    }
    throw error;
  }
}

async function membershipByCandidate(pb: PocketBase, candidateId: string) {
  try {
    return await pb.collection("team_memberships").getFirstListItem(
      pb.filter("candidate = {:candidate}", { candidate: candidateId }),
    );
  } catch (error) {
    if (error instanceof ClientResponseError && error.status === 404) return null;
    throw error;
  }
}

async function teamMemberships(pb: PocketBase, teamId: string) {
  return pb.collection("team_memberships").getFullList({
    filter: pb.filter("team = {:team}", { team: teamId }),
    expand: "candidate",
    sort: "created",
  });
}

function membershipProjection(
  memberships: RecordModel[],
  options: { addStatus?: string; removeCandidateId?: string; statusOverride?: Map<string, string> } = {},
) {
  const statuses = memberships
    .filter((membership) => membership.candidate !== options.removeCandidateId)
    .map((membership) =>
      options.statusOverride?.get(String(membership.candidate)) ??
      String(membership.expand?.candidate?.ftcaStatus ?? "pending"),
    );
  if (options.addStatus) statuses.push(options.addStatus);
  return projectTeam(statuses);
}

function teamUpdateWithGuard(
  batch: ReturnType<PocketBase["createBatch"]>,
  team: RecordModel,
  data: Record<string, unknown>,
) {
  batch.collection("teams").update(team.id, data, {
    query: { expected_member_count: Number(team.memberCount) },
  });
}

function addVersion(batch: ReturnType<PocketBase["createBatch"]>, settingsId: string) {
  batch.collection("hackathon_settings").update(settingsId, { "dataVersion+": 1 });
}

export async function defaultSettings(pb: PocketBase) {
  return pb
    .collection("hackathon_settings")
    .getFirstListItem(pb.filter("key = {:key}", { key: "default" }));
}

export async function requireReasonWhenClosed(pb: PocketBase, reason: string) {
  const current = await defaultSettings(pb);
  const closed =
    !current.formationOpen ||
    (current.deadlineUtc && new Date(current.deadlineUtc).getTime() <= Date.now());
  if (closed && !reason.trim()) {
    throw new ApiError(
      400,
      "Se requiere un motivo para intervenir después del cierre.",
      "reason_required",
    );
  }
  return current;
}

export function addAudit(
  batch: ReturnType<PocketBase["createBatch"]>,
  input: {
    actorId: string;
    action: string;
    entityType: string;
    entityId?: string;
    before?: unknown;
    after?: unknown;
    reason?: string;
    metadata?: unknown;
  },
) {
  batch.collection("audit_logs").create({
    id: recordId(),
    actor: input.actorId,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId ?? "",
    before: input.before ?? null,
    after: input.after ?? null,
    reason: input.reason?.trim() ?? "",
    metadata: input.metadata ?? null,
  });
}

export async function updateHackathonSettings(
  pb: PocketBase,
  admin: LomatonUser,
  input: { deadlineUtc: string; formationOpen: boolean; reason: string },
) {
  const current = await defaultSettings(pb);
  let deadlineUtc = "";
  if (input.deadlineUtc) {
    const parsed = new Date(input.deadlineUtc);
    if (Number.isNaN(parsed.getTime())) {
      throw new ApiError(400, "El plazo UTC no es válido.", "invalid_deadline");
    }
    deadlineUtc = parsed.toISOString();
  }
  const after = {
    id: current.id,
    key: "default",
    deadlineUtc,
    timezone: "America/Argentina/Buenos_Aires",
    formationOpen: input.formationOpen,
  };
  const batch = pb.createBatch();
  batch.collection("hackathon_settings").update(current.id, {
    ...after,
    "dataVersion+": 1,
  });
  addAudit(batch, {
    actorId: admin.id,
    action: "hackathon.settings.update",
    entityType: "hackathon_settings",
    entityId: current.id,
    before: current,
    after,
    reason: input.reason,
  });
  await batch.send();
  return pb.collection("hackathon_settings").getOne(current.id);
}

export async function createAdminTeam(
  pb: PocketBase,
  admin: LomatonUser,
  input: { name: string; ownerCandidateId: string; reason: string },
) {
  const currentSettings = await requireReasonWhenClosed(pb, input.reason);
  const name = normalizeTeamName(input.name);
  if (name.display.length < 2 || name.display.length > 120) {
    throw new ApiError(400, "El nombre del equipo debe tener entre 2 y 120 caracteres.", "invalid_team_name");
  }
  const owner = await pb.collection("candidates").getOne(input.ownerCandidateId);
  if (!owner.active) throw new ApiError(409, "El candidato no está activo.", "candidate_inactive");
  if (await membershipByCandidate(pb, owner.id)) {
    throw new ApiError(409, "El candidato ya pertenece a un equipo.", "candidate_already_member");
  }
  const teamId = recordId();
  const after = {
    id: teamId,
    name: name.display,
    nameNormalized: name.normalized,
    owner: owner.id,
    ...projectTeam([String(owner.ftcaStatus)]),
  };
  const batch = pb.createBatch();
  batch.collection("teams").create(after);
  batch.collection("team_memberships").create({
    id: recordId(), team: teamId, candidate: owner.id, source: "admin",
  });
  addAudit(batch, {
    actorId: admin.id, action: "team.admin.create", entityType: "teams",
    entityId: teamId, after, reason: input.reason,
  });
  addVersion(batch, currentSettings.id);
  await sendAdminBatch(batch);
  return pb.collection("teams").getOne(teamId);
}

export async function updateAdminTeam(
  pb: PocketBase,
  admin: LomatonUser,
  teamId: string,
  input: { name?: string; ownerCandidateId?: string; reason: string },
) {
  const currentSettings = await requireReasonWhenClosed(pb, input.reason);
  const team = await pb.collection("teams").getOne(teamId);
  const patch: Record<string, unknown> = {};
  if (input.name) {
    const name = normalizeTeamName(input.name);
    if (name.display.length < 2 || name.display.length > 120) {
      throw new ApiError(400, "El nombre del equipo debe tener entre 2 y 120 caracteres.", "invalid_team_name");
    }
    patch.name = name.display;
    patch.nameNormalized = name.normalized;
  }
  if (input.ownerCandidateId) {
    const membership = await membershipByCandidate(pb, input.ownerCandidateId);
    if (!membership || membership.team !== team.id) {
      throw new ApiError(400, "El nuevo responsable debe ser miembro del equipo.", "owner_not_member");
    }
    patch.owner = input.ownerCandidateId;
  }
  const batch = pb.createBatch();
  teamUpdateWithGuard(batch, team, patch);
  addAudit(batch, {
    actorId: admin.id, action: "team.admin.update", entityType: "teams",
    entityId: team.id, before: team, after: { ...team, ...patch }, reason: input.reason,
  });
  addVersion(batch, currentSettings.id);
  await sendAdminBatch(batch);
  return pb.collection("teams").getOne(team.id);
}

export async function addAdminTeamMember(
  pb: PocketBase,
  admin: LomatonUser,
  teamId: string,
  candidateId: string,
  reason: string,
) {
  const currentSettings = await requireReasonWhenClosed(pb, reason);
  const [team, candidate, memberships] = await Promise.all([
    pb.collection("teams").getOne(teamId),
    pb.collection("candidates").getOne(candidateId),
    teamMemberships(pb, teamId),
  ]);
  if (!candidate.active) throw new ApiError(409, "El candidato no está activo.", "candidate_inactive");
  if (await membershipByCandidate(pb, candidate.id)) {
    throw new ApiError(409, "El candidato ya pertenece a un equipo.", "candidate_already_member");
  }
  if (Number(team.memberCount) >= 4) {
    throw new ApiError(409, "El equipo ya alcanzó cuatro integrantes.", "team_full");
  }
  const invitations = await pb.collection("team_invitations").getFullList({
    filter: pb.filter("candidate = {:candidate} && status = 'pending'", { candidate: candidate.id }),
  });
  const projection = membershipProjection(memberships, { addStatus: String(candidate.ftcaStatus) });
  const batch = pb.createBatch();
  teamUpdateWithGuard(batch, team, projection);
  batch.collection("team_memberships").create({
    id: recordId(), team: team.id, candidate: candidate.id, source: "admin",
  });
  for (const invitation of invitations) {
    batch.collection("team_invitations").update(invitation.id, {
      status: "cancelled", resolvedAt: new Date().toISOString(),
    });
  }
  addAudit(batch, {
    actorId: admin.id, action: "team.member.admin.add", entityType: "teams",
    entityId: team.id, before: team, after: { ...team, ...projection }, reason,
    metadata: { candidateId: candidate.id },
  });
  addVersion(batch, currentSettings.id);
  await sendAdminBatch(batch);
  return pb.collection("teams").getOne(team.id);
}

export async function removeAdminTeamMember(
  pb: PocketBase,
  admin: LomatonUser,
  teamId: string,
  candidateId: string,
  reason: string,
) {
  const currentSettings = await requireReasonWhenClosed(pb, reason);
  const [team, membership, memberships] = await Promise.all([
    pb.collection("teams").getOne(teamId),
    membershipByCandidate(pb, candidateId),
    teamMemberships(pb, teamId),
  ]);
  if (team.owner === candidateId) {
    throw new ApiError(400, "Cambie el responsable antes de retirar a ese miembro.", "owner_cannot_leave");
  }
  if (!membership || membership.team !== team.id) {
    throw new ApiError(404, "La membresía no existe.", "membership_not_found");
  }
  const projection = membershipProjection(memberships, { removeCandidateId: candidateId });
  const batch = pb.createBatch();
  teamUpdateWithGuard(batch, team, projection);
  batch.collection("team_memberships").delete(membership.id);
  addAudit(batch, {
    actorId: admin.id, action: "team.member.admin.remove", entityType: "teams",
    entityId: team.id, before: team, after: { ...team, ...projection }, reason,
    metadata: { candidateId },
  });
  addVersion(batch, currentSettings.id);
  await sendAdminBatch(batch);
  return pb.collection("teams").getOne(team.id);
}

export async function disbandAdminTeam(
  pb: PocketBase,
  admin: LomatonUser,
  teamId: string,
  reason: string,
) {
  const currentSettings = await requireReasonWhenClosed(pb, reason);
  const team = await pb.collection("teams").getOne(teamId);
  const batch = pb.createBatch();
  addAudit(batch, {
    actorId: admin.id, action: "team.admin.disband", entityType: "teams",
    entityId: team.id, before: team, reason,
  });
  batch.collection("teams").delete(team.id);
  addVersion(batch, currentSettings.id);
  await sendAdminBatch(batch);
}

export async function resolveAdminInvitation(
  pb: PocketBase,
  admin: LomatonUser,
  invitationId: string,
  resolution: "accepted" | "rejected" | "cancelled",
  reason: string,
) {
  const currentSettings = await requireReasonWhenClosed(pb, reason);
  const invitation = await pb.collection("team_invitations").getOne(invitationId);
  if (invitation.status !== "pending") {
    throw new ApiError(409, "La invitación ya fue resuelta.", "invitation_resolved");
  }
  const team = await pb.collection("teams").getOne(String(invitation.team));
  const batch = pb.createBatch();
  let projection = {
    memberCount: Number(team.memberCount),
    ftcaConfirmedCount: Number(team.ftcaConfirmedCount),
    status: team.status,
  };
  if (resolution === "accepted") {
    const [candidate, memberships, existing] = await Promise.all([
      pb.collection("candidates").getOne(String(invitation.candidate)),
      teamMemberships(pb, team.id),
      membershipByCandidate(pb, String(invitation.candidate)),
    ]);
    if (existing) throw new ApiError(409, "El candidato ya pertenece a un equipo.", "candidate_already_member");
    if (Number(team.memberCount) >= 4) throw new ApiError(409, "El equipo ya alcanzó cuatro integrantes.", "team_full");
    projection = membershipProjection(memberships, { addStatus: String(candidate.ftcaStatus) });
    teamUpdateWithGuard(batch, team, projection);
    batch.collection("team_memberships").create({
      id: recordId(), team: team.id, candidate: candidate.id, source: "admin",
    });
    const pending = await pb.collection("team_invitations").getFullList({
      filter: pb.filter("candidate = {:candidate} && status = 'pending'", { candidate: candidate.id }),
    });
    for (const item of pending) {
      batch.collection("team_invitations").update(item.id, {
        status: item.id === invitation.id ? "accepted" : "cancelled",
        resolvedAt: new Date().toISOString(),
      });
    }
  } else {
    batch.collection("team_invitations").update(invitation.id, {
      status: resolution, resolvedAt: new Date().toISOString(),
    });
  }
  addAudit(batch, {
    actorId: admin.id, action: `invitation.admin.${resolution}`,
    entityType: "team_invitations", entityId: invitation.id, before: invitation,
    after: { ...invitation, status: resolution }, reason,
    metadata: { teamId: team.id, teamStatus: projection.status },
  });
  addVersion(batch, currentSettings.id);
  await sendAdminBatch(batch);
  return pb.collection("team_invitations").getOne(invitation.id);
}

export async function updateAdminCandidate(
  pb: PocketBase,
  admin: LomatonUser,
  candidateId: string,
  input: {
    firstName: string; lastName: string; email: string;
    ftcaStatus: "confirmed" | "not_ftca" | "pending"; active: boolean; reason: string;
  },
) {
  const currentSettings = await requireReasonWhenClosed(pb, input.reason);
  const candidate = await pb.collection("candidates").getOne(candidateId);
  const email = input.email.trim();
  const emailNormalized = email.toLowerCase();
  const next = {
    firstName: input.firstName.trim(), lastName: input.lastName.trim(),
    email, emailNormalized, ftcaStatus: input.ftcaStatus, active: input.active,
  };
  const [users, membership] = await Promise.all([
    pb.collection("users").getFullList({
      filter: pb.filter("candidate = {:candidate}", { candidate: candidate.id }),
    }),
    membershipByCandidate(pb, candidate.id),
  ]);
  const batch = pb.createBatch();
  batch.collection("candidates").update(candidate.id, next);
  const emailChanged = String(candidate.emailNormalized) !== emailNormalized;
  for (const user of users) {
    batch.collection("users").update(user.id, {
      candidate: emailChanged ? "" : candidate.id,
      enabled: input.active && !emailChanged,
      displayName: `${next.firstName} ${next.lastName}`.trim(),
    });
  }
  let affectedTeamId = "";
  if (membership) {
    affectedTeamId = String(membership.team);
    const [team, memberships] = await Promise.all([
      pb.collection("teams").getOne(affectedTeamId),
      teamMemberships(pb, affectedTeamId),
    ]);
    const projection = membershipProjection(memberships, {
      statusOverride: new Map([[candidate.id, input.ftcaStatus]]),
    });
    teamUpdateWithGuard(batch, team, projection);
  }
  addAudit(batch, {
    actorId: admin.id, action: "candidate.admin.update", entityType: "candidates",
    entityId: candidate.id, before: candidate, after: { id: candidate.id, ...next },
    reason: input.reason, metadata: { affectedTeamId },
  });
  addVersion(batch, currentSettings.id);
  await sendAdminBatch(batch);
  return {
    candidate: await pb.collection("candidates").getOne(candidate.id),
    affectedTeamId,
    warning: affectedTeamId ? "Se recalculó el estado del equipo asociado." : "",
  };
}

export async function reconcileTeams(
  pb: PocketBase,
  admin: LomatonUser,
  reason: string,
) {
  const currentSettings = await requireReasonWhenClosed(pb, reason);
  const [teams, memberships] = await Promise.all([
    pb.collection("teams").getFullList({ sort: "name" }),
    pb.collection("team_memberships").getFullList({ expand: "candidate", sort: "created" }),
  ]);
  const batch = pb.createBatch();
  let corrected = 0;
  for (const team of teams) {
    const projection = membershipProjection(
      memberships.filter((membership) => membership.team === team.id),
    );
    if (
      projection.status === team.status &&
      projection.memberCount === Number(team.memberCount) &&
      projection.ftcaConfirmedCount === Number(team.ftcaConfirmedCount)
    ) continue;
    corrected += 1;
    teamUpdateWithGuard(batch, team, projection);
    addAudit(batch, {
      actorId: admin.id,
      action: "team.reconcile",
      entityType: "teams",
      entityId: team.id,
      before: team,
      after: { ...team, ...projection },
      reason,
    });
  }
  if (corrected > 0) {
    addVersion(batch, currentSettings.id);
    await sendAdminBatch(batch);
  }
  return { checked: teams.length, corrected };
}
