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
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    values[key] = value;
  }
  return values;
}

async function count(pb: PocketBase, collection: string) {
  return (await pb.collection(collection).getList(1, 1, { fields: "id" })).totalItems;
}

const enabled = process.env.LOMATON_PRODUCTION_ACCEPTANCE === "true";

describe.runIf(enabled)("student certificate production acceptance", () => {
  it("covers review lifecycle, concurrency, privacy, storage and FTCA separation", async () => {
    const env = loadLocalEnv();
    const pocketBaseUrl = env.POCKETBASE_URL || env.NEXT_PUBLIC_POCKETBASE_URL;
    const identity = env.POCKETBASE_SUPERUSER_EMAIL || env.POCKETBASE_ADMIN_EMAIL;
    const password = env.POCKETBASE_SUPERUSER_PASSWORD || env.POCKETBASE_ADMIN_PASSWORD;
    const serviceEmail = env.POCKETBASE_SERVICE_EMAIL;
    const servicePassword = env.POCKETBASE_SERVICE_PASSWORD;
    expect(pocketBaseUrl).toBe("https://pb-lomaton.epixum.com");
    expect(identity && password && serviceEmail && servicePassword).toBeTruthy();

    const superuser = new PocketBase(pocketBaseUrl);
    const service = new PocketBase(pocketBaseUrl);
    superuser.autoCancellation(false);
    service.autoCancellation(false);
    await superuser.collection("_superusers").authWithPassword(identity, password);
    await service.collection("service_accounts").authWithPassword(serviceEmail, servicePassword);

    const {
      adminStudentCertificateMetadata,
      findStudentCertificate,
      getStudentCertificateDownload,
      listStudentCertificatesForReview,
      reviewStudentCertificate,
      studentCertificateMetadata,
      upsertStudentCertificate,
    } = await import("@/lib/domain/student-certificates");
    const { validateStudentCertificate } = await import("@/lib/domain/student-certificate-validation");

    const suffix = `${Date.now()}-${randomBytes(3).toString("hex")}`;
    const candidateEmail = `e2e-certificate-${suffix}@example.test`;
    const adminEmail = `e2e-certificate-admin-${suffix}@example.test`;
    const authPassword = `${randomBytes(18).toString("base64url")}Aa1!`;
    const created = { candidateId: "", userId: "", adminUserId: "", certificateId: "" };
    let increments = 0;
    let baseline: { certificates: number; teams: number; memberships: number; dataVersion: number } | undefined;
    let settingsId = "";

    try {
      const settings = await superuser.collection("hackathon_settings").getFirstListItem(superuser.filter("key = {:key}", { key: "default" }));
      settingsId = settings.id;
      baseline = {
        certificates: await count(superuser, "student_certificates"),
        teams: await count(superuser, "teams"),
        memberships: await count(superuser, "team_memberships"),
        dataVersion: Number(settings.dataVersion || 0),
      };

      const candidate = await superuser.collection("candidates").create({
        fullName: `E2E Certificados ${suffix}`,
        firstName: "E2E",
        lastName: `Certificados ${suffix}`,
        email: candidateEmail,
        emailNormalized: candidateEmail,
        ftcaStatus: "pending",
        active: true,
      });
      created.candidateId = candidate.id;
      const candidateUser = await superuser.collection("users").create({
        email: candidateEmail, emailVisibility: false, verified: true, candidate: candidate.id,
        displayName: "E2E Candidato", isAdmin: false, enabled: true,
        password: authPassword, passwordConfirm: authPassword,
      });
      created.userId = candidateUser.id;
      const adminUser = await superuser.collection("users").create({
        email: adminEmail, emailVisibility: false, verified: true, displayName: "E2E Admin",
        isAdmin: true, enabled: true, password: authPassword, passwordConfirm: authPassword,
      });
      created.adminUserId = adminUser.id;

      const file1 = new File([`%PDF-1.4\n% LOMATON E2E v1 ${suffix}\n%%EOF\n`], "e2e-certificado-v1.pdf", { type: "application/pdf" });
      const validated1 = await validateStudentCertificate(file1, 10 * 1024 * 1024);
      await expect(upsertStudentCertificate(service, candidateUser as never, candidate.id, validated1)).resolves.toMatchObject({ reviewStatus: "pending" });
      increments += 1;
      const record1 = await findStudentCertificate(service, candidate.id);
      expect(record1).toBeTruthy();
      created.certificateId = record1!.id;
      const version1 = validated1.sha256;

      const queue = await listStudentCertificatesForReview(service, { status: "pending", page: 1, perPage: 100 });
      expect(queue.items).toEqual(expect.arrayContaining([expect.objectContaining({ candidateId: candidate.id, version: version1 })]));
      const download = await getStudentCertificateDownload(service, candidate.id);
      const downloaded = await fetch(download.url);
      expect(downloaded.status).toBe(200);
      expect(downloaded.headers.get("content-type")).toContain("application/pdf");
      expect(new TextDecoder().decode(await downloaded.arrayBuffer())).toContain("LOMATON E2E v1");

      await expect(reviewStudentCertificate(service, adminUser as never, candidate.id, { decision: "approved", expectedSha256: version1 })).resolves.toMatchObject({ reviewStatus: "approved" });
      increments += 1;
      const afterApprove = await superuser.collection("hackathon_settings").getOne(settingsId);
      await expect(reviewStudentCertificate(service, adminUser as never, candidate.id, { decision: "approved", expectedSha256: version1 })).resolves.toMatchObject({ reviewStatus: "approved" });
      const afterRetry = await superuser.collection("hackathon_settings").getOne(settingsId);
      expect(afterRetry.dataVersion).toBe(afterApprove.dataVersion);

      await expect(reviewStudentCertificate(service, adminUser as never, candidate.id, { decision: "rejected", reason: "Documento E2E ilegible", expectedSha256: version1 })).resolves.toMatchObject({ reviewStatus: "rejected" });
      increments += 1;
      const rejected = await findStudentCertificate(service, candidate.id);
      expect(studentCertificateMetadata(rejected)).toMatchObject({ reviewStatus: "rejected", rejectionReason: "Documento E2E ilegible" });
      expect(studentCertificateMetadata(rejected)).not.toHaveProperty("version");
      expect(studentCertificateMetadata(rejected)).not.toHaveProperty("reviewedBy");
      expect(adminStudentCertificateMetadata(rejected)).toHaveProperty("version", version1);

      await expect(reviewStudentCertificate(service, adminUser as never, candidate.id, { decision: "approved", expectedSha256: version1 })).resolves.toMatchObject({ reviewStatus: "approved" });
      increments += 1;
      const file2 = new File([`%PDF-1.4\n% LOMATON E2E v2 ${suffix}\n%%EOF\n`], "e2e-certificado-v2.pdf", { type: "application/pdf" });
      const validated2 = await validateStudentCertificate(file2, 10 * 1024 * 1024);
      await expect(upsertStudentCertificate(service, candidateUser as never, candidate.id, validated2)).resolves.toMatchObject({ reviewStatus: "pending" });
      increments += 1;
      await expect(reviewStudentCertificate(service, adminUser as never, candidate.id, { decision: "rejected", reason: "Decisión obsoleta", expectedSha256: version1 })).rejects.toMatchObject({ status: 409, code: "certificate_review_conflict" });

      const candidateAfter = await superuser.collection("candidates").getOne(candidate.id, { fields: "id,ftcaStatus" });
      expect(candidateAfter.ftcaStatus).toBe("pending");
      expect(await count(superuser, "teams")).toBe(baseline.teams);
      expect(await count(superuser, "team_memberships")).toBe(baseline.memberships);
      const anonymousQueue = await fetch("https://lomaton.epixum.com/api/lomaton/admin/certificates");
      expect(anonymousQueue.status).toBe(401);
    } finally {
      if (created.certificateId) {
        const audits = await superuser.collection("audit_logs").getFullList({
          filter: superuser.filter("entityType = {:type} && entityId = {:id}", { type: "student_certificates", id: created.certificateId }),
          fields: "id",
        });
        for (const audit of audits) await superuser.collection("audit_logs").delete(audit.id);
        await superuser.collection("student_certificates").delete(created.certificateId).catch(() => undefined);
      }
      if (created.userId) await superuser.collection("users").delete(created.userId).catch(() => undefined);
      if (created.adminUserId) await superuser.collection("users").delete(created.adminUserId).catch(() => undefined);
      if (created.candidateId) await superuser.collection("candidates").delete(created.candidateId).catch(() => undefined);

      if (baseline && settingsId) {
        const current = await superuser.collection("hackathon_settings").getOne(settingsId);
        const expectedVersion = baseline.dataVersion + increments;
        if (Number(current.dataVersion) === expectedVersion) {
          await superuser.collection("hackathon_settings").update(settingsId, { dataVersion: baseline.dataVersion });
        } else {
          throw new Error(`No se restaura dataVersion por actividad concurrente: esperado ${expectedVersion}, actual ${current.dataVersion}.`);
        }
        expect(await count(superuser, "student_certificates")).toBe(baseline.certificates);
        expect(await count(superuser, "teams")).toBe(baseline.teams);
        expect(await count(superuser, "team_memberships")).toBe(baseline.memberships);
      }
    }
  }, 60_000);
});
