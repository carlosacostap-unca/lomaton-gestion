/// <reference path="../pb_data/types.d.ts" />

routerAdd("POST", "/api/lomaton/teams", (e) => {
  const domain = require(`${__hooks}/lib/domain.cjs`)
  const candidateId = domain.requireCandidate(e.auth)
  domain.assertFormationOpen(e.app)
  const data = new DynamicModel({ name: "" })
  e.bindBody(data)
  const teamName = domain.normalizeTeamName(data.name)

  if (teamName.display.length < 2 || teamName.display.length > 120) {
    throw new BadRequestError("El nombre del equipo debe tener entre 2 y 120 caracteres.")
  }

  let teamId = ""
  e.app.runInTransaction((txApp) => {
    if (domain.findMembershipByCandidate(txApp, candidateId)) {
      throw new ApiError(409, "El candidato ya pertenece a un equipo.", {
        code: "candidate_already_member",
      })
    }

    const teams = txApp.findCollectionByNameOrId("teams")
    const team = new Record(teams)
    team.set("name", teamName.display)
    team.set("nameNormalized", teamName.normalized)
    team.set("owner", candidateId)
    team.set("status", "draft")
    team.set("memberCount", 1)
    team.set("ftcaConfirmedCount", 0)
    txApp.save(team)

    const memberships = txApp.findCollectionByNameOrId("team_memberships")
    const membership = new Record(memberships)
    membership.set("team", team.id)
    membership.set("candidate", candidateId)
    membership.set("source", "owner")
    txApp.save(membership)
    domain.recalculateTeam(txApp, team.id)
    teamId = team.id
  })

  return e.json(201, domain.snapshot(e.app.findRecordById("teams", teamId)))
}, $apis.requireAuth("users"))

routerAdd("DELETE", "/api/lomaton/teams/{teamId}", (e) => {
  const domain = require(`${__hooks}/lib/domain.cjs`)
  const candidateId = domain.requireCandidate(e.auth)
  domain.assertFormationOpen(e.app)
  const teamId = e.request.pathValue("teamId")

  e.app.runInTransaction((txApp) => {
    const team = txApp.findRecordById("teams", teamId)
    if (team.getString("owner") !== candidateId) {
      throw new ForbiddenError("Solamente el responsable puede disolver el equipo.")
    }
    txApp.delete(team)
  })

  return e.noContent(204)
}, $apis.requireAuth("users"))

routerAdd("POST", "/api/lomaton/teams/{teamId}/invitations", (e) => {
  const domain = require(`${__hooks}/lib/domain.cjs`)
  const ownerCandidateId = domain.requireCandidate(e.auth)
  domain.assertFormationOpen(e.app)
  const teamId = e.request.pathValue("teamId")
  const data = new DynamicModel({ candidateId: "" })
  e.bindBody(data)
  let invitationId = ""

  e.app.runInTransaction((txApp) => {
    const team = txApp.findRecordById("teams", teamId)
    if (team.getString("owner") !== ownerCandidateId) {
      throw new ForbiddenError("Solamente el responsable puede invitar candidatos.")
    }
    const candidate = txApp.findRecordById("candidates", data.candidateId)
    if (!candidate.getBool("active")) {
      throw new ApiError(409, "El candidato no está activo.")
    }
    if (domain.findMembershipByCandidate(txApp, candidate.id)) {
      throw new ApiError(409, "El candidato ya pertenece a un equipo.", {
        code: "candidate_already_member",
      })
    }
    if (domain.getTeamMemberships(txApp, teamId).length >= 4) {
      throw new ApiError(409, "El equipo ya alcanzó cuatro integrantes.", {
        code: "team_full",
      })
    }

    const invitations = txApp.findCollectionByNameOrId("team_invitations")
    const invitation = new Record(invitations)
    invitation.set("team", teamId)
    invitation.set("candidate", candidate.id)
    invitation.set("invitedBy", e.auth.id)
    invitation.set("status", "pending")
    txApp.save(invitation)
    invitationId = invitation.id
  })

  return e.json(
    201,
    domain.snapshot(e.app.findRecordById("team_invitations", invitationId)),
  )
}, $apis.requireAuth("users"))

routerAdd("DELETE", "/api/lomaton/invitations/{invitationId}", (e) => {
  const domain = require(`${__hooks}/lib/domain.cjs`)
  const ownerCandidateId = domain.requireCandidate(e.auth)
  domain.assertFormationOpen(e.app)
  const invitationId = e.request.pathValue("invitationId")

  e.app.runInTransaction((txApp) => {
    const invitation = txApp.findRecordById("team_invitations", invitationId)
    const team = txApp.findRecordById("teams", invitation.getString("team"))
    if (team.getString("owner") !== ownerCandidateId) {
      throw new ForbiddenError("Solamente el responsable puede retirar la invitación.")
    }
    if (invitation.getString("status") !== "pending") {
      throw new ApiError(409, "La invitación ya fue resuelta.")
    }
    invitation.set("status", "withdrawn")
    invitation.set("resolvedAt", new DateTime())
    txApp.save(invitation)
  })

  return e.json(
    200,
    domain.snapshot(e.app.findRecordById("team_invitations", invitationId)),
  )
}, $apis.requireAuth("users"))

routerAdd("POST", "/api/lomaton/invitations/{invitationId}/accept", (e) => {
  const domain = require(`${__hooks}/lib/domain.cjs`)
  const candidateId = domain.requireCandidate(e.auth)
  domain.assertFormationOpen(e.app)
  const invitationId = e.request.pathValue("invitationId")
  let teamId = ""
  let conflict = null

  e.app.runInTransaction((txApp) => {
    const invitation = txApp.findRecordById("team_invitations", invitationId)
    if (invitation.getString("candidate") !== candidateId) {
      throw new ForbiddenError("La invitación pertenece a otro candidato.")
    }
    if (invitation.getString("status") !== "pending") {
      throw new ApiError(409, "La invitación ya fue resuelta.")
    }

    teamId = invitation.getString("team")
    if (domain.findMembershipByCandidate(txApp, candidateId)) {
      invitation.set("status", "cancelled")
      invitation.set("resolvedAt", new DateTime())
      txApp.save(invitation)
      conflict = { code: "candidate_already_member", message: "Ya pertenece a otro equipo." }
      return
    }

    if (domain.getTeamMemberships(txApp, teamId).length >= 4) {
      invitation.set("status", "cancelled")
      invitation.set("resolvedAt", new DateTime())
      txApp.save(invitation)
      conflict = { code: "team_full", message: "El equipo alcanzó cuatro integrantes." }
      return
    }

    const memberships = txApp.findCollectionByNameOrId("team_memberships")
    const membership = new Record(memberships)
    membership.set("team", teamId)
    membership.set("candidate", candidateId)
    membership.set("source", "invitation")
    txApp.save(membership)

    invitation.set("status", "accepted")
    invitation.set("resolvedAt", new DateTime())
    txApp.save(invitation)
    domain.cancelPendingInvitationsForCandidate(txApp, candidateId, invitation.id)
    domain.recalculateTeam(txApp, teamId)
  })

  if (conflict) {
    throw new ApiError(409, conflict.message, { code: conflict.code })
  }
  return e.json(200, domain.snapshot(e.app.findRecordById("teams", teamId)))
}, $apis.requireAuth("users"))

routerAdd("POST", "/api/lomaton/invitations/{invitationId}/reject", (e) => {
  const domain = require(`${__hooks}/lib/domain.cjs`)
  const candidateId = domain.requireCandidate(e.auth)
  domain.assertFormationOpen(e.app)
  const invitationId = e.request.pathValue("invitationId")

  e.app.runInTransaction((txApp) => {
    const invitation = txApp.findRecordById("team_invitations", invitationId)
    if (invitation.getString("candidate") !== candidateId) {
      throw new ForbiddenError("La invitación pertenece a otro candidato.")
    }
    if (invitation.getString("status") !== "pending") {
      throw new ApiError(409, "La invitación ya fue resuelta.")
    }
    invitation.set("status", "rejected")
    invitation.set("resolvedAt", new DateTime())
    txApp.save(invitation)
  })

  return e.json(
    200,
    domain.snapshot(e.app.findRecordById("team_invitations", invitationId)),
  )
}, $apis.requireAuth("users"))
