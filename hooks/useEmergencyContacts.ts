import { EmergencyContact, MOCK_CONTACTS } from '@/constants/data';
import { useMemo } from 'react';
import { useAuth } from './useAuth';
import { STORAGE_KEYS, useStoredState } from './useStorage';

export function useEmergencyContacts() {
  const { user } = useAuth();
  const uid = user?.uid ?? 'anonymous';

  const [contacts, setContacts, loading] = useStoredState<EmergencyContact[]>(
    STORAGE_KEYS.EMERGENCY_CONTACTS(uid),
    []
  );

  const normalizedContacts = useMemo(() => {
    const source = contacts.length > 0 ? contacts : MOCK_CONTACTS;
    const hasPrimary = source.some((contact) => Boolean(contact.isPrimary));

    return source.map((contact, index) => {
      const computedInitials = contact.name
        ?.trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? '')
        .join('') || 'EC';

      return {
        ...contact,
        isPrimary: hasPrimary ? Boolean(contact.isPrimary) : index === 0,
        initials: contact.initials || computedInitials,
        color: contact.color || '#1A7A6E',
      };
    });
  }, [contacts]);

  return [normalizedContacts, setContacts, loading] as const;
}