import { describe, expect, it } from "vitest";
import {
  isInstalledApp,
  isLocalPath,
  readSignInResponse,
  signInUrl,
  type PendingSignIn,
} from "./drive";

const SCOPE = "https://www.googleapis.com/auth/drive.file";
const NOW = Date.parse("2026-09-24T12:00:00.000Z");
const pending: PendingSignIn = { state: "4f1c9a", intent: "backup" };

describe("the address of Google's sign-in page", () => {
  const url = (firstTime: boolean) =>
    new URL(
      signInUrl({
        clientId: "abc.apps.googleusercontent.com",
        redirectUri: "https://health.example/settings",
        state: "4f1c9a",
        firstTime,
      }),
    );

  it("asks for a token to the backup file alone, sent back to Settings", () => {
    const u = url(false);
    expect(`${u.origin}${u.pathname}`).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(u.searchParams.get("client_id")).toBe("abc.apps.googleusercontent.com");
    expect(u.searchParams.get("response_type")).toBe("token");
    expect(u.searchParams.get("scope")).toBe(SCOPE);
    // Google demands an exact match with a registered URI, trailing slash and all.
    expect(u.searchParams.get("redirect_uri")).toBe("https://health.example/settings");
    expect(u.searchParams.get("state")).toBe("4f1c9a");
  });

  it("shows the consent screen only the first time, as the popup does", () => {
    expect(url(true).searchParams.get("prompt")).toBe("consent");
    expect(url(false).searchParams.has("prompt")).toBe(false);
  });
});

/**
 * The page coming back from Google carries a bearer token in its address.
 * Believing the wrong one would send health readings into a stranger's Drive,
 * so the refusals matter more here than the happy path.
 */
describe("reading Google's answer on the way back", () => {
  const answer = (fields: Record<string, string>) => `#${new URLSearchParams(fields)}`;
  const without = (fields: Record<string, string>, key: string) =>
    Object.fromEntries(Object.entries(fields).filter(([name]) => name !== key));
  const granted = {
    access_token: "ya29.a0token",
    token_type: "Bearer",
    expires_in: "3599",
    scope: SCOPE,
    state: "4f1c9a",
  };

  it("leaves an address with no answer in it alone", () => {
    expect(readSignInResponse("", pending, NOW)).toBeNull();
    // The dashboard links to exactly this: Settings, scrolled to the Drive card.
    expect(readSignInResponse("#drive-backup", pending, NOW)).toBeNull();
  });

  it("keeps the token, with its lifetime, and says what the tap was for", () => {
    expect(readSignInResponse(answer(granted), pending, NOW)).toEqual({
      ok: true,
      token: "ya29.a0token",
      expiresAt: NOW + 3_599_000,
      intent: "backup",
    });
  });

  it("carries a restore or a replace through, not just a backup", () => {
    const restore = readSignInResponse(answer(granted), { ...pending, intent: "restore" }, NOW);
    expect(restore).toMatchObject({ ok: true, intent: "restore" });
  });

  it("refuses a token whose state does not match the one sent", () => {
    const forged = readSignInResponse(answer({ ...granted, state: "attacker" }), pending, NOW);
    expect(forged).toMatchObject({ ok: false });
    expect(forged).not.toHaveProperty("token");
  });

  it("refuses a token when this device never started a sign-in", () => {
    expect(readSignInResponse(answer(granted), null, NOW)).toMatchObject({ ok: false });
  });

  it("refuses a token that arrives with no state at all", () => {
    expect(readSignInResponse(answer(without(granted, "state")), pending, NOW)).toMatchObject({
      ok: false,
    });
  });

  it("says plainly when the person cancelled at Google", () => {
    expect(
      readSignInResponse(answer({ error: "access_denied", state: "4f1c9a" }), pending, NOW),
    ).toEqual({ ok: false, message: "Sign-in was cancelled." });
  });

  it("names any other error Google sends back", () => {
    const failed = readSignInResponse(answer({ error: "server_error", state: "4f1c9a" }), pending, NOW);
    expect(failed).toMatchObject({ ok: false });
    expect((failed as { message: string }).message).toContain("server_error");
  });

  it("refuses a token that does not reach the backup file", () => {
    // Google's consent screen can let someone untick the one permission asked for.
    const unticked = readSignInResponse(answer({ ...granted, scope: "openid email" }), pending, NOW);
    expect(unticked).toMatchObject({ ok: false });
  });

  it("falls back to Google's usual hour when no lifetime comes back", () => {
    expect(readSignInResponse(answer(without(granted, "expires_in")), pending, NOW)).toMatchObject({
      ok: true,
      expiresAt: NOW + 3_600_000,
    });
  });
});

/**
 * Which way sign-in goes. Getting it wrong in one direction leaves an iPhone
 * app's button spinning forever; in the other, a desktop tab reloads to sign
 * in when a popup would have done.
 */
describe("telling an installed app from a browser tab", () => {
  const withModes = (...modes: string[]) => ({
    matchMedia: (query: string) => ({
      matches: modes.some((mode) => query.includes(`display-mode: ${mode}`)),
    }),
  });

  it("recognises an app opened from an iPhone's Home Screen", () => {
    expect(isInstalledApp({ standalone: true })).toBe(true);
    expect(isInstalledApp({ standalone: true, ...withModes("standalone") })).toBe(true);
  });

  it("recognises an app installed on any other platform", () => {
    expect(isInstalledApp(withModes("standalone"))).toBe(true);
  });

  it("counts the mode a browser falls back to when it cannot do standalone", () => {
    expect(isInstalledApp(withModes("minimal-ui"))).toBe(true);
  });

  it("leaves a tab in fullscreen as a tab", () => {
    // Chrome reports fullscreen for an ordinary tab after F11; this app's
    // manifest never asks for it.
    expect(isInstalledApp(withModes("fullscreen"))).toBe(false);
  });

  it("leaves a browser tab as a tab", () => {
    expect(isInstalledApp(withModes("browser"))).toBe(false);
    expect(isInstalledApp({ standalone: false, ...withModes("browser") })).toBe(false);
  });

  it("stays a tab when the browser has no way to say", () => {
    expect(isInstalledApp({})).toBe(false);
  });

  it("stays a tab rather than breaking sign-in when the browser throws", () => {
    // Older Safari threw on a media feature it did not know, instead of
    // reporting no match.
    const throwing = {
      matchMedia: () => {
        throw new Error("unsupported media feature");
      },
    };
    expect(isInstalledApp(throwing)).toBe(false);
  });
});

/**
 * A sign-in started in the first run is sent on from Settings to wherever it
 * began, with a bearer token in its fragment. That destination must be on
 * this site, whatever the stored record says.
 */
describe("where a sign-in may be sent on to", () => {
  it("accepts a page on this site, with its query", () => {
    expect(isLocalPath("/welcome?step=backup")).toBe(true);
    expect(isLocalPath("/settings")).toBe(true);
  });

  it("refuses anything that could reach another host", () => {
    expect(isLocalPath("//elsewhere.example/steal")).toBe(false);
    expect(isLocalPath("https://elsewhere.example")).toBe(false);
    // Some browsers read a backslash as a slash, making this "//elsewhere".
    expect(isLocalPath("/\\elsewhere.example")).toBe(false);
  });

  it("refuses what is not a path at all", () => {
    expect(isLocalPath("welcome")).toBe(false);
    expect(isLocalPath("")).toBe(false);
    expect(isLocalPath(undefined)).toBe(false);
    expect(isLocalPath(42)).toBe(false);
  });
});
