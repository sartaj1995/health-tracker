import { describe, expect, it } from "vitest";
import { getMetric } from "./metrics";
import {
  clipToRange,
  deltaSentiment,
  isDenselyLogged,
  seriesFor,
  smooth,
  summarize,
  toTime,
  todayISO,
  trackedMetricIds,
  windowChange,
  type Point,
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

/** A point on a given day. Dates are built from a day offset for readability. */
function at(dayOffset: number, value: number): Point {
  const d = new Date(2026, 0, 1 + dayOffset);
  const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { date: iso, t: toTime(iso), value };
}

/** `count` readings one day apart, values supplied by a function of the index. */
function daily(count: number, value: (i: number) => number): Point[] {
  return Array.from({ length: count }, (_, i) => at(i, value(i)));
}

describe("deciding whether smoothing is worth it", () => {
  it("smooths a metric logged daily", () => {
    expect(isDenselyLogged(daily(30, (i) => 80 + (i % 3)))).toBe(true);
  });

  it("leaves a lab panel alone", () => {
    // Four draws a year: each reading is the signal, not noise around one.
    const draws = [at(0, 30), at(90, 34), at(180, 38), at(270, 41)];
    expect(isDenselyLogged(draws)).toBe(false);
  });

  it("needs more than a handful of readings", () => {
    // Consecutive days, but too few for an average to say anything.
    expect(isDenselyLogged(daily(7, () => 80))).toBe(false);
    expect(isDenselyLogged(daily(8, () => 80))).toBe(true);
  });

  it("is not thrown by one long gap in an otherwise daily series", () => {
    // A fortnight away from home should not turn the smoothing off; this is
    // why the gap test uses the median rather than the mean.
    const points = [...daily(20, () => 80), at(34, 81), at(35, 81), at(36, 80)];
    expect(isDenselyLogged(points)).toBe(true);
  });

  it("does not smooth a weekly weigh-in", () => {
    const weekly = Array.from({ length: 12 }, (_, i) => at(i * 7, 80 + i));
    expect(isDenselyLogged(weekly)).toBe(false);
  });
});

describe("the rolling average", () => {
  it("carries a trailing mean on every point", () => {
    const avg = smooth([at(0, 10), at(1, 20), at(2, 30)], 7).map((p) => p.avg);
    // Partial windows at the start: nothing earlier exists to include.
    expect(avg).toEqual([10, 15, 20]);
  });

  it("only ever looks backwards", () => {
    // A centred window would let a later reading change the line drawn at an
    // earlier one, so the curve would rewrite its own past on every save.
    const points = [at(0, 10), at(1, 10), at(2, 100)];
    const avg = smooth(points, 7).map((p) => p.avg);
    expect(avg[0]).toBe(10);
    expect(avg[1]).toBe(10);
  });

  it("drops readings that fall out of the window", () => {
    // Day 8 is more than seven days after day 0, so day 0 is no longer counted.
    const points = [at(0, 100), at(8, 50), at(9, 50)];
    expect(smooth(points, 7).map((p) => p.avg)).toEqual([100, 50, 50]);
  });

  it("flattens noise while following the trend", () => {
    // A kilo of daily swing on a body that is genuinely losing weight.
    const points = daily(28, (i) => 80 - i * 0.05 + (i % 2 === 0 ? 0.9 : -0.9));
    const avg = smooth(points).map((p) => p.avg);
    const swing = (xs: number[]) => Math.max(...xs) - Math.min(...xs);

    const rawJumps = points.slice(1).map((p, i) => Math.abs(p.value - points[i].value));
    const avgJumps = avg.slice(1).map((v, i) => Math.abs(v - avg[i]));
    expect(Math.max(...avgJumps)).toBeLessThan(Math.max(...rawJumps));

    // Still going down: smoothing must not flatten the signal along with it.
    expect(avg[avg.length - 1]).toBeLessThan(avg[7]);
    expect(swing(avg)).toBeLessThan(swing(points.map((p) => p.value)));
  });

  it("leaves every other field of the point intact", () => {
    const [first] = smooth([{ ...at(0, 10), note: "fasting", entryId: "x" }]);
    expect(first.note).toBe("fasting");
    expect(first.entryId).toBe("x");
  });
});

describe("change across the window", () => {
  it("measures first to last, not the final step", () => {
    // Ends level with where it started but wandered in between: the honest
    // answer is "unchanged", which the last two readings would not give.
    const change = windowChange([at(0, 100), at(30, 130), at(60, 100)]);
    expect(change).toEqual({ delta: 0, days: 60 });
  });

  it("reports a fall as negative", () => {
    expect(windowChange([at(0, 147), at(150, 129)])).toEqual({ delta: -18, days: 150 });
  });

  it("measures the span from the readings, not the range picked", () => {
    // Four months of data inside a 1Y window is four months of evidence.
    expect(windowChange([at(0, 10), at(120, 12)])?.days).toBe(120);
  });

  it("says nothing when there is nothing to compare", () => {
    expect(windowChange([])).toBeNull();
    expect(windowChange([at(0, 10)])).toBeNull();
  });

  it("says nothing when everything landed on one day", () => {
    expect(windowChange([at(5, 10), at(5, 12)])).toBeNull();
  });
});
