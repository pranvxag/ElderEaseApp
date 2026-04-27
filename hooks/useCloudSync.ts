import { useAuth } from '@/hooks/useAuth';
import { STORAGE_KEYS, useStoredState } from '@/hooks/useStorage';
import { useUserProfile } from '@/hooks/useUserProfile';
import { db, hasFirebaseConfig } from '@/lib/firebase';
import { Medicine, UserProfile } from '@/types/user';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Medication as TrackerMedication } from '../constants/data';

function toTrackerFrequency(value?: string): TrackerMedication['frequency'] {
  const source = value?.toLowerCase() ?? '';
  if (source.includes('twice') || source.includes('12')) return 'twice-daily';
  if (source.includes('week')) return 'weekly';
  if (source.includes('needed') || source.includes('prn')) return 'as-needed';
  return 'daily';
}

function toTrackerMeds(medicines: Medicine[]): TrackerMedication[] {
  return medicines.map((med) => ({
    id: med.id,
    name: med.name,
    dosage: med.dosage,
    time: med.time || '9:00 AM',
    frequency: toTrackerFrequency(med.frequency),
    color: '#4ECDC4',
    status: 'upcoming',
    purpose: med.notes || 'As prescribed',
    streak: 0,
    instructions: med.notes,
  }));
}

export function useCloudSync() {
  const { user } = useAuth();
  const uid = user?.uid ?? 'anonymous';
  const { profile, saveProfile, loading: profileLoading } = useUserProfile();

  const [, setMedications, medsLoading] = useStoredState<TrackerMedication[]>(
    STORAGE_KEYS.MEDICINES(uid),
    []
  );
  const [contacts, setContacts, contactsLoading] = useStoredState<UserProfile['emergencyContacts']>(
    STORAGE_KEYS.EMERGENCY_CONTACTS(uid),
    []
  );
  const [onboarded, setOnboarded, onboardLoading] = useStoredState<boolean>(
    STORAGE_KEYS.ONBOARDED(uid),
    false
  );

  const [hydrated, setHydrated] = useState(false);
  const [cloudEnabled, setCloudEnabled] = useState(hasFirebaseConfig);
  const [cloudError, setCloudError] = useState<string | null>(null);
  const loading = profileLoading || medsLoading || contactsLoading || onboardLoading;
  const lastSyncedFingerprintRef = useRef<string>('');
  const hydratedUidRef = useRef<string | null>(null);
  const saveProfileRef = useRef(saveProfile);
  const setMedicationsRef = useRef(setMedications);
  const setContactsRef = useRef(setContacts);
  const setOnboardedRef = useRef(setOnboarded);

  useEffect(() => {
    saveProfileRef.current = saveProfile;
    setMedicationsRef.current = setMedications;
    setContactsRef.current = setContacts;
    setOnboardedRef.current = setOnboarded;
  }, [saveProfile, setContacts, setMedications, setOnboarded]);

  const payload = useMemo<UserProfile | null>(
    () => (profile ? { ...profile } : null),
    [profile]
  );

  useEffect(() => {
    if (loading || !user || !hasFirebaseConfig || !cloudEnabled) {
      setHydrated(false);
      return;
    }

    if (hydratedUidRef.current === user.uid) {
      setHydrated(true);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const ref = doc(db, 'users', user.uid, 'profile', 'data');
        const snapshot = await getDoc(ref);

        if (cancelled) return;

        if (!snapshot.exists()) {
          if (payload) {
            await setDoc(ref, { ...payload, updatedAt: serverTimestamp() }, { merge: true });
            lastSyncedFingerprintRef.current = JSON.stringify(payload);
          }
          hydratedUidRef.current = user.uid;
          setCloudError(null);
          setHydrated(true);
          return;
        }

        const cloud = snapshot.data() as UserProfile;
        await saveProfileRef.current(cloud);
        setMedicationsRef.current(toTrackerMeds(cloud.medicines ?? []));
        setContactsRef.current(cloud.emergencyContacts ?? []);
        setOnboardedRef.current(Boolean(cloud.uid));

        const normalized = {
          ...cloud,
        };

        lastSyncedFingerprintRef.current = JSON.stringify(normalized);
        hydratedUidRef.current = user.uid;
        setCloudError(null);
        setHydrated(true);
      } catch (error) {
        console.error('Cloud hydration failed:', error);
        setCloudEnabled(false);
        setCloudError(String(error));
        setHydrated(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    cloudEnabled,
    loading,
    user,
  ]);

  useEffect(() => {
    if (!user || !hydrated || loading || !hasFirebaseConfig || !cloudEnabled) return;

    if (!payload) return;

    const fingerprint = JSON.stringify(payload);
    if (fingerprint === lastSyncedFingerprintRef.current) return;

    lastSyncedFingerprintRef.current = fingerprint;

    const ref = doc(db, 'users', user.uid, 'profile', 'data');
    setDoc(ref, { ...payload, updatedAt: serverTimestamp() }, { merge: true }).catch(
      (error) => {
        console.error('Cloud sync failed:', error);
        setCloudEnabled(false);
        setCloudError(String(error));
      }
    );
  }, [cloudEnabled, hydrated, loading, payload, user]);

  return {
    cloudReady: hydrated && cloudEnabled,
    cloudEnabled,
    cloudError,
  };
}
