"use client";

import type { Level } from "@/lib/types";

const LEVEL_STYLES: Record<Level, string> = {
  good: "bg-good/12 text-good",
  warn: "bg-warn/15 text-warn",
  bad: "bg-bad/12 text-bad",
};

/**
 * Status carries meaning, so it never rides on colour alone: the band name is
 * always spelled out next to the dot.
 */
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
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full font-medium ${
        LEVEL_STYLES[level]
      } ${size === "md" ? "px-3 py-1 text-sm" : "px-2.5 py-1 text-xs"}`}
    >
      <span
        aria-hidden
        className="h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-80"
      />
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

/** Shared control sizing — every interactive element clears 44px. */
export const BTN_BASE =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl font-medium transition-colors duration-200";

export const BTN_PRIMARY = `${BTN_BASE} bg-accent px-4 text-white hover:opacity-90 active:opacity-80`;

export const BTN_SECONDARY = `${BTN_BASE} border border-border px-4 text-text hover:bg-surface-2`;

/** A small square control (icon-only) that still meets the 44px minimum. */
export const BTN_ICON =
  "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-muted transition-colors duration-200 hover:bg-surface-2";

/** Segmented pill used for ranges, themes and quick dates. */
export function Segment({
  active,
  children,
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { active: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      {...props}
      className={`inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border px-3 text-sm font-medium transition-colors duration-200 ${
        active
          ? "border-accent bg-accent-soft text-accent"
          : "border-border text-muted hover:bg-surface-2"
      } ${className}`}
    >
      {children}
    </button>
  );
}
