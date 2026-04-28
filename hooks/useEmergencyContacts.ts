import { EmergencyContact, MOCK_CONTACTS } from '@/constants/data';
import { normalizeEmergencyContacts } from '@/lib/emergency-contacts';
import { db, hasFirebaseConfig } from '@/lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { useEffect, useMemo } from 'react';
import { useAuth } from './useAuth';
import { STORAGE_KEYS, useStoredState } from './useStorage';

export function useEmergencyContacts() {
  const { user } = useAuth();
  const uid = user?.uid ?? 'anonymous';

  const [contacts, setContacts, loading] = useStoredState<EmergencyContact[]>(
    STORAGE_KEYS.EMERGENCY_CONTACTS(uid),
    []
  );

  useEffect(() => {
    if (!user || !hasFirebaseConfig) return;

    const ref = doc(db, 'users', user.uid, 'profile', 'data');
    const unsubscribe = onSnapshot(
      ref,
      (snapshot) => {
        const data = snapshot.data() as { emergencyContacts?: EmergencyContact[] } | undefined;
        if (snapshot.exists() && data?.emergencyContacts) {
          setContacts(normalizeEmergencyContacts(data.emergencyContacts));
        }
      },
      (error) => {
        console.error('useEmergencyContacts onSnapshot error:', error);
      }
    );

    return unsubscribe;
  }, [setContacts, user]);

  const normalizedContacts = useMemo(() => {
    const source = contacts.length > 0 ? normalizeEmergencyContacts(contacts) : MOCK_CONTACTS;
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