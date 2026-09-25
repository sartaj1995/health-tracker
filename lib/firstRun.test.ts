import { describe, expect, it } from "vitest";
import { cmFromFeetInches, feetInchesFromCm, setupSteps, suggestedPins } from "./firstRun";
import { getMetric } from "./metrics";
import { DEFAULT_PROFILE, type Profile } from "./types";

describe("the first run's steps", () => {
  it("asks for the height first, since it is what makes BMI exist", () => {
    expect(setupSteps(true)[0]).toBe("height");
  });

  it("ends with a backup where this build can reach Google Drive", () => {
    expect(setupSteps(true)).toEqual(["height", "sex", "pins", "backup"]);
  });

  it("leaves the backup out where it cannot", () => {
    expect(setupSteps(false)).toEqual(["height", "sex", "pins"]);
  });
});

/** "5 ft 6" is how a lot of people know their height; BMI needs centimetres. */
describe("height in feet and inches", () => {
  it("converts to centimetres, to the tenth the app has always kept", () => {
    expect(cmFromFeetInches(5, 6)).toBe(167.6);
    expect(cmFromFeetInches(6, 0)).toBe(182.9);
    expect(cmFromFeetInches(5, 0)).toBe(152.4);
  });

  it("reads back to the nearest inch", () => {
    expect(feetInchesFromCm(167.6)).toEqual({ feet: 5, inches: 6 });
    expect(feetInchesFromCm(170)).toEqual({ feet: 5, inches: 7 });
  });

  it("carries a rounded-up twelfth inch into the next foot", () => {
    // 182.1 cm is 71.7 inches: "6 ft 0", never "5 ft 12".
    expect(feetInchesFromCm(182.1)).toEqual({ feet: 6, inches: 0 });
  });

  it("comes back to the same feet and inches it was given", () => {
    // Every whole inch the height field accepts, 3 ft 4 to 8 ft 2.
    for (let total = 40; total <= 98; total++) {
      const feet = Math.floor(total / 12);
      const inches = total % 12;
      expect(feetInchesFromCm(cmFromFeetInches(feet, inches))).toEqual({ feet, inches });
    }
  });

  it("gives no number when the feet are not a number", () => {
    expect(cmFromFeetInches(Number.NaN, 4)).toBeNaN();
  });
});

/**
 * Which metrics to offer is a judgement call. What is pinned here is what any
 * version of it has to get right for every kind of person setting up.
 */
describe("the metrics offered for pinning", () => {
  const people: [string, Profile][] = [
    ["nothing set yet", DEFAULT_PROFILE],
    ["a height set", { ...DEFAULT_PROFILE, heightCm: 165 }],
    ["a man", { ...DEFAULT_PROFILE, sex: "male" }],
    ["a woman with a height", { ...DEFAULT_PROFILE, sex: "female", heightCm: 158 }],
  ];

  for (const [who, profile] of people) {
    describe(`for ${who}`, () => {
      const offered = suggestedPins(profile);

      it("offers something to pick", () => {
        expect(offered.length).toBeGreaterThan(0);
      });

      it("offers few enough to take in at a glance on a phone", () => {
        expect(offered.length).toBeLessThanOrEqual(8);
      });

      it("offers only metrics the app has, and none it has retired", () => {
        for (const id of offered) {
          expect(getMetric(id), id).toBeDefined();
          expect(getMetric(id)?.retired, id).toBeFalsy();
        }
      });

      it("offers each one once", () => {
        expect(new Set(offered).size).toBe(offered.length);
      });

      it("never offers BMI without a height to work it out from", () => {
        // A BMI pin with no height would sit invisible on the dashboard.
        if (profile.heightCm === undefined) expect(offered).not.toContain("bmi");
      });
    });
  }
});

/** The judgement calls themselves, pinned so that changing one is a visible decision. */
describe("the list chosen", () => {
  it("leads with weight, the reading most people start with", () => {
    expect(suggestedPins(DEFAULT_PROFILE)[0]).toBe("weight");
  });

  it("puts BMI straight after weight once there is a height", () => {
    expect(suggestedPins({ ...DEFAULT_PROFILE, heightCm: 165 }).slice(0, 2)).toEqual([
      "weight",
      "bmi",
    ]);
  });

  it("covers blood pressure, blood sugar, cholesterol and vitamin D for everyone", () => {
    for (const sex of [undefined, "male", "female"] as const) {
      expect(suggestedPins({ ...DEFAULT_PROFILE, sex })).toEqual(
        expect.arrayContaining(["bloodPressure", "fastingGlucose", "hba1c", "ldl", "vitaminD"]),
      );
    }
  });

  it("gives the last place to what fits the person", () => {
    expect(suggestedPins({ ...DEFAULT_PROFILE, sex: "female" }).at(-1)).toBe("hemoglobin");
    expect(suggestedPins({ ...DEFAULT_PROFILE, sex: "male" }).at(-1)).toBe("psa");
    expect(suggestedPins(DEFAULT_PROFILE).at(-1)).toBe("tsh");
  });
});
