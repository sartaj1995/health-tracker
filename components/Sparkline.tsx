"use client";

import { useId } from "react";

import type { Point } from "@/lib/stats";

const PAD = 3;

/** A tiny inline trend line for the dashboard cards - no chart library needed. */
export function Sparkline({
  points,
  color,
  width = 120,
  height = 36,
}: {
  points: Point[];
  color: string;
  width?: number;
  height?: number;
}) {
  const gradientId = useId();
  const W = width;
  const H = height;

  if (points.length < 2) {
    return <div style={{ width: W, height: H }} aria-hidden />;
  }

  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const tMin = points[0].t;
  const tSpan = points[points.length - 1].t - tMin || 1;

  const coords = points.map((p) => {
    const x = PAD + ((p.t - tMin) / tSpan) * (W - PAD * 2);
    const y = H - PAD - ((p.value - min) / span) * (H - PAD * 2);
    return [x, y] as const;
  });

  const line = coords.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const area = `${line} L${coords[coords.length - 1][0].toFixed(1)} ${H} L${coords[0][0].toFixed(1)} ${H} Z`;
  const [lastX, lastY] = coords[coords.length - 1];

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      style={{ width: W, height: H }}
      className="shrink-0 overflow-visible"
      preserveAspectRatio="none"
      aria-hidden
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.22" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradientId})`} />
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      <circle cx={lastX} cy={lastY} r="2.4" fill={color} />
    </svg>
  );
}
