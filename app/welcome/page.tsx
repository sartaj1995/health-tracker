"use client";

import { Suspense } from "react";
import { FirstRun } from "@/components/FirstRun";

export default function WelcomePage() {
  return (
    <Suspense fallback={<div className="mx-auto h-64 max-w-lg animate-pulse rounded-2xl bg-surface-2" />}>
      <FirstRun />
    </Suspense>
  );
}
