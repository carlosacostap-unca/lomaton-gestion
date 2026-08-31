export const technicalRule =
  '@request.auth.active = true && @request.auth.role = "lomaton_server"';

export const expectedFields = {
  users: ["candidate", "displayName", "isAdmin", "enabled"],
  service_accounts: ["active", "role"],
  candidates: ["firstName", "lastName", "email", "emailNormalized", "ftcaStatus", "active"],
  admin_allowlist: ["email", "emailNormalized", "active"],
  teams: ["name", "nameNormalized", "owner", "status", "memberCount", "ftcaConfirmedCount"],
  team_memberships: ["team", "candidate", "source"],
  team_invitations: ["team", "candidate", "invitedBy", "status", "resolvedAt"],
  hackathon_settings: ["key", "deadlineUtc", "timezone", "formationOpen", "dataVersion"],
  import_batches: ["fileName", "fileType", "totalRows", "validRows", "invalidRows", "pendingFtcaRows", "createdBy"],
  audit_logs: ["actor", "action", "entityType", "entityId", "before", "after", "reason", "metadata"],
};

const userReadRule =
  `id = @request.auth.id || @request.auth.isAdmin = true || (${technicalRule})`;
const authenticatedReadRule = '@request.auth.id != ""';
const invitationReadRule =
  `(${technicalRule}) || (@request.auth.id != "" && (candidate = @request.auth.candidate || team.owner = @request.auth.candidate || @request.auth.isAdmin = true))`;
const adminOrTechnicalRule =
  `@request.auth.isAdmin = true || (${technicalRule})`;

export const collectionRulePatches = {
  users: {
    listRule: userReadRule,
    viewRule: userReadRule,
    createRule: '@request.context = "oauth2"',
    updateRule: technicalRule,
    deleteRule: null,
    manageRule: null,
    authRule:
      'verified = true && ((@collection.candidates.emailNormalized ?= email && @collection.candidates.active ?= true) || (@collection.admin_allowlist.emailNormalized ?= email && @collection.admin_allowlist.active ?= true))',
  },
  service_accounts: {
    listRule: null,
    viewRule: null,
    createRule: null,
    updateRule: null,
    deleteRule: null,
    manageRule: null,
    authRule: 'verified = true && active = true && role = "lomaton_server"',
  },
  candidates: {
    listRule: authenticatedReadRule,
    viewRule: authenticatedReadRule,
    createRule: technicalRule,
    updateRule: technicalRule,
    deleteRule: null,
  },
  admin_allowlist: {
    listRule: technicalRule,
    viewRule: technicalRule,
    createRule: null,
    updateRule: null,
    deleteRule: null,
  },
  teams: {
    listRule: authenticatedReadRule,
    viewRule: authenticatedReadRule,
    createRule: technicalRule,
    updateRule: `${technicalRule} && (@request.query.expected_member_count = "" || memberCount = @request.query.expected_member_count)`,
    deleteRule: technicalRule,
  },
  team_memberships: {
    listRule: authenticatedReadRule,
    viewRule: authenticatedReadRule,
    createRule: technicalRule,
    updateRule: technicalRule,
    deleteRule: technicalRule,
  },
  team_invitations: {
    listRule: invitationReadRule,
    viewRule: invitationReadRule,
    createRule: technicalRule,
    updateRule: technicalRule,
    deleteRule: technicalRule,
  },
  hackathon_settings: {
    listRule: authenticatedReadRule,
    viewRule: authenticatedReadRule,
    createRule: technicalRule,
    updateRule: technicalRule,
    deleteRule: null,
  },
  import_batches: {
    listRule: adminOrTechnicalRule,
    viewRule: adminOrTechnicalRule,
    createRule: technicalRule,
    updateRule: technicalRule,
    deleteRule: null,
  },
  audit_logs: {
    listRule: adminOrTechnicalRule,
    viewRule: adminOrTechnicalRule,
    createRule: technicalRule,
    updateRule: null,
    deleteRule: null,
  },
};

export const serviceAccountsCollection = {
  name: "service_accounts",
  type: "auth",
  ...collectionRulePatches.service_accounts,
  fields: [
    { name: "active", type: "bool", required: false },
    {
      name: "role",
      type: "select",
      required: true,
      maxSelect: 1,
      values: ["lomaton_server"],
    },
  ],
  passwordAuth: { enabled: true, identityFields: ["email"] },
  oauth2: { enabled: false, providers: [] },
  otp: { enabled: false, duration: 180, length: 6 },
  mfa: { enabled: false, duration: 1800, rule: "" },
};

export const dataVersionField = {
  name: "dataVersion",
  type: "number",
  required: false,
  min: 0,
  onlyInt: true,
};

export const batchSettings = {
  enabled: true,
  maxRequests: 11_000,
  timeout: 60,
  maxBodySize: 16 * 1024 * 1024,
};
