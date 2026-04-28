// Shared types for ElderEase

export type MedStatus = 'upcoming' | 'taken' | 'missed' | 'skipped';
export type MedFrequency = 'daily' | 'twice-daily' | 'weekly' | 'as-needed';

export interface Medication {
  id: string;
  name: string;
  dosage: string;
  time: string; // "09:00 AM"
  frequency: MedFrequency;
  color: string; // pill color for visual
  status: MedStatus;
  purpose: string; // "For blood pressure"
  streak: number; // days taken in a row
  instructions?: string;
  createdAt?: string;
  durationDays?: number;
  expiresAt?: string;
}

export interface UserProfile {
  name: string;
  caregiverName: string;
  caregiverPhone: string;
  remindersEnabled: boolean;
  reminderLeadMinutes: number;
  voiceConsent?: boolean;
}

export const DEFAULT_USER_PROFILE: UserProfile = {
  name: 'Mr. Singh',
  caregiverName: 'Priya Singh',
  caregiverPhone: '+91 98765 43210',
  remindersEnabled: true,
  reminderLeadMinutes: 30,
  voiceConsent: false,
};

export interface BloodSugarEntry {
  id: string;
  value: number;
  unit: 'mg/dL' | 'mmol/L';
  timestamp: string; // ISO
  source?: 'ai-call' | 'manual' | 'device';
  transcript?: string;
  note?: string;
}

export interface RoutineItem {
  id: string;
  label: string;
  icon: string;
  target: string;
  unit: string;
  current: number;
  max: number;
  done: boolean;
  color: string;
}

export interface EmergencyContact {
  id: string;
  name: string;
  relation: string;
  phone: string;
  isPrimary: boolean;
  initials: string;
  color: string;
}

// ── Mock Data ──────────────────────────────────────────────

export const MOCK_MEDICATIONS: Medication[] = [
  {
    id: '1',
    name: 'Aspirin',
    dosage: '75mg — 1 tablet',
    time: '9:00 AM',
    frequency: 'daily',
    color: '#FF6B6B',
    status: 'taken',
    purpose: 'Heart protection',
    streak: 12,
    instructions: 'Take after breakfast with a full glass of water',
  },
  {
    id: '2',
    name: 'Metformin',
    dosage: '500mg — 1 tablet',
    time: '1:00 PM',
    frequency: 'twice-daily',
    color: '#4ECDC4',
    status: 'upcoming',
    purpose: 'Blood sugar control',
    streak: 8,
    instructions: 'Take with lunch to avoid stomach upset',
  },
  {
    id: '3',
    name: 'Amlodipine',
    dosage: '5mg — 1 tablet',
    time: '8:00 PM',
    frequency: 'daily',
    color: '#A78BFA',
    status: 'upcoming',
    purpose: 'Blood pressure',
    streak: 20,
    instructions: 'Can be taken with or without food',
  },
  {
    id: '4',
    name: 'Vitamin D3',
    dosage: '1000 IU — 1 capsule',
    time: '9:00 AM',
    frequency: 'daily',
    color: '#FCD34D',
    status: 'taken',
    purpose: 'Bone health',
    streak: 5,
  },
];

export const MOCK_ROUTINE: RoutineItem[] = [
  {
    id: 'meds',
    label: 'Medications',
    icon: 'medical',
    target: 'All doses taken',
    unit: 'doses',
    current: 2,
    max: 4,
    done: false,
    color: '#1A7A6E',
  },
  {
    id: 'water',
    label: 'Water Intake',
    icon: 'water',
    target: '8 glasses',
    unit: 'glasses',
    current: 5,
    max: 8,
    done: false,
    color: '#3B82F6',
  },
  {
    id: 'breakfast',
    label: 'Breakfast',
    icon: 'cafe',
    target: 'Before 9 AM',
    unit: '',
    current: 1,
    max: 1,
    done: true,
    color: '#F59E0B',
  },
  {
    id: 'lunch',
    label: 'Lunch',
    icon: 'restaurant',
    target: 'Between 12–2 PM',
    unit: '',
    current: 1,
    max: 1,
    done: true,
    color: '#10B981',
  },
  {
    id: 'dinner',
    label: 'Dinner',
    icon: 'moon',
    target: 'Between 7–8 PM',
    unit: '',
    current: 0,
    max: 1,
    done: false,
    color: '#6366F1',
  },
  {
    id: 'walk',
    label: 'Morning Walk',
    icon: 'walk',
    target: '30 minutes',
    unit: 'min',
    current: 20,
    max: 30,
    done: false,
    color: '#EF4444',
  },
  {
    id: 'sleep',
    label: 'Sleep',
    icon: 'bed',
    target: '7–8 hours last night',
    unit: 'hrs',
    current: 7,
    max: 8,
    done: true,
    color: '#8B5CF6',
  },
];

export const MOCK_CONTACTS: EmergencyContact[] = [
  {
    id: '1',
    name: 'Priya Singh',
    relation: 'Daughter',
    phone: '+91 98765 43210',
    isPrimary: true,
    initials: 'PS',
    color: '#1A7A6E',
  },
  {
    id: '2',
    name: 'Rakesh Singh',
    relation: 'Son',
    phone: '+91 87654 32109',
    isPrimary: false,
    initials: 'RS',
    color: '#3B82F6',
  },
  {
    id: '3',
    name: 'Dr. Meera Joshi',
    relation: 'Family Doctor',
    phone: '+91 76543 21098',
    isPrimary: false,
    initials: 'MJ',
    color: '#8B5CF6',
  },
  {
    id: '4',
    name: 'Sunita (Neighbor)',
    relation: 'Neighbour',
    phone: '+91 65432 10987',
    isPrimary: false,
    initials: 'SN',
    color: '#F59E0B',
  },
];

export const HEALTH_TIPS = [
  {
    id: '1',
    tip: 'Drink a glass of warm water first thing in the morning to kickstart digestion.',
    category: 'Hydration',
    icon: 'water-outline',
    color: '#3B82F6',
  },
  {
    id: '2',
    tip: 'A 30-minute morning walk helps control blood pressure and lifts your mood naturally.',
    category: 'Exercise',
    icon: 'walk-outline',
    color: '#10B981',
  },
  {
    id: '3',
    tip: 'Never skip your morning medication — taking it at the same time daily improves effectiveness.',
    category: 'Medication',
    icon: 'medical-outline',
    color: '#1A7A6E',
  },
  {
    id: '4',
    tip: 'Limit salt intake to less than 5 grams per day to help maintain a healthy blood pressure.',
    category: 'Nutrition',
    icon: 'nutrition-outline',
    color: '#F59E0B',
  },
];