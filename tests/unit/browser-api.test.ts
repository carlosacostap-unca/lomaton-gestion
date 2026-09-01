import { beforeEach, describe, expect, it } from "vitest";

import {
  BrowserApiError,
  getBrowserAuthorizationHeader,
} from "@/lib/pocketbase/browser-api";
import { getBrowserPocketBase } from "@/lib/pocketbase/client";

describe("PocketBase browser authorization", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_POCKETBASE_URL = "https://pb-lomaton.epixum.com";
    getBrowserPocketBase().authStore.clear();
  });

  it("formats the PocketBase token as an HTTP Bearer credential", () => {
    getBrowserPocketBase().authStore.save("session-token", null);

    expect(getBrowserAuthorizationHeader()).toBe("Bearer session-token");
  });

  it("rejects requests when the browser has no session", () => {
    expect(() => getBrowserAuthorizationHeader()).toThrowError(
      new BrowserApiError("La sesión venció.", 401),
    );
  });
});
