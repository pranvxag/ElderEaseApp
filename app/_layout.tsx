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
  const [onboarded, , loading] = useStoredState<boolean>(STORAGE_KEYS.ONBOARDED, false);
  useCloudSync();

  useEffect(() => {
    if (authLoading || loading) return;

    const topSegment = segments[0];
    const inAuth = topSegment === 'auth';
    const inOnboarding = topSegment === 'onboarding';

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
  }, [authLoading, loading, onboarded, router, segments, user]);

  return (
    <>
      <StatusBar style="light" />
      <Stack>
        <Stack.Screen name="auth" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
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