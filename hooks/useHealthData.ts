import { BloodSugarEntry, DailySugarLog, SugarReading } from '@/constants/data';
import { useAuth } from '@/hooks/useAuth';
import { STORAGE_KEYS, useStoredState } from '@/hooks/useStorage';
import { db, hasFirebaseConfig } from '@/lib/firebase';
import { sendBloodSugarAlert } from '@/lib/notifications';
import { doc, setDoc } from 'firebase/firestore';
import { useCallback, useMemo } from 'react';

function getDateKey(date = new Date()): string {
  return date.toISOString().split('T')[0];
}

function formatTime(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

type DailySugarLogMap = Record<string, DailySugarLog>;

export function useHealthData() {
  const { user } = useAuth();
  const [entries, setEntries, loading] = useStoredState<BloodSugarEntry[]>(
    STORAGE_KEYS.BLOOD_SUGAR_ENTRIES,
    []
  );
  const uid = user?.uid ?? 'anonymous';
  const [dailyLogs, setDailyLogs, logsLoading] = useStoredState<DailySugarLogMap>(
    STORAGE_KEYS.SUGAR_LOGS(uid),
    {}
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

  const dailyLog = useMemo(() => {
    const key = getDateKey();
    return dailyLogs[key] ?? { date: key };
  }, [dailyLogs]);

  const saveDailyReading = useCallback(
    async (payload: { type: 'fasting' | 'postFood'; level: number; time?: string; timestamp?: string }) => {
      const timestamp = payload.timestamp ?? new Date().toISOString();
      const time = payload.time ?? formatTime(timestamp);
      const reading: SugarReading = { level: payload.level, time, timestamp };
      const dateKey = getDateKey(new Date(timestamp));

      setDailyLogs((prev) => {
        const current = prev[dateKey] ?? { date: dateKey };
        return {
          ...prev,
          [dateKey]: {
            ...current,
            date: dateKey,
            [payload.type]: reading,
          },
        };
      });

      if (!user || !hasFirebaseConfig) return;

      const ref = doc(db, 'users', user.uid, 'sugarlogs', dateKey);
      await setDoc(
        ref,
        {
          date: dateKey,
          [payload.type]: reading,
        },
        { merge: true }
      );
    },
    [setDailyLogs, user]
  );

  return { entries, addEntry, clear, latest, loading, dailyLog, logsLoading, saveDailyReading } as const;
}
