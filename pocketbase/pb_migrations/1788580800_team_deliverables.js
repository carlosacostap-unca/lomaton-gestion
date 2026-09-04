/// <reference path="../pb_data/types.d.ts" />

const technicalRule = '@request.auth.active = true && @request.auth.role = "lomaton_server"'
const maxFileSize = 25 * 1024 * 1024

function fileFields(prefix, mimeTypes) {
  return [
    { type: "file", name: `${prefix}File`, maxSelect: 1, maxSize: maxFileSize, mimeTypes, protected: true },
    { type: "text", name: `${prefix}OriginalName`, max: 240 },
    { type: "number", name: `${prefix}SizeBytes`, min: 0, max: maxFileSize, onlyInt: true },
    { type: "text", name: `${prefix}MimeType`, max: 160 },
    { type: "text", name: `${prefix}Sha256`, max: 64, pattern: "^$|^[a-f0-9]{64}$" },
    { type: "date", name: `${prefix}UpdatedAt` },
  ]
}

migrate((app) => {
  const settings = app.findCollectionByNameOrId("hackathon_settings")
  settings.fields.add(new DateField({ name: "deliverablesDeadlineUtc" }))
  app.save(settings)

  const teams = app.findCollectionByNameOrId("teams")
  const users = app.findCollectionByNameOrId("users")
  const deliverables = new Collection({
    type: "base",
    name: "team_deliverables",
    listRule: technicalRule,
    viewRule: technicalRule,
    createRule: technicalRule,
    updateRule: `${technicalRule} && (@request.query.expected_version = "" || version = @request.query.expected_version)`,
    deleteRule: technicalRule,
    fields: [
      { type: "relation", name: "team", required: true, collectionId: teams.id, maxSelect: 1, cascadeDelete: true },
      { type: "select", name: "status", required: true, maxSelect: 1, values: ["draft", "finalized"] },
      { type: "number", name: "version", required: true, min: 1, onlyInt: true },
      { type: "select", name: "presentationMedium", maxSelect: 1, values: ["file", "link"] },
      ...fileFields("presentation", ["application/pdf", "application/vnd.ms-powerpoint", "application/vnd.openxmlformats-officedocument.presentationml.presentation"]),
      { type: "text", name: "presentationUrl", max: 2048 },
      ...fileFields("canvas", ["application/pdf", "image/png", "image/jpeg"]),
      ...fileFields("report", ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"]),
      { type: "select", name: "evidenceMedium", maxSelect: 1, values: ["file", "link"] },
      ...fileFields("evidence", ["application/pdf", "image/png", "image/jpeg", "application/zip"]),
      { type: "text", name: "evidenceUrl", max: 2048 },
      { type: "text", name: "videoUrl", max: 2048 },
      { type: "date", name: "videoUpdatedAt" },
      { type: "relation", name: "finalizedBy", collectionId: users.id, maxSelect: 1, cascadeDelete: false },
      { type: "date", name: "finalizedAt" },
      { type: "autodate", name: "created", onCreate: true, onUpdate: false },
      { type: "autodate", name: "updated", onCreate: true, onUpdate: true },
    ],
    indexes: [
      "CREATE UNIQUE INDEX idx_team_deliverables_team ON team_deliverables (team)",
      "CREATE INDEX idx_team_deliverables_status ON team_deliverables (status)",
    ],
  })
  app.save(deliverables)
}, (app) => {
  app.delete(app.findCollectionByNameOrId("team_deliverables"))
  const settings = app.findCollectionByNameOrId("hackathon_settings")
  settings.fields.removeByName("deliverablesDeadlineUtc")
  app.save(settings)
})
