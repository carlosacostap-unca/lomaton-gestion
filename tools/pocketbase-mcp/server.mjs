#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";

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

let authAttempted = false;
let pbInstance = null;

const expectedCollections = [
  "users",
  "candidates",
  "teams",
  "team_memberships",
  "team_invitations",
  "hackathon_settings",
  "import_batches",
  "audit_logs",
];

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

  async validate_hackathon_schema() {
    const collections = await (await authenticate()).collections.getFullList({ sort: "name" });
    const names = new Set(collections.map((collection) => collection.name));
    const missing = expectedCollections.filter((name) => !names.has(name));
    return {
      ok: missing.length === 0,
      required: expectedCollections,
      present: expectedCollections.filter((name) => names.has(name)),
      missing,
    };
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
  if (authAttempted) return pb;
  authAttempted = true;

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
