import type { Entry } from "./types";

const FILE_KEY = "ht.backupFile.v1";

/**
 * When a backup file last held everything on this device: an export, or an
 * import — the file just read in is itself a copy of what is now here.
 *
 * Device bookkeeping, like the Drive sync record, so it stays out of the
 * snapshot: restoring a backup must not carry another device's date along.
 */
export function loadLastFileBackup(): number | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const at = Number(window.localStorage.getItem(FILE_KEY));
    return at > 0 ? at : undefined;
  } catch {
    return undefined;
  }
}

export function recordFileBackup(at: number = Date.now()): void {
  try {
    window.localStorage.setItem(FILE_KEY, String(at));
  } catch {
    // Storage refusing writes is already announced on every screen. Losing
    // this date only makes the dashboard speak up sooner than it needed to.
  }
}

export type BackupFacts = {
  /** Readings added or edited since the last backup — all of them, if there never was one. */
  unbacked: number;
  /** How long the oldest of those has been waiting, in hours. 0 when none are. */
  waitingHours: number;
  /**
   * Drive is connected and its last attempt went through, so the next backup
   * is expected to happen without anyone asking. False after a conflict or a
   * failure — a lapsed sign-in, no connection — since either leaves readings
   * waiting until someone acts.
   */
  automatic: boolean;
};

/**
 * What a lost or reset phone would take with it right now.
 *
 * A reading counts as safe once it was last touched before the latest backup
 * — to Drive or to a file — was taken. Only readings are counted: a deletion
 * or a settings change missing from a backup costs little on a restore (a
 * reading to delete again, a height to re-enter), and readings are what the
 * dashboard line talks about.
 */
export function backupFacts(
  entries: Entry[],
  lastBackupAt: number | undefined,
  automatic: boolean,
  now: number,
): BackupFacts {
  let unbacked = 0;
  let oldest = Infinity;
  for (const entry of entries) {
    const touched = Date.parse(entry.updatedAt);
    // A reading without a readable timestamp came from a hand-made backup
    // file, so once any backup exists it is treated as one of the safe ones.
    if (lastBackupAt !== undefined && !(touched > lastBackupAt)) continue;
    unbacked += 1;
    if (touched < oldest) oldest = touched;
  }
  return {
    unbacked,
    // Clamped because another device's clock can run ahead of this one's.
    waitingHours: Number.isFinite(oldest) ? Math.max(0, (now - oldest) / 3_600_000) : 0,
    automatic,
  };
}

/** How firmly the dashboard mentions backups: not at all, a quiet line, or a warning. */
export type Nudge = "none" | "gentle" | "firm";

/** Time for Drive's automatic upload to go out after a save, with room to spare. */
const DRIVE_GRACE_HOURS = 0.25;

/** A week covers Safari's rule of clearing a site left unused for seven days of browsing. */
const FIRM_AFTER_HOURS = 24 * 7;

/** More readings than anyone would want to type in again. */
const FIRM_AFTER_READINGS = 10;

/**
 * The dashboard's policy for speaking up about backups.
 *
 * Two failures pull against each other. Speak too early and the line becomes
 * wallpaper, ignored on the day it matters. Speak too late and a lost phone
 * takes the readings with it. So anything unprotected gets the quiet line at
 * once, and it only turns into a warning once the loss would really hurt.
 *
 * With Drive connected, a save normally goes up about four seconds later — but
 * only within the hour after someone taps a Drive button. A background backup
 * cannot renew Google's sign-in without a tap, so on a phone opened once a day
 * most readings wait for someone to press "Back up now". That failure turns
 * `automatic` off, so the line appears as soon as the attempt has failed.
 */
export function backupNudge({ unbacked, waitingHours, automatic }: BackupFacts): Nudge {
  if (unbacked === 0) return "none";
  // Saying anything before Drive has had its chance would flash the line up
  // after every reading, including a lab report's worth arriving at once.
  if (automatic && waitingHours < DRIVE_GRACE_HOURS) return "none";
  if (waitingHours >= FIRM_AFTER_HOURS || unbacked >= FIRM_AFTER_READINGS) return "firm";
  return "gentle";
}
