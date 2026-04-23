import { DEFAULT_USER_PROFILE, EmergencyContact, Medication, UserProfile } from '@/constants/data';
import { Colors, FontSizes, FontWeights, Radii, Shadows, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useEmergencyContacts } from '@/hooks/useEmergencyContacts';
import { STORAGE_KEYS, useStoredState } from '@/hooks/useStorage';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';

export default function ProfileScreen() {
  const { signOut } = useAuth();
  const [profile, setProfile, loading] = useStoredState<UserProfile>(STORAGE_KEYS.USER_PROFILE, DEFAULT_USER_PROFILE);
  const [medications, setMedications, medsLoading] = useStoredState<Medication[]>(STORAGE_KEYS.MEDICATIONS, []);
  const [contacts, setContacts, contactsLoading] = useEmergencyContacts();

  const [name, setName] = useState('');
  const [caregiverName, setCaregiverName] = useState('');
  const [caregiverPhone, setCaregiverPhone] = useState('');
  const [reminderLeadMinutes, setReminderLeadMinutes] = useState('30');
  const [remindersEnabled, setRemindersEnabled] = useState(true);
  const [voiceConsent, setVoiceConsent] = useState(false);
  const [medicationId, setMedicationId] = useState('');
  const [medicationName, setMedicationName] = useState('');
  const [medicationDosage, setMedicationDosage] = useState('');
  const [medicationTime, setMedicationTime] = useState('9:00 AM');
  const [medicationFrequency, setMedicationFrequency] = useState('daily');
  const [medicationPurpose, setMedicationPurpose] = useState('');
  const [contactId, setContactId] = useState('');
  const [primaryContactName, setPrimaryContactName] = useState('');
  const [primaryContactRelation, setPrimaryContactRelation] = useState('');
  const [primaryContactPhone, setPrimaryContactPhone] = useState('');

  useEffect(() => {
    if (!loading) {
      setName(profile.name);
      setCaregiverName(profile.caregiverName);
      setCaregiverPhone(profile.caregiverPhone);
      setReminderLeadMinutes(profile.reminderLeadMinutes.toString());
      setRemindersEnabled(profile.remindersEnabled);
      setVoiceConsent(!!profile.voiceConsent);
    }
  }, [profile, loading]);

  useEffect(() => {
    if (medsLoading) return;
    const starter = medications[0];
    if (!starter) return;

    setMedicationId(starter.id);
    setMedicationName(starter.name);
    setMedicationDosage(starter.dosage);
    setMedicationTime(starter.time);
    setMedicationFrequency(starter.frequency);
    setMedicationPurpose(starter.purpose);
  }, [medications, medsLoading]);

  useEffect(() => {
    if (contactsLoading) return;
    const primary = contacts.find((c) => c.isPrimary) ?? contacts[0];
    if (!primary) return;

    setContactId(primary.id);
    setPrimaryContactName(primary.name);
    setPrimaryContactRelation(primary.relation);
    setPrimaryContactPhone(primary.phone);
  }, [contacts, contactsLoading]);

  const handleSave = () => {
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
      Alert.alert('Missing information', 'Please fill in all profile, medication, and primary contact fields before saving.');
      return;
    }

    const allowedFrequencies: Medication['frequency'][] = ['daily', 'twice-daily', 'weekly', 'as-needed'];
    const normalizedFrequency = medicationFrequency.trim().toLowerCase() as Medication['frequency'];
    const safeFrequency = allowedFrequencies.includes(normalizedFrequency) ? normalizedFrequency : 'daily';

    setProfile({
      name: name.trim(),
      caregiverName: caregiverName.trim(),
      caregiverPhone: caregiverPhone.trim(),
      reminderLeadMinutes: Number(reminderLeadMinutes) || 30,
      remindersEnabled,
      voiceConsent,
    });

    const nextMedication: Medication = {
      id: medicationId || `med-${Date.now()}`,
      name: medicationName.trim(),
      dosage: medicationDosage.trim(),
      time: medicationTime.trim(),
      frequency: safeFrequency,
      color: '#1A7A6E',
      status: 'upcoming',
      purpose: medicationPurpose.trim(),
      streak: 0,
    };

    setMedications((prev) => {
      if (prev.length === 0) return [nextMedication];

      const targetId = medicationId || prev[0].id;
      const exists = prev.some((med) => med.id === targetId);

      if (!exists) {
        return [nextMedication, ...prev];
      }

      return prev.map((med) => (med.id === targetId ? { ...med, ...nextMedication } : med));
    });

    const computedInitials = primaryContactName
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('') || 'EC';

    const nextPrimaryContact: EmergencyContact = {
      id: contactId || `contact-${Date.now()}`,
      name: primaryContactName.trim(),
      relation: primaryContactRelation.trim(),
      phone: primaryContactPhone.trim(),
      isPrimary: true,
      initials: computedInitials,
      color: '#1A7A6E',
    };

    setContacts((prev) => {
      if (prev.length === 0) return [nextPrimaryContact];

      const targetId = contactId || prev[0].id;
      const exists = prev.some((contact) => contact.id === targetId);

      if (!exists) {
        return [{ ...nextPrimaryContact, isPrimary: true }, ...prev.map((contact) => ({ ...contact, isPrimary: false }))];
      }

      return prev.map((contact) => {
        if (contact.id === targetId) {
          return { ...contact, ...nextPrimaryContact, isPrimary: true };
        }
        return { ...contact, isPrimary: false };
      });
    });

    Alert.alert('Saved', 'Your profile, medication, and primary contact settings have been updated.');
  };

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Sign-out failed:', error);
      Alert.alert('Sign-out failed', 'Please try again.');
    }
  };

  if (loading || medsLoading || contactsLoading) {
    return null;
  }

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <Text style={styles.title}>Profile Settings</Text>
      <Text style={styles.subtitle}>Manage all onboarding details any time: profile, medication, and primary emergency contact.</Text>

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
          <Text style={styles.helpText}>If disabled, local medication notifications will not be scheduled.</Text>
        </View>
        <Switch value={remindersEnabled} onValueChange={setRemindersEnabled} thumbColor={remindersEnabled ? Colors.primary : Colors.textMuted} />
      </View>

      <View style={styles.switchRow}>
        <View>
          <Text style={styles.label}>Allow voice assistant calls</Text>
          <Text style={styles.helpText}>Enable short voice check-ins (audio will be recorded/transcribed with your consent).</Text>
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

      <TouchableOpacity style={styles.button} onPress={handleSave} activeOpacity={0.8}>
        <Text style={styles.buttonText}>Save Profile</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.secondaryButton} onPress={handleSignOut} activeOpacity={0.8}>
        <Text style={styles.secondaryButtonText}>Sign Out</Text>
      </TouchableOpacity>
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
  helpText: {
    fontSize: FontSizes.xs,
    color: Colors.textMuted,
    marginTop: 4,
    maxWidth: '80%',
  },
  button: {
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
    marginTop: Spacing.md,
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
