"use client";

import Link from "next/link";
import { useStore } from "@/lib/store";
import { BTN_SECONDARY } from "./ui";

/**
 * On every screen while the device refuses to store changes.
 *
 * It cannot be dismissed; it goes away on the first save that works. Until
 * then the readings exist only in memory, where a backup can still reach them,
 * so backing up is the one thing it offers. It points at the file export
 * first: a file cannot overwrite anything, whereas a device that could not
 * read its own storage may not know what Drive already holds.
 */
export function SaveFailedBanner() {
  const { saveFailed } = useStore();
  if (!saveFailed) return null;

  return (
    <div role="alert" className="mb-5 rounded-2xl border border-bad/30 bg-bad/10 p-4">
      <p className="font-semibold text-bad">This device is not saving your readings</p>
      <p className="mt-1 text-sm">
        Anything you add or change stays only until the app is closed. It happens when the
        device is out of space, or when the browser is set to block cookies and website data.
      </p>
      <Link href="/settings#your-data" className={`${BTN_SECONDARY} mt-3 bg-surface text-sm`}>
        Back up what is here now
      </Link>
    </div>
  );
}
