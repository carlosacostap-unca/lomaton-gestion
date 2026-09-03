import "server-only";

import type PocketBase from "pocketbase";

import { candidateDisplayName } from "@/lib/domain/candidate-name";
import { teamWarning } from "@/lib/report/hackathon";

type RecordItem = Record<string, unknown> & { id: string };

export type AdminCandidateOption = {
  id: string;
  name: string;
  email: string;
  ftcaStatus: string;
};

export type AdminMentorOption = {
  id: string;
  name: string;
  department: string;
};

export type AdminTeamSummary = {
  id: string;
  name: string;
  status: string;
  memberCount: number;
  ftcaConfirmedCount: number;
  mentorName: string;
  warning: string;
};

export type AdminTeamListView = {
  teams: AdminTeamSummary[];
  availableCandidates: AdminCandidateOption[];
};

export type AdminTeamDetailView = {
  team: RecordItem;
  members: AdminCandidateOption[];
  invitations: Array<{ id: string; candidateId: string; candidateName: string }>;
  mentorship: { id: string; mentorId: string; mentorName: string; department: string } | null;
  availableCandidates: AdminCandidateOption[];
  availableMentors: AdminMentorOption[];
};

function candidateOption(candidate: RecordItem): AdminCandidateOption {
  return {
    id: candidate.id,
    name: candidateDisplayName(candidate),
    email: String(candidate.email || ""),
    ftcaStatus: String(candidate.ftcaStatus || "pending"),
  };
}

function mentorMap(mentors: RecordItem[], registrations: RecordItem[]) {
  const registrationById = new Map(registrations.map((registration) => [registration.id, registration]));
  return new Map(mentors.map((mentor) => {
    const registration = registrationById.get(String(mentor.registration));
    return [mentor.id, {
      id: mentor.id,
      name: String(registration?.fullName || "Docente"),
      department: String(mentor.department || registration?.department || ""),
      active: Boolean(mentor.active),
      mentorInterest: String(mentor.mentorInterest || registration?.mentorInterest || ""),
    }];
  }));
}

export async function listAdminTeamSummaries(pb: PocketBase): Promise<AdminTeamListView> {
  const [teams, memberships, candidates, mentorships, mentors, registrations] = await Promise.all([
    pb.collection("teams").getFullList({ sort: "name" }),
    pb.collection("team_memberships").getFullList(),
    pb.collection("candidates").getFullList({ sort: "fullName" }),
    pb.collection("team_mentorships").getFullList(),
    pb.collection("mentor_profiles").getFullList(),
    pb.collection("registrations").getFullList({ sort: "fullName" }),
  ]);
  const occupiedCandidates = new Set(memberships.map((membership) => String(membership.candidate)));
  const mentorsById = mentorMap(mentors, registrations);
  const mentorshipByTeam = new Map(mentorships.map((mentorship) => [String(mentorship.team), mentorship]));

  return {
    teams: teams.map((team) => {
      const mentorship = mentorshipByTeam.get(team.id);
      const mentor = mentorship ? mentorsById.get(String(mentorship.mentor)) : undefined;
      return {
        id: team.id,
        name: String(team.name || "Equipo"),
        status: String(team.status || "draft"),
        memberCount: Number(team.memberCount || 0),
        ftcaConfirmedCount: Number(team.ftcaConfirmedCount || 0),
        mentorName: mentor?.name || "",
        warning: teamWarning(team),
      };
    }),
    availableCandidates: candidates
      .filter((candidate) => Boolean(candidate.active) && !occupiedCandidates.has(candidate.id))
      .map(candidateOption),
  };
}

export async function getAdminTeamDetail(pb: PocketBase, teamId: string): Promise<AdminTeamDetailView> {
  const [team, memberships, candidates, invitations, mentorships, mentors, registrations] = await Promise.all([
    pb.collection("teams").getOne(teamId),
    pb.collection("team_memberships").getFullList(),
    pb.collection("candidates").getFullList({ sort: "fullName" }),
    pb.collection("team_invitations").getFullList({ filter: pb.filter("team = {:team} && status = 'pending'", { team: teamId }), sort: "created" }),
    pb.collection("team_mentorships").getFullList({ filter: pb.filter("team = {:team}", { team: teamId }) }),
    pb.collection("mentor_profiles").getFullList(),
    pb.collection("registrations").getFullList({ sort: "fullName" }),
  ]);
  const candidatesById = new Map(candidates.map((candidate) => [candidate.id, candidate]));
  const occupiedCandidates = new Set(memberships.map((membership) => String(membership.candidate)));
  const teamMemberships = memberships.filter((membership) => String(membership.team) === teamId);
  const mentorsById = mentorMap(mentors, registrations);
  const mentorship = mentorships[0];
  const mentor = mentorship ? mentorsById.get(String(mentorship.mentor)) : undefined;

  return {
    team,
    members: teamMemberships.flatMap((membership) => {
      const candidate = candidatesById.get(String(membership.candidate));
      return candidate ? [candidateOption(candidate)] : [];
    }),
    invitations: invitations.map((invitation) => ({
      id: invitation.id,
      candidateId: String(invitation.candidate),
      candidateName: candidateDisplayName(candidatesById.get(String(invitation.candidate))),
    })),
    mentorship: mentorship ? {
      id: mentorship.id,
      mentorId: String(mentorship.mentor),
      mentorName: mentor?.name || "Docente",
      department: mentor?.department || "",
    } : null,
    availableCandidates: candidates
      .filter((candidate) => Boolean(candidate.active) && !occupiedCandidates.has(candidate.id))
      .map(candidateOption),
    availableMentors: [...mentorsById.values()]
      .filter((item) => item.active && item.mentorInterest === "yes")
      .map(({ id, name, department }) => ({ id, name, department })),
  };
}
