import { describe, expect, it } from "vitest";
import {
  daysAgo,
  describeSeries,
  formatDelta,
  formatFullDate,
  formatReading,
  formatSpan,
  formatValue,
  inSentence,
  relativeDate,
  timeAgo,
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

describe("timeAgo", () => {
  // Local time on purpose: the fallback date is the day on this device's clock.
  const now = new Date(2026, 8, 24, 12, 0).getTime();
  const MIN = 60_000;

  it("says never when there is no time to describe", () => {
    expect(timeAgo(undefined, now)).toBe("never");
    expect(timeAgo(Number.NaN, now)).toBe("never");
  });

  it("counts minutes, then hours, rounding down", () => {
    expect(timeAgo(now - 30_000, now)).toBe("just now");
    expect(timeAgo(now - 5 * MIN, now)).toBe("5 min ago");
    expect(timeAgo(now - 179 * MIN, now)).toBe("2 h ago");
  });

  it("switches to a written date once a day has passed", () => {
    expect(timeAgo(now - 2 * 24 * 60 * MIN, now)).toBe("22 Sep 2026");
  });
});

describe("formatSpan", () => {
  it("says it in the unit a person would use", () => {
    expect(formatSpan(1)).toBe("1 day");
    expect(formatSpan(9)).toBe("9 days");
    expect(formatSpan(21)).toBe("3 weeks");
    expect(formatSpan(90)).toBe("3 months");
    expect(formatSpan(365)).toBe("12 months");
    expect(formatSpan(730)).toBe("2 years");
  });

  it("never leaves a span reading as a raw day count", () => {
    // The point of it: "over 847 days" is not a sentence anyone says.
    expect(formatSpan(847)).toBe("2 years");
  });

  it("keeps the unit singular when there is only one of it", () => {
    expect(formatSpan(7)).toBe("7 days");
    expect(formatSpan(31)).toBe("4 weeks");
  });
});

describe("describeSeries", () => {
  const vitaminD = getMetric("vitaminD")!;
  const series = [
    { date: "2026-01-10", value: 22 },
    { date: "2026-05-02", value: 34.5 },
    { date: "2026-09-03", value: 41.9 },
  ];

  it("summarises what the chart shows, with the status", () => {
    const text = describeSeries(vitaminD, series, "Sufficient");
    expect(text).toContain("Vitamin D over time: 3 readings");
    expect(text).toContain("10 Jan 2026 to 3 Sep 2026");
    expect(text).toContain("ranging 22.0 to 41.9 ng/mL");
    expect(text).toContain("Latest 41.9 ng/mL, Sufficient.");
  });

  it("reads naturally for a single reading", () => {
    const text = describeSeries(vitaminD, [series[0]], "Insufficient");
    expect(text).toBe(
      "Vitamin D over time: one reading, 22.0 ng/mL on 10 Jan 2026, Insufficient.",
    );
  });

  it("copes with an unbanded metric that has no status", () => {
    const weight = getMetric("weight")!;
    const text = describeSeries(weight, [{ date: "2026-01-10", value: 80 }]);
    expect(text).toBe("Weight over time: one reading, 80.0 kg on 10 Jan 2026.");
  });

  it("says so rather than describing nothing", () => {
    expect(describeSeries(vitaminD, [])).toBe("Vitamin D: no readings yet.");
  });
});

describe("describeSeries for a two-number reading", () => {
  const bp = getMetric("bloodPressure")!;
  const readings = [
    { date: "2026-08-01", value: 118, value2: 78 },
    { date: "2026-09-06", value: 110, value2: 100 },
  ];

  it("speaks both numbers rather than describing one with the other's range", () => {
    const text = describeSeries(bp, readings, "Stage 2");
    expect(text).toContain("systolic ranging 110 to 118");
    expect(text).toContain("diastolic 78 to 100 mmHg");
  });

  it("gives the latest reading as the pair, not half of it", () => {
    // "Latest 110 mmHg" would be the spoken version of the original bug.
    expect(describeSeries(bp, readings, "Stage 2")).toContain("Latest 110/100 mmHg, Stage 2.");
  });

  it("reads a single paired reading correctly", () => {
    expect(describeSeries(bp, [readings[1]], "Stage 2")).toBe(
      "Blood pressure over time: one reading, 110/100 mmHg on 6 Sep 2026, Stage 2.",
    );
  });
});
