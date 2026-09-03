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

const DAY_MS = 86_400_000;

/** The smoothing window. A week absorbs the day-of-week rhythm in weight. */
export const SMOOTHING_DAYS = 7;

/** Below this there is not enough to average; the mean would just be the line. */
const MIN_POINTS_TO_SMOOTH = 8;

/** Roughly twice a week. Sparser than this and each reading is its own event. */
const MAX_MEDIAN_GAP_DAYS = 4;

/**
 * Is this logged often enough that smoothing tells you something?
 *
 * Smoothing exists to separate a trend from measurement noise, and only a
 * frequently logged metric has any. A vitamin D drawn twice a year has no noise
 * to remove — each reading *is* the signal, and a rolling mean through three
 * points would invent a smooth curve where the honest picture is three dots.
 *
 * The median gap rather than the mean: one holiday in an otherwise daily series
 * should not disqualify it, and a median shrugs that off where an average
 * would not.
 */
export function isDenselyLogged(points: Point[]): boolean {
  if (points.length < MIN_POINTS_TO_SMOOTH) return false;

  const gaps: number[] = [];
  for (let i = 1; i < points.length; i++) {
    gaps.push((points[i].t - points[i - 1].t) / DAY_MS);
  }
  gaps.sort((a, b) => a - b);

  const mid = Math.floor(gaps.length / 2);
  const median =
    gaps.length % 2 === 1 ? gaps[mid] : (gaps[mid - 1] + gaps[mid]) / 2;

  return median <= MAX_MEDIAN_GAP_DAYS;
}

export type SmoothedPoint = Point & { avg: number };

/**
 * A trailing mean over `days`, carried on each point as `avg`.
 *
 * Trailing rather than centred: a centred window would let tomorrow's weight
 * change the line drawn at today, so the curve would keep rewriting its own
 * past every time you logged. Trailing only ever looks backwards, which is what
 * you were actually able to know at the time.
 *
 * The first points average over a partial window. That is the honest answer —
 * there is nothing earlier to include — and it simply means the line starts
 * hugging the readings before it settles.
 */
export function smooth(points: Point[], days = SMOOTHING_DAYS): SmoothedPoint[] {
  const windowMs = days * DAY_MS;
  const out: SmoothedPoint[] = [];
  let start = 0;
  let sum = 0;

  for (let i = 0; i < points.length; i++) {
    sum += points[i].value;
    while (points[start].t < points[i].t - windowMs) {
      sum -= points[start].value;
      start += 1;
    }
    out.push({ ...points[i], avg: sum / (i - start + 1) });
  }

  return out;
}

export type WindowChange = { delta: number; days: number };

/**
 * How far the metric moved across the window on screen, and over how long.
 *
 * `summarize` only ever compares the last two readings, which answers "what
 * happened since Tuesday" — rarely the question. "Down 18 mg/dL over five
 * months" is the sentence someone actually wants from a chart.
 *
 * The span is measured off the readings themselves, not the range button: pick
 * 1Y with four months of data and it says four months, because claiming a year
 * of evidence you do not have is exactly the kind of quiet overstatement this
 * chart is meant to avoid.
 */
export function windowChange(points: Point[]): WindowChange | null {
  if (points.length < 2) return null;
  const first = points[0];
  const last = points[points.length - 1];
  const days = Math.round((last.t - first.t) / DAY_MS);
  // Everything logged on one day is a spread, not a change over time.
  if (days === 0) return null;
  return { delta: last.value - first.value, days };
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
