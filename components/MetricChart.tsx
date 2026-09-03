"use client";

import { useId } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { bandsFor, classify, goodRange } from "@/lib/metrics";
import { describeSeries, formatDate, formatFullDate, formatValue } from "@/lib/format";
import { SMOOTHING_DAYS, isDenselyLogged, smooth, type Point } from "@/lib/stats";
import type { Metric, Profile } from "@/lib/types";
import { levelColor } from "./ui";

/**
 * Rounds the value axis out to human numbers (0.5, 10, 250...) so the ticks
 * read cleanly instead of landing on whatever the data happened to hit.
 */
function niceScale(lo: number, hi: number, targetTicks = 5) {
  if (hi === lo) {
    const pad = Math.abs(hi) * 0.1 || 1;
    lo -= pad;
    hi += pad;
  }
  const rough = (hi - lo) / (targetTicks - 1);
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const normalised = rough / magnitude;
  const step =
    magnitude * (normalised <= 1 ? 1 : normalised <= 2 ? 2 : normalised <= 5 ? 5 : 10);

  const min = Math.floor(lo / step) * step;
  const max = Math.ceil(hi / step) * step;
  const ticks: number[] = [];
  // Rounded each step to shake off floating-point dust like 5.699999999.
  for (let v = min; v <= max + step / 2; v += step) {
    ticks.push(Number(v.toFixed(6)));
  }
  return { domain: [min, max] as [number, number], ticks };
}

/** Up to five ticks, always sitting on days that actually have a reading. */
function pickTicks(points: Point[], count = 5): number[] {
  if (points.length <= count) return points.map((p) => p.t);
  const step = (points.length - 1) / (count - 1);
  const ticks = new Set<number>();
  for (let i = 0; i < count; i++) {
    ticks.add(points[Math.round(i * step)].t);
  }
  return [...ticks];
}

function TooltipCard({
  active,
  payload,
  metric,
}: {
  active?: boolean;
  payload?: { payload: Point & { avg?: number } }[];
  metric: Metric;
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <div className="rounded-xl border border-border bg-surface px-3 py-2 shadow-lg">
      <p className="text-xs text-muted">{formatFullDate(point.date)}</p>
      <p className="tnum text-sm font-semibold">
        {formatValue(metric, point.value)}
        {point.value2 !== undefined ? `/${point.value2}` : ""}
        {metric.unit ? <span className="ml-1 font-normal text-muted">{metric.unit}</span> : null}
      </p>
      {/* The reading is what you logged; the average is what the line is
          drawing. Showing both stops the two disagreeing without explanation. */}
      {point.avg !== undefined ? (
        <p className="tnum mt-0.5 text-xs text-muted">
          {SMOOTHING_DAYS}-day average {formatValue(metric, point.avg)}
        </p>
      ) : null}
      {point.note ? <p className="mt-1 max-w-[200px] text-xs text-muted">{point.note}</p> : null}
    </div>
  );
}

export function MetricChart({
  metric,
  points,
  profile,
}: {
  metric: Metric;
  points: Point[];
  profile: Profile;
}) {
  const fillId = useId();

  if (points.length === 0) return null;

  const bands = bandsFor(metric, profile);
  const good = goodRange(bands);
  const target = profile.targets[metric.id];

  const allValues = points.flatMap((p) =>
    p.value2 !== undefined ? [p.value, p.value2] : [p.value],
  );
  if (target !== undefined) allValues.push(target);

  let lo = Math.min(...allValues);
  let hi = Math.max(...allValues);
  // Keep the healthy band visible even when every reading sits outside it,
  // otherwise the shading falls off the chart and the context is lost.
  if (good) {
    lo = Math.min(lo, good.from);
    if (good.to !== null) hi = Math.max(hi, Math.min(good.to, hi * 1.35 + 1));
  }
  const pad = (hi - lo || Math.max(hi * 0.1, 1)) * 0.15;
  const scale = niceScale(Math.max(metric.min ?? -Infinity, lo - pad), hi + pad);
  const domain = scale.domain;

  const status = classify(points[points.length - 1].value, bands);
  const stroke = status ? levelColor(status.level) : "var(--data)";
  // Below four readings there is no trend to read, so the points are shown as
  // markers rather than implying a line through them.
  const sparse = points.length < 4;

  /*
   * When a metric is logged often enough to be noisy, the rolling mean becomes
   * the line you read and the raw readings drop back to a faint scatter behind
   * it. Weighing yourself daily swings a kilo or two on water alone, and the
   * raw line spends most of its length hiding the trend it exists to show.
   *
   * The status colour follows the mean rather than the readings, because the
   * mean is now the claim the chart is making.
   */
  const smoothed = isDenselyLogged(points);
  const data = smoothed ? smooth(points) : points;
  // What the gradient sits under, and what the axis padding must contain.
  const trendKey = smoothed ? "avg" : "value";

  return (
    <div
      className="h-64 w-full"
      role="img"
      aria-label={describeSeries(metric, points, status?.label)}
    >
      {/* The SVG below is decorative once the label above says what it shows;
          leaving it exposed only offers a screen reader a heap of unlabelled
          shapes to walk through. */}
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={data}
          margin={{ top: 8, right: 8, bottom: 0, left: -12 }}
          aria-hidden
        >
          <defs>
            <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={stroke} stopOpacity={0.2} />
              <stop offset="100%" stopColor={stroke} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />

          {good ? (
            <ReferenceArea
              y1={good.from}
              y2={good.to ?? domain[1]}
              fill="var(--good)"
              fillOpacity={0.08}
              stroke="none"
              ifOverflow="hidden"
            />
          ) : null}

          {target !== undefined ? (
            <ReferenceLine
              y={target}
              stroke="var(--accent)"
              strokeDasharray="5 4"
              label={{
                value: "Target",
                position: "insideTopRight",
                fill: "var(--muted)",
                fontSize: 11,
              }}
            />
          ) : null}

          <XAxis
            dataKey="t"
            type="number"
            scale="time"
            domain={["dataMin", "dataMax"]}
            ticks={pickTicks(points)}
            tickFormatter={(t: number) => {
              const d = new Date(t);
              return formatDate(
                `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
              );
            }}
            tick={{ fontSize: 11, fill: "var(--muted)" }}
            axisLine={false}
            tickLine={false}
            minTickGap={8}
          />
          <YAxis
            domain={domain}
            ticks={scale.ticks}
            tick={{ fontSize: 11, fill: "var(--muted)" }}
            axisLine={false}
            tickLine={false}
            width={44}
            tickFormatter={(v: number) => formatValue(metric, v)}
          />

          <Tooltip
            content={<TooltipCard metric={metric} />}
            cursor={{ stroke: "var(--border)", strokeWidth: 1 }}
          />

          <Area
            type="monotone"
            dataKey={trendKey}
            stroke="none"
            fill={`url(#${fillId})`}
            isAnimationActive={false}
            activeDot={false}
          />

          {smoothed ? (
            /* The readings themselves, demoted to the scatter they are. Dots
               rather than a line: joining noise up implies the wobble means
               something. */
            <Line
              type="monotone"
              dataKey="value"
              stroke="none"
              dot={{ r: 1.8, fill: stroke, fillOpacity: 0.45, strokeWidth: 0 }}
              activeDot={{ r: 5, strokeWidth: 2, stroke: "var(--surface)" }}
              isAnimationActive={false}
            />
          ) : null}

          <Line
            type="monotone"
            dataKey={trendKey}
            stroke={stroke}
            strokeWidth={sparse ? 1.5 : 2.2}
            strokeDasharray={sparse ? "5 4" : undefined}
            dot={
              smoothed
                ? false
                : sparse
                  ? { r: 4, fill: stroke, strokeWidth: 0 }
                  : { r: 2.5, fill: stroke, strokeWidth: 0 }
            }
            /* 44px-equivalent grab area for touch, per the chart guidance. */
            activeDot={smoothed ? false : { r: 6, strokeWidth: 2, stroke: "var(--surface)" }}
            isAnimationActive={false}
          />
          {metric.secondary ? (
            <Line
              type="monotone"
              dataKey="value2"
              stroke="var(--data-2)"
              strokeWidth={2}
              /* Dashed, not merely a different colour - readable without
                 relying on hue (WCAG 1.4.1). */
              strokeDasharray="4 3"
              dot={{ r: 2.5, fill: "var(--data-2)", strokeWidth: 0 }}
              activeDot={{ r: 5, strokeWidth: 2, stroke: "var(--surface)" }}
              isAnimationActive={false}
            />
          ) : null}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
