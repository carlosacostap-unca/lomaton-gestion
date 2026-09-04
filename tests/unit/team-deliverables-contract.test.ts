import { describe, expect, it } from "vitest";

import {
  deriveDeliverableSummaryStatus,
  missingRequiredProducts,
  TEAM_DELIVERABLE_DEFINITIONS,
  TEAM_DELIVERABLE_KINDS,
} from "@/lib/team-deliverables-contract";

describe("team deliverables contract", () => {
  it("define exactamente los cinco productos y sus modalidades", () => {
    expect(TEAM_DELIVERABLE_KINDS).toEqual(["presentation", "canvas", "report", "evidence", "video"]);
    expect(TEAM_DELIVERABLE_DEFINITIONS.map(({ kind, required, media }) => ({ kind, required, media }))).toEqual([
      { kind: "presentation", required: true, media: ["file", "link"] },
      { kind: "canvas", required: true, media: ["file"] },
      { kind: "report", required: true, media: ["file"] },
      { kind: "evidence", required: true, media: ["file", "link"] },
      { kind: "video", required: false, media: ["link"] },
    ]);
  });

  it("deriva faltantes y estados sin contar el video opcional", () => {
    expect(missingRequiredProducts({ presentation: "file", canvas: "file", report: "file", evidence: "link" })).toEqual([]);
    expect(missingRequiredProducts({ presentation: "link" })).toEqual(["canvas", "report", "evidence"]);
    expect(deriveDeliverableSummaryStatus("none", [])).toBe("none");
    expect(deriveDeliverableSummaryStatus("draft", ["report"])).toBe("draft_incomplete");
    expect(deriveDeliverableSummaryStatus("draft", [])).toBe("draft_complete");
    expect(deriveDeliverableSummaryStatus("finalized", [])).toBe("finalized");
  });
});
