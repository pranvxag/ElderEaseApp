import { Colors, FontSizes, FontWeights, Radii, Shadows, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { FirestoreMedicine, useMedicines } from '@/hooks/useMedicines';
import { useUserProfile } from '@/hooks/useUserProfile';
import { EmergencyContact, LANGUAGE_OPTIONS, Medicine, PreferredLanguage } from '@/types/user';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'] as const;

const AGE_OPTIONS = Array.from({ length: 83 }, (_, i) => String(i + 18));

const RELATION_OPTIONS = [
  'Son', 'Daughter', 'Spouse', 'Brother', 'Sister',
  'Father', 'Mother', 'Friend', 'Neighbour', 'Caretaker', 'Other',
];

const FREQUENCY_OPTIONS = [
  'Once a day', 'Twice a day', 'Three times a day',
  'Every 8 hours', 'Every 12 hours', 'Weekly', 'As needed',
];

const TIME_OPTIONS = [
  'Morning (6–9 AM)', 'Mid-morning (9–12 PM)', 'Afternoon (12–3 PM)',
  'Evening (3–6 PM)', 'Night (6–9 PM)', 'Bedtime (9 PM+)',
];

const createId = () => Date.now().toString() + Math.random().toString(36).slice(2);

function toProfileMedicine(med: FirestoreMedicine): Medicine {
  return {
    id: med.id,
    name: med.name,
    dosage: med.dosage,
    frequency: med.frequency || 'Once a day',
    time: med.time || med.times?.[0] || undefined,
    notes: med.notes,
  };
}

function toCloudMedicine(med: Medicine): FirestoreMedicine {
  const trimmedTime = med.time?.trim();
  return {
    id: med.id,
    name: med.name,
    dosage: med.dosage,
    times: trimmedTime ? [trimmedTime] : [],
    enabled: true,
    frequency: med.frequency,
    time: trimmedTime,
    notes: med.notes,
  };
}

// ─── Reusable Dropdown ────────────────────────────────────────────────────────
function Dropdown({
  label,
  value,
  options,
  onSelect,
  placeholder = 'Select…',
}: {
  label: string;
  value: string;
  options: string[];
  onSelect: (v: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <View style={{ marginBottom: Spacing.md }}>
      <Text style={dd.label}>{label}</Text>
      <TouchableOpacity style={dd.trigger} onPress={() => setOpen(true)} activeOpacity={0.8}>
        <Text style={value ? dd.triggerText : dd.placeholder}>
          {value || placeholder}
        </Text>
        <Text style={dd.arrow}>▾</Text>
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={dd.backdrop} activeOpacity={1} onPress={() => setOpen(false)}>
          <View style={dd.sheet}>
            <Text style={dd.sheetTitle}>{label}</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {options.map((opt) => (
                <TouchableOpacity
                  key={opt}
                  style={[dd.option, value === opt && dd.optionActive]}
                  onPress={() => { onSelect(opt); setOpen(false); }}
                >
                  <Text style={[dd.optionText, value === opt && dd.optionTextActive]}>{opt}</Text>
                  {value === opt && <Text style={dd.check}>✓</Text>}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const dd = StyleSheet.create({
  label:            { fontSize: FontSizes.sm, color: Colors.textSecondary, marginBottom: Spacing.xs },
  trigger: {
    backgroundColor: Colors.cardBg, borderRadius: Radii.lg,
    padding: Spacing.md, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  triggerText:      { color: Colors.textPrimary, fontSize: FontSizes.md },
  placeholder:      { color: Colors.textMuted, fontSize: FontSizes.md },
  arrow:            { color: Colors.textMuted, fontSize: 14 },
  backdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.cardBg, borderTopLeftRadius: Radii.xl,
    borderTopRightRadius: Radii.xl, padding: Spacing.lg, maxHeight: '60%',
  },
  sheetTitle:       { color: Colors.textPrimary, fontSize: FontSizes.md, fontWeight: FontWeights.bold, marginBottom: Spacing.md },
  option: {
    paddingVertical: Spacing.sm + 2, paddingHorizontal: Spacing.sm,
    borderRadius: Radii.md, flexDirection: 'row',
    justifyContent: 'space-between', alignItems: 'center', marginBottom: 2,
  },
  optionActive:     { backgroundColor: Colors.primary + '22' },
  optionText:       { color: Colors.textPrimary, fontSize: FontSizes.md },
  optionTextActive: { color: Colors.primary, fontWeight: FontWeights.bold },
  check:            { color: Colors.primary, fontWeight: FontWeights.bold },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function EditProfileScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { profile, loading, saveProfile, updateEmergencyContacts, updateMedicines } = useUserProfile();
  const {
    medicines: cloudMedicines,
    addMedicine: addCloudMedicine,
    removeMedicine: removeCloudMedicine,
    updateMedicine: updateCloudMedicine,
    loading: cloudMedicinesLoading,
  } = useMedicines();
  const [formInitialized, setFormInitialized] = useState(false);

  const [displayName, setDisplayName]             = useState('');
  const [age, setAge]                             = useState('');
  const [bloodGroup, setBloodGroup]               = useState('');
  const [allergies, setAllergies]                 = useState('');
  const [preferredLanguage, setPreferredLanguage] = useState<PreferredLanguage>('en');
  const [medicines, setMedicines]                 = useState<Medicine[]>([]);
  const [contacts, setContacts]                   = useState<EmergencyContact[]>([]);

  const [newMedicine, setNewMedicine]   = useState<Medicine>({ id: '', name: '', dosage: '', frequency: '', time: '', notes: '' });
  const [addingMedicine, setAddingMedicine] = useState(false);
  const [newContact, setNewContact]     = useState<EmergencyContact>({ id: '', name: '', phone: '', relation: '' });
  const [addingContact, setAddingContact]   = useState(false);

  useEffect(() => {
    if (loading || !user || formInitialized || cloudMedicinesLoading) return;
    setDisplayName(profile?.displayName || user.displayName || '');
    setAge(profile?.age || '');
    setBloodGroup(profile?.bloodGroup || '');
    setAllergies(profile?.allergies || '');
    setPreferredLanguage(profile?.preferredLanguage || 'en');
    const initialMedicines = cloudMedicines.length > 0
      ? cloudMedicines.map(toProfileMedicine)
      : (profile?.medicines || []);
    setMedicines(initialMedicines);
    setContacts(profile?.emergencyContacts || []);
    setFormInitialized(true);
  }, [cloudMedicines, cloudMedicinesLoading, formInitialized, loading, profile, user]);

  useEffect(() => {
    setFormInitialized(false);
  }, [user?.uid]);

  if (loading || !user) return null;

  const addMedicine = async () => {
    if (!newMedicine.name.trim() || !newMedicine.dosage.trim() || !newMedicine.frequency.trim()) {
      Alert.alert('Missing medicine info', 'Please fill medicine name, dosage, and frequency.');
      return;
    }
    try {
      const generatedId = createId();
      const cloudMedicine = await addCloudMedicine({
        id: generatedId,
        name: newMedicine.name.trim(),
        dosage: newMedicine.dosage.trim(),
        times: newMedicine.time?.trim() ? [newMedicine.time.trim()] : [],
        enabled: true,
        frequency: newMedicine.frequency.trim(),
        time: newMedicine.time?.trim() || undefined,
        notes: newMedicine.notes?.trim() || undefined,
      });

      const nextMedicines = [...medicines, toProfileMedicine(cloudMedicine)];
      setMedicines(nextMedicines);
      await updateMedicines(nextMedicines);
      setNewMedicine({ id: '', name: '', dosage: '', frequency: '', time: '', notes: '' });
      setAddingMedicine(false);
    } catch (error) {
      console.error('Medicine save failed:', error);
      Alert.alert('Save failed', 'Could not save medicine. Please try again.');
    }
  };

  const handleLanguageSelect = async (lang: PreferredLanguage) => {
    setPreferredLanguage(lang);
    await saveProfile({ preferredLanguage: lang });
  };

  const addContact = () => {
    if (!newContact.name.trim() || !newContact.phone.trim() || !newContact.relation.trim()) {
      Alert.alert('Missing contact info', 'Please fill contact name, phone, and relation.');
      return;
    }
    setContacts(prev => [...prev, {
      id: createId(),
      name: newContact.name.trim(),
      phone: newContact.phone.trim(),
      relation: newContact.relation.trim(),
    }]);
    setNewContact({ id: '', name: '', phone: '', relation: '' });
    setAddingContact(false);
  };

  const saveChanges = async () => {
    if (!displayName.trim()) {
      Alert.alert('Missing name', 'Please enter your name.');
      return;
    }
    try {
      const localCloudMeds = medicines.map(toCloudMedicine);
      const localIds = new Set(localCloudMeds.map((med) => med.id));
      const cloudById = new Map(cloudMedicines.map((med) => [med.id, med]));

      for (const cloudMedicine of cloudMedicines) {
        if (!localIds.has(cloudMedicine.id)) {
          await removeCloudMedicine(cloudMedicine.id);
        }
      }

      for (const localMedicine of localCloudMeds) {
        const existing = cloudById.get(localMedicine.id);
        if (!existing) {
          await addCloudMedicine(localMedicine);
          continue;
        }

        if (JSON.stringify(existing) !== JSON.stringify(localMedicine)) {
          await updateCloudMedicine(localMedicine);
        }
      }

      await saveProfile({
        uid: user.uid,
        displayName: displayName.trim(),
        email: user.email || profile?.email || '',
        photoURL: user.photoURL || profile?.photoURL,
        age: age.trim(),
        bloodGroup,
        allergies: allergies.trim(),
        preferredLanguage,
        medicines,
        emergencyContacts: contacts,
      });
      await updateMedicines(medicines);
      await updateEmergencyContacts(contacts);
      router.back();
    } catch (error) {
      console.error('Save changes failed:', error);
      Alert.alert('Save failed', 'Could not save changes. Please try again.');
    }
  };

  return (
    <KeyboardAvoidingView style={styles.wrapper} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Edit Profile</Text>

        {/* ── Personal Info ─────────────────────────────────────────────── */}
        <Text style={styles.sectionTitle}>Personal Info</Text>

        <Text style={styles.label}>Name</Text>
        <TextInput
          style={styles.input}
          value={displayName}
          onChangeText={setDisplayName}
          placeholder="Your name"
          placeholderTextColor={Colors.textMuted}
        />

        <Dropdown
          label="Age"
          value={age}
          options={AGE_OPTIONS}
          onSelect={setAge}
          placeholder="Select your age"
        />

        <Text style={styles.label}>Blood Group</Text>
        <View style={styles.chipWrap}>
          {BLOOD_GROUPS.map(group => (
            <TouchableOpacity
              key={group}
              style={[styles.chip, bloodGroup === group && styles.chipActive]}
              onPress={() => setBloodGroup(group)}
              activeOpacity={0.8}
            >
              <Text style={[styles.chipText, bloodGroup === group && styles.chipTextActive]}>
                {group}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Preferred Language</Text>
        <View style={styles.chipWrap}>
          {LANGUAGE_OPTIONS.map(lang => (
            <TouchableOpacity
              key={lang.value}
              style={[styles.langChip, preferredLanguage === lang.value && styles.chipActive]}
              onPress={() => {
                handleLanguageSelect(lang.value).catch((error) => {
                  console.error('Language save failed:', error);
                });
              }}
              activeOpacity={0.8}
            >
              <Text style={[styles.chipText, preferredLanguage === lang.value && styles.chipTextActive]}>
                {lang.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Medical Info ──────────────────────────────────────────────── */}
        <Text style={styles.sectionTitle}>Medical Info</Text>

        <Text style={styles.label}>Allergies</Text>
        <TextInput
          style={[styles.input, styles.multiline]}
          value={allergies}
          onChangeText={setAllergies}
          placeholder="List known allergies (e.g. Penicillin, Dust)"
          placeholderTextColor={Colors.textMuted}
          multiline
          textAlignVertical="top"
        />

        {/* ── Medicines ─────────────────────────────────────────────────── */}
        <Text style={styles.sectionTitle}>Medicines</Text>
        {medicines.map(medicine => (
          <View key={medicine.id} style={styles.card}>
            <Text style={styles.cardTitle}>{medicine.name}</Text>
            <Text style={styles.cardText}>{medicine.dosage} • {medicine.frequency}</Text>
            {medicine.time  ? <Text style={styles.cardText}>Time: {medicine.time}</Text>  : null}
            {medicine.notes ? <Text style={styles.cardText}>Notes: {medicine.notes}</Text> : null}
            <TouchableOpacity
              onPress={() => setMedicines(prev => prev.filter(m => m.id !== medicine.id))}
              style={styles.deleteButton}
            >
              <Text style={styles.deleteText}>Delete</Text>
            </TouchableOpacity>
          </View>
        ))}

        {addingMedicine ? (
          <View style={styles.inlineForm}>
            <Text style={styles.label}>Medicine Name</Text>
            <TextInput
              style={styles.input}
              value={newMedicine.name}
              onChangeText={v => setNewMedicine(p => ({ ...p, name: v }))}
              placeholder="e.g. Metformin"
              placeholderTextColor={Colors.textMuted}
            />
            <Text style={styles.label}>Dosage</Text>
            <TextInput
              style={styles.input}
              value={newMedicine.dosage}
              onChangeText={v => setNewMedicine(p => ({ ...p, dosage: v }))}
              placeholder="e.g. 500mg"
              placeholderTextColor={Colors.textMuted}
            />
            <Dropdown
              label="Frequency"
              value={newMedicine.frequency}
              options={FREQUENCY_OPTIONS}
              onSelect={v => setNewMedicine(p => ({ ...p, frequency: v }))}
              placeholder="How often?"
            />
            <Dropdown
              label="Time"
              value={newMedicine.time || ''}
              options={TIME_OPTIONS}
              onSelect={v => setNewMedicine(p => ({ ...p, time: v }))}
              placeholder="When to take?"
            />
            <Text style={styles.label}>Notes (optional)</Text>
            <TextInput
              style={[styles.input, styles.multiline]}
              value={newMedicine.notes}
              onChangeText={v => setNewMedicine(p => ({ ...p, notes: v }))}
              placeholder="Any special instructions"
              placeholderTextColor={Colors.textMuted}
              multiline
              textAlignVertical="top"
            />
            <TouchableOpacity style={styles.button} onPress={addMedicine}>
              <Text style={styles.buttonText}>Save Medicine</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={styles.secondaryButton} onPress={() => setAddingMedicine(true)}>
            <Text style={styles.secondaryButtonText}>+ Add Medicine</Text>
          </TouchableOpacity>
        )}

        {/* ── Emergency Contacts ────────────────────────────────────────── */}
        <Text style={styles.sectionTitle}>Emergency Contacts</Text>
        {contacts.map(contact => (
          <View key={contact.id} style={styles.card}>
            <Text style={styles.cardTitle}>{contact.name}</Text>
            <Text style={styles.cardText}>{contact.relation} • {contact.phone}</Text>
            <TouchableOpacity
              onPress={() => setContacts(prev => prev.filter(c => c.id !== contact.id))}
              style={styles.deleteButton}
            >
              <Text style={styles.deleteText}>Delete</Text>
            </TouchableOpacity>
          </View>
        ))}

        {addingContact ? (
          <View style={styles.inlineForm}>
            <Text style={styles.label}>Contact Name</Text>
            <TextInput
              style={styles.input}
              value={newContact.name}
              onChangeText={v => setNewContact(p => ({ ...p, name: v }))}
              placeholder="Full name"
              placeholderTextColor={Colors.textMuted}
            />
            <Text style={styles.label}>Phone Number</Text>
            <TextInput
              style={styles.input}
              value={newContact.phone}
              onChangeText={v => setNewContact(p => ({ ...p, phone: v }))}
              placeholder="+91 XXXXX XXXXX"
              placeholderTextColor={Colors.textMuted}
              keyboardType="phone-pad"
            />
            <Dropdown
              label="Relation"
              value={newContact.relation}
              options={RELATION_OPTIONS}
              onSelect={v => setNewContact(p => ({ ...p, relation: v }))}
              placeholder="Select relation"
            />
            <TouchableOpacity style={styles.button} onPress={addContact}>
              <Text style={styles.buttonText}>Save Contact</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={styles.secondaryButton} onPress={() => setAddingContact(true)}>
            <Text style={styles.secondaryButtonText}>+ Add Contact</Text>
          </TouchableOpacity>
        )}

        {/* ── Save ─────────────────────────────────────────────────────── */}
        <TouchableOpacity style={[styles.button, { marginTop: Spacing.xl }]} onPress={saveChanges}>
          <Text style={styles.buttonText}>Save Changes</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrapper:   { flex: 1, backgroundColor: Colors.background },
  container: {
    padding: Spacing.base, paddingTop: Spacing.xl,
    paddingBottom: Spacing.xxl, backgroundColor: Colors.background,
  },
  title: {
    fontSize: FontSizes.xxl, fontWeight: FontWeights.heavy,
    color: Colors.textPrimary, marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: FontSizes.lg, fontWeight: FontWeights.bold,
    color: Colors.textPrimary, marginTop: Spacing.md, marginBottom: Spacing.sm,
  },
  label:     { fontSize: FontSizes.sm, color: Colors.textSecondary, marginBottom: Spacing.xs },
  input: {
    backgroundColor: Colors.cardBg, borderRadius: Radii.lg,
    padding: Spacing.md, marginBottom: Spacing.md,
    color: Colors.textPrimary, fontSize: FontSizes.md,
  },
  multiline: { minHeight: 90 },
  chipWrap:  { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.md },
  chip: {
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    borderRadius: Radii.full, borderWidth: 1,
    borderColor: Colors.border, backgroundColor: Colors.cardBg,
  },
  langChip: {
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    borderRadius: Radii.full, borderWidth: 1,
    borderColor: Colors.border, backgroundColor: Colors.cardBg,
  },
  chipActive:     { borderColor: Colors.primary, backgroundColor: Colors.primary },
  chipText:       { color: Colors.textSecondary, fontSize: FontSizes.sm, fontWeight: FontWeights.medium },
  chipTextActive: { color: Colors.textOnPrimary },
  card: {
    backgroundColor: Colors.cardBg, borderRadius: Radii.lg,
    padding: Spacing.md, marginBottom: Spacing.sm, ...Shadows.card,
  },
  cardTitle:    { color: Colors.textPrimary, fontSize: FontSizes.md, fontWeight: FontWeights.bold },
  cardText:     { color: Colors.textSecondary, fontSize: FontSizes.sm, marginTop: 2 },
  deleteButton: { marginTop: Spacing.sm },
  deleteText:   { color: Colors.emergency, fontWeight: FontWeights.semibold },
  inlineForm:   { marginTop: Spacing.sm },
  button: {
    backgroundColor: Colors.primary, borderRadius: Radii.xl,
    paddingVertical: Spacing.md, alignItems: 'center',
    marginTop: Spacing.md, ...Shadows.strong,
  },
  buttonText:          { color: '#fff', fontSize: FontSizes.md, fontWeight: FontWeights.bold },
  secondaryButton: {
    borderRadius: Radii.xl, paddingVertical: Spacing.md, alignItems: 'center',
    backgroundColor: Colors.cardBg, borderWidth: 1,
    borderColor: Colors.primary, marginTop: Spacing.xs,
  },
  secondaryButtonText: { color: Colors.primary, fontSize: FontSizes.md, fontWeight: FontWeights.bold },
});