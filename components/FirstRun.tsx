"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { driveConfigured } from "@/lib/drive";
import {
  feetInchesFromCm,
  markFirstRunDone,
  setupSteps,
  suggestedPins,
  type SetupStep,
} from "@/lib/firstRun";
import { getMetric, isLoggable } from "@/lib/metrics";
import { useStore } from "@/lib/store";
import { SYNC_EVENT, loadSync, type SyncRecord } from "@/lib/sync";
import type { Metric, Profile } from "@/lib/types";
import { DriveCard } from "./DriveCard";
import { HeightField } from "./HeightField";
import { BTN_PRIMARY, BTN_SECONDARY, Segment } from "./ui";

const STEPS = setupSteps(driveConfigured);

const stepHref = (i: number) =>
  i >= STEPS.length ? "/welcome?step=done" : `/welcome?step=${STEPS[i]}`;

function heightText(profile: Profile): string {
  const cm = profile.heightCm;
  if (cm === undefined) return "Not set";
  if (profile.heightUnit !== "ft") return `${cm} cm`;
  const { feet, inches } = feetInchesFromCm(cm);
  return `${feet} ft ${inches} in`;
}

/**
 * The metrics on offer, in an order fixed when the step opens. Sorting the
 * picked ones to the front moved a chip out from under the finger that
 * tapped it, and put the next tap on the wrong one. Anything pinned before —
 * from a restored backup, say — follows the suggestions, and stays in the
 * list after it is unticked so it can be ticked again.
 */
function PinChoices() {
  const { profile, updateProfile } = useStore();
  const [offered] = useState(() =>
    [...new Set([...suggestedPins(profile), ...profile.pinned])]
      .map((id) => getMetric(id))
      .filter((m): m is Metric => Boolean(m) && !m?.retired),
  );

  function toggle(id: string) {
    updateProfile({
      pinned: profile.pinned.includes(id)
        ? profile.pinned.filter((p) => p !== id)
        : [...profile.pinned, id],
    });
  }

  return (
    <div role="group" aria-label="Metrics to pin" className="flex flex-wrap gap-2">
      {offered.map((metric) => (
        <Segment
          key={metric.id}
          active={profile.pinned.includes(metric.id)}
          onClick={() => toggle(metric.id)}
        >
          {metric.label}
        </Segment>
      ))}
    </div>
  );
}

/**
 * The first run: height, sex, what to pin, and a backup, one question to a
 * screen.
 *
 * Every answer is saved the moment it is given, exactly as Settings saves it,
 * so leaving halfway loses nothing and there is no "finish" to forget. The
 * step lives in the address, which lets the back gesture go back a question
 * and lets a Drive sign-in by redirect land on the step it left.
 */
export function FirstRun() {
  const router = useRouter();
  const params = useSearchParams();
  const { profile, updateProfile, ready } = useStore();
  const [sync, setSync] = useState<SyncRecord | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);

  const requested = params.get("step");
  const finished = requested === "done";
  const index = finished ? STEPS.length : Math.max(0, STEPS.indexOf(requested as SetupStep));
  const step = STEPS[index];

  useEffect(() => {
    setSync(loadSync());
    const follow = (e: Event) => setSync((e as CustomEvent<SyncRecord>).detail);
    window.addEventListener(SYNC_EVENT, follow);
    return () => window.removeEventListener(SYNC_EVENT, follow);
  }, []);

  // Each new question takes focus, so a screen reader starts from it rather
  // than from the button that led there.
  const shown = useRef(index);
  useEffect(() => {
    if (shown.current === index) return;
    shown.current = index;
    heading.current?.focus();
  }, [index]);

  useEffect(() => {
    if (finished) markFirstRunDone();
  }, [finished]);

  if (!ready) {
    return <div className="mx-auto h-64 max-w-lg animate-pulse rounded-2xl bg-surface-2" />;
  }

  function leave() {
    markFirstRunDone();
    router.push("/");
  }

  const connected = Boolean(sync?.connected && !sync.conflict);

  if (finished) {
    const pinned = profile.pinned
      .map((id) => getMetric(id))
      .filter((m): m is Metric => Boolean(m));
    const firstToLog = pinned.find(isLoggable);
    const summary: [string, string][] = [
      ["Height", heightText(profile)],
      [
        "Reference ranges",
        profile.sex === "female" ? "Female" : profile.sex === "male" ? "Male" : "Male, until you set it",
      ],
      ["Pinned", pinned.length > 0 ? pinned.map((m) => m.label).join(", ") : "Nothing yet"],
      ...(driveConfigured
        ? [["Backup", connected ? "Google Drive" : "Not set up yet"] as [string, string]]
        : []),
    ];

    return (
      <div className="mx-auto max-w-lg">
        <h1
          ref={heading}
          tabIndex={-1}
          className="text-2xl font-semibold tracking-tight focus-visible:shadow-none"
        >
          You are all set
        </h1>
        <p className="mt-2 text-sm text-muted">
          All of this can be changed later in Settings.
        </p>
        <dl className="mt-6 divide-y divide-border rounded-2xl border border-border bg-surface">
          {summary.map(([term, value]) => (
            <div key={term} className="flex min-h-11 items-baseline justify-between gap-4 px-4 py-3">
              <dt className="text-sm text-muted">{term}</dt>
              <dd className="text-right text-sm font-medium">{value}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-8 flex flex-col gap-2 sm:flex-row">
          <Link
            href={firstToLog ? `/add?metric=${firstToLog.id}` : "/add"}
            className={`${BTN_PRIMARY} sm:flex-1`}
          >
            Add your first reading
          </Link>
          <Link href="/" className={`${BTN_SECONDARY} sm:flex-1`}>
            Go to the dashboard
          </Link>
        </div>
      </div>
    );
  }

  const questions: Record<
    SetupStep,
    { title: string; why: string; answered: boolean; body: React.ReactNode }
  > = {
    height: {
      title: "How tall are you?",
      why: "Every weight you log then becomes a BMI as well. Leave it for now if you like.",
      answered: profile.heightCm !== undefined,
      body: (
        <HeightField
          large
          valueCm={profile.heightCm}
          unit={profile.heightUnit ?? "cm"}
          onChange={(heightCm) => updateProfile({ heightCm })}
          onUnitChange={(heightUnit) => updateProfile({ heightUnit })}
        />
      ),
    },
    sex: {
      title: "Are you male or female?",
      why: "Hemoglobin, ferritin, HDL, body fat, waist, creatinine and uric acid all have different healthy ranges for men and women. Skip it and the app uses the male ones.",
      answered: profile.sex !== undefined,
      body: (
        <div role="group" aria-label="Sex" className="flex gap-2">
          {(
            [
              { key: "female", label: "Female" },
              { key: "male", label: "Male" },
            ] as const
          ).map((option) => (
            <Segment
              key={option.key}
              active={profile.sex === option.key}
              onClick={() => updateProfile({ sex: option.key })}
              className="min-h-14 flex-1 text-base"
            >
              {option.label}
            </Segment>
          ))}
        </div>
      ),
    },
    pins: {
      title: "What do you want to keep an eye on?",
      why: "Pick a few. They go at the top of your dashboard, and anything else can be pinned later from its own page.",
      answered: profile.pinned.length > 0,
      body: <PinChoices />,
    },
    backup: {
      title: "Keep a copy somewhere safe",
      why: "Your readings are stored only on this device. A copy in your own Google Drive means losing or replacing it does not take them with it.",
      answered: connected,
      body: <DriveCard resumeAt="/welcome?step=backup" />,
    },
  };

  const question = questions[step];
  const last = index === STEPS.length - 1;

  return (
    <div className="mx-auto max-w-lg">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">
            Step {index + 1} of {STEPS.length}
          </p>
          <div aria-hidden className="flex gap-1">
            {STEPS.map((s, i) => (
              <span
                key={s}
                className={`h-1.5 w-6 rounded-full ${i <= index ? "bg-accent" : "bg-border"}`}
              />
            ))}
          </div>
        </div>
        <button
          type="button"
          onClick={leave}
          className="inline-flex min-h-11 items-center rounded-lg px-2 text-sm text-muted transition-colors duration-200 hover:text-text"
        >
          Skip setup
        </button>
      </div>

      <h1
        ref={heading}
        tabIndex={-1}
        className="text-2xl font-semibold tracking-tight focus-visible:shadow-none"
      >
        {question.title}
      </h1>
      <p className="mt-2 text-sm text-muted">{question.why}</p>

      <div className="mt-6">{question.body}</div>

      <div className="mt-8 flex items-center justify-between gap-2">
        {index > 0 ? (
          <button
            type="button"
            onClick={() => router.push(stepHref(index - 1))}
            className={BTN_SECONDARY}
          >
            Back
          </button>
        ) : (
          <span />
        )}
        {/* Quiet until the question has an answer, so skipping never looks
            like the thing the screen is recommending. */}
        <button
          type="button"
          onClick={() => router.push(stepHref(index + 1))}
          className={question.answered ? BTN_PRIMARY : BTN_SECONDARY}
        >
          {!question.answered ? "Skip for now" : last ? "Finish" : "Next"}
        </button>
      </div>
    </div>
  );
}
