import { EmergencyContact, MOCK_CONTACTS } from '@/constants/data';
import { STORAGE_KEYS, useStoredState } from './useStorage';

export function useEmergencyContacts() {
  return useStoredState<EmergencyContact[]>(
    STORAGE_KEYS.EMERGENCY_CONTACTS,
    MOCK_CONTACTS
  );
}