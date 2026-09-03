import {
  argentinaSnapshotLabel,
  exportCsv,
  exportXlsx,
  type ExportRow,
} from "@/lib/export/hackathon";
import {
  createPocketBaseServiceClient,
  requirePocketBaseAdmin,
} from "@/lib/pocketbase/server";
import { teamWarning, type ReportSnapshot, type SnapshotRecord } from "@/lib/report/hackathon";
import { candidateDisplayName } from "@/lib/domain/candidate-name";
import { teamChallengeTitle } from "@/lib/domain/team-challenges";
import { readConsistentReportSnapshot } from "@/lib/report/snapshot";
import { errorResponse } from "@/lib/server/api-error";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ kind: string; format: string }> },
) {
  try {
    const { kind, format } = await context.params;
    if (!["candidates", "teams"].includes(kind) || !["csv", "xlsx"].includes(format)) {
      return Response.json({ error: "Exportación no encontrada." }, { status: 404 });
    }
    await requirePocketBaseAdmin(request.headers.get("authorization"));
    const snapshot = (await readConsistentReportSnapshot(
      await createPocketBaseServiceClient(),
    )) as ReportSnapshot;
    const generatedAt = new Date(snapshot.generatedAtUtc);
    if (Number.isNaN(generatedAt.getTime())) throw new Error("La instantánea no tiene una fecha válida.");
    let rows: ExportRow[];
    let columns: Array<{ key: string; header: string; width?: number }>;

    if (kind === "candidates") {
      const teams = new Map(snapshot.teams.map((team) => [team.id, team]));
      const byCandidate = new Map(snapshot.memberships.map((item) => [String(item.candidate), item]));
      rows = snapshot.candidates.map((candidate) => {
        const membership = byCandidate.get(candidate.id);
        const team = membership ? teams.get(String(membership.team)) : undefined;
        return {
          nombre_completo: candidateDisplayName(candidate),
          email: String(candidate.email ?? ""),
          estado_ftca: String(candidate.ftcaStatus ?? ""),
          activo: Boolean(candidate.active),
          disponibilidad: candidate.active && !membership ? "disponible" : "no disponible",
          equipo: String(team?.name ?? ""),
        };
      });
      columns = [
        { key: "nombre_completo", header: "Nombre completo", width: 36 },
        { key: "email", header: "Email", width: 32 }, { key: "estado_ftca", header: "Estado FTCA" },
        { key: "activo", header: "Activo" }, { key: "disponibilidad", header: "Disponibilidad" },
        { key: "equipo", header: "Equipo", width: 28 },
      ];
    } else {
      const candidates = new Map(snapshot.candidates.map((candidate) => [candidate.id, candidate]));
      const byTeam = new Map<string, SnapshotRecord[]>();
      for (const membership of snapshot.memberships) {
        const candidate = candidates.get(String(membership.candidate));
        if (!candidate) continue;
        const teamId = String(membership.team);
        byTeam.set(teamId, [...(byTeam.get(teamId) ?? []), candidate]);
      }
      const mentors = new Map(snapshot.mentors.map((mentor) => [mentor.id, mentor]));
      const mentorshipByTeam = new Map(snapshot.mentorships.map((item) => [String(item.team), item]));
      const mentorInvitationHistoryByTeam = new Map<string, string[]>();
      for (const invitation of snapshot.mentorInvitations) {
        const mentor = mentors.get(String(invitation.mentor));
        const teamId = String(invitation.team);
        const label = [String(mentor?.fullName || "Docente"), String(invitation.status || "sin estado")].join(" · ");
        mentorInvitationHistoryByTeam.set(teamId, [...(mentorInvitationHistoryByTeam.get(teamId) || []), label]);
      }
      rows = snapshot.teams.map((team) => ({
        equipo: String(team.name ?? ""),
        desafio: teamChallengeTitle(team.challenge),
        estado: String(team.status ?? ""),
        integrantes: Number(team.memberCount ?? 0),
        ftca_confirmados: Number(team.ftcaConfirmedCount ?? 0),
        miembros: (byTeam.get(team.id) ?? []).map(candidateDisplayName).join(" | "),
        emails: (byTeam.get(team.id) ?? []).map((candidate) => String(candidate.email ?? "")).join(" | "),
        condiciones_ftca: (byTeam.get(team.id) ?? []).map((candidate) => String(candidate.ftcaStatus ?? "")).join(" | "),
        mentor: String(mentors.get(String(mentorshipByTeam.get(team.id)?.mentor))?.fullName || ""),
        departamento_mentor: String(mentors.get(String(mentorshipByTeam.get(team.id)?.mentor))?.department || ""),
        historial_invitaciones_mentoria: (mentorInvitationHistoryByTeam.get(team.id) || []).join(" | "),
        advertencias: teamWarning(team),
      }));
      columns = [
        { key: "equipo", header: "Equipo", width: 28 },
        { key: "desafio", header: "Desafío", width: 70 },
        { key: "estado", header: "Estado" },
        { key: "integrantes", header: "Integrantes" }, { key: "ftca_confirmados", header: "FTCA confirmados" },
        { key: "miembros", header: "Miembros", width: 60 }, { key: "emails", header: "Emails", width: 60 },
        { key: "condiciones_ftca", header: "Condiciones FTCA", width: 40 },
        { key: "mentor", header: "Mentor", width: 36 },
        { key: "departamento_mentor", header: "Departamento del mentor", width: 28 },
        { key: "historial_invitaciones_mentoria", header: "Historial de invitaciones de mentoría", width: 55 },
        { key: "advertencias", header: "Advertencias", width: 50 },
      ];
    }

    const stamp = argentinaSnapshotLabel(generatedAt).slice(0, 10);
    const fileName = `lomaton-${kind}-${stamp}.${format}`;
    if (format === "csv") {
      const csv = exportCsv(rows, columns.map((column) => column.key));
      return new Response(`\uFEFF${csv}`, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${fileName}"`,
          "Cache-Control": "no-store",
          "X-Generated-At-Argentina": argentinaSnapshotLabel(generatedAt),
        },
      });
    }
    const xlsx = await exportXlsx(rows, columns, kind === "teams" ? "Equipos" : "Candidatos", generatedAt);
    return new Response(xlsx, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store",
        "X-Generated-At-Argentina": argentinaSnapshotLabel(generatedAt),
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
