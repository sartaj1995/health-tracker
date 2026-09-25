import type { Profile } from "./types";

const DONE_KEY = "ht.firstRun.v1";

/** What the first run asks, one question to a screen. */
export type SetupStep = "height" | "sex" | "pins" | "backup";

/**
 * The first run's steps, in order.
 *
 * Backup is a step only where this build can reach Google Drive. Without it
 * the step would have nothing to offer a phone with no readings yet but a
 * file download, and the dashboard asks for that once there is something to
 * lose.
 */
export function setupSteps(driveAvailable: boolean): SetupStep[] {
  return driveAvailable ? ["height", "sex", "pins", "backup"] : ["height", "sex", "pins"];
}

/**
 * Whether this device has been through the first run, or chose to skip it.
 *
 * Kept per device and out of the snapshot, like the Drive sync record: a
 * backup restored onto a new phone brings the height and the pins with it,
 * but that phone still has its own backup to connect.
 */
export function firstRunDone(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(DONE_KEY) !== null;
  } catch {
    // Unreadable storage: offering the setup again beats never offering it.
    return false;
  }
}

export function markFirstRunDone(): void {
  try {
    window.localStorage.setItem(DONE_KEY, String(Date.now()));
  } catch {
    // Storage refusing writes is announced on every screen already.
  }
}

const CM_PER_INCH = 2.54;

/** Stored to a tenth of a centimetre, the precision height has always had here. */
export function cmFromFeetInches(feet: number, inches: number): number {
  return Math.round((feet * 12 + inches) * CM_PER_INCH * 10) / 10;
}

/** To the nearest inch, which is how anyone says it; 71.7 inches is "6 ft 0". */
export function feetInchesFromCm(cm: number): { feet: number; inches: number } {
  const total = Math.round(cm / CM_PER_INCH);
  return { feet: Math.floor(total / 12), inches: total % 12 };
}

/**
 * The metrics the first run offers to pin, in the order they are shown.
 *
 * These become the cards at the top of the dashboard and, until the first
 * reading, the buttons for adding one — so this list is the whole first
 * impression of what the app is for.
 */
export function suggestedPins(profile: Profile): string[] {
  return [
    "weight",
    // Only once there is a height to work it out from; before that a BMI pin
    // would sit on the dashboard showing nothing.
    ...(profile.heightCm !== undefined ? ["bmi"] : []),
    "bloodPressure",
    "fastingGlucose",
    "hba1c",
    "ldl",
    "vitaminD",
    // One that depends on who is setting up: anaemia is common in women and
    // its range is theirs; PSA is a man's test; the thyroid for anyone else.
    profile.sex === "female" ? "hemoglobin" : profile.sex === "male" ? "psa" : "tsh",
  ];
}
