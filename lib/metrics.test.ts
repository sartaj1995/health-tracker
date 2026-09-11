import { describe, expect, it } from "vitest";
import {
  CATEGORY_ORDER,
  ENTERABLE,
  METRICS,
  bandsFor,
  classify,
  classifyReading,
  getMetric,
  goodRange,
  secondaryBands,
} from "./metrics";
import { DEFAULT_PROFILE, type Band, type Metric, type Profile } from "./types";

const profile: Profile = DEFAULT_PROFILE;
const banded = METRICS.filter((m) => m.bands?.length);

/**
 * These are the tests that matter most in this app. A wrong threshold does not
 * crash anything — it quietly tells you a reading is Normal when it is not, and
 * you would have no way of noticing.
 */
describe("reference band structure", () => {
  it.each(banded.map((m) => [m.label, m] as [string, Metric]))(
    "%s has a well-formed band ladder",
    (_label, metric) => {
      const bands = metric.bands!;

      // Only the last band may be open-ended, and it must be, or values above
      // the final threshold would classify as nothing at all.
      bands.forEach((band, i) => {
        if (i < bands.length - 1) expect(band.to).not.toBeNull();
      });
      expect(bands[bands.length - 1].to).toBeNull();

      // Thresholds must strictly increase, or an earlier band would swallow a
      // later one — classify() returns the first match.
      const closed = bands.slice(0, -1).map((b) => b.to as number);
      for (let i = 1; i < closed.length; i++) {
        expect(closed[i]).toBeGreaterThan(closed[i - 1]);
      }
    },
  );

  it.each(banded.map((m) => [m.label, m] as [string, Metric]))(
    "%s has one contiguous healthy range",
    (_label, metric) => {
      const bands = metric.bands!;
      const good = bands
        .map((b, i) => (b.level === "good" ? i : -1))
        .filter((i) => i >= 0);

      // Something must read as healthy, or the metric can only ever alarm.
      expect(good.length).toBeGreaterThan(0);
      // Split healthy bands would make goodRange() shade the wrong window.
      expect(good[good.length - 1] - good[0] + 1).toBe(good.length);
    },
  );

  it("classifies every value of every banded metric", () => {
    for (const metric of banded) {
      const thresholds = metric.bands!
        .map((b) => b.to)
        .filter((t): t is number => t !== null);
      // Probe just under, on, and just over every threshold, plus the extremes.
      const probes = [
        metric.min ?? 0,
        ...thresholds.flatMap((t) => [t - 0.01, t, t + 0.01]),
        (metric.max ?? 1000) * 2,
      ];
      for (const value of probes) {
        expect(
          classify(value, metric.bands),
          `${metric.label} left ${value} unclassified`,
        ).not.toBeNull();
      }
    }
  });
});

describe("classify boundary semantics", () => {
  // A band's `to` is its exclusive upper bound, so the threshold value itself
  // belongs to the band above. These are real clinical cutoffs: pinning them
  // means nobody can nudge one without a test turning red.
  const cases: [string, number, string][] = [
    ["hba1c", 5.6, "Normal"],
    ["hba1c", 5.7, "Prediabetic range"],
    ["hba1c", 6.4, "Prediabetic range"],
    ["hba1c", 6.5, "Diabetic range"],

    ["fastingGlucose", 69, "Low"],
    ["fastingGlucose", 70, "Normal"],
    ["fastingGlucose", 99, "Normal"],
    ["fastingGlucose", 100, "Prediabetic range"],
    ["fastingGlucose", 126, "Diabetic range"],

    ["ldl", 99, "Optimal"],
    ["ldl", 100, "Near optimal"],
    ["ldl", 160, "High"],
    ["ldl", 190, "Very high"],

    // HDL runs the other way: higher is better.
    ["hdl", 39, "Low"],
    ["hdl", 40, "Acceptable"],
    ["hdl", 60, "Protective"],

    ["vldl", 29, "Normal"],
    ["vldl", 30, "Borderline high"],
    ["vldl", 40, "High"],

    // Lp(a) is a risk stratifier rather than a range to sit inside, so the
    // bands are named for the risk they carry. Values are mg/dL.
    ["lpa", 29.9, "Low risk"],
    ["lpa", 30, "Borderline"],
    ["lpa", 49.9, "Borderline"],
    ["lpa", 50, "High risk"],
    ["lpa", 90, "Very high risk"],

    // Post-meal cutoffs sit higher than fasting ones: "normal" ends at 140 two
    // hours after eating, against 100 on an empty stomach.
    ["postprandialGlucose", 69, "Low"],
    ["postprandialGlucose", 70, "Normal"],
    ["postprandialGlucose", 139, "Normal"],
    ["postprandialGlucose", 140, "Prediabetic range"],
    ["postprandialGlucose", 199, "Prediabetic range"],
    ["postprandialGlucose", 200, "Diabetic range"],

    // Vitamin D is the awkward one: healthy sits in the middle, and too much
    // is its own warning.
    ["vitaminD", 19.9, "Deficient"],
    ["vitaminD", 20, "Insufficient"],
    ["vitaminD", 30, "Sufficient"],
    ["vitaminD", 99.9, "Sufficient"],
    ["vitaminD", 100, "Very high"],

    ["tsh", 0.39, "Low (overactive)"],
    ["tsh", 0.4, "Normal"],
    ["tsh", 4, "High (underactive)"],
    ["tsh", 10, "Very high"],
  ];

  it.each(cases)("%s at %s reads as %s", (id, value, expected) => {
    const metric = getMetric(id)!;
    expect(classify(value, metric.bands)?.label).toBe(expected);
  });

  it("returns null when a metric has no bands", () => {
    expect(classify(70, undefined)).toBeNull();
    expect(classify(70, [])).toBeNull();
    // Weight is deliberately unbanded — there is no healthy weight in the
    // abstract, only one relative to a target.
    expect(getMetric("weight")!.bands).toBeUndefined();
  });
});

describe("BMI cutoffs follow the chosen standard", () => {
  const bmi = getMetric("bmi")!;

  it("reads 24.0 as Overweight on South-Asian cutoffs but Normal on WHO", () => {
    const asian = bandsFor(bmi, { ...profile, bmiStandard: "asian" });
    const who = bandsFor(bmi, { ...profile, bmiStandard: "who" });

    expect(classify(24, asian)?.label).toBe("Overweight");
    expect(classify(24, who)?.label).toBe("Normal");
  });

  it("agrees at the underweight boundary, which both standards share", () => {
    for (const standard of ["asian", "who"] as const) {
      const bands = bandsFor(bmi, { ...profile, bmiStandard: standard });
      expect(classify(18.4, bands)?.label).toBe("Underweight");
      expect(classify(18.5, bands)?.label).toBe("Normal");
    }
  });

  it("leaves every other metric's bands alone", () => {
    const hdl = getMetric("hdl")!;
    expect(bandsFor(hdl, { ...profile, bmiStandard: "who" })).toBe(hdl.bands);
  });
});

describe("goodRange", () => {
  it("spans the healthy window, open-ended when healthy has no ceiling", () => {
    // HDL: bad under 40, acceptable to 60, protective above.
    expect(goodRange(getMetric("hdl")!.bands)).toEqual({ from: 60, to: null });
  });

  it("closes the window when a band sits above the healthy one", () => {
    // Vitamin D is sufficient from 30, but too much is flagged again at 100.
    expect(goodRange(getMetric("vitaminD")!.bands)).toEqual({ from: 30, to: 100 });
  });

  it("merges adjacent healthy bands", () => {
    // LDL is good twice over — Optimal then Near optimal — and the shaded
    // window should cover both rather than stopping at the first.
    expect(goodRange(getMetric("ldl")!.bands)).toEqual({ from: 0, to: 130 });
  });

  it("returns null without bands", () => {
    expect(goodRange(undefined)).toBeNull();
  });
});

describe("catalogue integrity", () => {
  it("has unique ids", () => {
    const ids = METRICS.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("puts every metric in a known category", () => {
    for (const metric of METRICS) {
      expect(CATEGORY_ORDER).toContain(metric.category);
    }
  });

  it("keeps derived metrics out of the entry form", () => {
    // BMI is computed from weight and height; offering it in the picker would
    // let you record a BMI that contradicts them.
    expect(ENTERABLE.some((m) => m.id === "bmi")).toBe(false);
    expect(ENTERABLE.every((m) => !m.derived)).toBe(true);
  });

  it("gives every metric a sane min/max window", () => {
    for (const metric of METRICS) {
      if (metric.min !== undefined && metric.max !== undefined) {
        expect(metric.max, `${metric.label} max/min inverted`).toBeGreaterThan(
          metric.min,
        );
      }
    }
  });
});

/**
 * The re-check windows drive the dashboard's "might be due" nudge. They are
 * clinical guidance like the bands are, so they get pinned the same way — a
 * silent change here means the app stops asking for a test you should repeat.
 */
describe("re-check windows", () => {
  const expected: Record<string, number> = {
    fastingGlucose: 180,
    // Drawn in the same sitting as fasting, so it goes stale on the same clock.
    postprandialGlucose: 180,
    hba1c: 180,
    vitaminD: 180,
    totalCholesterol: 365,
    ldl: 365,
    hdl: 365,
    vldl: 365,
    triglycerides: 365,
    vitaminB12: 365,
    ferritin: 365,
    hemoglobin: 365,
    tsh: 365,
    creatinine: 365,
    uricAcid: 365,
    alt: 365,
  };

  it.each(Object.entries(expected))("re-checks %s after %i days", (id, days) => {
    expect(getMetric(id)?.recheckDays).toBe(days);
  });

  it("nudges on the lab panels and nothing else", () => {
    // Weight, steps and sleep are logged whenever you like — being nagged that
    // a weight reading is "overdue" would be noise, not a prompt.
    const withWindow = METRICS.filter((m) => m.recheckDays !== undefined).map((m) => m.id);
    expect(withWindow.sort()).toEqual(Object.keys(expected).sort());
  });

  it("never puts a window on a metric you cannot enter", () => {
    for (const metric of METRICS) {
      if (metric.derived) expect(metric.recheckDays).toBeUndefined();
    }
  });

  it("leaves Lp(a) off the nudge on purpose", () => {
    // It sits on the lipid panel, so the obvious tidy-up is to give it the 365
    // its neighbours have. That would be wrong: Lp(a) is genetically set and
    // holds steady for life, so a repeat draw tells you nothing new. This test
    // exists to make that omission look deliberate rather than forgotten.
    expect(getMetric("lpa")?.recheckDays).toBeUndefined();
  });
});

/**
 * Blood pressure is two numbers and either one can be the problem. Reading only
 * the systolic reported 110/100 as "Normal" — a diastolic well into stage 2,
 * shown in green. The diastolic ladder sat in the catalogue from the first
 * commit and nothing ever read it, which is exactly the sort of failure that
 * looks like nothing at all.
 */
describe("classifying both halves of a reading", () => {
  const bp = getMetric("bloodPressure")!;
  const label = (sys: number, dia?: number) =>
    classifyReading(bp, sys, dia, profile)?.label;

  it("does not call a dangerous diastolic normal", () => {
    // The reported case. Systolic is textbook; diastolic is stage 2.
    expect(classify(110, bp.bands)?.label).toBe("Normal");
    expect(label(110, 100)).toBe("Stage 2");
  });

  it("takes whichever half sits in the worse band", () => {
    const cases: [number, number, string][] = [
      [115, 75, "Normal"], // both fine
      [110, 85, "Stage 1"], // diastolic alone is raised
      [135, 75, "Stage 1"], // systolic alone is raised
      [145, 85, "Stage 2"], // systolic worse than diastolic
      [110, 100, "Stage 2"], // diastolic worse than systolic
      [125, 75, "Elevated"], // systolic elevated, diastolic normal
      [85, 55, "Low"], // both below range
    ];
    for (const [sys, dia, expected] of cases) {
      expect(label(sys, dia), `${sys}/${dia}`).toBe(expected);
    }
  });

  it("prefers the diastolic when both are merely warnings", () => {
    // 125 is "Elevated" and 85 is "Stage 1" — both warn, but the diastolic
    // ladder has no Elevated rung, so its warning is the more serious one.
    expect(classify(125, bp.bands)?.label).toBe("Elevated");
    expect(classify(85, secondaryBands(bp))?.label).toBe("Stage 1");
    expect(label(125, 85)).toBe("Stage 1");
  });

  it("flags a reading whose systolic alone would have passed", () => {
    // What the dashboard's "worth a closer look" list actually asks.
    expect(classifyReading(bp, 110, 100, profile)?.level).toBe("bad");
    expect(classifyReading(bp, 110, 85, profile)?.level).toBe("warn");
    expect(classifyReading(bp, 115, 75, profile)?.level).toBe("good");
  });

  it("falls back to the first number when there is no second one", () => {
    expect(label(150)).toBe("Stage 2");
    expect(label(115)).toBe("Normal");
  });

  it("leaves single-number metrics exactly as they were", () => {
    const ldl = getMetric("ldl")!;
    for (const value of [90, 110, 140, 175, 200]) {
      expect(classifyReading(ldl, value, undefined, profile)).toEqual(
        classify(value, ldl.bands),
      );
    }
  });

  it("ignores a stray second number on a metric that takes only one", () => {
    const ldl = getMetric("ldl")!;
    expect(classifyReading(ldl, 90, 999, profile)?.label).toBe("Optimal");
  });
});

describe("the second number's reference ladder", () => {
  const ladders = METRICS.filter((m) => m.secondary?.bands?.length).map(
    (m) => [m.label, m.secondary!.bands!] as [string, Band[]],
  );

  it("exists for every metric that captures a second number", () => {
    // A secondary without bands is a number the app would never judge.
    for (const metric of METRICS) {
      if (metric.secondary) expect(metric.secondary.bands?.length).toBeTruthy();
    }
  });

  it.each(ladders)("%s has a well-formed ladder", (_label, bands) => {
    bands.forEach((band, i) => {
      if (i < bands.length - 1) expect(band.to).not.toBeNull();
    });
    expect(bands[bands.length - 1].to).toBeNull();

    const closed = bands.slice(0, -1).map((b) => b.to as number);
    for (let i = 1; i < closed.length; i++) {
      expect(closed[i]).toBeGreaterThan(closed[i - 1]);
    }

    const good = bands.map((b, i) => (b.level === "good" ? i : -1)).filter((i) => i >= 0);
    expect(good.length).toBeGreaterThan(0);
    expect(good[good.length - 1] - good[0] + 1).toBe(good.length);
  });

  it("pins the diastolic cutoffs", () => {
    const dia = secondaryBands(getMetric("bloodPressure")!);
    const at = (v: number) => classify(v, dia)?.label;
    expect(at(59)).toBe("Low");
    expect(at(60)).toBe("Normal");
    expect(at(79)).toBe("Normal");
    expect(at(80)).toBe("Stage 1");
    expect(at(89)).toBe("Stage 1");
    expect(at(90)).toBe("Stage 2");
  });

  it("is reachable through secondaryBands, and absent for everything else", () => {
    expect(secondaryBands(getMetric("bloodPressure")!)).toHaveLength(4);
    expect(secondaryBands(getMetric("weight")!)).toBeUndefined();
  });
});
