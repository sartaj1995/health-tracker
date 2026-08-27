"use client";

import { useRef, useState } from "react";
import { Card, SectionTitle } from "@/components/ui";
import { getMetric } from "@/lib/metrics";
import { todayISO } from "@/lib/stats";
import { useStore } from "@/lib/store";
import type { Entry, Profile } from "@/lib/types";

function download(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function toCSV(entries: Entry[]): string {
  const head = ["date", "metric", "value", "second_value", "unit", "note"];
  const escape = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const rows = [...entries]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((e) => {
      const metric = getMetric(e.metricId);
      return [
        e.date,
        metric?.label ?? e.metricId,
        String(e.value),
        e.value2 !== undefined ? String(e.value2) : "",
        metric?.unit ?? "",
        e.note ?? "",
      ]
        .map(escape)
        .join(",");
    });
  return [head.join(","), ...rows].join("\n");
}

export default function SettingsPage() {
  const { entries, profile, updateProfile, importSnapshot, clearAll, ready } = useStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  function handleImport(file: File) {
    setError(null);
    setMessage(null);
    file
      .text()
      .then((text) => {
        const parsed = JSON.parse(text) as { entries?: Entry[]; profile?: Profile };
        if (!Array.isArray(parsed.entries)) throw new Error("no entries array");
        const valid = parsed.entries.filter(
          (e) => e && typeof e.metricId === "string" && typeof e.value === "number" && typeof e.date === "string",
        );
        importSnapshot({
          entries: valid,
          profile: { ...profile, ...(parsed.profile ?? {}) },
        });
        setMessage(`Imported ${valid.length} readings, replacing what was here before.`);
      })
      .catch(() => setError("That file does not look like a Health Tracker backup."));
  }

  if (!ready) {
    return <div className="h-64 animate-pulse rounded-2xl bg-surface-2" />;
  }

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-5 text-2xl font-semibold tracking-tight">Settings</h1>

      <section className="mb-6">
        <SectionTitle>You</SectionTitle>
        <Card className="space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Height</span>
            <div className="flex items-center gap-2">
              <input
                value={profile.heightCm ?? ""}
                onChange={(e) => {
                  const num = Number(e.target.value);
                  updateProfile({
                    heightCm: e.target.value.trim() === "" || !Number.isFinite(num) ? undefined : num,
                  });
                }}
                inputMode="decimal"
                type="text"
                placeholder="175"
                className="tnum w-32 rounded-xl border border-border bg-surface-2 px-3 py-2 outline-none focus:border-accent"
              />
              <span className="text-sm text-muted">cm — used to work out your BMI</span>
            </div>
          </label>

          <div>
            <span className="mb-1.5 block text-sm font-medium">BMI cutoffs</span>
            <div className="flex gap-2">
              {(
                [
                  { key: "asian", label: "South Asian" },
                  { key: "who", label: "WHO standard" },
                ] as const
              ).map((option) => (
                <button
                  key={option.key}
                  onClick={() => updateProfile({ bmiStandard: option.key })}
                  className={`flex-1 rounded-xl border px-3 py-2 text-sm transition-colors ${
                    profile.bmiStandard === option.key
                      ? "border-accent bg-accent-soft text-accent"
                      : "border-border text-muted"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-xs text-muted">
              South-Asian bodies carry more visceral fat at a given BMI, so the overweight cutoff is
              23 rather than 25.
            </p>
          </div>
        </Card>
      </section>

      <section className="mb-6">
        <SectionTitle>Appearance</SectionTitle>
        <Card>
          <div className="flex gap-2">
            {(
              [
                { key: "system", label: "System" },
                { key: "light", label: "Light" },
                { key: "dark", label: "Dark" },
              ] as const
            ).map((option) => (
              <button
                key={option.key}
                onClick={() => updateProfile({ theme: option.key })}
                className={`flex-1 rounded-xl border px-3 py-2 text-sm transition-colors ${
                  profile.theme === option.key
                    ? "border-accent bg-accent-soft text-accent"
                    : "border-border text-muted"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </Card>
      </section>

      <section className="mb-6">
        <SectionTitle>Your data</SectionTitle>
        <Card className="space-y-3">
          <p className="text-sm text-muted">
            Everything lives in this browser only — {entries.length} reading
            {entries.length === 1 ? "" : "s"} so far. Nothing is uploaded anywhere. Export a backup
            before clearing your browser data or switching devices.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() =>
                download(
                  `health-tracker-${todayISO()}.json`,
                  JSON.stringify({ entries, profile }, null, 2),
                  "application/json",
                )
              }
              className="rounded-xl border border-border px-3 py-2 text-sm font-medium"
            >
              Export JSON
            </button>
            <button
              onClick={() => download(`health-tracker-${todayISO()}.csv`, toCSV(entries), "text/csv")}
              className="rounded-xl border border-border px-3 py-2 text-sm font-medium"
            >
              Export CSV
            </button>
            <button
              onClick={() => fileRef.current?.click()}
              className="rounded-xl border border-border px-3 py-2 text-sm font-medium"
            >
              Import backup
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleImport(file);
                e.target.value = "";
              }}
            />
          </div>
          {message ? <p className="text-sm text-good">{message}</p> : null}
          {error ? <p className="text-sm text-bad">{error}</p> : null}
        </Card>
      </section>

      <section className="mb-6">
        <SectionTitle>Danger zone</SectionTitle>
        <Card>
          {confirmClear ? (
            <div className="space-y-3">
              <p className="text-sm">
                Delete all {entries.length} readings and reset your settings? This cannot be undone.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    clearAll();
                    setConfirmClear(false);
                    setMessage("All data deleted.");
                  }}
                  className="rounded-xl bg-bad px-3 py-2 text-sm font-medium text-white"
                >
                  Yes, delete everything
                </button>
                <button
                  onClick={() => setConfirmClear(false)}
                  className="rounded-xl border border-border px-3 py-2 text-sm font-medium"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setConfirmClear(true)}
              className="text-sm font-medium text-bad"
            >
              Delete all data
            </button>
          )}
        </Card>
      </section>

      <p className="px-1 text-xs leading-relaxed text-muted">
        Health Tracker shows general adult reference ranges to give your readings context. It is not
        a medical device and gives no diagnosis or treatment advice. Talk to a doctor about what
        your results mean, especially before changing any medication.
      </p>
    </div>
  );
}
