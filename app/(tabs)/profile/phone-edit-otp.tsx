import { Colors, FontSizes, FontWeights, Radii, Shadows, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
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

const OTP_LENGTH = 6;
const RESEND_TIMEOUT = 30;

/**
 * OTP Verification for Phone Edit - similar to auth OTP but updates profile
 */
export default function PhoneEditOTPScreen() {
  const router = useRouter();
  const { phoneNumber = '', verificationId = '' } = useLocalSearchParams<{
    phoneNumber: string;
    verificationId: string;
  }>();

  const { confirmPhoneVerification, phoneVerificationInProgress } = useAuth();
  const [otp, setOtp] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);
  const resendIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const otpInputRef = useRef<TextInput>(null);

  const startResendCountdown = () => {
    setResendCountdown(RESEND_TIMEOUT);
  };

  const handleResendOTP = () => {
    setErrorMessage(null);
    Alert.alert('OTP Resent', `A new OTP has been sent to ${phoneNumber}`);
    startResendCountdown();
  };

  const handleVerifyOTP = async () => {
    setErrorMessage(null);

    if (otp.length !== OTP_LENGTH) {
      setErrorMessage(`Please enter a valid ${OTP_LENGTH}-digit OTP`);
      return;
    }

    if (!verificationId) {
      setErrorMessage('Verification session expired. Please try again.');
      return;
    }

    try {
      setLoading(true);

      const result = await confirmPhoneVerification(verificationId, otp);

      if (!result.ok) {
        setErrorMessage(result.message || 'Invalid OTP');
        setOtp('');
        otpInputRef.current?.focus();
        return;
      }

      // Success - phone number updated
      Alert.alert('Success', 'Phone number updated!', [
        { text: 'OK', onPress: () => router.replace('/(tabs)/profile') },
      ]);
    } catch (error: any) {
      console.error('OTP verification error:', error);
      setErrorMessage(error.message || 'Verification failed');
      setOtp('');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (resendCountdown <= 0) {
      if (resendIntervalRef.current) {
        clearInterval(resendIntervalRef.current);
        resendIntervalRef.current = null;
      }
      return;
    }

    resendIntervalRef.current = setInterval(() => {
      setResendCountdown((prev) => Math.max(prev - 1, 0));
    }, 1000);

    return () => {
      if (resendIntervalRef.current) {
        clearInterval(resendIntervalRef.current);
      }
    };
  }, [resendCountdown]);

  useEffect(() => {
    startResendCountdown();
    return () => {
      if (resendIntervalRef.current) {
        clearInterval(resendIntervalRef.current);
      }
    };
  }, []);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Confirm OTP</Text>
          <Text style={styles.subtitle}>We've sent a 6-digit code to</Text>
          <Text style={styles.phoneDisplay}>{phoneNumber}</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.otpContainer}>
            <TextInput
              ref={otpInputRef}
              style={styles.otpInput}
              placeholder="000000"
              placeholderTextColor={Colors.textMuted}
              keyboardType="number-pad"
              maxLength={OTP_LENGTH}
              value={otp}
              onChangeText={(text) => {
                const cleaned = text.replace(/\D/g, '');
                setOtp(cleaned);
              }}
              editable={!loading && !phoneVerificationInProgress}
              autoFocus
            />
          </View>

          {errorMessage && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.button, (loading || phoneVerificationInProgress) && styles.buttonDisabled]}
            onPress={handleVerifyOTP}
            disabled={loading || phoneVerificationInProgress || otp.length !== OTP_LENGTH}
            activeOpacity={0.85}
          >
            {loading || phoneVerificationInProgress ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.buttonText}>Verify OTP</Text>
            )}
          </TouchableOpacity>

          <View style={styles.resendSection}>
            <Text style={styles.resendLabel}>Didn't receive the code?</Text>
            {resendCountdown > 0 ? (
              <Text style={styles.resendCountdown}>Resend OTP in {resendCountdown}s</Text>
            ) : (
              <TouchableOpacity onPress={handleResendOTP}>
                <Text style={styles.resendButton}>Resend OTP</Text>
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.backText}>← Change phone number</Text>
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
    marginBottom: Spacing.xs,
  },
  phoneDisplay: {
    fontSize: FontSizes.lg,
    fontWeight: FontWeights.bold,
    color: Colors.primary,
  },
  form: {
    marginBottom: Spacing.xl,
  },
  otpContainer: {
    marginBottom: Spacing.lg,
  },
  otpInput: {
    fontSize: FontSizes.xxl,
    fontWeight: '700',
    color: Colors.textPrimary,
    textAlign: 'center',
    borderWidth: 2,
    borderColor: Colors.primary,
    borderRadius: Radii.lg,
    paddingVertical: Spacing.lg,
    letterSpacing: 12,
    backgroundColor: Colors.inputBackground,
  },
  button: {
    backgroundColor: Colors.primary,
    borderRadius: Radii.xl,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    ...Shadows.strong,
    marginBottom: Spacing.lg,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: FontSizes.md,
    fontWeight: FontWeights.bold,
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
  resendSection: {
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  resendLabel: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  resendCountdown: {
    fontSize: FontSizes.md,
    fontWeight: FontWeights.semibold,
    color: Colors.primary,
  },
  resendButton: {
    fontSize: FontSizes.md,
    fontWeight: FontWeights.semibold,
    color: Colors.primary,
    textDecorationLine: 'underline',
  },
  backText: {
    color: Colors.primary,
    fontSize: FontSizes.md,
    fontWeight: FontWeights.semibold,
    textAlign: 'center',
  },
});
