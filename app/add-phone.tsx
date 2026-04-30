import { Colors, FontSizes, FontWeights, Radii, Shadows, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

function normalizeIndianPhoneNumber(value: string) {
  const digits = value.replace(/\D/g, '');
  if (digits.startsWith('91') && digits.length > 10) {
    return digits.slice(-10);
  }
  return digits.slice(0, 10);
}

export default function AddPhoneScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ phoneNumber?: string; edit?: string }>();
  const { user } = useAuth();
  const isEditMode = params.edit === '1';
  const initialPhone = useMemo(() => {
    const value = Array.isArray(params.phoneNumber) ? params.phoneNumber[0] : params.phoneNumber;
    return normalizeIndianPhoneNumber(value ?? '');
  }, [params.phoneNumber]);
  const [phoneNumber, setPhoneNumber] = useState(initialPhone);
  const normalizedPhone = normalizeIndianPhoneNumber(phoneNumber);
  const canSendOtp = normalizedPhone.length === 10;

  useEffect(() => {
    setPhoneNumber(initialPhone);
  }, [initialPhone]);

  if (!user) return null;

  const handleSendOtp = () => {
    router.push({
      pathname: '/otp-verification',
      params: { phoneNumber: normalizedPhone, edit: isEditMode ? '1' : '0' },
    });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{isEditMode ? 'Edit Phone Number' : 'Add Phone Number'}</Text>
      <Text style={styles.subtitle}>Enter your Indian mobile number. We will use a local dummy OTP for testing.</Text>

      <View style={styles.phoneRow}>
        <View style={styles.prefixBox}>
          <Text style={styles.prefixText}>+91</Text>
        </View>
        <TextInput
          style={styles.phoneInput}
          value={phoneNumber}
          onChangeText={(value) => setPhoneNumber(normalizeIndianPhoneNumber(value))}
          placeholder="Enter 10 digits"
          placeholderTextColor={Colors.textMuted}
          keyboardType="number-pad"
          maxLength={10}
        />
      </View>

      <TouchableOpacity
        style={[styles.button, !canSendOtp && styles.buttonDisabled]}
        onPress={handleSendOtp}
        disabled={!canSendOtp}
        activeOpacity={0.85}
      >
        <Text style={styles.buttonText}>Send OTP</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.secondaryButton}
        onPress={() => router.back()}
        activeOpacity={0.85}
      >
        <Text style={styles.secondaryButtonText}>Back</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    padding: Spacing.base,
    justifyContent: 'center',
  },
  title: {
    fontSize: FontSizes.xxl,
    fontWeight: FontWeights.heavy,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  subtitle: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    marginBottom: Spacing.xl,
    lineHeight: 24,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  prefixBox: {
    backgroundColor: Colors.cardBg,
    borderTopLeftRadius: Radii.lg,
    borderBottomLeftRadius: Radii.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md + 1,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  prefixText: {
    color: Colors.textPrimary,
    fontSize: FontSizes.md,
    fontWeight: FontWeights.bold,
  },
  phoneInput: {
    flex: 1,
    backgroundColor: Colors.cardBg,
    borderTopRightRadius: Radii.lg,
    borderBottomRightRadius: Radii.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    color: Colors.textPrimary,
    fontSize: FontSizes.md,
    borderWidth: 1,
    borderLeftWidth: 0,
    borderColor: Colors.border,
  },
  button: {
    backgroundColor: Colors.primary,
    borderRadius: Radii.xl,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    ...Shadows.strong,
  },
  buttonDisabled: {
    opacity: 0.5,
    shadowOpacity: 0,
  },
  buttonText: {
    color: Colors.textOnPrimary,
    fontSize: FontSizes.md,
    fontWeight: FontWeights.bold,
  },
  secondaryButton: {
    marginTop: Spacing.sm,
    backgroundColor: Colors.cardBg,
    borderRadius: Radii.xl,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  secondaryButtonText: {
    color: Colors.textSecondary,
    fontSize: FontSizes.md,
    fontWeight: FontWeights.bold,
  },
});