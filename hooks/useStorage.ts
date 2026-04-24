import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

// Lightweight in-memory subscription map so multiple mounted hooks update when a value changes
const storageSubscribers: Map<string, Set<(value: any) => void>> = new Map();

// ── Storage keys ─────────────────────────────────────────────────────────────
export const STORAGE_KEYS = {
  PROFILE: (uid: string) => `user_${uid}_profile`,
  MEDICINES: (uid: string) => `user_${uid}_medicines`,
  EMERGENCY_CONTACTS: (uid: string) => `user_${uid}_emergency_contacts`,
  ONBOARDED: (uid: string) => `user_${uid}_onboarded`,
  NOTIFICATION_MAP: (uid: string) => `user_${uid}_notification_map`, // { medId -> notifId }
  ROUTINE: 'elderease:routine',
  LAST_REPORT_SENT: 'elderease:last_report_sent',
  BLOOD_SUGAR_ENTRIES: 'elderease:blood_sugar_entries',
} as const;

// ── Generic read ─────────────────────────────────────────────────────────────
export async function storageGet<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch (e) {
    console.error(`[storage] GET error for ${key}:`, e);
    return null;
  }
}

// ── Generic write ────────────────────────────────────────────────────────────
export async function storageSet<T>(key: string, value: T): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error(`[storage] SET error for ${key}:`, e);
  }
}

// ── Generic delete ───────────────────────────────────────────────────────────
export async function storageRemove(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key);
  } catch (e) {
    console.error(`[storage] REMOVE error for ${key}:`, e);
  }
}

function notifySubscribers<T>(key: string, value: T) {
  const subs = storageSubscribers.get(key);
  if (subs) {
    for (const cb of subs) cb(value);
  }
}

// ── React hook: load + save any value with automatic persistence ─────────────
// Usage:  const [meds, setMeds, loading] = useStoredState(STORAGE_KEYS.MEDICINES(uid), []);
export function useStoredState<T>(
  key: string,
  defaultValue: T
): [T, (value: T | ((prev: T) => T)) => void, boolean] {
  const [value, setValueRaw] = useState<T>(defaultValue);
  const [loading, setLoading] = useState(true);

  // Load from storage on mount and subscribe
  useEffect(() => {
    let cancelled = false;
    const listener = (next: T) => {
      setValueRaw(next);
    };

    (async () => {
      const stored = await storageGet<T>(key);
      if (!cancelled) {
        setValueRaw(stored ?? defaultValue);
        setLoading(false);
      }
    })();

    let set = storageSubscribers.get(key);
    if (!set) {
      set = new Set();
      storageSubscribers.set(key, set);
    }
    set.add(listener);

    return () => {
      cancelled = true;
      const current = storageSubscribers.get(key);
      current?.delete(listener);
      if (current && current.size === 0) storageSubscribers.delete(key);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Setter that also persists to AsyncStorage and notifies subscribers
  const setValue = useCallback(
    (updater: T | ((prev: T) => T)) => {
      setValueRaw((prev) => {
        const next = typeof updater === 'function'
          ? (updater as (prev: T) => T)(prev)
          : updater;
        storageSet(key, next); // fire-and-forget persist
        notifySubscribers(key, next);
        return next;
      });
    },
    [key]
  );

  return [value, setValue, loading];
}