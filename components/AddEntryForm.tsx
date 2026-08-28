"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ENTERABLE,
  bandsFor,
  classify,
  getMetric,
  metricsByCategory,
} from "@/lib/metrics";
import { formatFullDate } from "@/lib/format";
import { todayISO } from "@/lib/stats";
import { useStore } from "@/lib/store";
import { BTN_PRIMARY, BTN_SECONDARY, Segment, StatusPill } from "./ui";

function yesterdayISO(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function AddEntryForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { entries, profile, addEntry, updateEntry, ready } = useStore();

  const editId = params.get("edit");
  const editing = editId ? entries.find((e) => e.id === editId) : undefined;

  const [metricId, setMetricId] = useState(params.get("metric") ?? "weight");
  const [value, setValue] = useState("");
  const [value2, setValue2] = useState("");
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const valueRef = useRef<HTMLInputElement>(null);
  const hydratedEdit = useRef(false);

  // Load the entry being edited, once the store is ready.
  useEffect(() => {
    if (!editing || hydratedEdit.current) return;
    hydratedEdit.current = true;
    setMetricId(editing.metricId);
    setValue(String(editing.value));
    setValue2(editing.value2 !== undefined ? String(editing.value2) : "");
    setDate(editing.date);
    setNote(editing.note ?? "");
  }, [editing]);

  const metric = getMetric(metricId) ?? ENTERABLE[0];

  // The handful of metrics this person actually uses, newest first.
  const recent = useMemo(() => {
    const seen: string[] = [];
    for (const e of [...entries].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))) {
      if (!seen.includes(e.metricId)) seen.push(e.metricId);
      if (seen.length === 6) break;
    }
    return seen.map((id) => getMetric(id)).filter((m) => m && !m.derived);
  }, [entries]);

  const parsed = Number(value.replace(",", "."));
  const preview =
    value.trim() !== "" && Number.isFinite(parsed)
      ? classify(parsed, bandsFor(metric, profile))
      : null;

  const lastValue = useMemo(() => {
    const rows = entries
      .filter((e) => e.metricId === metric.id)
      .sort((a, b) => (a.date < b.date ? 1 : -1));
    return rows[0];
  }, [entries, metric.id]);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const num = Number(value.replace(",", "."));
    if (value.trim() === "" || !Number.isFinite(num)) {
      setError("Enter a number.");
      return;
    }
    if (metric.min !== undefined && num < metric.min) {
      setError(`That looks too low for ${metric.label.toLowerCase()} (minimum ${metric.min}).`);
      return;
    }
    if (metric.max !== undefined && num > metric.max) {
      setError(`That looks too high for ${metric.label.toLowerCase()} (maximum ${metric.max}).`);
      return;
    }

    let second: number | undefined;
    if (metric.secondary) {
      const n2 = Number(value2.replace(",", "."));
      if (value2.trim() === "" || !Number.isFinite(n2)) {
        setError(`Enter the ${metric.secondary.label.toLowerCase()} value too.`);
        return;
      }
      second = n2;
    }

    if (editing) {
      updateEntry(editing.id, {
        metricId: metric.id,
        value: num,
        value2: second,
        date,
        note,
      });
      router.push(`/m/${metric.id}`);
      return;
    }

    addEntry({ metricId: metric.id, value: num, value2: second, date, note });
    setSaved(`${metric.label} saved for ${formatFullDate(date)}`);
    setValue("");
    setValue2("");
    setNote("");
    valueRef.current?.focus();
  }

  if (!ready) {
    return <div className="h-64 animate-pulse rounded-2xl bg-surface-2" />;
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-lg">
      <h1 className="mb-5 text-2xl font-semibold tracking-tight">
        {editing ? "Edit reading" : "Add a reading"}
      </h1>

      {recent.length > 0 && !editing ? (
        <div className="mb-5 flex flex-wrap gap-2">
          {recent.map((m) => (
            <Segment
              key={m!.id}
              active={metricId === m!.id}
              onClick={() => {
                setMetricId(m!.id);
                setSaved(null);
                valueRef.current?.focus();
              }}
            >
              {m!.label}
            </Segment>
          ))}
        </div>
      ) : null}

      <div className="space-y-4 rounded-2xl border border-border bg-surface p-4">
        <Field label="Metric">
          <select
            value={metricId}
            onChange={(e) => {
              setMetricId(e.target.value);
              setSaved(null);
              setError(null);
            }}
            className="min-h-11 w-full rounded-xl border border-border bg-surface-2 px-3 py-3 text-base outline-none transition-colors duration-200 focus:border-accent"
          >
            {metricsByCategory(ENTERABLE).map((group) => (
              <optgroup key={group.category} label={group.category}>
                {group.metrics.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                    {m.unit ? ` (${m.unit})` : ""}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </Field>

        <Field
          label={metric.secondary ? "Systolic" : "Value"}
          hint={metric.unit || undefined}
        >
          <div className="flex gap-2">
            <input
              ref={valueRef}
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                setSaved(null);
              }}
              inputMode="decimal"
              /* A plain text input avoids the scroll-wheel and spinner quirks
                 of number inputs while still showing a numeric keypad. */
              type="text"
              autoComplete="off"
              placeholder={lastValue ? String(lastValue.value) : "0"}
              className="tnum min-h-14 w-full rounded-xl border border-border bg-surface-2 px-3 py-3 text-2xl font-semibold outline-none transition-colors duration-200 focus:border-accent"
            />
            {metric.secondary ? (
              <input
                value={value2}
                onChange={(e) => setValue2(e.target.value)}
                inputMode="decimal"
                type="text"
                autoComplete="off"
                placeholder={lastValue?.value2 !== undefined ? String(lastValue.value2) : "0"}
                aria-label={metric.secondary.label}
                className="tnum min-h-14 w-full rounded-xl border border-border bg-surface-2 px-3 py-3 text-2xl font-semibold outline-none transition-colors duration-200 focus:border-accent"
              />
            ) : null}
          </div>

          <div className="mt-2 flex min-h-6 items-center gap-2 text-xs text-muted">
            {preview ? <StatusPill level={preview.level} label={preview.label} /> : null}
            {lastValue ? (
              <span>
                Last: {lastValue.value}
                {lastValue.value2 !== undefined ? `/${lastValue.value2}` : ""} on{" "}
                {formatFullDate(lastValue.date)}
              </span>
            ) : null}
          </div>
        </Field>

        <Field label="Date">
          <div className="flex gap-2">
            <input
              type="date"
              value={date}
              max={todayISO()}
              onChange={(e) => setDate(e.target.value)}
              className="min-h-11 w-full rounded-xl border border-border bg-surface-2 px-3 py-3 text-base outline-none transition-colors duration-200 focus:border-accent"
            />
          </div>
          <div className="mt-2 flex gap-2">
            <QuickDate label="Today" value={todayISO()} current={date} onPick={setDate} />
            <QuickDate label="Yesterday" value={yesterdayISO()} current={date} onPick={setDate} />
          </div>
        </Field>

        <Field label="Note" hint="optional">
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            type="text"
            placeholder="Fasting, after gym, lab name..."
            className="min-h-11 w-full rounded-xl border border-border bg-surface-2 px-3 py-3 text-base outline-none transition-colors duration-200 focus:border-accent"
          />
        </Field>

        {metric.help ? <p className="text-xs text-muted">{metric.help}</p> : null}
      </div>

      {error ? (
        <p role="alert" aria-live="assertive" className="mt-3 text-sm text-bad">
          {error}
        </p>
      ) : null}
      {saved ? (
        <p role="status" aria-live="polite" className="mt-3 text-sm text-good">
          {saved} — add another, or head back to the dashboard.
        </p>
      ) : null}

      <div className="mt-4 flex gap-2">
        <button type="submit" className={`${BTN_PRIMARY} min-h-12 flex-1`}>
          {editing ? "Save changes" : "Save reading"}
        </button>
        {editing ? (
          <button
            type="button"
            onClick={() => router.back()}
            className={`${BTN_SECONDARY} min-h-12`}
          >
            Cancel
          </button>
        ) : null}
      </div>
    </form>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-baseline justify-between text-sm font-medium">
        {label}
        {hint ? <span className="text-xs font-normal text-muted">{hint}</span> : null}
      </span>
      {children}
    </label>
  );
}

function QuickDate({
  label,
  value,
  current,
  onPick,
}: {
  label: string;
  value: string;
  current: string;
  onPick: (v: string) => void;
}) {
  return (
    <Segment active={current === value} onClick={() => onPick(value)}>
      {label}
    </Segment>
  );
}
