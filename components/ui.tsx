"use client";

import type { Level } from "@/lib/types";

const LEVEL_STYLES: Record<Level, string> = {
  good: "bg-good/12 text-good",
  warn: "bg-warn/15 text-warn",
  bad: "bg-bad/12 text-bad",
};

export function StatusPill({
  level,
  label,
  size = "sm",
}: {
  level: Level;
  label: string;
  size?: "sm" | "md";
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full font-medium ${
        LEVEL_STYLES[level]
      } ${size === "md" ? "px-3 py-1 text-sm" : "px-2 py-0.5 text-[11px]"}`}
    >
      {label}
    </span>
  );
}

export function levelColor(level: Level): string {
  return level === "good"
    ? "var(--good)"
    : level === "warn"
      ? "var(--warn)"
      : "var(--bad)";
}

export function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-border bg-surface p-4 ${className}`}
    >
      {children}
    </div>
  );
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-muted">
      {children}
    </h2>
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-border px-6 py-12 text-center">
      <p className="font-medium">{title}</p>
      <p className="mx-auto mt-1 max-w-sm text-sm text-muted">{body}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
