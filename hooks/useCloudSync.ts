import { DEFAULT_USER_PROFILE, EmergencyContact, Medication, UserProfile } from '@/constants/data';
import { useAuth } from '@/hooks/useAuth';
import { STORAGE_KEYS, useStoredState } from '@/hooks/useStorage';
import { db, hasFirebaseConfig } from '@/lib/firebase';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { useEffect, useMemo, useRef, useState } from 'react';

type CloudUserData = {
  profile?: UserProfile;
  medications?: Medication[];
  emergencyContacts?: EmergencyContact[];
  onboarded?: boolean;
  updatedAt?: unknown;
};

export function useCloudSync() {
  const { user } = useAuth();

  const [profile, setProfile, profileLoading] = useStoredState<UserProfile>(
    STORAGE_KEYS.USER_PROFILE,
    DEFAULT_USER_PROFILE
  );
  const [medications, setMedications, medsLoading] = useStoredState<Medication[]>(
    STORAGE_KEYS.MEDICATIONS,
    []
  );
  const [contacts, setContacts, contactsLoading] = useStoredState<EmergencyContact[]>(
    STORAGE_KEYS.EMERGENCY_CONTACTS,
    []
  );
  const [onboarded, setOnboarded, onboardLoading] = useStoredState<boolean>(
    STORAGE_KEYS.ONBOARDED,
    false
  );

  const [hydrated, setHydrated] = useState(false);
  const loading = profileLoading || medsLoading || contactsLoading || onboardLoading;
  const lastSyncedFingerprintRef = useRef<string>('');

  const payload = useMemo<CloudUserData>(
    () => ({
      profile,
      medications,
      emergencyContacts: contacts,
      onboarded,
    }),
    [contacts, medications, onboarded, profile]
  );

  useEffect(() => {
    if (loading || !user || !hasFirebaseConfig) {
      setHydrated(false);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const ref = doc(db, 'users', user.uid);
        const snapshot = await getDoc(ref);

        if (cancelled) return;

        if (!snapshot.exists()) {
          await setDoc(ref, { ...payload, updatedAt: serverTimestamp() }, { merge: true });
          lastSyncedFingerprintRef.current = JSON.stringify(payload);
          setHydrated(true);
          return;
        }

        const cloud = snapshot.data() as CloudUserData;
        if (cloud.profile) setProfile(cloud.profile);
        if (cloud.medications) setMedications(cloud.medications);
        if (cloud.emergencyContacts) setContacts(cloud.emergencyContacts);
        if (typeof cloud.onboarded === 'boolean') setOnboarded(cloud.onboarded);

        const normalized = {
          profile: cloud.profile ?? profile,
          medications: cloud.medications ?? medications,
          emergencyContacts: cloud.emergencyContacts ?? contacts,
          onboarded: cloud.onboarded ?? onboarded,
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
    contacts,
    loading,
    medications,
    onboarded,
    payload,
    profile,
    setContacts,
    setMedications,
    setOnboarded,
    setProfile,
    user,
  ]);

  useEffect(() => {
    if (!user || !hydrated || loading || !hasFirebaseConfig) return;

    const fingerprint = JSON.stringify(payload);
    if (fingerprint === lastSyncedFingerprintRef.current) return;

    lastSyncedFingerprintRef.current = fingerprint;

    const ref = doc(db, 'users', user.uid);
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
