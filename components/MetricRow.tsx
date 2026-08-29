"use client";

import Link from "next/link";
import { formatReading } from "@/lib/format";
import { bandsFor, classify, getMetric } from "@/lib/metrics";
import { summarize, type Point } from "@/lib/stats";
import type { Profile } from "@/lib/types";
import { Sparkline } from "./Sparkline";
import { StatusPill } from "./ui";

/**
 * One metric as a single dense line, for the panel lists.
 *
 * A reading that is in range says so by staying quiet: only rows outside their
 * reference range carry a status pill. That keeps the panels scannable — your
 * eye lands on the exceptions — and means status is never signalled by colour
 * alone, since the pill spells the band out in words.
 */
export function MetricRow({
  metricId,
  points,
  profile,
}: {
  metricId: string;
  points: Point[];
  profile: Profile;
}) {
  const metric = getMetric(metricId);
  const summary = summarize(points);
  if (!metric || !summary) return null;

  const status = classify(summary.latest.value, bandsFor(metric, profile));
  const flagged = status !== null && status.level !== "good";

  return (
    <Link
      href={`/m/${metric.id}`}
      className="flex min-h-11 items-center gap-2 rounded-lg px-2 transition-colors duration-200 hover:bg-surface-2"
    >
      <span className="min-w-0 flex-1 truncate text-sm">{metric.label}</span>

      {/*
        A flagged row trades its sparkline for the pill. Both together left too
        little width for the name in a narrow panel column — "HbA1c" was
        rendering as "HbA...". Where something is wrong, the band name matters
        more than the trend line, and the trend is one tap away.
      */}
      {flagged ? (
        <StatusPill level={status.level} label={status.label} />
      ) : (
        <Sparkline points={points} color="var(--data)" width={52} height={18} />
      )}

      <span className="tnum shrink-0 text-sm font-semibold">
        {formatReading(metric, summary.latest.value, summary.latest.value2)}
        {metric.unit ? (
          <span className="ml-0.5 text-xs font-normal text-muted">{metric.unit}</span>
        ) : null}
      </span>
    </Link>
  );
}
