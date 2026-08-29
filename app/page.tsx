"use client";

import Link from "next/link";
import { useMemo } from "react";
import { MetricCard } from "@/components/MetricCard";
import { MetricRow } from "@/components/MetricRow";
import { PlusIcon } from "@/components/icons";
import { BTN_PRIMARY, Card, EmptyState, SectionTitle, StatusPill } from "@/components/ui";
import { daysAgo, formatReading, relativeDate } from "@/lib/format";
import { CATEGORY_ORDER, METRICS, bandsFor, classify, getMetric } from "@/lib/metrics";
import { seriesFor, summarize, trackedMetricIds, type Point } from "@/lib/stats";
import { useStore } from "@/lib/store";

const ORDER = new Map(METRICS.map((m, i) => [m.id, i]));

/** How many cards to show when nothing has been pinned yet. */
const RECENT_CARDS = 3;

/** Lab panels are worth repeating a couple of times a year. */
const RECHECK_DAYS: Record<string, number> = {
  vitaminD: 180,
  vitaminB12: 365,
  ferritin: 365,
  hemoglobin: 365,
  totalCholesterol: 365,
  ldl: 365,
  hdl: 365,
  vldl: 365,
  triglycerides: 365,
  hba1c: 180,
  fastingGlucose: 180,
  tsh: 365,
  creatinine: 365,
  uricAcid: 365,
  alt: 365,
};

type Tracked = { id: string; points: Point[] };

export default function DashboardPage() {
  const { entries, profile, ready } = useStore();

  const tracked = useMemo<Tracked[]>(
    () =>
      trackedMetricIds(entries, profile)
        .map((id) => ({ id, points: seriesFor(id, entries, profile) }))
        .filter((c) => c.points.length > 0)
        .sort((a, b) => (ORDER.get(a.id) ?? 999) - (ORDER.get(b.id) ?? 999)),
    [entries, profile],
  );

  /**
   * The cards at the top. Pinned metrics if you have chosen any; otherwise the
   * few you logged most recently, so the dashboard is useful before it has been
   * configured at all.
   */
  const featured = useMemo<Tracked[]>(() => {
    const pinned = profile.pinned
      .map((id) => tracked.find((t) => t.id === id))
      .filter((t): t is Tracked => Boolean(t));
    if (pinned.length > 0) return pinned;

    return [...tracked]
      .sort((a, b) => {
        const aDate = a.points[a.points.length - 1].date;
        const bDate = b.points[b.points.length - 1].date;
        return aDate < bDate ? 1 : aDate > bDate ? -1 : 0;
      })
      .slice(0, RECENT_CARDS);
  }, [tracked, profile.pinned]);

  /** Everything not already shown as a card, grouped the way a lab reports it. */
  const panels = useMemo(() => {
    const featuredIds = new Set(featured.map((f) => f.id));
    const rest = tracked.filter((t) => !featuredIds.has(t.id));
    return CATEGORY_ORDER.map((category) => ({
      category,
      rows: rest.filter((t) => getMetric(t.id)?.category === category),
    })).filter((group) => group.rows.length > 0);
  }, [tracked, featured]);

  const attention = useMemo(
    () =>
      tracked.flatMap(({ id, points }) => {
        const metric = getMetric(id);
        const summary = summarize(points);
        if (!metric || !summary) return [];
        const status = classify(summary.latest.value, bandsFor(metric, profile));
        if (!status || status.level === "good") return [];
        return [{ metric, status, summary }];
      }),
    [tracked, profile],
  );

  const due = useMemo(
    () =>
      tracked.flatMap(({ id, points }) => {
        const window = RECHECK_DAYS[id];
        const metric = getMetric(id);
        if (!window || !metric) return [];
        const age = daysAgo(points[points.length - 1].date);
        return age >= window ? [{ metric, age }] : [];
      }),
    [tracked],
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
                className="flex min-h-11 items-center gap-3 px-4 py-1.5 transition-colors duration-200 first:rounded-t-2xl last:rounded-b-2xl hover:bg-surface-2/60 active:bg-surface-2"
              >
                <span className="min-w-0 flex-1 truncate text-sm font-medium">
                  {metric.label}
                </span>
                <span className="hidden shrink-0 text-xs text-muted sm:inline">
                  {relativeDate(summary.latest.date)}
                </span>
                <span className="tnum shrink-0 text-sm font-semibold">
                  {formatReading(metric, summary.latest.value, summary.latest.value2)}
                  {metric.unit ? (
                    <span className="ml-1 font-normal text-muted">{metric.unit}</span>
                  ) : null}
                </span>
                <StatusPill level={status.level} label={status.label} />
              </Link>
            ))}
          </Card>
        </section>
      ) : null}

      {featured.length > 0 ? (
        <section className="mb-6">
          <SectionTitle>
            {profile.pinned.length > 0 ? "Pinned" : "Recently logged"}
          </SectionTitle>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map(({ id, points }, i) => (
              <MetricCard
                key={id}
                metricId={id}
                points={points}
                profile={profile}
                index={i}
              />
            ))}
          </div>
          {profile.pinned.length === 0 ? (
            <p className="mt-2 px-1 text-xs text-muted">
              Open any metric and choose <span className="font-medium">Pin to top</span> to
              keep the ones you care about up here.
            </p>
          ) : null}
        </section>
      ) : null}

      {panels.length > 0 ? (
        <section className="mb-6">
          <SectionTitle>Everything else</SectionTitle>
          {/*
            CSS multi-column rather than a grid: panels have very different
            heights (five lipids, one thyroid) and columns let them flow to fill
            the space instead of leaving ragged gaps under the short ones.
          */}
          <div className="gap-3 sm:columns-2 lg:columns-3">
            {panels.map(({ category, rows }) => (
              <Card
                key={category}
                className="mb-3 inline-block w-full break-inside-avoid !p-3"
              >
                <h3 className="mb-1 px-2 text-xs font-semibold uppercase tracking-wider text-muted">
                  {category}
                </h3>
                {rows.map(({ id, points }) => (
                  <MetricRow key={id} metricId={id} points={points} profile={profile} />
                ))}
              </Card>
            ))}
          </div>
        </section>
      ) : null}

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
