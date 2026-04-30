import { AuthProvider, useAuth } from '@/hooks/useAuth';
import { useCloudSync } from '@/hooks/useCloudSync';
import { STORAGE_KEYS, useStoredState } from '@/hooks/useStorage';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

function RootLayoutContent() {
  const router = useRouter();
  const segments = useSegments();
  const { user, loading: authLoading, phoneVerified } = useAuth();
  const scopedUid = user?.uid ?? 'anonymous';
  const [onboarded, , loading] = useStoredState<boolean>(STORAGE_KEYS.ONBOARDED(scopedUid), false);
  useCloudSync();

  useEffect(() => {
    if (authLoading || loading) return;

    const topSegment = segments[0];
    const secondSegment = segments[1] ?? null;
    const inAuth = topSegment === '(auth)';
    const inOnboarding = topSegment === 'onboarding';
    const inTabs = topSegment === '(tabs)';

    // Defer navigation so Expo Router's segment state is fully settled
    // and to avoid setState during render warnings
    const timeout = setTimeout(() => {
      // 1. Not authenticated → show login (if not already in auth flow)
      if (!user && !inAuth) {
        router.replace('/(auth)/login');
        return;
      }

      // 2. Authenticated but phone not verified → show phone verification
      // Allow navigation within the auth stack (e.g. login -> phone) by
      // checking the second segment so we don't mistakenly avoid needed redirects.
      if (user && !phoneVerified) {
        const alreadyOnPhone = inAuth && (secondSegment === 'phone' || secondSegment === 'otp');
        if (!alreadyOnPhone) {
          router.replace('/(auth)/phone');
          return;
        }
      }

      // 3. Fully authenticated (user + phone verified) but not onboarded → show onboarding
      if (user && phoneVerified && !onboarded && !inOnboarding) {
        router.replace('/onboarding');
        return;
      }

      // 4. Fully authenticated and onboarded but in auth/onboarding → go to tabs
      if (user && phoneVerified && onboarded && (inAuth || inOnboarding)) {
        router.replace('/(tabs)');
      }
    }, 0);

    return () => clearTimeout(timeout);

  }, [authLoading, loading, onboarded, segments, user, phoneVerified]);
  // ✅ router removed from deps — stable ref, caused extra re-runs

  return (
    <>
      <StatusBar style="light" />
      <Stack>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="profile/edit" options={{ title: 'Edit Profile', headerShown: true }} />
        <Stack.Screen name="profile/phone-edit" options={{ title: 'Update Phone', headerShown: true }} />
        <Stack.Screen name="profile/phone-edit-otp" options={{ title: 'Verify Phone', headerShown: true }} />
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