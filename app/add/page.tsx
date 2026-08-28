"use client";

import { Suspense } from "react";
import { AddEntryForm } from "@/components/AddEntryForm";

export default function AddPage() {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-surface-2" />}>
      <AddEntryForm />
    </Suspense>
  );
}
