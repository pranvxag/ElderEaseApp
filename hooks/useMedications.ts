/**
 * useMedications - Hook for managing medicines from medicinelogs as the sole source of truth.
 * Medicines are stored and read from users/{uid}/medicinelogs/{date} docs.
 */

import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Medication } from '../constants/data';
import {
  appendMedicineLog,
  deleteMedicineFromFutureLogs,
  getLocalDateKey,
  getRecentMedicineLogs,
  MedicineLogDay,
  MedicineLogStatus,
  subscribeToMedicineLogDate
} from '../lib/medicine-logs';
import {
  cancelMedicationReminder,
  requestNotificationPermission,
  scheduleMedicationReminder,
} from '../lib/notifications';
import { useAuth } from './useAuth';
import { STORAGE_KEYS, useStoredState } from './useStorage';

const PILL_COLORS = ['#FF6B6B', '#4ECDC4', '#A78BFA', '#FCD34D', '#60A5FA', '#34D399', '#FB923C'];

function getNotificationIds(value: string | string[] | undefined): string[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function toUiStatus(status: MedicineLogStatus | undefined): Medication['status'] {
  if (status === 'taken') return 'taken';
  if (status === 'not_taken') return 'missed';
  if (status === 'snoozed') return 'skipped';
  return 'upcoming';
}

export function useMedications() {
  const { user } = useAuth();
  const uid = user?.uid ?? 'anonymous';

  const [meds, setMeds] = useState<Medication[]>([]);
  const [notificationMap, setNotificationMap, mappingsLoading] = useStoredState<Record<string, string[]>>(
    STORAGE_KEYS.NOTIFICATION_MAP(uid),
    {}
  );
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [recentMedicineLogs, setRecentMedicineLogs] = useState<MedicineLogDay[]>([]);
  const [undoEntries, setUndoEntries] = useState<Record<string, { previousStatus?: MedicineLogStatus; previousStreak?: number; expiresAt: number }>>(
    {}
  );
  const [loading, setLoading] = useState(true);

  // Request notification permission on mount
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

  // Subscribe to today's medicine logs
  useEffect(() => {
    if (!user) return;

    const todayKey = getLocalDateKey();
    console.log('Subscribing to medicinelog date:', todayKey);
    const unsubscribe = subscribeToMedicineLogDate(user.uid, todayKey, (day) => {
      console.log('Firestore snapshot entries:', JSON.stringify(day?.entries ?? []));
      const entries = day.entries ?? [];
      const built: Medication[] = entries.map((entry: any) => ({
        id: entry.id ?? `${entry.medicineId}_${entry.doseIndex ?? 0}`,
        originalId: entry.medicineId,
        name: entry.medicineName ?? entry.name ?? 'Unknown',
        dosage: entry.dosage ?? '',
        time: entry.scheduledTime ?? '9:00 AM',
        reminderTime: entry.reminderTime ?? entry.scheduledTime ?? '9:00 AM',
        frequency: entry.frequency ?? 'daily',
        color: PILL_COLORS[
          Math.abs((entry.medicineId ?? '').charCodeAt(0) ?? 0) % PILL_COLORS.length
        ],
        status: entry.status === 'taken' ? 'taken'
              : entry.status === 'not_taken' ? 'missed'
              : entry.status === 'snoozed' ? 'skipped'
              : 'upcoming',
        purpose: entry.notes ?? 'As prescribed',
        streak: 0,
        doseIndex: entry.doseIndex ?? 0,
        doseLabel: null,
      }));

      console.log('Snapshot rebuilt meds:', 
        built.map(m => ({ id: m.id, status: m.status })));

      built.sort((a, b) => {
        const toMin = (t: string) => {
          if (!t) return 0;
          const parts = t.split(' ');
          if (parts.length < 2) return 0;
          const [time, period] = parts;
          let [h, m] = time.split(':').map(Number);
          if (period === 'PM' && h !== 12) h += 12;
          if (period === 'AM' && h === 12) h = 0;
          return h * 60 + m;
        };
        return toMin(a.time || '') - toMin(b.time || '');
      });

      setTimeout(() => {
        setMeds(built);
        setLoading(false);
      }, 0);
    });

    return unsubscribe;
  }, [user]);

  // Load recent 7-day logs for history
  useEffect(() => {
    if (!user) return;
    (async () => {
      const logs = await getRecentMedicineLogs(user.uid, 7);
      setRecentMedicineLogs(logs);
    })();
  }, [user]);

  // Cleanup expired undo entries
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

  // Schedule reminders for meds that don't have them yet
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

  const takenCount = useMemo(() => meds.filter((m) => m.status === 'taken').length, [meds]);
  const totalMeds = meds.length;
  const upcomingMeds = useMemo(() => meds.filter((m) => m.status === 'upcoming'), [meds]);

  const markTaken = useCallback(
    async (id: string, doseIndex: number = 0) => {
      console.log('markTaken called:', { id, doseIndex });
      
      if (!user?.uid) {
        console.warn('markTaken: no user uid');
        return;
      }

      const currentMed = meds.find(m => m.id === id);
      console.log('markTaken: current med found:', currentMed?.name, 'streak:', currentMed?.streak);

      setUndoEntries((prev) => ({
        ...prev,
        [id]: {
          previousStreak: currentMed?.streak ?? 0,
          expiresAt: Date.now() + 10000,
        },
      }));

      // Update local state immediately for UI feedback
      setMeds((prev) =>
        prev.map((item) =>
          item.id === id
            ? { ...item, status: 'taken', streak: item.streak + 1 }
            : item
        )
      );

      // Update Firestore entry status
      try {
        const todayKey = getLocalDateKey();
        const ref = doc(db, 'users', user.uid, 'medicinelogs', todayKey);
        const snapshot = await getDoc(ref);
        
        if (!snapshot.exists()) {
          console.warn('markTaken: no document for today');
          return;
        }

        const entries: any[] = snapshot.data()?.entries ?? [];
        console.log('markTaken: found entries count:', entries.length);
        
        const updatedEntries = entries.map((entry: any) => {
          if (entry.id === id) {
            console.log('markTaken: updating entry:', entry.id);
            return {
              ...entry,
              status: 'taken',
              updatedAt: new Date().toISOString(),
            };
          }
          return entry;
        });

        await setDoc(ref, { 
          date: todayKey,
          entries: updatedEntries 
        }, { merge: true });
        
        console.log('markTaken: Firestore updated successfully');
      } catch (err) {
        console.error('markTaken Firestore error:', err);
      }
    },
    [meds, user]
  );

  const markNotTaken = useCallback(
    async (entryId: string, doseIndex: number = 0) => {
      const med = meds.find((m) => m.id === entryId);
      if (!med || !user) return;

      setMeds((prev) =>
        prev.map((m) => (m.id === entryId ? { ...m, status: 'missed' } : m))
      );

      await appendMedicineLog(user.uid, {
        medicineId: med.originalId,
        medicineName: med.name,
        scheduledTime: med.time || '9:00 AM',
        doseIndex: med.doseIndex ?? 0,
        status: 'not_taken',
        updatedAt: new Date().toISOString(),
      });
    },
    [meds, user]
  );

  const snoozeMedication = useCallback(
    async (entryId: string, doseIndex: number = 0) => {
      const med = meds.find((m) => m.id === entryId);
      if (!med || !user) return;

      setMeds((prev) =>
        prev.map((m) => (m.id === entryId ? { ...m, status: 'skipped' } : m))
      );

      await appendMedicineLog(user.uid, {
        medicineId: med.originalId,
        medicineName: med.name,
        scheduledTime: med.time || '9:00 AM',
        doseIndex: med.doseIndex ?? 0,
        status: 'snoozed',
        updatedAt: new Date().toISOString(),
      });
    },
    [meds, user]
  );

  const canUndoTaken = useCallback((entryId: string) => {
    const entry = undoEntries[entryId];
    return Boolean(entry && entry.expiresAt > Date.now());
  }, [undoEntries]);

  const undoTaken = useCallback(
    async (entryId: string, doseIndex: number = 0) => {
      const undoEntry = undoEntries[entryId];
      const med = meds.find((m) => m.id === entryId);
      if (!undoEntry || !med || !user || !canUndoTaken(entryId)) return;

      setMeds((prev) =>
        prev.map((m) => (m.id === entryId ? { ...m, status: 'upcoming' } : m))
      );

      await appendMedicineLog(user.uid, {
        medicineId: med.originalId,
        medicineName: med.name,
        scheduledTime: med.time || '9:00 AM',
        doseIndex: med.doseIndex ?? 0,
        status: 'pending',
        updatedAt: null,
      });

      setUndoEntries((prev) => {
        const next = { ...prev };
        delete next[entryId];
        return next;
      });
    },
    [canUndoTaken, meds, undoEntries, user]
  );

  const addMedication = useCallback(
    async (med: Medication) => {
      // Only schedule notifications — Firestore writes happen in UI
      if (!notificationsEnabled) return;
      const notificationIds = await scheduleMedicationReminder(med);
      if (notificationIds.length > 0) {
        setNotificationMap((prev) => ({ ...prev, [med.id]: notificationIds }));
      }
    },
    [notificationsEnabled, setNotificationMap]
  );

  const updateMedication = useCallback(
    async (updated: Medication) => {
      setMeds((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));

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

  const deleteMed = useCallback(
    async (medicineId: string) => {
      if (!user) return;
      const med = meds.find((m) => m.originalId === medicineId);
      if (!med) return;

      // Cancel notifications
      const notificationIds = getNotificationIds(notificationMap[medicineId]);
      for (const notificationId of notificationIds) {
        try {
          await cancelMedicationReminder(notificationId);
        } catch (error) {
          console.warn('Failed to cancel medication reminder:', error);
        }
      }

      // Delete from future logs
      await deleteMedicineFromFutureLogs(user.uid, medicineId, getLocalDateKey());

      // Remove from local state
      setMeds((prev) => prev.filter((m) => m.originalId !== medicineId));
      setNotificationMap((prev) => {
        const next = { ...prev };
        delete next[medicineId];
        return next;
      });
    },
    [meds, notificationMap, setMeds, setNotificationMap, user]
  );

  return {
    meds: meds ?? [],
    addMedication,
    updateMedication,
    markTaken,
    markNotTaken,
    snoozeMedication,
    undoTaken,
    canUndoTaken,
    deleteMed,
    upcomingMeds: upcomingMeds ?? [],
    recentMedicineLogs: recentMedicineLogs ?? [],
    loading: loading || mappingsLoading,
    takenCount: takenCount ?? 0,
    totalMeds: totalMeds ?? 0,
  };
}
