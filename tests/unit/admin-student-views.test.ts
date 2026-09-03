// @vitest-environment node

import type PocketBase from "pocketbase";
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

type Item = Record<string, unknown> & { id: string };
type Views = typeof import("@/lib/domain/admin-student-views");
let listAdminStudents: Views["listAdminStudents"];

beforeAll(async () => {
  ({ listAdminStudents } = await import("@/lib/domain/admin-student-views"));
});

function fakePocketBase(seed: Record<string, Item[]>) {
  return {
    collection: (name: string) => ({
      getFullList: async () => seed[name] ?? [],
    }),
  } as unknown as PocketBase;
}

const seed: Record<string, Item[]> = {
  registrations: [
    { id: "registration1", fullName: "Ada Aprobada", relationship: "student_ftca", academicUnit: "" },
    { id: "registration2", fullName: "Bea Pendiente", relationship: "student_external", academicUnit: "FACEN" },
    { id: "registration3", fullName: "Carla Rechazada", relationship: "student_external", academicUnit: "" },
    { id: "registration4", fullName: "Dora Sin Certificado", relationship: "student_ftca", academicUnit: "" },
    { id: "registration5", fullName: "Docente Excluido", relationship: "teacher", academicUnit: "FTyCA" },
  ],
  candidates: [
    { id: "candidate1", registration: "registration1" },
    { id: "candidate2", registration: "registration2" },
    { id: "candidate3", registration: "registration3" },
  ],
  student_certificates: [
    { id: "certificate1", candidate: "candidate1", reviewStatus: "approved", certificate: "private.pdf", sha256: "secret" },
    { id: "certificate2", candidate: "candidate2", reviewStatus: "" },
    { id: "certificate3", candidate: "candidate3", reviewStatus: "rejected" },
  ],
  team_memberships: [{ id: "membership1", candidate: "candidate1", team: "team1" }],
  teams: [{ id: "team1", name: "Analíticas" }],
  team_invitations: [
    { id: "invite1", candidate: "candidate2", team: "team1", status: "pending" },
    { id: "invite2", candidate: "candidate2", team: "missing", status: "pending" },
    { id: "invite3", candidate: "candidate3", team: "team1", status: "accepted" },
  ],
};

describe("administrative student projection", () => {
  it("starts from student registrations, excludes teachers and derives faculty safely", async () => {
    const result = await listAdminStudents(fakePocketBase(seed));

    expect(result.students.map((student) => student.name)).toEqual([
      "Ada Aprobada",
      "Bea Pendiente",
      "Carla Rechazada",
      "Dora Sin Certificado",
    ]);
    expect(result.students.map((student) => student.faculty)).toEqual([
      "FTyCA",
      "FACEN",
      "No informada",
      "FTyCA",
    ]);
  });

  it("exposes the four document states and only accepted memberships or pending invitations", async () => {
    const result = await listAdminStudents(fakePocketBase(seed));

    expect(result.students.map((student) => student.certificateStatus)).toEqual([
      "approved",
      "pending",
      "rejected",
      "not_presented",
    ]);
    expect(result.students[0].team).toEqual({ id: "team1", name: "Analíticas" });
    expect(result.students[1].pendingInvitations).toEqual([
      { id: "invite1", teamId: "team1", teamName: "Analíticas" },
      { id: "invite2", teamId: "missing", teamName: "Equipo no disponible" },
    ]);
    expect(result.students[2].pendingInvitations).toEqual([]);
    expect(result.students[3]).toMatchObject({ candidateId: "", team: null, pendingInvitations: [] });
  });

  it("does not expose certificate files, personal contact data or storage metadata", async () => {
    const result = await listAdminStudents(fakePocketBase(seed));
    const json = JSON.stringify(result);

    expect(json).not.toContain("private.pdf");
    expect(result.students[0]).not.toHaveProperty("dni");
    expect(result.students[0]).not.toHaveProperty("phone");
    expect(result.students[0]).not.toHaveProperty("email");
    expect(result.students[0]).not.toHaveProperty("sha256");
  });
});
