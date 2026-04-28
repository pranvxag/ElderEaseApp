import { useCallback, useEffect, useMemo, useState } from 'react';
import { Medication, MOCK_MEDICATIONS } from '../constants/data';
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

export function useMedications() {
  const { user } = useAuth();
  const uid = user?.uid ?? 'anonymous';

  const [meds, setMeds, medsLoading] = useStoredState<Medication[]>(
    STORAGE_KEYS.MEDICINES(uid),
    MOCK_MEDICATIONS
  );
  const [notificationMap, setNotificationMap, mappingsLoading] = useStoredState<
    Record<string, string>
  >(STORAGE_KEYS.NOTIFICATION_MAP(uid), {});
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  const loading = medsLoading || mappingsLoading;

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
    if (loading || !notificationsEnabled) return;

    const missingReminders = meds.filter((med) => !notificationMap[med.id]);
    if (missingReminders.length === 0) return;

    (async () => {
      const nextMap = { ...notificationMap };
      for (const med of missingReminders) {
        const notificationId = await scheduleMedicationReminder(med);
        if (notificationId) {
          nextMap[med.id] = notificationId;
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
        const notificationId = notificationMap[id];
        if (!notificationId) continue;
        try {
          await cancelMedicationReminder(notificationId);
        } catch (error) {
          console.warn('Failed to cancel expired medication reminder:', error);
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
      const notificationId = await scheduleMedicationReminder(med);
      if (notificationId) {
        setNotificationMap((prev) => ({ ...prev, [med.id]: notificationId }));
      }
    },
    [notificationsEnabled, setMeds, setNotificationMap]
  );

  const markTaken = useCallback(
    (id: string) => {
      setMeds((prev) =>
        prev.map((med) =>
          med.id === id
            ? { ...med, status: 'taken', streak: med.streak + 1 }
            : med
        )
      );
    },
    [setMeds]
  );

  const deleteMed = useCallback(
    async (id: string) => {
      setMeds((prev) => prev.filter((med) => med.id !== id));
      const notificationId = notificationMap[id];
      if (notificationId) {
        try {
          await cancelMedicationReminder(notificationId);
        } catch (error) {
          console.warn('Failed to cancel medication reminder:', error);
        }
        setNotificationMap((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
      }
    },
    [notificationMap, setMeds, setNotificationMap]
  );

  return {
    meds,
    addMedication,
    markTaken,
    deleteMed,
    takenCount,
    totalMeds,
    upcomingMeds,
    loading,
  };
}
