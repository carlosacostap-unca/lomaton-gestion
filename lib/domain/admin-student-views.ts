import "server-only";

import type PocketBase from "pocketbase";

import { normalizeCertificateReviewStatus } from "@/lib/domain/student-certificates";

type RecordItem = Record<string, unknown> & { id: string };

export type AdminStudentCertificateStatus =
  | "not_presented"
  | "pending"
  | "approved"
  | "rejected";

export type AdminStudentInvitation = {
  id: string;
  teamId: string;
  teamName: string;
};

export type AdminStudentSummary = {
  registrationId: string;
  candidateId: string;
  name: string;
  faculty: string;
  certificateStatus: AdminStudentCertificateStatus;
  team: { id: string; name: string } | null;
  pendingInvitations: AdminStudentInvitation[];
};

export type AdminStudentDirectory = {
  students: AdminStudentSummary[];
};

const studentRelationships = new Set(["student_ftca", "student_external"]);

function facultyName(registration: RecordItem) {
  const academicUnit = String(registration.academicUnit || "").trim();
  if (academicUnit) return academicUnit;
  return registration.relationship === "student_ftca" ? "FTyCA" : "No informada";
}

function certificateStatus(record: RecordItem | undefined): AdminStudentCertificateStatus {
  return record ? normalizeCertificateReviewStatus(record.reviewStatus) : "not_presented";
}

export async function listAdminStudents(pb: PocketBase): Promise<AdminStudentDirectory> {
  const [registrations, candidates, certificates, memberships, teams, invitations] = await Promise.all([
    pb.collection("registrations").getFullList({ sort: "fullName" }),
    pb.collection("candidates").getFullList(),
    pb.collection("student_certificates").getFullList(),
    pb.collection("team_memberships").getFullList(),
    pb.collection("teams").getFullList(),
    pb.collection("team_invitations").getFullList({
      filter: "status = 'pending'",
      sort: "created",
    }),
  ]);
  const students = registrations.filter((registration) =>
    studentRelationships.has(String(registration.relationship)),
  );
  const candidateByRegistration = new Map(
    candidates.map((candidate) => [String(candidate.registration), candidate]),
  );
  const certificateByCandidate = new Map(
    certificates.map((certificate) => [String(certificate.candidate), certificate]),
  );
  const membershipByCandidate = new Map(
    memberships.map((membership) => [String(membership.candidate), membership]),
  );
  const teamById = new Map(teams.map((team) => [team.id, team]));
  const invitationsByCandidate = new Map<string, RecordItem[]>();
  for (const invitation of invitations) {
    if (String(invitation.status) !== "pending") continue;
    const candidateId = String(invitation.candidate);
    const current = invitationsByCandidate.get(candidateId) ?? [];
    current.push(invitation);
    invitationsByCandidate.set(candidateId, current);
  }

  return {
    students: students.map((registration) => {
      const candidate = candidateByRegistration.get(registration.id);
      const candidateId = candidate?.id ?? "";
      const membership = candidateId ? membershipByCandidate.get(candidateId) : undefined;
      const teamId = membership ? String(membership.team) : "";
      const team = teamId ? teamById.get(teamId) : undefined;
      return {
        registrationId: registration.id,
        candidateId,
        name: String(registration.fullName || "Estudiante"),
        faculty: facultyName(registration),
        certificateStatus: certificateStatus(
          candidateId ? certificateByCandidate.get(candidateId) : undefined,
        ),
        team: teamId
          ? { id: teamId, name: String(team?.name || "Equipo no disponible") }
          : null,
        pendingInvitations: (invitationsByCandidate.get(candidateId) ?? []).map((invitation) => {
          const invitationTeamId = String(invitation.team);
          return {
            id: invitation.id,
            teamId: invitationTeamId,
            teamName: String(teamById.get(invitationTeamId)?.name || "Equipo no disponible"),
          };
        }),
      };
    }),
  };
}
