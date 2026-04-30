import { Colors, FontSizes, FontWeights, Radii, Shadows, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useState } from 'react';
import { Alert, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

/**
 * Login Screen - Primary authentication with Google Sign-In
 * After successful login, user is redirected to phone verification if needed
 */
export default function LoginScreen() {
  const { configured, signInWithGoogle } = useAuth();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setErrorMessage(null);
    const result = await signInWithGoogle();
    if (!result.ok && result.message) {
      if (Platform.OS === 'web') {
        setErrorMessage(result.message);
      } else {
        Alert.alert('Sign-in issue', result.message);
      }
    }
    // On success, route guards in _layout will handle navigation to phone/onboarding/tabs
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome to ElderEase</Text>
      <Text style={styles.subtitle}>
        Use your Google account to securely sync profile, medications, and emergency contacts across devices.
      </Text>

      <TouchableOpacity
        style={[styles.button, !configured && styles.buttonDisabled]}
        onPress={handleGoogleSignIn}
        disabled={!configured}
        activeOpacity={0.85}
      >
        <Text style={styles.buttonText}>Continue with Google</Text>
      </TouchableOpacity>

      {!configured && (
        <Text style={styles.helpText}>
          {Platform.OS === 'android'
            ? 'Sign-in setup incomplete. Ensure EXPO_PUBLIC_FIREBASE_* and EXPO_PUBLIC_GOOGLE_* env vars are set, then open in an Expo development build (Expo Go does not include native Google Sign-In).'
            : 'Missing config: add EXPO_PUBLIC_FIREBASE_* and EXPO_PUBLIC_GOOGLE_* variables in your environment.'}
        </Text>
      )}

      {errorMessage && (
        <Text style={styles.errorText}>
          {errorMessage}
        </Text>
      )}

      <View style={styles.infoBox}>
        <Text style={styles.infoTitle}>Why use Google Sign-In?</Text>
        <Text style={styles.infoText}>
          • Secure authentication{'\n'}
          • No password to remember{'\n'}
          • Fast sign-in{'\n'}
          • Access across all your devices
        </Text>
      </View>
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
    marginBottom: Spacing.md,
  },
  subtitle: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    marginBottom: Spacing.xl,
    lineHeight: 24,
  },
  button: {
    backgroundColor: Colors.primary,
    borderRadius: Radii.xl,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    ...Shadows.strong,
    marginBottom: Spacing.xl,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: FontSizes.md,
    fontWeight: FontWeights.bold,
  },
  helpText: {
    marginBottom: Spacing.xl,
    color: Colors.textMuted,
    fontSize: FontSizes.sm,
    lineHeight: 22,
  },
  errorText: {
    marginBottom: Spacing.xl,
    color: '#d32f2f',
    fontSize: FontSizes.sm,
    lineHeight: 22,
    backgroundColor: '#ffebee',
    padding: Spacing.md,
    borderRadius: Radii.lg,
    borderLeftWidth: 4,
    borderLeftColor: '#d32f2f',
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
