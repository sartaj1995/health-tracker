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

export function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
