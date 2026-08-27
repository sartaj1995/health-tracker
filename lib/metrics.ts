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
    help: "Set once. Used together with weight to work out your BMI.",
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
    help: "Calculated from each weight reading and your height - nothing to enter.",
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
    help: "Bands shown are the usual male reference. Healthy ranges for women run roughly 8-10 points higher.",
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
    bands: [
      { to: 70, level: "warn", label: "Low" },
      { to: 100, level: "good", label: "Normal" },
      { to: 126, level: "warn", label: "Prediabetic range" },
      { to: null, level: "bad", label: "Diabetic range" },
    ],
    help: "After 8-12 hours without food.",
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
    bands: [
      { to: 40, level: "bad", label: "Low" },
      { to: 60, level: "warn", label: "Acceptable" },
      { to: null, level: "good", label: "Protective" },
    ],
    help: "The one where higher is better. Under 50 is considered low for women.",
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
    bands: [
      { to: 150, level: "good", label: "Normal" },
      { to: 200, level: "warn", label: "Borderline high" },
      { to: 500, level: "bad", label: "High" },
      { to: null, level: "bad", label: "Very high" },
    ],
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
    bands: [
      { to: 30, level: "bad", label: "Low iron stores" },
      { to: 300, level: "good", label: "Normal" },
      { to: null, level: "warn", label: "High" },
    ],
    help: "Lab ranges differ by sex; the lower bound quoted for women is often around 15.",
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
    bands: [
      { to: 13, level: "bad", label: "Low" },
      { to: 17.5, level: "good", label: "Normal" },
      { to: null, level: "warn", label: "High" },
    ],
    help: "Male reference. For women the normal range is roughly 12.0-15.5.",
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
    bands: [
      { to: 0.4, level: "bad", label: "Low (overactive)" },
      { to: 4, level: "good", label: "Normal" },
      { to: 10, level: "warn", label: "High (underactive)" },
      { to: null, level: "bad", label: "Very high" },
    ],
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
    bands: [
      { to: 0.6, level: "warn", label: "Low" },
      { to: 1.3, level: "good", label: "Normal" },
      { to: null, level: "bad", label: "High" },
    ],
    help: "A kidney-function marker. Muscle mass shifts it, so athletes often run high.",
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
    bands: [
      { to: 3.5, level: "warn", label: "Low" },
      { to: 7, level: "good", label: "Normal" },
      { to: null, level: "bad", label: "High" },
    ],
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
    bands: [
      { to: 40, level: "good", label: "Normal" },
      { to: 80, level: "warn", label: "Mildly elevated" },
      { to: null, level: "bad", label: "Elevated" },
    ],
    help: "A liver enzyme.",
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

/** Metrics you can actually type a number into. */
export const ENTERABLE = METRICS.filter((m) => !m.derived);

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
  return metric.bands;
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
