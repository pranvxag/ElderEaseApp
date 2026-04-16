import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

// ── Storage keys ─────────────────────────────────────────────────────────────
export const STORAGE_KEYS = {
  MEDICATIONS: 'elderease:medications',
  ROUTINE: 'elderease:routine',
  NOTIFICATION_MAP: 'elderease:notification_map', // { medId → notifId }
  USER_PROFILE: 'elderease:user_profile',
  ONBOARDED: 'elderease:onboarded',
  LAST_REPORT_SENT: 'elderease:last_report_sent',
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

// ── React hook: load + save any value with automatic persistence ─────────────
// Usage:  const [meds, setMeds, loading] = useStoredState(STORAGE_KEYS.MEDICATIONS, []);
export function useStoredState<T>(
  key: string,
  defaultValue: T
): [T, (value: T | ((prev: T) => T)) => void, boolean] {
  const [value, setValueRaw] = useState<T>(defaultValue);
  const [loading, setLoading] = useState(true);

  // Load from storage on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = await storageGet<T>(key);
      if (!cancelled) {
        setValueRaw(stored ?? defaultValue);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Setter that also persists to AsyncStorage
  const setValue = useCallback(
    (updater: T | ((prev: T) => T)) => {
      setValueRaw((prev) => {
        const next = typeof updater === 'function'
          ? (updater as (prev: T) => T)(prev)
          : updater;
        storageSet(key, next); // fire-and-forget persist
        return next;
      });
    },
    [key]
  );

  return [value, setValue, loading];
}