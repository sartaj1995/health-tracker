import { getMetric } from "./metrics";
import type { Entry, Metric, Profile } from "./types";

export type Point = {
  date: string;
  /** Milliseconds - Recharts needs a numeric axis for correct time spacing. */
  t: number;
  value: number;
  value2?: number;
  note?: string;
  entryId?: string;
};

export function toTime(date: string): number {
  // Parse as local midday so a timezone shift can never move a reading a day.
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1, 12).getTime();
}

export function todayISO(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

const byDateAsc = (a: { date: string }, b: { date: string }) =>
  a.date < b.date ? -1 : a.date > b.date ? 1 : 0;

/**
 * BMI has no entries of its own - it is derived from every weight reading and
 * whichever height was on record at the time.
 */
function bmiSeries(entries: Entry[], profile: Profile): Point[] {
  const heights = entries
    .filter((e) => e.metricId === "height")
    .sort(byDateAsc);
  const weights = entries
    .filter((e) => e.metricId === "weight")
    .sort(byDateAsc);

  const points: Point[] = [];
  for (const w of weights) {
    let cm: number | undefined;
    for (const h of heights) {
      if (h.date <= w.date) cm = h.value;
      else break;
    }
    // Before the first height reading, fall back to the profile height.
    cm ??= profile.heightCm ?? heights[0]?.value;
    if (!cm || cm <= 0) continue;
    const m = cm / 100;
    points.push({
      date: w.date,
      t: toTime(w.date),
      value: Math.round((w.value / (m * m)) * 10) / 10,
      entryId: w.id,
    });
  }
  return points;
}

/** All readings for one metric, oldest first, one point per day. */
export function seriesFor(
  metricId: string,
  entries: Entry[],
  profile: Profile,
): Point[] {
  if (metricId === "bmi") return bmiSeries(entries, profile);

  const rows = entries.filter((e) => e.metricId === metricId).sort(byDateAsc);

  // Two readings on one day: keep the most recently edited one.
  const perDay = new Map<string, Entry>();
  for (const e of rows) {
    const existing = perDay.get(e.date);
    if (!existing || e.updatedAt > existing.updatedAt) perDay.set(e.date, e);
  }

  return [...perDay.values()].sort(byDateAsc).map((e) => ({
    date: e.date,
    t: toTime(e.date),
    value: e.value,
    value2: e.value2,
    note: e.note,
    entryId: e.id,
  }));
}

/** Metric ids that have at least one reading, in catalog order. */
export function trackedMetricIds(entries: Entry[], profile: Profile): string[] {
  const present = new Set(entries.map((e) => e.metricId));
  const ids = [...present];
  const hasHeight = present.has("height") || profile.heightCm !== undefined;
  if (present.has("weight") && hasHeight) ids.push("bmi");
  return ids.filter((id) => getMetric(id));
}

export type Range = "3m" | "6m" | "1y" | "all";

export const RANGES: { key: Range; label: string; months: number | null }[] = [
  { key: "3m", label: "3M", months: 3 },
  { key: "6m", label: "6M", months: 6 },
  { key: "1y", label: "1Y", months: 12 },
  { key: "all", label: "All", months: null },
];

export function clipToRange(points: Point[], range: Range): Point[] {
  const spec = RANGES.find((r) => r.key === range);
  if (!spec?.months) return points;
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - spec.months);
  const min = cutoff.getTime();
  return points.filter((p) => p.t >= min);
}

export type Summary = {
  latest: Point;
  previous?: Point;
  delta?: number;
  deltaPct?: number;
  min: number;
  max: number;
  average: number;
  count: number;
};

export function summarize(points: Point[]): Summary | null {
  if (points.length === 0) return null;
  const values = points.map((p) => p.value);
  const latest = points[points.length - 1];
  const previous = points.length > 1 ? points[points.length - 2] : undefined;
  const delta = previous ? latest.value - previous.value : undefined;
  return {
    latest,
    previous,
    delta,
    deltaPct:
      previous && previous.value !== 0
        ? ((latest.value - previous.value) / Math.abs(previous.value)) * 100
        : undefined,
    min: Math.min(...values),
    max: Math.max(...values),
    average: values.reduce((a, b) => a + b, 0) / values.length,
    count: points.length,
  };
}

/**
 * Is a change in the right direction? Returns null when the metric has no
 * inherent good direction (weight, TSH) and no target is set.
 */
export function deltaSentiment(
  metric: Metric,
  delta: number | undefined,
  target?: number,
  latestValue?: number,
): "good" | "bad" | null {
  if (delta === undefined || delta === 0) return null;

  if (metric.direction === "neutral") {
    // With a target, "closer to it" is the improvement.
    if (target === undefined || latestValue === undefined) return null;
    const before = Math.abs(latestValue - delta - target);
    const after = Math.abs(latestValue - target);
    return after < before ? "good" : after > before ? "bad" : null;
  }

  const improving = metric.direction === "up" ? delta > 0 : delta < 0;
  return improving ? "good" : "bad";
}
