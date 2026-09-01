import { getMetric } from "./metrics";

/**
 * Reads a pasted lab report and pulls out the readings it recognises.
 *
 * Deliberately local and deterministic — a lab report is the most identifying
 * thing this app ever touches, and it never leaves the browser. That is
 * affordable because the problem is narrow: 27 known metrics, known units,
 * known plausible ranges, and lab reports are laid out regularly. Anything the
 * parser gets wrong is corrected in the confirmation step before saving, so it
 * needs to be useful rather than perfect.
 */

/**
 * How each metric shows up on a real report. Indian labs are the common case
 * here, hence SGPT alongside ALT and the British spellings.
 *
 * Order within a metric does not matter: the longest alias that matches a line
 * wins, so "HbA1c" is never mistaken for the "Hb" of haemoglobin.
 */
const ALIASES: Record<string, string[]> = {
  totalCholesterol: [
    "total cholesterol",
    "cholesterol total",
    "cholesterol - total",
    "serum cholesterol",
    "cholesterol",
  ],
  ldl: ["ldl cholesterol", "ldl - cholesterol", "low density lipoprotein", "ldl"],
  hdl: ["hdl cholesterol", "hdl - cholesterol", "high density lipoprotein", "hdl"],
  vldl: ["vldl cholesterol", "very low density lipoprotein", "vldl"],
  /*
   * The longer forms carrying "cholesterol" are here to win the longest-alias
   * contest against plain "cholesterol" above: a line reading "Lp(a)
   * cholesterol 45" would otherwise be saved as your total cholesterol.
   */
  lpa: [
    "lipoprotein (a) cholesterol",
    "lipoprotein(a) cholesterol",
    "lp(a) cholesterol",
    "lipoprotein (a)",
    "lipoprotein(a)",
    "lp (a)",
    "lp(a)",
    "lipoprotein a",
    "lpa",
  ],
  triglycerides: ["triglycerides", "triglyceride", "serum triglycerides"],
  hba1c: [
    "glycosylated haemoglobin",
    "glycosylated hemoglobin",
    "glycated haemoglobin",
    "glycated hemoglobin",
    "hba1c",
    "hb a1c",
  ],
  fastingGlucose: [
    "fasting plasma glucose",
    "fasting blood sugar",
    "blood sugar fasting",
    "glucose fasting",
    "fasting glucose",
    "fbs",
  ],
  vitaminD: [
    "25-hydroxyvitamin d",
    "25 hydroxy vitamin d",
    "25-hydroxy vitamin d",
    "25 oh vitamin d",
    "vitamin d total",
    "vitamin d3",
    "vitamin d",
  ],
  vitaminB12: ["vitamin b12", "vitamin b-12", "cyanocobalamin", "b12"],
  ferritin: ["serum ferritin", "ferritin"],
  hemoglobin: ["haemoglobin", "hemoglobin", "hgb", "hb"],
  tsh: ["thyroid stimulating hormone", "tsh"],
  creatinine: ["serum creatinine", "creatinine"],
  uricAcid: ["serum uric acid", "uric acid"],
  alt: ["alanine aminotransferase", "sgpt", "alt"],
  restingHr: ["resting heart rate", "pulse rate", "heart rate", "pulse"],
  spo2: ["oxygen saturation", "spo2"],
  bloodPressure: ["blood pressure", "bp"],
  weight: ["body weight", "weight"],
  height: ["height"],
  bodyFat: ["body fat percentage", "body fat"],
  waist: ["waist circumference", "waist"],
};

/**
 * Units a report might use that are not the ones we store, and how to get
 * there. Applied only when the unit is written on the line, and always shown
 * in the confirmation step so a wrong guess is visible before it is saved.
 */
const CONVERSIONS: Record<string, { unit: string; factor: number }[]> = {
  vitaminD: [{ unit: "nmol/l", factor: 1 / 2.4966 }],
  vitaminB12: [{ unit: "pmol/l", factor: 1.355 }],
  totalCholesterol: [{ unit: "mmol/l", factor: 38.67 }],
  ldl: [{ unit: "mmol/l", factor: 38.67 }],
  hdl: [{ unit: "mmol/l", factor: 38.67 }],
  vldl: [{ unit: "mmol/l", factor: 38.67 }],
  triglycerides: [{ unit: "mmol/l", factor: 88.57 }],
  /*
   * The one conversion here that is an estimate rather than arithmetic. The
   * others are fixed molar masses; apo(a) has no single one, because the
   * protein's length varies from person to person. 2.15 is the usual working
   * factor and the confirmation step shows the original either way — but a
   * converted Lp(a) is an approximation in a way a converted vitamin D is not.
   */
  lpa: [{ unit: "nmol/l", factor: 1 / 2.15 }],
  fastingGlucose: [{ unit: "mmol/l", factor: 18.016 }],
  hemoglobin: [{ unit: "g/l", factor: 0.1 }],
  ferritin: [{ unit: "ug/l", factor: 1 }, { unit: "µg/l", factor: 1 }],
};

export type ParsedRow = {
  metricId: string;
  value: number;
  value2?: number;
  /** The line it came from, so you can check the parse against the report. */
  source: string;
  /** Set when the number was converted out of another unit. */
  converted?: { value: number; unit: string };
  /** Outside the metric's plausible window — shown, but not ticked by default. */
  suspect?: boolean;
};

export type ParseResult = {
  rows: ParsedRow[];
  /** The report date, if one could be found. */
  date?: string;
  /** Lines that held a number but matched no metric, as a rough "missed" count. */
  unmatched: number;
};

/** Lines that are about the reference range rather than your result. */
const RANGE_NOISE =
  /\b(reference|ref\.?\s*range|normal range|bio\.?\s*ref|desirable|interval|method|units?)\b\s*[:.]?\s*$/i;

/** A line whose numbers are a date and nothing else — a header, not a result. */
function isDateLine(line: string): boolean {
  const withoutDates = line
    .replace(/\b\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}\b/g, "")
    .replace(/\b\d{4}-\d{1,2}-\d{1,2}\b/g, "")
    .replace(/\b\d{1,2}[\s-][a-z]{3,9}[\s-]\d{4}\b/gi, "")
    // Times come attached to collection dates.
    .replace(/\b\d{1,2}:\d{2}(:\d{2})?\s*(am|pm)?\b/gi, "");
  return !/\d/.test(withoutDates);
}

function normalise(line: string): string {
  return line
    .toLowerCase()
    .replace(/[‐-―]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

/** Longest alias wins, so "hba1c" beats the "hb" inside it. */
function matchMetric(line: string): { metricId: string; alias: string } | null {
  let best: { metricId: string; alias: string } | null = null;
  for (const [metricId, aliases] of Object.entries(ALIASES)) {
    for (const alias of aliases) {
      // Word-bounded so "hb" cannot match inside "hba1c" and "alt" cannot
      // match inside "alternate".
      const pattern = new RegExp(
        `(^|[^a-z0-9])${alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z0-9]|$)`,
      );
      if (pattern.test(line) && (!best || alias.length > best.alias.length)) {
        best = { metricId, alias };
      }
    }
  }
  return best;
}

/**
 * Every number on the line, in order, ignoring ones glued to letters.
 *
 * The trailing `-[a-z]` guard matters more than it looks: assay names carry
 * numbers, and "Vitamin D (25-OH) : 41.9" would otherwise be read as 25 — a
 * deficient result saved in place of a healthy one.
 */
function numbersIn(text: string): number[] {
  return [...text.matchAll(/(?<![a-z0-9.])(\d+(?:\.\d+)?)(?![a-z0-9.]|-[a-z])/gi)]
    .map((m) => Number(m[1]))
    .filter((n) => Number.isFinite(n));
}

function findUnit(line: string, metricId: string): { factor: number; unit: string } | null {
  for (const conversion of CONVERSIONS[metricId] ?? []) {
    if (line.includes(conversion.unit)) {
      return { factor: conversion.factor, unit: conversion.unit };
    }
  }
  return null;
}

const MONTHS = [
  "jan", "feb", "mar", "apr", "may", "jun",
  "jul", "aug", "sep", "oct", "nov", "dec",
];

function iso(y: number, m: number, d: number): string | null {
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${y}-${pad(m)}-${pad(d)}`;
}

/**
 * Finds the report date. Prefers a line that says what the date is for —
 * collected, reported, sample date — before falling back to the first date
 * anywhere in the text.
 */
export function findReportDate(text: string): string | undefined {
  const lines = text.split(/\r?\n/);
  const preferred = lines.filter((l) =>
    /\b(collect|report|sample|drawn|received|registered|date)\b/i.test(l),
  );

  for (const group of [preferred, lines]) {
    for (const line of group) {
      // 12/08/2026 or 12-08-2026 — day first, as Indian labs write it.
      const dmy = line.match(/\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})\b/);
      if (dmy) {
        const found = iso(Number(dmy[3]), Number(dmy[2]), Number(dmy[1]));
        if (found) return found;
      }
      // 2026-08-12
      const ymd = line.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/);
      if (ymd) {
        const found = iso(Number(ymd[1]), Number(ymd[2]), Number(ymd[3]));
        if (found) return found;
      }
      // 12 Aug 2026
      const named = line.match(/\b(\d{1,2})[\s-]([a-z]{3,9})[\s-](\d{4})\b/i);
      if (named) {
        const month = MONTHS.indexOf(named[2].slice(0, 3).toLowerCase());
        if (month >= 0) {
          const found = iso(Number(named[3]), month + 1, Number(named[1]));
          if (found) return found;
        }
      }
    }
  }
  return undefined;
}

export function parseLabReport(text: string): ParseResult {
  const rows: ParsedRow[] = [];
  const seen = new Set<string>();
  let unmatched = 0;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = normalise(rawLine);
    if (!line) continue;

    const numbers = numbersIn(line);
    if (numbers.length === 0) continue;

    // A heading like "Reference Range:" carries no result of yours.
    if (RANGE_NOISE.test(line)) continue;

    const match = matchMetric(line);
    if (!match) {
      // The unmatched count exists to say "I may have missed something", so it
      // must not cry wolf. A date header carries numbers but was never a
      // reading, and counting it would make every clean import look lossy.
      if (!isDateLine(line)) unmatched += 1;
      continue;
    }
    // One reading per metric: the first occurrence is the result, anything
    // after is usually the reference range repeated or a second panel.
    if (seen.has(match.metricId)) continue;

    const metric = getMetric(match.metricId);
    if (!metric) continue;

    // Blood pressure is written as a pair and needs both halves.
    if (metric.secondary) {
      const pair = line.match(/\b(\d{2,3})\s*\/\s*(\d{2,3})\b/);
      if (!pair) continue;
      seen.add(match.metricId);
      rows.push({
        metricId: match.metricId,
        value: Number(pair[1]),
        value2: Number(pair[2]),
        source: rawLine.trim(),
      });
      continue;
    }

    // The result is the first number after the metric's name. Reference
    // ranges sit to the right of it on every layout I have seen.
    const afterName = line.slice(line.indexOf(match.alias) + match.alias.length);
    const candidates = numbersIn(afterName);
    if (candidates.length === 0) continue;
    let value = candidates[0];

    const unit = findUnit(line, match.metricId);
    const original = value;
    if (unit) value = Math.round(value * unit.factor * 100) / 100;

    const suspect =
      (metric.min !== undefined && value < metric.min) ||
      (metric.max !== undefined && value > metric.max);

    seen.add(match.metricId);
    rows.push({
      metricId: match.metricId,
      value,
      source: rawLine.trim(),
      converted: unit ? { value: original, unit: unit.unit } : undefined,
      suspect: suspect || undefined,
    });
  }

  return { rows, date: findReportDate(text), unmatched };
}
