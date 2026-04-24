import { Colors, FontSizes, FontWeights, Radii, Shadows, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { STORAGE_KEYS, storageSet } from '@/hooks/useStorage';
import { useUserProfile } from '@/hooks/useUserProfile';
import { EmergencyContact, Medicine } from '@/types/user';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'] as const;

const createId = () => Date.now().toString() + Math.random().toString(36).slice(2);

export default function OnboardingScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { profile, loading, saveProfile, updateEmergencyContacts, updateMedicines } = useUserProfile();

  const [step, setStep] = useState(1);
  const [displayName, setDisplayName] = useState('');
  const [age, setAge] = useState('');
  const [bloodGroup, setBloodGroup] = useState<string>('');
  const [allergies, setAllergies] = useState('');
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);

  const [newMedicine, setNewMedicine] = useState<Medicine>({
    id: '',
    name: '',
    dosage: '',
    frequency: '',
    time: '',
    notes: '',
  });
  const [addingMedicine, setAddingMedicine] = useState(false);

  const [newContact, setNewContact] = useState<EmergencyContact>({
    id: '',
    name: '',
    phone: '',
    relation: '',
  });
  const [addingContact, setAddingContact] = useState(false);

  useEffect(() => {
    if (loading || !user) return;

    setDisplayName(profile?.displayName || user.displayName || '');
    setAge(profile?.age || '');
    setBloodGroup(profile?.bloodGroup || '');
    setAllergies(profile?.allergies || '');
    setMedicines(profile?.medicines || []);
    setContacts(profile?.emergencyContacts || []);
  }, [loading, profile, user]);

  if (loading || !user) {
    return null;
  }

  const addMedicine = () => {
    if (!newMedicine.name.trim() || !newMedicine.dosage.trim() || !newMedicine.frequency.trim()) {
      Alert.alert('Missing medicine info', 'Please fill medicine name, dosage, and frequency.');
      return;
    }

    setMedicines((prev) => [
      ...prev,
      {
        id: createId(),
        name: newMedicine.name.trim(),
        dosage: newMedicine.dosage.trim(),
        frequency: newMedicine.frequency.trim(),
        time: newMedicine.time?.trim() || undefined,
        notes: newMedicine.notes?.trim() || undefined,
      },
    ]);
    setNewMedicine({ id: '', name: '', dosage: '', frequency: '', time: '', notes: '' });
    setAddingMedicine(false);
  };

  const addContact = () => {
    if (!newContact.name.trim() || !newContact.phone.trim() || !newContact.relation.trim()) {
      Alert.alert('Missing contact info', 'Please fill contact name, phone, and relation.');
      return;
    }

    setContacts((prev) => [
      ...prev,
      {
        id: createId(),
        name: newContact.name.trim(),
        phone: newContact.phone.trim(),
        relation: newContact.relation.trim(),
      },
    ]);
    setNewContact({ id: '', name: '', phone: '', relation: '' });
    setAddingContact(false);
  };

  const finishOnboarding = async () => {
    if (!displayName.trim()) {
      Alert.alert('Missing name', 'Please enter your name to continue.');
      setStep(1);
      return;
    }

    if (contacts.length < 1) {
      Alert.alert('Emergency contact required', 'Please add at least one emergency contact.');
      setStep(3);
      return;
    }

    await saveProfile({
      uid: user.uid,
      displayName: displayName.trim(),
      email: user.email || profile?.email || '',
      photoURL: user.photoURL || profile?.photoURL,
      age: age.trim(),
      bloodGroup,
      allergies: allergies.trim(),
      medicines,
      emergencyContacts: contacts,
    });
    await updateMedicines(medicines);
    await updateEmergencyContacts(contacts);
    await storageSet(STORAGE_KEYS.ONBOARDED(user.uid), true);
    router.replace('/(tabs)');
  };

  return (
    <KeyboardAvoidingView
      style={styles.wrapper}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Welcome to ElderEase</Text>
        <Text style={styles.subtitle}>Step {step} of 3</Text>

        {step === 1 && (
          <>
            <Text style={styles.sectionTitle}>Personal Info</Text>
            <Text style={styles.label}>Name</Text>
            <TextInput
              style={styles.input}
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="Your name"
              placeholderTextColor={Colors.textMuted}
            />

            <Text style={styles.label}>Age</Text>
            <TextInput
              style={styles.input}
              value={age}
              onChangeText={setAge}
              placeholder="Your age"
              placeholderTextColor={Colors.textMuted}
              keyboardType="number-pad"
            />

            <Text style={styles.label}>Blood Group</Text>
            <View style={styles.chipWrap}>
              {BLOOD_GROUPS.map((group) => (
                <TouchableOpacity
                  key={group}
                  style={[styles.chip, bloodGroup === group && styles.chipActive]}
                  onPress={() => setBloodGroup(group)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.chipText, bloodGroup === group && styles.chipTextActive]}>{group}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {step === 2 && (
          <>
            <Text style={styles.sectionTitle}>Medical Info</Text>
            <Text style={styles.label}>Allergies</Text>
            <TextInput
              style={[styles.input, styles.multiline]}
              value={allergies}
              onChangeText={setAllergies}
              placeholder="List known allergies"
              placeholderTextColor={Colors.textMuted}
              multiline
              textAlignVertical="top"
            />

            <Text style={styles.sectionTitle}>Medicines</Text>
            {medicines.map((medicine) => (
              <View key={medicine.id} style={styles.card}>
                <Text style={styles.cardTitle}>{medicine.name}</Text>
                <Text style={styles.cardText}>{medicine.dosage} • {medicine.frequency}</Text>
                {medicine.time ? <Text style={styles.cardText}>Time: {medicine.time}</Text> : null}
                {medicine.notes ? <Text style={styles.cardText}>Notes: {medicine.notes}</Text> : null}
                <TouchableOpacity
                  onPress={() => setMedicines((prev) => prev.filter((item) => item.id !== medicine.id))}
                  style={styles.deleteButton}
                >
                  <Text style={styles.deleteText}>Delete</Text>
                </TouchableOpacity>
              </View>
            ))}

            {addingMedicine ? (
              <View style={styles.inlineForm}>
                <TextInput
                  style={styles.input}
                  value={newMedicine.name}
                  onChangeText={(value) => setNewMedicine((prev) => ({ ...prev, name: value }))}
                  placeholder="Medicine name"
                  placeholderTextColor={Colors.textMuted}
                />
                <TextInput
                  style={styles.input}
                  value={newMedicine.dosage}
                  onChangeText={(value) => setNewMedicine((prev) => ({ ...prev, dosage: value }))}
                  placeholder="Dosage"
                  placeholderTextColor={Colors.textMuted}
                />
                <TextInput
                  style={styles.input}
                  value={newMedicine.frequency}
                  onChangeText={(value) => setNewMedicine((prev) => ({ ...prev, frequency: value }))}
                  placeholder="Frequency"
                  placeholderTextColor={Colors.textMuted}
                />
                <TextInput
                  style={styles.input}
                  value={newMedicine.time}
                  onChangeText={(value) => setNewMedicine((prev) => ({ ...prev, time: value }))}
                  placeholder="Time"
                  placeholderTextColor={Colors.textMuted}
                />
                <TextInput
                  style={[styles.input, styles.multiline]}
                  value={newMedicine.notes}
                  onChangeText={(value) => setNewMedicine((prev) => ({ ...prev, notes: value }))}
                  placeholder="Notes"
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
                <Text style={styles.secondaryButtonText}>Add Medicine</Text>
              </TouchableOpacity>
            )}
          </>
        )}

        {step === 3 && (
          <>
            <Text style={styles.sectionTitle}>Emergency Contacts</Text>
            {contacts.map((contact) => (
              <View key={contact.id} style={styles.card}>
                <Text style={styles.cardTitle}>{contact.name}</Text>
                <Text style={styles.cardText}>{contact.relation}</Text>
                <Text style={styles.cardText}>{contact.phone}</Text>
                <TouchableOpacity
                  onPress={() => setContacts((prev) => prev.filter((item) => item.id !== contact.id))}
                  style={styles.deleteButton}
                >
                  <Text style={styles.deleteText}>Delete</Text>
                </TouchableOpacity>
              </View>
            ))}

            {addingContact ? (
              <View style={styles.inlineForm}>
                <TextInput
                  style={styles.input}
                  value={newContact.name}
                  onChangeText={(value) => setNewContact((prev) => ({ ...prev, name: value }))}
                  placeholder="Contact name"
                  placeholderTextColor={Colors.textMuted}
                />
                <TextInput
                  style={styles.input}
                  value={newContact.phone}
                  onChangeText={(value) => setNewContact((prev) => ({ ...prev, phone: value }))}
                  placeholder="Phone"
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="phone-pad"
                />
                <TextInput
                  style={styles.input}
                  value={newContact.relation}
                  onChangeText={(value) => setNewContact((prev) => ({ ...prev, relation: value }))}
                  placeholder="Relation"
                  placeholderTextColor={Colors.textMuted}
                />
                <TouchableOpacity style={styles.button} onPress={addContact}>
                  <Text style={styles.buttonText}>Save Contact</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={styles.secondaryButton} onPress={() => setAddingContact(true)}>
                <Text style={styles.secondaryButtonText}>Add Contact</Text>
              </TouchableOpacity>
            )}
          </>
        )}

        <View style={styles.navigationRow}>
          {step > 1 ? (
            <TouchableOpacity style={styles.secondaryButton} onPress={() => setStep((prev) => prev - 1)}>
              <Text style={styles.secondaryButtonText}>Back</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.navSpacer} />
          )}

          {step < 3 ? (
            <TouchableOpacity style={styles.button} onPress={() => setStep((prev) => prev + 1)}>
              <Text style={styles.buttonText}>Next</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.button} onPress={finishOnboarding}>
              <Text style={styles.buttonText}>Finish</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  container: {
    padding: Spacing.base,
    paddingTop: Spacing.xl,
    backgroundColor: Colors.background,
    minHeight: '100%',
    paddingBottom: Spacing.xxl,
  },
  title: {
    fontSize: FontSizes.xxl,
    fontWeight: FontWeights.heavy,
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },
  subtitle: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    marginBottom: Spacing.xl,
    lineHeight: 22,
  },
  label: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radii.full,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.cardBg,
  },
  chipActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary,
  },
  chipText: {
    color: Colors.textSecondary,
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.medium,
  },
  chipTextActive: {
    color: Colors.textOnPrimary,
  },
  sectionTitle: {
    fontSize: FontSizes.lg,
    fontWeight: FontWeights.bold,
    color: Colors.textPrimary,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  input: {
    backgroundColor: Colors.cardBg,
    borderRadius: Radii.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    color: Colors.textPrimary,
    fontSize: FontSizes.md,
  },
  multiline: {
    minHeight: 90,
  },
  card: {
    backgroundColor: Colors.cardBg,
    borderRadius: Radii.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    ...Shadows.card,
  },
  cardTitle: {
    color: Colors.textPrimary,
    fontSize: FontSizes.md,
    fontWeight: FontWeights.bold,
  },
  cardText: {
    color: Colors.textSecondary,
    fontSize: FontSizes.sm,
    marginTop: 2,
  },
  deleteButton: {
    marginTop: Spacing.sm,
  },
  deleteText: {
    color: Colors.emergency,
    fontWeight: FontWeights.semibold,
  },
  inlineForm: {
    marginTop: Spacing.sm,
  },
  navigationRow: {
    marginTop: Spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  navSpacer: {
    flex: 1,
  },
  button: {
    flex: 1,
    backgroundColor: Colors.primary,
    borderRadius: Radii.xl,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    ...Shadows.strong,
  },
  buttonText: {
    color: '#fff',
    fontSize: FontSizes.md,
    fontWeight: FontWeights.bold,
  },
  secondaryButton: {
    flex: 1,
    borderRadius: Radii.xl,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    backgroundColor: Colors.cardBg,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  secondaryButtonText: {
    color: Colors.primary,
    fontSize: FontSizes.md,
    fontWeight: FontWeights.bold,
  },
});
