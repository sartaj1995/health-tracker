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
 */

const SCOPE = "https://www.googleapis.com/auth/drive.file";
const FILE_NAME = "health-tracker-backup.json";
const GIS_SRC = "https://accounts.google.com/gsi/client";
const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
const TOKEN_KEY = "ht.drive.token.v1";

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
      revoke: (token: string, done?: () => void) => void;
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
 * Only an `interactive` call — one made from a tap — may reach Google. A stored
 * token is reused either way, so a backup owed from earlier can still go up on
 * its own later, as long as it is within the token's hour.
 */
export async function authorise(interactive: boolean): Promise<string> {
  if (!CLIENT_ID) throw new Error("Google Drive is not configured for this build.");
  if (hasLiveToken()) return accessToken as string;

  // Google's token request can raise a sign-in popup even when asked to stay
  // quiet. A popup nobody asked for is worse than a backup that waits, so
  // background callers stop here and the UI offers a button instead.
  if (!interactive) throw new Error(NEEDS_SIGN_IN);

  const gis = await loadGis();
  return new Promise<string>((resolve, reject) => {
    const client = gis.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPE,
      callback: (response) => {
        if (response.error || !response.access_token) {
          reject(new Error(response.error ?? "Google did not return a token."));
          return;
        }
        remember(
          response.access_token,
          Date.now() + (response.expires_in ?? 3600) * 1000,
        );
        resolve(response.access_token);
      },
      error_callback: (error) => {
        reject(
          new Error(
            error.type === "popup_closed"
              ? "Sign-in was closed before it finished."
              : "Google sign-in failed.",
          ),
        );
      },
    });
    client.requestAccessToken({ prompt: hasEverGranted() ? "" : "consent" });
  });
}

/** A previous grant means Google can usually reissue without a full prompt. */
function hasEverGranted(): boolean {
  try {
    return window.localStorage.getItem(TOKEN_KEY) !== null;
  } catch {
    return false;
  }
}

export function forgetToken(): void {
  const token = accessToken;
  remember(null, 0);
  if (token) window.google?.accounts.oauth2.revoke(token);
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
