"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { backupFacts, backupNudge, loadLastFileBackup } from "@/lib/backup";
import { driveConfigured } from "@/lib/drive";
import { timeAgo } from "@/lib/format";
import { useStore } from "@/lib/store";
import { SYNC_EVENT, loadSync, type SyncRecord } from "@/lib/sync";
import { ChevronRightIcon } from "./icons";

/**
 * A line on the dashboard whenever readings exist that no backup holds.
 *
 * Settings has shown the Drive status all along, but nobody opens Settings to
 * check on a backup. A sign-in that lapsed or a conflict nobody resolved has
 * to surface on the screen people actually look at, or it never surfaces.
 */
export function BackupStatus() {
  const { entries } = useStore();
  // Null until read after mount — localStorage does not exist on the server,
  // and guessing "never backed up" first would flash a false alarm.
  const [sync, setSync] = useState<SyncRecord | null>(null);
  const [fileAt, setFileAt] = useState<number | undefined>();

  useEffect(() => {
    setSync(loadSync());
    setFileAt(loadLastFileBackup());
    const follow = (e: Event) => setSync((e as CustomEvent<SyncRecord>).detail);
    window.addEventListener(SYNC_EVENT, follow);
    return () => window.removeEventListener(SYNC_EVENT, follow);
  }, []);

  if (!sync) return null;

  // A conflict halts automatic backups until someone picks a copy, and a
  // failure — most often a lapsed sign-in — until someone taps. Either way
  // nothing will go up on its own, so neither gets Drive's grace period.
  const automatic = sync.connected && !sync.conflict && !sync.lastError;
  const driveAt = sync.connected ? sync.lastSyncedAt : undefined;
  const lastBackupAt = Math.max(driveAt ?? 0, fileAt ?? 0) || undefined;
  const now = Date.now();
  const facts = backupFacts(entries, lastBackupAt, automatic, now);
  const nudge = backupNudge(facts);
  if (nudge === "none") return null;

  const one = facts.unbacked === 1;
  const count = `${facts.unbacked} reading${one ? "" : "s"}`;
  const { headline, detail, action } =
    lastBackupAt === undefined
      ? {
          headline: one ? "Your reading is not backed up yet" : "Your readings are not backed up yet",
          detail: driveConfigured
            ? "Keep a copy in Google Drive in case this device is lost or reset."
            : "Save a backup file in case this device is lost or reset.",
          action: driveConfigured ? "Set up" : "Back up",
        }
      : sync.conflict
        ? {
            headline: "Drive backups are paused",
            detail: `Drive has a copy this device has not seen, and ${count} ${one ? "is" : "are"} waiting. Choose which to keep.`,
            action: "Choose",
          }
        : {
            headline: `${count} not backed up yet`,
            detail: `Last backup ${timeAgo(lastBackupAt, now)}.`,
            action: "Back up now",
          };

  const href = driveConfigured ? "/settings#drive-backup" : "/settings#your-data";

  if (nudge === "gentle") {
    return (
      <Link
        href={href}
        className="-mt-3 mb-4 flex min-h-11 items-center gap-2 rounded-xl px-1 text-sm text-muted transition-colors duration-200 hover:text-text"
      >
        <span className="min-w-0 flex-1">
          {headline}. {detail}
        </span>
        <span className="shrink-0 font-medium text-accent">{action}</span>
        <ChevronRightIcon className="h-4 w-4 shrink-0 text-accent" />
      </Link>
    );
  }

  return (
    <Link
      href={href}
      className="mb-6 flex min-h-11 items-center gap-3 rounded-2xl border border-warn/40 bg-warn/10 px-4 py-3 transition-colors duration-200 hover:bg-warn/15"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-warn">{headline}</span>
        <span className="mt-0.5 block text-sm">{detail}</span>
      </span>
      <span className="shrink-0 text-sm font-medium text-accent">{action}</span>
      <ChevronRightIcon className="h-4 w-4 shrink-0 text-accent" />
    </Link>
  );
}
