import { EmergencyContact, EmergencyContactSlot } from '@/types/user';

export type EmergencyContactSlotConfig = {
  slot: EmergencyContactSlot;
  label: string;
  description: string;
  required: boolean;
  isPrimary: boolean;
};

export const EMERGENCY_CONTACT_SLOTS: EmergencyContactSlotConfig[] = [
  {
    slot: 'primary-caregiver',
    label: 'Primary Caregiver',
    description: 'Required. This contact is treated as the primary emergency contact.',
    required: true,
    isPrimary: true,
  },
  {
    slot: 'secondary-caregiver',
    label: 'Optional Caregiver',
    description: 'Optional. Use this for a backup caregiver or family member.',
    required: false,
    isPrimary: false,
  },
  {
    slot: 'doctor',
    label: 'Doctor',
    description: 'Required. Used for report sharing and medical follow-up.',
    required: true,
    isPrimary: false,
  },
  {
    slot: 'neighbor',
    label: 'Neighbor',
    description: 'Optional. Someone nearby who can reach you quickly if needed.',
    required: false,
    isPrimary: false,
  },
];

function getFallbackSlot(index: number): EmergencyContactSlot {
  return EMERGENCY_CONTACT_SLOTS[index]?.slot ?? EMERGENCY_CONTACT_SLOTS[EMERGENCY_CONTACT_SLOTS.length - 1].slot;
}

function getSlotMeta(slot: EmergencyContactSlot): EmergencyContactSlotConfig {
  return EMERGENCY_CONTACT_SLOTS.find((item) => item.slot === slot) ?? EMERGENCY_CONTACT_SLOTS[0];
}

export function createEmptyEmergencyContact(slot: EmergencyContactSlot): EmergencyContact {
  const meta = getSlotMeta(slot);
  return {
    id: '',
    name: '',
    phone: '',
    relation: '',
    slot: meta.slot,
    isPrimary: meta.isPrimary,
    required: meta.required,
  };
}

export function createEmergencyContactDrafts(contacts: EmergencyContact[] = []): EmergencyContact[] {
  const normalized = normalizeEmergencyContacts(contacts, { includeEmptySlots: false });
  const bySlot = new Map(normalized.map((contact) => [contact.slot ?? 'primary-caregiver', contact]));

  return EMERGENCY_CONTACT_SLOTS.map((item) => bySlot.get(item.slot) ?? createEmptyEmergencyContact(item.slot));
}

export function normalizeEmergencyContacts(
  contacts: EmergencyContact[] = [],
  options: { includeEmptySlots?: boolean } = {}
): EmergencyContact[] {
  const includeEmptySlots = options.includeEmptySlots ?? false;
  const output = new Map<EmergencyContactSlot, EmergencyContact>();

  contacts.forEach((contact, index) => {
    const slot = contact.slot ?? getFallbackSlot(index);
    const meta = getSlotMeta(slot);
    output.set(slot, {
      id: contact.id || `${slot}-${index}`,
      name: contact.name ?? '',
      phone: contact.phone ?? '',
      relation: contact.relation ?? '',
      slot,
      isPrimary: contact.isPrimary ?? meta.isPrimary,
      required: contact.required ?? meta.required,
    });
  });

  if (!includeEmptySlots) {
    return EMERGENCY_CONTACT_SLOTS.map((item) => output.get(item.slot)).filter(
      (contact): contact is EmergencyContact =>
        Boolean(contact && (contact.name.trim() || contact.phone.trim() || contact.relation.trim()))
    );
  }

  return EMERGENCY_CONTACT_SLOTS.map((item) => output.get(item.slot) ?? createEmptyEmergencyContact(item.slot));
}

export function getEmergencyContactSlotLabel(slot?: EmergencyContactSlot): string {
  return EMERGENCY_CONTACT_SLOTS.find((item) => item.slot === slot)?.label ?? 'Contact';
}
