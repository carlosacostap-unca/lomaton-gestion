// @vitest-environment node

import type PocketBase from "pocketbase";
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

type Item = Record<string, unknown> & { id: string };
type Views = typeof import("@/lib/domain/admin-teacher-views");
let listAdminTeachers: Views["listAdminTeachers"];

beforeAll(async () => {
  ({ listAdminTeachers } = await import("@/lib/domain/admin-teacher-views"));
});

function fakePocketBase(seed: Record<string, Item[]>) {
  return {
    collection: (name: string) => ({ getFullList: async () => seed[name] ?? [] }),
  } as unknown as PocketBase;
}

const seed: Record<string, Item[]> = {
  registrations: [
    { id: "registration2", fullName: "Bea Inactiva", relationship: "teacher", department: "", academicUnit: "FACEN", mentorInterest: "yes", dni: "secret" },
    { id: "registration1", fullName: "Ada Compartida", relationship: "teacher", department: "Sistemas", mentorInterest: "yes", phone: "secret" },
    { id: "registration3", fullName: "Carla Sin Perfil", relationship: "teacher", department: "", academicUnit: "" },
    { id: "registration4", fullName: "Diego Sin Interés", relationship: "teacher", department: "FTyCA", mentorInterest: "no" },
    { id: "registration5", fullName: "Estudiante Excluida", relationship: "student_ftca" },
  ],
  mentor_profiles: [
    { id: "mentor1", registration: "registration1", department: "Computación", mentorInterest: "yes", active: true },
    { id: "mentor2", registration: "registration2", mentorInterest: "yes", active: false },
    { id: "mentor4", registration: "registration4", mentorInterest: "no", active: true },
  ],
  team_mentorships: [
    { id: "mentorship2", mentor: "mentor1", team: "team2" },
    { id: "mentorship1", mentor: "mentor1", team: "team1" },
  ],
  teams: [
    { id: "team2", name: "Equipo Sur" },
    { id: "team1", name: "Equipo Norte" },
    { id: "team3", name: "Equipo Libre" },
  ],
};

describe("administrative teacher projection", () => {
  it("lists only teacher registrations with affiliation and eligibility reasons", async () => {
    const result = await listAdminTeachers(fakePocketBase(seed));

    expect(result.teachers.map((teacher) => teacher.name)).toEqual([
      "Ada Compartida", "Bea Inactiva", "Carla Sin Perfil", "Diego Sin Interés",
    ]);
    expect(result.teachers.map((teacher) => teacher.affiliation)).toEqual([
      "Computación", "FACEN", "No informada", "FTyCA",
    ]);
    expect(result.teachers.map((teacher) => [teacher.eligible, teacher.unavailableReason])).toEqual([
      [true, ""],
      [false, "Perfil inactivo"],
      [false, "Perfil de mentor no disponible"],
      [false, "Sin interés en mentorías"],
    ]);
  });

  it("returns every assignment for a mentor and the current mentor for each team", async () => {
    const result = await listAdminTeachers(fakePocketBase(seed));

    expect(result.teachers[0].assignments).toEqual([
      { mentorshipId: "mentorship1", teamId: "team1", teamName: "Equipo Norte" },
      { mentorshipId: "mentorship2", teamId: "team2", teamName: "Equipo Sur" },
    ]);
    expect(result.teams).toEqual([
      { id: "team3", name: "Equipo Libre", currentMentor: null },
      { id: "team1", name: "Equipo Norte", currentMentor: { id: "mentor1", name: "Ada Compartida" } },
      { id: "team2", name: "Equipo Sur", currentMentor: { id: "mentor1", name: "Ada Compartida" } },
    ]);
  });

  it("does not expose private registration fields", async () => {
    const result = await listAdminTeachers(fakePocketBase(seed));
    const first = result.teachers[0];
    expect(first).not.toHaveProperty("dni");
    expect(first).not.toHaveProperty("phone");
    expect(first).not.toHaveProperty("email");
    expect(JSON.stringify(result)).not.toContain("secret");
  });
});
