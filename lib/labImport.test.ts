import { describe, expect, it } from "vitest";
import { findReportDate, parseLabReport } from "./labImport";

/** Convenience: the value the parser found for a metric, or undefined. */
function valueOf(text: string, metricId: string): number | undefined {
  return parseLabReport(text).rows.find((r) => r.metricId === metricId)?.value;
}

// A lipid panel as a real report lays one out: result first, reference range
// to the right of it.
const LIPID_PANEL = `
        LIPID PROFILE, SERUM
  Collected : 12/08/2026 09:14
  Reported  : 12/08/2026 18:02

  Test                        Result    Unit      Bio. Ref. Interval
  Total Cholesterol           171       mg/dL     < 200
  Triglycerides                50       mg/dL     < 150
  HDL Cholesterol              32       mg/dL     > 40
  LDL Cholesterol             129       mg/dL     < 100
  VLDL Cholesterol             10       mg/dL     < 30
`;

describe("a lipid panel", () => {
  const result = parseLabReport(LIPID_PANEL);

  it("finds every marker on the panel", () => {
    expect(result.rows.map((r) => r.metricId).sort()).toEqual(
      ["hdl", "ldl", "totalCholesterol", "triglycerides", "vldl"].sort(),
    );
  });

  it("takes the result column, not the reference range beside it", () => {
    // The obvious failure mode: reading "< 200" and saving 200.
    expect(valueOf(LIPID_PANEL, "totalCholesterol")).toBe(171);
    expect(valueOf(LIPID_PANEL, "ldl")).toBe(129);
    expect(valueOf(LIPID_PANEL, "hdl")).toBe(32);
    expect(valueOf(LIPID_PANEL, "triglycerides")).toBe(50);
    expect(valueOf(LIPID_PANEL, "vldl")).toBe(10);
  });

  it("picks up the collection date", () => {
    expect(result.date).toBe("2026-08-12");
  });

  it("keeps the source line so the parse can be checked", () => {
    const ldl = result.rows.find((r) => r.metricId === "ldl")!;
    expect(ldl.source).toContain("129");
  });
});

describe("distinguishing similar names", () => {
  it("does not read HDL, LDL or VLDL as plain cholesterol", () => {
    const rows = parseLabReport(LIPID_PANEL).rows;
    expect(rows.filter((r) => r.metricId === "totalCholesterol")).toHaveLength(1);
  });

  it("does not mistake HbA1c for haemoglobin", () => {
    const text = `
      Haemoglobin        14.8   g/dL
      HbA1c               5.7   %
    `;
    expect(valueOf(text, "hemoglobin")).toBe(14.8);
    expect(valueOf(text, "hba1c")).toBe(5.7);
  });

  it("reads SGPT as ALT", () => {
    expect(valueOf("SGPT (ALT)        28    U/L", "alt")).toBe(28);
  });

  it("does not match an alias buried inside another word", () => {
    // "alt" must not fire on "alternate", "bp" must not fire on "bpm".
    const result = parseLabReport("Alternate sample 42\nSomething 90 bpm");
    expect(result.rows.find((r) => r.metricId === "alt")).toBeUndefined();
    expect(result.rows.find((r) => r.metricId === "bloodPressure")).toBeUndefined();
  });
});

/**
 * Lp(a) shares most of its name with three metrics already in the catalogue,
 * and the word "lipoprotein" appears in all of them. Every case below is a way
 * one reading could quietly be filed as another.
 */
describe("telling Lp(a) apart from its neighbours", () => {
  it("reads the short and long spellings", () => {
    expect(valueOf("Lp(a)                45    mg/dL   < 30", "lpa")).toBe(45);
    expect(valueOf("Lipoprotein (a)      45    mg/dL", "lpa")).toBe(45);
    expect(valueOf("Lipoprotein(a)       45    mg/dL", "lpa")).toBe(45);
    expect(valueOf("LP (a)               45    mg/dL", "lpa")).toBe(45);
  });

  it("is not filed as total cholesterol when the line says cholesterol", () => {
    // "cholesterol" is an alias of its own, and a longer one than "lp(a)".
    const rows = parseLabReport("Lp(a) Cholesterol      45    mg/dL").rows;
    expect(rows.map((r) => r.metricId)).toEqual(["lpa"]);
  });

  it("does not swallow LDL, HDL or VLDL written out in full", () => {
    const text = `
      Low Density Lipoprotein (LDL)     129   mg/dL
      High Density Lipoprotein (HDL)     32   mg/dL
      Very Low Density Lipoprotein       10   mg/dL
    `;
    expect(valueOf(text, "ldl")).toBe(129);
    expect(valueOf(text, "hdl")).toBe(32);
    expect(valueOf(text, "vldl")).toBe(10);
    expect(parseLabReport(text).rows.find((r) => r.metricId === "lpa")).toBeUndefined();
  });

  it("is not confused with apolipoprotein A1", () => {
    // A different test, commonly on the same panel, whose name contains
    // "lipoprotein a" as a substring.
    const result = parseLabReport("Apolipoprotein A1     120   mg/dL");
    expect(result.rows.find((r) => r.metricId === "lpa")).toBeUndefined();
  });

  it("converts nmol/L to mg/dL and says that it did", () => {
    const row = parseLabReport("Lp(a)   85   nmol/L   < 75").rows[0];
    expect(row.metricId).toBe("lpa");
    // 85 / 2.15, the usual working factor.
    expect(row.value).toBeCloseTo(39.53, 1);
    expect(row.converted).toEqual({ value: 85, unit: "nmol/l" });
  });

  it("leaves a value already in mg/dL alone", () => {
    const row = parseLabReport("Lp(a)   85   mg/dL").rows[0];
    expect(row.value).toBe(85);
    expect(row.converted).toBeUndefined();
  });
});

describe("layout variations", () => {
  it("handles a colon-separated layout", () => {
    expect(valueOf("Vitamin D (25-OH) : 41.9 ng/mL", "vitaminD")).toBe(41.9);
  });

  it("handles the name and value on a crowded single line", () => {
    expect(valueOf("TSH 2.6 uIU/mL 0.4 - 4.0", "tsh")).toBe(2.6);
  });

  it("reads decimals and integers alike", () => {
    expect(valueOf("Serum Creatinine   0.9   mg/dL", "creatinine")).toBe(0.9);
    expect(valueOf("Ferritin           46    ng/mL", "ferritin")).toBe(46);
  });

  it("skips a heading that only announces the reference range", () => {
    const result = parseLabReport("Reference Range:\nLDL Cholesterol 129 mg/dL");
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].value).toBe(129);
  });

  it("keeps only the first reading when a metric appears twice", () => {
    const text = `
      Vitamin B12   295   pg/mL
      Vitamin B12   200   pg/mL   (previous)
    `;
    const rows = parseLabReport(text).rows.filter((r) => r.metricId === "vitaminB12");
    expect(rows).toHaveLength(1);
    expect(rows[0].value).toBe(295);
  });

  it("does not count a collection-date header as a missed reading", () => {
    const result = parseLabReport(
      "Sample Collected : 29-08-2026 09:14\nLDL Cholesterol 129 mg/dL",
    );
    expect(result.rows).toHaveLength(1);
    expect(result.unmatched).toBe(0);
  });

  it("ignores lines with no numbers at all", () => {
    expect(parseLabReport("PATIENT NAME\nDR. SOMEONE\n\n").rows).toEqual([]);
  });

  it("returns nothing rather than throwing on empty input", () => {
    expect(parseLabReport("")).toEqual({ rows: [], date: undefined, unmatched: 0 });
  });
});

describe("blood pressure", () => {
  it("reads both halves of a pair", () => {
    const row = parseLabReport("Blood Pressure: 118/78 mmHg").rows[0];
    expect(row.metricId).toBe("bloodPressure");
    expect(row.value).toBe(118);
    expect(row.value2).toBe(78);
  });

  it("skips it when only one number is given, rather than guessing", () => {
    expect(parseLabReport("Blood Pressure: 118 mmHg").rows).toEqual([]);
  });
});

describe("unit conversion", () => {
  it("converts vitamin D from nmol/L and records that it did", () => {
    const row = parseLabReport("Vitamin D  104.8 nmol/L").rows[0];
    expect(row.metricId).toBe("vitaminD");
    expect(row.value).toBeCloseTo(41.98, 1);
    expect(row.converted).toEqual({ value: 104.8, unit: "nmol/l" });
  });

  it("converts cholesterol from mmol/L", () => {
    const row = parseLabReport("Total Cholesterol  4.42 mmol/L").rows[0];
    expect(row.value).toBeCloseTo(170.9, 0);
  });

  it("converts glucose from mmol/L", () => {
    const row = parseLabReport("Fasting Glucose 5.1 mmol/L").rows[0];
    expect(row.value).toBeCloseTo(91.9, 0);
  });

  it("leaves the value alone when the unit is already ours", () => {
    const row = parseLabReport("Vitamin D  41.9 ng/mL").rows[0];
    expect(row.value).toBe(41.9);
    expect(row.converted).toBeUndefined();
  });
});

describe("implausible values", () => {
  it("flags a reading outside the metric's window rather than dropping it", () => {
    // Picking up a lab id or a phone number instead of a result.
    const row = parseLabReport("Ferritin  99999 ng/mL").rows[0];
    expect(row.metricId).toBe("ferritin");
    expect(row.suspect).toBe(true);
  });

  it("does not flag an ordinary reading", () => {
    expect(parseLabReport("Ferritin 46 ng/mL").rows[0].suspect).toBeUndefined();
  });
});

describe("findReportDate", () => {
  it("prefers a labelled date over any other number that looks like one", () => {
    const text = `
      Invoice 01/01/2020
      Sample Collected on 12/08/2026
    `;
    expect(findReportDate(text)).toBe("2026-08-12");
  });

  it("reads day-first, as Indian labs write it", () => {
    expect(findReportDate("Collected: 03/09/2026")).toBe("2026-09-03");
  });

  it("reads a written month", () => {
    expect(findReportDate("Reported on 12 Aug 2026")).toBe("2026-08-12");
  });

  it("reads an ISO date", () => {
    expect(findReportDate("Date 2026-08-12")).toBe("2026-08-12");
  });

  it("gives nothing when there is no date to find", () => {
    expect(findReportDate("Total Cholesterol 171 mg/dL")).toBeUndefined();
  });

  it("ignores an impossible date", () => {
    expect(findReportDate("Collected 45/45/2026")).toBeUndefined();
  });
});

describe("a full mixed report", () => {
  const REPORT = `
    HEALTH CHECK PANEL
    Patient: A N Other          Age/Sex: 31/M
    Sample Collected : 29-08-2026

    HAEMATOLOGY
      Haemoglobin              14.8    g/dL     13.0 - 17.0

    BIOCHEMISTRY
      Fasting Blood Sugar        92    mg/dL    70 - 100
      HbA1c                     5.7    %        < 5.7
      Serum Creatinine          0.9    mg/dL    0.7 - 1.3
      Uric Acid                 5.2    mg/dL    3.5 - 7.2
      SGPT (ALT)                 28    U/L      < 40

    LIPID PROFILE
      Total Cholesterol         171    mg/dL    < 200
      HDL Cholesterol            32    mg/dL    > 40
      LDL Cholesterol           129    mg/dL    < 100
      Triglycerides              50    mg/dL    < 150

    HORMONES
      TSH                       2.60   uIU/mL   0.4 - 4.0
      Vitamin D (25-OH)         41.9   ng/mL    30 - 100
      Vitamin B12                295   pg/mL    200 - 900
  `;

  const result = parseLabReport(REPORT);

  it("pulls out all thirteen markers in one pass", () => {
    expect(result.rows).toHaveLength(13);
  });

  it("gets every value right", () => {
    const byId = Object.fromEntries(result.rows.map((r) => [r.metricId, r.value]));
    expect(byId).toEqual({
      hemoglobin: 14.8,
      fastingGlucose: 92,
      hba1c: 5.7,
      creatinine: 0.9,
      uricAcid: 5.2,
      alt: 28,
      totalCholesterol: 171,
      hdl: 32,
      ldl: 129,
      triglycerides: 50,
      tsh: 2.6,
      vitaminD: 41.9,
      vitaminB12: 295,
    });
  });

  it("flags nothing as implausible", () => {
    expect(result.rows.filter((r) => r.suspect)).toEqual([]);
  });

  it("does not count date and header lines as missed readings", () => {
    // The count is a "did I miss something" hint, so it must not cry wolf.
    // Only the Age/Sex line here has a number and no metric.
    expect(result.unmatched).toBe(1);
  });

  it("finds the collection date", () => {
    expect(result.date).toBe("2026-08-29");
  });
});
