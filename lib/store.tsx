"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { localRepo, newId, requestPersistence, type Snapshot } from "./storage";
import { DEFAULT_PROFILE, type Entry, type Profile } from "./types";

export type NewEntry = {
  metricId: string;
  value: number;
  value2?: number;
  date: string;
  note?: string;
};

type Store = {
  ready: boolean;
  /**
   * The device is refusing to store changes: out of space, or site data
   * blocked in the browser's settings. Nothing else looks wrong when that
   * happens — the reading appears, the chart moves — yet it all lives in
   * memory and is gone when the app closes, so it has to be said out loud.
   */
  saveFailed: boolean;
  /** Whether the browser agreed not to clear this data for space. Null until asked. */
  persistent: boolean | null;
  entries: Entry[];
  profile: Profile;
  addEntry: (input: NewEntry) => Entry;
  updateEntry: (id: string, patch: Partial<NewEntry>) => void;
  deleteEntry: (id: string) => void;
  updateProfile: (patch: Partial<Profile>) => void;
  importSnapshot: (snapshot: Snapshot) => void;
  clearAll: () => void;
};

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [profile, setProfile] = useState<Profile>(DEFAULT_PROFILE);
  const [saveFailed, setSaveFailed] = useState(false);
  const [persistent, setPersistent] = useState<boolean | null>(null);
  const loaded = useRef(false);
  const saves = useRef(0);

  // Hydrate once on the client. Rendering an empty state first keeps the
  // server and client markup identical.
  useEffect(() => {
    let cancelled = false;
    localRepo.load().then((snapshot) => {
      if (cancelled) return;
      setEntries(snapshot.entries);
      setProfile(snapshot.profile);
      loaded.current = true;
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Persist on every change, but never before the initial load has landed -
  // otherwise the empty starting state would overwrite real data.
  // This also runs once straight after hydration, which makes it the check
  // that storage works at all before anyone has typed a thing.
  useEffect(() => {
    if (!loaded.current) return;
    // Only the newest save may report. localStorage settles in order, but a
    // slower repo behind the same interface could let an old failure land
    // after a newer success and raise the alarm over data that is safe.
    const attempt = ++saves.current;
    const settle = (failed: boolean) => {
      if (attempt === saves.current) setSaveFailed(failed);
    };
    localRepo.save({ entries, profile }).then(
      () => settle(false),
      () => settle(true),
    );
  }, [entries, profile]);

  // Asked once there is something worth keeping, not on the first visit —
  // Firefox shows the person a prompt for it.
  const hasReadings = entries.length > 0;
  useEffect(() => {
    if (!hasReadings || persistent !== null) return;
    let cancelled = false;
    void requestPersistence().then((granted) => {
      if (!cancelled) setPersistent(granted);
    });
    return () => {
      cancelled = true;
    };
  }, [hasReadings, persistent]);

  const addEntry = useCallback((input: NewEntry) => {
    const now = new Date().toISOString();
    const entry: Entry = {
      id: newId(),
      metricId: input.metricId,
      value: input.value,
      value2: input.value2,
      date: input.date,
      note: input.note?.trim() || undefined,
      createdAt: now,
      updatedAt: now,
    };
    setEntries((prev) => [...prev, entry]);
    return entry;
  }, []);

  const updateEntry = useCallback((id: string, patch: Partial<NewEntry>) => {
    setEntries((prev) =>
      prev.map((e) =>
        e.id === id
          ? {
              ...e,
              ...patch,
              note: patch.note !== undefined ? patch.note.trim() || undefined : e.note,
              updatedAt: new Date().toISOString(),
            }
          : e,
      ),
    );
  }, []);

  const deleteEntry = useCallback((id: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const updateProfile = useCallback((patch: Partial<Profile>) => {
    setProfile((p) => ({ ...p, ...patch }));
  }, []);

  const importSnapshot = useCallback((snapshot: Snapshot) => {
    setEntries(snapshot.entries);
    setProfile({ ...DEFAULT_PROFILE, ...snapshot.profile });
  }, []);

  const clearAll = useCallback(() => {
    setEntries([]);
    setProfile(DEFAULT_PROFILE);
  }, []);

  const value = useMemo(
    () => ({
      ready,
      saveFailed,
      persistent,
      entries,
      profile,
      addEntry,
      updateEntry,
      deleteEntry,
      updateProfile,
      importSnapshot,
      clearAll,
    }),
    [
      ready,
      saveFailed,
      persistent,
      entries,
      profile,
      addEntry,
      updateEntry,
      deleteEntry,
      updateProfile,
      importSnapshot,
      clearAll,
    ],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside <StoreProvider>");
  return ctx;
}
