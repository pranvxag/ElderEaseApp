import { useAuth } from '@/hooks/useAuth';
import { STORAGE_KEYS, storageSet, useStoredState } from '@/hooks/useStorage';
import { EmergencyContact, Medicine, UserProfile } from '@/types/user';
import { useCallback } from 'react';
import { Medication as TrackerMedication } from '../constants/data';

function makeDefaultProfile(uid: string, email = '', displayName = '', photoURL?: string | null): UserProfile {
  const now = new Date().toISOString();
  return {
    uid,
    email,
    displayName,
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

const TIME_LABEL_TO_REMINDER: Record<string, string> = {
  'Morning (6–9 AM)': '8:00 AM',
  'Mid-morning (9–12 PM)': '10:00 AM',
  'Afternoon (12–3 PM)': '1:00 PM',
  'Evening (3–6 PM)': '5:00 PM',
  'Night (6–9 PM)': '8:00 PM',
  'Bedtime (9 PM+)': '9:00 PM',
};

function toReminderTime(value?: string): string {
  if (!value) return '9:00 AM';
  return TIME_LABEL_TO_REMINDER[value] ?? value;
}

function toTrackerMeds(medicines: Medicine[]): TrackerMedication[] {
  return medicines.map((med) => ({
    id: med.id,
    name: med.name,
    dosage: med.dosage,
    time: toReminderTime(med.time),
    frequency: toTrackerFrequency(med.frequency),
    color: '#4ECDC4',
    status: 'upcoming',
    purpose: med.notes || 'As prescribed',
    streak: 0,
    instructions: med.notes,
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
        displayName:
          data.displayName ?? base.displayName ?? user.displayName ?? user.email?.split('@')[0] ?? 'User',
        photoURL: data.photoURL ?? base.photoURL ?? user.photoURL ?? undefined,
        createdAt: base.createdAt || now,
        updatedAt: now,
        preferredLanguage: (data.preferredLanguage as any) ?? (base.preferredLanguage as any) ?? 'en',
        emergencyContacts: data.emergencyContacts ?? base.emergencyContacts ?? [],
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
      setProfile((prev) => {
        const base = prev ?? makeDefaultProfile(user.uid, user.email ?? '', user.displayName ?? '', user.photoURL);
        return {
          ...base,
          emergencyContacts: contacts,
          updatedAt: now,
        };
      });
      await storageSet(STORAGE_KEYS.EMERGENCY_CONTACTS(user.uid), contacts);
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
