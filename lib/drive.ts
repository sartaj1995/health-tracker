/**
 * Google Drive backup.
 *
 * Uses the `drive.file` scope, which only ever grants access to files this app
 * itself created. Google classes it as non-sensitive, so it needs no app
 * verification and shows no "unverified app" warning, and the rest of your
 * Drive stays invisible to it.
 *
 * There is no backend: the browser talks to Drive directly, and the client ID
 * is public by design for this flow.
 *
 * Deliberately isolated from any other tracker app sharing this machine — its
 * own Drive filename, its own storage keys, and its own OAuth client. Nothing
 * here can see or touch another app's backup file.
 *
 * Signing in takes one of two routes. A browser tab uses Google's popup, which
 * never leaves the page. An app installed to the Home Screen cannot: on an
 * iPhone its popup opens somewhere the app never hears back from, so it leaves
 * for Google's sign-in page instead and comes back to Settings.
 */

const SCOPE = "https://www.googleapis.com/auth/drive.file";
const FILE_NAME = "health-tracker-backup.json";
const GIS_SRC = "https://accounts.google.com/gsi/client";
const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const REVOKE_ENDPOINT = "https://oauth2.googleapis.com/revoke";
const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
const TOKEN_KEY = "ht.drive.token.v1";
const PENDING_KEY = "ht.drive.signin.v1";
/**
 * Where a sign-in by redirect lands. It has to be listed, exactly, among the
 * OAuth client's authorised redirect URIs — see the Drive setup in README.md.
 */
const RETURN_PATH = "/settings";

/** Without a client ID the whole feature stays hidden rather than half-working. */
export const driveConfigured = Boolean(CLIENT_ID);

export interface RemoteFile {
  id: string;
  modifiedTime: string;
}

interface TokenResponse {
  access_token?: string;
  expires_in?: number;
  error?: string;
}

interface TokenClient {
  requestAccessToken: (overrides?: { prompt?: string }) => void;
}

interface GoogleGis {
  accounts: {
    oauth2: {
      initTokenClient: (config: {
        client_id: string;
        scope: string;
        prompt?: string;
        callback: (response: TokenResponse) => void;
        error_callback?: (error: { type?: string }) => void;
      }) => TokenClient;
    };
  };
}

declare global {
  interface Window {
    google?: GoogleGis;
  }
}

let gisLoading: Promise<GoogleGis> | null = null;

function loadGis(): Promise<GoogleGis> {
  if (window.google?.accounts?.oauth2) return Promise.resolve(window.google);
  if (gisLoading) return gisLoading;

  gisLoading = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${GIS_SRC}"]`,
    );
    const script = existing ?? document.createElement("script");
    script.src = GIS_SRC;
    script.async = true;
    script.onload = () => {
      if (window.google?.accounts?.oauth2) resolve(window.google);
      else reject(new Error("Google's sign-in library loaded but looks wrong."));
    };
    script.onerror = () => {
      gisLoading = null;
      reject(new Error("Could not reach Google. Are you online?"));
    };
    if (!existing) document.head.appendChild(script);
  });
  return gisLoading;
}

let accessToken: string | null = null;
let expiresAt = 0;
let tokenLoaded = false;

/**
 * Read lazily rather than at module scope: these pages are prerendered at build
 * time, where there is no localStorage to read.
 */
function loadToken(): void {
  if (tokenLoaded || typeof window === "undefined") return;
  tokenLoaded = true;
  try {
    const stored = window.localStorage.getItem(TOKEN_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as { token: string; expiresAt: number };
      accessToken = parsed.token;
      expiresAt = parsed.expiresAt;
    }
  } catch {
    // Unreadable or blocked; we just start without a token.
  }
}

function remember(token: string | null, expiry: number): void {
  tokenLoaded = true;
  accessToken = token;
  expiresAt = expiry;
  try {
    if (token) {
      window.localStorage.setItem(
        TOKEN_KEY,
        JSON.stringify({ token, expiresAt: expiry }),
      );
    } else {
      window.localStorage.removeItem(TOKEN_KEY);
    }
  } catch {
    // In-memory only for this session, which is still useful.
  }
}

export function hasLiveToken(): boolean {
  loadToken();
  return Boolean(accessToken) && Date.now() < expiresAt - 60_000;
}

/** Thrown when a sign-in is needed but no user gesture is available. */
export const NEEDS_SIGN_IN = "Google sign-in needed.";

/**
 * What an installed app looks like from the inside. Passed in, rather than
 * read off `window`, so the check can be tested without a browser.
 */
export interface DisplayProbe {
  /** Safari's own flag: true in an app opened from an iPhone's Home Screen. */
  standalone?: boolean;
  /** `window.matchMedia`, where the browser has it. */
  matchMedia?: (query: string) => { matches: boolean };
}

/**
 * The display modes this app runs in once installed. The manifest asks for
 * `standalone`, and a browser that cannot do that falls back to `minimal-ui`.
 * `fullscreen` is left out on purpose: Chrome also reports it for an ordinary
 * tab after F11, which would send a desktop tab away to sign in for nothing.
 */
const INSTALLED_MODES = ["standalone", "minimal-ui"];

/**
 * Whether this page is running as an installed app rather than in a browser
 * tab, which decides how a tap signs in: an installed app leaves for Google's
 * page and comes back, a tab keeps the popup.
 */
export function isInstalledApp(probe: DisplayProbe): boolean {
  if (probe.standalone === true) return true;
  return INSTALLED_MODES.some((mode) => {
    try {
      return probe.matchMedia?.(`(display-mode: ${mode})`).matches === true;
    } catch {
      // Older Safari threw on a media feature it did not know, instead of
      // reporting no match. A tab is the safe answer: sign-in still works.
      return false;
    }
  });
}

/** How a tap signs in to Google on this device. */
export function signInMethod(): "popup" | "redirect" {
  if (typeof window === "undefined") return "popup";
  const probe: DisplayProbe = {
    standalone: (window.navigator as Navigator & { standalone?: boolean }).standalone,
    matchMedia: typeof window.matchMedia === "function" ? (q) => window.matchMedia(q) : undefined,
  };
  return isInstalledApp(probe) ? "redirect" : "popup";
}

// --- Signing in with the popup, in a browser tab ---------------------------

let tokenClient: TokenClient | null = null;
let waiting: { resolve: (token: string) => void; reject: (error: Error) => void } | null = null;

/** Hands the popup's answer to whichever tap is waiting for one. */
function settle(outcome: { token: string } | { error: Error }): void {
  const tap = waiting;
  waiting = null;
  if (!tap) return;
  if ("token" in outcome) tap.resolve(outcome.token);
  else tap.reject(outcome.error);
}

const POPUP_ERRORS: Record<string, string> = {
  popup_closed: "Sign-in was closed before it finished.",
  popup_failed_to_open:
    "The browser blocked Google's sign-in window. Allow pop-ups for this site, then try again.",
};

/** One client, made once, the way Google's own examples set it up at load. */
function clientFor(gis: GoogleGis, clientId: string): TokenClient {
  tokenClient ??= gis.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: SCOPE,
    callback: (response) => {
      if (response.error || !response.access_token) {
        settle({ error: new Error(response.error ?? "Google did not return a token.") });
        return;
      }
      remember(response.access_token, Date.now() + (response.expires_in ?? 3600) * 1000);
      settle({ token: response.access_token });
    },
    error_callback: (error) => {
      settle({ error: new Error(POPUP_ERRORS[error.type ?? ""] ?? "Google sign-in failed.") });
    },
  });
  return tokenClient;
}

/**
 * Fetch Google's sign-in script before anyone taps.
 *
 * Safari lets a tap open a popup for well under a second. Fetching the script
 * inside the tap spent that second on a phone connection, so the first tap
 * was always blocked and only a second one worked. With the script already
 * here, the tap goes straight to the popup.
 */
export function prepareSignIn(): void {
  if (!CLIENT_ID || typeof window === "undefined" || signInMethod() !== "popup") return;
  const clientId = CLIENT_ID;
  loadGis()
    .then((gis) => clientFor(gis, clientId))
    .catch(() => {
      // Nothing to show yet: it is reported if someone taps before it loads.
    });
}

/**
 * A token for Drive: the one in hand while it is good, otherwise a sign-in.
 *
 * Only an `interactive` call — one made from a tap — may reach Google, and
 * only in a browser tab; an installed app signs in by leaving the page, which
 * the Drive card starts itself. A stored token is reused either way, so a
 * backup owed from earlier can still go up on its own within the token's hour.
 *
 * Deliberately not async. A popup only opens while the tap that asked for it
 * is still being handled, so nothing between the tap and requestAccessToken
 * waits on anything — not even on a promise that has already settled.
 */
export function authorise(interactive: boolean): Promise<string> {
  if (!CLIENT_ID) return Promise.reject(new Error("Google Drive is not configured for this build."));
  if (hasLiveToken()) return Promise.resolve(accessToken as string);

  // Google's token request can raise a sign-in popup even when asked to stay
  // quiet. A popup nobody asked for is worse than a backup that waits, so
  // background callers stop here and the UI offers a button instead.
  if (!interactive || signInMethod() !== "popup") return Promise.reject(new Error(NEEDS_SIGN_IN));

  const gis = window.google?.accounts?.oauth2 ? window.google : null;
  if (!gis) {
    prepareSignIn();
    return Promise.reject(new Error("Google sign-in is still loading. Try again in a moment."));
  }
  const client = clientFor(gis, CLIENT_ID);
  return new Promise<string>((resolve, reject) => {
    // A second tap while a popup is still open takes over from the first.
    settle({ error: new Error("Sign-in was started again.") });
    waiting = { resolve, reject };
    client.requestAccessToken({ prompt: hasEverGranted() ? "" : "consent" });
  });
}

// --- Signing in by leaving the page, in an installed app --------------------

/** What a tap that left for Google's page was for, to be done on the way back. */
export type SignInIntent = "backup" | "replace" | "restore";
const INTENTS: readonly SignInIntent[] = ["backup", "replace", "restore"];

export type PendingSignIn = {
  state: string;
  intent: SignInIntent;
  /**
   * Where the sign-in was started, when that was not Settings. Google always
   * sends the answer back to Settings — the one registered address — and it
   * is passed on from there. The page named must show the Drive card.
   */
  resumeAt?: string;
};

/**
 * A path on this site, and nothing that could leave it: "//elsewhere.example"
 * and a backslash both read as another host to some browsers.
 */
export function isLocalPath(path: unknown): path is string {
  return (
    typeof path === "string" &&
    path.startsWith("/") &&
    !path.startsWith("//") &&
    !path.includes("\\")
  );
}

/** The address of Google's sign-in page, for a sign-in that comes back here. */
export function signInUrl({
  clientId,
  redirectUri,
  state,
  firstTime,
}: {
  clientId: string;
  redirectUri: string;
  state: string;
  firstTime: boolean;
}): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "token",
    scope: SCOPE,
    state,
  });
  // The popup's rule: the consent screen only the first time.
  if (firstTime) params.set("prompt", "consent");
  return `${AUTH_ENDPOINT}?${params}`;
}

/**
 * Leave for Google's sign-in page, remembering what the tap was for. The
 * answer comes back to Settings in the address fragment, where
 * completeRedirectSignIn picks it up.
 *
 * Throws, without leaving, when that cannot be remembered: a token that comes
 * back to a device with no record of asking for it gets thrown away.
 */
export function beginRedirectSignIn(intent: SignInIntent, resumeAt?: string): void {
  if (!CLIENT_ID) throw new Error("Google Drive is not configured for this build.");
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const pending: PendingSignIn = {
    state: Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join(""),
    intent,
    ...(isLocalPath(resumeAt) ? { resumeAt } : {}),
  };
  try {
    window.localStorage.setItem(PENDING_KEY, JSON.stringify(pending));
  } catch {
    throw new Error("This device is not letting the app store anything, so it cannot sign in.");
  }
  window.location.assign(
    signInUrl({
      clientId: CLIENT_ID,
      redirectUri: window.location.origin + RETURN_PATH,
      state: pending.state,
      firstTime: !hasEverGranted(),
    }),
  );
}

/** The fields of a sign-in answer, or null for any other fragment — an #anchor, or none. */
function answerIn(fragment: string): URLSearchParams | null {
  const params = new URLSearchParams(fragment.replace(/^#/, ""));
  return params.has("access_token") || params.has("error") ? params : null;
}

export type SignInAnswer =
  | { ok: true; token: string; expiresAt: number; intent: SignInIntent }
  | { ok: false; message: string };

/**
 * Judge the answer Google put in the address fragment. Null when there is no
 * answer there to judge.
 *
 * The token is only believed when it carries the state this device sent.
 * Without that check, anyone could hand the app a link carrying *their* token,
 * and every backup after it would go quietly into their Drive.
 */
export function readSignInResponse(
  fragment: string,
  pending: PendingSignIn | null,
  now: number,
): SignInAnswer | null {
  const params = answerIn(fragment);
  if (!params) return null;

  if (!pending || params.get("state") !== pending.state) {
    return {
      ok: false,
      message: "A Google sign-in arrived that this device did not ask for, so it was ignored.",
    };
  }
  const error = params.get("error");
  if (error) {
    return {
      ok: false,
      message: error === "access_denied" ? "Sign-in was cancelled." : `Google sign-in failed (${error}).`,
    };
  }
  // Google can let someone untick a permission on its consent screen.
  const scopes = params.get("scope");
  if (scopes !== null && !scopes.split(" ").includes(SCOPE)) {
    return {
      ok: false,
      message: "Google did not give access to the backup file. Try again, and allow it.",
    };
  }
  const seconds = Number(params.get("expires_in"));
  return {
    ok: true,
    token: params.get("access_token") as string,
    expiresAt: now + (seconds > 0 ? seconds : 3600) * 1000,
    intent: pending.intent,
  };
}

/** The record of a sign-in in progress, if there is a sound one. */
function readPending(): PendingSignIn | null {
  try {
    const raw = window.localStorage.getItem(PENDING_KEY);
    const pending = raw ? (JSON.parse(raw) as Partial<PendingSignIn>) : null;
    if (
      !pending ||
      typeof pending.state !== "string" ||
      !INTENTS.includes(pending.intent as SignInIntent)
    ) {
      return null;
    }
    return {
      state: pending.state,
      intent: pending.intent as SignInIntent,
      ...(isLocalPath(pending.resumeAt) ? { resumeAt: pending.resumeAt } : {}),
    };
  } catch {
    return null;
  }
}

/** Each record is good for one answer. */
function clearPending(): void {
  try {
    window.localStorage.removeItem(PENDING_KEY);
  } catch {
    // Nothing was stored, then.
  }
}

export type SignInReturn = { ok: true; intent: SignInIntent } | { ok: false; message: string };

/**
 * Finish a sign-in that left for Google's page, if this page load is the way
 * back from one. Null when there is nothing to finish here.
 */
export function completeRedirectSignIn(): SignInReturn | null {
  if (typeof window === "undefined") return null;
  const fragment = window.location.hash;
  if (!answerIn(fragment)) return null;

  // Google always answers at Settings. A sign-in started elsewhere is sent on,
  // answer and all, to finish where the person was — the record stays for the
  // page that takes it.
  const pending = readPending();
  const here = window.location.pathname + window.location.search;
  if (pending?.resumeAt && pending.resumeAt !== here) {
    window.location.replace(pending.resumeAt + fragment);
    return null;
  }

  // Out of the address bar, and out of history, before anything else runs.
  window.history.replaceState(
    window.history.state,
    "",
    window.location.pathname + window.location.search,
  );
  clearPending();
  const answer = readSignInResponse(fragment, pending, Date.now());
  if (!answer) return null;
  if (!answer.ok) return answer;
  remember(answer.token, answer.expiresAt);
  return { ok: true, intent: answer.intent };
}

// ---------------------------------------------------------------------------

/** A previous grant means Google can usually reissue without a full prompt. */
function hasEverGranted(): boolean {
  try {
    return window.localStorage.getItem(TOKEN_KEY) !== null;
  } catch {
    return false;
  }
}

export function forgetToken(): void {
  loadToken();
  const token = accessToken;
  remember(null, 0);
  if (!token) return;
  // Straight to Google's endpoint rather than through its script, which an
  // installed app never loads. The endpoint sends no CORS headers, so the
  // reply cannot be read, and does not need to be.
  void fetch(REVOKE_ENDPOINT, {
    method: "POST",
    mode: "no-cors",
    body: new URLSearchParams({ token }),
  }).catch(() => {
    // Offline: the token runs out within the hour regardless.
  });
}

async function call(
  token: string,
  url: string,
  init: RequestInit = {},
): Promise<Response> {
  const res = await fetch(url, {
    ...init,
    headers: { ...init.headers, Authorization: `Bearer ${token}` },
  });
  if (res.status === 401) {
    remember(null, 0);
    throw new Error("Google sign-in expired. Connect again.");
  }
  if (!res.ok) throw new Error(`Drive returned ${res.status}. Try again in a moment.`);
  return res;
}

/**
 * This app's own backup file, if it has made one.
 *
 * The name filter is a second line of defence: even if this build were ever
 * pointed at another app's OAuth client by mistake, it would still never match
 * that app's backup file.
 */
export async function findBackup(token: string): Promise<RemoteFile | null> {
  const query = encodeURIComponent(`name = '${FILE_NAME}' and trashed = false`);
  const res = await call(
    token,
    `https://www.googleapis.com/drive/v3/files?q=${query}&spaces=drive&fields=files(id,modifiedTime)&orderBy=modifiedTime desc`,
  );
  const body = (await res.json()) as { files?: RemoteFile[] };
  return body.files?.[0] ?? null;
}

export async function uploadBackup(
  token: string,
  contents: string,
  fileId?: string,
): Promise<RemoteFile> {
  const res = fileId
    ? await call(
        token,
        `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media&fields=id,modifiedTime`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: contents,
        },
      )
    : await call(
        token,
        "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,modifiedTime",
        {
          method: "POST",
          headers: { "Content-Type": "multipart/related; boundary=ht" },
          body: [
            "--ht",
            "Content-Type: application/json; charset=UTF-8",
            "",
            JSON.stringify({ name: FILE_NAME, mimeType: "application/json" }),
            "--ht",
            "Content-Type: application/json",
            "",
            contents,
            "--ht--",
            "",
          ].join("\r\n"),
        },
      );
  return (await res.json()) as RemoteFile;
}

export async function downloadBackup(
  token: string,
  fileId: string,
): Promise<string> {
  const res = await call(
    token,
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
  );
  return res.text();
}
