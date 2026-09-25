"use client";

import Link from "next/link";
import { useState } from "react";
import { driveConfigured } from "@/lib/drive";
import { firstRunDone, markFirstRunDone, setupSteps, type SetupStep } from "@/lib/firstRun";
import { getMetric, isLoggable } from "@/lib/metrics";
import { useStore } from "@/lib/store";
import type { Metric } from "@/lib/types";
import { PlusIcon } from "./icons";
import { BTN_PRIMARY, BTN_SECONDARY, Card, EmptyState } from "./ui";

const STEPS = setupSteps(driveConfigured);

const WHAT: Record<SetupStep, string> = {
  height: "your height",
  sex: "your sex",
  pins: "what you want to keep an eye on",
  backup: "a backup",
};

const COUNT = ["No", "One", "Two", "Three", "Four", "Five"];

/**
 * With the comma before "and": "…what you want to keep an eye on and a
 * backup" reads as keeping an eye on the backup.
 */
function inAList(items: string[]): string {
  if (items.length < 3) return items.join(" and ");
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

/**
 * The dashboard before there is a single reading.
 *
 * Until the first run has been done or skipped on this device, it offers it —
 * never forces it: someone who only wants to log a weight can. After that, the
 * metrics pinned during setup become the way in, each one a button for its
 * first reading, since a pin shows nothing on the dashboard until then.
 */
export function StartHere() {
  const { profile } = useStore();
  // Only ever rendered in the browser, after the store has loaded, so the
  // flag can be read straight away without a flash of the wrong card.
  const [setUp, setSetUp] = useState(firstRunDone);

  if (!setUp) {
    return (
      <Card className="p-5 sm:p-6">
        <h2 className="text-lg font-semibold">Welcome</h2>
        <p className="mt-1 max-w-prose text-sm text-muted">
          {COUNT[STEPS.length]} quick things and it is ready for you:{" "}
          {inAList(STEPS.map((s) => WHAT[s]))}. Any of them can be skipped, and all of them
          changed later in Settings.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link href="/welcome" className={BTN_PRIMARY}>
            Set it up
          </Link>
          <button
            type="button"
            onClick={() => {
              markFirstRunDone();
              setSetUp(true);
            }}
            className={BTN_SECONDARY}
          >
            Skip for now
          </button>
        </div>
      </Card>
    );
  }

  const pins = profile.pinned
    .map((id) => getMetric(id))
    .filter((m): m is Metric => Boolean(m) && isLoggable(m as Metric));

  if (pins.length === 0) {
    return (
      <EmptyState
        title="Nothing logged yet"
        body="Add your first reading — weight, a blood test result, blood pressure, anything. Charts and reference ranges appear as soon as there is something to plot."
        action={
          <Link href="/add" className={BTN_PRIMARY}>
            <PlusIcon className="h-4 w-4" />
            Add a reading
          </Link>
        }
      />
    );
  }

  return (
    <EmptyState
      title="Nothing logged yet"
      body="Start with one of the things you chose to keep an eye on. Charts and reference ranges appear as soon as there is something to plot."
      action={
        <div className="flex flex-col items-center gap-3">
          <div className="flex flex-wrap justify-center gap-2">
            {pins.map((metric) => (
              <Link key={metric.id} href={`/add?metric=${metric.id}`} className={BTN_SECONDARY}>
                <PlusIcon className="h-4 w-4" />
                {metric.label}
              </Link>
            ))}
          </div>
          <Link
            href="/add"
            className="inline-flex min-h-11 items-center px-2 text-sm font-medium text-accent hover:underline"
          >
            Or add something else
          </Link>
        </div>
      }
    />
  );
}
