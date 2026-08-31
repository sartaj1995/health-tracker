"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { inSentence } from "@/lib/format";
import { parseLabReport, type ParsedRow } from "@/lib/labImport";
import { ENTERABLE, bandsFor, classify, getMetric, metricsByCategory } from "@/lib/metrics";
import { todayISO } from "@/lib/stats";
import { useStore } from "@/lib/store";
import {
  BTN_PRIMARY,
  BTN_SECONDARY,
  Card,
  EmptyState,
  SectionTitle,
  StatusPill,
} from "./ui";

type Draft = ParsedRow & { include: boolean; key: number };

export function LabImport() {
  const router = useRouter();
  const { profile, addEntry, entries } = useStore();

  const [text, setText] = useState("");
  const [drafts, setDrafts] = useState<Draft[] | null>(null);
  const [date, setDate] = useState(todayISO());
  const [unmatched, setUnmatched] = useState(0);
  const [saved, setSaved] = useState<number | null>(null);

  const chosen = drafts?.filter((d) => d.include) ?? [];

  /** Readings already on file for this date — importing again would duplicate. */
  const existing = useMemo(() => {
    const ids = new Set(entries.filter((e) => e.date === date).map((e) => e.metricId));
    return ids;
  }, [entries, date]);

  function handleParse() {
    const result = parseLabReport(text);
    setUnmatched(result.unmatched);
    setDate(result.date ?? todayISO());
    setDrafts(
      result.rows.map((row, i) => ({
        ...row,
        key: i,
        // Anything implausible starts unticked, so a misread number cannot be
        // saved by reflex.
        include: !row.suspect,
      })),
    );
    setSaved(null);
  }

  function update(key: number, patch: Partial<Draft>) {
    setDrafts((prev) =>
      prev ? prev.map((d) => (d.key === key ? { ...d, ...patch } : d)) : prev,
    );
  }

  function handleSave() {
    for (const draft of chosen) {
      addEntry({
        metricId: draft.metricId,
        value: draft.value,
        value2: draft.value2,
        date,
        note: "From lab report",
      });
    }
    setSaved(chosen.length);
    setDrafts(null);
    setText("");
  }

  if (saved !== null) {
    return (
      <EmptyState
        title={`${saved} reading${saved === 1 ? "" : "s"} saved`}
        body="They are on your dashboard and in the charts now, each tagged as coming from a lab report."
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <button onClick={() => router.push("/")} className={BTN_PRIMARY}>
              See the dashboard
            </button>
            <button onClick={() => setSaved(null)} className={BTN_SECONDARY}>
              Import another
            </button>
          </div>
        }
      />
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-semibold tracking-tight">Import a lab report</h1>
      <p className="mt-1 max-w-prose text-sm text-muted">
        Paste the text of a report and every reading it recognises is pulled out at once,
        rather than typed in one at a time. Nothing is uploaded — the reading happens in
        this browser.
      </p>

      <div className="mt-5">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">Report text</span>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={8}
            placeholder={"Total Cholesterol      171    mg/dL    < 200\nHDL Cholesterol         32    mg/dL    > 40\nVitamin D (25-OH)     41.9    ng/mL    30 - 100"}
            className="w-full rounded-xl border border-border bg-surface-2 p-3 font-mono text-sm outline-none transition-colors duration-200 focus:border-accent"
          />
        </label>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={handleParse}
            disabled={text.trim() === ""}
            className={`${BTN_PRIMARY} disabled:opacity-50`}
          >
            Find readings
          </button>
          {text ? (
            <button
              onClick={() => {
                setText("");
                setDrafts(null);
              }}
              className={BTN_SECONDARY}
            >
              Clear
            </button>
          ) : null}
        </div>
      </div>

      {drafts !== null ? (
        drafts.length === 0 ? (
          <div className="mt-6">
            <EmptyState
              title="Nothing recognised"
              body={
                unmatched > 0
                  ? `${unmatched} line${unmatched === 1 ? "" : "s"} had numbers but no metric name this app knows. Check the report pasted as text rather than an image, or add those readings by hand.`
                  : "No lines looked like readings. Reports copied out of a PDF sometimes lose their layout — paste the text rather than a screenshot."
              }
            />
          </div>
        ) : (
          <section className="mt-6">
            <SectionTitle>
              Found {drafts.length} reading{drafts.length === 1 ? "" : "s"}
            </SectionTitle>

            <Card className="!p-0">
              <ul className="divide-y divide-border">
                {drafts.map((draft) => {
                  const metric = getMetric(draft.metricId)!;
                  const status = classify(draft.value, bandsFor(metric, profile));
                  const already = existing.has(draft.metricId);
                  return (
                    <li key={draft.key} className="p-3">
                      {/*
                        Two lines rather than one: at 375px a checkbox, metric
                        picker, value, unit and status pill on a single row
                        squeezed the picker to 40px and the checkbox below a
                        usable tap size.
                      */}
                      <div className="flex items-center gap-2">
                        <label className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center">
                          <input
                            type="checkbox"
                            checked={draft.include}
                            onChange={(e) =>
                              update(draft.key, { include: e.target.checked })
                            }
                            aria-label={`Import ${inSentence(metric.label)}`}
                            className="h-5 w-5 accent-[var(--accent)]"
                          />
                        </label>

                        <select
                          value={draft.metricId}
                          onChange={(e) => update(draft.key, { metricId: e.target.value })}
                          aria-label="Metric"
                          className="min-h-11 min-w-0 flex-1 rounded-xl border border-border bg-surface-2 px-2 text-sm outline-none focus:border-accent"
                        >
                          {metricsByCategory(ENTERABLE).map((group) => (
                            <optgroup key={group.category} label={group.category}>
                              {group.metrics.map((m) => (
                                <option key={m.id} value={m.id}>
                                  {m.label}
                                </option>
                              ))}
                            </optgroup>
                          ))}
                        </select>
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-2 pl-[52px]">
                        <input
                          value={draft.value}
                          onChange={(e) =>
                            update(draft.key, { value: Number(e.target.value) || 0 })
                          }
                          inputMode="decimal"
                          type="text"
                          aria-label={`${inSentence(metric.label)} value`}
                          className="tnum min-h-11 w-24 rounded-xl border border-border bg-surface-2 px-2 text-sm font-semibold outline-none focus:border-accent"
                        />
                        <span className="shrink-0 text-xs text-muted">{metric.unit}</span>
                        {status ? (
                          <StatusPill level={status.level} label={status.label} />
                        ) : null}
                      </div>

                      <div className="mt-1.5 pl-[52px] text-xs text-muted">
                        {draft.suspect ? (
                          <span className="text-warn">
                            That is outside the usual range for{" "}
                            {inSentence(metric.label)} — check it against the report.{" "}
                          </span>
                        ) : null}
                        {draft.converted ? (
                          <span>
                            Converted from {draft.converted.value} {draft.converted.unit}.{" "}
                          </span>
                        ) : null}
                        {already ? (
                          <span className="text-warn">
                            You already have a {inSentence(metric.label)} reading on this
                            date; importing adds a second.{" "}
                          </span>
                        ) : null}
                        <span className="opacity-70">{draft.source}</span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Card>

            {unmatched > 0 ? (
              <p className="mt-2 px-1 text-xs text-muted">
                {unmatched} other line{unmatched === 1 ? "" : "s"} had numbers but no metric
                name this app recognises.
              </p>
            ) : null}

            <div className="mt-4 rounded-2xl border border-border bg-surface p-4">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium">
                  Date for these readings
                </span>
                <input
                  type="date"
                  value={date}
                  max={todayISO()}
                  onChange={(e) => setDate(e.target.value)}
                  className="min-h-11 rounded-xl border border-border bg-surface-2 px-3 text-base outline-none focus:border-accent"
                />
              </label>
              <p className="mt-1.5 text-xs text-muted">
                Taken from the report where one was found. Blood drawn on one day is all
                one date, so it is set once for the batch.
              </p>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={handleSave}
                disabled={chosen.length === 0}
                className={`${BTN_PRIMARY} disabled:opacity-50`}
              >
                Save {chosen.length} reading{chosen.length === 1 ? "" : "s"}
              </button>
              <button onClick={() => setDrafts(null)} className={BTN_SECONDARY}>
                Cancel
              </button>
            </div>
          </section>
        )
      ) : null}
    </div>
  );
}
