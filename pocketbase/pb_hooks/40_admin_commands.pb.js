/// <reference path="../pb_data/types.d.ts" />

routerAdd("PATCH", "/api/lomaton/admin/settings", (e) => {
  const domain = require(`${__hooks}/lib/domain.cjs`)
  const admin = domain.requireAdmin(e.auth)
  const data = new DynamicModel({
    deadlineUtc: "",
    formationOpen: false,
    reason: "",
  })
  e.bindBody(data)
  let settingsId = ""

  e.app.runInTransaction((txApp) => {
    const settings = txApp.findFirstRecordByData("hackathon_settings", "key", "default")
    const before = domain.snapshot(settings)
    if (data.deadlineUtc) {
      const deadline = new DateTime(data.deadlineUtc)
      if (deadline.isZero()) throw new BadRequestError("El plazo UTC no es válido.")
      settings.set("deadlineUtc", deadline)
    } else {
      settings.set("deadlineUtc", "")
    }
    settings.set("timezone", "America/Argentina/Buenos_Aires")
    settings.set("formationOpen", data.formationOpen)
    txApp.save(settings)
    domain.audit(txApp, {
      actorId: admin.id,
      action: "hackathon.settings.update",
      entityType: "hackathon_settings",
      entityId: settings.id,
      before,
      after: domain.snapshot(settings),
      reason: data.reason,
    })
    settingsId = settings.id
  })

  return e.json(
    200,
    domain.snapshot(e.app.findRecordById("hackathon_settings", settingsId)),
  )
}, $apis.requireAuth("users"))

routerAdd("POST", "/api/lomaton/admin/teams", (e) => {
  const domain = require(`${__hooks}/lib/domain.cjs`)
  const admin = domain.requireAdmin(e.auth)
  const data = new DynamicModel({ name: "", ownerCandidateId: "", reason: "" })
  e.bindBody(data)
  domain.requireAdminReasonWhenClosed(e.app, data.reason)
  const teamName = domain.normalizeTeamName(data.name)
  if (teamName.display.length < 2 || teamName.display.length > 120) {
    throw new BadRequestError("El nombre del equipo debe tener entre 2 y 120 caracteres.")
  }
  let teamId = ""

  e.app.runInTransaction((txApp) => {
    const owner = txApp.findRecordById("candidates", data.ownerCandidateId)
    if (!owner.getBool("active")) throw new ApiError(409, "El candidato no está activo.")
    if (domain.findMembershipByCandidate(txApp, owner.id)) {
      throw new ApiError(409, "El candidato ya pertenece a un equipo.")
    }

    const team = new Record(txApp.findCollectionByNameOrId("teams"))
    team.set("name", teamName.display)
    team.set("nameNormalized", teamName.normalized)
    team.set("owner", owner.id)
    team.set("status", "draft")
    team.set("memberCount", 1)
    team.set("ftcaConfirmedCount", 0)
    txApp.save(team)

    const membership = new Record(txApp.findCollectionByNameOrId("team_memberships"))
    membership.set("team", team.id)
    membership.set("candidate", owner.id)
    membership.set("source", "admin")
    txApp.save(membership)
    domain.recalculateTeam(txApp, team.id)
    domain.audit(txApp, {
      actorId: admin.id,
      action: "team.admin.create",
      entityType: "teams",
      entityId: team.id,
      after: domain.snapshot(team),
      reason: data.reason,
    })
    teamId = team.id
  })

  return e.json(201, domain.snapshot(e.app.findRecordById("teams", teamId)))
}, $apis.requireAuth("users"))

routerAdd("PATCH", "/api/lomaton/admin/teams/{teamId}", (e) => {
  const domain = require(`${__hooks}/lib/domain.cjs`)
  const admin = domain.requireAdmin(e.auth)
  const data = new DynamicModel({ name: "", ownerCandidateId: "", reason: "" })
  e.bindBody(data)
  domain.requireAdminReasonWhenClosed(e.app, data.reason)
  const teamId = e.request.pathValue("teamId")

  e.app.runInTransaction((txApp) => {
    const team = txApp.findRecordById("teams", teamId)
    const before = domain.snapshot(team)
    if (data.name) {
      const name = domain.normalizeTeamName(data.name)
      if (name.display.length < 2 || name.display.length > 120) {
        throw new BadRequestError("El nombre del equipo debe tener entre 2 y 120 caracteres.")
      }
      team.set("name", name.display)
      team.set("nameNormalized", name.normalized)
    }
    if (data.ownerCandidateId) {
      const membership = domain.findMembershipByCandidate(txApp, data.ownerCandidateId)
      if (!membership || membership.getString("team") !== team.id) {
        throw new BadRequestError("El nuevo responsable debe ser miembro del equipo.")
      }
      team.set("owner", data.ownerCandidateId)
    }
    txApp.save(team)
    domain.audit(txApp, {
      actorId: admin.id,
      action: "team.admin.update",
      entityType: "teams",
      entityId: team.id,
      before,
      after: domain.snapshot(team),
      reason: data.reason,
    })
  })

  return e.json(200, domain.snapshot(e.app.findRecordById("teams", teamId)))
}, $apis.requireAuth("users"))

routerAdd("PUT", "/api/lomaton/admin/teams/{teamId}/members/{candidateId}", (e) => {
  const domain = require(`${__hooks}/lib/domain.cjs`)
  const admin = domain.requireAdmin(e.auth)
  const data = new DynamicModel({ reason: "" })
  e.bindBody(data)
  domain.requireAdminReasonWhenClosed(e.app, data.reason)
  const teamId = e.request.pathValue("teamId")
  const candidateId = e.request.pathValue("candidateId")

  e.app.runInTransaction((txApp) => {
    const team = txApp.findRecordById("teams", teamId)
    const candidate = txApp.findRecordById("candidates", candidateId)
    const before = domain.snapshot(team)
    if (!candidate.getBool("active")) throw new ApiError(409, "El candidato no está activo.")
    if (domain.findMembershipByCandidate(txApp, candidate.id)) {
      throw new ApiError(409, "El candidato ya pertenece a un equipo.")
    }
    if (domain.getTeamMemberships(txApp, team.id).length >= 4) {
      throw new ApiError(409, "El equipo ya alcanzó cuatro integrantes.")
    }

    const membership = new Record(txApp.findCollectionByNameOrId("team_memberships"))
    membership.set("team", team.id)
    membership.set("candidate", candidate.id)
    membership.set("source", "admin")
    txApp.save(membership)
    domain.cancelPendingInvitationsForCandidate(txApp, candidate.id, "")
    const updatedTeam = domain.recalculateTeam(txApp, team.id)
    domain.audit(txApp, {
      actorId: admin.id,
      action: "team.member.admin.add",
      entityType: "teams",
      entityId: team.id,
      before,
      after: domain.snapshot(updatedTeam),
      reason: data.reason,
      metadata: { candidateId: candidate.id },
    })
  })

  return e.json(200, domain.snapshot(e.app.findRecordById("teams", teamId)))
}, $apis.requireAuth("users"))

routerAdd("DELETE", "/api/lomaton/admin/teams/{teamId}/members/{candidateId}", (e) => {
  const domain = require(`${__hooks}/lib/domain.cjs`)
  const admin = domain.requireAdmin(e.auth)
  const data = new DynamicModel({ reason: "" })
  e.bindBody(data)
  domain.requireAdminReasonWhenClosed(e.app, data.reason)
  const teamId = e.request.pathValue("teamId")
  const candidateId = e.request.pathValue("candidateId")

  e.app.runInTransaction((txApp) => {
    const team = txApp.findRecordById("teams", teamId)
    if (team.getString("owner") === candidateId) {
      throw new BadRequestError("Cambie el responsable antes de retirar a ese miembro.")
    }
    const membership = domain.findMembershipByCandidate(txApp, candidateId)
    if (!membership || membership.getString("team") !== team.id) {
      throw new NotFoundError("La membresía no existe.")
    }
    const before = domain.snapshot(team)
    txApp.delete(membership)
    const updatedTeam = domain.recalculateTeam(txApp, team.id)
    domain.audit(txApp, {
      actorId: admin.id,
      action: "team.member.admin.remove",
      entityType: "teams",
      entityId: team.id,
      before,
      after: domain.snapshot(updatedTeam),
      reason: data.reason,
      metadata: { candidateId },
    })
  })

  return e.json(200, domain.snapshot(e.app.findRecordById("teams", teamId)))
}, $apis.requireAuth("users"))

routerAdd("DELETE", "/api/lomaton/admin/teams/{teamId}", (e) => {
  const domain = require(`${__hooks}/lib/domain.cjs`)
  const admin = domain.requireAdmin(e.auth)
  const data = new DynamicModel({ reason: "" })
  e.bindBody(data)
  domain.requireAdminReasonWhenClosed(e.app, data.reason)
  const teamId = e.request.pathValue("teamId")

  e.app.runInTransaction((txApp) => {
    const team = txApp.findRecordById("teams", teamId)
    const before = domain.snapshot(team)
    domain.audit(txApp, {
      actorId: admin.id,
      action: "team.admin.disband",
      entityType: "teams",
      entityId: team.id,
      before,
      reason: data.reason,
    })
    txApp.delete(team)
  })

  return e.noContent(204)
}, $apis.requireAuth("users"))

routerAdd("POST", "/api/lomaton/admin/invitations/{invitationId}/resolve", (e) => {
  const domain = require(`${__hooks}/lib/domain.cjs`)
  const admin = domain.requireAdmin(e.auth)
  const data = new DynamicModel({ resolution: "", reason: "" })
  e.bindBody(data)
  domain.requireAdminReasonWhenClosed(e.app, data.reason)
  if (!["accepted", "rejected", "cancelled"].includes(data.resolution)) {
    throw new BadRequestError("La resolución no es válida.")
  }
  const invitationId = e.request.pathValue("invitationId")
  let teamId = ""

  e.app.runInTransaction((txApp) => {
    const invitation = txApp.findRecordById("team_invitations", invitationId)
    if (invitation.getString("status") !== "pending") {
      throw new ApiError(409, "La invitación ya fue resuelta.")
    }
    const before = domain.snapshot(invitation)
    teamId = invitation.getString("team")
    const candidateId = invitation.getString("candidate")

    if (data.resolution === "accepted") {
      if (domain.findMembershipByCandidate(txApp, candidateId)) {
        throw new ApiError(409, "El candidato ya pertenece a un equipo.")
      }
      if (domain.getTeamMemberships(txApp, teamId).length >= 4) {
        throw new ApiError(409, "El equipo ya alcanzó cuatro integrantes.")
      }
      const membership = new Record(txApp.findCollectionByNameOrId("team_memberships"))
      membership.set("team", teamId)
      membership.set("candidate", candidateId)
      membership.set("source", "admin")
      txApp.save(membership)
      domain.cancelPendingInvitationsForCandidate(txApp, candidateId, invitation.id)
    }

    invitation.set("status", data.resolution)
    invitation.set("resolvedAt", new DateTime())
    txApp.save(invitation)
    const updatedTeam = domain.recalculateTeam(txApp, teamId)
    domain.audit(txApp, {
      actorId: admin.id,
      action: `invitation.admin.${data.resolution}`,
      entityType: "team_invitations",
      entityId: invitation.id,
      before,
      after: domain.snapshot(invitation),
      reason: data.reason,
      metadata: { teamId, teamStatus: updatedTeam.getString("status") },
    })
  })

  return e.json(
    200,
    domain.snapshot(e.app.findRecordById("team_invitations", invitationId)),
  )
}, $apis.requireAuth("users"))

routerAdd("POST", "/api/lomaton/admin/reconcile-teams", (e) => {
  const domain = require(`${__hooks}/lib/domain.cjs`)
  const admin = domain.requireAdmin(e.auth)
  const data = new DynamicModel({ reason: "" })
  e.bindBody(data)
  let checked = 0
  let corrected = 0

  e.app.runInTransaction((txApp) => {
    const teams = txApp.findAllRecords("teams")
    for (const team of teams) {
      checked += 1
      const before = domain.snapshot(team)
      const updated = domain.recalculateTeam(txApp, team.id)
      const after = domain.snapshot(updated)
      if (
        before.status !== after.status ||
        before.memberCount !== after.memberCount ||
        before.ftcaConfirmedCount !== after.ftcaConfirmedCount
      ) {
        corrected += 1
        domain.audit(txApp, {
          actorId: admin.id,
          action: "team.reconcile",
          entityType: "teams",
          entityId: team.id,
          before,
          after,
          reason: data.reason,
        })
      }
    }
  })

  return e.json(200, { checked, corrected })
}, $apis.requireAuth("users"))
