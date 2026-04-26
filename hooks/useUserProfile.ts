import { useAuth } from '@/hooks/useAuth';
import { STORAGE_KEYS, storageSet, useStoredState } from '@/hooks/useStorage';
import { EmergencyContact, Medicine, UserProfile } from '@/types/user';
import { useCallback } from 'react';

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
      await saveProfile({ medicines });
      await storageSet(STORAGE_KEYS.MEDICINES(user.uid), medicines);
    },
    [saveProfile, user]
  );

  const updateEmergencyContacts = useCallback(
    async (contacts: EmergencyContact[]) => {
      if (!user) return;
      await saveProfile({ emergencyContacts: contacts });
      await storageSet(STORAGE_KEYS.EMERGENCY_CONTACTS(user.uid), contacts);
    },
    [saveProfile, user]
  );

  return {
    profile,
    loading,
    saveProfile,
    updateMedicines,
    updateEmergencyContacts,
  };
}
