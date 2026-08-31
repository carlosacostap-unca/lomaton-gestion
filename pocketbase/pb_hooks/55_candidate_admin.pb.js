/// <reference path="../pb_data/types.d.ts" />

routerAdd("PATCH", "/api/lomaton/admin/candidates/{candidateId}", (e) => {
  const domain = require(`${__hooks}/lib/domain.cjs`)
  const admin = domain.requireAdmin(e.auth)
  const data = new DynamicModel({
    firstName: "",
    lastName: "",
    email: "",
    ftcaStatus: "",
    active: true,
    reason: "",
  })
  e.bindBody(data)
  domain.requireAdminReasonWhenClosed(e.app, data.reason)
  if (!["confirmed", "not_ftca", "pending"].includes(data.ftcaStatus)) {
    throw new BadRequestError("El estado FTCA no es válido.")
  }
  const email = String(data.email || "").trim()
  const emailNormalized = email.toLowerCase()
  if (!email || !email.includes("@")) throw new BadRequestError("El email no es válido.")
  const candidateId = e.request.pathValue("candidateId")
  let teamId = ""

  e.app.runInTransaction((txApp) => {
    const candidate = txApp.findRecordById("candidates", candidateId)
    const before = domain.snapshot(candidate)
    candidate.set("firstName", String(data.firstName || "").trim())
    candidate.set("lastName", String(data.lastName || "").trim())
    candidate.set("email", email)
    candidate.set("emailNormalized", emailNormalized)
    candidate.set("ftcaStatus", data.ftcaStatus)
    candidate.set("active", data.active)
    txApp.save(candidate)

    let linkedUser = null
    try {
      linkedUser = txApp.findFirstRecordByFilter(
        "users",
        "candidate = {:candidate}",
        { candidate: candidate.id },
      )
    } catch {
      linkedUser = null
    }
    if (linkedUser) {
      const emailChanged = String(before.emailNormalized) !== emailNormalized
      if (emailChanged) linkedUser.set("candidate", "")
      linkedUser.set("enabled", data.active && !emailChanged)
      txApp.save(linkedUser)
    }

    const membership = domain.findMembershipByCandidate(txApp, candidate.id)
    if (membership) {
      teamId = membership.getString("team")
      domain.recalculateTeam(txApp, teamId)
    }
    domain.audit(txApp, {
      actorId: admin.id,
      action: "candidate.admin.update",
      entityType: "candidates",
      entityId: candidate.id,
      before,
      after: domain.snapshot(candidate),
      reason: data.reason,
      metadata: { affectedTeamId: teamId },
    })
  })

  return e.json(200, {
    candidate: domain.snapshot(e.app.findRecordById("candidates", candidateId)),
    affectedTeamId: teamId,
    warning: teamId ? "Se recalculó el estado del equipo asociado." : "",
  })
}, $apis.requireAuth("users"))
