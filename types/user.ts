export type EmergencyContact = {
  id: string;
  name: string;
  phone: string;
  relation: string;
};

export type Medicine = {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
  time?: string;
  notes?: string;
};

export type UserProfile = {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string;
  age?: string;
  bloodGroup?: string;
  allergies?: string;
  emergencyContacts: EmergencyContact[];
  medicines: Medicine[];
  createdAt: string;
  updatedAt: string;
};
