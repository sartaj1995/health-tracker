export type Level = "good" | "warn" | "bad";

/** A reference band. `to` is the exclusive upper bound; the final band uses `null`. */
export type Band = {
  to: number | null;
  level: Level;
  label: string;
};

export type Direction = "up" | "down" | "neutral";

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
  /** Second number captured in the same entry, e.g. diastolic pressure. */
  secondary?: { label: string; bands?: Band[] };
  /** Computed from other metrics; not entered by hand. */
  derived?: boolean;
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
