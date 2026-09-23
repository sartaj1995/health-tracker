import type { Band, Category, Level, Metric, Profile } from "./types";

/**
 * Reference ranges below are the common adult clinical cutoffs, in the units
 * used by Indian labs (mg/dL, ng/mL, pg/mL). Several genuinely depend on age,
 * sex and pregnancy - those carry a `help` note. They are here to give a
 * reading context at a glance, not to diagnose anything.
 */

const BMI_WHO: Band[] = [
  { to: 18.5, level: "warn", label: "Underweight" },
  { to: 25, level: "good", label: "Normal" },
  { to: 30, level: "warn", label: "Overweight" },
  { to: null, level: "bad", label: "Obese" },
];

const BMI_ASIAN: Band[] = [
  { to: 18.5, level: "warn", label: "Underweight" },
  { to: 23, level: "good", label: "Normal" },
  { to: 27.5, level: "warn", label: "Overweight" },
  { to: null, level: "bad", label: "Obese" },
];

export const CATEGORY_ORDER: Category[] = [
  "Body",
  "Vitals",
  "Blood sugar",
  "Lipids",
  "Vitamins & minerals",
  "Thyroid",
  "Organ function",
  "Lifestyle",
];

export const METRICS: Metric[] = [
  // ---------------------------------------------------------------- Body
  {
    id: "weight",
    label: "Weight",
    unit: "kg",
    category: "Body",
    direction: "neutral",
    decimals: 1,
    step: 0.1,
    min: 20,
    max: 300,
  },
  {
    id: "height",
    label: "Height",
    unit: "cm",
    category: "Body",
    direction: "neutral",
    decimals: 1,
    step: 0.5,
    min: 100,
    max: 250,
    /*
     * Height is one value in Settings now. As a metric it kept dated readings,
     * and once any existed BMI stopped reading Settings at all — so the height
     * you could see and edit was not the height being used.
     */
    retired: true,
    help: "Your height is set in Settings now, where it works out your BMI. Readings logged here before stay in your history.",
  },
  {
    id: "bmi",
    label: "BMI",
    unit: "",
    category: "Body",
    direction: "neutral",
    decimals: 1,
    step: 0.1,
    derived: true,
    bands: BMI_ASIAN,
    help: "Calculated from each weight reading and the height in Settings - nothing to enter.",
  },
  {
    id: "bodyFat",
    label: "Body fat",
    unit: "%",
    category: "Body",
    direction: "down",
    decimals: 1,
    step: 0.1,
    min: 2,
    max: 70,
    bands: [
      { to: 8, level: "warn", label: "Very low" },
      { to: 20, level: "good", label: "Healthy" },
      { to: 25, level: "warn", label: "Elevated" },
      { to: null, level: "bad", label: "High" },
    ],
    bandsBySex: {
      female: [
        { to: 16, level: "warn", label: "Very low" },
        { to: 30, level: "good", label: "Healthy" },
        { to: 35, level: "warn", label: "Elevated" },
        { to: null, level: "bad", label: "High" },
      ],
    },
    help: "Healthy ranges run roughly 8-10 points higher for women.",
  },
  {
    id: "waist",
    label: "Waist",
    unit: "cm",
    category: "Body",
    direction: "down",
    decimals: 1,
    step: 0.5,
    min: 40,
    max: 200,
    bands: [
      { to: 90, level: "good", label: "Healthy" },
      { to: 100, level: "warn", label: "Elevated" },
      { to: null, level: "bad", label: "High" },
    ],
    bandsBySex: {
      female: [
        { to: 80, level: "good", label: "Healthy" },
        { to: 90, level: "warn", label: "Elevated" },
        { to: null, level: "bad", label: "High" },
      ],
    },
    help: "South-Asian cutoffs: 90 cm for men, 80 cm for women.",
  },

  // -------------------------------------------------------------- Vitals
  {
    id: "bloodPressure",
    label: "Blood pressure",
    unit: "mmHg",
    category: "Vitals",
    direction: "down",
    decimals: 0,
    step: 1,
    min: 50,
    max: 260,
    bands: [
      { to: 90, level: "warn", label: "Low" },
      { to: 120, level: "good", label: "Normal" },
      { to: 130, level: "warn", label: "Elevated" },
      { to: 140, level: "warn", label: "Stage 1" },
      { to: null, level: "bad", label: "Stage 2" },
    ],
    secondary: {
      label: "Diastolic",
      primaryLabel: "Systolic",
      bands: [
        { to: 60, level: "warn", label: "Low" },
        { to: 80, level: "good", label: "Normal" },
        { to: 90, level: "warn", label: "Stage 1" },
        { to: null, level: "bad", label: "Stage 2" },
      ],
    },
    help: "Enter systolic (upper) and diastolic (lower). Measure seated, after five minutes of rest.",
  },
  {
    id: "restingHr",
    label: "Resting heart rate",
    unit: "bpm",
    category: "Vitals",
    direction: "down",
    decimals: 0,
    step: 1,
    min: 30,
    max: 200,
    bands: [
      { to: 50, level: "warn", label: "Low" },
      { to: 70, level: "good", label: "Good" },
      { to: 90, level: "warn", label: "Elevated" },
      { to: null, level: "bad", label: "High" },
    ],
    help: "Well-trained endurance athletes sit below 50 quite normally.",
  },
  {
    id: "spo2",
    label: "Blood oxygen",
    unit: "%",
    category: "Vitals",
    direction: "up",
    decimals: 0,
    step: 1,
    min: 50,
    max: 100,
    bands: [
      { to: 90, level: "bad", label: "Low" },
      { to: 95, level: "warn", label: "Borderline" },
      { to: null, level: "good", label: "Normal" },
    ],
  },

  // --------------------------------------------------------- Blood sugar
  {
    id: "fastingGlucose",
    label: "Fasting glucose",
    unit: "mg/dL",
    category: "Blood sugar",
    direction: "down",
    decimals: 0,
    step: 1,
    min: 20,
    max: 500,
    recheckDays: 180,
    bands: [
      { to: 70, level: "warn", label: "Low" },
      { to: 100, level: "good", label: "Normal" },
      { to: 126, level: "warn", label: "Prediabetic range" },
      { to: null, level: "bad", label: "Diabetic range" },
    ],
    help: "After 8-12 hours without food.",
  },
  {
    id: "postprandialGlucose",
    label: "PP glucose",
    unit: "mg/dL",
    category: "Blood sugar",
    direction: "down",
    decimals: 0,
    step: 1,
    min: 20,
    // Most home glucometers read up to 600 and show "HI" above it.
    max: 600,
    recheckDays: 180,
    /*
     * The 140 and 200 cutoffs come from the two-hour glucose tolerance test,
     * which uses a standard 75 g glucose drink. A post-meal reading is not
     * standardised the way that drink is, but Indian labs report PPBS against
     * the same numbers — so these agree with what the report itself will say.
     */
    bands: [
      { to: 70, level: "warn", label: "Low" },
      { to: 140, level: "good", label: "Normal" },
      { to: 200, level: "warn", label: "Prediabetic range" },
      { to: null, level: "bad", label: "Diabetic range" },
    ],
    help: "Two hours after you start a meal. PP is short for post-prandial, meaning after a meal. Measured sooner, it reads higher than these ranges expect.",
  },
  {
    id: "hba1c",
    label: "HbA1c",
    unit: "%",
    category: "Blood sugar",
    direction: "down",
    decimals: 1,
    step: 0.1,
    min: 3,
    max: 20,
    recheckDays: 180,
    bands: [
      { to: 5.7, level: "good", label: "Normal" },
      { to: 6.5, level: "warn", label: "Prediabetic range" },
      { to: null, level: "bad", label: "Diabetic range" },
    ],
    help: "Reflects your average blood sugar over the past 2-3 months.",
  },

  // -------------------------------------------------------------- Lipids
  {
    id: "totalCholesterol",
    label: "Total cholesterol",
    unit: "mg/dL",
    category: "Lipids",
    direction: "down",
    decimals: 0,
    step: 1,
    min: 50,
    max: 500,
    recheckDays: 365,
    bands: [
      { to: 200, level: "good", label: "Desirable" },
      { to: 240, level: "warn", label: "Borderline high" },
      { to: null, level: "bad", label: "High" },
    ],
  },
  {
    id: "ldl",
    label: "LDL cholesterol",
    unit: "mg/dL",
    category: "Lipids",
    direction: "down",
    decimals: 0,
    step: 1,
    min: 20,
    max: 400,
    recheckDays: 365,
    bands: [
      { to: 100, level: "good", label: "Optimal" },
      { to: 130, level: "good", label: "Near optimal" },
      { to: 160, level: "warn", label: "Borderline high" },
      { to: 190, level: "bad", label: "High" },
      { to: null, level: "bad", label: "Very high" },
    ],
    help: "The one that matters most for heart risk. Lower is better.",
  },
  {
    id: "hdl",
    label: "HDL cholesterol",
    unit: "mg/dL",
    category: "Lipids",
    direction: "up",
    decimals: 0,
    step: 1,
    min: 10,
    max: 150,
    recheckDays: 365,
    bands: [
      { to: 40, level: "bad", label: "Low" },
      { to: 60, level: "warn", label: "Acceptable" },
      { to: null, level: "good", label: "Protective" },
    ],
    bandsBySex: {
      female: [
        { to: 50, level: "bad", label: "Low" },
        { to: 60, level: "warn", label: "Acceptable" },
        { to: null, level: "good", label: "Protective" },
      ],
    },
    help: "The one where higher is better. The low cutoff is 50 for women and 40 for men.",
  },
  {
    id: "triglycerides",
    label: "Triglycerides",
    unit: "mg/dL",
    category: "Lipids",
    direction: "down",
    decimals: 0,
    step: 1,
    min: 20,
    max: 1000,
    recheckDays: 365,
    bands: [
      { to: 150, level: "good", label: "Normal" },
      { to: 200, level: "warn", label: "Borderline high" },
      { to: 500, level: "bad", label: "High" },
      { to: null, level: "bad", label: "Very high" },
    ],
  },
  {
    id: "vldl",
    label: "VLDL cholesterol",
    unit: "mg/dL",
    category: "Lipids",
    direction: "down",
    decimals: 0,
    step: 1,
    min: 1,
    max: 200,
    recheckDays: 365,
    bands: [
      { to: 30, level: "good", label: "Normal" },
      { to: 40, level: "warn", label: "Borderline high" },
      { to: null, level: "bad", label: "High" },
    ],
    help: "Most labs calculate this as triglycerides divided by 5 rather than measuring it, so it tracks your triglycerides almost exactly.",
  },
  {
    id: "lpa",
    label: "Lp(a)",
    unit: "mg/dL",
    category: "Lipids",
    direction: "down",
    decimals: 1,
    step: 0.1,
    min: 0,
    max: 300,
    /*
     * Deliberately no recheckDays. Every other line on this panel moves with
     * how you have been eating and is worth repeating yearly; Lp(a) is set by
     * a gene and holds steady for life, so it is a once-in-a-lifetime test.
     * Putting it on the re-check nudge would be asking for a blood draw that
     * can only tell you what you already know.
     */
    bands: [
      { to: 30, level: "good", label: "Low risk" },
      { to: 50, level: "warn", label: "Borderline" },
      { to: 90, level: "bad", label: "High risk" },
      { to: null, level: "bad", label: "Very high risk" },
    ],
    help: "Lipoprotein(a) — an inherited risk factor the standard lipid panel misses entirely. Set by your genes and barely moved by diet or statins, so it is measured once rather than tracked. Labs report it in either mg/dL or nmol/L and the two do not convert cleanly; these bands are mg/dL.",
  },

  // -------------------------------------------------- Vitamins & minerals
  {
    id: "vitaminD",
    label: "Vitamin D",
    unit: "ng/mL",
    category: "Vitamins & minerals",
    direction: "up",
    decimals: 1,
    step: 0.1,
    min: 1,
    max: 200,
    recheckDays: 180,
    bands: [
      { to: 20, level: "bad", label: "Deficient" },
      { to: 30, level: "warn", label: "Insufficient" },
      { to: 100, level: "good", label: "Sufficient" },
      { to: null, level: "warn", label: "Very high" },
    ],
    help: "Measured as 25-hydroxy vitamin D. If your lab reports nmol/L, divide by 2.5.",
  },
  {
    id: "vitaminB12",
    label: "Vitamin B12",
    unit: "pg/mL",
    category: "Vitamins & minerals",
    direction: "up",
    decimals: 0,
    step: 1,
    min: 50,
    max: 2000,
    recheckDays: 365,
    bands: [
      { to: 200, level: "bad", label: "Deficient" },
      { to: 300, level: "warn", label: "Borderline" },
      { to: 900, level: "good", label: "Normal" },
      { to: null, level: "warn", label: "High" },
    ],
  },
  {
    id: "ferritin",
    label: "Ferritin",
    unit: "ng/mL",
    category: "Vitamins & minerals",
    direction: "up",
    decimals: 0,
    step: 1,
    min: 1,
    max: 1000,
    recheckDays: 365,
    bands: [
      { to: 30, level: "bad", label: "Low iron stores" },
      { to: 300, level: "good", label: "Normal" },
      { to: null, level: "warn", label: "High" },
    ],
    bandsBySex: {
      female: [
        { to: 15, level: "bad", label: "Low iron stores" },
        { to: 200, level: "good", label: "Normal" },
        { to: null, level: "warn", label: "High" },
      ],
    },
    help: "Iron stores. Ranges differ by sex and between labs, so check yours against the report.",
  },
  {
    id: "hemoglobin",
    label: "Hemoglobin",
    unit: "g/dL",
    category: "Vitamins & minerals",
    direction: "up",
    decimals: 1,
    step: 0.1,
    min: 3,
    max: 25,
    recheckDays: 365,
    bands: [
      { to: 13, level: "bad", label: "Low" },
      { to: 17.5, level: "good", label: "Normal" },
      { to: null, level: "warn", label: "High" },
    ],
    bandsBySex: {
      female: [
        { to: 12, level: "bad", label: "Low" },
        { to: 15.5, level: "good", label: "Normal" },
        { to: null, level: "warn", label: "High" },
      ],
    },
    help: "Normal runs roughly 13.0-17.5 for men and 12.0-15.5 for women.",
  },

  // ------------------------------------------------------------- Thyroid
  {
    id: "tsh",
    label: "TSH",
    unit: "mIU/L",
    category: "Thyroid",
    direction: "neutral",
    decimals: 2,
    step: 0.01,
    min: 0,
    max: 100,
    recheckDays: 365,
    bands: [
      { to: 0.4, level: "bad", label: "Low (overactive)" },
      { to: 4, level: "good", label: "Normal" },
      { to: 10, level: "warn", label: "High (underactive)" },
      { to: null, level: "bad", label: "Very high" },
    ],
  },
  {
    id: "t3",
    label: "Total T3",
    unit: "ng/dL",
    category: "Thyroid",
    direction: "neutral",
    decimals: 0,
    step: 1,
    /*
     * Free T3 is a different assay reported around 2-4 pg/mL. A floor of 10
     * means one entered here by mistake is called implausible rather than
     * saved as a very low total T3.
     */
    min: 10,
    max: 1000,
    recheckDays: 365,
    /*
     * Both ends warn rather than alarm. T3 is read next to TSH rather than on
     * its own, and a T3 outside the range is a reason to look at the panel,
     * not a finding by itself.
     */
    bands: [
      { to: 80, level: "warn", label: "Low" },
      { to: 200, level: "good", label: "Normal" },
      { to: null, level: "warn", label: "High" },
    ],
    help: "Total T3, the one on a T3/T4/TSH panel. Free T3 (FT3) is a different test in different units and does not belong here. Reference ranges vary between labs, so your report's own range wins.",
  },

  // ------------------------------------------------------ Organ function
  {
    id: "creatinine",
    label: "Creatinine",
    unit: "mg/dL",
    category: "Organ function",
    direction: "neutral",
    decimals: 2,
    step: 0.01,
    min: 0.1,
    max: 15,
    recheckDays: 365,
    bands: [
      { to: 0.6, level: "warn", label: "Low" },
      { to: 1.3, level: "good", label: "Normal" },
      { to: null, level: "bad", label: "High" },
    ],
    bandsBySex: {
      female: [
        { to: 0.5, level: "warn", label: "Low" },
        { to: 1.1, level: "good", label: "Normal" },
        { to: null, level: "bad", label: "High" },
      ],
    },
    help: "A kidney-function marker, and one that differs by sex. Muscle mass shifts it too, so athletes often run high.",
  },
  {
    id: "uricAcid",
    label: "Uric acid",
    unit: "mg/dL",
    category: "Organ function",
    direction: "down",
    decimals: 1,
    step: 0.1,
    min: 0.5,
    max: 20,
    recheckDays: 365,
    bands: [
      { to: 3.5, level: "warn", label: "Low" },
      { to: 7, level: "good", label: "Normal" },
      { to: null, level: "bad", label: "High" },
    ],
    bandsBySex: {
      female: [
        { to: 2.5, level: "warn", label: "Low" },
        { to: 6, level: "good", label: "Normal" },
        { to: null, level: "bad", label: "High" },
      ],
    },
    help: "Ranges differ by sex, running lower for women.",
  },
  {
    id: "alt",
    label: "ALT (SGPT)",
    unit: "U/L",
    category: "Organ function",
    direction: "down",
    decimals: 0,
    step: 1,
    min: 1,
    max: 500,
    recheckDays: 365,
    bands: [
      { to: 40, level: "good", label: "Normal" },
      { to: 80, level: "warn", label: "Mildly elevated" },
      { to: null, level: "bad", label: "Elevated" },
    ],
    help: "A liver enzyme.",
  },
  {
    id: "psa",
    label: "PSA",
    unit: "ng/mL",
    category: "Organ function",
    direction: "down",
    decimals: 2,
    step: 0.01,
    min: 0,
    /*
     * Advanced disease reaches the hundreds. A tighter ceiling would refuse a
     * real reading, which is worse than a weaker implausibility check.
     */
    max: 1000,
    recheckDays: 365,
    bands: [
      { to: 4, level: "good", label: "Normal" },
      { to: 10, level: "warn", label: "Borderline" },
      { to: null, level: "bad", label: "High" },
    ],
    help: "A prostate marker. The usual cutoff is 4, but it drifts up with age — roughly 2.5 at 40 and 6.5 at 70 — so read it against your report's own range. Free PSA is a separate test and does not belong here.",
  },

  // ----------------------------------------------------------- Lifestyle
  {
    id: "sleep",
    label: "Sleep",
    unit: "h",
    category: "Lifestyle",
    direction: "up",
    decimals: 1,
    step: 0.25,
    min: 0,
    max: 24,
    bands: [
      { to: 6, level: "bad", label: "Too little" },
      { to: 7, level: "warn", label: "A bit short" },
      { to: 9, level: "good", label: "Good" },
      { to: null, level: "warn", label: "Long" },
    ],
  },
  {
    id: "steps",
    label: "Steps",
    unit: "",
    category: "Lifestyle",
    direction: "up",
    decimals: 0,
    step: 100,
    min: 0,
    max: 100000,
    bands: [
      { to: 5000, level: "warn", label: "Sedentary" },
      { to: 7500, level: "warn", label: "Low active" },
      { to: 10000, level: "good", label: "Active" },
      { to: null, level: "good", label: "Very active" },
    ],
  },
  {
    id: "water",
    label: "Water",
    unit: "L",
    category: "Lifestyle",
    direction: "up",
    decimals: 1,
    step: 0.1,
    min: 0,
    max: 20,
    bands: [
      { to: 2, level: "warn", label: "Low" },
      { to: null, level: "good", label: "Good" },
    ],
  },
];

const BY_ID = new Map(METRICS.map((m) => [m.id, m]));

export function getMetric(id: string): Metric | undefined {
  return BY_ID.get(id);
}

/** Whether new readings of a metric can be entered. */
export function isLoggable(metric: Metric): boolean {
  return !metric.derived && !metric.retired;
}

/** Metrics you can actually type a number into. */
export const ENTERABLE = METRICS.filter(isLoggable);

export function metricsByCategory(list: Metric[] = METRICS) {
  return CATEGORY_ORDER.map((category) => ({
    category,
    metrics: list.filter((m) => m.category === category),
  })).filter((g) => g.metrics.length > 0);
}

/** BMI bands depend on a user setting, so resolve them per render. */
export function bandsFor(metric: Metric, profile: Profile): Band[] | undefined {
  if (metric.id === "bmi") {
    return profile.bmiStandard === "who" ? BMI_WHO : BMI_ASIAN;
  }
  /*
   * A sex-specific ladder wins, but only once a sex has been chosen. Until then
   * the metric's own bands stand, so nothing already saved reclassifies itself
   * on a guess — and every caller gets this for free, because classify(),
   * classifyReading(), the chart shading and the add-form preview all ask here.
   */
  const bySex = profile.sex ? metric.bandsBySex?.[profile.sex] : undefined;
  return bySex ?? metric.bands;
}

export function classify(
  value: number,
  bands: Band[] | undefined,
): { level: Level; label: string } | null {
  if (!bands?.length) return null;
  for (const band of bands) {
    if (band.to === null || value < band.to) {
      return { level: band.level, label: band.label };
    }
  }
  return null;
}

/** The reference ladder for the second number, where a metric captures one. */
export function secondaryBands(metric: Metric): Band[] | undefined {
  return metric.secondary?.bands;
}

const LEVEL_RANK: Record<Level, number> = { good: 0, warn: 1, bad: 2 };

/**
 * Classify a whole reading rather than half of one.
 *
 * Blood pressure is two numbers and either can be the one that is wrong.
 * Judging it on the systolic alone reports 110/100 as **Normal** — a diastolic
 * well into stage 2, coloured green, on a dashboard whose entire job is to
 * surface exactly that. The diastolic ladder was in the catalogue from the
 * start; nothing ever read it.
 *
 * Clinical practice puts a reading in the worse of the two categories, which is
 * what this does. Ties go to the second number: the ladders share a vocabulary,
 * but the diastolic one has no "Elevated" rung, so a diastolic that has reached
 * a warning at all is already at stage 1 — the more serious of two warnings.
 */
export function classifyReading(
  metric: Metric,
  value: number,
  value2: number | undefined,
  profile: Profile,
): { level: Level; label: string } | null {
  const primary = classify(value, bandsFor(metric, profile));

  const bands = secondaryBands(metric);
  if (value2 === undefined || !bands) return primary;

  const secondary = classify(value2, bands);
  if (!secondary) return primary;
  if (!primary) return secondary;

  return LEVEL_RANK[secondary.level] >= LEVEL_RANK[primary.level] ? secondary : primary;
}

/** The healthy window, used to draw the shaded band behind a chart. */
export function goodRange(
  bands: Band[] | undefined,
): { from: number; to: number | null } | null {
  if (!bands?.length) return null;
  let from: number | null = null;
  let to: number | null = null;
  let prev = 0;
  for (const band of bands) {
    if (band.level === "good") {
      if (from === null) from = prev;
      to = band.to;
    }
    prev = band.to ?? prev;
  }
  return from === null ? null : { from, to };
}
