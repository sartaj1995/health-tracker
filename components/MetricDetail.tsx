"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { MetricChart } from "@/components/MetricChart";
import { ArrowLeftIcon, PlusIcon, TrashIcon, TrendDownIcon, TrendUpIcon } from "@/components/icons";
import { Card, EmptyState, SectionTitle, StatusPill, levelColor } from "@/components/ui";
import { formatDelta, formatFullDate, formatReading, formatValue, relativeDate } from "@/lib/format";
import { bandsFor, classify, getMetric } from "@/lib/metrics";
import {
  RANGES,
  clipToRange,
  deltaSentiment,
  seriesFor,
  summarize,
  type Range,
} from "@/lib/stats";
import { useStore } from "@/lib/store";

export function MetricDetail({ metricId }: { metricId: string }) {
  const { entries, profile, updateProfile, deleteEntry, ready } = useStore();
  const [range, setRange] = useState<Range>("all");
  const [editingTarget, setEditingTarget] = useState(false);
  const [targetDraft, setTargetDraft] = useState("");

  const metric = getMetric(metricId);
  const allPoints = useMemo(
    () => (metric ? seriesFor(metric.id, entries, profile) : []),
    [metric, entries, profile],
  );
  const points = useMemo(() => clipToRange(allPoints, range), [allPoints, range]);
  const summary = summarize(points);
  const bands = metric ? bandsFor(metric, profile) : undefined;

  if (!metric) {
    return (
      <EmptyState
        title="Unknown metric"
        body="That metric is not in the catalogue."
        action={<BackLink />}
      />
    );
  }

  if (!ready) {
    return <div className="h-96 animate-pulse rounded-2xl bg-surface-2" />;
  }

  const status = summary ? classify(summary.latest.value, bands) : null;
  const sentiment = summary
    ? deltaSentiment(metric, summary.delta, profile.targets[metric.id], summary.latest.value)
    : null;
  const target = profile.targets[metric.id];
  const pinned = profile.pinned.includes(metric.id);

  function saveTarget() {
    const num = Number(targetDraft.replace(",", "."));
    const next = { ...profile.targets };
    if (targetDraft.trim() === "" || !Number.isFinite(num)) {
      delete next[metricId];
    } else {
      next[metricId] = num;
    }
    updateProfile({ targets: next });
    setEditingTarget(false);
  }

  function togglePin() {
    updateProfile({
      pinned: pinned
        ? profile.pinned.filter((id) => id !== metricId)
        : [...profile.pinned, metricId],
    });
  }

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <BackLink />
        <div className="flex gap-2">
          <button
            onClick={togglePin}
            className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
              pinned ? "border-accent bg-accent-soft text-accent" : "border-border text-muted"
            }`}
          >
            {pinned ? "Pinned" : "Pin to top"}
          </button>
          {!metric.derived ? (
            <Link
              href={`/add?metric=${metric.id}`}
              className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white"
            >
              <PlusIcon className="h-4 w-4" />
              Add
            </Link>
          ) : null}
        </div>
      </div>

      <h1 className="text-2xl font-semibold tracking-tight">{metric.label}</h1>
      {metric.help ? <p className="mt-1 max-w-prose text-sm text-muted">{metric.help}</p> : null}

      {!summary ? (
        <div className="mt-6">
          <EmptyState
            title={`No ${metric.label.toLowerCase()} readings yet`}
            body={
              metric.derived
                ? "BMI appears once you have logged both a height and a weight."
                : "Add your first reading and the chart will build itself from there."
            }
            action={
              !metric.derived ? (
                <Link
                  href={`/add?metric=${metric.id}`}
                  className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 font-medium text-white"
                >
                  <PlusIcon className="h-4 w-4" />
                  Add a reading
                </Link>
              ) : null
            }
          />
        </div>
      ) : (
        <>
          <div className="mt-5 flex flex-wrap items-end gap-x-4 gap-y-2">
            <div className="flex items-baseline gap-1.5">
              <span className="tnum text-5xl font-semibold tracking-tight">
                {formatReading(metric, summary.latest.value, summary.latest.value2)}
              </span>
              {metric.unit ? <span className="text-lg text-muted">{metric.unit}</span> : null}
            </div>
            {status ? <StatusPill level={status.level} label={status.label} size="md" /> : null}
          </div>

          <p className="mt-1.5 flex items-center gap-2 text-sm text-muted">
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
                {formatDelta(metric, summary.delta)} since last
              </span>
            ) : null}
            <span>{relativeDate(summary.latest.date)}</span>
          </p>

          <div className="mt-5 rounded-2xl border border-border bg-surface p-4">
            <div className="mb-3 flex justify-end gap-1">
              {RANGES.map((r) => (
                <button
                  key={r.key}
                  onClick={() => setRange(r.key)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                    range === r.key ? "bg-accent-soft text-accent" : "text-muted"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
            <MetricChart metric={metric} points={points} profile={profile} />
            {metric.secondary ? (
              <p className="mt-2 text-center text-xs text-muted">
                Solid line: systolic &middot; dashed line: {metric.secondary.label.toLowerCase()}
              </p>
            ) : null}
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Average" value={formatValue(metric, summary.average)} unit={metric.unit} />
            <Stat label="Lowest" value={formatValue(metric, summary.min)} unit={metric.unit} />
            <Stat label="Highest" value={formatValue(metric, summary.max)} unit={metric.unit} />
            <Stat label="Readings" value={String(summary.count)} unit="" />
          </div>
        </>
      )}

      <section className="mt-6">
        <SectionTitle>Target</SectionTitle>
        <Card>
          {editingTarget ? (
            <div className="flex gap-2">
              <input
                autoFocus
                value={targetDraft}
                onChange={(e) => setTargetDraft(e.target.value)}
                inputMode="decimal"
                type="text"
                placeholder={`Target ${metric.label.toLowerCase()}`}
                className="tnum w-full rounded-xl border border-border bg-surface-2 px-3 py-2 outline-none focus:border-accent"
              />
              <button
                onClick={saveTarget}
                className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white"
              >
                Save
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm">
                {target !== undefined ? (
                  <>
                    Aiming for{" "}
                    <span className="tnum font-semibold">{formatValue(metric, target)}</span>{" "}
                    {metric.unit}
                  </>
                ) : (
                  <span className="text-muted">
                    No target set. A target draws a line on the chart and colours your progress.
                  </span>
                )}
              </p>
              <button
                onClick={() => {
                  setTargetDraft(target !== undefined ? String(target) : "");
                  setEditingTarget(true);
                }}
                className="shrink-0 text-sm font-medium text-accent"
              >
                {target !== undefined ? "Change" : "Set"}
              </button>
            </div>
          )}
        </Card>
      </section>

      {bands?.length ? (
        <section className="mt-6">
          <SectionTitle>Reference ranges</SectionTitle>
          <Card className="!p-0">
            <ul className="divide-y divide-border">
              {bands.map((band, i) => {
                const from = i === 0 ? metric.min ?? 0 : bands[i - 1].to;
                const active =
                  summary != null && classify(summary.latest.value, bands)?.label === band.label;
                return (
                  <li
                    key={band.label + i}
                    className={`flex items-center justify-between gap-3 px-4 py-2.5 text-sm ${
                      active ? "bg-surface-2" : ""
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ background: levelColor(band.level) }}
                      />
                      {band.label}
                    </span>
                    <span className="tnum text-muted">
                      {band.to === null
                        ? `${from} and above`
                        : i === 0
                          ? `under ${band.to}`
                          : `${from} – ${band.to}`}
                    </span>
                  </li>
                );
              })}
            </ul>
          </Card>
          <p className="mt-2 px-1 text-xs text-muted">
            General adult reference ranges, shown for context only. Your lab report and your doctor
            are the authority on what your numbers mean.
          </p>
        </section>
      ) : null}

      {allPoints.length > 0 ? (
        <section className="mt-6">
          <SectionTitle>All readings</SectionTitle>
          <Card className="!p-0">
            <ul className="divide-y divide-border">
              {[...allPoints].reverse().map((point) => (
                <li key={point.entryId ?? point.date} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="tnum text-sm font-medium">
                      {formatReading(metric, point.value, point.value2)}
                      {metric.unit ? (
                        <span className="ml-1 font-normal text-muted">{metric.unit}</span>
                      ) : null}
                    </p>
                    <p className="truncate text-xs text-muted">
                      {formatFullDate(point.date)}
                      {point.note ? ` · ${point.note}` : ""}
                    </p>
                  </div>
                  {!metric.derived && point.entryId ? (
                    <>
                      <Link
                        href={`/add?edit=${point.entryId}`}
                        className="text-sm font-medium text-accent"
                      >
                        Edit
                      </Link>
                      <button
                        onClick={() => deleteEntry(point.entryId!)}
                        aria-label={`Delete reading from ${formatFullDate(point.date)}`}
                        className="rounded-lg p-1.5 text-muted transition-colors hover:text-bad"
                      >
                        <TrashIcon />
                      </button>
                    </>
                  ) : (
                    <span className="text-xs text-muted">calculated</span>
                  )}
                </li>
              ))}
            </ul>
          </Card>
        </section>
      ) : null}
    </>
  );
}

function BackLink() {
  return (
    <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-text">
      <ArrowLeftIcon className="h-4 w-4" />
      Dashboard
    </Link>
  );
}

function Stat({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface px-3 py-2.5">
      <p className="text-xs text-muted">{label}</p>
      <p className="tnum mt-0.5 font-semibold">
        {value}
        {unit ? <span className="ml-1 text-xs font-normal text-muted">{unit}</span> : null}
      </p>
    </div>
  );
}
