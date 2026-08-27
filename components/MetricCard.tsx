"use client";

import Link from "next/link";
import { bandsFor, classify, getMetric } from "@/lib/metrics";
import { formatDelta, formatReading, relativeDate } from "@/lib/format";
import { deltaSentiment, summarize, type Point } from "@/lib/stats";
import type { Profile } from "@/lib/types";
import { Sparkline } from "./Sparkline";
import { TrendDownIcon, TrendUpIcon } from "./icons";
import { StatusPill, levelColor } from "./ui";

export function MetricCard({
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
  const sentiment = deltaSentiment(
    metric,
    summary.delta,
    profile.targets[metric.id],
    summary.latest.value,
  );
  const lineColor = status ? levelColor(status.level) : "var(--accent)";

  return (
    <Link
      href={`/m/${metric.id}`}
      className="block rounded-2xl border border-border bg-surface p-4 transition-colors hover:border-accent/40 active:bg-surface-2"
    >
      <div className="flex items-start justify-between gap-3">
        <span className="text-sm font-medium text-muted">{metric.label}</span>
        {status ? <StatusPill level={status.level} label={status.label} /> : null}
      </div>

      <div className="mt-2 flex items-end justify-between gap-3">
        <div>
          <div className="flex items-baseline gap-1">
            <span className="tnum text-3xl font-semibold tracking-tight">
              {formatReading(metric, summary.latest.value, summary.latest.value2)}
            </span>
            {metric.unit ? (
              <span className="text-sm text-muted">{metric.unit}</span>
            ) : null}
          </div>

          <div className="mt-1 flex items-center gap-2 text-xs text-muted">
            {summary.delta !== undefined && summary.delta !== 0 ? (
              <span
                className="tnum inline-flex items-center gap-1 font-medium"
                style={{
                  color:
                    sentiment === "good"
                      ? "var(--good)"
                      : sentiment === "bad"
                        ? "var(--bad)"
                        : "var(--muted)",
                }}
              >
                {summary.delta > 0 ? <TrendUpIcon /> : <TrendDownIcon />}
                {formatDelta(metric, summary.delta)}
              </span>
            ) : null}
            <span>{relativeDate(summary.latest.date)}</span>
          </div>
        </div>

        <Sparkline points={points} color={lineColor} />
      </div>
    </Link>
  );
}
