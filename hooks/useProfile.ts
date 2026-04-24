import { useAuth } from './useAuth';
import { useUserProfile } from './useUserProfile';

type LegacyProfile = {
  name: string;
  caregiverName: string;
  caregiverPhone: string;
  remindersEnabled: boolean;
  reminderLeadMinutes: number;
  voiceConsent?: boolean;
};

const DEFAULT_LEGACY_PROFILE: LegacyProfile = {
  name: 'User',
  caregiverName: 'Primary Contact',
  caregiverPhone: '',
  remindersEnabled: true,
  reminderLeadMinutes: 30,
  voiceConsent: false,
};

export function useProfile() {
  const { user } = useAuth();
  const { profile, loading, saveProfile } = useUserProfile();

  const legacyProfile: LegacyProfile = profile
    ? {
        name: profile.displayName || user?.displayName || 'User',
        caregiverName: profile.emergencyContacts[0]?.name || 'Primary Contact',
        caregiverPhone: profile.emergencyContacts[0]?.phone || '',
        remindersEnabled: true,
        reminderLeadMinutes: 30,
        voiceConsent: false,
      }
    : {
        ...DEFAULT_LEGACY_PROFILE,
        name: user?.displayName || 'User',
      };

  const setLegacyProfile = async (next: LegacyProfile | ((prev: LegacyProfile) => LegacyProfile)) => {
    const resolved = typeof next === 'function' ? next(legacyProfile) : next;
    await saveProfile({
      displayName: resolved.name,
    });
  };

  return [legacyProfile, setLegacyProfile, loading] as const;
}
