import { BloodSugarEntry } from '@/constants/data';
import { STORAGE_KEYS, useStoredState } from '@/hooks/useStorage';
import { sendBloodSugarAlert } from '@/lib/notifications';
import { useCallback } from 'react';

export function useHealthData() {
  const [entries, setEntries, loading] = useStoredState<BloodSugarEntry[]>(
    STORAGE_KEYS.BLOOD_SUGAR_ENTRIES,
    []
  );

  const addEntry = useCallback(
    (payload: {
      value: number;
      unit?: 'mg/dL' | 'mmol/L';
      source?: string;
      transcript?: string;
      note?: string;
      timestamp?: string;
    }) => {
      const entry: BloodSugarEntry = {
        id: `${Date.now()}-${Math.floor(Math.random() * 10000)}`,
        value: payload.value,
        unit: payload.unit ?? 'mg/dL',
        timestamp: payload.timestamp ?? new Date().toISOString(),
        source: (payload.source as any) ?? 'manual',
        transcript: payload.transcript,
        note: payload.note,
      };
      setEntries((prev) => [entry, ...prev]);
      // fire-and-forget alert for out-of-range values
      (async () => {
        try {
          const v = Number(entry.value);
          if (!Number.isNaN(v) && (v < 70 || v >= 180)) {
            await sendBloodSugarAlert({ value: v, unit: entry.unit ?? 'mg/dL', timestamp: entry.timestamp });
          }
        } catch (err) {
          console.warn('blood sugar alert failed', err);
        }
      })();

      return entry;
    },
    [setEntries]
  );

  const clear = useCallback(() => setEntries([]), [setEntries]);
  const latest = entries && entries.length > 0 ? entries[0] : null;

  return { entries, addEntry, clear, latest, loading } as const;
}
