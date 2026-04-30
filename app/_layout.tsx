import { AuthProvider, useAuth } from '@/hooks/useAuth';
import { useCloudSync } from '@/hooks/useCloudSync';
import { ensureProfileData } from '@/lib/profile-data';
import { Stack, useLocalSearchParams, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';

function RootLayoutContent() {
  const router = useRouter();
  const segments = useSegments();
  const params = useLocalSearchParams<{ edit?: string; phoneNumber?: string }>();
  const { user, loading: authLoading } = useAuth();
  const [, setProfileStatus] = useState<{ loading: boolean; needsPhone: boolean; phoneNumber: string }>({
    loading: true,
    needsPhone: false,
    phoneNumber: '',
  });
  useCloudSync();

  useEffect(() => {
    const topSegment = segments[0];
    const inAuth = topSegment === 'auth';
    const inAddPhone = topSegment === 'add-phone';
    const inOtp = topSegment === 'otp-verification';
    const isEditFlow = params.edit === '1';

    if (authLoading) {
      setProfileStatus({ loading: true, needsPhone: false, phoneNumber: '' });
      return;
    }

    if (!user) {
      setProfileStatus({ loading: false, needsPhone: false, phoneNumber: '' });
      if (!inAuth) {
        router.replace('/auth');
      }
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const profile = await ensureProfileData(user);
        if (cancelled) return;

        const needsPhone = !profile.phoneNumber.trim() || !profile.phoneVerified;
        setProfileStatus({
          loading: false,
          needsPhone,
          phoneNumber: profile.phoneNumber || '',
        });

        // If in add-phone or otp-verification, allow the flow regardless of needsPhone status
        // This allows editing of phone number without immediate redirect
        if (inAddPhone || inOtp) {
          return;
        }

        if (needsPhone) {
          router.replace({
            pathname: '/add-phone',
            params: { phoneNumber: profile.phoneNumber || '', edit: '0' },
          });
          return;
        }

        if (inAuth) {
          router.replace('/(tabs)');
        }
      } catch (error) {
        console.error('Profile bootstrap failed:', error);
        if (!cancelled) {
          setProfileStatus({ loading: false, needsPhone: false, phoneNumber: '' });
        }
      }
    })();

    return () => {
      cancelled = true;
    };

  }, [authLoading, router, segments, user]);

  return (
    <>
      <StatusBar style="light" />
      <Stack>
        <Stack.Screen name="auth" options={{ headerShown: false }} />
        <Stack.Screen name="add-phone" options={{ headerShown: false }} />
        <Stack.Screen name="otp-verification" options={{ headerShown: false }} />
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