import MedicineTimeSlotPicker from '@/components/medicine-time-slot-picker';
import { Colors, FontSizes, FontWeights, Radii, Shadows, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { FirestoreMedicine, useMedicines } from '@/hooks/useMedicines';
import { useUserProfile } from '@/hooks/useUserProfile';
import {
    EMERGENCY_CONTACT_SLOTS,
    createEmergencyContactDrafts,
    normalizeEmergencyContacts,
} from '@/lib/emergency-contacts';
import { FREQUENCY_OPTIONS, formatTimeSlots, getDefaultTimeSlots, normalizeTimeSlots } from '@/lib/medicine';
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

const createId = () => Date.now().toString() + Math.random().toString(36).slice(2);

function toProfileMedicine(med: FirestoreMedicine): Medicine {
  const times = normalizeTimeSlots(med.times?.length ? med.times : (med.time ? [med.time] : []), med.frequency);
  return {
    id: med.id,
    name: med.name,
    dosage: med.dosage,
    frequency: med.frequency || 'Once a day',
    time: times[0],
    times,
    notes: med.notes,
  };
}

function toCloudMedicine(med: Medicine): FirestoreMedicine {
  const times = normalizeTimeSlots(med.times?.length ? med.times : (med.time ? [med.time] : []), med.frequency);
  const trimmedTime = times[0];
  return {
    id: med.id,
    name: med.name,
    dosage: med.dosage,
    times,
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
  const [editingMedicineId, setEditingMedicineId] = useState<string | null>(null);

  const [newMedicine, setNewMedicine]   = useState<Medicine>({ id: '', name: '', dosage: '', frequency: '', time: '', times: [], notes: '' });
  const [newMedicineTimes, setNewMedicineTimes] = useState<string[]>(getDefaultTimeSlots('Once a day'));
  const [addingMedicine, setAddingMedicine] = useState(false);

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
    setContacts(createEmergencyContactDrafts(profile?.emergencyContacts || []));
    setFormInitialized(true);
  }, [cloudMedicines, cloudMedicinesLoading, formInitialized, loading, profile, user]);

  useEffect(() => {
    setFormInitialized(false);
  }, [user?.uid]);

  if (loading || !user) return null;

  const addMedicine = async () => {
    if (!newMedicine.name.trim() || !newMedicine.dosage.trim() || !newMedicine.frequency.trim() || newMedicineTimes.length === 0) {
      Alert.alert('Missing medicine info', 'Please fill medicine name, dosage, and frequency.');
      return;
    }
    try {
      const normalizedTimes = normalizeTimeSlots(newMedicineTimes, newMedicine.frequency);
      const medicineId = editingMedicineId ?? createId();
      const cloudMedicineInput = {
        id: medicineId,
        name: newMedicine.name.trim(),
        dosage: newMedicine.dosage.trim(),
        times: normalizedTimes,
        enabled: true,
        frequency: newMedicine.frequency.trim(),
        time: normalizedTimes[0],
        notes: newMedicine.notes?.trim() || undefined,
      };

      if (editingMedicineId) {
        await updateCloudMedicine(cloudMedicineInput);
      } else {
        await addCloudMedicine(cloudMedicineInput);
      }

      const profileMedicine = toProfileMedicine(cloudMedicineInput);
      const nextMedicines = editingMedicineId
        ? medicines.map((medicine) => (medicine.id === medicineId ? profileMedicine : medicine))
        : [...medicines, profileMedicine];
      setMedicines(nextMedicines);
      await updateMedicines(nextMedicines);
      setNewMedicine({ id: '', name: '', dosage: '', frequency: '', time: '', times: [], notes: '' });
      setNewMedicineTimes(getDefaultTimeSlots('Once a day'));
      setEditingMedicineId(null);
      setAddingMedicine(false);
    } catch (error) {
      console.error('Medicine save failed:', error);
      Alert.alert('Save failed', 'Could not save medicine. Please try again.');
    }
  };

  const openMedicineEditor = (medicine: Medicine) => {
    setEditingMedicineId(medicine.id);
    setNewMedicine({
      id: medicine.id,
      name: medicine.name,
      dosage: medicine.dosage,
      frequency: medicine.frequency,
      time: medicine.times?.[0] ?? medicine.time ?? '',
      times: medicine.times ?? [],
      notes: medicine.notes || '',
    });
    setNewMedicineTimes(normalizeTimeSlots(medicine.times ?? (medicine.time ? [medicine.time] : []), medicine.frequency));
    setAddingMedicine(true);
  };

  const cancelMedicineEditor = () => {
    setEditingMedicineId(null);
    setNewMedicine({ id: '', name: '', dosage: '', frequency: '', time: '', times: [], notes: '' });
    setNewMedicineTimes(getDefaultTimeSlots('Once a day'));
    setAddingMedicine(false);
  };

  const handleLanguageSelect = async (lang: PreferredLanguage) => {
    setPreferredLanguage(lang);
    await saveProfile({ preferredLanguage: lang });
  };

  const updateContactField = (slot: EmergencyContact['slot'], field: keyof EmergencyContact, value: string) => {
    setContacts((prev) =>
      prev.map((contact) =>
        contact.slot === slot
          ? {
              ...contact,
              [field]: value,
            }
          : contact
      )
    );
  };

  const validateContacts = () => {
    for (const slotConfig of EMERGENCY_CONTACT_SLOTS) {
      const contact = contacts.find((item) => item.slot === slotConfig.slot);
      const hasAny = Boolean(contact?.name.trim() || contact?.phone.trim() || contact?.relation.trim());
      const isComplete = Boolean(contact?.name.trim() && contact?.phone.trim() && contact?.relation.trim());

      if (slotConfig.required || hasAny) {
        if (!contact || !isComplete) {
          Alert.alert('Missing contact info', `${slotConfig.label} needs name, phone number, and relation.`);
          return false;
        }
      }
    }

    return true;
  };

  const saveChanges = async () => {
    if (!displayName.trim()) {
      Alert.alert('Missing name', 'Please enter your name.');
      return;
    }
    if (!validateContacts()) {
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
        emergencyContacts: normalizeEmergencyContacts(contacts),
      });
      await updateMedicines(medicines);
      await updateEmergencyContacts(normalizeEmergencyContacts(contacts));
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
            <Text style={styles.cardText}>Time: {formatTimeSlots(medicine.times ?? [medicine.time || '9:00 AM'])}</Text>
            {medicine.notes ? <Text style={styles.cardText}>Notes: {medicine.notes}</Text> : null}
            <View style={styles.cardActions}>
              <TouchableOpacity
                onPress={() => openMedicineEditor(medicine)}
                style={styles.editButton}
              >
                <Text style={styles.editText}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setMedicines(prev => prev.filter(m => m.id !== medicine.id))}
                style={styles.deleteButton}
              >
                <Text style={styles.deleteText}>Delete</Text>
              </TouchableOpacity>
            </View>
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
              onSelect={(v) => {
                setNewMedicine((p) => ({ ...p, frequency: v }));
                if (newMedicineTimes.length === 0) {
                  setNewMedicineTimes(getDefaultTimeSlots(v));
                }
              }}
              placeholder="How often?"
            />
            <MedicineTimeSlotPicker
              frequency={newMedicine.frequency}
              selectedTimes={newMedicineTimes}
              onChange={setNewMedicineTimes}
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
            <View style={styles.formActions}>
              <TouchableOpacity style={styles.button} onPress={addMedicine}>
                <Text style={styles.buttonText}>{editingMedicineId ? 'Update Medicine' : 'Save Medicine'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryButton} onPress={cancelMedicineEditor}>
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity style={styles.secondaryButton} onPress={() => setAddingMedicine(true)}>
            <Text style={styles.secondaryButtonText}>+ Add Medicine</Text>
          </TouchableOpacity>
        )}

        {/* ── Emergency Contacts ────────────────────────────────────────── */}
        <Text style={styles.sectionTitle}>Emergency Contacts</Text>
        <Text style={styles.hint}>Primary caregiver is used first. Doctor is required for reports and follow-up.</Text>
        {contacts.map((contact) => {
          const slotConfig = EMERGENCY_CONTACT_SLOTS.find((item) => item.slot === contact.slot) ?? EMERGENCY_CONTACT_SLOTS[0];

          return (
            <View key={contact.slot} style={styles.card}>
              <View style={styles.contactHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{slotConfig.label}</Text>
                  <Text style={styles.cardText}>{slotConfig.description}</Text>
                </View>
                {slotConfig.isPrimary ? (
                  <View style={styles.primaryBadge}>
                    <Text style={styles.primaryBadgeText}>Primary</Text>
                  </View>
                ) : slotConfig.required ? (
                  <View style={styles.requiredBadge}>
                    <Text style={styles.requiredBadgeText}>Required</Text>
                  </View>
                ) : (
                  <View style={styles.optionalBadge}>
                    <Text style={styles.optionalBadgeText}>Optional</Text>
                  </View>
                )}
              </View>

              <Text style={styles.label}>Name</Text>
              <TextInput
                style={styles.input}
                value={contact.name}
                onChangeText={(value) => updateContactField(contact.slot, 'name', value)}
                placeholder={slotConfig.label}
                placeholderTextColor={Colors.textMuted}
              />

              <Text style={styles.label}>Phone Number</Text>
              <TextInput
                style={styles.input}
                value={contact.phone}
                onChangeText={(value) => updateContactField(contact.slot, 'phone', value)}
                placeholder="+91 XXXXX XXXXX"
                placeholderTextColor={Colors.textMuted}
                keyboardType="phone-pad"
              />

              <Dropdown
                label="Relation with user"
                value={contact.relation}
                options={RELATION_OPTIONS}
                onSelect={(value) => updateContactField(contact.slot, 'relation', value)}
                placeholder="Select relation"
              />
            </View>
          );
        })}

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
  cardActions: { flexDirection: 'row', alignItems: 'center' },
  contactHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, marginBottom: Spacing.sm },
  primaryBadge: { backgroundColor: Colors.primary + '18', borderRadius: Radii.full, paddingHorizontal: Spacing.sm, paddingVertical: 4 },
  primaryBadgeText: { color: Colors.primary, fontSize: FontSizes.xs, fontWeight: FontWeights.bold },
  requiredBadge: { backgroundColor: Colors.emergency + '18', borderRadius: Radii.full, paddingHorizontal: Spacing.sm, paddingVertical: 4 },
  requiredBadgeText: { color: Colors.emergency, fontSize: FontSizes.xs, fontWeight: FontWeights.bold },
  optionalBadge: { backgroundColor: Colors.border, borderRadius: Radii.full, paddingHorizontal: Spacing.sm, paddingVertical: 4 },
  optionalBadgeText: { color: Colors.textSecondary, fontSize: FontSizes.xs, fontWeight: FontWeights.bold },
  deleteButton: { marginTop: Spacing.sm },
  deleteText:   { color: Colors.emergency, fontWeight: FontWeights.semibold },
  editButton: { marginTop: Spacing.sm, marginRight: Spacing.md },
  editText: { color: Colors.primary, fontWeight: FontWeights.semibold },
  inlineForm:   { marginTop: Spacing.sm },
  formActions: { marginTop: Spacing.sm },
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