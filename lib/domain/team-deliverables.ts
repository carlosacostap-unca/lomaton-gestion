import "server-only";

import { randomBytes } from "node:crypto";

import PocketBase, { ClientResponseError, type RecordModel } from "pocketbase";

import { addAudit, defaultSettings } from "@/lib/domain/admin-commands";
import {
  validateDeliverableUrl,
  type ValidatedDeliverableFile,
} from "@/lib/domain/team-deliverable-validation";
import type { LomatonUser } from "@/lib/pocketbase/server";
import { ApiError } from "@/lib/server/api-error";
import {
  deliverableDefinition,
  deriveDeliverableSummaryStatus,
  missingRequiredProducts,
  TEAM_DELIVERABLE_DEFINITIONS,
  type TeamDeliverableKind,
  type TeamDeliverableMedium,
  type TeamDeliverableProjection,
} from "@/lib/team-deliverables-contract";

function recordId() {
  return randomBytes(12).toString("hex").slice(0, 15);
}

function filter(pb: PocketBase, template: string, params: Record<string, unknown>) {
  return pb.filter(template, params);
}

function isNotFound(error: unknown) {
  return error instanceof ClientResponseError && error.status === 404;
}

async function findDeliverable(pb: PocketBase, teamId: string) {
  try {
    return await pb.collection("team_deliverables").getFirstListItem(
      filter(pb, "team = {:team}", { team: teamId }),
    );
  } catch (error) {
    if (isNotFound(error)) return null;
    throw error;
  }
}

async function findMembership(pb: PocketBase, candidateId: string) {
  try {
    return await pb.collection("team_memberships").getFirstListItem(
      filter(pb, "candidate = {:candidate}", { candidate: candidateId }),
    );
  } catch (error) {
    if (isNotFound(error)) return null;
    throw error;
  }
}

function productMedium(record: RecordModel | null, kind: TeamDeliverableKind): TeamDeliverableMedium {
  if (!record) return "none";
  if (kind === "presentation" || kind === "evidence") {
    const medium = String(record[`${kind}Medium`] ?? "");
    return medium === "file" || medium === "link" ? medium : "none";
  }
  if (kind === "canvas" || kind === "report") return record[`${kind}File`] ? "file" : "none";
  return record.videoUrl ? "link" : "none";
}

function deadlineOpen(deadlineUtc: string, at = Date.now()) {
  if (!deadlineUtc) return false;
  const timestamp = new Date(deadlineUtc).getTime();
  return Number.isFinite(timestamp) && timestamp > at;
}

function assertDeadlineOpen(settings: RecordModel) {
  const deadline = String(settings.deliverablesDeadlineUtc ?? "");
  if (!deadline) {
    throw new ApiError(409, "La organización todavía no habilitó el período de entrega.", "deliverables_deadline_missing");
  }
  if (!deadlineOpen(deadline)) {
    throw new ApiError(409, "Venció el plazo para modificar la entrega.", "deliverables_deadline_passed");
  }
}

function assertVersion(record: RecordModel | null, expectedVersion: number) {
  const current = record ? Number(record.version) : 0;
  if (!Number.isInteger(expectedVersion) || expectedVersion < 0 || current !== expectedVersion) {
    throw new ApiError(
      409,
      "La entrega cambió. Recargá la pantalla antes de continuar.",
      "deliverable_version_conflict",
      { currentVersion: current },
    );
  }
}

async function ownTeamContext(pb: PocketBase, user: LomatonUser) {
  if (!user.candidate) {
    throw new ApiError(403, "La cuenta no está vinculada a un estudiante.", "candidate_required");
  }
  const membership = await findMembership(pb, String(user.candidate));
  if (!membership) {
    throw new ApiError(409, "Necesitás integrar un equipo para gestionar una entrega.", "team_membership_required");
  }
  const [team, settings, deliverable] = await Promise.all([
    pb.collection("teams").getOne(String(membership.team)),
    defaultSettings(pb),
    findDeliverable(pb, String(membership.team)),
  ]);
  return { team, settings, deliverable };
}

function projection(
  team: RecordModel,
  record: RecordModel | null,
  deadlineUtc: string,
  editable: boolean,
): TeamDeliverableProjection {
  const media = Object.fromEntries(
    TEAM_DELIVERABLE_DEFINITIONS.map(({ kind }) => [kind, productMedium(record, kind)]),
  ) as Record<TeamDeliverableKind, TeamDeliverableMedium>;
  const missingRequired = missingRequiredProducts(media);
  const lifecycle = record
    ? (String(record.status) === "finalized" ? "finalized" : "draft")
    : "none";
  return {
    teamId: team.id,
    teamName: String(team.name ?? "Equipo"),
    lifecycle,
    summaryStatus: deriveDeliverableSummaryStatus(lifecycle, missingRequired),
    version: record ? Number(record.version) : 0,
    deadlineUtc,
    canEdit: editable && deadlineOpen(deadlineUtc),
    missingRequired,
    products: TEAM_DELIVERABLE_DEFINITIONS.map((definition) => {
      const medium = media[definition.kind];
      const prefix = definition.kind;
      const item = {
        kind: definition.kind,
        label: definition.label,
        required: definition.required,
        allowedMedia: definition.media,
        allowedExtensions: definition.extensions,
        medium,
      } as TeamDeliverableProjection["products"][number];
      if (medium === "file" && record) {
        item.originalName = String(record[`${prefix}OriginalName`] ?? "archivo");
        item.sizeBytes = Number(record[`${prefix}SizeBytes`] ?? 0);
        item.mimeType = String(record[`${prefix}MimeType`] ?? "application/octet-stream");
        item.updatedAt = String(record[`${prefix}UpdatedAt`] ?? record.updated ?? "");
        item.downloadPath = `/api/lomaton/deliverables/${team.id}/files/${prefix}`;
      } else if (medium === "link" && record) {
        item.url = String(record[`${prefix}Url`] ?? "");
        item.updatedAt = String(record[`${prefix}UpdatedAt`] ?? record.updated ?? "");
      }
      return item;
    }),
    updatedAt: String(record?.updated ?? ""),
    finalizedAt: String(record?.finalizedAt ?? ""),
  };
}

export async function getOwnTeamDeliverable(pb: PocketBase, user: LomatonUser) {
  const { team, settings, deliverable } = await ownTeamContext(pb, user);
  return projection(team, deliverable, String(settings.deliverablesDeadlineUtc ?? ""), true);
}

export async function listTeamDeliverables(pb: PocketBase) {
  const [teams, records, settings] = await Promise.all([
    pb.collection("teams").getFullList({ sort: "name" }),
    pb.collection("team_deliverables").getFullList({ sort: "team" }),
    defaultSettings(pb),
  ]);
  const byTeam = new Map(records.map((record) => [String(record.team), record]));
  const deadline = String(settings.deliverablesDeadlineUtc ?? "");
  const items = teams.map((team) => projection(team, byTeam.get(team.id) ?? null, deadline, false));
  return {
    deadlineUtc: deadline,
    items,
    counts: {
      none: items.filter((item) => item.summaryStatus === "none").length,
      draftIncomplete: items.filter((item) => item.summaryStatus === "draft_incomplete").length,
      draftComplete: items.filter((item) => item.summaryStatus === "draft_complete").length,
      finalized: items.filter((item) => item.summaryStatus === "finalized").length,
    },
  };
}

export async function getTeamDeliverable(pb: PocketBase, teamId: string) {
  const [team, settings, record] = await Promise.all([
    pb.collection("teams").getOne(teamId),
    defaultSettings(pb),
    findDeliverable(pb, teamId),
  ]);
  return projection(team, record, String(settings.deliverablesDeadlineUtc ?? ""), false);
}

function draftPatch(version: number) {
  return { status: "draft", version: version + 1, finalizedAt: "", finalizedBy: "" };
}

async function sendMutation(
  pb: PocketBase,
  input: {
    user: LomatonUser;
    team: RecordModel;
    settings: RecordModel;
    record: RecordModel | null;
    patch: Record<string, unknown>;
    action: string;
    metadata: Record<string, unknown>;
  },
) {
  const batch = pb.createBatch();
  const id = input.record?.id ?? recordId();
  if (input.record) {
    batch.collection("team_deliverables").update(id, input.patch, {
      query: { expected_version: Number(input.record.version) },
    });
  } else {
    batch.collection("team_deliverables").create({ id, team: input.team.id, ...input.patch });
  }
  addAudit(batch, {
    actorId: input.user.id,
    action: input.action,
    entityType: "team_deliverables",
    entityId: id,
    before: input.record ? { status: input.record.status, version: input.record.version } : null,
    after: { status: input.patch.status, version: input.patch.version },
    metadata: input.metadata,
  });
  batch.collection("hackathon_settings").update(input.settings.id, { "dataVersion+": 1 });
  try {
    await batch.send();
  } catch (error) {
    if (error instanceof ClientResponseError && [400, 409].includes(error.status)) {
      throw new ApiError(409, "La entrega cambió. Recargá la pantalla antes de continuar.", "deliverable_version_conflict");
    }
    throw error;
  }
  const synthetic = { ...(input.record ?? {}), id, team: input.team.id, ...input.patch, updated: new Date().toISOString() } as RecordModel;
  return projection(input.team, synthetic, String(input.settings.deliverablesDeadlineUtc), true);
}

function fieldPrefix(kind: TeamDeliverableKind) {
  return kind;
}

export async function saveOwnDeliverableFile(
  pb: PocketBase,
  user: LomatonUser,
  kind: TeamDeliverableKind,
  file: ValidatedDeliverableFile,
  expectedVersion: number,
) {
  const definition = deliverableDefinition(kind);
  if (!definition?.media.includes("file" as never)) {
    throw new ApiError(400, "Este producto no admite archivos.", "deliverable_file_not_allowed");
  }
  const context = await ownTeamContext(pb, user);
  assertDeadlineOpen(context.settings);
  assertVersion(context.deliverable, expectedVersion);
  const prefix = fieldPrefix(kind);
  if (
    context.deliverable &&
    productMedium(context.deliverable, kind) === "file" &&
    String(context.deliverable[`${prefix}Sha256`]) === file.sha256
  ) return projection(context.team, context.deliverable, String(context.settings.deliverablesDeadlineUtc), true);
  const timestamp = new Date().toISOString();
  const patch: Record<string, unknown> = {
    ...draftPatch(expectedVersion),
    [`${prefix}File`]: file.file,
    [`${prefix}OriginalName`]: file.safeDownloadName,
    [`${prefix}SizeBytes`]: file.sizeBytes,
    [`${prefix}MimeType`]: file.mimeType,
    [`${prefix}Sha256`]: file.sha256,
    [`${prefix}UpdatedAt`]: timestamp,
  };
  if (kind === "presentation" || kind === "evidence") {
    patch[`${prefix}Medium`] = "file";
    patch[`${prefix}Url`] = "";
  }
  return sendMutation(pb, {
    user, team: context.team, settings: context.settings, record: context.deliverable,
    patch, action: "deliverable.product.save_file",
    metadata: { teamId: context.team.id, kind, medium: "file", originalName: file.safeDownloadName, sizeBytes: file.sizeBytes, mimeType: file.mimeType },
  });
}

export async function saveOwnDeliverableLink(
  pb: PocketBase,
  user: LomatonUser,
  kind: TeamDeliverableKind,
  value: string,
  expectedVersion: number,
) {
  const definition = deliverableDefinition(kind);
  if (!definition?.media.includes("link" as never)) {
    throw new ApiError(400, "Este producto no admite enlaces.", "deliverable_link_not_allowed");
  }
  const validated = validateDeliverableUrl(value);
  const context = await ownTeamContext(pb, user);
  assertDeadlineOpen(context.settings);
  assertVersion(context.deliverable, expectedVersion);
  if (context.deliverable && productMedium(context.deliverable, kind) === "link" && String(context.deliverable[`${kind}Url`]) === validated.url) {
    return projection(context.team, context.deliverable, String(context.settings.deliverablesDeadlineUtc), true);
  }
  const patch: Record<string, unknown> = {
    ...draftPatch(expectedVersion),
    [`${kind}Url`]: validated.url,
    [`${kind}UpdatedAt`]: new Date().toISOString(),
  };
  if (kind === "presentation" || kind === "evidence") {
    Object.assign(patch, {
      [`${kind}Medium`]: "link",
      [`${kind}File`]: "",
      [`${kind}OriginalName`]: "",
      [`${kind}SizeBytes`]: 0,
      [`${kind}MimeType`]: "",
      [`${kind}Sha256`]: "",
    });
  }
  return sendMutation(pb, {
    user, team: context.team, settings: context.settings, record: context.deliverable,
    patch, action: "deliverable.product.save_link",
    metadata: { teamId: context.team.id, kind, medium: "link", hostname: validated.hostname },
  });
}

export async function removeOwnDeliverableProduct(
  pb: PocketBase,
  user: LomatonUser,
  kind: TeamDeliverableKind,
  expectedVersion: number,
) {
  if (!deliverableDefinition(kind)) throw new ApiError(400, "El producto no es válido.", "invalid_deliverable_kind");
  const context = await ownTeamContext(pb, user);
  assertDeadlineOpen(context.settings);
  assertVersion(context.deliverable, expectedVersion);
  if (!context.deliverable || productMedium(context.deliverable, kind) === "none") {
    return projection(context.team, context.deliverable, String(context.settings.deliverablesDeadlineUtc), true);
  }
  const patch: Record<string, unknown> = { ...draftPatch(expectedVersion), [`${kind}UpdatedAt`]: new Date().toISOString() };
  if (kind === "video") patch.videoUrl = "";
  else {
    Object.assign(patch, {
      [`${kind}File`]: "", [`${kind}OriginalName`]: "", [`${kind}SizeBytes`]: 0,
      [`${kind}MimeType`]: "", [`${kind}Sha256`]: "",
    });
    if (kind === "presentation" || kind === "evidence") {
      patch[`${kind}Medium`] = "";
      patch[`${kind}Url`] = "";
    }
  }
  return sendMutation(pb, {
    user, team: context.team, settings: context.settings, record: context.deliverable,
    patch, action: "deliverable.product.remove",
    metadata: { teamId: context.team.id, kind },
  });
}

export async function finalizeOwnDeliverable(
  pb: PocketBase,
  user: LomatonUser,
  expectedVersion: number,
) {
  const context = await ownTeamContext(pb, user);
  assertDeadlineOpen(context.settings);
  assertVersion(context.deliverable, expectedVersion);
  if (!context.deliverable) {
    throw new ApiError(409, "Faltan los cuatro productos obligatorios.", "deliverable_incomplete", { missingRequired: ["presentation", "canvas", "report", "evidence"] });
  }
  const media = Object.fromEntries(TEAM_DELIVERABLE_DEFINITIONS.map(({ kind }) => [kind, productMedium(context.deliverable, kind)]));
  const missingRequired = missingRequiredProducts(media);
  if (missingRequired.length) {
    throw new ApiError(409, "Faltan productos obligatorios para finalizar.", "deliverable_incomplete", { missingRequired });
  }
  if (String(context.deliverable.status) === "finalized") {
    return projection(context.team, context.deliverable, String(context.settings.deliverablesDeadlineUtc), true);
  }
  const patch = {
    status: "finalized",
    version: expectedVersion + 1,
    finalizedAt: new Date().toISOString(),
    finalizedBy: user.id,
  };
  return sendMutation(pb, {
    user, team: context.team, settings: context.settings, record: context.deliverable,
    patch, action: "deliverable.finalize",
    metadata: { teamId: context.team.id, missingRequired: [] },
  });
}

export async function getAuthorizedDeliverableFile(
  pb: PocketBase,
  user: LomatonUser,
  teamId: string,
  kind: TeamDeliverableKind,
) {
  const definition = deliverableDefinition(kind);
  if (!definition?.media.includes("file" as never)) {
    throw new ApiError(404, "El producto no posee un archivo descargable.", "deliverable_file_not_found");
  }
  let authorized = Boolean(user.isAdmin);
  if (!authorized && user.juror) {
    try {
      const juror = await pb.collection("jurors").getOne(String(user.juror));
      authorized = juror.active === true;
    } catch (error) {
      if (!isNotFound(error)) throw error;
    }
  }
  if (!authorized && user.candidate) {
    const membership = await findMembership(pb, String(user.candidate));
    authorized = String(membership?.team ?? "") === teamId;
  }
  if (!authorized) throw new ApiError(403, "No tenés acceso a esta entrega.", "deliverable_forbidden");
  const record = await findDeliverable(pb, teamId);
  if (!record || productMedium(record, kind) !== "file") {
    throw new ApiError(404, "El producto no posee un archivo descargable.", "deliverable_file_not_found");
  }
  const filename = String(record[`${kind}File`] ?? "");
  if (!filename) throw new ApiError(404, "El archivo no está disponible.", "deliverable_file_not_found");
  const token = await pb.files.getToken();
  return {
    url: pb.files.getURL(record, filename, { token }),
    originalName: String(record[`${kind}OriginalName`] ?? "archivo"),
    mimeType: String(record[`${kind}MimeType`] ?? "application/octet-stream"),
    sizeBytes: Number(record[`${kind}SizeBytes`] ?? 0),
  };
}
