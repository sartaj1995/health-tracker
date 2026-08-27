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
import { localRepo, newId, type Snapshot } from "./storage";
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
  const loaded = useRef(false);

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
  useEffect(() => {
    if (!loaded.current) return;
    void localRepo.save({ entries, profile });
  }, [entries, profile]);

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
    // Height doubles as a profile field so BMI works from day one.
    if (input.metricId === "height") {
      setProfile((p) => ({ ...p, heightCm: input.value }));
    }
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
