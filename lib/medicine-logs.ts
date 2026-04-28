import { cleanForFirestore, db, hasFirebaseConfig } from '@/lib/firebase';
import { arrayUnion, doc, getDoc, onSnapshot, setDoc } from 'firebase/firestore';
import { Medication } from '../constants/data';

export type MedicineLogStatus = 'pending' | 'taken' | 'not_taken' | 'snoozed';

export type MedicineLogEntry = {
  id: string;
  medicineId: string;
  medicineName: string;
  scheduledTime: string;
  takenAt: string | null;
  status: MedicineLogStatus;
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

function createEntryId(dateKey: string, medicineId: string): string {
  return `${dateKey}:${medicineId}`;
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
        'scheduledTime' in entry &&
        'status' in entry
    );
  });
}

function buildPendingEntry(medicine: Pick<Medication, 'id' | 'name' | 'time' | 'times'>, dateKey: string): MedicineLogEntry {
  return {
    id: createEntryId(dateKey, medicine.id),
    medicineId: medicine.id,
    medicineName: medicine.name,
    scheduledTime: getScheduledTime(medicine),
    takenAt: null,
    status: 'pending',
  };
}

export async function ensureDailyMedicineLogs(
  uid: string,
  medicines: Array<Pick<Medication, 'id' | 'name' | 'time' | 'times'>>,
  dateKey = getLocalDateKey()
): Promise<MedicineLogEntry[]> {
  if (!hasFirebaseConfig || !uid) return [];

  const ref = dayLogDocRef(uid, dateKey);
  const snapshot = await getDoc(ref);
  const existingEntries = normalizeEntries(snapshot.data()?.entries);
  const existingIds = new Set(existingEntries.map((entry) => entry.id));
  const missingEntries = medicines
    .map((medicine) => buildPendingEntry(medicine, dateKey))
    .filter((entry) => !existingIds.has(entry.id));

  if (missingEntries.length > 0) {
    const cleaned = missingEntries.map((e) => cleanForFirestore(e));
    await setDoc(
      ref,
      {
        date: dateKey,
        updatedAt: new Date().toISOString(),
        entries: arrayUnion(...(cleaned as any)),
      },
      { merge: true }
    );
  } else if (!snapshot.exists()) {
    await setDoc(
      ref,
      {
        date: dateKey,
        updatedAt: new Date().toISOString(),
        entries: [],
      },
      { merge: true }
    );
  }

  return [...existingEntries, ...missingEntries];
}

export async function appendMedicineLog(
  uid: string,
  payload: Omit<MedicineLogEntry, 'id'> & { dateKey?: string }
): Promise<void> {
  if (!hasFirebaseConfig || !uid) return;

  const takenAt = payload.takenAt ?? (payload.status === 'pending' ? null : new Date().toISOString());
  const dateKey = payload.dateKey ?? getLocalDateKey(takenAt ? new Date(takenAt) : new Date());
  const entry: MedicineLogEntry = {
    id: createEntryId(dateKey, payload.medicineId),
    medicineId: payload.medicineId,
    medicineName: payload.medicineName,
    scheduledTime: payload.scheduledTime,
    takenAt,
    status: payload.status,
  };

  const ref = dayLogDocRef(uid, dateKey);
  const snapshot = await getDoc(ref);
  const existingEntries = normalizeEntries(snapshot.data()?.entries);
  const index = existingEntries.findIndex((item) => item.id === entry.id);

  if (index === -1) {
    await setDoc(
      ref,
      {
        date: dateKey,
        updatedAt: takenAt ?? new Date().toISOString(),
        entries: arrayUnion(cleanForFirestore(entry) as any),
      },
      { merge: true }
    );
    return;
  }

  const nextEntries = [...existingEntries];
  nextEntries[index] = entry;
  await setDoc(
    ref,
    {
      date: dateKey,
      updatedAt: takenAt ?? new Date().toISOString(),
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
    onChange({
      date: dateKey,
      updatedAt: data?.updatedAt,
      entries: normalizeEntries(data?.entries),
    });
  });
}
