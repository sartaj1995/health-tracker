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
    return migrateHeight({
      entries: Array.isArray(entries) ? entries : [],
      profile: { ...DEFAULT_PROFILE, ...profile },
    });
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
 * Ask the browser not to clear this data when the device runs short of space,
 * and report whether it agreed.
 *
 * Chrome and Safari decide without asking anyone — Safari 17+ looks at things
 * like whether the app was opened from the Home Screen — but Firefox puts the
 * question to the person, so this is only worth calling once there are
 * readings to keep. It is protection from eviction and nothing more: Safari
 * has not said it lifts the rule that clears a site left unused for seven days
 * of browsing, which only a Home Screen install or a backup gets around.
 */
export async function requestPersistence(
  storage: Partial<Pick<StorageManager, "persist" | "persisted">> | undefined =
    typeof navigator === "undefined" ? undefined : navigator.storage,
): Promise<boolean> {
  if (!storage?.persist || !storage.persisted) return false;
  try {
    // persisted() never prompts, so a grant from an earlier visit costs nothing.
    return (await storage.persisted()) || (await storage.persist());
  } catch {
    return false;
  }
}

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

  return migrateHeight({ entries, profile });
}

/**
 * Height used to be a metric with dated readings; it is one value in Settings
 * now. Anyone whose height only ever lived in a reading — a backup assembled by
 * hand, a Settings field cleared afterwards — would otherwise lose their BMI
 * without a word, so an old reading is carried across on the way in.
 *
 * Runs on every load and every restore, so it has to be harmless the second
 * time. The readings themselves are left alone: they stay in History and can
 * be deleted there, rather than being erased on load and that loss riding out
 * to Drive with the next backup.
 */
export function migrateHeight(snapshot: Snapshot): Snapshot {
  const readings = snapshot.entries.filter((e) => e.metricId === "height");
  if (readings.length === 0) return snapshot;

  // Settings is the height the person can see and edit, so a reading that
  // disagrees with it never overrules it. Only an empty Settings is filled —
  // which also makes a second run on the next load a no-op.
  if (snapshot.profile.heightCm !== undefined) return snapshot;

  // The latest measurement by the day it was taken, not the day it was typed
  // in: back-filling an old height must not make it the one that wins. Two
  // readings on one day go to the later edit, the same rule the charts use.
  const latest = readings.reduce((best, e) =>
    e.date > best.date || (e.date === best.date && e.updatedAt > best.updatedAt) ? e : best,
  );

  return { ...snapshot, profile: { ...snapshot.profile, heightCm: latest.value } };
}

export function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
