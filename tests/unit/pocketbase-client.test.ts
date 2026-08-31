import { describe, expect, it } from "vitest";

import { createIsolatedPocketBase } from "@/lib/pocketbase/client";

describe("PocketBase browser client isolation", () => {
  it("does not share authentication state between two sessions", () => {
    const first = createIsolatedPocketBase("https://pb-lomaton.epixum.com");
    const second = createIsolatedPocketBase("https://pb-lomaton.epixum.com");

    first.authStore.save("session-a", null);

    expect(first.authStore.token).toBe("session-a");
    expect(second.authStore.token).toBe("");
  });
});
