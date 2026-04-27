import { useAuth } from '@/hooks/useAuth';
import { db } from '@/lib/firebase';
import {
    arrayRemove,
    arrayUnion,
    doc,
    getDoc,
    onSnapshot,
    runTransaction,
    updateDoc,
} from 'firebase/firestore';
import { useCallback, useEffect, useState } from 'react';

export type FirestoreMedicine = {
  id: string;
  name: string;
  dosage: string;
  times: string[];
  enabled: boolean;
  frequency?: string;
  time?: string;
  notes?: string;
};

export type NewMedicineInput = {
  id?: string;
  name: string;
  dosage: string;
  times: string[];
  enabled: boolean;
  frequency?: string;
  time?: string;
  notes?: string;
};

function profileDocRef(uid: string) {
  return doc(db, 'users', uid, 'profile', 'data');
}

export async function addMedicine(uid: string, medicine: NewMedicineInput): Promise<FirestoreMedicine> {
  const newMedicine: FirestoreMedicine = {
    id: medicine.id ?? Date.now().toString(),
    name: medicine.name,
    dosage: medicine.dosage,
    times: medicine.times,
    enabled: medicine.enabled,
    frequency: medicine.frequency,
    time: medicine.time,
    notes: medicine.notes,
  };

  await updateDoc(profileDocRef(uid), {
    medicines: arrayUnion(newMedicine),
  });

  return newMedicine;
}

export async function removeMedicine(uid: string, medicineId: string): Promise<void> {
  const ref = profileDocRef(uid);
  const snapshot = await getDoc(ref);
  if (!snapshot.exists()) return;

  const data = snapshot.data() as { medicines?: FirestoreMedicine[] };
  const existing = (data.medicines ?? []).find((item) => item.id === medicineId);
  if (!existing) return;

  await updateDoc(ref, {
    medicines: arrayRemove(existing),
  });
}

export async function updateMedicine(uid: string, updatedMedicine: FirestoreMedicine): Promise<void> {
  const ref = profileDocRef(uid);

  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists()) {
      throw new Error('Profile document does not exist.');
    }

    const data = snapshot.data() as { medicines?: FirestoreMedicine[] };
    const existing = (data.medicines ?? []).find((item) => item.id === updatedMedicine.id);
    if (!existing) {
      throw new Error('Medicine to update not found.');
    }

    transaction.update(ref, {
      medicines: arrayRemove(existing),
    });

    transaction.update(ref, {
      medicines: arrayUnion(updatedMedicine),
    });
  });
}

export function useMedicines() {
  const { user } = useAuth();
  const uid = user?.uid ?? '';

  const [medicines, setMedicines] = useState<FirestoreMedicine[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) {
      setMedicines([]);
      setLoading(false);
      return;
    }

    const unsubscribe = onSnapshot(
      profileDocRef(uid),
      (snapshot) => {
        if (!snapshot.exists()) {
          setMedicines([]);
          setLoading(false);
          return;
        }

        const data = snapshot.data() as { medicines?: FirestoreMedicine[] };
        setMedicines(data.medicines ?? []);
        setLoading(false);
      },
      (error) => {
        console.error('useMedicines onSnapshot error:', error);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [uid]);

  const add = useCallback(
    async (medicine: NewMedicineInput) => {
      if (!uid) throw new Error('No authenticated user.');
      return addMedicine(uid, medicine);
    },
    [uid]
  );

  const remove = useCallback(
    async (medicineId: string) => {
      if (!uid) throw new Error('No authenticated user.');
      return removeMedicine(uid, medicineId);
    },
    [uid]
  );

  const update = useCallback(
    async (medicine: FirestoreMedicine) => {
      if (!uid) throw new Error('No authenticated user.');
      return updateMedicine(uid, medicine);
    },
    [uid]
  );

  return {
    medicines,
    addMedicine: add,
    removeMedicine: remove,
    updateMedicine: update,
    loading,
  };
}
