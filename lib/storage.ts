import { DEFAULT_PROFILE, type Entry, type Profile } from "./types";

export type Snapshot = { entries: Entry[]; profile: Profile };

/**
 * Everything the UI knows about persistence goes through this interface.
 * Today it is backed by localStorage; pointing it at an API route later is a
 * single new implementation, no page changes.
 */
export interface HealthRepo {
  load(): Promise<Snapshot>;
  save(snapshot: Snapshot): Promise<void>;
}

const ENTRIES_KEY = "ht.entries.v1";
const PROFILE_KEY = "ht.profile.v1";

function readJSON<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    // Corrupt or unavailable storage (private mode, quota) - start clean
    // rather than crashing the whole app.
    return fallback;
  }
}

export const localRepo: HealthRepo = {
  async load() {
    const entries = readJSON<Entry[]>(ENTRIES_KEY, []);
    const profile = readJSON<Profile>(PROFILE_KEY, DEFAULT_PROFILE);
    return {
      entries: Array.isArray(entries) ? entries : [],
      profile: { ...DEFAULT_PROFILE, ...profile },
    };
  },

  async save({ entries, profile }) {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(ENTRIES_KEY, JSON.stringify(entries));
      window.localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    } catch (err) {
      console.error("Could not save to localStorage", err);
      throw err;
    }
  },
};

/**
 * Turn backup text into a snapshot, or explain why it cannot.
 *
 * Shared by the Settings file import and the Drive restore so the two can never
 * disagree about what counts as a valid backup. Unrecognisable rows are dropped
 * rather than failing the whole restore — a backup that is 99% readable is
 * still worth having back.
 */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("That file is not valid JSON.");
  }

  const doc = raw as { entries?: unknown; profile?: unknown };
  if (!Array.isArray(doc.entries)) {
    throw new Error("That file does not look like a Health Tracker backup.");
  }

  const entries = (doc.entries as Entry[]).filter(
    (e) =>
      e &&
      typeof e.metricId === "string" &&
      typeof e.value === "number" &&
      Number.isFinite(e.value) &&
      typeof e.date === "string",
  );

  const profile =
    doc.profile && typeof doc.profile === "object"
      ? { ...DEFAULT_PROFILE, ...(doc.profile as Profile) }
      : DEFAULT_PROFILE;

  return { entries, profile };
}

export function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
