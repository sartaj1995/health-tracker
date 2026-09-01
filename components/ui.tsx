"use client";

import { useEffect, useId, useRef } from "react";
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

export const BTN_DANGER = `${BTN_BASE} bg-bad px-4 text-white hover:opacity-90 active:opacity-80`;

/** A small square control (icon-only) that still meets the 44px minimum. */
export const BTN_ICON =
  "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-muted transition-colors duration-200 hover:bg-surface-2";

/**
 * A yes/no gate in front of something irreversible.
 *
 * Built on the native <dialog> so `showModal()` supplies the focus trap, the
 * Escape key and top-layer stacking, rather than three home-made versions of
 * each. Focus lands on Cancel: the destructive button should never be the one
 * a stray Enter press hits.
 */
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = "Delete",
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  body?: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    else if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      /*
        Escape fires `cancel`. Preventing the default close and calling back up
        means the parent's state is always what shuts the dialog — otherwise the
        browser closes it while the parent still believes it is open, and the
        next open() would be a no-op.
      */
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
      onClick={(event) => {
        // The dialog box itself is a child; a click landing on the element is
        // therefore a click on the backdrop around it.
        if (event.target === ref.current) onCancel();
      }}
      className="m-auto w-[min(26rem,calc(100vw-2rem))] rounded-2xl border border-border bg-surface p-0 text-text shadow-xl"
    >
      <div className="p-5">
        <h2 id={titleId} className="font-semibold">
          {title}
        </h2>
        {body ? <p className="mt-1.5 text-sm text-muted">{body}</p> : null}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" autoFocus onClick={onCancel} className={`${BTN_SECONDARY} text-sm`}>
            Cancel
          </button>
          <button type="button" onClick={onConfirm} className={`${BTN_DANGER} text-sm`}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}

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
