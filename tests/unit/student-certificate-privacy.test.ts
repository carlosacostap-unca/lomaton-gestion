// @vitest-environment node

import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("student certificate privacy boundaries", () => {
  it("keeps the certificate collection out of operational snapshots and exports", () => {
    const root = process.cwd();
    const snapshot = fs.readFileSync(path.join(root, "lib/report/snapshot.ts"), "utf8");
    const exportRoute = fs.readFileSync(path.join(root, "app/api/exports/[kind]/[format]/route.ts"), "utf8");
    expect(snapshot).not.toContain("student_certificates");
    expect(exportRoute).not.toContain("student_certificates");
    expect(exportRoute).not.toContain("sha256");
    expect(exportRoute).not.toContain("originalName");
  });
});
