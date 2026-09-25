"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  beginRedirectSignIn,
  completeRedirectSignIn,
  driveConfigured,
  hasLiveToken,
  prepareSignIn,
  signInMethod,
  type SignInIntent,
} from "@/lib/drive";
import { timeAgo } from "@/lib/format";
import { useStore } from "@/lib/store";
import {
  SYNC_EVENT,
  backUp,
  disconnect,
  loadSync,
  restore,
  type SyncRecord,
} from "@/lib/sync";
import { BTN_PRIMARY, BTN_SECONDARY, Card, SectionTitle } from "./ui";

/**
 * `resumeAt` is where a sign-in by redirect should finish, when that is not
 * Settings: the first run passes its own backup step, so an installed app
 * comes back to the setup it left rather than to the Settings page.
 */
export function DriveCard({ resumeAt }: { resumeAt?: string } = {}) {
  const { entries, profile, importSnapshot, saveFailed } = useStore();
  const [sync, setSync] = useState<SyncRecord>({ connected: false });
  const [busy, setBusy] = useState<"backup" | "restore" | "signin" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmRestore, setConfirmRestore] = useState(false);

  // localStorage is only readable on the client, so the record arrives after
  // mount rather than during render.
  useEffect(() => {
    setSync(loadSync());
    const follow = (e: Event) => setSync((e as CustomEvent<SyncRecord>).detail);
    window.addEventListener(SYNC_EVENT, follow);
    return () => window.removeEventListener(SYNC_EVENT, follow);
  }, []);

  // Fetched while the card is on screen, so a tap in a browser tab goes
  // straight to Google's popup instead of spending itself on the download.
  useEffect(() => {
    if (driveConfigured) prepareSignIn();
  }, []);

  // A page restored from the back-forward cache — someone backing out of
  // Google's page — would otherwise sit on "Opening Google" for good.
  useEffect(() => {
    const reset = (event: PageTransitionEvent) => {
      if (event.persisted) setBusy(null);
    };
    window.addEventListener("pageshow", reset);
    return () => window.removeEventListener("pageshow", reset);
  }, []);

  /**
   * In an installed app, a tap with no token in hand signs in by leaving for
   * Google's page; what it was for is done on the way back, below. True once
   * that is under way (or refused), so the caller goes no further.
   */
  const leaveToSignIn = useCallback(
    (intent: SignInIntent): boolean => {
      if (signInMethod() !== "redirect" || hasLiveToken()) return false;
      setMessage(null);
      setError(null);
      // Leaving reloads the app, and readings this device could not store
      // exist only in memory until then.
      if (saveFailed) {
        setError(
          "Signing in to Google reloads the app, and this device is not saving readings right now. Export a backup file first, under Your data.",
        );
        return true;
      }
      setBusy("signin");
      try {
        beginRedirectSignIn(intent, resumeAt);
      } catch (err) {
        setBusy(null);
        setError((err as Error).message);
      }
      return true;
    },
    [saveFailed, resumeAt],
  );

  const runBackup = useCallback(
    async (force: boolean) => {
      if (leaveToSignIn(force ? "replace" : "backup")) return;
      setBusy("backup");
      setMessage(null);
      setError(null);
      const result = await backUp({ entries, profile }, { interactive: true, force });
      setBusy(null);
      if (result.ok) setMessage("Backed up to Drive.");
      else if (result.reason === "error") setError(result.message);
      // A conflict needs no message here — the card re-renders into the
      // conflict branch, which explains itself.
    },
    [entries, profile, leaveToSignIn],
  );

  const runRestore = useCallback(async () => {
    if (leaveToSignIn("restore")) return;
    setBusy("restore");
    setMessage(null);
    setError(null);
    const result = await restore(true);
    setBusy(null);
    setConfirmRestore(false);
    if (result.ok) {
      importSnapshot(result.snapshot);
      setMessage(`Restored ${result.snapshot.entries.length} readings from Drive.`);
    } else {
      setError(result.message);
    }
  }, [importSnapshot, leaveToSignIn]);

  // Back from Google's page: keep the token, then do what the tap was for.
  // The person already confirmed a restore or a replace before leaving.
  const resumed = useRef(false);
  useEffect(() => {
    if (resumed.current) return;
    resumed.current = true;
    const returned = completeRedirectSignIn();
    if (!returned) return;
    if (!returned.ok) setError(returned.message);
    else if (returned.intent === "restore") void runRestore();
    else void runBackup(returned.intent === "replace");
  }, [runBackup, runRestore]);

  if (!driveConfigured) {
    return (
      <section id="drive-backup" className="mb-6 scroll-mt-20">
        <SectionTitle>Google Drive backup</SectionTitle>
        <Card>
          <p className="text-sm text-muted">
            Not set up for this build. Add a{" "}
            <code className="rounded bg-surface-2 px-1 py-0.5 text-xs">
              NEXT_PUBLIC_GOOGLE_CLIENT_ID
            </code>{" "}
            environment variable to switch it on. Until then, Export and Import above move
            your readings between devices by hand.
          </p>
        </Card>
      </section>
    );
  }

  return (
    <section id="drive-backup" className="mb-6 scroll-mt-20">
      <SectionTitle>Google Drive backup</SectionTitle>
      <Card className="space-y-3">
        {sync.conflict ? (
          <div className="space-y-3">
            <p className="text-sm">
              {sync.conflictFirstConnect
                ? `Drive already has a backup from ${timeAgo(Date.parse(sync.conflictRemoteTime ?? ""))}, made on another device. Nothing has been overwritten — restore it here, or replace it with this device's readings.`
                : `Drive holds a copy this device has not seen, from ${timeAgo(Date.parse(sync.conflictRemoteTime ?? ""))} — probably logged elsewhere. Nothing has been overwritten. Pick which one to keep.`}
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setConfirmRestore(true)}
                disabled={busy !== null}
                className={`${BTN_PRIMARY} text-sm disabled:opacity-50`}
              >
                {busy === "restore" ? "Restoring…" : "Restore from Drive"}
              </button>
              <button
                onClick={() => void runBackup(true)}
                disabled={busy !== null}
                className={`${BTN_SECONDARY} text-sm disabled:opacity-50`}
              >
                {busy === "backup" ? "Replacing…" : "Replace Drive with this device"}
              </button>
            </div>
          </div>
        ) : sync.connected ? (
          <>
            <p className="text-sm text-muted">
              Connected. Last backup {timeAgo(sync.lastSyncedAt)}
              {sync.pendingSince ? " — a newer reading is still waiting to go up." : "."}
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => void runBackup(false)}
                disabled={busy !== null}
                className={`${BTN_SECONDARY} text-sm disabled:opacity-50`}
              >
                {busy === "backup" ? "Backing up…" : "Back up now"}
              </button>
              <button
                onClick={() => setConfirmRestore(true)}
                disabled={busy !== null}
                className={`${BTN_SECONDARY} text-sm disabled:opacity-50`}
              >
                Restore from Drive
              </button>
              <button
                onClick={() => {
                  disconnect();
                  setMessage("Disconnected. Your Drive file is untouched.");
                }}
                className={`${BTN_SECONDARY} text-sm`}
              >
                Disconnect
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-muted">
              Keeps one backup file in your own Drive and re-uploads it after every reading
              you save, so your laptop and your phone stay in step. It can only see the file
              it creates — none of your other Drive files.
            </p>
            <button
              onClick={() => void runBackup(false)}
              disabled={busy !== null}
              className={`${BTN_PRIMARY} text-sm disabled:opacity-50`}
            >
              {busy ? "Connecting…" : "Connect Google Drive"}
            </button>
          </>
        )}

        {sync.lastError && !sync.conflict ? (
          <p className="text-sm text-warn">Last attempt failed: {sync.lastError}</p>
        ) : null}
        {busy === "signin" ? (
          <p role="status" aria-live="polite" className="text-sm text-muted">
            Opening Google&apos;s sign-in page…
          </p>
        ) : null}
        {message ? (
          <p role="status" aria-live="polite" className="text-sm text-good">
            {message}
          </p>
        ) : null}
        {error ? (
          <p role="alert" aria-live="assertive" className="text-sm text-bad">
            {error}
          </p>
        ) : null}

        {confirmRestore ? (
          <div className="rounded-xl border border-border bg-surface-2 p-3">
            <p className="text-sm">
              Replace the {entries.length} reading{entries.length === 1 ? "" : "s"} on this
              device with the copy from Drive? Anything here that is not in the backup will
              be lost.
            </p>
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => void runRestore()}
                disabled={busy !== null}
                className={`${BTN_PRIMARY} text-sm disabled:opacity-50`}
              >
                {busy === "restore" ? "Restoring…" : "Yes, restore"}
              </button>
              <button
                onClick={() => setConfirmRestore(false)}
                className={`${BTN_SECONDARY} text-sm`}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}
      </Card>
    </section>
  );
}
