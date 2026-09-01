"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { PencilIcon, TrashIcon } from "@/components/icons";
import {
  BTN_ICON,
  BTN_PRIMARY,
  Card,
  ConfirmDialog,
  EmptyState,
  StatusPill,
} from "@/components/ui";
import { formatFullDate, formatReading, relativeDate } from "@/lib/format";
import { METRICS, bandsFor, classify, getMetric } from "@/lib/metrics";
import { useStore } from "@/lib/store";
import type { Entry } from "@/lib/types";

export default function HistoryPage() {
  const { entries, profile, deleteEntry, ready } = useStore();
  const [filter, setFilter] = useState("all");
  // The reading the trash button is asking about. Deleting is one tap on a
  // phone, next to Edit, and there is no undo — so it gets a question first.
  const [pendingDelete, setPendingDelete] = useState<Entry | null>(null);

  const used = useMemo(() => {
    const ids = new Set(entries.map((e) => e.metricId));
    return METRICS.filter((m) => ids.has(m.id));
  }, [entries]);

  const grouped = useMemo(() => {
    const rows = entries
      .filter((e) => filter === "all" || e.metricId === filter)
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.createdAt.localeCompare(a.createdAt)));

    const byDate = new Map<string, Entry[]>();
    for (const row of rows) {
      const list = byDate.get(row.date) ?? [];
      list.push(row);
      byDate.set(row.date, list);
    }
    return [...byDate.entries()];
  }, [entries, filter]);

  if (!ready) {
    return <div className="h-64 animate-pulse rounded-2xl bg-surface-2" />;
  }

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">History</h1>
        {used.length > 0 ? (
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="min-h-11 rounded-xl border border-border bg-surface px-3 py-2 text-sm outline-none transition-colors duration-200 focus:border-accent"
          >
            <option value="all">All metrics</option>
            {used.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        ) : null}
      </div>

      {grouped.length === 0 ? (
        <EmptyState
          title="No readings here"
          body={
            entries.length === 0
              ? "Once you start logging, every reading shows up on this page."
              : "Nothing recorded for that metric yet."
          }
          action={
            <Link href="/add" className={BTN_PRIMARY}>
              Add a reading
            </Link>
          }
        />
      ) : (
        <div className="space-y-5">
          {grouped.map(([date, rows]) => (
            <section key={date}>
              <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-muted">
                {formatFullDate(date)}
                <span className="ml-2 font-normal normal-case tracking-normal">
                  {relativeDate(date)}
                </span>
              </h2>
              <Card className="!p-0">
                <ul className="divide-y divide-border">
                  {rows.map((entry) => {
                    const metric = getMetric(entry.metricId);
                    if (!metric) return null;
                    const status = classify(entry.value, bandsFor(metric, profile));
                    return (
                      <li key={entry.id} className="flex items-center gap-1 px-3 py-1.5">
                        {/*
                          Two lines rather than one: at 375px a single row
                          could not hold label, value, status, note and two
                          actions without either overflowing or squeezing the
                          tap targets below 44px.
                        */}
                        <Link
                          href={`/m/${metric.id}`}
                          className="flex min-h-11 min-w-0 flex-1 flex-col justify-center gap-0.5 rounded-lg px-1 py-1.5 transition-colors duration-200 hover:bg-surface-2"
                        >
                          <span className="flex items-baseline gap-2">
                            <span className="truncate text-sm font-medium">{metric.label}</span>
                            <span className="tnum ml-auto shrink-0 text-sm font-semibold">
                              {formatReading(metric, entry.value, entry.value2)}
                              {metric.unit ? (
                                <span className="ml-1 font-normal text-muted">{metric.unit}</span>
                              ) : null}
                            </span>
                          </span>
                          {status || entry.note ? (
                            <span className="flex min-w-0 items-center gap-2">
                              {status ? (
                                <StatusPill level={status.level} label={status.label} />
                              ) : null}
                              {entry.note ? (
                                <span className="truncate text-xs text-muted">{entry.note}</span>
                              ) : null}
                            </span>
                          ) : null}
                        </Link>
                        <Link
                          href={`/add?edit=${entry.id}`}
                          aria-label={`Edit ${metric.label} reading from ${formatFullDate(entry.date)}`}
                          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-medium text-accent transition-colors duration-200 hover:bg-surface-2"
                        >
                          <PencilIcon />
                        </Link>
                        <button
                          onClick={() => setPendingDelete(entry)}
                          aria-label={`Delete ${metric.label} reading from ${formatFullDate(entry.date)}`}
                          className={`${BTN_ICON} hover:text-bad`}
                        >
                          <TrashIcon />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </Card>
            </section>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete this reading?"
        body={pendingDelete ? describeEntry(pendingDelete) : undefined}
        onConfirm={() => {
          if (pendingDelete) deleteEntry(pendingDelete.id);
          setPendingDelete(null);
        }}
        onCancel={() => setPendingDelete(null)}
      />
    </>
  );
}

/** Names the exact reading being deleted, so the dialog is not a generic scare. */
function describeEntry(entry: Entry): string {
  const metric = getMetric(entry.metricId);
  const reading = metric
    ? `${metric.label} — ${formatReading(metric, entry.value, entry.value2)}${
        metric.unit ? ` ${metric.unit}` : ""
      }`
    : entry.metricId;
  return `${reading}, recorded on ${formatFullDate(entry.date)}. This cannot be undone.`;
}
