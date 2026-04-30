import { Colors, FontSizes, FontWeights, Radii, Shadows, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useUserProfile } from '@/hooks/useUserProfile';
import { updateProfileData } from '@/lib/profile-data';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Platform, StyleSheet, Text, TextInput, ToastAndroid, TouchableOpacity, View } from 'react-native';

function normalizeOtpValue(value: string) {
  return value.replace(/\D/g, '').slice(0, 6);
}

function showToast(message: string) {
  if (Platform.OS === 'android') {
    ToastAndroid.show(message, ToastAndroid.SHORT);
    return;
  }
  Alert.alert('', message);
}

export default function OTPVerificationScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ phoneNumber?: string; edit?: string }>();
  const { user } = useAuth();
  const { saveProfile } = useUserProfile();
  const inputRefs = useRef<Array<TextInput | null>>([]);
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [errorMessage, setErrorMessage] = useState('');
  const [focusedIndex, setFocusedIndex] = useState(0);
  const isEditMode = params.edit === '1';
  const phoneNumber = useMemo(() => {
    const value = Array.isArray(params.phoneNumber) ? params.phoneNumber[0] : params.phoneNumber;
    return normalizeOtpValue(value ?? '');
  }, [params.phoneNumber]);
  const isComplete = otpDigits.every((digit) => digit.length === 1);

  useEffect(() => {
    if (phoneNumber.length === 0) {
      router.replace('/add-phone');
    }
  }, [phoneNumber, router]);

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  if (!user) return null;

  const updateDigit = (index: number, value: string) => {
    const digitsOnly = normalizeOtpValue(value);
    const nextValue = digitsOnly.slice(-1);
    setErrorMessage('');
    setOtpDigits((prev) => {
      const next = [...prev];
      next[index] = nextValue;

      if (digitsOnly.length > 1) {
        let writeIndex = index;
        for (const digit of digitsOnly) {
          if (writeIndex >= next.length) break;
          next[writeIndex] = digit;
          writeIndex += 1;
        }
        setFocusedIndex(Math.min(writeIndex, next.length - 1));
      }

      return next;
    });

    if (digitsOnly.length > 1) {
      const nextIndex = Math.min(index + digitsOnly.length, inputRefs.current.length - 1);
      inputRefs.current[nextIndex]?.focus();
      return;
    }

    if (nextValue && index < inputRefs.current.length - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (index: number, key: string) => {
    if (key !== 'Backspace') return;
    if (otpDigits[index]) return;
    if (index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async () => {
    if (!isComplete) {
      setErrorMessage('Enter the full 6-digit OTP.');
      return;
    }

    const enteredOtp = otpDigits.join('');
    if (enteredOtp !== '000000') {
      setErrorMessage('Incorrect OTP. Please try again.');
      return;
    }

    const now = new Date().toISOString();
    // Store phone number with +91 prefix if not already present
    const phoneWithPrefix = phoneNumber.startsWith('+91') ? phoneNumber : `+91${phoneNumber}`;
    await updateProfileData(user.uid, {
      phoneNumber: phoneWithPrefix,
      phoneVerified: true,
      updatedAt: now,
    });
    await saveProfile({
      phoneNumber: phoneWithPrefix,
      phoneVerified: true,
    });

    if (isEditMode) {
      router.replace('/profile/edit');
      return;
    }

    router.replace('/(tabs)');
  };

  const handleResend = () => {
    showToast('OTP sent!');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Verify OTP</Text>
      <Text style={styles.subtitle}>Enter the 6-digit code for +91 {phoneNumber}. Use 000000 for testing.</Text>
      <Text style={styles.helperText}>{isEditMode ? 'You are updating your saved phone number.' : 'We sent a test code to your number.'}</Text>

      <View style={styles.otpRow}>
        {otpDigits.map((digit, index) => (
          <TextInput
            key={index}
            ref={(ref) => {
              inputRefs.current[index] = ref;
            }}
            style={styles.otpBox}
            value={digit}
            onChangeText={(value) => updateDigit(index, value)}
            onKeyPress={({ nativeEvent }) => handleKeyPress(index, nativeEvent.key)}
            onFocus={() => setFocusedIndex(index)}
            keyboardType="number-pad"
            maxLength={1}
            textAlign="center"
            placeholder={focusedIndex === index ? '•' : '0'}
            placeholderTextColor={Colors.textMuted}
            selectionColor={Colors.primary}
            autoCapitalize="none"
            autoCorrect={false}
          />
        ))}
      </View>

      {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

      <TouchableOpacity style={[styles.button, !isComplete && styles.buttonDisabled]} onPress={handleVerify} disabled={!isComplete} activeOpacity={0.85}>
        <Text style={styles.buttonText}>Verify OTP</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.secondaryButton} onPress={handleResend} activeOpacity={0.85}>
        <Text style={styles.secondaryButtonText}>Resend OTP</Text>
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
    marginBottom: Spacing.sm,
    lineHeight: 24,
  },
  helperText: {
    color: Colors.textMuted,
    fontSize: FontSizes.sm,
    marginBottom: Spacing.lg,
  },
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  otpBox: {
    flex: 1,
    minWidth: 42,
    backgroundColor: Colors.cardBg,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: Spacing.md,
    color: Colors.textPrimary,
    fontSize: FontSizes.lg,
    fontWeight: FontWeights.bold,
  },
  otpBoxActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary + '10',
  },
  errorText: {
    color: Colors.emergency,
    fontSize: FontSizes.sm,
    marginBottom: Spacing.md,
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