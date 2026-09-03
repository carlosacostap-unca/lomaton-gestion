export const juryServiceRule =
  '@request.auth.active = true && @request.auth.role = "lomaton_server"';

export const juryCriteria = [
  { key: "innovation", label: "Innovación y originalidad", weight: 25 },
  { key: "impact", label: "Impacto potencial", weight: 25 },
  { key: "viability", label: "Viabilidad técnica", weight: 20 },
  { key: "presentation", label: "Presentación y comunicación", weight: 15 },
  { key: "teamwork", label: "Trabajo en equipo", weight: 15 },
];

const timestamps = [
  { type: "autodate", name: "created", onCreate: true, onUpdate: false },
  { type: "autodate", name: "updated", onCreate: true, onUpdate: true },
];

export function jurorsCollection() {
  return {
    name: "jurors",
    type: "base",
    listRule: juryServiceRule,
    viewRule: juryServiceRule,
    createRule: juryServiceRule,
    updateRule: juryServiceRule,
    deleteRule: juryServiceRule,
    fields: [
      { type: "text", name: "fullName", required: true, max: 240 },
      { type: "email", name: "email", required: true },
      { type: "text", name: "emailNormalized", required: true, max: 254 },
      { type: "bool", name: "active" },
      ...timestamps,
    ],
    indexes: [
      "CREATE UNIQUE INDEX idx_jurors_email_normalized ON jurors (emailNormalized)",
    ],
  };
}

export function evaluationCyclesCollection(usersId) {
  return {
    name: "evaluation_cycles",
    type: "base",
    listRule: juryServiceRule,
    viewRule: juryServiceRule,
    createRule: juryServiceRule,
    updateRule: juryServiceRule,
    deleteRule: juryServiceRule,
    fields: [
      { type: "select", name: "status", required: true, maxSelect: 1, values: ["open", "cancelled", "published"] },
      { type: "text", name: "criteriaVersion", required: true, max: 40 },
      { type: "number", name: "jurorCount", onlyInt: true, min: 0 },
      { type: "number", name: "teamCount", onlyInt: true, min: 0 },
      { type: "number", name: "requiredCount", onlyInt: true, min: 0 },
      { type: "number", name: "finalizedCount", onlyInt: true, min: 0 },
      { type: "number", name: "version", onlyInt: true, min: 0 },
      { type: "relation", name: "openedBy", collectionId: usersId, maxSelect: 1, cascadeDelete: false },
      { type: "date", name: "openedAt" },
      { type: "relation", name: "cancelledBy", collectionId: usersId, maxSelect: 1, cascadeDelete: false },
      { type: "date", name: "cancelledAt" },
      { type: "text", name: "cancelReason", max: 1000 },
      { type: "relation", name: "publishedBy", collectionId: usersId, maxSelect: 1, cascadeDelete: false },
      { type: "date", name: "publishedAt" },
      ...timestamps,
    ],
    indexes: [
      "CREATE UNIQUE INDEX idx_evaluation_cycles_single_open ON evaluation_cycles (status) WHERE status = 'open'",
      "CREATE INDEX idx_evaluation_cycles_status_created ON evaluation_cycles (status, created)",
    ],
  };
}

export function juryEvaluationsCollection(cyclesId, jurorsId, teamsId) {
  const scoreFields = juryCriteria.map((criterion) => ({
    type: "number",
    name: "score" + criterion.key[0].toUpperCase() + criterion.key.slice(1),
    onlyInt: true,
    min: 0,
    max: 10,
  }));
  return {
    name: "jury_evaluations",
    type: "base",
    listRule: juryServiceRule,
    viewRule: juryServiceRule,
    createRule: juryServiceRule,
    updateRule: juryServiceRule,
    deleteRule: juryServiceRule,
    fields: [
      { type: "relation", name: "cycle", required: true, collectionId: cyclesId, maxSelect: 1, cascadeDelete: true },
      { type: "relation", name: "juror", required: true, collectionId: jurorsId, maxSelect: 1, cascadeDelete: false },
      { type: "relation", name: "team", required: true, collectionId: teamsId, maxSelect: 1, cascadeDelete: false },
      { type: "text", name: "jurorNameSnapshot", required: true, max: 240 },
      { type: "text", name: "teamNameSnapshot", required: true, max: 120 },
      { type: "select", name: "status", required: true, maxSelect: 1, values: ["pending", "draft", "finalized"] },
      { type: "select", name: "completedCriteria", maxSelect: 5, values: juryCriteria.map((criterion) => criterion.key) },
      ...scoreFields,
      { type: "number", name: "totalCentipoints", onlyInt: true, min: 0, max: 1000 },
      { type: "number", name: "version", onlyInt: true, min: 0 },
      { type: "date", name: "finalizedAt" },
      ...timestamps,
    ],
    indexes: [
      "CREATE UNIQUE INDEX idx_jury_evaluations_pair ON jury_evaluations (cycle, juror, team)",
      "CREATE INDEX idx_jury_evaluations_juror_status ON jury_evaluations (cycle, juror, status)",
      "CREATE INDEX idx_jury_evaluations_team_status ON jury_evaluations (cycle, team, status)",
    ],
  };
}

export function evaluationResultsCollection(cyclesId, teamsId) {
  return {
    name: "evaluation_results",
    type: "base",
    listRule: juryServiceRule,
    viewRule: juryServiceRule,
    createRule: juryServiceRule,
    updateRule: juryServiceRule,
    deleteRule: juryServiceRule,
    fields: [
      { type: "relation", name: "cycle", required: true, collectionId: cyclesId, maxSelect: 1, cascadeDelete: true },
      { type: "relation", name: "team", required: true, collectionId: teamsId, maxSelect: 1, cascadeDelete: false },
      { type: "text", name: "teamNameSnapshot", required: true, max: 120 },
      { type: "number", name: "jurorCount", required: true, onlyInt: true, min: 1 },
      { type: "number", name: "innovationSum", required: true, onlyInt: true, min: 0 },
      { type: "number", name: "impactSum", required: true, onlyInt: true, min: 0 },
      { type: "number", name: "viabilitySum", required: true, onlyInt: true, min: 0 },
      { type: "number", name: "presentationSum", required: true, onlyInt: true, min: 0 },
      { type: "number", name: "teamworkSum", required: true, onlyInt: true, min: 0 },
      { type: "number", name: "totalCentipointsSum", required: true, onlyInt: true, min: 0 },
      { type: "date", name: "publishedAt", required: true },
      ...timestamps,
    ],
    indexes: [
      "CREATE UNIQUE INDEX idx_evaluation_results_team ON evaluation_results (cycle, team)",
    ],
  };
}

export function juryUserField(jurorsId) {
  return {
    name: "juror",
    type: "relation",
    required: false,
    collectionId: jurorsId,
    maxSelect: 1,
    cascadeDelete: false,
  };
}
