import { cleanForFirestore, db, hasFirebaseConfig } from '@/lib/firebase';
import { doc, getDoc, onSnapshot, setDoc } from 'firebase/firestore';
import { Medication } from '../constants/data';

export type MedicineLogStatus = 'pending' | 'taken' | 'not_taken' | 'snoozed';

export type MedicineLogEntry = {
  id: string;
  medicineId: string;
  medicineName: string;
  dosage: string;
  doseIndex: number; // 0 for first dose, 1 for second dose etc
  scheduledTime: string; // e.g. "8:00 AM"
  reminderTime: string; // e.g. "08:00" in 24hr format
  frequency: string; // e.g. "Once a day", "Twice a day"
  durationDays: number; // default 15 if not specified
  status: MedicineLogStatus;
  updatedAt: string | null;
  notes: string | null;
};

export type MedicineLogDay = {
  date: string;
  updatedAt?: string;
  entries: MedicineLogEntry[];
};

function toDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getLocalDateKey(date = new Date()): string {
  return toDateKey(date);
}

export function getRecentMedicineLogDates(days = 7, endDate = new Date()): string[] {
  const keys: string[] = [];
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date(endDate);
    date.setDate(date.getDate() - offset);
    keys.push(toDateKey(date));
  }
  return keys;
}

function dayLogDocRef(uid: string, dateKey = getLocalDateKey()): ReturnType<typeof doc> {
  return doc(db, 'users', uid, 'medicinelogs', dateKey);
}

function createEntryId(dateKey: string, medicineId: string, doseIndex = 0): string {
  // New id format: {date}_{medicineId}_{doseIndex}
  return `${dateKey}_${medicineId}_${doseIndex}`;
}

function getScheduledTime(medicine: Pick<Medication, 'time' | 'times'>): string {
  return medicine.time || medicine.times?.[0] || '9:00 AM';
}

function normalizeEntries(entries: unknown): MedicineLogEntry[] {
  if (!Array.isArray(entries)) return [];
  return entries.filter((entry): entry is MedicineLogEntry => {
    return Boolean(
      entry &&
        typeof entry === 'object' &&
        'id' in entry &&
        'medicineId' in entry &&
        'medicineName' in entry &&
        'dosage' in entry &&
        'scheduledTime' in entry &&
        'reminderTime' in entry &&
        'frequency' in entry &&
        'durationDays' in entry &&
        'status' in entry &&
        'doseIndex' in entry
    );
  });
}

function buildPendingEntry(
  medicine: Pick<Medication, 'id' | 'name' | 'time' | 'times'>,
  dateKey: string,
  doseIndex: number,
  scheduledTime: string
): MedicineLogEntry {
  return {
    id: createEntryId(dateKey, medicine.id, doseIndex),
    medicineId: medicine.id,
    medicineName: medicine.name,
    dosage: '',
    doseIndex,
    scheduledTime,
    reminderTime: timeToReminderTime(scheduledTime),
    frequency: 'daily',
    durationDays: 15,
    status: 'pending',
    updatedAt: null,
    notes: null,
  };
}

// New helper: writeMedicineLogs(uid, medicine, dates[])
export async function writeMedicineLogs(
  uid: string,
  medicine: Pick<Medication, 'id' | 'name' | 'time' | 'times' | 'durationDays'>,
  dates: string[]
): Promise<void> {
  if (!hasFirebaseConfig || !uid) return;

  // convert slot labels to reminder times
  // note: import slotToReminderTime dynamically to avoid cycles
  const { slotToReminderTime } = await import('@/lib/medicine');

  for (const dateKey of dates) {
    const ref = dayLogDocRef(uid, dateKey);
    const snapshot = await getDoc(ref);
    const existingEntries = normalizeEntries(snapshot.data()?.entries);
    const existingIds = new Set(existingEntries.map((e) => e.id));

    const times = medicine.times?.length ? medicine.times : [medicine.time || '9:00 AM'];

    // Safety: if all expected entries for this medicine already exist for this date, skip
    const expectedCount = medicine.times?.length ?? 1;
    const existingForThisMed = existingEntries.filter((e) => e.medicineId === medicine.id);
    if (existingForThisMed.length >= expectedCount) continue;

    const newEntries: MedicineLogEntry[] = times
      .map((t, doseIndex) => {
        const scheduledTime = slotToReminderTime(t || medicine.time || '9:00 AM');
        const id = createEntryId(dateKey, medicine.id, doseIndex);
        if (existingIds.has(id)) return null;
        return {
          id,
          medicineId: medicine.id,
          medicineName: medicine.name,
          doseIndex,
          scheduledTime,
          status: 'pending',
          updatedAt: null,
        } as MedicineLogEntry;
      })
      .filter((v): v is MedicineLogEntry => Boolean(v));

    if (newEntries.length === 0) continue;

    await setDoc(
      ref,
      {
        date: dateKey,
        entries: [...existingEntries, ...newEntries].map((e) => cleanForFirestore(e) as any),
      },
      { merge: true }
    );
  }
}

export async function appendMedicineLog(
  uid: string,
  payload: {
    medicineId: string | undefined;
    medicineName: string;
    scheduledTime: string;
    doseIndex?: number;
    status: MedicineLogStatus;
    updatedAt?: string | null;
    takenAt?: string | null; // legacy
    dateKey?: string;
    // Allow partial updates for other fields
    [key: string]: any;
  }
): Promise<void> {
  if (!hasFirebaseConfig || !uid) return;

  // accept legacy `takenAt` in payload but store as `updatedAt` per new schema
  const updatedAt = payload.updatedAt ?? payload.takenAt ?? (payload.status === 'pending' ? null : new Date().toISOString());
  const dateKey = payload.dateKey ?? getLocalDateKey(updatedAt ? new Date(updatedAt) : new Date());
  const doseIndex = payload.doseIndex ?? 0;
  
  const entry: Partial<MedicineLogEntry> = {
    medicineId: payload.medicineId,
    medicineName: payload.medicineName,
    scheduledTime: payload.scheduledTime,
    doseIndex,
    status: payload.status,
    updatedAt: updatedAt ?? null,
  };

  const ref = dayLogDocRef(uid, dateKey);
  const snapshot = await getDoc(ref);
  const existingEntries = normalizeEntries(snapshot.data()?.entries);
  const medicineId = payload.medicineId;
  if (!medicineId) return;
  const entryId = createEntryId(dateKey, medicineId, doseIndex);
  const index = existingEntries.findIndex((item) => item.id === entryId);

  if (index === -1) {
    // Entry doesn't exist, skip (shouldn't happen in normal flow)
    return;
  }

  const nextEntries = [...existingEntries];
  nextEntries[index] = { ...nextEntries[index], ...entry };
  await setDoc(
    ref,
    {
      date: dateKey,
      entries: nextEntries.map((e) => cleanForFirestore(e) as any),
    },
    { merge: true }
  );
}

export async function getMedicineLogsForDate(uid: string, dateKey = getLocalDateKey()): Promise<MedicineLogDay | null> {
  if (!hasFirebaseConfig || !uid) return null;

  const snapshot = await getDoc(dayLogDocRef(uid, dateKey));
  if (!snapshot.exists()) {
    return { date: dateKey, entries: [] };
  }

  const data = snapshot.data();
  return {
    date: dateKey,
    updatedAt: data?.updatedAt,
    entries: normalizeEntries(data?.entries),
  };
}

export async function getRecentMedicineLogs(uid: string, days = 7): Promise<MedicineLogDay[]> {
  if (!hasFirebaseConfig || !uid) return [];

  const dateKeys = getRecentMedicineLogDates(days);
  const logs = await Promise.all(dateKeys.map(async (dateKey) => getMedicineLogsForDate(uid, dateKey)));
  return logs.filter((item): item is MedicineLogDay => Boolean(item));
}

export function subscribeToMedicineLogDate(
  uid: string,
  dateKey: string,
  onChange: (day: MedicineLogDay) => void
): () => void {
  if (!hasFirebaseConfig || !uid) {
    onChange({ date: dateKey, entries: [] });
    return () => undefined;
  }

  return onSnapshot(dayLogDocRef(uid, dateKey), (snapshot) => {
    const data = snapshot.data();
    const entries = data?.entries ?? [];
    if (!Array.isArray(entries)) return;
    onChange({
      date: dateKey,
      updatedAt: data?.updatedAt,
      entries: normalizeEntries(entries),
    });
  });
}

export async function ensureMedicineLogsForDuration(
  uid: string,
  medicine: Pick<Medication, 'id' | 'name' | 'time' | 'times' | 'durationDays'>,
  startDateKey: string
): Promise<void> {
  if (!hasFirebaseConfig || !uid) return;
  const days = medicine.durationDays ?? 1;
  const startDate = new Date(startDateKey);
  const dates: string[] = [];
  for (let i = 0; i < days; i++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);
    dates.push(toDateKey(date));
  }
  await writeMedicineLogs(uid, medicine, dates);
}

export async function deleteMedicineFromFutureLogs(
  uid: string,
  medicineId: string,
  fromDateKey: string
): Promise<void> {
  if (!hasFirebaseConfig || !uid) return;
  const today = new Date(fromDateKey);
  for (let i = 0; i < 90; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() + i);
    const dateKey = toDateKey(date);
    const ref = dayLogDocRef(uid, dateKey);
    const snapshot = await getDoc(ref);
    if (!snapshot.exists()) continue;

    const entries = normalizeEntries(snapshot.data()?.entries);
    const filtered = entries.filter((e) => e.medicineId !== medicineId);

    if (filtered.length !== entries.length) {
      await setDoc(
        ref,
        {
          date: dateKey,
          updatedAt: new Date().toISOString(),
          entries: filtered.map((e) => cleanForFirestore(e)),
        },
        { merge: true }
      );
    } else {
      continue; // No entry this day, keep checking future dates
    }
  }
}

// ========== NEW FUNCTIONS FOR MEDICINELOGS AS SOT ==========

/**
 * Convert 12-hour time string (e.g. "8:00 AM") to 24-hour format (e.g. "08:00")
 */
function timeToReminderTime(timeStr: string): string {
  const [time, period] = timeStr.split(' ');
  let [h, m] = time.split(':').map(Number);
  if (period === 'PM' && h !== 12) h += 12;
  if (period === 'AM' && h === 12) h = 0;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Convert 12-hour time string to minutes since midnight for sorting.
 * Used to order medicines by scheduled time.
 */
export function timeToMinutes(timeStr: string): number {
  const [time, period] = timeStr.split(' ');
  let [h, m] = time.split(':').map(Number);
  if (period === 'PM' && h !== 12) h += 12;
  if (period === 'AM' && h === 12) h = 0;
  return h * 60 + m;
}

/**
 * Add a new medicine to the logs for the specified duration.
 * Generates a single medicineId and creates entries for all days and times.
 */
export async function addMedicineToLogs(
  uid: string,
  medicineData: {
    name: string;
    dosage: string;
    times: string[]; // array of times e.g. ["8:00 AM", "8:00 PM"]
    frequency: string; // e.g. "Once a day", "Twice a day"
    notes: string | null;
    reminderTime: string; // primary reminder time
  },
  durationDays: number = 15
): Promise<string> {
  console.log('addMedicineToLogs called:', { uid, durationDays, name: medicineData?.name, times: medicineData?.times });
  if (!hasFirebaseConfig || !uid) return '';

  const medicineId = Date.now().toString();
  const now = new Date();
  const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  console.log('Writing medicine logs starting from:', todayKey);

  for (let i = 0; i < durationDays; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() + i);
    const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const ref = dayLogDocRef(uid, dateKey);

    const snapshot = await getDoc(ref);
    const existingEntries = normalizeEntries(snapshot.data()?.entries);

    // Create entry for each time (dose)
    const newEntries: MedicineLogEntry[] = medicineData.times.map((time, doseIndex) => ({
      id: createEntryId(dateKey, medicineId, doseIndex),
      medicineId,
      medicineName: medicineData.name,
      dosage: medicineData.dosage,
      doseIndex,
      scheduledTime: time,
      reminderTime: to24Hr(time),
      frequency: medicineData.frequency,
      durationDays,
      status: 'pending',
      updatedAt: null,
      notes: medicineData.notes,
    }));

    // Check if entries already exist, skip if they do
    const idsToAdd = new Set(newEntries.map((e) => e.id));
    const existingIds = new Set(existingEntries.map((e) => e.id));
    const entriesNotYetAdded = newEntries.filter((e) => !existingIds.has(e.id));

    if (entriesNotYetAdded.length > 0) {
      await setDoc(
        ref,
        {
          date: dateKey,
          entries: [...existingEntries, ...entriesNotYetAdded].map((e) => cleanForFirestore(e) as any),
        },
        { merge: true }
      );
    }
  }

  return medicineId;
}

function to24Hr(timeStr: string): string {
  const [time, period] = timeStr.split(' ');
  let [hours, minutes] = time.split(':').map(Number);
  if (period === 'PM' && hours !== 12) hours += 12;
  if (period === 'AM' && hours === 12) hours = 0;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/**
 * Get today's medicines by reading the medicinelogs/{today} doc
 */
export async function getTodayMedicines(uid: string): Promise<MedicineLogEntry[]> {
  if (!hasFirebaseConfig || !uid) return [];

  const today = getLocalDateKey();
  const snapshot = await getDoc(dayLogDocRef(uid, today));
  if (!snapshot.exists()) return [];

  return normalizeEntries(snapshot.data()?.entries);
}

