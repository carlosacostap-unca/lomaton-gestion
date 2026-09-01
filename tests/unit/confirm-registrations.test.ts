// @vitest-environment node

import type PocketBase from "pocketbase";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { confirmRegistrationImport } from "@/lib/import/confirm-registrations";
import { parseRegistrationFile } from "@/lib/import/registrations";
import type { LomatonUser } from "@/lib/pocketbase/server";
import { registrationCsv, registrationRow } from "@/tests/fixtures/registration-form";

type Seed = Record<string, Array<Record<string, unknown> & { id: string }>>;
type BatchOperation = {
  collection: string;
  method: "create" | "update" | "delete";
  id?: string;
  data?: Record<string, unknown>;
  options?: unknown;
};

function fakePocketBase(seed: Seed = {}) {
  const operations: BatchOperation[] = [];
  const send = vi.fn(async () => undefined);
  const collection = (name: string) => ({
    getFullList: vi.fn(async () => seed[name] ?? []),
    getFirstListItem: vi.fn(async () => (seed[name] ?? [])[0]),
  });
  const batchCollection = (name: string) => ({
    create: (data: Record<string, unknown>) => operations.push({ collection: name, method: "create", data }),
    update: (id: string, data: Record<string, unknown>, options?: unknown) => operations.push({ collection: name, method: "update", id, data, options }),
    delete: (id: string) => operations.push({ collection: name, method: "delete", id }),
  });
  const pb = {
    collection,
    filter: (value: string) => value,
    createBatch: () => ({ collection: batchCollection, send }),
  } as unknown as PocketBase;
  return { pb, operations, send };
}

const admin = {
  id: "admin0000000001",
  email: "admin@example.test",
  verified: true,
  enabled: true,
  isAdmin: true,
} as LomatonUser;

async function validRows() {
  const csv = registrationCsv([
    registrationRow(),
    registrationRow({
      fullName: "Docente de Prueba",
      dni: "30111223",
      email: "docente@example.test",
      relationship: "Docente",
      department: "Departamento Informática",
      mentorInterest: "Sí, me interesa participar como mentor/a.",
      ftcaCareer: "",
      ftcaTeamStatus: "",
      ftcaTerms: "",
      ftcaMedia: "",
    }),
  ]);
  const preview = await parseRegistrationFile(
    new TextEncoder().encode(csv),
    "respuestas.csv",
    { maxBytes: 100_000, maxRows: 10 },
  );
  expect(preview.summary.review).toBe(0);
  return preview.valid;
}

function input(rows: Awaited<ReturnType<typeof validRows>>) {
  return {
    fileName: "respuestas.csv",
    fileType: "csv" as const,
    digest: "a".repeat(64),
    reason: "prueba",
    rows,
    invalidRows: 0,
    reviewRows: 0,
    ignoredDuplicateRows: 0,
  };
}

describe("registration confirmation transaction", () => {
  it("creates private registrations and separate candidate/mentor projections in one batch", async () => {
    const rows = await validRows();
    const { pb, operations, send } = fakePocketBase({
      hackathon_settings: [{ id: "settings0000001", key: "default" }],
    });

    const result = await confirmRegistrationImport(pb, admin, input(rows));

    expect(send).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ candidatesCreated: 1, mentorsCreated: 1, total: 2 });
    expect(operations.filter((operation) => operation.collection === "registrations" && operation.method === "create")).toHaveLength(2);
    expect(operations.filter((operation) => operation.collection === "candidates" && operation.method === "create")).toHaveLength(1);
    expect(operations.filter((operation) => operation.collection === "mentor_profiles" && operation.method === "create")).toHaveLength(1);
    expect(operations).toEqual(expect.arrayContaining([
      expect.objectContaining({ collection: "import_batches", method: "create" }),
      expect.objectContaining({ collection: "audit_logs", method: "create" }),
      expect.objectContaining({ collection: "hackathon_settings", method: "update" }),
    ]));
  });

  it("recalculates an existing team when the administrator confirms FTCA status", async () => {
    const [row] = await validRows();
    const { pb, operations, send } = fakePocketBase({
      registrations: [{
        id: "registration001",
        emailNormalized: row.emailNormalized,
        dniNormalized: row.dniNormalized,
        ftcaStatus: "pending",
      }],
      candidates: [{
        id: "candidate000001",
        registration: "registration001",
        emailNormalized: row.emailNormalized,
        ftcaStatus: "pending",
        active: true,
      }],
      team_memberships: [{ id: "membership0001", candidate: "candidate000001", team: "team0000000001" }],
      teams: [{ id: "team0000000001", memberCount: 1, ftcaConfirmedCount: 0, status: "invalid" }],
      hackathon_settings: [{ id: "settings0000001", key: "default" }],
    });

    await confirmRegistrationImport(pb, admin, input([{ ...row, ftcaStatus: "confirmed" }]));

    expect(send).toHaveBeenCalledTimes(1);
    expect(operations).toEqual(expect.arrayContaining([
      expect.objectContaining({ collection: "candidates", method: "update", id: "candidate000001" }),
      expect.objectContaining({
        collection: "teams",
        method: "update",
        id: "team0000000001",
        options: { query: { expected_member_count: 1 } },
      }),
    ]));
  });

  it("aborts the batch when email and DNI point to different people", async () => {
    const [row] = await validRows();
    const { pb, send } = fakePocketBase({
      registrations: [
        { id: "registration001", emailNormalized: row.emailNormalized, dniNormalized: "99999999" },
        { id: "registration002", emailNormalized: "otra@example.test", dniNormalized: row.dniNormalized },
      ],
      hackathon_settings: [{ id: "settings0000001", key: "default" }],
    });

    await expect(confirmRegistrationImport(pb, admin, input([row]))).rejects.toMatchObject({
      status: 409,
      code: "registration_identity_conflict",
    });
    expect(send).not.toHaveBeenCalled();
  });
});
