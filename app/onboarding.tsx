import { DEFAULT_USER_PROFILE, UserProfile } from '@/constants/data';
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

  useEffect(() => {
    if (!profileLoading) {
      setName(profile.name);
      setCaregiverName(profile.caregiverName);
      setCaregiverPhone(profile.caregiverPhone);
      setReminderLeadMinutes(profile.reminderLeadMinutes.toString());
      setRemindersEnabled(profile.remindersEnabled);
    }
  }, [profile, profileLoading]);

  useEffect(() => {
    if (!profileLoading && !onboardLoading && onboarded) {
      router.replace('/(tabs)');
    }
  }, [onboarded, profileLoading, onboardLoading, router]);

  const handleStart = async () => {
    if (!name.trim() || !caregiverName.trim() || !caregiverPhone.trim()) {
      Alert.alert('Missing information', 'Please fill in your name, caregiver name, and caregiver phone number.');
      return;
    }

    const nextProfile: UserProfile = {
      name: name.trim(),
      caregiverName: caregiverName.trim(),
      caregiverPhone: caregiverPhone.trim(),
      reminderLeadMinutes: Number(reminderLeadMinutes) || 30,
      remindersEnabled,
    };

    setProfile(nextProfile);
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

      <TouchableOpacity style={styles.button} onPress={handleStart} activeOpacity={0.8}>
        <Text style={styles.buttonText}>Get Started</Text>
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
  },
  button: {
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
