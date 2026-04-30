import { Colors, FontSizes, FontWeights, Radii, Shadows, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
    ActivityIndicator,
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

const COUNTRY_CODE = '+91'; // India default

export default function PhoneScreen() {
  const router = useRouter();
  const { startPhoneVerification, phoneVerificationInProgress } = useAuth();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  /**
   * Validate phone number format
   * Accepts 10-digit numbers with or without country code
   */
  const validatePhoneNumber = (phone: string): boolean => {
    const cleaned = phone.replace(/\D/g, '');
    return cleaned.length === 10 || cleaned.length === 12;
  };

  /**
   * Format phone number for display and submission
   */
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

  /**
   * Handle phone number input change
   * Display formatted version for user feedback
   */
  const handlePhoneChange = (text: string) => {
    const cleaned = text.replace(/\D/g, '');
    if (cleaned.length <= 10) {
      if (cleaned.length === 0) {
        setPhoneNumber('');
      } else {
        // Display as user types: 98765 43210
        const formatted = cleaned.replace(/(\d{5})(\d+)/, '$1 $2');
        setPhoneNumber(formatted);
      }
    }
  };

  /**
   * Send OTP to phone number
   */
  const handleSendOTP = async () => {
    setErrorMessage(null);

    // Validate phone number
    if (!phoneNumber.trim()) {
      setErrorMessage('Please enter your phone number');
      return;
    }

    if (!validatePhoneNumber(phoneNumber)) {
      setErrorMessage('Please enter a valid 10-digit phone number');
      return;
    }

    try {
      setLoading(true);
      const formattedPhone = formatPhoneNumber(phoneNumber);

      const result = await startPhoneVerification(formattedPhone);

      if (!result.ok) {
        setErrorMessage(result.message || 'Failed to send OTP');
        if (Platform.OS === 'web') {
          Alert.alert('Error', result.message || 'Failed to send OTP');
        }
        return;
      }

      // Navigate to OTP verification screen with the phone number for display
      router.push({
        pathname: '/(auth)/otp',
        params: {
          phoneNumber: formatPhoneNumber(phoneNumber),
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
          <Text style={styles.title}>Verify Your Phone</Text>
          <Text style={styles.subtitle}>
            We'll send you a one-time password (OTP) to verify your phone number.
          </Text>
        </View>

        <View style={styles.form}>
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Phone Number</Text>
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
                editable={!loading && !phoneVerificationInProgress}
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
            style={[styles.button, (loading || phoneVerificationInProgress) && styles.buttonDisabled]}
            onPress={handleSendOTP}
            disabled={loading || phoneVerificationInProgress}
            activeOpacity={0.85}
          >
            {loading || phoneVerificationInProgress ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.buttonText}>Send OTP</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>Why do we need this?</Text>
          <Text style={styles.infoText}>
            • Phone verification adds an extra layer of security to your account.{'\n'}
            • We'll use this number to contact you in emergencies.{'\n'}
            • You can update it anytime in your profile.
          </Text>
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
    justifyContent: 'space-between',
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
  form: {
    marginBottom: Spacing.xl,
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
  infoBox: {
    backgroundColor: 'rgba(33, 150, 243, 0.1)',
    borderRadius: Radii.lg,
    padding: Spacing.md,
    borderLeftWidth: 4,
    borderLeftColor: Colors.primary,
  },
  infoTitle: {
    fontSize: FontSizes.md,
    fontWeight: FontWeights.semibold,
    color: Colors.primary,
    marginBottom: Spacing.sm,
  },
  infoText: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
});
