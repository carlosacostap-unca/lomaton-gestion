/// <reference path="../pb_data/types.d.ts" />

routerAdd("POST", "/api/lomaton/admin/import-candidates", (e) => {
  const domain = require(`${__hooks}/lib/domain.cjs`)
  const admin = domain.requireAdmin(e.auth)
  const data = new DynamicModel({
    fileName: "",
    fileType: "",
    digest: "",
    reason: "",
    invalidRows: 0,
    pendingFtcaRows: 0,
    rows: [],
  })
  e.bindBody(data)
  if (!["csv", "xlsx"].includes(data.fileType)) throw new BadRequestError("Tipo de archivo inválido.")
  if (!data.fileName || !data.rows.length) throw new BadRequestError("No hay filas válidas para importar.")
  let result = { created: 0, updated: 0, unchanged: 0, total: data.rows.length }
  let batchId = ""

  e.app.runInTransaction((txApp) => {
    const seen = {}
    const affectedTeams = {}
    for (const row of data.rows) {
      const emailNormalized = String(row.emailNormalized || "").trim().toLowerCase()
      if (!emailNormalized || seen[emailNormalized]) {
        throw new BadRequestError("El lote contiene emails vacíos o duplicados.")
      }
      seen[emailNormalized] = true

      let candidate = null
      try {
        candidate = txApp.findFirstRecordByFilter(
          "candidates",
          "emailNormalized = {:email}",
          { email: emailNormalized },
        )
      } catch {
        candidate = new Record(txApp.findCollectionByNameOrId("candidates"))
      }

      const before = candidate.isNew() ? null : domain.snapshot(candidate)
      candidate.set("firstName", String(row.firstName || "").trim())
      candidate.set("lastName", String(row.lastName || "").trim())
      candidate.set("email", String(row.email || "").trim())
      candidate.set("emailNormalized", emailNormalized)
      candidate.set("ftcaStatus", String(row.ftcaStatus || "pending"))
      candidate.set("active", true)
      txApp.save(candidate)

      if (!before) result.created += 1
      else {
        const after = domain.snapshot(candidate)
        if (JSON.stringify(before) === JSON.stringify(after)) result.unchanged += 1
        else result.updated += 1
      }

      const membership = domain.findMembershipByCandidate(txApp, candidate.id)
      if (membership) affectedTeams[membership.getString("team")] = true
    }

    for (const teamId of Object.keys(affectedTeams)) domain.recalculateTeam(txApp, teamId)

    const batch = new Record(txApp.findCollectionByNameOrId("import_batches"))
    batch.set("fileName", data.fileName)
    batch.set("fileType", data.fileType)
    batch.set("totalRows", data.rows.length + data.invalidRows)
    batch.set("validRows", data.rows.length)
    batch.set("invalidRows", data.invalidRows)
    batch.set("pendingFtcaRows", data.pendingFtcaRows)
    batch.set("createdBy", admin.id)
    txApp.save(batch)
    batchId = batch.id
    domain.audit(txApp, {
      actorId: admin.id,
      action: "candidates.import",
      entityType: "import_batches",
      entityId: batch.id,
      after: domain.snapshot(batch),
      reason: data.reason,
      metadata: { digest: data.digest, result },
    })
  })

  return e.json(201, { batchId, ...result })
}, $apis.requireAuth("users"))
