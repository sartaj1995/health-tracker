import { describe, expect, it } from "vitest";
import {
  daysAgo,
  formatDelta,
  formatFullDate,
  formatReading,
  formatValue,
  inSentence,
  relativeDate,
} from "./format";
import { METRICS, getMetric } from "./metrics";
import { todayISO } from "./stats";

function shift(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  const pad = (x: number) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

describe("inSentence", () => {
  // Plain .toLowerCase() mangled nine of the catalogue's labels: the VLDL page
  // announced "No vldl cholesterol readings yet".
  it("leaves acronyms alone", () => {
    expect(inSentence("VLDL cholesterol")).toBe("VLDL cholesterol");
    expect(inSentence("LDL cholesterol")).toBe("LDL cholesterol");
    expect(inSentence("TSH")).toBe("TSH");
    expect(inSentence("BMI")).toBe("BMI");
  });

  it("leaves mixed case and bracketed forms alone", () => {
    expect(inSentence("HbA1c")).toBe("HbA1c");
    expect(inSentence("ALT (SGPT)")).toBe("ALT (SGPT)");
  });

  it("keeps trailing single letters and codes that are part of a name", () => {
    expect(inSentence("Vitamin D")).toBe("vitamin D");
    expect(inSentence("Vitamin B12")).toBe("vitamin B12");
  });

  it("still folds ordinary words", () => {
    expect(inSentence("Weight")).toBe("weight");
    expect(inSentence("Total cholesterol")).toBe("total cholesterol");
    expect(inSentence("Resting heart rate")).toBe("resting heart rate");
  });

  it("never returns an empty or all-lowercased acronym for any real label", () => {
    for (const metric of METRICS) {
      const out = inSentence(metric.label);
      expect(out.length).toBe(metric.label.length);
      // Any run of two or more capitals in the label must survive intact.
      const acronyms = metric.label.match(/\b[A-Z]{2,}\b/g) ?? [];
      for (const acronym of acronyms) expect(out).toContain(acronym);
    }
  });
});

describe("formatValue", () => {
  it("respects each metric's decimal places", () => {
    expect(formatValue(getMetric("weight")!, 74.25)).toBe("74.3"); // 1 dp
    expect(formatValue(getMetric("ldl")!, 129.4)).toBe("129"); // 0 dp
    expect(formatValue(getMetric("tsh")!, 2.6)).toBe("2.60"); // 2 dp
  });

  it("groups step counts so they stay readable", () => {
    expect(formatValue(getMetric("steps")!, 8800)).toBe("8,800");
  });
});

describe("formatReading", () => {
  it("renders blood pressure as systolic over diastolic", () => {
    expect(formatReading(getMetric("bloodPressure")!, 118, 78)).toBe("118/78");
  });

  it("falls back to a single number when the second value is missing", () => {
    expect(formatReading(getMetric("bloodPressure")!, 118)).toBe("118");
  });

  it("ignores a stray second value on a single-value metric", () => {
    expect(formatReading(getMetric("weight")!, 74.2, 99)).toBe("74.2");
  });
});

describe("formatDelta", () => {
  it("signs the change and formats the magnitude", () => {
    expect(formatDelta(getMetric("ldl")!, -14)).toBe("-14");
    expect(formatDelta(getMetric("ldl")!, 14)).toBe("+14");
  });
});

describe("relativeDate", () => {
  it("names the days you would name", () => {
    expect(relativeDate(todayISO())).toBe("Today");
    expect(relativeDate(shift(1))).toBe("Yesterday");
    expect(relativeDate(shift(3))).toBe("3 days ago");
  });

  it("switches to weeks before it switches to a date", () => {
    expect(relativeDate(shift(7))).toBe("1 week ago");
    expect(relativeDate(shift(14))).toBe("2 weeks ago");
  });

  it("falls back to a written date once a month has passed", () => {
    expect(relativeDate(shift(200))).toMatch(/\d+ \w{3}/);
  });
});

describe("formatFullDate", () => {
  it("writes a date the way the app writes dates everywhere else", () => {
    expect(formatFullDate("2026-08-29")).toBe("29 Aug 2026");
  });

  it("passes through anything it cannot parse rather than showing NaN", () => {
    expect(formatFullDate("not-a-date")).toBe("not-a-date");
  });
});

describe("daysAgo", () => {
  it("counts whole days", () => {
    expect(daysAgo(todayISO())).toBe(0);
    expect(daysAgo(shift(10))).toBe(10);
  });
});
