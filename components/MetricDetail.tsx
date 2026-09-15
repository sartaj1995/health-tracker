"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { MetricChart } from "@/components/MetricChart";
import { ArrowLeftIcon, PlusIcon, TrashIcon, TrendDownIcon, TrendUpIcon } from "@/components/icons";
import {
  BTN_ICON,
  BTN_PRIMARY,
  BTN_SECONDARY,
  Card,
  ConfirmDialog,
  EmptyState,
  SectionTitle,
  Segment,
  StatusPill,
  levelColor,
} from "@/components/ui";
import {
  formatDelta,
  formatFullDate,
  formatReading,
  formatSpan,
  formatValue,
  inSentence,
  relativeDate,
} from "@/lib/format";
import { bandsFor, classify, getMetric, isLoggable, secondaryBands } from "@/lib/metrics";
import {
  RANGES,
  SMOOTHING_DAYS,
  asSeries,
  clipToRange,
  deltaSentiment,
  isDenselyLogged,
  seriesFor,
  summarize,
  windowChange,
  type Point,
  type Range,
  type SeriesView,
} from "@/lib/stats";
import { useStore } from "@/lib/store";
import type { Band, Metric } from "@/lib/types";

export function MetricDetail({ metricId }: { metricId: string }) {
  const { entries, profile, updateProfile, deleteEntry, ready } = useStore();
  const [range, setRange] = useState<Range>("all");
  /** Which half of a two-number reading the page is reading. */
  const [view, setView] = useState<SeriesView>("combined");
  const [editingTarget, setEditingTarget] = useState(false);
  const [targetDraft, setTargetDraft] = useState("");
  /** The reading the trash button is asking about; deleting cannot be undone. */
  const [pendingDelete, setPendingDelete] = useState<Point | null>(null);

  const metric = getMetric(metricId);
  const allPoints = useMemo(
    () => (metric ? seriesFor(metric.id, entries, profile) : []),
    [metric, entries, profile],
  );
  const windowed = useMemo(() => clipToRange(allPoints, range), [allPoints, range]);

  /*
   * The whole page reads this rather than the raw metric: pick "Diastolic" and
   * every number below — the headline, the chart, the average, the trend, the
   * reference ladder — is recomputed for that line by the existing code.
   */
  const shown = useMemo(
    () => (metric ? asSeries(metric, windowed, view) : null),
    [metric, windowed, view],
  );
  const points = shown?.points ?? [];
  const summary = summarize(points);
  const bands = shown ? bandsFor(shown.metric, profile) : undefined;

  /*
   * In the combined view the second number has no statistics of its own — which
   * was the bug: "Average 117" was the average systolic, unlabelled, with the
   * diastolic nowhere.
   */
  const pair = useMemo(
    () =>
      metric && metric.secondary && view === "combined"
        ? summarize(asSeries(metric, windowed, "secondary").points)
        : null,
    [metric, windowed, view],
  );

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

  // Each half of the reading answers for itself. A single pill drawn from the
  // systolic called 110/100 "Normal", which is the whole reason this page
  // exists — it is the page you open to find out whether a number is a problem.
  const viewMetric = shown!.metric;
  const status = summary ? classify(summary.latest.value, bands) : null;
  const status2 =
    summary && viewMetric.secondary && summary.latest.value2 !== undefined
      ? classify(summary.latest.value2, secondaryBands(viewMetric))
      : null;

  /*
   * A target is stored per metric and there is only one of them, so it belongs
   * to the first number. Drawing it on the diastolic chart would put a systolic
   * goal line under a diastolic reading.
   */
  const target = view === "secondary" ? undefined : profile.targets[metric.id];
  const sentiment = summary
    ? deltaSentiment(viewMetric, summary.delta, target, summary.latest.value)
    : null;
  const pinned = profile.pinned.includes(metric.id);

  // How far it moved across the window on screen, as opposed to since the last
  // reading — the question a chart is usually being asked.
  const change = windowChange(points);
  const changeSentiment =
    change && summary
      ? deltaSentiment(viewMetric, change.delta, target, summary.latest.value)
      : null;
  // The second line's own movement, which the combined view would otherwise
  // report using the first line's numbers.
  const pairChange = pair ? windowChange(asSeries(metric, windowed, "secondary").points) : null;
  const pairChangeSentiment =
    pairChange && pair && metric.secondary
      ? deltaSentiment(
          { ...metric, bands: metric.secondary.bands },
          pairChange.delta,
          undefined,
          pair.latest.value,
        )
      : null;
  const smoothed = isDenselyLogged(points);
  // BMI can be missing a weight or missing a height, and only the second is
  // fixed from Settings rather than from the add form.
  const needsHeight = Boolean(metric.derived) && profile.heightCm === undefined;

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
          <Segment active={pinned} onClick={togglePin}>
            {pinned ? "Pinned" : "Pin to top"}
          </Segment>
          {isLoggable(metric) ? (
            <Link href={`/add?metric=${metric.id}`} className={`${BTN_PRIMARY} text-sm`}>
              <PlusIcon className="h-4 w-4" />
              Add
            </Link>
          ) : null}
        </div>
      </div>

      <h1 className="text-2xl font-semibold tracking-tight">{metric.label}</h1>
      {metric.help ? <p className="mt-1 max-w-prose text-sm text-muted">{metric.help}</p> : null}

      {/*
        Sits under the title rather than inside the chart card because it scopes
        the whole page: the headline, the stats, the trend and the reference
        ladder all follow it, not just the plot.
      */}
      {metric.secondary ? (
        <div
          role="group"
          aria-label={`Which number to show for ${inSentence(metric.label)}`}
          className="mt-4 flex flex-wrap gap-2"
        >
          {(
            [
              ["combined", "Combined"],
              ["primary", metric.secondary.primaryLabel],
              ["secondary", metric.secondary.label],
            ] as const
          ).map(([key, label]) => (
            <Segment key={key} active={view === key} onClick={() => setView(key)}>
              {label}
            </Segment>
          ))}
        </div>
      ) : null}

      {!summary ? (
        <div className="mt-6">
          <EmptyState
            title={`No ${inSentence(metric.label)} readings yet`}
            body={
              metric.retired
                ? "Your height is set in Settings now, so there is nothing to log here."
                : needsHeight
                  ? "BMI appears once your height is set in Settings and you have logged a weight."
                  : metric.derived
                    ? "BMI appears once you have logged a weight."
                    : "Add your first reading and the chart will build itself from there."
            }
            action={
              metric.retired || needsHeight ? (
                <Link href="/settings" className={BTN_PRIMARY}>
                  {needsHeight ? "Set your height" : "Open Settings"}
                </Link>
              ) : (
                <Link
                  href={`/add?metric=${metric.derived ? "weight" : metric.id}`}
                  className={BTN_PRIMARY}
                >
                  <PlusIcon className="h-4 w-4" />
                  {metric.derived ? "Add a weight" : "Add a reading"}
                </Link>
              )
            }
          />
        </div>
      ) : (
        <>
          <div className="mt-5 flex flex-wrap items-end gap-x-4 gap-y-2">
            <div className="flex items-baseline gap-1.5">
              <span className="tnum text-5xl font-semibold tracking-tight">
                {formatReading(viewMetric, summary.latest.value, summary.latest.value2)}
              </span>
              {metric.unit ? <span className="text-lg text-muted">{metric.unit}</span> : null}
            </div>
            {status ? (
              <StatusPill
                level={status.level}
                label={
                  viewMetric.secondary
                    ? `${viewMetric.secondary.primaryLabel} ${inSentence(status.label)}`
                    : status.label
                }
                size="md"
              />
            ) : null}
            {status2 && viewMetric.secondary ? (
              <StatusPill
                level={status2.level}
                label={`${viewMetric.secondary.label} ${inSentence(status2.label)}`}
                size="md"
              />
            ) : null}
          </div>

          <p className="mt-1.5 flex items-center gap-2 text-sm text-muted">
            {pair ? (
              /*
                Both numbers, and deliberately uncoloured: they come from the
                same two readings so pairing them is honest, but the two can
                move in opposite directions and a single sentiment colour would
                have to lie about one of them. The separate views give a verdict.
              */
              summary.delta !== undefined &&
              pair.delta !== undefined &&
              (summary.delta !== 0 || pair.delta !== 0) ? (
                <span className="tnum font-medium text-text">
                  {formatDelta(viewMetric, summary.delta)}/{formatDelta(viewMetric, pair.delta)}{" "}
                  since last
                </span>
              ) : null
            ) : summary.delta !== undefined && summary.delta !== 0 ? (
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
                {formatDelta(viewMetric, summary.delta)} since last
              </span>
            ) : null}
            <span>{relativeDate(summary.latest.date)}</span>
          </p>

          <div className="mt-5 rounded-2xl border border-border bg-surface p-4">
            <div className="mb-3 flex justify-end gap-1">
              {RANGES.map((r) => (
                <Segment
                  key={r.key}
                  active={range === r.key}
                  onClick={() => setRange(r.key)}
                  aria-label={`Show ${r.spoken}`}
                >
                  {r.label}
                </Segment>
              ))}
            </div>
            <MetricChart metric={viewMetric} points={points} profile={profile} />

            {change ? (
              <p className="mt-3 text-center text-sm">
                <Movement
                  metric={viewMetric}
                  delta={change.delta}
                  sentiment={changeSentiment}
                  name={pair ? viewMetric.secondary?.primaryLabel : undefined}
                />
                {pair && pairChange && viewMetric.secondary ? (
                  <>
                    <span className="text-muted"> &middot; </span>
                    <Movement
                      metric={viewMetric}
                      delta={pairChange.delta}
                      sentiment={pairChangeSentiment}
                      name={viewMetric.secondary.label}
                    />
                  </>
                ) : null}
                <span className="text-muted"> over {formatSpan(change.days)}</span>
              </p>
            ) : null}

            {smoothed ? (
              <p className="mt-2 text-center text-xs text-muted">
                Dots: each reading &middot; line: {SMOOTHING_DAYS}-day average
              </p>
            ) : null}
            {viewMetric.secondary ? (
              <p className="mt-2 text-center text-xs text-muted">
                Solid line: {inSentence(viewMetric.secondary.primaryLabel)} &middot; dashed line:{" "}
                {inSentence(viewMetric.secondary.label)}
              </p>
            ) : null}
            {points.length > 0 && points.length < 4 ? (
              <p className="mt-2 text-center text-xs text-muted">
                {points.length === 1 ? "One reading" : `${points.length} readings`} so far — too
                few to read a trend from. The line stays dashed until there are four.
              </p>
            ) : null}
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {pair && metric.secondary ? (
              /*
                Never merged into "110/78". The lowest systolic and the lowest
                diastolic can come from different days, so a slash between them
                would describe a reading that never happened.
              */
              (
                [
                  ["Average", summary.average, pair.average],
                  ["Lowest", summary.min, pair.min],
                  ["Highest", summary.max, pair.max],
                ] as const
              ).map(([label, first, second]) => (
                <PairStat
                  key={label}
                  label={label}
                  unit={metric.unit}
                  rows={[
                    [metric.secondary!.primaryLabel, formatValue(viewMetric, first)],
                    [metric.secondary!.label, formatValue(viewMetric, second)],
                  ]}
                />
              ))
            ) : (
              <>
                <Stat
                  label="Average"
                  value={formatValue(viewMetric, summary.average)}
                  unit={viewMetric.unit}
                />
                <Stat
                  label="Lowest"
                  value={formatValue(viewMetric, summary.min)}
                  unit={viewMetric.unit}
                />
                <Stat
                  label="Highest"
                  value={formatValue(viewMetric, summary.max)}
                  unit={viewMetric.unit}
                />
              </>
            )}
            <Stat label="Readings" value={String(summary.count)} unit="" />
          </div>
        </>
      )}

      {/*
        A target is stored once per metric, so it belongs to the first number.
        Offering it here while showing the second one would let you set a
        systolic goal from the diastolic view without ever being told.
      */}
      <section className="mt-6" hidden={view === "secondary"}>
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
                placeholder={`Target ${inSentence(metric.label)}`}
                className="tnum w-full rounded-xl border border-border bg-surface-2 px-3 py-2 outline-none focus:border-accent"
              />
              <button onClick={saveTarget} className={`${BTN_PRIMARY} text-sm`}>
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
                className={`${BTN_SECONDARY} shrink-0 text-sm`}
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
          {/* Two numbers, two ladders. Listing only the systolic one left the
              diastolic reading with no published range to check itself against. */}
          {viewMetric.secondary ? (
            <LadderTitle>{viewMetric.secondary.primaryLabel}</LadderTitle>
          ) : null}
          <Card className="!p-0">
            <BandLadder bands={bands} min={metric.min} activeLabel={status?.label} />
          </Card>
          {secondaryBands(viewMetric)?.length ? (
            <>
              <LadderTitle>{viewMetric.secondary!.label}</LadderTitle>
              <Card className="!p-0">
                <BandLadder
                  bands={secondaryBands(viewMetric)!}
                  min={metric.min}
                  activeLabel={status2?.label}
                />
              </Card>
            </>
          ) : null}
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
                      {/* A retired metric's readings can be deleted but not
                          edited: the add form no longer offers the metric, so
                          an edit would open on a picker that cannot show it. */}
                      {metric.retired ? null : (
                        <Link
                          href={`/add?edit=${point.entryId}`}
                          className="inline-flex min-h-11 shrink-0 items-center rounded-xl px-3 text-sm font-medium text-accent transition-colors duration-200 hover:bg-surface-2"
                        >
                          Edit
                        </Link>
                      )}
                      <button
                        onClick={() => setPendingDelete(point)}
                        aria-label={`Delete reading from ${formatFullDate(point.date)}`}
                        className={`${BTN_ICON} hover:text-bad`}
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

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete this reading?"
        body={
          pendingDelete
            ? `${metric.label} — ${formatReading(
                metric,
                pendingDelete.value,
                pendingDelete.value2,
              )}${metric.unit ? ` ${metric.unit}` : ""}, recorded on ${formatFullDate(
                pendingDelete.date,
              )}. This cannot be undone.`
            : undefined
        }
        onConfirm={() => {
          if (pendingDelete?.entryId) deleteEntry(pendingDelete.entryId);
          setPendingDelete(null);
        }}
        onCancel={() => setPendingDelete(null)}
      />
    </>
  );
}

/** A heading naming which half of a reading a ladder belongs to. */
function LadderTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-1.5 mt-3 px-1 text-xs font-medium text-muted first:mt-0">{children}</h3>
  );
}

/** One reference ladder, with the band the current reading falls in picked out. */
function BandLadder({
  bands,
  min,
  activeLabel,
}: {
  bands: Band[];
  min?: number;
  activeLabel?: string;
}) {
  return (
    <ul className="divide-y divide-border">
      {bands.map((band, i) => {
        const from = i === 0 ? min ?? 0 : bands[i - 1].to;
        return (
          <li
            key={band.label + i}
            className={`flex items-center justify-between gap-3 px-4 py-2.5 text-sm ${
              band.label === activeLabel ? "bg-surface-2" : ""
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
  );
}

/** One movement of one number: "Systolic down 8 mmHg", coloured by its own sentiment. */
function Movement({
  metric,
  delta,
  sentiment,
  name,
}: {
  metric: Metric;
  delta: number;
  sentiment: "good" | "bad" | null;
  name?: string;
}) {
  const direction =
    delta === 0
      ? "unchanged"
      : `${delta > 0 ? "up" : "down"} ${formatValue(metric, Math.abs(delta))}${
          metric.unit ? ` ${metric.unit}` : ""
        }`;
  return (
    <span
      className="tnum font-medium"
      style={{
        color:
          sentiment === "good" ? "var(--good)" : sentiment === "bad" ? "var(--bad)" : "var(--text)",
      }}
    >
      {name ? `${name} ${direction}` : direction.charAt(0).toUpperCase() + direction.slice(1)}
    </span>
  );
}

/** A statistic that belongs to two numbers at once, kept attributed rather than merged. */
function PairStat({
  label,
  unit,
  rows,
}: {
  label: string;
  unit: string;
  rows: [string, string][];
}) {
  return (
    <div className="rounded-xl border border-border bg-surface px-3 py-2.5">
      <p className="flex items-baseline justify-between gap-2 text-xs text-muted">
        <span>{label}</span>
        {unit ? <span>{unit}</span> : null}
      </p>
      {rows.map(([name, value]) => (
        <p key={name} className="mt-0.5 flex items-baseline justify-between gap-2">
          <span className="text-xs text-muted">{name}</span>
          <span className="tnum font-semibold">{value}</span>
        </p>
      ))}
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/"
      className="inline-flex min-h-11 items-center gap-1.5 rounded-xl pr-2 text-sm text-muted transition-colors duration-200 hover:text-text"
    >
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
