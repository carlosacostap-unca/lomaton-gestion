export const TEAM_DELIVERABLE_KINDS = [
  "presentation",
  "canvas",
  "report",
  "evidence",
  "video",
] as const;

export type TeamDeliverableKind = (typeof TEAM_DELIVERABLE_KINDS)[number];
export type TeamDeliverableMedium = "none" | "file" | "link";
export type TeamDeliverableLifecycle = "none" | "draft" | "finalized";
export type TeamDeliverableSummaryStatus = "none" | "draft_incomplete" | "draft_complete" | "finalized";

export type DeliverableDefinition = {
  kind: TeamDeliverableKind;
  label: string;
  required: boolean;
  media: readonly Exclude<TeamDeliverableMedium, "none">[];
  extensions: readonly string[];
  mimeTypes: readonly string[];
};

export const TEAM_DELIVERABLE_DEFINITIONS = [
  {
    kind: "presentation", label: "Presentación", required: true, media: ["file", "link"],
    extensions: ["pdf", "ppt", "pptx"],
    mimeTypes: ["application/pdf", "application/vnd.ms-powerpoint", "application/vnd.openxmlformats-officedocument.presentationml.presentation"],
  },
  {
    kind: "canvas", label: "Canvas", required: true, media: ["file"],
    extensions: ["pdf", "png", "jpg", "jpeg"], mimeTypes: ["application/pdf", "image/png", "image/jpeg"],
  },
  {
    kind: "report", label: "Informe", required: true, media: ["file"],
    extensions: ["pdf", "doc", "docx"],
    mimeTypes: ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  },
  {
    kind: "evidence", label: "Evidencia del desarrollo alcanzado", required: true, media: ["file", "link"],
    extensions: ["pdf", "png", "jpg", "jpeg", "zip"], mimeTypes: ["application/pdf", "image/png", "image/jpeg", "application/zip"],
  },
  { kind: "video", label: "Video", required: false, media: ["link"], extensions: [], mimeTypes: [] },
] as const satisfies readonly DeliverableDefinition[];

export const REQUIRED_TEAM_DELIVERABLE_KINDS = TEAM_DELIVERABLE_DEFINITIONS
  .filter((definition) => definition.required)
  .map((definition) => definition.kind);

export type DeliverableProductProjection = {
  kind: TeamDeliverableKind;
  label: string;
  required: boolean;
  allowedMedia: readonly Exclude<TeamDeliverableMedium, "none">[];
  allowedExtensions: readonly string[];
  medium: TeamDeliverableMedium;
  originalName?: string;
  sizeBytes?: number;
  mimeType?: string;
  updatedAt?: string;
  url?: string;
  downloadPath?: string;
};

export type TeamDeliverableProjection = {
  teamId: string;
  teamName: string;
  lifecycle: TeamDeliverableLifecycle;
  summaryStatus: TeamDeliverableSummaryStatus;
  version: number;
  deadlineUtc: string;
  canEdit: boolean;
  missingRequired: TeamDeliverableKind[];
  products: DeliverableProductProjection[];
  updatedAt: string;
  finalizedAt: string;
};

export function deliverableDefinition(kind: string) {
  return TEAM_DELIVERABLE_DEFINITIONS.find((definition) => definition.kind === kind);
}

export function missingRequiredProducts(media: Partial<Record<TeamDeliverableKind, TeamDeliverableMedium>>) {
  return REQUIRED_TEAM_DELIVERABLE_KINDS.filter((kind) => !media[kind] || media[kind] === "none");
}

export function deriveDeliverableSummaryStatus(
  lifecycle: TeamDeliverableLifecycle,
  missingRequired: readonly TeamDeliverableKind[],
): TeamDeliverableSummaryStatus {
  if (lifecycle === "none") return "none";
  if (lifecycle === "finalized") return "finalized";
  return missingRequired.length ? "draft_incomplete" : "draft_complete";
}
