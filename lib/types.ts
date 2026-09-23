export type Level = "good" | "warn" | "bad";

/** A reference band. `to` is the exclusive upper bound; the final band uses `null`. */
export type Band = {
  to: number | null;
  level: Level;
  label: string;
};

export type Direction = "up" | "down" | "neutral";

/** The two the reference ranges in this app actually differ by. */
export type Sex = "male" | "female";

export type Category =
  | "Body"
  | "Vitals"
  | "Lipids"
  | "Blood sugar"
  | "Vitamins & minerals"
  | "Thyroid"
  | "Organ function"
  | "Lifestyle";

export type Metric = {
  id: string;
  label: string;
  unit: string;
  category: Category;
  /** Which way is an improvement — drives the colour of the change indicator. */
  direction: Direction;
  decimals: number;
  step: number;
  min?: number;
  max?: number;
  bands?: Band[];
  /**
   * Ranges that differ by sex, keyed by the sex they apply to. `bands` above
   * stays the fallback: used when no sex is set, and for any sex with no entry
   * here. Only the thresholds may differ — the rungs keep their names, so the
   * same reading never reads as a different kind of thing for different people.
   */
  bandsBySex?: Partial<Record<Sex, Band[]>>;
  /**
   * Second number captured in the same entry, e.g. diastolic pressure.
   *
   * `primaryLabel` names the *first* number, which only needs a name of its own
   * once there are two of them — "Blood pressure" is the pair, "Systolic" is the
   * number. It lives here so the form, the chart key and the spoken description
   * cannot drift apart.
   */
  secondary?: { label: string; primaryLabel: string; bands?: Band[] };
  /** Computed from other metrics; not entered by hand. */
  derived?: boolean;
  /**
   * No longer logged as a reading. The definition stays so that readings saved
   * before it was retired still show in History, where they can be deleted.
   */
  retired?: boolean;
  /**
   * How long a reading stays current, in days. Set on the lab panels worth
   * repeating; the dashboard nudges once the newest reading is older than this.
   * Absent means a metric you log as often as you like — weight, steps, sleep.
   */
  recheckDays?: number;
  help?: string;
};

export type Entry = {
  id: string;
  metricId: string;
  value: number;
  value2?: number;
  /** Local calendar date, YYYY-MM-DD. Never a timestamp — a reading belongs to a day. */
  date: string;
  note?: string;
  createdAt: string;
  updatedAt: string;
};

export type Profile = {
  heightCm?: number;
  /**
   * Drives the reference ranges that differ by sex. Deliberately unset until
   * someone chooses: no reading already saved should reclassify itself behind
   * their back on the strength of a guess.
   */
  sex?: Sex;
  /** WHO cutoffs vs. the lower South-Asian ones. */
  bmiStandard: "who" | "asian";
  theme: "system" | "light" | "dark";
  /** metricId -> target value */
  targets: Record<string, number>;
  /** metricId[] pinned to the top of the dashboard */
  pinned: string[];
};

export const DEFAULT_PROFILE: Profile = {
  bmiStandard: "asian",
  theme: "system",
  targets: {},
  pinned: [],
};
