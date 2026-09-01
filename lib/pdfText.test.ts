import { describe, expect, it } from "vitest";
import { parseLabReport } from "./labImport";
import { linesFromRuns, type TextRun } from "./pdfText";

/**
 * A PDF stores runs of glyphs at coordinates, never lines. Getting the
 * regrouping wrong is the whole risk here: merge two table rows and a metric
 * name pairs up with the wrong number, split a word and the alias matcher never
 * recognises it. Neither failure looks like an error — you just get a wrong
 * reading, or silently none at all.
 */

/** A run of text on the page. Width defaults to roughly 10pt characters. */
function run(str: string, x: number, y: number, width = str.length * 5): TextRun {
  return { str, x, y, width, height: 10 };
}

describe("grouping runs into lines", () => {
  it("puts runs sharing a baseline on one line", () => {
    expect(linesFromRuns([run("Vitamin D", 60, 500), run("41.9", 260, 500)])).toEqual([
      "Vitamin D 41.9",
    ]);
  });

  it("reads the page downwards, not in the order the runs arrive", () => {
    // y grows upward in PDF space, so the largest y is the top line.
    const runs = [run("second", 60, 480), run("first", 60, 500), run("third", 60, 460)];
    expect(linesFromRuns(runs)).toEqual(["first", "second", "third"]);
  });

  it("orders a line left to right", () => {
    const runs = [run("mg/dL", 300, 500), run("171", 200, 500), run("Cholesterol", 60, 500)];
    expect(linesFromRuns(runs)).toEqual(["Cholesterol 171 mg/dL"]);
  });

  it("keeps a word whole when it arrives in fragments", () => {
    // Producers routinely split a word across runs with no gap between them.
    // A space here would leave "Choles terol", which matches no alias.
    const runs = [run("Choles", 60, 500, 30), run("terol", 90, 500, 25)];
    expect(linesFromRuns(runs)).toEqual(["Cholesterol"]);
  });

  it("puts a space across the gap between two columns", () => {
    const runs = [run("TSH", 60, 500, 15), run("2.1", 200, 500)];
    expect(linesFromRuns(runs)).toEqual(["TSH 2.1"]);
  });

  it("absorbs the baseline wobble inside one table row", () => {
    // Cells drawn separately rarely sit on exactly the same baseline.
    const runs = [run("Ferritin", 60, 500), run("48", 200, 502), run("ng/mL", 260, 499)];
    expect(linesFromRuns(runs)).toEqual(["Ferritin 48 ng/mL"]);
  });

  it("keeps two table rows apart", () => {
    const runs = [run("HDL", 60, 512), run("32", 200, 512), run("LDL", 60, 500), run("129", 200, 500)];
    expect(linesFromRuns(runs)).toEqual(["HDL 32", "LDL 129"]);
  });

  it("drops empty runs and blank lines", () => {
    expect(linesFromRuns([run("", 60, 500), run("   ", 60, 480), run("TSH 2.1", 60, 460)])).toEqual(
      ["TSH 2.1"],
    );
  });

  it("returns nothing for a page with no text", () => {
    // A scanned report is an image; there are no runs to group at all.
    expect(linesFromRuns([])).toEqual([]);
  });
});

/**
 * The pairing that actually matters: text reconstructed from a PDF has to be
 * something the existing report parser can read. This lays a lipid panel out
 * the way a PDF does — one run per cell — and asserts the readings survive the
 * round trip.
 */
describe("a lipid panel laid out as PDF cells", () => {
  const rows: [string, string, string, string][] = [
    ["Total Cholesterol", "171", "mg/dL", "< 200"],
    ["Triglycerides", "50", "mg/dL", "< 150"],
    ["HDL Cholesterol", "32", "mg/dL", "> 40"],
    ["LDL Cholesterol", "129", "mg/dL", "< 100"],
    ["VLDL Cholesterol", "10", "mg/dL", "< 30"],
  ];

  const runs: TextRun[] = [
    run("LIPID PROFILE, SERUM", 60, 700),
    run("Collected : 12/08/2026 09:14", 60, 670),
    run("Test", 60, 640),
    run("Result", 240, 640),
    run("Unit", 320, 640),
    run("Bio. Ref. Interval", 400, 640),
    ...rows.flatMap(([name, value, unit, reference], i) => {
      const y = 610 - i * 20;
      return [
        run(name, 60, y),
        run(value, 240, y),
        run(unit, 320, y),
        run(reference, 400, y),
      ];
    }),
  ];

  const text = linesFromRuns(runs).join("\n");
  const result = parseLabReport(text);

  it("rebuilds one line per row of the table", () => {
    expect(linesFromRuns(runs)).toContain("Total Cholesterol 171 mg/dL < 200");
  });

  it("finds every marker on the panel", () => {
    expect(result.rows.map((r) => r.metricId).sort()).toEqual(
      ["hdl", "ldl", "totalCholesterol", "triglycerides", "vldl"].sort(),
    );
  });

  it("takes the result column rather than the reference beside it", () => {
    const valueOf = (id: string) => result.rows.find((r) => r.metricId === id)?.value;
    expect(valueOf("totalCholesterol")).toBe(171);
    expect(valueOf("triglycerides")).toBe(50);
    expect(valueOf("hdl")).toBe(32);
    expect(valueOf("ldl")).toBe(129);
    expect(valueOf("vldl")).toBe(10);
  });

  it("still finds the collection date", () => {
    expect(result.date).toBe("2026-08-12");
  });
});
