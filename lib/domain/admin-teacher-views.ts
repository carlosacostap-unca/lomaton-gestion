import "server-only";

import type PocketBase from "pocketbase";

type RecordItem = Record<string, unknown> & { id: string };

export type AdminTeacherAssignment = {
  mentorshipId: string;
  teamId: string;
  teamName: string;
};

export type AdminTeacherSummary = {
  registrationId: string;
  mentorId: string;
  name: string;
  affiliation: string;
  active: boolean;
  mentorInterest: "yes" | "no" | "not_provided";
  eligible: boolean;
  unavailableReason: string;
  assignments: AdminTeacherAssignment[];
};

export type AdminTeacherTeamOption = {
  id: string;
  name: string;
  currentMentor: { id: string; name: string } | null;
};

export type AdminTeacherDirectory = {
  teachers: AdminTeacherSummary[];
  teams: AdminTeacherTeamOption[];
};

function normalizedInterest(value: unknown): AdminTeacherSummary["mentorInterest"] {
  const interest = String(value || "");
  return interest === "yes" || interest === "no" ? interest : "not_provided";
}

function availability(
  mentor: RecordItem | undefined,
  interest: AdminTeacherSummary["mentorInterest"],
) {
  if (!mentor) return { eligible: false, reason: "Perfil de mentor no disponible" };
  if (!mentor.active) return { eligible: false, reason: "Perfil inactivo" };
  if (interest === "no") return { eligible: false, reason: "Sin interés en mentorías" };
  if (interest !== "yes") return { eligible: false, reason: "Interés no informado" };
  return { eligible: true, reason: "" };
}

function affiliation(registration: RecordItem, mentor: RecordItem | undefined) {
  return String(
    mentor?.department
    || registration.department
    || registration.academicUnit
    || "No informada",
  ).trim() || "No informada";
}

export async function listAdminTeachers(pb: PocketBase): Promise<AdminTeacherDirectory> {
  const [registrations, mentors, mentorships, teams] = await Promise.all([
    pb.collection("registrations").getFullList({ sort: "fullName" }),
    pb.collection("mentor_profiles").getFullList(),
    pb.collection("team_mentorships").getFullList(),
    pb.collection("teams").getFullList({ sort: "name" }),
  ]);
  const teacherRegistrations = registrations
    .filter((registration) => String(registration.relationship) === "teacher")
    .sort((left, right) => String(left.fullName).localeCompare(String(right.fullName), "es", { sensitivity: "base" }));
  const mentorByRegistration = new Map(
    mentors.map((mentor) => [String(mentor.registration), mentor]),
  );
  const mentorById = new Map(mentors.map((mentor) => [mentor.id, mentor]));
  const registrationById = new Map(registrations.map((registration) => [registration.id, registration]));
  const teamById = new Map(teams.map((team) => [team.id, team]));
  const mentorshipByTeam = new Map(
    mentorships.map((mentorship) => [String(mentorship.team), mentorship]),
  );
  const assignmentsByMentor = new Map<string, RecordItem[]>();
  for (const mentorship of mentorships) {
    const mentorId = String(mentorship.mentor);
    const current = assignmentsByMentor.get(mentorId) ?? [];
    current.push(mentorship);
    assignmentsByMentor.set(mentorId, current);
  }
  const mentorName = (mentorId: string) => {
    const mentor = mentorById.get(mentorId);
    return String(registrationById.get(String(mentor?.registration))?.fullName || "Docente no disponible");
  };

  return {
    teachers: teacherRegistrations.map((registration) => {
      const mentor = mentorByRegistration.get(registration.id);
      const mentorId = mentor?.id ?? "";
      const interest = normalizedInterest(mentor?.mentorInterest || registration.mentorInterest);
      const state = availability(mentor, interest);
      return {
        registrationId: registration.id,
        mentorId,
        name: String(registration.fullName || "Docente"),
        affiliation: affiliation(registration, mentor),
        active: Boolean(mentor?.active),
        mentorInterest: interest,
        eligible: state.eligible,
        unavailableReason: state.reason,
        assignments: (mentorId ? assignmentsByMentor.get(mentorId) ?? [] : [])
          .map((mentorship) => {
            const teamId = String(mentorship.team);
            return {
              mentorshipId: mentorship.id,
              teamId,
              teamName: String(teamById.get(teamId)?.name || "Equipo no disponible"),
            };
          })
          .sort((left, right) => left.teamName.localeCompare(right.teamName, "es", { sensitivity: "base" })),
      };
    }),
    teams: teams
      .map((team) => {
        const mentorship = mentorshipByTeam.get(team.id);
        const currentMentorId = mentorship ? String(mentorship.mentor) : "";
        return {
          id: team.id,
          name: String(team.name || "Equipo"),
          currentMentor: currentMentorId
            ? { id: currentMentorId, name: mentorName(currentMentorId) }
            : null,
        };
      })
      .sort((left, right) => left.name.localeCompare(right.name, "es", { sensitivity: "base" })),
  };
}
