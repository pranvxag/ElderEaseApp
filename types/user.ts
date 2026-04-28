export type EmergencyContactSlot =
  | 'primary-caregiver'
  | 'secondary-caregiver'
  | 'doctor'
  | 'neighbor';

export type EmergencyContact = {
  id: string;
  name: string;
  phone: string;
  relation: string;
  slot?: EmergencyContactSlot;
  isPrimary?: boolean;
  required?: boolean;
};

export type Medicine = {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
  time?: string;
  times?: string[];
  notes?: string;
  createdAt?: string;
  durationDays?: number;
  expiresAt?: string;
};

export type PreferredLanguage = 'en' | 'hi' | 'mr';

export const LANGUAGE_OPTIONS: { label: string; value: PreferredLanguage }[] = [
  { label: '🇬🇧 English', value: 'en' },
  { label: '🇮🇳 हिंदी (Hindi)', value: 'hi' },
  { label: '🇮🇳 मराठी (Marathi)', value: 'mr' },
];

export const LANGUAGE_LABELS: Record<PreferredLanguage, string> = {
  en: 'English',
  hi: 'हिंदी',
  mr: 'मराठी',
};

// Maps preferred language to Google Cloud TTS and STT language codes
export const LANGUAGE_CODES: Record<PreferredLanguage, { tts: string; stt: string }> = {
  en: { tts: 'en-IN', stt: 'en-IN' },
  hi: { tts: 'hi-IN', stt: 'hi-IN' },
  mr: { tts: 'mr-IN', stt: 'mr-IN' },
};

export type UserProfile = {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string;
  age?: string;
  bloodGroup?: string;
  allergies?: string;
  preferredLanguage: PreferredLanguage;
  emergencyContacts: EmergencyContact[];
  medicines: Medicine[];
  createdAt: string;
  updatedAt: string;
};