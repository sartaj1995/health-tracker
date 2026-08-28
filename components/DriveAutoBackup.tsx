"use client";

import { useEffect, useRef } from "react";
import { driveConfigured, hasLiveToken } from "@/lib/drive";
import { useStore } from "@/lib/store";
import { backUp, loadSync, markPending } from "@/lib/sync";

/** Long enough that typing several readings in a row makes one upload, not five. */
const SETTLE_MS = 4000;

/**
 * Keeps Drive up to date in the background once you have connected it.
 *
 * Never prompts: it only ever uses a token already in hand, so a sign-in popup
 * can never appear unasked. When there is no usable token or the network is
 * down, the attempt is recorded as pending and retried the next time the data
 * changes or the connection comes back.
 */
export function DriveAutoBackup() {
  const { entries, profile, ready } = useStore();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Read through a ref so the retry listener always sees current data without
  // being torn down and rebuilt on every keystroke.
  const latest = useRef({ entries, profile });
  latest.current = { entries, profile };
  const firstRun = useRef(true);

  useEffect(() => {
    if (!driveConfigured || !ready) return;

    // Hydration itself is not a change worth uploading.
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }

    const record = loadSync();
    if (!record.connected || record.conflict) return;

    markPending();
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      void backUp(latest.current, { interactive: false });
    }, SETTLE_MS);

    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [entries, profile, ready]);

  // A backup owed from a dead connection should go up on its own once there is
  // one again, rather than waiting for the next reading to be logged.
  useEffect(() => {
    if (!driveConfigured) return;

    const retry = () => {
      const record = loadSync();
      if (!record.connected || record.conflict || !record.pendingSince) return;
      if (!hasLiveToken()) return;
      void backUp(latest.current, { interactive: false });
    };

    window.addEventListener("online", retry);
    return () => window.removeEventListener("online", retry);
  }, []);

  return null;
}
