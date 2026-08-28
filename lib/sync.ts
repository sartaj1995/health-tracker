import {
  authorise,
  downloadBackup,
  findBackup,
  forgetToken,
  uploadBackup,
} from "./drive";
import { parseSnapshot, type Snapshot } from "./storage";

const KEY = "ht.sync.v1";

/**
 * Kept out of the snapshot on purpose: restoring replaces entries and profile
 * wholesale, and it must not drag another device's sync bookkeeping along.
 */
export interface SyncRecord {
  connected: boolean;
  fileId?: string;
  /** Drive's own modifiedTime for the version this device last wrote or read. */
  seenModifiedTime?: string;
  /** Local clock, for display only. */
  lastSyncedAt?: number;
  /** Set when Drive moved on without us, so nothing is overwritten silently. */
  conflict?: boolean;
  /** True when the conflict is simply this device syncing for the first time. */
  conflictFirstConnect?: boolean;
  /** Drive's timestamp on the copy we refused to overwrite. */
  conflictRemoteTime?: string;
  /**
   * Why the last attempt failed. A backup that quietly stops working is worse
   * than no backup, so the failure is recorded for Settings to show.
   */
  lastError?: string;
  /** When a reading was saved that still is not in Drive. */
  pendingSince?: number;
}

const DISCONNECTED: SyncRecord = { connected: false };

export function loadSync(): SyncRecord {
  if (typeof window === "undefined") return DISCONNECTED;
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as SyncRecord) : DISCONNECTED;
  } catch {
    return DISCONNECTED;
  }
}

/** Fired whenever the sync record changes, so open screens can follow along. */
export const SYNC_EVENT = "ht:sync";

export function saveSync(record: SyncRecord): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(record));
  } catch {
    // Storage full or blocked; sync bookkeeping is recoverable, so ignore.
  }
  // Dispatched even if the write failed: the in-memory result is what the UI
  // should be showing either way.
  window.dispatchEvent(new CustomEvent(SYNC_EVENT, { detail: record }));
}

/** Records that Drive is behind local data, so a retry is owed. */
export function markPending(): void {
  const record = loadSync();
  if (record.connected && !record.pendingSince) {
    saveSync({ ...record, pendingSince: Date.now() });
  }
}

export function disconnect(): void {
  forgetToken();
  saveSync(DISCONNECTED);
}

export type BackupResult =
  | { ok: true; record: SyncRecord }
  | { ok: false; reason: "conflict"; remoteModifiedTime: string; firstConnect: boolean }
  | { ok: false; reason: "error"; message: string };

/**
 * Write local data to Drive.
 *
 * Refuses whenever Drive holds a version this device has never seen. That
 * covers the obvious case — another device wrote it — and the dangerous one: a
 * fresh install connecting for the first time, which has no local readings and
 * would otherwise wipe a perfectly good backup on contact.
 *
 * `force` is the deliberate "mine wins" escape hatch.
 */
export async function backUp(
  snapshot: Snapshot,
  { interactive = false, force = false } = {},
): Promise<BackupResult> {
  try {
    const token = await authorise(interactive);
    const record = loadSync();
    const remote = await findBackup(token);

    if (remote && !force && remote.modifiedTime !== record.seenModifiedTime) {
      saveSync({
        ...record,
        connected: true,
        conflict: true,
        conflictFirstConnect: !record.seenModifiedTime,
        conflictRemoteTime: remote.modifiedTime,
        lastError: undefined,
      });
      return {
        ok: false,
        reason: "conflict",
        remoteModifiedTime: remote.modifiedTime,
        firstConnect: !record.seenModifiedTime,
      };
    }

    const payload = JSON.stringify(snapshot, null, 2);
    const written = await uploadBackup(token, payload, remote?.id ?? record.fileId);
    const next: SyncRecord = {
      connected: true,
      fileId: written.id,
      seenModifiedTime: written.modifiedTime,
      lastSyncedAt: Date.now(),
      conflict: false,
    };
    saveSync(next);
    return { ok: true, record: next };
  } catch (error) {
    const message = (error as Error).message;
    const record = loadSync();
    if (record.connected) saveSync({ ...record, lastError: message });
    return { ok: false, reason: "error", message };
  }
}

export type RestoreResult =
  | { ok: true; snapshot: Snapshot; record: SyncRecord }
  | { ok: false; message: string };

/** Pull Drive's copy and hand it back — the caller decides to apply it. */
export async function restore(interactive = true): Promise<RestoreResult> {
  try {
    const token = await authorise(interactive);
    const remote = await findBackup(token);
    if (!remote) return { ok: false, message: "No backup in Drive yet." };

    const text = await downloadBackup(token, remote.id);
    const snapshot = parseSnapshot(text);
    const record: SyncRecord = {
      connected: true,
      fileId: remote.id,
      seenModifiedTime: remote.modifiedTime,
      lastSyncedAt: Date.now(),
      conflict: false,
    };
    saveSync(record);
    return { ok: true, snapshot, record };
  } catch (error) {
    return { ok: false, message: (error as Error).message };
  }
}
