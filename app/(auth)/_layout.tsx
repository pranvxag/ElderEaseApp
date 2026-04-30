import { Stack } from 'expo-router';

/**
 * Authentication flow layout
 * Contains: login, phone verification, and OTP screens
 */
export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animationEnabled: true,
      }}
    >
      <Stack.Screen name="login" />
      <Stack.Screen name="phone" />
      <Stack.Screen name="otp" />
    </Stack>
  );
}
