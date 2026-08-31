import { describe, expect, it } from "vitest";

import { argentinaInputToUtc, utcToArgentinaInput } from "@/lib/time/argentina";

describe("Argentina deadline conversion", () => {
  it("converts Argentina local time to UTC and back", () => {
    expect(argentinaInputToUtc("2026-09-10T18:30")).toBe("2026-09-10T21:30:00.000Z");
    expect(utcToArgentinaInput("2026-09-10T21:30:00.000Z")).toBe("2026-09-10T18:30");
  });

  it("supports an unset deadline", () => {
    expect(argentinaInputToUtc("")).toBe("");
    expect(utcToArgentinaInput(null)).toBe("");
  });
});
