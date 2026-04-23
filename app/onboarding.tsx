import { DEFAULT_USER_PROFILE, EmergencyContact, Medication, UserProfile } from '@/constants/data';
import { Colors, FontSizes, FontWeights, Radii, Shadows, Spacing } from '@/constants/theme';
import { STORAGE_KEYS, useStoredState } from '@/hooks/useStorage';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';

export default function OnboardingScreen() {
  const router = useRouter();
  const [profile, setProfile, profileLoading] = useStoredState<UserProfile>(STORAGE_KEYS.USER_PROFILE, DEFAULT_USER_PROFILE);
  const [onboarded, setOnboarded, onboardLoading] = useStoredState<boolean>(STORAGE_KEYS.ONBOARDED, false);

  const [name, setName] = useState('');
  const [caregiverName, setCaregiverName] = useState('');
  const [caregiverPhone, setCaregiverPhone] = useState('');
  const [reminderLeadMinutes, setReminderLeadMinutes] = useState('30');
  const [remindersEnabled, setRemindersEnabled] = useState(true);
  const [voiceConsent, setVoiceConsent] = useState(false);
  const [medicationName, setMedicationName] = useState('');
  const [medicationDosage, setMedicationDosage] = useState('');
  const [medicationTime, setMedicationTime] = useState('9:00 AM');
  const [medicationFrequency, setMedicationFrequency] = useState('daily');
  const [medicationPurpose, setMedicationPurpose] = useState('');
  const [primaryContactName, setPrimaryContactName] = useState('');
  const [primaryContactRelation, setPrimaryContactRelation] = useState('');
  const [primaryContactPhone, setPrimaryContactPhone] = useState('');

  const [, setMedications] = useStoredState<Medication[]>(STORAGE_KEYS.MEDICATIONS, []);
  const [, setContacts] = useStoredState<EmergencyContact[]>(STORAGE_KEYS.EMERGENCY_CONTACTS, []);

  useEffect(() => {
    if (!profileLoading) {
      setName(profile.name);
      setCaregiverName(profile.caregiverName);
      setCaregiverPhone(profile.caregiverPhone);
      setReminderLeadMinutes(profile.reminderLeadMinutes.toString());
      setRemindersEnabled(profile.remindersEnabled);
      setVoiceConsent(!!profile.voiceConsent);
    }
  }, [profile, profileLoading]);

  useEffect(() => {
    if (!profileLoading && !onboardLoading && onboarded) {
      router.replace('/(tabs)');
    }
  }, [onboarded, profileLoading, onboardLoading, router]);

  const handleStart = async () => {
    if (
      !name.trim() ||
      !caregiverName.trim() ||
      !caregiverPhone.trim() ||
      !medicationName.trim() ||
      !medicationDosage.trim() ||
      !medicationTime.trim() ||
      !medicationPurpose.trim() ||
      !primaryContactName.trim() ||
      !primaryContactRelation.trim() ||
      !primaryContactPhone.trim()
    ) {
      Alert.alert(
        'Missing information',
        'Please fill in the elder, medication, and primary contact details before continuing.'
      );
      return;
    }

    const nextProfile: UserProfile = {
      name: name.trim(),
      caregiverName: caregiverName.trim(),
      caregiverPhone: caregiverPhone.trim(),
      reminderLeadMinutes: Number(reminderLeadMinutes) || 30,
      remindersEnabled,
      voiceConsent,
    };

    const starterMedication: Medication = {
      id: `med-${Date.now()}`,
      name: medicationName.trim(),
      dosage: medicationDosage.trim(),
      time: medicationTime.trim(),
      frequency: medicationFrequency.trim() as Medication['frequency'],
      color: '#1A7A6E',
      status: 'upcoming',
      purpose: medicationPurpose.trim(),
      streak: 0,
    };

    const primaryContact: EmergencyContact = {
      id: `contact-${Date.now()}`,
      name: primaryContactName.trim(),
      relation: primaryContactRelation.trim(),
      phone: primaryContactPhone.trim(),
      isPrimary: true,
      initials: primaryContactName
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? '')
        .join('') || 'EC',
      color: '#1A7A6E',
    };

    setProfile(nextProfile);
    setMedications([starterMedication]);
    setContacts([primaryContact]);
    setOnboarded(true);
    router.replace('/(tabs)');
  };

  if (profileLoading || onboardLoading) {
    return null;
  }

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <Text style={styles.title}>Welcome to ElderEase</Text>
      <Text style={styles.subtitle}>Set up your profile and caregiver connection so your reminders work better.</Text>

      <Text style={styles.label}>Elder{"'"}s Name</Text>
      <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="e.g. Mr. Singh" placeholderTextColor={Colors.textMuted} />

      <Text style={styles.label}>Caregiver Name</Text>
      <TextInput style={styles.input} value={caregiverName} onChangeText={setCaregiverName} placeholder="e.g. Priya Singh" placeholderTextColor={Colors.textMuted} />

      <Text style={styles.label}>Caregiver Phone</Text>
      <TextInput style={styles.input} value={caregiverPhone} onChangeText={setCaregiverPhone} placeholder="e.g. +91 98765 43210" placeholderTextColor={Colors.textMuted} keyboardType="phone-pad" />

      <Text style={styles.label}>Reminder Lead Time</Text>
      <TextInput
        style={styles.input}
        value={reminderLeadMinutes}
        onChangeText={setReminderLeadMinutes}
        placeholder="Minutes before medication"
        placeholderTextColor={Colors.textMuted}
        keyboardType="numeric"
      />

      <View style={styles.switchRow}>
        <View>
          <Text style={styles.label}>Enable reminders</Text>
          <Text style={styles.helpText}>Allow local reminders for medication times.</Text>
        </View>
        <Switch value={remindersEnabled} onValueChange={setRemindersEnabled} thumbColor={remindersEnabled ? Colors.primary : Colors.textMuted} />
      </View>

      <View style={styles.switchRow}>
        <View>
          <Text style={styles.label}>Allow voice assistant calls</Text>
          <Text style={styles.helpText}>Enable short voice check-ins with recorded audio and transcription.</Text>
        </View>
        <Switch value={voiceConsent} onValueChange={setVoiceConsent} thumbColor={voiceConsent ? Colors.primary : Colors.textMuted} />
      </View>

      <Text style={styles.sectionTitle}>Starter Medication</Text>

      <Text style={styles.label}>Medicine Name</Text>
      <TextInput style={styles.input} value={medicationName} onChangeText={setMedicationName} placeholder="e.g. Metformin" placeholderTextColor={Colors.textMuted} />

      <Text style={styles.label}>Dosage</Text>
      <TextInput style={styles.input} value={medicationDosage} onChangeText={setMedicationDosage} placeholder="e.g. 500mg - 1 tablet" placeholderTextColor={Colors.textMuted} />

      <Text style={styles.label}>Time</Text>
      <TextInput style={styles.input} value={medicationTime} onChangeText={setMedicationTime} placeholder="e.g. 9:00 AM" placeholderTextColor={Colors.textMuted} />

      <Text style={styles.label}>Frequency</Text>
      <TextInput style={styles.input} value={medicationFrequency} onChangeText={setMedicationFrequency} placeholder="daily, twice-daily, weekly, as-needed" placeholderTextColor={Colors.textMuted} />

      <Text style={styles.label}>Purpose</Text>
      <TextInput style={styles.input} value={medicationPurpose} onChangeText={setMedicationPurpose} placeholder="e.g. Blood pressure control" placeholderTextColor={Colors.textMuted} />

      <Text style={styles.sectionTitle}>Primary Emergency Contact</Text>

      <Text style={styles.label}>Contact Name</Text>
      <TextInput style={styles.input} value={primaryContactName} onChangeText={setPrimaryContactName} placeholder="e.g. Priya Singh" placeholderTextColor={Colors.textMuted} />

      <Text style={styles.label}>Relation</Text>
      <TextInput style={styles.input} value={primaryContactRelation} onChangeText={setPrimaryContactRelation} placeholder="e.g. Daughter" placeholderTextColor={Colors.textMuted} />

      <Text style={styles.label}>Contact Phone</Text>
      <TextInput style={styles.input} value={primaryContactPhone} onChangeText={setPrimaryContactPhone} placeholder="e.g. +91 98765 43210" placeholderTextColor={Colors.textMuted} keyboardType="phone-pad" />

      <View style={styles.buttonRow}>
        <TouchableOpacity style={styles.secondaryButton} onPress={() => router.push('/(tabs)/profile')} activeOpacity={0.8}>
          <Text style={styles.secondaryButtonText}>Test Profile</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.button} onPress={handleStart} activeOpacity={0.8}>
          <Text style={styles.buttonText}>Get Started</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.base,
    paddingTop: Spacing.xl,
    backgroundColor: Colors.background,
    minHeight: '100%',
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
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.xl,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  helpText: {
    fontSize: FontSizes.xs,
    color: Colors.textMuted,
    marginTop: 4,
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
  button: {
    flex: 1,
    backgroundColor: Colors.primary,
    borderRadius: Radii.xl,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    ...Shadows.button,
  },
  buttonText: {
    color: '#fff',
    fontSize: FontSizes.md,
    fontWeight: FontWeights.bold,
  },
});
