"use client";

import { useCallback, useEffect, useState } from "react";
import { driveConfigured } from "@/lib/drive";
import { formatFullDate } from "@/lib/format";
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

function when(ms?: number | null): string {
  if (!ms || Number.isNaN(ms)) return "never";
  const diff = Date.now() - ms;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} h ago`;
  // Falls back to the app's own date style rather than the locale default,
  // so this reads like every other date on screen.
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return formatFullDate(
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
  );
}

export function DriveCard() {
  const { entries, profile, importSnapshot } = useStore();
  const [sync, setSync] = useState<SyncRecord>({ connected: false });
  const [busy, setBusy] = useState<"backup" | "restore" | null>(null);
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

  const runBackup = useCallback(
    async (force: boolean) => {
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
    [entries, profile],
  );

  const runRestore = useCallback(async () => {
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
  }, [importSnapshot]);

  if (!driveConfigured) {
    return (
      <section className="mb-6">
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
    <section className="mb-6">
      <SectionTitle>Google Drive backup</SectionTitle>
      <Card className="space-y-3">
        {sync.conflict ? (
          <div className="space-y-3">
            <p className="text-sm">
              {sync.conflictFirstConnect
                ? `Drive already has a backup from ${when(Date.parse(sync.conflictRemoteTime ?? ""))}, made on another device. Nothing has been overwritten — restore it here, or replace it with this device's readings.`
                : `Drive holds a copy this device has not seen, from ${when(Date.parse(sync.conflictRemoteTime ?? ""))} — probably logged elsewhere. Nothing has been overwritten. Pick which one to keep.`}
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
              Connected. Last backup {when(sync.lastSyncedAt)}
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
