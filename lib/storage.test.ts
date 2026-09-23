import { describe, expect, it } from "vitest";
import { migrateHeight, newId, parseSnapshot, requestPersistence } from "./storage";
import { DEFAULT_PROFILE } from "./types";

const reading = {
  id: "a",
  metricId: "vldl",
  value: 28,
  date: "2026-08-01",
  createdAt: "2026-08-01T00:00:00.000Z",
  updatedAt: "2026-08-01T00:00:00.000Z",
};

/**
 * parseSnapshot guards the two ways data comes back into the app — a file you
 * import and a file pulled down from Drive. Both replace everything you have,
 * so it needs to be strict about shape and forgiving about individual rows.
 */
describe("parseSnapshot", () => {
  it("accepts a well-formed backup", () => {
    const snapshot = parseSnapshot(
      JSON.stringify({ entries: [reading], profile: { ...DEFAULT_PROFILE, heightCm: 176 } }),
    );
    expect(snapshot.entries).toHaveLength(1);
    expect(snapshot.profile.heightCm).toBe(176);
  });

  it("rejects text that is not JSON, and says so specifically", () => {
    expect(() => parseSnapshot("{not json")).toThrow(/not valid JSON/i);
  });

  it("rejects JSON that is not a backup", () => {
    expect(() => parseSnapshot(JSON.stringify({ hello: "world" }))).toThrow(
      /Health Tracker backup/i,
    );
    expect(() => parseSnapshot(JSON.stringify({ entries: "nope" }))).toThrow(
      /Health Tracker backup/i,
    );
  });

  it("drops unusable rows instead of failing the whole restore", () => {
    // A backup that is 99% readable is still worth having back.
    const snapshot = parseSnapshot(
      JSON.stringify({
        entries: [
          reading,
          { ...reading, id: "b", value: "not-a-number" },
          { ...reading, id: "c", metricId: 42 },
          { ...reading, id: "d", date: undefined },
          null,
        ],
      }),
    );
    expect(snapshot.entries.map((e) => e.id)).toEqual(["a"]);
  });

  it("rejects a non-finite value, which would break every chart downstream", () => {
    const snapshot = parseSnapshot(
      JSON.stringify({ entries: [reading, { ...reading, id: "nan", value: NaN }] }),
    );
    // JSON.stringify turns NaN into null, so this arrives as a null value.
    expect(snapshot.entries.map((e) => e.id)).toEqual(["a"]);
  });

  it("falls back to default settings when the profile is missing or wrong", () => {
    expect(parseSnapshot(JSON.stringify({ entries: [] })).profile).toEqual(DEFAULT_PROFILE);
    expect(
      parseSnapshot(JSON.stringify({ entries: [], profile: "nonsense" })).profile,
    ).toEqual(DEFAULT_PROFILE);
  });

  it("fills gaps in a partial profile rather than dropping it", () => {
    const profile = parseSnapshot(
      JSON.stringify({ entries: [], profile: { heightCm: 180 } }),
    ).profile;
    expect(profile.heightCm).toBe(180);
    expect(profile.bmiStandard).toBe(DEFAULT_PROFILE.bmiStandard);
    expect(profile.pinned).toEqual([]);
  });

  it("round-trips what the app itself exports", () => {
    const original = { entries: [reading], profile: DEFAULT_PROFILE };
    expect(parseSnapshot(JSON.stringify(original, null, 2))).toEqual(original);
  });

  it("accepts an empty but valid backup", () => {
    expect(parseSnapshot(JSON.stringify({ entries: [] })).entries).toEqual([]);
  });
});

describe("asking the browser to keep the data", () => {
  it("reports no where the browser has no way to ask", async () => {
    expect(await requestPersistence({})).toBe(false);
  });

  it("does not ask again when an earlier visit was already granted", async () => {
    // Firefox shows a prompt for persist(); a repeat on every launch would nag.
    let asked = false;
    const granted = await requestPersistence({
      persisted: async () => true,
      persist: async () => {
        asked = true;
        return true;
      },
    });
    expect(granted).toBe(true);
    expect(asked).toBe(false);
  });

  it("asks when it has not been granted, and passes on the answer", async () => {
    const ask = (answer: boolean) =>
      requestPersistence({ persisted: async () => false, persist: async () => answer });
    expect(await ask(true)).toBe(true);
    expect(await ask(false)).toBe(false);
  });

  it("takes a browser that throws as a no instead of breaking the app", async () => {
    const granted = await requestPersistence({
      persisted: async () => {
        throw new Error("blocked");
      },
      persist: async () => true,
    });
    expect(granted).toBe(false);
  });
});

describe("newId", () => {
  it("does not collide across a large batch", () => {
    const ids = new Set(Array.from({ length: 2000 }, () => newId()));
    expect(ids.size).toBe(2000);
  });
});

/**
 * Height moved from dated readings to one value in Settings. The migration only
 * has to make sure nobody's BMI quietly disappears on the way — without
 * deleting anything, and without doing harm when it runs again on the next load.
 */
describe("carrying height over from its old readings", () => {
  const height = (value: number, date: string) => ({
    ...reading,
    id: `height-${date}`,
    metricId: "height",
    value,
    date,
    createdAt: `${date}T00:00:00.000Z`,
    updatedAt: `${date}T00:00:00.000Z`,
  });

  it("leaves a snapshot with no height readings untouched", () => {
    const snapshot = { entries: [reading], profile: DEFAULT_PROFILE };
    expect(migrateHeight(snapshot)).toBe(snapshot);
  });

  it("fills an empty Settings height from the readings", () => {
    const migrated = migrateHeight({
      entries: [height(170, "2024-01-10"), reading],
      profile: DEFAULT_PROFILE,
    });
    expect(migrated.profile.heightCm).toBe(170);
  });

  it("takes the latest measurement, not the latest thing typed in", () => {
    // Back-filling an old height after a newer one must not let the old one win.
    const backfilled = {
      ...height(172, "2020-03-01"),
      createdAt: "2026-09-01T00:00:00.000Z",
      updatedAt: "2026-09-01T00:00:00.000Z",
    };
    const measuredLater = height(170, "2025-06-01");
    const migrated = migrateHeight({
      entries: [measuredLater, backfilled],
      profile: DEFAULT_PROFILE,
    });
    expect(migrated.profile.heightCm).toBe(170);
  });

  it("keeps a height already set in Settings", () => {
    // Settings is the value the person can see and edit, so a reading that
    // disagrees with it does not get to overrule it.
    const migrated = migrateHeight({
      entries: [height(170, "2025-06-01")],
      profile: { ...DEFAULT_PROFILE, heightCm: 175 },
    });
    expect(migrated.profile.heightCm).toBe(175);
  });

  it("does not delete the readings", () => {
    const entries = [height(170, "2024-01-10"), reading];
    expect(migrateHeight({ entries, profile: DEFAULT_PROFILE }).entries).toBe(entries);
  });

  it("is harmless when it runs again on the next load", () => {
    const once = migrateHeight({ entries: [height(170, "2024-01-10")], profile: DEFAULT_PROFILE });
    expect(migrateHeight(once)).toEqual(once);
  });

  it("also applies to a backup restored from a file or Drive", () => {
    const snapshot = parseSnapshot(
      JSON.stringify({ entries: [height(170, "2024-01-10")], profile: DEFAULT_PROFILE }),
    );
    expect(snapshot.profile.heightCm).toBe(170);
  });
});
