import { Colors, FontSizes, FontWeights, Radii, Shadows, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';

const COUNTRY_CODE = '+91';

/**
 * Phone Edit Screen - used in profile to change phone number
 * Requires user to verify new phone with OTP before updating
 */
export default function PhoneEditScreen() {
  const router = useRouter();
  const { phoneNumber: currentPhoneNumber = '' } = useLocalSearchParams<{
    phoneNumber: string;
  }>();

  const { user, startPhoneVerification } = useAuth();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'phone' | 'otp'>('phone');

  const validatePhoneNumber = (phone: string): boolean => {
    const cleaned = phone.replace(/\D/g, '');
    return cleaned.length === 10 || cleaned.length === 12;
  };

  const formatPhoneNumber = (phone: string): string => {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10) {
      return `${COUNTRY_CODE}${cleaned}`;
    }
    if (cleaned.length === 12) {
      return `+${cleaned}`;
    }
    return phone;
  };

  const handlePhoneChange = (text: string) => {
    const cleaned = text.replace(/\D/g, '');
    if (cleaned.length <= 10) {
      if (cleaned.length === 0) {
        setPhoneNumber('');
      } else {
        const formatted = cleaned.replace(/(\d{5})(\d+)/, '$1 $2');
        setPhoneNumber(formatted);
      }
    }
  };

  const handleSendOTP = async () => {
    setErrorMessage(null);

    if (!phoneNumber.trim()) {
      setErrorMessage('Please enter your phone number');
      return;
    }

    if (!validatePhoneNumber(phoneNumber)) {
      setErrorMessage('Please enter a valid 10-digit phone number');
      return;
    }

    const newPhone = formatPhoneNumber(phoneNumber);
    if (newPhone === currentPhoneNumber) {
      setErrorMessage('Please enter a different phone number');
      return;
    }

    try {
      setLoading(true);
      const result = await startPhoneVerification(newPhone);

      if (!result.ok) {
        setErrorMessage(result.message || 'Failed to send OTP');
        return;
      }

      // Navigate to OTP verification
      router.push({
        pathname: '/(tabs)/profile/phone-edit-otp',
        params: {
          phoneNumber: newPhone,
          verificationId: result.verificationId || '',
        },
      });
    } catch (error: any) {
      console.error('Phone verification error:', error);
      setErrorMessage(error.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Update Phone Number</Text>
          <Text style={styles.subtitle}>
            Verify your new phone number with an OTP code.
          </Text>
        </View>

        {currentPhoneNumber && (
          <View style={styles.currentPhoneBox}>
            <Text style={styles.currentPhoneLabel}>Current Phone</Text>
            <Text style={styles.currentPhoneValue}>{currentPhoneNumber}</Text>
          </View>
        )}

        <View style={styles.form}>
          <View style={styles.inputContainer}>
            <Text style={styles.label}>New Phone Number</Text>
            <View style={styles.phoneInputWrapper}>
              <Text style={styles.countryCode}>{COUNTRY_CODE}</Text>
              <TextInput
                style={styles.phoneInput}
                placeholder="98765 43210"
                placeholderTextColor={Colors.textMuted}
                keyboardType="phone-pad"
                maxLength={10}
                value={phoneNumber.replace(/\D/g, '')}
                onChangeText={handlePhoneChange}
                editable={!loading}
              />
            </View>
            <Text style={styles.hint}>Enter 10-digit number</Text>
          </View>

          {errorMessage && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSendOTP}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.buttonText}>Send OTP</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.backText}>← Cancel</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    padding: Spacing.base,
  },
  header: {
    marginBottom: Spacing.xl,
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
    lineHeight: 24,
  },
  currentPhoneBox: {
    backgroundColor: 'rgba(33, 150, 243, 0.1)',
    borderRadius: Radii.lg,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    borderLeftWidth: 4,
    borderLeftColor: Colors.primary,
  },
  currentPhoneLabel: {
    fontSize: FontSizes.sm,
    color: Colors.textMuted,
    marginBottom: Spacing.xs,
  },
  currentPhoneValue: {
    fontSize: FontSizes.lg,
    fontWeight: FontWeights.bold,
    color: Colors.primary,
  },
  form: {
    flex: 1,
  },
  inputContainer: {
    marginBottom: Spacing.lg,
  },
  label: {
    fontSize: FontSizes.md,
    fontWeight: FontWeights.semibold,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  phoneInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radii.lg,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.inputBackground,
    marginBottom: Spacing.sm,
  },
  countryCode: {
    fontSize: FontSizes.md,
    fontWeight: FontWeights.semibold,
    color: Colors.textPrimary,
    marginRight: Spacing.sm,
  },
  phoneInput: {
    flex: 1,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    fontSize: FontSizes.md,
    color: Colors.textPrimary,
  },
  hint: {
    fontSize: FontSizes.xs,
    color: Colors.textMuted,
    marginTop: Spacing.xs,
  },
  button: {
    backgroundColor: Colors.primary,
    borderRadius: Radii.xl,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    ...Shadows.strong,
    marginBottom: Spacing.md,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: FontSizes.md,
    fontWeight: FontWeights.bold,
  },
  backText: {
    color: Colors.primary,
    fontSize: FontSizes.md,
    fontWeight: FontWeights.semibold,
    textAlign: 'center',
  },
  errorContainer: {
    backgroundColor: '#ffebee',
    borderRadius: Radii.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderLeftWidth: 4,
    borderLeftColor: '#d32f2f',
  },
  errorText: {
    color: '#d32f2f',
    fontSize: FontSizes.md,
  },
});
