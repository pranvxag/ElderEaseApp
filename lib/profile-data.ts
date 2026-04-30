import { db } from '@/lib/firebase';
import { EmergencyContact, Medicine, PreferredLanguage, UserProfile } from '@/types/user';
import { doc, getDoc, setDoc } from 'firebase/firestore';

export type FirestoreProfileData = {
  uid: string;
  displayName: string;
  email: string;
  phoneNumber: string;
  phoneVerified: boolean;
  photoURL?: string;
  preferredLanguage: PreferredLanguage;
  bloodGroup: string;
  medicines: Medicine[];
  emergencyContacts: EmergencyContact[];
  createdAt: string;
  updatedAt: string;
};

type ProfileSourceUser = {
  uid: string;
  displayName?: string | null;
  email?: string | null;
  photoURL?: string | null;
};

export function profileDocRef(uid: string) {
  return doc(db, 'users', uid, 'profile', 'data');
}

export function createDefaultProfileData(user: ProfileSourceUser): FirestoreProfileData {
  const now = new Date().toISOString();
  return {
    uid: user.uid,
    displayName: user.displayName || '',
    email: user.email || '',
    phoneNumber: '',
    phoneVerified: false,
    photoURL: user.photoURL || '',
    preferredLanguage: 'en',
    bloodGroup: '',
    medicines: [],
    emergencyContacts: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function toFirestoreProfileData(
  data: Partial<FirestoreProfileData> | Partial<UserProfile>
): Partial<FirestoreProfileData> {
  const out: Partial<FirestoreProfileData> = {};

  if ('uid' in data && data.uid !== undefined) out.uid = data.uid;
  if ('displayName' in data && data.displayName !== undefined) out.displayName = data.displayName;
  if ('email' in data && data.email !== undefined) out.email = data.email;
  if ('phoneNumber' in data && data.phoneNumber !== undefined) out.phoneNumber = data.phoneNumber;
  if ('phoneVerified' in data && data.phoneVerified !== undefined) out.phoneVerified = data.phoneVerified;
  if ('photoURL' in data && data.photoURL !== undefined) out.photoURL = data.photoURL;
  if ('preferredLanguage' in data && data.preferredLanguage !== undefined) out.preferredLanguage = data.preferredLanguage;
  if ('bloodGroup' in data && data.bloodGroup !== undefined) out.bloodGroup = data.bloodGroup;
  if ('medicines' in data && data.medicines !== undefined) out.medicines = data.medicines;
  if ('emergencyContacts' in data && data.emergencyContacts !== undefined) out.emergencyContacts = data.emergencyContacts;
  if ('createdAt' in data && data.createdAt !== undefined) out.createdAt = data.createdAt;
  if ('updatedAt' in data && data.updatedAt !== undefined) out.updatedAt = data.updatedAt;

  return out;
}

export async function ensureProfileData(user: ProfileSourceUser): Promise<FirestoreProfileData> {
  const ref = profileDocRef(user.uid);
  const snapshot = await getDoc(ref);

  if (!snapshot.exists()) {
    const defaultProfile = createDefaultProfileData(user);
    await setDoc(ref, defaultProfile, { merge: true });
    return defaultProfile;
  }

  const data = snapshot.data() as Partial<FirestoreProfileData>;
  const defaults = createDefaultProfileData(user);
  const normalized: FirestoreProfileData = {
    ...defaults,
    ...toFirestoreProfileData(data),
    uid: user.uid,
    displayName: data.displayName ?? defaults.displayName,
    email: data.email ?? defaults.email,
    phoneNumber: data.phoneNumber ?? '',
    phoneVerified: Boolean(data.phoneVerified),
    photoURL: data.photoURL ?? defaults.photoURL,
    preferredLanguage: data.preferredLanguage ?? 'en',
    bloodGroup: data.bloodGroup ?? '',
    medicines: Array.isArray(data.medicines) ? data.medicines : [],
    emergencyContacts: Array.isArray(data.emergencyContacts) ? data.emergencyContacts : [],
    createdAt: data.createdAt ?? defaults.createdAt,
    updatedAt: data.updatedAt ?? defaults.updatedAt,
  };

  await setDoc(ref, toFirestoreProfileData(normalized), { merge: true });
  return normalized;
}

export async function updateProfileData(uid: string, patch: Partial<FirestoreProfileData>) {
  await setDoc(
    profileDocRef(uid),
    {
      ...toFirestoreProfileData(patch),
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );
}