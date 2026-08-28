"use client";

import Link from "next/link";
import { useMemo } from "react";
import { MetricCard } from "@/components/MetricCard";
import { PlusIcon } from "@/components/icons";
import { BTN_PRIMARY, Card, EmptyState, SectionTitle, StatusPill } from "@/components/ui";
import { daysAgo, formatReading, relativeDate } from "@/lib/format";
import { METRICS, bandsFor, classify, getMetric } from "@/lib/metrics";
import { seriesFor, summarize, trackedMetricIds } from "@/lib/stats";
import { useStore } from "@/lib/store";

const ORDER = new Map(METRICS.map((m, i) => [m.id, i]));

/** Lab panels are worth repeating a couple of times a year. */
const RECHECK_DAYS: Record<string, number> = {
  vitaminD: 180,
  vitaminB12: 365,
  ferritin: 365,
  hemoglobin: 365,
  totalCholesterol: 365,
  ldl: 365,
  hdl: 365,
  triglycerides: 365,
  hba1c: 180,
  fastingGlucose: 180,
  tsh: 365,
  creatinine: 365,
  uricAcid: 365,
  alt: 365,
};

export default function DashboardPage() {
  const { entries, profile, ready } = useStore();

  const cards = useMemo(() => {
    const ids = trackedMetricIds(entries, profile);
    const pinnedRank = (id: string) => {
      const i = profile.pinned.indexOf(id);
      return i === -1 ? Number.MAX_SAFE_INTEGER : i;
    };
    return ids
      .map((id) => ({ id, points: seriesFor(id, entries, profile) }))
      .filter((c) => c.points.length > 0)
      .sort((a, b) => {
        const pin = pinnedRank(a.id) - pinnedRank(b.id);
        if (pin !== 0) return pin;
        return (ORDER.get(a.id) ?? 999) - (ORDER.get(b.id) ?? 999);
      });
  }, [entries, profile]);

  const attention = useMemo(
    () =>
      cards.flatMap(({ id, points }) => {
        const metric = getMetric(id);
        const summary = summarize(points);
        if (!metric || !summary) return [];
        const status = classify(summary.latest.value, bandsFor(metric, profile));
        if (!status || status.level === "good") return [];
        return [{ metric, status, summary }];
      }),
    [cards, profile],
  );

  const due = useMemo(
    () =>
      cards.flatMap(({ id, points }) => {
        const window = RECHECK_DAYS[id];
        const metric = getMetric(id);
        if (!window || !metric) return [];
        const last = points[points.length - 1];
        const age = daysAgo(last.date);
        return age >= window ? [{ metric, age, date: last.date }] : [];
      }),
    [cards],
  );

  if (!ready) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-32 animate-pulse rounded-2xl bg-surface-2" />
        ))}
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <>
        <PageHeading total={0} />
        <EmptyState
          title="Nothing logged yet"
          body="Add your first reading — weight, a blood test result, blood pressure, anything. Charts and reference ranges appear as soon as there is something to plot."
          action={
            <Link href="/add" className={BTN_PRIMARY}>
              <PlusIcon className="h-4 w-4" />
              Add a reading
            </Link>
          }
        />
      </>
    );
  }

  return (
    <>
      <PageHeading total={entries.length} />

      {attention.length > 0 ? (
        <section className="mb-6">
          <SectionTitle>Worth a closer look</SectionTitle>
          <Card className="divide-y divide-border !p-0">
            {attention.map(({ metric, status, summary }) => (
              <Link
                key={metric.id}
                href={`/m/${metric.id}`}
                className="flex min-h-11 items-center justify-between gap-3 px-4 py-3 transition-colors duration-200 first:rounded-t-2xl last:rounded-b-2xl hover:bg-surface-2/60 active:bg-surface-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{metric.label}</p>
                  <p className="text-xs text-muted">{relativeDate(summary.latest.date)}</p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="tnum text-sm font-semibold">
                    {formatReading(metric, summary.latest.value, summary.latest.value2)}
                    {metric.unit ? (
                      <span className="ml-1 font-normal text-muted">{metric.unit}</span>
                    ) : null}
                  </span>
                  <StatusPill level={status.level} label={status.label} />
                </div>
              </Link>
            ))}
          </Card>
        </section>
      ) : null}

      <section className="mb-6">
        <SectionTitle>Your metrics</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map(({ id, points }, i) => (
            <MetricCard
              key={id}
              metricId={id}
              points={points}
              profile={profile}
              index={i}
            />
          ))}
        </div>
      </section>

      {due.length > 0 ? (
        <section>
          <SectionTitle>Might be due for a re-check</SectionTitle>
          <Card>
            <ul className="space-y-1.5 text-sm">
              {due.map(({ metric, age }) => (
                <li key={metric.id}>
                  <Link
                    href={`/m/${metric.id}`}
                    className="flex min-h-11 items-center justify-between gap-3 rounded-lg px-1 transition-colors duration-200 hover:text-accent"
                  >
                    <span>{metric.label}</span>
                    <span className="shrink-0 text-muted">
                      {Math.floor(age / 30)} months ago
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      ) : null}
    </>
  );
}

function PageHeading({ total }: { total: number }) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted">
          {total === 0
            ? "Let us get the first number in."
            : `${total} reading${total === 1 ? "" : "s"} logged`}
        </p>
      </div>
    </div>
  );
}
