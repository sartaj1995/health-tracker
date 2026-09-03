import type { Metric } from "./types";
import { todayISO } from "./stats";

/**
 * A metric name fit to drop into the middle of a sentence.
 *
 * Plain `.toLowerCase()` turns "VLDL cholesterol" into "vldl cholesterol" and
 * "Vitamin D" into "vitamin d". Only an ordinary Capitalised word gets folded;
 * acronyms (VLDL, TSH, BMI), mixed case (HbA1c) and single letters (the D in
 * Vitamin D) are left exactly as they are.
 */
export function inSentence(label: string): string {
  return label
    .split(" ")
    .map((word) => (/^[A-Z][a-z]+$/.test(word) ? word.toLowerCase() : word))
    .join(" ");
}

export function formatValue(metric: Metric, value: number): string {
  const n = value.toFixed(metric.decimals);
  // Step counts read much better grouped.
  return metric.id === "steps" ? Number(n).toLocaleString("en-IN") : n;
}

/** "128/82" for blood pressure, plain number otherwise. */
export function formatReading(
  metric: Metric,
  value: number,
  value2?: number,
): string {
  const main = formatValue(metric, value);
  return metric.secondary && value2 !== undefined
    ? `${main}/${value2.toFixed(metric.decimals)}`
    : main;
}

export function formatDelta(metric: Metric, delta: number): string {
  const sign = delta > 0 ? "+" : delta < 0 ? "-" : "";
  return `${sign}${formatValue(metric, Math.abs(delta))}`;
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  const thisYear = new Date().getFullYear();
  return y === thisYear
    ? `${d} ${MONTHS[m - 1]}`
    : `${d} ${MONTHS[m - 1]} ${y}`;
}

export function formatFullDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  const ms =
    new Date(by, bm - 1, bd).getTime() - new Date(ay, am - 1, ad).getTime();
  return Math.round(ms / 86400000);
}

/** "Today", "Yesterday", "5 days ago", then falls back to a date. */
export function relativeDate(iso: string): string {
  const diff = daysBetween(iso, todayISO());
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff > 1 && diff < 7) return `${diff} days ago`;
  if (diff < 0) return formatDate(iso);
  if (diff < 30) return `${Math.floor(diff / 7)} week${diff < 14 ? "" : "s"} ago`;
  return formatDate(iso);
}

export function daysAgo(iso: string): number {
  return daysBetween(iso, todayISO());
}

/**
 * A length of time in the unit a person would say it in: "9 days", "6 weeks",
 * "5 months", "2 years". Used for the span a chart covers, where nobody wants
 * to be told their weight fell over 847 days.
 */
export function formatSpan(days: number): string {
  if (days < 14) return `${days} day${days === 1 ? "" : "s"}`;
  if (days < 60) {
    const weeks = Math.round(days / 7);
    return `${weeks} week${weeks === 1 ? "" : "s"}`;
  }
  const months = Math.round(days / 30.44);
  if (months < 24) return `${months} month${months === 1 ? "" : "s"}`;
  const years = Math.round(days / 365.25);
  return `${years} year${years === 1 ? "" : "s"}`;
}

/**
 * What the chart would tell you if you could see it.
 *
 * A screen reader meets the chart as a pile of unlabelled SVG, so it gets this
 * sentence instead. It deliberately summarises rather than listing every
 * reading: the metric page already renders all of them as text further down,
 * and repeating them here would mean hearing the same data twice.
 */
export function describeSeries(
  metric: Metric,
  points: { date: string; value: number }[],
  statusLabel?: string,
): string {
  if (points.length === 0) return `${metric.label}: no readings yet.`;

  const unit = metric.unit ? ` ${metric.unit}` : "";
  const latest = points[points.length - 1];
  const status = statusLabel ? `, ${statusLabel}` : "";

  if (points.length === 1) {
    return `${metric.label} over time: one reading, ${formatValue(metric, latest.value)}${unit} on ${formatFullDate(latest.date)}${status}.`;
  }

  const values = points.map((p) => p.value);
  return (
    `${metric.label} over time: ${points.length} readings from ` +
    `${formatFullDate(points[0].date)} to ${formatFullDate(latest.date)}, ` +
    `ranging ${formatValue(metric, Math.min(...values))} to ` +
    `${formatValue(metric, Math.max(...values))}${unit}. ` +
    `Latest ${formatValue(metric, latest.value)}${unit}${status}.`
  );
}
