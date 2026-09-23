import { describe, expect, it } from "vitest";
import { backupFacts, backupNudge, type BackupFacts, type Nudge } from "./backup";
import type { Entry } from "./types";

const HOUR = 3_600_000;
const NOW = Date.parse("2026-09-24T12:00:00.000Z");

function reading(id: string, hoursAgo: number): Entry {
  const at = new Date(NOW - hoursAgo * HOUR).toISOString();
  return { id, metricId: "weight", value: 70, date: "2026-09-24", createdAt: at, updatedAt: at };
}

/**
 * The facts decide whether the dashboard warns someone that their readings
 * could be lost. Counting a reading as backed up when it is not is the
 * dangerous direction: it is exactly the silence this exists to end.
 */
describe("what is not backed up yet", () => {
  it("counts every reading when there has never been a backup", () => {
    const facts = backupFacts([reading("a", 30), reading("b", 2)], undefined, false, NOW);
    expect(facts.unbacked).toBe(2);
    expect(facts.waitingHours).toBeCloseTo(30);
  });

  it("counts only readings touched after the last backup was taken", () => {
    const facts = backupFacts(
      [reading("old", 48), reading("new", 5), reading("newer", 1)],
      NOW - 24 * HOUR,
      false,
      NOW,
    );
    expect(facts.unbacked).toBe(2);
    // Measured from the oldest reading still waiting, not the newest.
    expect(facts.waitingHours).toBeCloseTo(5);
  });

  it("counts an edit to an old reading, since the backup holds the old value", () => {
    const edited = { ...reading("a", 48), updatedAt: new Date(NOW - HOUR).toISOString() };
    expect(backupFacts([edited], NOW - 24 * HOUR, false, NOW).unbacked).toBe(1);
  });

  it("reports nothing waiting once everything predates the backup", () => {
    const facts = backupFacts([reading("a", 48)], NOW - HOUR, true, NOW);
    expect(facts).toEqual({ unbacked: 0, waitingHours: 0, automatic: true });
  });

  it("treats a reading saved in the same millisecond as the backup as safe", () => {
    // The backup is stamped when its snapshot is taken, so equal means included.
    expect(backupFacts([reading("a", 1)], NOW - HOUR, false, NOW).unbacked).toBe(0);
  });

  it("never reports a negative wait when another device's clock runs ahead", () => {
    const facts = backupFacts([reading("future", -2)], NOW - HOUR, false, NOW);
    expect(facts.unbacked).toBe(1);
    expect(facts.waitingHours).toBe(0);
  });

  it("does not let a reading with no timestamp slip past a missing backup", () => {
    const bare = { ...reading("a", 1), updatedAt: undefined as unknown as string };
    expect(backupFacts([bare], undefined, false, NOW).unbacked).toBe(1);
    // With a backup on record it must have come from one, so it is safe.
    expect(backupFacts([bare], NOW - HOUR, false, NOW).unbacked).toBe(0);
  });

  it("has nothing to say about an empty device", () => {
    expect(backupFacts([], undefined, false, NOW)).toEqual({
      unbacked: 0,
      waitingHours: 0,
      automatic: false,
    });
  });
});

/**
 * The thresholds are a judgement call. What is pinned here is what any
 * sensible version of that judgement has to satisfy.
 */
describe("when the dashboard speaks up", () => {
  const rank: Record<Nudge, number> = { none: 0, gentle: 1, firm: 2 };
  const COUNTS = [0, 1, 2, 5, 10, 50];
  const HOURS = [0, 0.001, 0.5, 1, 6, 24, 72, 168, 720];

  const nudge = (unbacked: number, waitingHours: number, automatic: boolean) =>
    rank[backupNudge({ unbacked, waitingHours, automatic } satisfies BackupFacts)];

  it("stays silent when every reading is backed up", () => {
    for (const hours of HOURS) {
      expect(backupNudge({ unbacked: 0, waitingHours: hours, automatic: false })).toBe("none");
      expect(backupNudge({ unbacked: 0, waitingHours: hours, automatic: true })).toBe("none");
    }
  });

  it("does not flash up in the seconds before Drive's automatic backup runs", () => {
    // 0.001 h is 3.6 s: inside the pause before an upload goes out.
    expect(backupNudge({ unbacked: 1, waitingHours: 0.001, automatic: true })).toBe("none");
  });

  it("never gets quieter as more readings pile up", () => {
    for (const automatic of [false, true]) {
      for (const hours of HOURS) {
        for (let i = 1; i < COUNTS.length; i++) {
          expect(nudge(COUNTS[i], hours, automatic)).toBeGreaterThanOrEqual(
            nudge(COUNTS[i - 1], hours, automatic),
          );
        }
      }
    }
  });

  it("never gets quieter the longer readings wait", () => {
    for (const automatic of [false, true]) {
      for (const count of COUNTS) {
        for (let i = 1; i < HOURS.length; i++) {
          expect(nudge(count, HOURS[i], automatic)).toBeGreaterThanOrEqual(
            nudge(count, HOURS[i - 1], automatic),
          );
        }
      }
    }
  });

  it("warns firmly about a month of readings with no backup, Drive or not", () => {
    expect(backupNudge({ unbacked: 10, waitingHours: 720, automatic: false })).toBe("firm");
    expect(backupNudge({ unbacked: 10, waitingHours: 720, automatic: true })).toBe("firm");
  });
});

/** The judgement calls themselves, pinned so that moving one is a visible decision. */
describe("the thresholds chosen", () => {
  it("mentions a single unprotected reading at once, quietly", () => {
    expect(backupNudge({ unbacked: 1, waitingHours: 0, automatic: false })).toBe("gentle");
  });

  it("gives a working Drive a quarter of an hour before saying anything", () => {
    expect(backupNudge({ unbacked: 3, waitingHours: 0.24, automatic: true })).toBe("none");
    expect(backupNudge({ unbacked: 3, waitingHours: 0.25, automatic: true })).toBe("gentle");
  });

  it("lets a lab report's worth of readings through while Drive is catching up", () => {
    expect(backupNudge({ unbacked: 12, waitingHours: 0.001, automatic: true })).toBe("none");
  });

  it("turns firm after a week of waiting", () => {
    expect(backupNudge({ unbacked: 1, waitingHours: 24 * 7 - 1, automatic: false })).toBe("gentle");
    expect(backupNudge({ unbacked: 1, waitingHours: 24 * 7, automatic: false })).toBe("firm");
  });

  it("turns firm at ten readings, however recent", () => {
    expect(backupNudge({ unbacked: 9, waitingHours: 1, automatic: false })).toBe("gentle");
    expect(backupNudge({ unbacked: 10, waitingHours: 1, automatic: false })).toBe("firm");
  });
});
