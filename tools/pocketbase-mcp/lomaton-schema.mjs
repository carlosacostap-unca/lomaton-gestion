export const technicalRule =
  '@request.auth.active = true && @request.auth.role = "lomaton_server"';

export const expectedFields = {
  users: ["candidate", "displayName", "isAdmin", "enabled"],
  service_accounts: ["active", "role"],
  registrations: [
    "submittedAt", "fullName", "dni", "dniNormalized", "phone", "phoneNormalized",
    "email", "emailNormalized", "relationship", "ftcaStatus", "department",
    "academicUnit", "career", "externalTeacherDescription", "mentorInterest",
    "declaredTeamStatus", "declaredTeamMembers", "termsAccepted", "mediaAuthorized",
    "sourceRole", "sourceRowNumber", "rawSource", "reviewStatus", "importBatch",
  ],
  candidates: ["registration", "fullName", "firstName", "lastName", "email", "emailNormalized", "ftcaStatus", "active"],
  student_certificates: [
    "candidate", "certificate", "originalName", "sizeBytes", "sha256", "uploadedBy",
    "reviewStatus", "reviewedBy", "reviewedAt", "rejectionReason", "created", "updated",
  ],
  mentor_profiles: ["registration", "department", "externalDescription", "mentorInterest", "active"],
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
  registrations: {
    listRule: adminOrTechnicalRule,
    viewRule: adminOrTechnicalRule,
    createRule: technicalRule,
    updateRule: technicalRule,
    deleteRule: null,
  },
  candidates: {
    listRule: authenticatedReadRule,
    viewRule: authenticatedReadRule,
    createRule: technicalRule,
    updateRule: technicalRule,
    deleteRule: null,
  },
  student_certificates: {
    listRule: technicalRule,
    viewRule: technicalRule,
    createRule: technicalRule,
    updateRule: `${technicalRule} && (@request.query.expected_sha256 = "" || sha256 = @request.query.expected_sha256)`,
    deleteRule: technicalRule,
  },
  mentor_profiles: {
    listRule: adminOrTechnicalRule,
    viewRule: adminOrTechnicalRule,
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

const triStateValues = ["yes", "no", "not_provided"];

export function registrationsCollection(importBatchesCollectionId) {
  return {
    name: "registrations",
    type: "base",
    ...collectionRulePatches.registrations,
    fields: [
      { name: "submittedAt", type: "date", required: false },
      { name: "fullName", type: "text", required: true, max: 240 },
      { name: "dni", type: "text", required: true, max: 40 },
      { name: "dniNormalized", type: "text", required: true, max: 20 },
      { name: "phone", type: "text", required: true, max: 80 },
      { name: "phoneNormalized", type: "text", required: true, max: 30 },
      { name: "email", type: "email", required: true },
      { name: "emailNormalized", type: "text", required: true, max: 254 },
      {
        name: "relationship",
        type: "select",
        required: true,
        maxSelect: 1,
        values: ["student_ftca", "student_external", "teacher"],
      },
      {
        name: "ftcaStatus",
        type: "select",
        required: true,
        maxSelect: 1,
        values: ["confirmed", "not_ftca", "pending"],
      },
      { name: "department", type: "text", required: false, max: 240 },
      { name: "academicUnit", type: "text", required: false, max: 240 },
      { name: "career", type: "text", required: false, max: 240 },
      { name: "externalTeacherDescription", type: "text", required: false, max: 2000 },
      { name: "mentorInterest", type: "select", required: true, maxSelect: 1, values: triStateValues },
      {
        name: "declaredTeamStatus",
        type: "select",
        required: true,
        maxSelect: 1,
        values: ["complete", "none", "partial", "not_provided"],
      },
      { name: "declaredTeamMembers", type: "text", required: false, max: 4000 },
      { name: "termsAccepted", type: "select", required: true, maxSelect: 1, values: triStateValues },
      { name: "mediaAuthorized", type: "select", required: true, maxSelect: 1, values: triStateValues },
      { name: "sourceRole", type: "text", required: true, max: 120 },
      { name: "sourceRowNumber", type: "number", required: true, min: 2, onlyInt: true },
      { name: "rawSource", type: "json", required: false },
      {
        name: "reviewStatus",
        type: "select",
        required: true,
        maxSelect: 1,
        values: ["ready", "needs_review"],
      },
      {
        name: "importBatch",
        type: "relation",
        required: true,
        collectionId: importBatchesCollectionId,
        maxSelect: 1,
        cascadeDelete: false,
      },
    ],
    indexes: [
      "CREATE UNIQUE INDEX idx_registrations_email_normalized ON registrations (emailNormalized)",
      "CREATE UNIQUE INDEX idx_registrations_dni_normalized ON registrations (dniNormalized)",
      "CREATE INDEX idx_registrations_relationship ON registrations (relationship)",
    ],
  };
}

export function mentorProfilesCollection(registrationsCollectionId) {
  return {
    name: "mentor_profiles",
    type: "base",
    ...collectionRulePatches.mentor_profiles,
    fields: [
      {
        name: "registration",
        type: "relation",
        required: true,
        collectionId: registrationsCollectionId,
        maxSelect: 1,
        cascadeDelete: false,
      },
      { name: "department", type: "text", required: false, max: 240 },
      { name: "externalDescription", type: "text", required: false, max: 2000 },
      { name: "mentorInterest", type: "select", required: true, maxSelect: 1, values: triStateValues },
      { name: "active", type: "bool", required: false },
    ],
    indexes: [
      "CREATE UNIQUE INDEX idx_mentor_profiles_registration ON mentor_profiles (registration)",
    ],
  };
}

export function candidateProjectionFields(registrationsCollectionId) {
  return [
    { name: "fullName", type: "text", required: false, max: 240 },
    {
      name: "registration",
      type: "relation",
      required: false,
      collectionId: registrationsCollectionId,
      maxSelect: 1,
      cascadeDelete: false,
    },
  ];
}

export const certificateStructuralMaxBytes = 10 * 1024 * 1024;
export const certificateReviewStatuses = ["pending", "approved", "rejected"];
export const certificateRejectionReasonMaxLength = 1000;

export function studentCertificateReviewFields(usersCollectionId) {
  return [
    {
      name: "reviewStatus",
      type: "select",
      required: false,
      maxSelect: 1,
      values: certificateReviewStatuses,
    },
    {
      name: "reviewedBy",
      type: "relation",
      required: false,
      collectionId: usersCollectionId,
      maxSelect: 1,
      cascadeDelete: false,
    },
    { name: "reviewedAt", type: "date", required: false },
    {
      name: "rejectionReason",
      type: "text",
      required: false,
      max: certificateRejectionReasonMaxLength,
    },
  ];
}

export function studentCertificateTimestampFields() {
  return [
    { name: "created", type: "autodate", onCreate: true, onUpdate: false },
    { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
  ];
}

export function planStudentCertificateReviewBackfill(records) {
  const invalid = [];
  const updates = [];
  let alreadyClassified = 0;
  for (const record of records) {
    const status = String(record.reviewStatus || "").trim();
    if (!status) {
      updates.push({ id: record.id, data: { reviewStatus: "pending" } });
    } else if (certificateReviewStatuses.includes(status)) {
      alreadyClassified += 1;
    } else {
      invalid.push({ id: record.id, reviewStatus: status });
    }
  }
  return {
    total: records.length,
    alreadyClassified,
    updates,
    invalid,
  };
}

export function studentCertificatesCollection(candidatesCollectionId, usersCollectionId) {
  return {
    name: "student_certificates",
    type: "base",
    ...collectionRulePatches.student_certificates,
    fields: [
      {
        name: "candidate",
        type: "relation",
        required: true,
        collectionId: candidatesCollectionId,
        maxSelect: 1,
        cascadeDelete: true,
      },
      {
        name: "certificate",
        type: "file",
        required: true,
        maxSelect: 1,
        maxSize: certificateStructuralMaxBytes,
        mimeTypes: ["application/pdf"],
        protected: true,
      },
      { name: "originalName", type: "text", required: true, max: 240 },
      { name: "sizeBytes", type: "number", required: true, min: 1, max: certificateStructuralMaxBytes, onlyInt: true },
      { name: "sha256", type: "text", required: true, min: 64, max: 64, pattern: "^[a-f0-9]{64}$" },
      {
        name: "uploadedBy",
        type: "relation",
        required: true,
        collectionId: usersCollectionId,
        maxSelect: 1,
        cascadeDelete: false,
      },
      ...studentCertificateReviewFields(usersCollectionId),
      ...studentCertificateTimestampFields(),
    ],
    indexes: [
      "CREATE UNIQUE INDEX idx_student_certificates_candidate ON student_certificates (candidate)",
      "CREATE INDEX idx_student_certificates_review_status ON student_certificates (reviewStatus)",
    ],
  };
}

export const batchSettings = {
  enabled: true,
  maxRequests: 11_000,
  timeout: 60,
  maxBodySize: 16 * 1024 * 1024,
};
