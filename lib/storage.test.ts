import { describe, expect, it } from "vitest";
import { newId, parseSnapshot } from "./storage";
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

describe("newId", () => {
  it("does not collide across a large batch", () => {
    const ids = new Set(Array.from({ length: 2000 }, () => newId()));
    expect(ids.size).toBe(2000);
  });
});
