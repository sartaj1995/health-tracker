"use client";

import { useId, useState } from "react";
import { cmFromFeetInches, feetInchesFromCm } from "@/lib/firstRun";
import { Segment } from "./ui";

/** The range the height metric always accepted. */
const MIN_CM = 100;
const MAX_CM = 250;

type Unit = "cm" | "ft";
type Drafts = { cm: string; feet: string; inches: string };

function draftsFor(cm: number | undefined): Drafts {
  if (cm === undefined) return { cm: "", feet: "", inches: "" };
  const { feet, inches } = feetInchesFromCm(cm);
  return { cm: String(cm), feet: String(feet), inches: String(inches) };
}

const numberIn = (text: string) => Number(text.trim().replace(",", "."));

/**
 * What the boxes add up to, in centimetres: undefined when they are all empty,
 * NaN while they do not make a number. Inches may be left empty ("6 ft");
 * feet may not.
 */
function heightFrom(drafts: Drafts, unit: Unit): number | undefined {
  if (unit === "cm") return drafts.cm.trim() === "" ? undefined : numberIn(drafts.cm);
  if (drafts.feet.trim() === "" && drafts.inches.trim() === "") return undefined;
  const feet = drafts.feet.trim() === "" ? Number.NaN : numberIn(drafts.feet);
  const inches = drafts.inches.trim() === "" ? 0 : numberIn(drafts.inches);
  return cmFromFeetInches(feet, inches);
}

const INPUT =
  "tnum rounded-xl border border-border bg-surface-2 px-3 outline-none transition-colors duration-200 focus:border-accent";

/**
 * Height typed in centimetres or in feet and inches, always kept in
 * centimetres.
 *
 * A number reaches the profile only once it could be someone's height, so
 * typing 170 never works out a BMI from 1 cm and then 17 on the way there.
 */
export function HeightField({
  valueCm,
  unit,
  onChange,
  onUnitChange,
  large = false,
}: {
  valueCm: number | undefined;
  unit: Unit;
  onChange: (cm: number | undefined) => void;
  onUnitChange: (unit: Unit) => void;
  /** The first run's size: one question on the screen, so the box can be big. */
  large?: boolean;
}) {
  const [drafts, setDrafts] = useState(() => draftsFor(valueCm));
  const [checked, setChecked] = useState(false);
  const hintId = useId();

  const typed = heightFrom(drafts, unit);
  const unlikely = typed !== undefined && !(typed >= MIN_CM && typed <= MAX_CM);

  function edit(patch: Partial<Drafts>) {
    const next = { ...drafts, ...patch };
    setDrafts(next);
    const cm = heightFrom(next, unit);
    if (cm === undefined) onChange(undefined);
    else if (cm >= MIN_CM && cm <= MAX_CM) onChange(cm);
  }

  function switchTo(next: Unit) {
    if (next === unit) return;
    // The saved height, shown in the other unit, rather than a half-typed
    // number converted.
    setDrafts(draftsFor(valueCm));
    setChecked(false);
    onUnitChange(next);
  }

  const size = large ? "min-h-14 text-2xl font-semibold" : "min-h-11";
  const described = checked && unlikely ? hintId : undefined;

  return (
    <div>
      <div role="group" aria-label="Unit" className="mb-2 flex gap-2">
        <Segment active={unit === "cm"} onClick={() => switchTo("cm")}>
          cm
        </Segment>
        <Segment active={unit === "ft"} onClick={() => switchTo("ft")}>
          ft &amp; in
        </Segment>
      </div>

      {unit === "cm" ? (
        <div className="flex items-center gap-2">
          <input
            value={drafts.cm}
            onChange={(e) => edit({ cm: e.target.value })}
            onBlur={() => setChecked(true)}
            inputMode="decimal"
            type="text"
            autoComplete="off"
            placeholder="165"
            aria-label="Height in centimetres"
            aria-invalid={described ? true : undefined}
            aria-describedby={described}
            className={`${INPUT} ${size} ${large ? "w-36" : "w-32"}`}
          />
          <span className="text-sm text-muted">cm</span>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <input
            value={drafts.feet}
            onChange={(e) => edit({ feet: e.target.value })}
            onBlur={() => setChecked(true)}
            inputMode="numeric"
            type="text"
            autoComplete="off"
            placeholder="5"
            aria-label="Feet"
            aria-invalid={described ? true : undefined}
            aria-describedby={described}
            className={`${INPUT} ${size} w-20`}
          />
          <span className="text-sm text-muted">ft</span>
          <input
            value={drafts.inches}
            onChange={(e) => edit({ inches: e.target.value })}
            onBlur={() => setChecked(true)}
            inputMode="decimal"
            type="text"
            autoComplete="off"
            placeholder="5"
            aria-label="Inches"
            aria-invalid={described ? true : undefined}
            aria-describedby={described}
            className={`${INPUT} ${size} w-20`}
          />
          <span className="text-sm text-muted">in</span>
        </div>
      )}

      {described ? (
        <p id={hintId} className="mt-1.5 text-xs text-bad">
          {unit === "cm"
            ? "That does not look like a height. Enter it in centimetres, between 100 and 250."
            : "That does not look like a height. Enter feet and inches, between 3 ft 4 in and 8 ft 2 in."}
        </p>
      ) : null}
    </div>
  );
}
