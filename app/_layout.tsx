import { STORAGE_KEYS, useStoredState } from '@/hooks/useStorage';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

export default function RootLayout() {
  const router = useRouter();
  const [onboarded, , loading] = useStoredState<boolean>(STORAGE_KEYS.ONBOARDED, false);

  useEffect(() => {
    if (!loading && !onboarded) {
      router.replace('/onboarding');
    }
  }, [loading, onboarded, router]);

  return (
    <>
      <StatusBar style="light" />
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
      </Stack>
    </>
  );
}