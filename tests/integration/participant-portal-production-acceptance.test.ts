// @vitest-environment node

import fs from "node:fs";
import { randomBytes } from "node:crypto";

import PocketBase from "pocketbase";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

function loadLocalEnv() {
  const values: Record<string, string> = {};
  for (const rawLine of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator < 1) continue;
    let value = line.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    values[line.slice(0, separator).trim()] = value;
  }
  return values;
}

async function count(pb: PocketBase, collection: string) {
  return (await pb.collection(collection).getList(1, 1, { fields: "id" })).totalItems;
}

const enabled = process.env.LOMATON_PARTICIPANT_PORTAL_ACCEPTANCE === "true";

describe.runIf(enabled)("participant portal production acceptance", () => {
  it("covers role bootstrap, self-service, competing teams, mentor exclusivity, admin assistance, reports and cleanup", async () => {
    const env = loadLocalEnv();
    const url = env.POCKETBASE_URL || env.NEXT_PUBLIC_POCKETBASE_URL;
    const identity = env.POCKETBASE_SUPERUSER_EMAIL || env.POCKETBASE_ADMIN_EMAIL;
    const password = env.POCKETBASE_SUPERUSER_PASSWORD || env.POCKETBASE_ADMIN_PASSWORD;
    const serviceEmail = env.POCKETBASE_SERVICE_EMAIL;
    const servicePassword = env.POCKETBASE_SERVICE_PASSWORD;
    expect(url).toBe("https://pb-lomaton.epixum.com");
    expect(identity && password && serviceEmail && servicePassword).toBeTruthy();

    const superuser = new PocketBase(url);
    const service = new PocketBase(url);
    superuser.autoCancellation(false);
    service.autoCancellation(false);
    await superuser.collection("_superusers").authWithPassword(identity, password);
    await service.collection("service_accounts").authWithPassword(serviceEmail, servicePassword);

    const { createTeam, disbandOwnTeam } = await import("@/lib/domain/team-commands");
    const { getOwnMentorDashboard, getTeamMentorState, inviteMentor, listEligibleMentors, removeAdminMentorship, resolveAdminMentorInvitation, resolveMentorInvitation } = await import("@/lib/domain/mentor-commands");
    const { updateOwnProfile } = await import("@/lib/domain/participant-profile");
    const { readConsistentReportSnapshot } = await import("@/lib/report/snapshot");
    const bootstrapRoute = await import("@/app/api/lomaton/auth/bootstrap/route");

    const suffix = `${Date.now()}-${randomBytes(3).toString("hex")}`;
    const emails = {
      student1: `e2e-portal-student1-${suffix}@example.test`,
      student2: `e2e-portal-student2-${suffix}@example.test`,
      teacher1: `e2e-portal-teacher1-${suffix}@example.test`,
      teacher2: `e2e-portal-teacher2-${suffix}@example.test`,
      admin: `e2e-portal-admin-${suffix}@example.test`,
    };
    const authPassword = `${randomBytes(18).toString("base64url")}Aa1!`;
    const ids: Record<string, string> = {};
    const baselineCollections = ["users", "registrations", "candidates", "mentor_profiles", "teams", "team_memberships", "mentor_invitations", "team_mentorships", "import_batches", "admin_allowlist"];
    const baseline = Object.fromEntries(await Promise.all(baselineCollections.map(async (name) => [name, await count(superuser, name)])));
    const settings = await superuser.collection("hackathon_settings").getFirstListItem(superuser.filter("key = {:key}", { key: "default" }));
    const baselineVersion = Number(settings.dataVersion || 0);
    let versionIncrements = 0;

    const registrationData = (fullName: string, email: string, relationship: "student_ftca" | "teacher", row: number) => ({
      submittedAt: new Date().toISOString(), fullName, dni: `99${row}${suffix.replace(/\D/g, "").slice(-6)}`, dniNormalized: `99${row}${suffix.replace(/\D/g, "").slice(-6)}`,
      phone: "3834000000", phoneNormalized: "3834000000", email, emailNormalized: email, relationship,
      ftcaStatus: relationship === "student_ftca" ? "confirmed" : "not_ftca", department: "E2E", academicUnit: relationship === "student_ftca" ? "FACEN" : "",
      career: relationship === "student_ftca" ? "Informática" : "", externalTeacherDescription: relationship === "teacher" ? "Docente E2E" : "",
      mentorInterest: relationship === "teacher" ? "yes" : "not_provided", declaredTeamStatus: "none", declaredTeamMembers: "",
      termsAccepted: "yes", mediaAuthorized: "no", sourceRole: "e2e", sourceRowNumber: row, rawSource: { e2e: suffix }, reviewStatus: "ready", importBatch: ids.batch,
      profileVersion: 0, selfManagedFields: [],
    });

    try {
      const adminUser = await superuser.collection("users").create({ email: emails.admin, emailVisibility: false, verified: true, displayName: "E2E Admin", isAdmin: false, enabled: false, password: authPassword, passwordConfirm: authPassword });
      ids.adminUser = adminUser.id;
      const allow = await superuser.collection("admin_allowlist").create({ email: emails.admin, emailNormalized: emails.admin, active: true });
      ids.allow = allow.id;
      const batch = await superuser.collection("import_batches").create({ fileName: `e2e-portal-${suffix}.csv`, fileType: "csv", totalRows: 4, validRows: 4, invalidRows: 0, pendingFtcaRows: 0, createdBy: adminUser.id });
      ids.batch = batch.id;

      for (const [key, fullName, email, relationship, row] of [
        ["studentRegistration1", "E2E Estudiante Uno", emails.student1, "student_ftca", 901],
        ["studentRegistration2", "E2E Estudiante Dos", emails.student2, "student_ftca", 902],
        ["teacherRegistration1", "E2E Docente Uno", emails.teacher1, "teacher", 903],
        ["teacherRegistration2", "E2E Docente Dos", emails.teacher2, "teacher", 904],
      ] as const) {
        ids[key] = (await superuser.collection("registrations").create(registrationData(fullName, email, relationship, row))).id;
      }
      for (const [key, registration, email] of [
        ["candidate1", ids.studentRegistration1, emails.student1], ["candidate2", ids.studentRegistration2, emails.student2],
      ] as const) {
        ids[key] = (await superuser.collection("candidates").create({ registration, fullName: key === "candidate1" ? "E2E Estudiante Uno" : "E2E Estudiante Dos", email, emailNormalized: email, ftcaStatus: "confirmed", active: true })).id;
      }
      ids.mentor1 = (await superuser.collection("mentor_profiles").create({ registration: ids.teacherRegistration1, department: "FACEN", externalDescription: "Docente E2E Uno", mentorInterest: "yes", active: true })).id;
      ids.mentor2 = (await superuser.collection("mentor_profiles").create({ registration: ids.teacherRegistration2, department: "FACEN", externalDescription: "Docente E2E Dos", mentorInterest: "yes", active: true })).id;

      const student1 = await superuser.collection("users").create({ email: emails.student1, emailVisibility: false, verified: true, registration: ids.studentRegistration1, candidate: ids.candidate1, displayName: "E2E Estudiante Uno", enabled: true, isAdmin: false, password: authPassword, passwordConfirm: authPassword });
      const student2 = await superuser.collection("users").create({ email: emails.student2, emailVisibility: false, verified: true, registration: ids.studentRegistration2, candidate: ids.candidate2, displayName: "E2E Estudiante Dos", enabled: true, isAdmin: false, password: authPassword, passwordConfirm: authPassword });
      const teacher = await superuser.collection("users").create({ email: emails.teacher1, emailVisibility: false, verified: true, registration: ids.teacherRegistration1, candidate: "", displayName: "E2E Docente Uno", enabled: true, isAdmin: false, password: authPassword, passwordConfirm: authPassword });
      ids.studentUser1 = student1.id; ids.studentUser2 = student2.id; ids.teacherUser = teacher.id;

      const teacherAuth = await superuser.collection("users").impersonate(teacher.id, 300);
      const teacherBootstrap = await bootstrapRoute.POST(new Request("http://app.test/api/lomaton/auth/bootstrap", { method: "POST", headers: { Authorization: `Bearer ${teacherAuth.authStore.token}` } }));
      expect(teacherBootstrap.status).toBe(200);
      await expect(teacherBootstrap.json()).resolves.toMatchObject({ participantRole: "teacher", user: { registration: ids.teacherRegistration1, candidate: "" } });
      const studentAuth = await superuser.collection("users").impersonate(student1.id, 300);
      const studentBootstrap = await bootstrapRoute.POST(new Request("http://app.test/api/lomaton/auth/bootstrap", { method: "POST", headers: { Authorization: `Bearer ${studentAuth.authStore.token}` } }));
      await expect(studentBootstrap.json()).resolves.toMatchObject({ participantRole: "student", user: { registration: ids.studentRegistration1, candidate: ids.candidate1 } });
      const adminAuth = await superuser.collection("users").impersonate(adminUser.id, 300);
      const adminBootstrap = await bootstrapRoute.POST(new Request("http://app.test/api/lomaton/auth/bootstrap", { method: "POST", headers: { Authorization: `Bearer ${adminAuth.authStore.token}` } }));
      await expect(adminBootstrap.json()).resolves.toMatchObject({ participantRole: "admin", user: { isAdmin: true, registration: "", candidate: "" } });

      const team1 = await createTeam(service, student1 as never, `E2E Norte ${suffix}`); versionIncrements += 1; ids.team1 = team1.id;
      const team2 = await createTeam(service, student2 as never, `E2E Sur ${suffix}`); versionIncrements += 1; ids.team2 = team2.id;
      const available = await listEligibleMentors(service, student1 as never, team1.id);
      expect(available).toEqual(expect.arrayContaining([expect.objectContaining({ id: ids.mentor1, fullName: "E2E Docente Uno" })]));
      expect(JSON.stringify(available)).not.toContain(emails.teacher1);

      const invite1 = await inviteMentor(service, student1 as never, team1.id, ids.mentor1); versionIncrements += 1; ids.invite1 = invite1.id;
      const invite2 = await inviteMentor(service, student2 as never, team2.id, ids.mentor1); versionIncrements += 1; ids.invite2 = invite2.id;
      const accepted = await resolveMentorInvitation(service, teacher as never, invite1.id, "accepted"); versionIncrements += 1;
      expect(accepted.assignment).toMatchObject({ id: team1.id, name: expect.stringContaining("E2E Norte") });
      await expect(resolveMentorInvitation(service, teacher as never, invite2.id, "accepted")).rejects.toMatchObject({ status: 409, code: "invitation_resolved" });

      await expect(service.collection("team_mentorships").create({ team: team2.id, mentor: ids.mentor1, source: "admin" })).rejects.toMatchObject({ status: 400 });
      await expect(service.collection("team_mentorships").create({ team: team1.id, mentor: ids.mentor2, source: "admin" })).rejects.toMatchObject({ status: 400 });

      const beforeProfile = await service.collection("registrations").getOne(ids.teacherRegistration1);
      const updatedProfile = await updateOwnProfile(service, teacher as never, { expectedVersion: Number(beforeProfile.profileVersion || 0), phone: "+54 383 455-0000", department: "FACEN E2E" }); versionIncrements += 1;
      expect(updatedProfile).toMatchObject({ version: Number(beforeProfile.profileVersion || 0) + 1, editable: { phone: "+54 383 455-0000", department: "FACEN E2E" } });
      expect(updatedProfile).not.toHaveProperty("rawSource");

      const studentView = await getTeamMentorState(service, student1 as never, team1.id);
      expect(studentView.assignment?.mentor).toMatchObject({ fullName: "E2E Docente Uno", department: "FACEN E2E" });
      const teacherView = await getOwnMentorDashboard(service, teacher as never);
      expect(teacherView.assignment?.members).toEqual([{ id: ids.candidate1, fullName: "E2E Estudiante Uno" }]);
      expect(JSON.stringify(teacherView)).not.toContain("certificate");
      expect(JSON.stringify(teacherView)).not.toContain("dni");

      const snapshot = await readConsistentReportSnapshot(service);
      const snapshotTeam = snapshot.teams.find((item) => item.id === team1.id);
      expect(snapshotTeam).toMatchObject({ memberCount: 1, ftcaConfirmedCount: 1 });
      expect(snapshot.mentorships).toEqual(expect.arrayContaining([expect.objectContaining({ team: team1.id, mentor: ids.mentor1 })]));

      await disbandOwnTeam(service, student1 as never, team1.id); versionIncrements += 1;
      delete ids.team1;
      expect(await service.collection("team_mentorships").getFullList({ filter: service.filter("mentor = {:mentor}", { mentor: ids.mentor1 }) })).toEqual([]);
      expect(await listEligibleMentors(service, student2 as never, team2.id)).toEqual(expect.arrayContaining([expect.objectContaining({ id: ids.mentor1 })]));

      const adminUserCurrent = await superuser.collection("users").getOne(ids.adminUser);
      const adminCancelled = await inviteMentor(service, student2 as never, team2.id, ids.mentor1); versionIncrements += 1;
      await resolveAdminMentorInvitation(service, adminUserCurrent as never, adminCancelled.id, "Aceptación E2E: cancelar invitación"); versionIncrements += 1;
      const finalInvite = await inviteMentor(service, student2 as never, team2.id, ids.mentor1); versionIncrements += 1;
      const finalAccepted = await resolveMentorInvitation(service, teacher as never, finalInvite.id, "accepted"); versionIncrements += 1;
      const mentorship = await service.collection("team_mentorships").getFirstListItem(service.filter("team = {:team}", { team: team2.id }));
      expect(finalAccepted.assignment?.id).toBe(team2.id);
      await removeAdminMentorship(service, adminUserCurrent as never, mentorship.id, "Aceptación E2E: liberar docente"); versionIncrements += 1;
      expect(await service.collection("team_mentorships").getFullList({ filter: service.filter("mentor = {:mentor}", { mentor: ids.mentor1 }) })).toEqual([]);

      const anonymousRegistrations = await fetch(`${url}/api/collections/registrations/records?page=1&perPage=1`);
      expect(anonymousRegistrations.status).toBe(200);
      await expect(anonymousRegistrations.json()).resolves.toMatchObject({ items: [] });
    } finally {
      if (ids.team1) await superuser.collection("teams").delete(ids.team1).catch(() => undefined);
      if (ids.team2) await superuser.collection("teams").delete(ids.team2).catch(() => undefined);
      const actorIds = [ids.studentUser1, ids.studentUser2, ids.teacherUser, ids.adminUser].filter(Boolean);
      if (actorIds.length) {
        const audits = await superuser.collection("audit_logs").getFullList({ filter: actorIds.map((id) => superuser.filter("actor = {:actor}", { actor: id })).join(" || "), fields: "id" });
        for (const audit of audits) await superuser.collection("audit_logs").delete(audit.id).catch(() => undefined);
      }
      if (ids.allow) await superuser.collection("admin_allowlist").delete(ids.allow).catch(() => undefined);
      for (const id of [ids.candidate1, ids.candidate2]) if (id) await superuser.collection("candidates").delete(id).catch(() => undefined);
      for (const id of [ids.mentor1, ids.mentor2]) if (id) await superuser.collection("mentor_profiles").delete(id).catch(() => undefined);
      for (const id of [ids.studentRegistration1, ids.studentRegistration2, ids.teacherRegistration1, ids.teacherRegistration2]) if (id) await superuser.collection("registrations").delete(id).catch(() => undefined);
      if (ids.batch) await superuser.collection("import_batches").delete(ids.batch).catch(() => undefined);
      for (const id of [ids.studentUser1, ids.studentUser2, ids.teacherUser, ids.adminUser]) if (id) await superuser.collection("users").delete(id).catch(() => undefined);

      const current = await superuser.collection("hackathon_settings").getOne(settings.id);
      const expectedVersion = baselineVersion + versionIncrements;
      if (Number(current.dataVersion) === expectedVersion) await superuser.collection("hackathon_settings").update(settings.id, { dataVersion: baselineVersion });
      else throw new Error(`No se restaura dataVersion por actividad concurrente: esperado ${expectedVersion}, actual ${current.dataVersion}.`);
      for (const name of baselineCollections) expect(await count(superuser, name), `conteo final ${name}`).toBe(baseline[name]);
    }
  }, 120_000);
});
