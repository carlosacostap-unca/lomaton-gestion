import { describe, expect, it } from "vitest";

import {
  candidateInviteSearchFields,
  filterCandidateInviteOptions,
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

  it("projects only authorized candidate search fields", () => {
    expect(candidateInviteSearchFields(candidates[0])).toEqual([
      "Ángela del Valle",
      undefined,
      undefined,
      "angela@example.test",
    ]);
    expect(filterCandidateInviteOptions(candidates, "privado-candidato")).toEqual([]);
  });
});
