function normalizeTeamName(value) {
  const display = String(value || "").trim().replace(/\s+/g, " ")
  return { display, normalized: display.toLowerCase() }
}

const teamChallengeIds = [
  "problematicas-imagenes",
  "transito-planta",
  "sistemas-medicion",
  "consumo-materiales",
  "edificios-sustentables",
]

function isTeamChallengeId(value) {
  return teamChallengeIds.includes(String(value || ""))
}

function requireUser(auth) {
  if (!auth || auth.collection().name !== "users" || !auth.getBool("enabled")) {
    throw new UnauthorizedError("Se requiere una sesión habilitada.")
  }
  return auth
}

function requireCandidate(auth) {
  const user = requireUser(auth)
  const candidateId = user.getString("candidate")
  if (!candidateId) {
    throw new ForbiddenError("La cuenta no está vinculada a un candidato.")
  }
  return candidateId
}

function requireAdmin(auth) {
  const user = requireUser(auth)
  if (!user.getBool("isAdmin")) {
    throw new ForbiddenError("Se requieren permisos de administrador.")
  }
  return user
}

function assertFormationOpen(app) {
  const settings = app.findFirstRecordByData("hackathon_settings", "key", "default")
  if (!settings.getBool("formationOpen")) {
    throw new ApiError(409, "La formación de equipos está cerrada.", {
      code: "formation_closed",
    })
  }

  const deadline = settings.getDateTime("deadlineUtc")
  if (!deadline.isZero() && deadline.unix() <= Math.floor(Date.now() / 1000)) {
    throw new ApiError(409, "Venció el plazo para formar equipos.", {
      code: "deadline_passed",
    })
  }
  return settings
}

function findMembershipByCandidate(app, candidateId) {
  try {
    return app.findFirstRecordByFilter(
      "team_memberships",
      "candidate = {:candidate}",
      { candidate: candidateId },
    )
  } catch {
    return null
  }
}

function getTeamMemberships(app, teamId) {
  return app.findRecordsByFilter(
    "team_memberships",
    "team = {:team}",
    "created",
    10,
    0,
    { team: teamId },
  )
}

function recalculateTeam(app, teamId) {
  const team = app.findRecordById("teams", teamId)
  const memberships = getTeamMemberships(app, teamId)
  let ftcaConfirmedCount = 0

  for (const membership of memberships) {
    const candidate = app.findRecordById(
      "candidates",
      membership.getString("candidate"),
    )
    if (candidate.getString("ftcaStatus") === "confirmed") {
      ftcaConfirmedCount += 1
    }
  }

  const memberCount = memberships.length
  let status = "draft"
  if (memberCount > 4) {
    status = "invalid"
  } else if (memberCount >= 3 && ftcaConfirmedCount === 0) {
    status = "missing_ftca"
  } else if (memberCount >= 3) {
    status = "complete"
  }

  team.set("memberCount", memberCount)
  team.set("ftcaConfirmedCount", ftcaConfirmedCount)
  team.set("status", status)
  app.save(team)
  return team
}

function cancelPendingInvitationsForCandidate(app, candidateId, exceptInvitationId) {
  const invitations = app.findRecordsByFilter(
    "team_invitations",
    "candidate = {:candidate} && status = 'pending'",
    "created",
    100,
    0,
    { candidate: candidateId },
  )
  const resolvedAt = new DateTime()

  for (const invitation of invitations) {
    if (invitation.id === exceptInvitationId) continue
    invitation.set("status", "cancelled")
    invitation.set("resolvedAt", resolvedAt)
    app.save(invitation)
  }
}

function snapshot(record) {
  if (!record) return null
  const name = record.collection().name
  const fieldsByCollection = {
    candidates: ["firstName", "lastName", "email", "emailNormalized", "ftcaStatus", "active"],
    teams: ["name", "nameNormalized", "owner", "status", "memberCount", "ftcaConfirmedCount", "challenge"],
    team_memberships: ["team", "candidate", "source"],
    team_invitations: ["team", "candidate", "invitedBy", "status", "resolvedAt"],
    hackathon_settings: ["key", "deadlineUtc", "timezone", "formationOpen"],
    import_batches: ["fileName", "fileType", "totalRows", "validRows", "invalidRows", "pendingFtcaRows", "createdBy"],
  }
  const result = { id: record.id }
  for (const field of fieldsByCollection[name] || []) {
    result[field] = record.get(field)
  }
  return result
}

function audit(app, input) {
  const collection = app.findCollectionByNameOrId("audit_logs")
  const record = new Record(collection)
  if (input.actorId) record.set("actor", input.actorId)
  record.set("action", input.action)
  record.set("entityType", input.entityType)
  record.set("entityId", input.entityId || "")
  record.set("before", input.before || null)
  record.set("after", input.after || null)
  record.set("reason", String(input.reason || "").trim())
  record.set("metadata", input.metadata || null)
  app.save(record)
  return record
}

function requireAdminReasonWhenClosed(app, reason) {
  const settings = app.findFirstRecordByData("hackathon_settings", "key", "default")
  const deadline = settings.getDateTime("deadlineUtc")
  const closed =
    !settings.getBool("formationOpen") ||
    (!deadline.isZero() && deadline.unix() <= Math.floor(Date.now() / 1000))

  if (closed && !String(reason || "").trim()) {
    throw new BadRequestError("Se requiere un motivo para intervenir después del cierre.", {
      reason: new ValidationError("required", "Ingrese el motivo de la intervención."),
    })
  }
}

module.exports = {
  assertFormationOpen,
  audit,
  cancelPendingInvitationsForCandidate,
  findMembershipByCandidate,
  getTeamMemberships,
  isTeamChallengeId,
  normalizeTeamName,
  recalculateTeam,
  requireAdmin,
  requireAdminReasonWhenClosed,
  requireCandidate,
  requireUser,
  snapshot,
}
