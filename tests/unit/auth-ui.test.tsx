import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  GENERIC_LOGIN_ERROR_MESSAGE,
  UNREGISTERED_ACCOUNT_MESSAGE,
} from "@/lib/auth/access-messages";

const getBrowserPocketBase = vi.fn();
vi.doMock("@/lib/pocketbase/client", () => ({ getBrowserPocketBase }));

const { AuthProvider } = await import("@/app/components/auth-provider");
const { LoginScreen } = await import("@/app/components/login-screen");

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function createPocketBase(initiallyAuthenticated = false) {
  let listener: (() => void) | undefined;
  const authStore = {
    token: initiallyAuthenticated ? "existing-token" : "",
    isValid: initiallyAuthenticated,
    record: initiallyAuthenticated ? { id: "user1", enabled: true } : null as Record<string, unknown> | null,
    clear: vi.fn(() => {
      authStore.token = "";
      authStore.isValid = false;
      authStore.record = null;
      listener?.();
    }),
    onChange: vi.fn((nextListener: () => void) => {
      listener = nextListener;
      return () => {
        listener = undefined;
      };
    }),
  };
  const authWithOAuth2 = vi.fn(async () => {
    authStore.token = "oauth-token";
    authStore.isValid = true;
    authStore.record = { id: "user1", enabled: true };
    listener?.();
  });
  const authRefresh = vi.fn(async () => ({ record: authStore.record }));
  return {
    authStore,
    authWithOAuth2,
    authRefresh,
    collection: vi.fn(() => ({ authWithOAuth2, authRefresh })),
  };
}

function renderLogin() {
  return render(
    <AuthProvider>
      <LoginScreen />
    </AuthProvider>,
  );
}

describe("Google login feedback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, "open").mockReturnValue({
      close: vi.fn(),
      location: { href: "" },
    } as unknown as Window);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("shows the account-not-registered message when an existing session loses access", async () => {
    const pb = createPocketBase(true);
    getBrowserPocketBase.mockReturnValue(pb);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(403, {
      error: "email_not_authorized",
      message: UNREGISTERED_ACCOUNT_MESSAGE,
    })));

    renderLogin();

    expect((await screen.findByRole("alert")).textContent).toBe(
      UNREGISTERED_ACCOUNT_MESSAGE,
    );
    expect(pb.authStore.clear).toHaveBeenCalled();
    expect(pb.authStore.token).toBe("");
  });

  it("shows the same safe message after Google authenticates an unregistered account", async () => {
    const pb = createPocketBase();
    getBrowserPocketBase.mockReturnValue(pb);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(403, {
      error: "email_not_authorized",
      message: "Texto del servidor que el cliente no debe mostrar directamente",
    })));

    renderLogin();
    await userEvent.click(screen.getByRole("button", { name: "Continuar con Google" }));

    expect((await screen.findByRole("alert")).textContent).toBe(
      UNREGISTERED_ACCOUNT_MESSAGE,
    );
    expect(pb.authStore.clear).toHaveBeenCalled();
    expect(pb.authStore.token).toBe("");
  });

  it("clears the previous rejection as soon as the person retries", async () => {
    const pb = createPocketBase();
    getBrowserPocketBase.mockReturnValue(pb);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(403, {
      error: "email_not_authorized",
    })));

    renderLogin();
    const button = screen.getByRole("button", { name: "Continuar con Google" });
    await userEvent.click(button);
    expect(await screen.findByRole("alert")).toBeTruthy();

    pb.authWithOAuth2.mockImplementationOnce(() => new Promise(() => undefined));
    await userEvent.click(button);
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
  });

  it("uses the generic message when Google is cancelled", async () => {
    const pb = createPocketBase();
    pb.authWithOAuth2.mockRejectedValueOnce(new Error("OAuth cancelled"));
    getBrowserPocketBase.mockReturnValue(pb);
    vi.stubGlobal("fetch", vi.fn());

    renderLogin();
    await userEvent.click(screen.getByRole("button", { name: "Continuar con Google" }));

    const message = (await screen.findByRole("alert")).textContent;
    expect(message).toBe(GENERIC_LOGIN_ERROR_MESSAGE);
    expect(message).not.toBe(UNREGISTERED_ACCOUNT_MESSAGE);
  });

  it("uses the generic message for an unrecognized bootstrap failure", async () => {
    const pb = createPocketBase();
    getBrowserPocketBase.mockReturnValue(pb);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(503, {
      error: "internal_error",
      message: "Detalle interno",
    })));

    renderLogin();
    await userEvent.click(screen.getByRole("button", { name: "Continuar con Google" }));

    const message = (await screen.findByRole("alert")).textContent;
    expect(message).toBe(GENERIC_LOGIN_ERROR_MESSAGE);
    expect(message).not.toBe(UNREGISTERED_ACCOUNT_MESSAGE);
  });
});
