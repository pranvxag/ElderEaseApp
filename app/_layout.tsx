import { AuthProvider, useAuth } from '@/hooks/useAuth';
import { useCloudSync } from '@/hooks/useCloudSync';
import { STORAGE_KEYS, useStoredState } from '@/hooks/useStorage';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

function RootLayoutContent() {
  const router = useRouter();
  const segments = useSegments();
  const { user, loading: authLoading } = useAuth();
  const scopedUid = user?.uid ?? 'anonymous';
  const [onboarded, , loading] = useStoredState<boolean>(STORAGE_KEYS.ONBOARDED(scopedUid), false);
  useCloudSync();

  useEffect(() => {
    if (authLoading || loading) return;

    const topSegment = segments[0];
    const inAuth = topSegment === 'auth';
    const inOnboarding = topSegment === 'onboarding';

    // Defer navigation so Expo Router's segment state is fully settled
    // and to avoid setState during render warnings
    const timeout = setTimeout(() => {
      if (!user && !inAuth) {
        router.replace('/auth');
        return;
      }

      if (user && !onboarded && !inOnboarding) {
        router.replace('/onboarding');
        return;
      }

      if (user && onboarded && (inAuth || inOnboarding)) {
        router.replace('/(tabs)');
      }
    }, 0);

    return () => clearTimeout(timeout);

  }, [authLoading, loading, onboarded, segments, user]);
  // ✅ router removed from deps — stable ref, caused extra re-runs

  return (
    <>
      <StatusBar style="light" />
      <Stack>
        <Stack.Screen name="auth" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="profile/edit" options={{ title: 'Edit Profile', headerShown: true }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootLayoutContent />
    </AuthProvider>
  );
}