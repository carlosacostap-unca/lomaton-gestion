/// <reference path="../pb_data/types.d.ts" />

const authenticated = '@request.auth.id != ""'
const administrator = '@request.auth.id != "" && @request.auth.isAdmin = true'

function saveCollection(app, definition) {
  const collection = new Collection(definition)
  app.save(collection)
  return collection
}

migrate((app) => {
  const candidates = saveCollection(app, {
    type: "base",
    name: "candidates",
    listRule: authenticated,
    viewRule: authenticated,
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      { type: "text", name: "firstName", required: true, max: 120 },
      { type: "text", name: "lastName", required: true, max: 120 },
      { type: "email", name: "email", required: true },
      { type: "text", name: "emailNormalized", required: true, max: 254 },
      {
        type: "select",
        name: "ftcaStatus",
        required: true,
        maxSelect: 1,
        values: ["confirmed", "not_ftca", "pending"],
      },
      { type: "bool", name: "active" },
      { type: "autodate", name: "created", onCreate: true, onUpdate: false },
      { type: "autodate", name: "updated", onCreate: true, onUpdate: true },
    ],
    indexes: [
      "CREATE UNIQUE INDEX idx_candidates_email_normalized ON candidates (emailNormalized)",
      "CREATE INDEX idx_candidates_name ON candidates (lastName, firstName)",
      "CREATE INDEX idx_candidates_ftca_status ON candidates (ftcaStatus)",
    ],
  })

  const adminAllowlist = saveCollection(app, {
    type: "base",
    name: "admin_allowlist",
    listRule: null,
    viewRule: null,
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      { type: "email", name: "email", required: true },
      { type: "text", name: "emailNormalized", required: true, max: 254 },
      { type: "bool", name: "active" },
      { type: "autodate", name: "created", onCreate: true, onUpdate: false },
      { type: "autodate", name: "updated", onCreate: true, onUpdate: true },
    ],
    indexes: [
      "CREATE UNIQUE INDEX idx_admin_allowlist_email_normalized ON admin_allowlist (emailNormalized)",
    ],
  })

  const users = app.findCollectionByNameOrId("users")
  users.listRule = 'id = @request.auth.id || @request.auth.isAdmin = true'
  users.viewRule = 'id = @request.auth.id || @request.auth.isAdmin = true'
  // OAuth2 sign-up needs an unlocked create rule. The users CRUD endpoint is
  // still blocked by a dedicated request hook, so only the OAuth flow can create users.
  users.createRule = ""
  users.updateRule = null
  users.deleteRule = null
  users.authRule = "enabled = true"
  users.manageRule = null
  users.fields.add(
    new RelationField({
      name: "candidate",
      collectionId: candidates.id,
      maxSelect: 1,
      cascadeDelete: false,
    }),
    new TextField({ name: "displayName", max: 240 }),
    new BoolField({ name: "isAdmin" }),
    new BoolField({ name: "enabled" }),
  )
  users.passwordAuth.enabled = false
  users.otp.enabled = false
  users.oauth2.enabled = true
  users.addIndex("idx_users_candidate", true, "candidate", "candidate != ''")
  app.save(users)

  const teams = saveCollection(app, {
    type: "base",
    name: "teams",
    listRule: authenticated,
    viewRule: authenticated,
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      { type: "text", name: "name", required: true, max: 120 },
      { type: "text", name: "nameNormalized", required: true, max: 120 },
      {
        type: "relation",
        name: "owner",
        required: true,
        collectionId: candidates.id,
        maxSelect: 1,
        cascadeDelete: false,
      },
      {
        type: "select",
        name: "status",
        required: true,
        maxSelect: 1,
        values: ["draft", "missing_ftca", "complete", "invalid"],
      },
      { type: "number", name: "memberCount", onlyInt: true, min: 0 },
      { type: "number", name: "ftcaConfirmedCount", onlyInt: true, min: 0 },
      { type: "autodate", name: "created", onCreate: true, onUpdate: false },
      { type: "autodate", name: "updated", onCreate: true, onUpdate: true },
    ],
    indexes: [
      "CREATE UNIQUE INDEX idx_teams_name_normalized ON teams (nameNormalized)",
      "CREATE INDEX idx_teams_status ON teams (status)",
    ],
  })

  const memberships = saveCollection(app, {
    type: "base",
    name: "team_memberships",
    listRule: authenticated,
    viewRule: authenticated,
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      {
        type: "relation",
        name: "team",
        required: true,
        collectionId: teams.id,
        maxSelect: 1,
        cascadeDelete: true,
      },
      {
        type: "relation",
        name: "candidate",
        required: true,
        collectionId: candidates.id,
        maxSelect: 1,
        cascadeDelete: false,
      },
      {
        type: "select",
        name: "source",
        required: true,
        maxSelect: 1,
        values: ["owner", "invitation", "admin"],
      },
      { type: "autodate", name: "created", onCreate: true, onUpdate: false },
      { type: "autodate", name: "updated", onCreate: true, onUpdate: true },
    ],
    indexes: [
      "CREATE UNIQUE INDEX idx_team_memberships_candidate ON team_memberships (candidate)",
      "CREATE UNIQUE INDEX idx_team_memberships_team_candidate ON team_memberships (team, candidate)",
      "CREATE INDEX idx_team_memberships_team ON team_memberships (team)",
    ],
  })

  const invitations = saveCollection(app, {
    type: "base",
    name: "team_invitations",
    listRule:
      '@request.auth.id != "" && (candidate = @request.auth.candidate || team.owner = @request.auth.candidate || @request.auth.isAdmin = true)',
    viewRule:
      '@request.auth.id != "" && (candidate = @request.auth.candidate || team.owner = @request.auth.candidate || @request.auth.isAdmin = true)',
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      {
        type: "relation",
        name: "team",
        required: true,
        collectionId: teams.id,
        maxSelect: 1,
        cascadeDelete: true,
      },
      {
        type: "relation",
        name: "candidate",
        required: true,
        collectionId: candidates.id,
        maxSelect: 1,
        cascadeDelete: false,
      },
      {
        type: "relation",
        name: "invitedBy",
        required: true,
        collectionId: users.id,
        maxSelect: 1,
        cascadeDelete: false,
      },
      {
        type: "select",
        name: "status",
        required: true,
        maxSelect: 1,
        values: ["pending", "accepted", "rejected", "withdrawn", "cancelled"],
      },
      { type: "date", name: "resolvedAt" },
      { type: "autodate", name: "created", onCreate: true, onUpdate: false },
      { type: "autodate", name: "updated", onCreate: true, onUpdate: true },
    ],
    indexes: [
      "CREATE UNIQUE INDEX idx_team_invitations_pending_unique ON team_invitations (team, candidate) WHERE status = 'pending'",
      "CREATE INDEX idx_team_invitations_candidate_status ON team_invitations (candidate, status)",
      "CREATE INDEX idx_team_invitations_team_status ON team_invitations (team, status)",
    ],
  })

  const settings = saveCollection(app, {
    type: "base",
    name: "hackathon_settings",
    listRule: authenticated,
    viewRule: authenticated,
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      { type: "text", name: "key", required: true, max: 40 },
      { type: "date", name: "deadlineUtc" },
      { type: "text", name: "timezone", required: true, max: 80 },
      { type: "bool", name: "formationOpen" },
      { type: "autodate", name: "created", onCreate: true, onUpdate: false },
      { type: "autodate", name: "updated", onCreate: true, onUpdate: true },
    ],
    indexes: [
      "CREATE UNIQUE INDEX idx_hackathon_settings_key ON hackathon_settings (`key`)",
    ],
  })

  const importBatches = saveCollection(app, {
    type: "base",
    name: "import_batches",
    listRule: administrator,
    viewRule: administrator,
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      { type: "text", name: "fileName", required: true, max: 255 },
      {
        type: "select",
        name: "fileType",
        required: true,
        maxSelect: 1,
        values: ["csv", "xlsx"],
      },
      { type: "number", name: "totalRows", onlyInt: true, min: 0 },
      { type: "number", name: "validRows", onlyInt: true, min: 0 },
      { type: "number", name: "invalidRows", onlyInt: true, min: 0 },
      { type: "number", name: "pendingFtcaRows", onlyInt: true, min: 0 },
      {
        type: "relation",
        name: "createdBy",
        required: true,
        collectionId: users.id,
        maxSelect: 1,
        cascadeDelete: false,
      },
      { type: "autodate", name: "created", onCreate: true, onUpdate: false },
      { type: "autodate", name: "updated", onCreate: true, onUpdate: true },
    ],
    indexes: [],
  })

  const auditLogs = saveCollection(app, {
    type: "base",
    name: "audit_logs",
    listRule: administrator,
    viewRule: administrator,
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      {
        type: "relation",
        name: "actor",
        collectionId: users.id,
        maxSelect: 1,
        cascadeDelete: false,
      },
      { type: "text", name: "action", required: true, max: 120 },
      { type: "text", name: "entityType", required: true, max: 80 },
      { type: "text", name: "entityId", max: 40 },
      { type: "json", name: "before" },
      { type: "json", name: "after" },
      { type: "text", name: "reason", max: 1000 },
      { type: "json", name: "metadata" },
      { type: "autodate", name: "created", onCreate: true, onUpdate: false },
    ],
    indexes: [
      "CREATE INDEX idx_audit_logs_entity ON audit_logs (entityType, entityId)",
      "CREATE INDEX idx_audit_logs_actor ON audit_logs (actor)",
    ],
  })

  const initialAdmin = new Record(adminAllowlist)
  initialAdmin.set("email", "carlosacostap@tecno.unca.edu.ar")
  initialAdmin.set("emailNormalized", "carlosacostap@tecno.unca.edu.ar")
  initialAdmin.set("active", true)
  app.save(initialAdmin)

  const initialSettings = new Record(settings)
  initialSettings.set("key", "default")
  initialSettings.set("timezone", "America/Argentina/Buenos_Aires")
  initialSettings.set("formationOpen", true)
  app.save(initialSettings)
}, (app) => {
  const dependentNames = [
    "audit_logs",
    "import_batches",
    "team_invitations",
    "team_memberships",
    "teams",
    "hackathon_settings",
  ]

  for (const name of dependentNames) {
    app.delete(app.findCollectionByNameOrId(name))
  }

  const users = app.findCollectionByNameOrId("users")
  users.fields.removeByName("candidate")
  users.fields.removeByName("displayName")
  users.fields.removeByName("isAdmin")
  users.fields.removeByName("enabled")
  users.removeIndex("idx_users_candidate")
  users.listRule = "id = @request.auth.id"
  users.viewRule = "id = @request.auth.id"
  users.createRule = ""
  users.updateRule = "id = @request.auth.id"
  users.deleteRule = "id = @request.auth.id"
  users.authRule = ""
  users.passwordAuth.enabled = true
  users.otp.enabled = false
  users.oauth2.enabled = false
  app.save(users)

  app.delete(app.findCollectionByNameOrId("admin_allowlist"))
  app.delete(app.findCollectionByNameOrId("candidates"))
})
