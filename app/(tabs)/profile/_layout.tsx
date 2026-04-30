import { Stack } from 'expo-router';

/**
 * Profile folder layout
 * Handles nested profile-related screens
 */
export default function ProfileLayout() {
  return (
    <Stack
      screenOptions={{
        headerBackTitleVisible: false,
      }}
    >
      <Stack.Screen name="edit" options={{ title: 'Edit Profile' }} />
      <Stack.Screen name="phone-edit" options={{ title: 'Update Phone' }} />
      <Stack.Screen name="phone-edit-otp" options={{ title: 'Verify Phone' }} />
    </Stack>
  );
}
