import { useCallback, useEffect, useMemo, useState } from 'react';
import { Medication, MOCK_MEDICATIONS } from '../constants/data';
import {
    appendMedicineLog,
    ensureDailyMedicineLogs,
    getLocalDateKey,
    getRecentMedicineLogs,
    MedicineLogDay,
    MedicineLogEntry,
    MedicineLogStatus,
    subscribeToMedicineLogDate,
} from '../lib/medicineLogs';
import {
    cancelMedicationReminder,
    requestNotificationPermission,
    scheduleMedicationReminder,
} from '../lib/notifications';
import { useAuth } from './useAuth';
import { STORAGE_KEYS, useStoredState } from './useStorage';

function isExpiredMedication(expiresAt?: string): boolean {
  if (!expiresAt) return false;
  const expiry = new Date(expiresAt).getTime();
  if (Number.isNaN(expiry)) return false;
  return Date.now() > expiry;
}

function getNotificationIds(value: string | string[] | undefined): string[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function getScheduledTime(med?: Medication): string {
  if (!med) return '9:00 AM';
  return med.time || med.times?.[0] || '9:00 AM';
}

function toUiStatus(status: MedicineLogStatus | undefined): Medication['status'] {
  if (status === 'taken') return 'taken';
  if (status === 'not_taken') return 'missed';
  if (status === 'snoozed') return 'skipped';
  return 'upcoming';
}

function buildMedicineSeedKey(meds: Medication[]): string {
  return meds
    .map((med) => [med.id, med.name, med.dosage, med.time ?? '', med.times?.join(',') ?? '', med.frequency].join('~'))
    .join('|');
}

export function useMedications() {
  const { user } = useAuth();
  const uid = user?.uid ?? 'anonymous';

  const [meds, setMeds, medsLoading] = useStoredState<Medication[]>(
    STORAGE_KEYS.MEDICINES(uid),
    MOCK_MEDICATIONS
  );
  const [notificationMap, setNotificationMap, mappingsLoading] = useStoredState<
    Record<string, string[]>
  >(STORAGE_KEYS.NOTIFICATION_MAP(uid), {});
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [recentMedicineLogs, setRecentMedicineLogs] = useState<MedicineLogDay[]>([]);
  const [undoEntries, setUndoEntries] = useState<
    Record<string, { previousStreak: number; expiresAt: number }>
  >({});

  const loading = medsLoading || mappingsLoading;
  const medicineSeedKey = useMemo(() => buildMedicineSeedKey(meds), [meds]);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setUndoEntries((prev) => {
        let changed = false;
        const next: typeof prev = {};
        for (const [id, value] of Object.entries(prev)) {
          if (value.expiresAt > now) {
            next[id] = value;
          } else {
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      const enabled = await requestNotificationPermission();
      if (active) {
        setNotificationsEnabled(enabled);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (loading || !user) return;

    void ensureDailyMedicineLogs(user.uid, meds, getLocalDateKey());
  }, [loading, medicineSeedKey, user]);

  useEffect(() => {
    if (loading || !user) return;

    const todayKey = getLocalDateKey();
    const unsubscribe = subscribeToMedicineLogDate(user.uid, todayKey, (day) => {
      const entriesByMedicineId = new Map<string, MedicineLogEntry>();
      day.entries.forEach((entry) => {
        entriesByMedicineId.set(entry.medicineId, entry);
      });

      setMeds((prev) =>
        prev.map((med) => {
          const entry = entriesByMedicineId.get(med.id);
          const nextStatus = toUiStatus(entry?.status);
          if (med.status === nextStatus) {
            return med;
          }
          return { ...med, status: nextStatus };
        })
      );

      void getRecentMedicineLogs(user.uid, 7).then((logs) => {
        setRecentMedicineLogs(logs);
      });
    });

    return unsubscribe;
  }, [loading, setMeds, user]);

  useEffect(() => {
    if (loading || !notificationsEnabled) return;

    const missingReminders = meds.filter((med) => getNotificationIds(notificationMap[med.id]).length === 0);
    if (missingReminders.length === 0) return;

    (async () => {
      const nextMap = { ...notificationMap };
      for (const med of missingReminders) {
        const notificationIds = await scheduleMedicationReminder(med);
        if (notificationIds.length > 0) {
          nextMap[med.id] = notificationIds;
        }
      }
      setNotificationMap(nextMap);
    })();
  }, [loading, notificationsEnabled, meds, notificationMap, setNotificationMap]);

  useEffect(() => {
    if (loading) return;

    const expiredIds = meds.filter((med) => isExpiredMedication(med.expiresAt)).map((med) => med.id);
    if (expiredIds.length === 0) return;

    (async () => {
      for (const id of expiredIds) {
        const notificationIds = getNotificationIds(notificationMap[id]);
        for (const notificationId of notificationIds) {
          try {
            await cancelMedicationReminder(notificationId);
          } catch (error) {
            console.warn('Failed to cancel expired medication reminder:', error);
          }
        }
      }
    })();

    setMeds((prev) => prev.filter((med) => !expiredIds.includes(med.id)));
    setNotificationMap((prev) => {
      const next = { ...prev };
      for (const id of expiredIds) {
        delete next[id];
      }
      return next;
    });
  }, [loading, meds, notificationMap, setMeds, setNotificationMap]);

  const takenCount = useMemo(
    () => meds.filter((m) => m.status === 'taken').length,
    [meds]
  );

  const totalMeds = meds.length;
  const upcomingMeds = useMemo(
    () => meds.filter((m) => m.status === 'upcoming'),
    [meds]
  );

  const addMedication = useCallback(
    async (med: Medication) => {
      setMeds((prev) => [...prev, med]);
      if (!notificationsEnabled) return;
      const notificationIds = await scheduleMedicationReminder(med);
      if (notificationIds.length > 0) {
        setNotificationMap((prev) => ({ ...prev, [med.id]: notificationIds }));
      }
    },
    [notificationsEnabled, setMeds, setNotificationMap]
  );

  const recordMedicationStatus = useCallback(
    async (id: string, status: MedicineLogStatus) => {
      const med = meds.find((item) => item.id === id);
      if (!med || !user) return;

      await appendMedicineLog(user.uid, {
        medicineId: med.id,
        medicineName: med.name,
        scheduledTime: getScheduledTime(med),
        takenAt: status === 'pending' ? null : new Date().toISOString(),
        status,
      });
    },
    [meds, user]
  );

  const updateMedication = useCallback(
    async (updated: Medication) => {
      setMeds((prev) => prev.map((med) => (med.id === updated.id ? updated : med)));

      const previousNotificationIds = getNotificationIds(notificationMap[updated.id]);
      for (const notificationId of previousNotificationIds) {
        try {
          await cancelMedicationReminder(notificationId);
        } catch (error) {
          console.warn('Failed to cancel medication reminder:', error);
        }
      }

      if (!notificationsEnabled) return;

      const notificationIds = await scheduleMedicationReminder(updated);
      setNotificationMap((prev) => ({ ...prev, [updated.id]: notificationIds }));
    },
    [notificationMap, notificationsEnabled, setMeds, setNotificationMap]
  );

  const markTaken = useCallback(
    async (id: string) => {
      const med = meds.find((item) => item.id === id);
      if (med) {
        setUndoEntries((prev) => ({
          ...prev,
          [id]: { previousStreak: med.streak, expiresAt: Date.now() + 10000 },
        }));
      }

      setMeds((prev) =>
        prev.map((item) => (item.id === id ? { ...item, status: 'taken', streak: item.streak + 1 } : item))
      );
      await recordMedicationStatus(id, 'taken');
    },
    [meds, recordMedicationStatus, setMeds]
  );

  const markNotTaken = useCallback(
    async (id: string) => {
      setMeds((prev) =>
        prev.map((med) => (med.id === id ? { ...med, status: 'missed' } : med))
      );
      await recordMedicationStatus(id, 'not_taken');
    },
    [recordMedicationStatus, setMeds]
  );

  const snoozeMedication = useCallback(
    async (id: string) => {
      setMeds((prev) =>
        prev.map((med) => (med.id === id ? { ...med, status: 'skipped' } : med))
      );
      await recordMedicationStatus(id, 'snoozed');
    },
    [recordMedicationStatus, setMeds]
  );

  const canUndoTaken = useCallback(
    (id: string) => {
      const entry = undoEntries[id];
      return Boolean(entry && entry.expiresAt > Date.now());
    },
    [undoEntries]
  );

  const undoTaken = useCallback(
    async (id: string) => {
      const undoEntry = undoEntries[id];
      const med = meds.find((item) => item.id === id);
      if (!undoEntry || !med || !user || !canUndoTaken(id)) return;

      setMeds((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, status: 'upcoming', streak: undoEntry.previousStreak } : item
        )
      );

      await appendMedicineLog(user.uid, {
        medicineId: med.id,
        medicineName: med.name,
        scheduledTime: getScheduledTime(med),
        takenAt: null,
        status: 'pending',
        dateKey: getLocalDateKey(),
      });

      setUndoEntries((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    },
    [canUndoTaken, meds, undoEntries, user]
  );

  const deleteMed = useCallback(
    async (id: string) => {
      setMeds((prev) => prev.filter((med) => med.id !== id));
      const notificationIds = getNotificationIds(notificationMap[id]);
      for (const notificationId of notificationIds) {
        try {
          await cancelMedicationReminder(notificationId);
        } catch (error) {
          console.warn('Failed to cancel medication reminder:', error);
        }
      }
      setNotificationMap((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    },
    [notificationMap, setMeds, setNotificationMap]
  );

  return {
    meds,
    addMedication,
    updateMedication,
    markTaken,
    markNotTaken,
    snoozeMedication,
    undoTaken,
    canUndoTaken,
    deleteMed,
    takenCount,
    totalMeds,
    upcomingMeds,
    recentMedicineLogs,
    loading,
  };
}
