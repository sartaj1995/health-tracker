"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { TrashIcon } from "@/components/icons";
import { Card, EmptyState, StatusPill } from "@/components/ui";
import { formatFullDate, formatReading, relativeDate } from "@/lib/format";
import { METRICS, bandsFor, classify, getMetric } from "@/lib/metrics";
import { useStore } from "@/lib/store";
import type { Entry } from "@/lib/types";

export default function HistoryPage() {
  const { entries, profile, deleteEntry, ready } = useStore();
  const [filter, setFilter] = useState("all");

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
            className="rounded-xl border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
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
            <Link
              href="/add"
              className="inline-flex rounded-xl bg-accent px-4 py-2.5 font-medium text-white"
            >
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
                      <li key={entry.id} className="flex items-center gap-3 px-4 py-3">
                        <div className="min-w-0 flex-1">
                          <Link
                            href={`/m/${metric.id}`}
                            className="text-sm font-medium hover:text-accent"
                          >
                            {metric.label}
                          </Link>
                          {entry.note ? (
                            <p className="truncate text-xs text-muted">{entry.note}</p>
                          ) : null}
                        </div>
                        {status ? <StatusPill level={status.level} label={status.label} /> : null}
                        <span className="tnum shrink-0 text-sm font-semibold">
                          {formatReading(metric, entry.value, entry.value2)}
                          {metric.unit ? (
                            <span className="ml-1 font-normal text-muted">{metric.unit}</span>
                          ) : null}
                        </span>
                        <Link
                          href={`/add?edit=${entry.id}`}
                          className="shrink-0 text-sm font-medium text-accent"
                        >
                          Edit
                        </Link>
                        <button
                          onClick={() => deleteEntry(entry.id)}
                          aria-label={`Delete ${metric.label} reading from ${formatFullDate(entry.date)}`}
                          className="shrink-0 rounded-lg p-1.5 text-muted transition-colors hover:text-bad"
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
    </>
  );
}
