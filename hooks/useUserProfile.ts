import { useAuth } from '@/hooks/useAuth';
import { STORAGE_KEYS, storageSet, useStoredState } from '@/hooks/useStorage';
import { normalizeEmergencyContacts } from '@/lib/emergency-contacts';
import { cleanForFirestore, hasFirebaseConfig } from '@/lib/firebase';
import { normalizeTimeSlots, slotToReminderTime } from '@/lib/medicine';
import { profileDocRef } from '@/lib/profile-data';
import { EmergencyContact, Medicine, UserProfile } from '@/types/user';
import { arrayRemove, arrayUnion, setDoc } from 'firebase/firestore';
import { useCallback } from 'react';
import { Medication as TrackerMedication } from '../constants/data';

function makeDefaultProfile(uid: string, email = '', displayName = '', photoURL?: string | null): UserProfile {
  const now = new Date().toISOString();
  return {
    uid,
    email,
    displayName,
    phoneNumber: '',
    phoneVerified: false,
    photoURL: photoURL ?? undefined,
    age: '',
    bloodGroup: '',
    allergies: '',
    preferredLanguage: 'en',
    emergencyContacts: [],
    medicines: [],
    createdAt: now,
    updatedAt: now,
  };
}

function toTrackerFrequency(value?: string): TrackerMedication['frequency'] {
  const source = value?.toLowerCase() ?? '';
  if (source.includes('twice') || source.includes('12')) return 'twice-daily';
  if (source.includes('week')) return 'weekly';
  if (source.includes('needed') || source.includes('prn')) return 'as-needed';
  return 'daily';
}

function toReminderTime(value?: string): string {
  if (!value) return '9:00 AM';
  return slotToReminderTime(value);
}

function toTrackerMeds(medicines: Medicine[]): TrackerMedication[] {
  return medicines.map((med) => ({
    id: med.id,
    name: med.name,
    dosage: med.dosage,
    time: toReminderTime(med.times?.[0] ?? med.time),
    times: normalizeTimeSlots(med.times?.length ? med.times : (med.time ? [med.time] : []), med.frequency),
    frequency: toTrackerFrequency(med.frequency),
    color: '#4ECDC4',
    status: 'upcoming',
    purpose: med.notes || 'As prescribed',
    streak: 0,
    instructions: med.notes,
    createdAt: med.createdAt,
    durationDays: med.durationDays,
    expiresAt: med.expiresAt,
  }));
}

export function useUserProfile() {
  const { user } = useAuth();
  const uid = user?.uid ?? 'anonymous';

  const [profile, setProfile, loading] = useStoredState<UserProfile | null>(
    STORAGE_KEYS.PROFILE(uid),
    null
  );

  const saveProfile = useCallback(
    async (data: Partial<UserProfile>) => {
      if (!user) return;

      const now = new Date().toISOString();
      const base =
        profile ?? makeDefaultProfile(user.uid, user.email ?? '', user.displayName ?? '', user.photoURL);

      const merged: UserProfile = {
        ...base,
        ...data,
        uid: user.uid,
        email: base.email || user.email || '',
        phoneNumber: data.phoneNumber ?? base.phoneNumber ?? '',
        phoneVerified: data.phoneVerified ?? base.phoneVerified ?? false,
        displayName:
          data.displayName ?? base.displayName ?? user.displayName ?? user.email?.split('@')[0] ?? 'User',
        photoURL: data.photoURL ?? base.photoURL ?? user.photoURL ?? undefined,
        createdAt: base.createdAt || now,
        updatedAt: now,
        preferredLanguage: (data.preferredLanguage as any) ?? (base.preferredLanguage as any) ?? 'en',
        emergencyContacts: normalizeEmergencyContacts(data.emergencyContacts ?? base.emergencyContacts ?? []),
        medicines: data.medicines ?? base.medicines ?? [],
      };

      setProfile(merged);
      await storageSet(STORAGE_KEYS.PROFILE(user.uid), merged);
    },
    [profile, setProfile, user]
  );

  const updateMedicines = useCallback(
    async (medicines: Medicine[]) => {
      if (!user) return;
      const now = new Date().toISOString();
      setProfile((prev) => {
        const base = prev ?? makeDefaultProfile(user.uid, user.email ?? '', user.displayName ?? '', user.photoURL);
        return {
          ...base,
          medicines,
          updatedAt: now,
        };
      });
      await storageSet(STORAGE_KEYS.MEDICINES(user.uid), toTrackerMeds(medicines));
    },
    [setProfile, user]
  );

  const updateEmergencyContacts = useCallback(
    async (contacts: EmergencyContact[]) => {
      if (!user) return;
      const now = new Date().toISOString();
      const normalizedContacts = normalizeEmergencyContacts(contacts);
      const previousContacts = normalizeEmergencyContacts(profile?.emergencyContacts ?? []);
      const previousBySlot = new Map(previousContacts.map((contact) => [contact.slot ?? contact.id, contact]));
      const nextBySlot = new Map(normalizedContacts.map((contact) => [contact.slot ?? contact.id, contact]));

      setProfile((prev) => {
        const base = prev ?? makeDefaultProfile(user.uid, user.email ?? '', user.displayName ?? '', user.photoURL);
        return {
          ...base,
          emergencyContacts: normalizedContacts,
          updatedAt: now,
        };
      });
      await storageSet(STORAGE_KEYS.EMERGENCY_CONTACTS(user.uid), normalizedContacts);

      if (!hasFirebaseConfig) return;

      const ref = profileDocRef(user.uid);

      for (const contact of previousContacts) {
        const key = contact.slot ?? contact.id;
        const next = nextBySlot.get(key);
        if (!next || JSON.stringify(next) !== JSON.stringify(contact)) {
          await setDoc(ref, { emergencyContacts: arrayRemove(cleanForFirestore(contact) as any), updatedAt: now } as any, { merge: true });
        }
      }

      for (const contact of normalizedContacts) {
        const key = contact.slot ?? contact.id;
        const prevContact = previousBySlot.get(key);
        if (!prevContact || JSON.stringify(prevContact) !== JSON.stringify(contact)) {
          await setDoc(ref, { emergencyContacts: arrayUnion(cleanForFirestore(contact) as any), updatedAt: now } as any, { merge: true });
        }
      }
    },
    [setProfile, user]
  );

  return {
    profile,
    loading,
    saveProfile,
    updateMedicines,
    updateEmergencyContacts,
  };
}
