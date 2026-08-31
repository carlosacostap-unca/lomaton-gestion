/// <reference path="../pb_data/types.d.ts" />

routerAdd("GET", "/api/lomaton/admin/report-snapshot", (e) => {
  const domain = require(`${__hooks}/lib/domain.cjs`)
  domain.requireAdmin(e.auth)
  let snapshot = null

  e.app.runInTransaction((txApp) => {
    const candidates = txApp.findAllRecords("candidates")
    const teams = txApp.findAllRecords("teams")
    const memberships = txApp.findAllRecords("team_memberships")
    const invitations = txApp.findAllRecords("team_invitations")

    snapshot = {
      generatedAtUtc: new Date().toISOString(),
      candidates: candidates.map((candidate) => domain.snapshot(candidate)),
      teams: teams.map((team) => domain.snapshot(team)),
      memberships: memberships.map((membership) => domain.snapshot(membership)),
      invitations: invitations.map((invitation) => domain.snapshot(invitation)),
    }
  })

  return e.json(200, snapshot)
}, $apis.requireAuth("users"))
