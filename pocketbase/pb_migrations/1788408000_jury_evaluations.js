/// <reference path="../pb_data/types.d.ts" />

function saveCollection(app, definition) {
  const collection = new Collection(definition)
  app.save(collection)
  return collection
}

const serviceRule = '@request.auth.active = true && @request.auth.role = "lomaton_server"'

migrate((app) => {
  const users = app.findCollectionByNameOrId("users")
  const teams = app.findCollectionByNameOrId("teams")

  const jurors = saveCollection(app, {
    type: "base", name: "jurors",
    listRule: serviceRule, viewRule: serviceRule, createRule: serviceRule, updateRule: serviceRule, deleteRule: serviceRule,
    fields: [
      { type: "text", name: "fullName", required: true, max: 240 },
      { type: "email", name: "email", required: true },
      { type: "text", name: "emailNormalized", required: true, max: 254 },
      { type: "bool", name: "active" },
      { type: "autodate", name: "created", onCreate: true, onUpdate: false },
      { type: "autodate", name: "updated", onCreate: true, onUpdate: true },
    ],
    indexes: ["CREATE UNIQUE INDEX idx_jurors_email_normalized ON jurors (emailNormalized)"],
  })

  const cycles = saveCollection(app, {
    type: "base", name: "evaluation_cycles",
    listRule: serviceRule, viewRule: serviceRule, createRule: serviceRule, updateRule: serviceRule, deleteRule: serviceRule,
    fields: [
      { type: "select", name: "status", required: true, maxSelect: 1, values: ["open", "cancelled", "published"] },
      { type: "text", name: "criteriaVersion", required: true, max: 40 },
      { type: "number", name: "jurorCount", onlyInt: true, min: 0 },
      { type: "number", name: "teamCount", onlyInt: true, min: 0 },
      { type: "number", name: "requiredCount", onlyInt: true, min: 0 },
      { type: "number", name: "finalizedCount", onlyInt: true, min: 0 },
      { type: "number", name: "version", onlyInt: true, min: 0 },
      { type: "relation", name: "openedBy", collectionId: users.id, maxSelect: 1, cascadeDelete: false },
      { type: "date", name: "openedAt" },
      { type: "relation", name: "cancelledBy", collectionId: users.id, maxSelect: 1, cascadeDelete: false },
      { type: "date", name: "cancelledAt" },
      { type: "text", name: "cancelReason", max: 1000 },
      { type: "relation", name: "publishedBy", collectionId: users.id, maxSelect: 1, cascadeDelete: false },
      { type: "date", name: "publishedAt" },
      { type: "autodate", name: "created", onCreate: true, onUpdate: false },
      { type: "autodate", name: "updated", onCreate: true, onUpdate: true },
    ],
    indexes: [
      "CREATE UNIQUE INDEX idx_evaluation_cycles_single_open ON evaluation_cycles (status) WHERE status = 'open'",
      "CREATE INDEX idx_evaluation_cycles_status_created ON evaluation_cycles (status, created)",
    ],
  })

  saveCollection(app, {
    type: "base", name: "jury_evaluations",
    listRule: serviceRule, viewRule: serviceRule, createRule: serviceRule, updateRule: serviceRule, deleteRule: serviceRule,
    fields: [
      { type: "relation", name: "cycle", required: true, collectionId: cycles.id, maxSelect: 1, cascadeDelete: true },
      { type: "relation", name: "juror", required: true, collectionId: jurors.id, maxSelect: 1, cascadeDelete: false },
      { type: "relation", name: "team", required: true, collectionId: teams.id, maxSelect: 1, cascadeDelete: false },
      { type: "text", name: "jurorNameSnapshot", required: true, max: 240 },
      { type: "text", name: "teamNameSnapshot", required: true, max: 120 },
      { type: "select", name: "status", required: true, maxSelect: 1, values: ["pending", "draft", "finalized"] },
      { type: "select", name: "completedCriteria", maxSelect: 5, values: ["innovation", "impact", "viability", "presentation", "teamwork"] },
      { type: "number", name: "scoreInnovation", onlyInt: true, min: 0, max: 10 },
      { type: "number", name: "scoreImpact", onlyInt: true, min: 0, max: 10 },
      { type: "number", name: "scoreViability", onlyInt: true, min: 0, max: 10 },
      { type: "number", name: "scorePresentation", onlyInt: true, min: 0, max: 10 },
      { type: "number", name: "scoreTeamwork", onlyInt: true, min: 0, max: 10 },
      { type: "number", name: "totalCentipoints", onlyInt: true, min: 0, max: 1000 },
      { type: "number", name: "version", onlyInt: true, min: 0 },
      { type: "date", name: "finalizedAt" },
      { type: "autodate", name: "created", onCreate: true, onUpdate: false },
      { type: "autodate", name: "updated", onCreate: true, onUpdate: true },
    ],
    indexes: [
      "CREATE UNIQUE INDEX idx_jury_evaluations_pair ON jury_evaluations (cycle, juror, team)",
      "CREATE INDEX idx_jury_evaluations_juror_status ON jury_evaluations (cycle, juror, status)",
      "CREATE INDEX idx_jury_evaluations_team_status ON jury_evaluations (cycle, team, status)",
    ],
  })

  saveCollection(app, {
    type: "base", name: "evaluation_results",
    listRule: serviceRule, viewRule: serviceRule, createRule: serviceRule, updateRule: serviceRule, deleteRule: serviceRule,
    fields: [
      { type: "relation", name: "cycle", required: true, collectionId: cycles.id, maxSelect: 1, cascadeDelete: true },
      { type: "relation", name: "team", required: true, collectionId: teams.id, maxSelect: 1, cascadeDelete: false },
      { type: "text", name: "teamNameSnapshot", required: true, max: 120 },
      { type: "number", name: "jurorCount", required: true, onlyInt: true, min: 1 },
      { type: "number", name: "innovationSum", required: true, onlyInt: true, min: 0 },
      { type: "number", name: "impactSum", required: true, onlyInt: true, min: 0 },
      { type: "number", name: "viabilitySum", required: true, onlyInt: true, min: 0 },
      { type: "number", name: "presentationSum", required: true, onlyInt: true, min: 0 },
      { type: "number", name: "teamworkSum", required: true, onlyInt: true, min: 0 },
      { type: "number", name: "totalCentipointsSum", required: true, onlyInt: true, min: 0 },
      { type: "date", name: "publishedAt", required: true },
      { type: "autodate", name: "created", onCreate: true, onUpdate: false },
      { type: "autodate", name: "updated", onCreate: true, onUpdate: true },
    ],
    indexes: ["CREATE UNIQUE INDEX idx_evaluation_results_team ON evaluation_results (cycle, team)"],
  })

  users.fields.add(new RelationField({
    name: "juror",
    collectionId: jurors.id,
    maxSelect: 1,
    cascadeDelete: false,
  }))
  users.addIndex("idx_users_juror", true, "juror", "juror != ''")
  app.save(users)
}, (app) => {
  const users = app.findCollectionByNameOrId("users")
  users.fields.removeByName("juror")
  users.removeIndex("idx_users_juror")
  app.save(users)

  for (const name of ["evaluation_results", "jury_evaluations", "evaluation_cycles", "jurors"]) {
    app.delete(app.findCollectionByNameOrId(name))
  }
})
