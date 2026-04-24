import { useAuth } from '@/hooks/useAuth';
import { STORAGE_KEYS, useStoredState } from '@/hooks/useStorage';
import { useUserProfile } from '@/hooks/useUserProfile';
import { db, hasFirebaseConfig } from '@/lib/firebase';
import { UserProfile } from '@/types/user';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { useEffect, useMemo, useRef, useState } from 'react';

export function useCloudSync() {
  const { user } = useAuth();
  const uid = user?.uid ?? 'anonymous';
  const { profile, saveProfile, loading: profileLoading } = useUserProfile();

  const [medications, setMedications, medsLoading] = useStoredState<UserProfile['medicines']>(
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
  const loading = profileLoading || medsLoading || contactsLoading || onboardLoading;
  const lastSyncedFingerprintRef = useRef<string>('');

  const payload = useMemo<UserProfile | null>(
    () =>
      profile
        ? {
            ...profile,
            medicines: medications,
            emergencyContacts: contacts,
          }
        : null,
    [contacts, medications, profile]
  );

  useEffect(() => {
    if (loading || !user || !hasFirebaseConfig) {
      setHydrated(false);
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
          setHydrated(true);
          return;
        }

        const cloud = snapshot.data() as UserProfile;
        await saveProfile(cloud);
        setMedications(cloud.medicines ?? []);
        setContacts(cloud.emergencyContacts ?? []);
        setOnboarded(Boolean(cloud.uid));

        const normalized = {
          ...cloud,
        };

        lastSyncedFingerprintRef.current = JSON.stringify(normalized);
        setHydrated(true);
      } catch (error) {
        console.error('Cloud hydration failed:', error);
        setHydrated(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    loading,
    payload,
    setOnboarded,
    saveProfile,
    setContacts,
    setMedications,
    user,
  ]);

  useEffect(() => {
    if (!user || !hydrated || loading || !hasFirebaseConfig) return;

    if (!payload) return;

    const fingerprint = JSON.stringify(payload);
    if (fingerprint === lastSyncedFingerprintRef.current) return;

    lastSyncedFingerprintRef.current = fingerprint;

    const ref = doc(db, 'users', user.uid, 'profile', 'data');
    setDoc(ref, { ...payload, updatedAt: serverTimestamp() }, { merge: true }).catch(
      (error) => {
        console.error('Cloud sync failed:', error);
      }
    );
  }, [hydrated, loading, payload, user]);

  return {
    cloudReady: hydrated,
  };
}
