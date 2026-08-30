import { describe, expect, it } from "vitest";
import { getMetric } from "./metrics";
import {
  clipToRange,
  deltaSentiment,
  seriesFor,
  summarize,
  toTime,
  todayISO,
  trackedMetricIds,
} from "./stats";
import { DEFAULT_PROFILE, type Entry, type Profile } from "./types";

const profile: Profile = DEFAULT_PROFILE;

let seq = 0;
function entry(metricId: string, value: number, date: string, extra: Partial<Entry> = {}): Entry {
  seq += 1;
  const stamp = `2026-01-01T00:00:${String(seq).padStart(2, "0")}.000Z`;
  return {
    id: `e${seq}`,
    metricId,
    value,
    date,
    createdAt: stamp,
    updatedAt: stamp,
    ...extra,
  };
}

/** Shifts a date by whole days, used to build relative fixtures. */
function daysBefore(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  const pad = (x: number) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

describe("BMI derivation", () => {
  // This is the subtlest logic in the app: BMI has no entries of its own, and
  // each weight must be paired with the height that was on record on that date
  // — not the latest one — or a mid-series height change rewrites history.
  it("uses the height on record at the time of each weight", () => {
    const entries = [
      entry("height", 170, "2026-01-01"),
      entry("weight", 72.25, "2026-02-01"), // 170cm -> 25.0
      entry("height", 180, "2026-03-01"),
      entry("weight", 81, "2026-04-01"), // 180cm -> 25.0
    ];

    const points = seriesFor("bmi", entries, profile);

    expect(points).toHaveLength(2);
    expect(points[0].value).toBe(25);
    expect(points[1].value).toBe(25);
  });

  it("does not let a later height rewrite an earlier BMI", () => {
    const withLaterHeight = seriesFor(
      "bmi",
      [
        entry("height", 170, "2026-01-01"),
        entry("weight", 72.25, "2026-02-01"),
        entry("height", 200, "2026-06-01"),
      ],
      profile,
    );
    expect(withLaterHeight[0].value).toBe(25);
  });

  it("falls back to the profile height before the first height reading", () => {
    const points = seriesFor("bmi", [entry("weight", 72.25, "2026-02-01")], {
      ...profile,
      heightCm: 170,
    });
    expect(points).toHaveLength(1);
    expect(points[0].value).toBe(25);
  });

  it("produces nothing when no height is known at all", () => {
    expect(seriesFor("bmi", [entry("weight", 72, "2026-02-01")], profile)).toEqual([]);
  });

  it("ignores a nonsensical height rather than dividing by zero", () => {
    const points = seriesFor("bmi", [entry("weight", 72, "2026-02-01")], {
      ...profile,
      heightCm: 0,
    });
    expect(points).toEqual([]);
  });

  it("rounds to one decimal", () => {
    // 70 / 1.75^2 = 22.857...
    const points = seriesFor("bmi", [entry("weight", 70, "2026-02-01")], {
      ...profile,
      heightCm: 175,
    });
    expect(points[0].value).toBe(22.9);
  });
});

describe("seriesFor", () => {
  it("returns readings oldest first, whatever order they were entered", () => {
    const points = seriesFor(
      "weight",
      [
        entry("weight", 3, "2026-03-01"),
        entry("weight", 1, "2026-01-01"),
        entry("weight", 2, "2026-02-01"),
      ],
      profile,
    );
    expect(points.map((p) => p.value)).toEqual([1, 2, 3]);
  });

  it("keeps only the most recently edited reading for a given day", () => {
    // Logging twice on one day is a correction, not two data points.
    const older = entry("weight", 70, "2026-01-01", {
      updatedAt: "2026-01-01T08:00:00.000Z",
    });
    const newer = entry("weight", 71, "2026-01-01", {
      updatedAt: "2026-01-01T20:00:00.000Z",
    });
    const points = seriesFor("weight", [newer, older], profile);
    expect(points).toHaveLength(1);
    expect(points[0].value).toBe(71);
  });

  it("carries the second value through for blood pressure", () => {
    const points = seriesFor(
      "bloodPressure",
      [entry("bloodPressure", 118, "2026-01-01", { value2: 78 })],
      profile,
    );
    expect(points[0].value).toBe(118);
    expect(points[0].value2).toBe(78);
  });

  it("does not mix metrics", () => {
    const entries = [entry("weight", 70, "2026-01-01"), entry("ldl", 120, "2026-01-01")];
    expect(seriesFor("weight", entries, profile)).toHaveLength(1);
    expect(seriesFor("ldl", entries, profile)).toHaveLength(1);
  });
});

describe("toTime", () => {
  it("anchors a date at local midday so a timezone can never shift the day", () => {
    const t = toTime("2026-03-15");
    const d = new Date(t);
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(2);
    expect(d.getDate()).toBe(15);
    expect(d.getHours()).toBe(12);
  });

  it("orders dates correctly across a month boundary", () => {
    expect(toTime("2026-01-31")).toBeLessThan(toTime("2026-02-01"));
  });

  it("todayISO round-trips through toTime to the same calendar day", () => {
    const today = todayISO();
    const d = new Date(toTime(today));
    const pad = (x: number) => String(x).padStart(2, "0");
    expect(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`).toBe(today);
  });
});

describe("summarize", () => {
  const points = seriesFor(
    "weight",
    [
      entry("weight", 80, "2026-01-01"),
      entry("weight", 70, "2026-02-01"),
      entry("weight", 75, "2026-03-01"),
    ],
    profile,
  );

  it("reports the latest reading, not the highest or the last entered", () => {
    expect(summarize(points)!.latest.value).toBe(75);
    expect(summarize(points)!.previous!.value).toBe(70);
  });

  it("computes the change against the previous reading", () => {
    expect(summarize(points)!.delta).toBe(5);
  });

  it("computes min, max, average and count over the whole window", () => {
    const s = summarize(points)!;
    expect(s.min).toBe(70);
    expect(s.max).toBe(80);
    expect(s.average).toBe(75);
    expect(s.count).toBe(3);
  });

  it("has no delta for a single reading", () => {
    const one = seriesFor("weight", [entry("weight", 70, "2026-01-01")], profile);
    const s = summarize(one)!;
    expect(s.delta).toBeUndefined();
    expect(s.previous).toBeUndefined();
  });

  it("returns null for an empty series", () => {
    expect(summarize([])).toBeNull();
  });
});

describe("clipToRange", () => {
  const points = seriesFor(
    "weight",
    [
      entry("weight", 1, daysBefore(400)),
      entry("weight", 2, daysBefore(200)),
      entry("weight", 3, daysBefore(30)),
      entry("weight", 4, daysBefore(1)),
    ],
    profile,
  );

  it("keeps everything for the all-time window", () => {
    expect(clipToRange(points, "all")).toHaveLength(4);
  });

  it("drops readings older than the window", () => {
    expect(clipToRange(points, "3m").map((p) => p.value)).toEqual([3, 4]);
    expect(clipToRange(points, "1y").map((p) => p.value)).toEqual([2, 3, 4]);
  });
});

describe("deltaSentiment", () => {
  const ldl = getMetric("ldl")!; // lower is better
  const hdl = getMetric("hdl")!; // higher is better
  const weight = getMetric("weight")!; // neither, without a target

  it("reads a fall in LDL as good and a rise as bad", () => {
    expect(deltaSentiment(ldl, -10)).toBe("good");
    expect(deltaSentiment(ldl, 10)).toBe("bad");
  });

  it("reads it the other way for HDL", () => {
    expect(deltaSentiment(hdl, 5)).toBe("good");
    expect(deltaSentiment(hdl, -5)).toBe("bad");
  });

  it("stays neutral for weight until a target says which way is better", () => {
    expect(deltaSentiment(weight, -1)).toBeNull();
    expect(deltaSentiment(weight, 1)).toBeNull();
  });

  it("judges weight by whether it moved toward the target", () => {
    // Target 72. Moving 74 -> 73 closes the gap; 71 -> 70 overshoots further.
    expect(deltaSentiment(weight, -1, 72, 73)).toBe("good");
    expect(deltaSentiment(weight, -1, 72, 70)).toBe("bad");
  });

  it("has no opinion on no change", () => {
    expect(deltaSentiment(ldl, 0)).toBeNull();
    expect(deltaSentiment(ldl, undefined)).toBeNull();
  });
});

describe("trackedMetricIds", () => {
  it("lists only metrics that have readings", () => {
    const ids = trackedMetricIds([entry("weight", 70, "2026-01-01")], profile);
    expect(ids).toContain("weight");
    expect(ids).not.toContain("ldl");
  });

  it("adds BMI once both weight and a height are available", () => {
    const entries = [entry("weight", 70, "2026-01-01"), entry("height", 175, "2026-01-01")];
    expect(trackedMetricIds(entries, profile)).toContain("bmi");
  });

  it("adds BMI from a profile height with no height reading", () => {
    const entries = [entry("weight", 70, "2026-01-01")];
    expect(trackedMetricIds(entries, { ...profile, heightCm: 175 })).toContain("bmi");
  });

  it("does not offer BMI from weight alone", () => {
    expect(trackedMetricIds([entry("weight", 70, "2026-01-01")], profile)).not.toContain(
      "bmi",
    );
  });

  it("ignores ids that are not in the catalogue", () => {
    const ids = trackedMetricIds([entry("nonsense", 1, "2026-01-01")], profile);
    expect(ids).not.toContain("nonsense");
  });
});
