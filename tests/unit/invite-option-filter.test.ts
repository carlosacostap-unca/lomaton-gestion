import { describe, expect, it } from "vitest";

import {
  candidateInviteSearchFields,
  filterCandidateInviteOptions,
  filterMentorInviteOptions,
  mentorInviteSearchFields,
  normalizeInviteSearch,
} from "@/lib/ui/invite-option-filter";

const candidates = [
  {
    id: "candidate1",
    fullName: "Ángela del Valle",
    email: "angela@example.test",
    dni: "privado-candidato",
  },
  {
    id: "candidate2",
    firstName: "Bruno",
    lastName: "Núñez",
    email: "bruno@example.test",
  },
];

const mentors = [
  {
    id: "mentor1",
    fullName: "Docente Úrsula",
    department: "Informática",
    externalDescription: "Robótica aplicada",
    email: "privado-docente@example.test",
  },
  {
    id: "mentor2",
    fullName: "Docente Beto",
    department: "Electrónica",
    externalDescription: "",
  },
];

describe("invite option filter", () => {
  it("normalizes case, diacritics and repeated surrounding whitespace", () => {
    expect(normalizeInviteSearch("  ÁNGELA   Núñez  ")).toBe("angela nunez");
  });

  it("keeps every candidate for an empty query and filters by name or email", () => {
    expect(filterCandidateInviteOptions(candidates, "")).toEqual(candidates);
    expect(filterCandidateInviteOptions(candidates, "angela")).toEqual([candidates[0]]);
    expect(filterCandidateInviteOptions(candidates, "BRUNO@EXAMPLE")).toEqual([candidates[1]]);
    expect(filterCandidateInviteOptions(candidates, "sin coincidencias")).toEqual([]);
  });

  it("filters mentors by name, department or institutional description", () => {
    expect(filterMentorInviteOptions(mentors, "ursula")).toEqual([mentors[0]]);
    expect(filterMentorInviteOptions(mentors, "informatica")).toEqual([mentors[0]]);
    expect(filterMentorInviteOptions(mentors, "robotica")).toEqual([mentors[0]]);
    expect(filterMentorInviteOptions(mentors, "electronica")).toEqual([mentors[1]]);
  });

  it("projects only authorized candidate and mentor search fields", () => {
    expect(candidateInviteSearchFields(candidates[0])).toEqual([
      "Ángela del Valle",
      undefined,
      undefined,
      "angela@example.test",
    ]);
    expect(mentorInviteSearchFields(mentors[0])).toEqual([
      "Docente Úrsula",
      "Informática",
      "Robótica aplicada",
    ]);
    expect(filterCandidateInviteOptions(candidates, "privado-candidato")).toEqual([]);
    expect(filterMentorInviteOptions(mentors, "privado-docente")).toEqual([]);
  });
});
