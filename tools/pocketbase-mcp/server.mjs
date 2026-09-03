#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";

import {
  batchSettings,
  certificateReviewStatuses,
  candidateProjectionFields,
  collectionRulePatches,
  dataVersionField,
  expectedFields,
  mentorProfilesCollection,
  mentorInvitationsCollection,
  participantProfileFields,
  participantUserFields,
  planMentorInvitationCancellation,
  planStudentCertificateReviewBackfill,
  registrationsCollection,
  serviceAccountsCollection,
  studentCertificatesCollection,
  studentCertificateReviewFields,
  studentCertificateTimestampFields,
  teamMentorshipsCollection,
} from "./lomaton-schema.mjs";
import {
  evaluationCyclesCollection,
  evaluationResultsCollection,
  juryEvaluationsCollection,
  jurorsCollection,
  juryUserField,
} from "./jury-schema.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..", "..");

loadEnvFile(process.env.MCP_ENV_FILE || path.join(projectRoot, ".env.local"));

const PB_URL = normalizeUrl(
  process.env.POCKETBASE_URL ||
    process.env.NEXT_PUBLIC_POCKETBASE_URL ||
    "https://pb-lomaton.epixum.com",
);
const EXPECTED_HOST = process.env.POCKETBASE_EXPECTED_HOST || "pb-lomaton.epixum.com";
const ALLOW_WRITES = process.env.POCKETBASE_ALLOW_WRITES === "true";
const ALLOW_DELETES = process.env.POCKETBASE_ALLOW_DELETES === "true";

assertProductionTarget();

let authPromise = null;
let pbInstance = null;

const expectedCollections = Object.keys(expectedFields);

const tools = [
  tool("health", "Comprueba la disponibilidad del PocketBase de producción.", {}),
  tool("whoami", "Muestra el estado de autenticación sin revelar credenciales.", {}),
  tool("list_collections", "Lista las colecciones de PocketBase.", {}),
  tool("get_collection", "Obtiene una colección por nombre o id.", {
    collection: stringProperty("Nombre o id de la colección."),
  }, ["collection"]),
  tool("list_records", "Lista registros de una colección.", {
    collection: stringProperty("Nombre o id de la colección."),
    page: { type: "number", minimum: 1, default: 1 },
    perPage: { type: "number", minimum: 1, maximum: 200, default: 50 },
    sort: { type: "string" },
    filter: { type: "string" },
    expand: { type: "string" },
    fields: { type: "string" },
  }, ["collection"]),
  tool("get_record", "Obtiene un registro por id.", {
    collection: stringProperty("Nombre o id de la colección."),
    id: stringProperty("Id del registro."),
    expand: { type: "string" },
    fields: { type: "string" },
  }, ["collection", "id"]),
  tool("create_record", "Crea un registro. Requiere POCKETBASE_ALLOW_WRITES=true.", {
    collection: stringProperty("Nombre o id de la colección."),
    data: { type: "object", additionalProperties: true },
  }, ["collection", "data"]),
  tool("update_record", "Actualiza un registro. Requiere POCKETBASE_ALLOW_WRITES=true.", {
    collection: stringProperty("Nombre o id de la colección."),
    id: stringProperty("Id del registro."),
    data: { type: "object", additionalProperties: true },
  }, ["collection", "id", "data"]),
  tool("delete_record", "Elimina un registro. Requiere habilitar escrituras y eliminaciones.", {
    collection: stringProperty("Nombre o id de la colección."),
    id: stringProperty("Id del registro."),
  }, ["collection", "id"]),
  tool("create_collection", "Crea una colección. Requiere POCKETBASE_ALLOW_WRITES=true.", {
    schema: { type: "object", additionalProperties: true },
  }, ["schema"]),
  tool("update_collection", "Actualiza una colección. Requiere POCKETBASE_ALLOW_WRITES=true.", {
    collection: stringProperty("Nombre o id de la colección."),
    data: { type: "object", additionalProperties: true },
  }, ["collection", "data"]),
  tool("delete_collection", "Elimina una colección. Requiere habilitar escrituras y eliminaciones.", {
    collection: stringProperty("Nombre o id de la colección."),
  }, ["collection"]),
  tool("get_batch_settings", "Consulta solamente la configuración de API Batch.", {}),
  tool("update_batch_settings", "Actualiza solamente la configuración de API Batch. Requiere POCKETBASE_ALLOW_WRITES=true.", {
    enabled: { type: "boolean" },
    maxRequests: { type: "number", minimum: 1, maximum: 20000 },
    timeout: { type: "number", minimum: 1, maximum: 300 },
    maxBodySize: { type: "number", minimum: 0 },
  }),
  tool("apply_lomaton_schema", "Aplica de forma idempotente el esquema, reglas y Batch API de Lomatón sin eliminar colecciones, campos ni registros. Requiere POCKETBASE_ALLOW_WRITES=true.", {}),
  tool("backfill_student_certificate_reviews", "Clasifica como pending solamente certificados existentes sin estado de revisión y verifica que archivo y metadatos permanezcan intactos. Requiere POCKETBASE_ALLOW_WRITES=true.", {}),
  tool("backfill_participant_profiles", "Vincula usuarios con inscripciones vigentes e inicializa metadatos de autogestión de forma idempotente. Requiere POCKETBASE_ALLOW_WRITES=true.", {}),
  tool("ensure_service_account", "Crea o sincroniza la cuenta técnica usando POCKETBASE_SERVICE_EMAIL y POCKETBASE_SERVICE_PASSWORD, sin devolver el secreto. Requiere POCKETBASE_ALLOW_WRITES=true.", {}),
  tool("validate_hackathon_schema", "Compara las colecciones existentes con el esquema esperado de Lomatón.", {}),
];

const handlers = {
  async health() {
    const response = await fetch(`${PB_URL}/api/health`, { signal: AbortSignal.timeout(10_000) });
    return {
      url: PB_URL,
      expectedHost: EXPECTED_HOST,
      productionOnly: true,
      writesEnabled: ALLOW_WRITES,
      deletesEnabled: ALLOW_DELETES,
      ok: response.ok,
      status: response.status,
      body: await response.json().catch(() => ({})),
    };
  },

  async whoami() {
    const pb = await authenticate();
    return {
      url: PB_URL,
      expectedHost: EXPECTED_HOST,
      isValid: pb.authStore.isValid,
      tokenPresent: Boolean(pb.authStore.token),
      model: sanitizeAuthModel(pb.authStore.model),
    };
  },

  async list_collections() {
    return (await authenticate()).collections.getFullList({ sort: "name" });
  },

  async get_collection(args) {
    requireString(args, "collection");
    return (await authenticate()).collections.getOne(args.collection);
  },

  async list_records(args) {
    requireString(args, "collection");
    const options = pick(args, ["sort", "filter", "expand", "fields"]);
    return (await authenticate())
      .collection(args.collection)
      .getList(numberOrDefault(args.page, 1), numberOrDefault(args.perPage, 50), options);
  },

  async get_record(args) {
    requireString(args, "collection");
    requireString(args, "id");
    return (await authenticate())
      .collection(args.collection)
      .getOne(args.id, pick(args, ["expand", "fields"]));
  },

  async create_record(args) {
    requireWrites();
    requireString(args, "collection");
    requireObject(args, "data");
    return (await authenticate()).collection(args.collection).create(args.data);
  },

  async update_record(args) {
    requireWrites();
    requireString(args, "collection");
    requireString(args, "id");
    requireObject(args, "data");
    return (await authenticate()).collection(args.collection).update(args.id, args.data);
  },

  async delete_record(args) {
    requireDeletes();
    requireString(args, "collection");
    requireString(args, "id");
    await (await authenticate()).collection(args.collection).delete(args.id);
    return { deleted: true, collection: args.collection, id: args.id };
  },

  async create_collection(args) {
    requireWrites();
    requireObject(args, "schema");
    return (await authenticate()).collections.create(args.schema);
  },

  async update_collection(args) {
    requireWrites();
    requireString(args, "collection");
    requireObject(args, "data");
    return (await authenticate()).collections.update(args.collection, args.data);
  },

  async delete_collection(args) {
    requireDeletes();
    requireString(args, "collection");
    await (await authenticate()).collections.delete(args.collection);
    return { deleted: true, collection: args.collection };
  },

  async get_batch_settings() {
    const settings = await (await authenticate()).settings.getAll();
    return { batch: settings.batch || null };
  },

  async update_batch_settings(args) {
    requireWrites();
    const pb = await authenticate();
    const current = await pb.settings.getAll();
    const next = { ...current.batch, ...pick(args, ["enabled", "maxRequests", "timeout", "maxBodySize"]) };
    const updated = await pb.settings.update({ batch: next });
    return { batch: updated.batch };
  },

  async apply_lomaton_schema() {
    requireWrites();
    const pb = await authenticate();
    let collections = await pb.collections.getFullList({ sort: "name" });
    const byName = new Map(collections.map((collection) => [collection.name, collection]));
    const actions = [];

    if (!byName.has("service_accounts")) {
      const created = await pb.collections.create(serviceAccountsCollection);
      byName.set(created.name, created);
      actions.push("created:service_accounts");
    }

    if (!byName.has("jurors")) {
      const created = await pb.collections.create(jurorsCollection());
      byName.set(created.name, created);
      actions.push("created:jurors");
    }

    if (!byName.has("registrations")) {
      const importBatches = byName.get("import_batches");
      if (!importBatches) {
        throw rpcError(-32020, "Falta import_batches antes de crear registrations.");
      }
      const created = await pb.collections.create(registrationsCollection(importBatches.id));
      byName.set(created.name, created);
      actions.push("created:registrations");
    }

    if (!byName.has("mentor_profiles")) {
      const registrations = byName.get("registrations");
      const created = await pb.collections.create(mentorProfilesCollection(registrations.id));
      byName.set(created.name, created);
      actions.push("created:mentor_profiles");
    }

    if (!byName.has("student_certificates")) {
      const candidatesCollection = byName.get("candidates");
      const usersCollection = byName.get("users");
      if (!candidatesCollection || !usersCollection) {
        throw rpcError(-32020, "Faltan candidates o users antes de crear student_certificates.");
      }
      const created = await pb.collections.create(
        studentCertificatesCollection(candidatesCollection.id, usersCollection.id),
      );
      byName.set(created.name, created);
      actions.push("created:student_certificates");
    }

    const registrationsForProfiles = byName.get("registrations");
    const usersForProfiles = byName.get("users");
    if (!registrationsForProfiles || !usersForProfiles) {
      throw rpcError(-32020, "Faltan registrations o users para configurar los perfiles.");
    }
    const registrationFields = [...(registrationsForProfiles.fields || [])];
    let registrationsChanged = false;
    for (const field of participantProfileFields()) {
      if (!registrationFields.some((current) => current.name === field.name)) {
        registrationFields.push(field);
        registrationsChanged = true;
      }
    }
    if (registrationsChanged) {
      const updated = await pb.collections.update(registrationsForProfiles.id, { fields: registrationFields });
      byName.set("registrations", updated);
      actions.push("updated:participant_profile_fields");
    }

    const userFields = [...(usersForProfiles.fields || [])];
    let usersChanged = false;
    for (const field of participantUserFields(registrationsForProfiles.id)) {
      if (!userFields.some((current) => current.name === field.name)) {
        userFields.push(field);
        usersChanged = true;
      }
    }
    const jurorsForUsers = byName.get("jurors");
    if (!jurorsForUsers) throw rpcError(-32020, "Falta jurors para configurar usuarios.");
    const jurorField = juryUserField(jurorsForUsers.id);
    if (!userFields.some((current) => current.name === jurorField.name)) {
      userFields.push(jurorField);
      usersChanged = true;
    }
    const userIndexes = [...(usersForProfiles.indexes || [])];
    if (!userIndexes.some((index) => index.includes("idx_users_registration"))) {
      userIndexes.push("CREATE UNIQUE INDEX idx_users_registration ON users (registration) WHERE registration != ''");
      usersChanged = true;
    }
    if (!userIndexes.some((index) => index.includes("idx_users_juror"))) {
      userIndexes.push("CREATE UNIQUE INDEX idx_users_juror ON users (juror) WHERE juror != ''");
      usersChanged = true;
    }
    if (usersChanged) {
      const updated = await pb.collections.update(usersForProfiles.id, { fields: userFields, indexes: userIndexes });
      byName.set("users", updated);
      actions.push("updated:users_registration");
    }

    const usersForEvaluation = byName.get("users");
    const teamsForEvaluation = byName.get("teams");
    if (!usersForEvaluation || !teamsForEvaluation) {
      throw rpcError(-32020, "Faltan users o teams para configurar evaluaciones.");
    }
    if (!byName.has("evaluation_cycles")) {
      const created = await pb.collections.create(evaluationCyclesCollection(usersForEvaluation.id));
      byName.set(created.name, created);
      actions.push("created:evaluation_cycles");
    }
    if (!byName.has("jury_evaluations")) {
      const created = await pb.collections.create(juryEvaluationsCollection(
        byName.get("evaluation_cycles").id,
        jurorsForUsers.id,
        teamsForEvaluation.id,
      ));
      byName.set(created.name, created);
      actions.push("created:jury_evaluations");
    }
    if (!byName.has("evaluation_results")) {
      const created = await pb.collections.create(evaluationResultsCollection(
        byName.get("evaluation_cycles").id,
        teamsForEvaluation.id,
      ));
      byName.set(created.name, created);
      actions.push("created:evaluation_results");
    }

    if (!byName.has("mentor_invitations")) {
      const teams = byName.get("teams");
      const mentors = byName.get("mentor_profiles");
      if (!teams || !mentors) throw rpcError(-32020, "Faltan teams o mentor_profiles para crear mentor_invitations.");
      const created = await pb.collections.create(mentorInvitationsCollection(teams.id, mentors.id, usersForProfiles.id));
      byName.set(created.name, created);
      actions.push("created:mentor_invitations");
    }

    if (!byName.has("team_mentorships")) {
      const teams = byName.get("teams");
      const mentors = byName.get("mentor_profiles");
      if (!teams || !mentors) throw rpcError(-32020, "Faltan teams o mentor_profiles para crear team_mentorships.");
      const created = await pb.collections.create(teamMentorshipsCollection(teams.id, mentors.id));
      byName.set(created.name, created);
      actions.push("created:team_mentorships");
    }

    const mentorships = byName.get("team_mentorships");
    if (mentorships) {
      const indexes = (mentorships.indexes || []).filter(
        (index) => !index.includes("idx_team_mentorships_mentor"),
      );
      if (!indexes.some((index) => index.includes("idx_team_mentorships_mentor_lookup"))) {
        indexes.push("CREATE INDEX idx_team_mentorships_mentor_lookup ON team_mentorships (mentor)");
      }
      if (JSON.stringify(indexes) !== JSON.stringify(mentorships.indexes || [])) {
        const updated = await pb.collections.update(mentorships.id, { indexes });
        byName.set("team_mentorships", updated);
        actions.push("updated:team_mentorships_unlimited_mentor_capacity");
      }
    }

    const pendingMentorInvitations = await pb.collection("mentor_invitations").getFullList({
      filter: "status = 'pending'",
    });
    const cancelledMentorInvitations = planMentorInvitationCancellation(
      pendingMentorInvitations,
      new Date().toISOString(),
    );
    if (cancelledMentorInvitations.length) {
      const batch = pb.createBatch();
      for (const update of cancelledMentorInvitations) {
        batch.collection("mentor_invitations").update(update.id, update.data);
      }
      await batch.send();
      actions.push(`cancelled:mentor_invitations:${cancelledMentorInvitations.length}`);
    }

    const certificates = byName.get("student_certificates");
    const certificateUsers = byName.get("users");
    if (!certificates || !certificateUsers) {
      throw rpcError(-32020, "Faltan student_certificates o users para configurar la revisión documental.");
    }
    const certificateFields = [...(certificates.fields || [])];
    let certificateSchemaChanged = false;
    for (const field of [
      ...studentCertificateReviewFields(certificateUsers.id),
      ...studentCertificateTimestampFields(),
    ]) {
      if (!certificateFields.some((current) => current.name === field.name)) {
        certificateFields.push(field);
        certificateSchemaChanged = true;
      }
    }
    const certificateIndexes = [...(certificates.indexes || [])];
    if (!certificateIndexes.some((index) => index.includes("idx_student_certificates_review_status"))) {
      certificateIndexes.push(
        "CREATE INDEX idx_student_certificates_review_status ON student_certificates (reviewStatus)",
      );
      certificateSchemaChanged = true;
    }
    if (certificateSchemaChanged) {
      const updated = await pb.collections.update(certificates.id, {
        fields: certificateFields,
        indexes: certificateIndexes,
      });
      byName.set("student_certificates", updated);
      actions.push("updated:student_certificate_reviews");
    }

    const candidates = byName.get("candidates");
    const registrations = byName.get("registrations");
    if (!candidates || !registrations) {
      throw rpcError(-32020, "Faltan candidates o registrations para crear la proyección.");
    }
    const candidateFields = candidates.fields.map((field) =>
      ["firstName", "lastName"].includes(field.name)
        ? { ...field, required: false }
        : field
    );
    for (const field of candidateProjectionFields(registrations.id)) {
      if (!candidateFields.some((current) => current.name === field.name)) {
        candidateFields.push(field);
      }
    }
    const candidateIndexes = [...(candidates.indexes || [])];
    if (!candidateIndexes.some((index) => index.includes("idx_candidates_registration"))) {
      candidateIndexes.push(
        "CREATE UNIQUE INDEX idx_candidates_registration ON candidates (registration) WHERE registration != ''",
      );
    }
    const updatedCandidates = await pb.collections.update(candidates.id, {
      fields: candidateFields,
      indexes: candidateIndexes,
    });
    byName.set("candidates", updatedCandidates);
    actions.push("updated:candidates_projection");

    for (const [name, rules] of Object.entries(collectionRulePatches)) {
      const current = byName.get(name);
      if (!current) throw rpcError(-32020, `Falta la colección requerida antes de aplicar reglas: ${name}`);
      const patch = { ...rules };
      if (name === "hackathon_settings") {
        const hasDataVersion = current.fields?.some((field) => field.name === "dataVersion");
        if (!hasDataVersion) patch.fields = [...current.fields, dataVersionField];
      }
      await pb.collections.update(current.id, patch);
      actions.push(`updated:${name}`);
    }

    const currentSettings = await pb.settings.getAll();
    await pb.settings.update({ batch: { ...currentSettings.batch, ...batchSettings } });
    actions.push("updated:batch_settings");

    return { actions, ...(await validateSchema(pb)) };
  },

  async backfill_student_certificate_reviews() {
    requireWrites();
    const pb = await authenticate();
    const fields = "id,reviewStatus,certificate,sha256,originalName,sizeBytes";
    const before = await pb.collection("student_certificates").getFullList({ fields, sort: "id" });
    const plan = planStudentCertificateReviewBackfill(before);
    if (plan.invalid.length) {
      throw rpcError(-32022, "Hay certificados con estados de revisión inválidos.", {
        invalid: plan.invalid,
      });
    }

    for (let offset = 0; offset < plan.updates.length; offset += 1000) {
      const batch = pb.createBatch();
      for (const update of plan.updates.slice(offset, offset + 1000)) {
        batch.collection("student_certificates").update(update.id, update.data);
      }
      await batch.send();
    }

    const after = await pb.collection("student_certificates").getFullList({ fields, sort: "id" });
    const beforeById = new Map(before.map((record) => [record.id, record]));
    const preserved = after.every((record) => {
      const previous = beforeById.get(record.id);
      return previous && ["certificate", "sha256", "originalName", "sizeBytes"]
        .every((key) => String(previous[key] ?? "") === String(record[key] ?? ""));
    });
    const remaining = after.filter(
      (record) => !certificateReviewStatuses.includes(String(record.reviewStatus || "")),
    );
    if (!preserved || remaining.length) {
      throw rpcError(-32023, "El backfill de revisiones no superó la verificación posterior.", {
        preserved,
        remaining: remaining.map((record) => record.id),
      });
    }
    return {
      total: plan.total,
      updated: plan.updates.length,
      alreadyClassified: plan.alreadyClassified,
      preserved,
      remaining: remaining.length,
    };
  },

  async backfill_participant_profiles() {
    requireWrites();
    const pb = await authenticate();
    const [registrations, users, candidates, mentors] = await Promise.all([
      pb.collection("registrations").getFullList({ sort: "id" }),
      pb.collection("users").getFullList({ sort: "id" }),
      pb.collection("candidates").getFullList({ sort: "id" }),
      pb.collection("mentor_profiles").getFullList({ sort: "id" }),
    ]);
    const registrationByEmail = new Map(registrations.map((record) => [String(record.emailNormalized || "").toLowerCase(), record]));
    const candidateByRegistration = new Map(candidates.filter((record) => record.registration && record.active).map((record) => [String(record.registration), record]));
    const candidateByEmail = new Map(candidates.filter((record) => record.active).map((record) => [String(record.emailNormalized || "").toLowerCase(), record]));
    const mentorByRegistration = new Map(mentors.filter((record) => record.active).map((record) => [String(record.registration), record]));
    const updates = [];

    for (const registration of registrations) {
      const data = {};
      if (!Number.isInteger(registration.profileVersion) || Number(registration.profileVersion) < 0) data.profileVersion = 0;
      if (!Array.isArray(registration.selfManagedFields)) data.selfManagedFields = [];
      if (Object.keys(data).length) updates.push({ collection: "registrations", id: registration.id, data });
    }
    for (const user of users) {
      const email = String(user.email || "").trim().toLowerCase();
      const registration = registrationByEmail.get(email);
      let registrationId = "";
      let candidateId = "";
      if (registration?.relationship === "teacher" && mentorByRegistration.has(registration.id)) {
        registrationId = registration.id;
      } else if (registration && registration.relationship !== "teacher") {
        const candidate = candidateByRegistration.get(registration.id) || candidateByEmail.get(email);
        if (candidate) {
          registrationId = registration.id;
          candidateId = candidate.id;
        }
      }
      if (String(user.registration || "") !== registrationId || String(user.candidate || "") !== candidateId) {
        updates.push({ collection: "users", id: user.id, data: { registration: registrationId, candidate: candidateId } });
      }
    }

    for (let offset = 0; offset < updates.length; offset += 1000) {
      const batch = pb.createBatch();
      for (const update of updates.slice(offset, offset + 1000)) batch.collection(update.collection).update(update.id, update.data);
      await batch.send();
    }
    return { registrations: registrations.length, users: users.length, updated: updates.length, idempotentWhenUpdatedIsZero: true };
  },

  async ensure_service_account() {
    requireWrites();
    const email = process.env.POCKETBASE_SERVICE_EMAIL?.trim().toLowerCase();
    const password = process.env.POCKETBASE_SERVICE_PASSWORD;
    if (!email || !password || password.length < 12) {
      throw rpcError(
        -32021,
        "Configura POCKETBASE_SERVICE_EMAIL y POCKETBASE_SERVICE_PASSWORD (mínimo 12 caracteres) en el archivo de entorno del MCP.",
      );
    }

    const pb = await authenticate();
    const collection = pb.collection("service_accounts");
    const filter = pb.filter("email = {:email}", { email });
    let existing = null;
    try {
      existing = await collection.getFirstListItem(filter);
    } catch (error) {
      if (error?.status !== 404) throw error;
    }

    const data = {
      email,
      emailVisibility: false,
      verified: true,
      active: true,
      role: "lomaton_server",
      password,
      passwordConfirm: password,
    };
    const record = existing
      ? await collection.update(existing.id, data)
      : await collection.create(data);

    return {
      created: !existing,
      id: record.id,
      email: record.email,
      verified: record.verified,
      active: record.active,
      role: record.role,
    };
  },

  async validate_hackathon_schema() {
    return validateSchema(await authenticate());
  },
};

const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: false });

rl.on("line", async (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;

  let message;
  try {
    message = JSON.parse(trimmed);
  } catch (error) {
    write({ jsonrpc: "2.0", id: null, error: { code: -32700, message: `Parse error: ${error.message}` } });
    return;
  }

  if (message.method?.startsWith("notifications/")) return;

  try {
    write({ jsonrpc: "2.0", id: message.id, result: await dispatch(message) });
  } catch (error) {
    write({
      jsonrpc: "2.0",
      id: message.id ?? null,
      error: { code: error.code || -32603, message: error.message || "Internal error", data: error.data },
    });
  }
});

async function dispatch(message) {
  switch (message.method) {
    case "initialize":
      return {
        protocolVersion: message.params?.protocolVersion || "2024-11-05",
        capabilities: { tools: {}, resources: {} },
        serverInfo: { name: "pocketbase-lomaton-production", version: "0.1.0" },
      };
    case "ping":
      return {};
    case "tools/list":
      return { tools };
    case "tools/call": {
      const handler = handlers[message.params?.name];
      if (!handler) throw rpcError(-32601, `Unknown tool: ${message.params?.name}`);
      return toToolResult(await handler(message.params?.arguments || {}));
    }
    case "resources/list":
      return {
        resources: [{
          uri: "pocketbase://lomaton-production/connection",
          name: "PocketBase Lomatón production connection",
          description: "URL, protecciones y estado de autenticación saneado.",
          mimeType: "application/json",
        }],
      };
    case "resources/read":
      if (message.params?.uri !== "pocketbase://lomaton-production/connection") {
        throw rpcError(-32602, `Unknown resource: ${message.params?.uri}`);
      }
      return {
        contents: [{
          uri: "pocketbase://lomaton-production/connection",
          mimeType: "application/json",
          text: JSON.stringify(await handlers.whoami(), null, 2),
        }],
      };
    default:
      throw rpcError(-32601, `Unknown method: ${message.method}`);
  }
}

async function authenticate() {
  const pb = await getPocketBase();
  if (!authPromise) {
    authPromise = (async () => {
      const token = process.env.POCKETBASE_SUPERUSER_TOKEN || process.env.POCKETBASE_ADMIN_TOKEN;
      if (token) {
        pb.authStore.save(token, null);
        return pb;
      }

      const identity = process.env.POCKETBASE_SUPERUSER_EMAIL || process.env.POCKETBASE_ADMIN_EMAIL;
      const password = process.env.POCKETBASE_SUPERUSER_PASSWORD || process.env.POCKETBASE_ADMIN_PASSWORD;
      if (identity && password) {
        await pb.collection("_superusers").authWithPassword(identity, password);
      }
      return pb;
    })().catch((error) => {
      authPromise = null;
      throw error;
    });
  }
  await authPromise;
  return pb;
}

async function validateSchema(pb) {
  const collections = await pb.collections.getFullList({ sort: "name" });
  const byName = new Map(collections.map((collection) => [collection.name, collection]));
  const missing = expectedCollections.filter((name) => !byName.has(name));
  const missingFields = {};

  for (const [name, fields] of Object.entries(expectedFields)) {
    const collection = byName.get(name);
    if (!collection) continue;
    const presentFields = new Set(collection.fields?.map((field) => field.name));
    const absent = fields.filter((field) => !presentFields.has(field));
    if (absent.length) missingFields[name] = absent;
  }

  return {
    ok: missing.length === 0 && Object.keys(missingFields).length === 0,
    required: expectedCollections,
    present: expectedCollections.filter((name) => byName.has(name)),
    missing,
    missingFields,
  };
}

async function getPocketBase() {
  if (pbInstance) return pbInstance;
  const { default: PocketBase } = await import("pocketbase");
  pbInstance = new PocketBase(PB_URL);
  pbInstance.autoCancellation(false);
  return pbInstance;
}

function assertProductionTarget() {
  const url = new URL(PB_URL);
  if (url.protocol !== "https:" || url.hostname !== EXPECTED_HOST) {
    throw new Error(`Destino PocketBase rechazado: se esperaba https://${EXPECTED_HOST} y se recibió ${PB_URL}`);
  }
}

function requireWrites() {
  if (!ALLOW_WRITES) {
    throw rpcError(-32010, "Escrituras bloqueadas. Configura POCKETBASE_ALLOW_WRITES=true de forma explícita.");
  }
}

function requireDeletes() {
  if (!ALLOW_WRITES || !ALLOW_DELETES) {
    throw rpcError(-32011, "Eliminaciones bloqueadas. Deben habilitarse escrituras y eliminaciones explícitamente.");
  }
}

function tool(name, description, properties, required = []) {
  return {
    name,
    description,
    inputSchema: { type: "object", properties, required, additionalProperties: false },
  };
}

function stringProperty(description) {
  return { type: "string", description };
}

function loadEnvFile(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator < 1) continue;
    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

function normalizeUrl(value) {
  return String(value || "").trim().replace(/\/$/, "");
}

function pick(source, keys) {
  return keys.reduce((result, key) => {
    if (source?.[key] !== undefined && source[key] !== "") result[key] = source[key];
    return result;
  }, {});
}

function numberOrDefault(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function requireString(args, key) {
  if (typeof args?.[key] !== "string" || !args[key].trim()) {
    throw rpcError(-32602, `Missing required string argument: ${key}`);
  }
}

function requireObject(args, key) {
  if (!args?.[key] || typeof args[key] !== "object" || Array.isArray(args[key])) {
    throw rpcError(-32602, `Missing required object argument: ${key}`);
  }
}

function sanitizeAuthModel(model) {
  if (!model) return null;
  const safe = { ...model };
  delete safe.password;
  delete safe.tokenKey;
  delete safe.token;
  return safe;
}

function toToolResult(value) {
  return { content: [{ type: "text", text: JSON.stringify(value, null, 2) }] };
}

function rpcError(code, message, data) {
  const error = new Error(message);
  error.code = code;
  error.data = data;
  return error;
}

function write(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}
