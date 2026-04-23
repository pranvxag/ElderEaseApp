import { Colors, FontSizes, FontWeights, Radii, Shadows, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function AuthScreen() {
  const { configured, signInWithGoogle } = useAuth();

  const handleGoogleSignIn = async () => {
    const result = await signInWithGoogle();
    if (!result.ok && result.message) {
      Alert.alert('Sign-in issue', result.message);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Sign in to ElderEase</Text>
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
          Missing config: add EXPO_PUBLIC_FIREBASE_* and EXPO_PUBLIC_GOOGLE_* variables in your environment.
        </Text>
      )}
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
    marginTop: Spacing.md,
    color: Colors.textMuted,
    fontSize: FontSizes.sm,
    lineHeight: 22,
  },
});
