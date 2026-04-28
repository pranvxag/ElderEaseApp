export const FREQUENCY_OPTIONS = [
  'Once a day',
  'Twice a day',
  'Three times a day',
  'Every 8 hours',
  'Every 12 hours',
  'Weekly',
  'As needed',
];

export const TIME_SLOT_OPTIONS = [
  'Morning (6–9 AM)',
  'Before Lunch (11 AM–12 PM)',
  'After Lunch (1–3 PM)',
  'Evening (5–8 PM)',
  'Night (8–10 PM)',
  'Bedtime (9 PM+)',
];

const TIME_SLOT_TO_REMINDER: Record<string, string> = {
  'Morning (6–9 AM)': '8:00 AM',
  'Before Lunch (11 AM–12 PM)': '11:30 AM',
  'After Lunch (1–3 PM)': '1:30 PM',
  'Evening (5–8 PM)': '6:00 PM',
  'Night (8–10 PM)': '8:30 PM',
  'Bedtime (9 PM+)': '9:00 PM',
};

const DEFAULT_SLOTS_BY_FREQUENCY: Record<string, string[]> = {
  'Once a day': ['Morning (6–9 AM)'],
  'Twice a day': ['Morning (6–9 AM)', 'Evening (5–8 PM)'],
  'Three times a day': ['Morning (6–9 AM)', 'After Lunch (1–3 PM)', 'Evening (5–8 PM)'],
  'Every 8 hours': ['Morning (6–9 AM)', 'After Lunch (1–3 PM)', 'Night (8–10 PM)'],
  'Every 12 hours': ['Morning (6–9 AM)', 'Evening (5–8 PM)'],
  Weekly: ['Morning (6–9 AM)'],
  'As needed': ['Morning (6–9 AM)'],
};

export function getDefaultTimeSlots(frequency?: string): string[] {
  if (!frequency) return ['Morning (6–9 AM)'];
  return DEFAULT_SLOTS_BY_FREQUENCY[frequency] ?? ['Morning (6–9 AM)'];
}

export function getRequiredSlotCount(frequency?: string): number {
  if (frequency === 'Twice a day' || frequency === 'Every 12 hours') return 2;
  if (frequency === 'Three times a day' || frequency === 'Every 8 hours') return 3;
  return 1;
}

export function normalizeTimeSlots(times: string[] | undefined, frequency?: string): string[] {
  const cleaned = (times ?? []).map((item) => item.trim()).filter(Boolean);
  if (cleaned.length > 0) {
    return Array.from(new Set(cleaned));
  }
  return getDefaultTimeSlots(frequency);
}

export function slotToReminderTime(slot: string): string {
  return TIME_SLOT_TO_REMINDER[slot] ?? slot;
}

export function formatTimeSlots(times: string[] | undefined): string {
  const slots = (times ?? []).map((slot) => slotToReminderTime(slot));
  return slots.length > 0 ? slots.join(' • ') : '9:00 AM';
}

export function formatMedicationScheduleSummary(
  frequency?: string,
  times?: string[]
): string {
  const slotSummary = formatTimeSlots(times);
  const timeCount = times?.length ?? 0;

  if (frequency === 'weekly' || frequency === 'Weekly') {
    return `Weekly • ${slotSummary}`;
  }

  if (frequency === 'as-needed' || frequency === 'As needed') {
    return `As needed • ${slotSummary}`;
  }

  if (frequency === 'twice-daily' || frequency === 'Twice a day' || timeCount === 2) {
    return `2x daily • ${slotSummary}`;
  }

  if (frequency === 'Three times a day' || timeCount === 3) {
    return `3x daily • ${slotSummary}`;
  }

  if (frequency === 'Every 8 hours') {
    return `3x daily • ${slotSummary}`;
  }

  if (frequency === 'Every 12 hours') {
    return `2x daily • ${slotSummary}`;
  }

  return `Daily • ${slotSummary}`;
}