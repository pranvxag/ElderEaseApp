# ElderEase App 👴👵

This is an [Expo](https://expo.dev) project built with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

---

## What's New in V2.0.0 (compared to V1.1.0)

### New Screens

| Screen | Description |
|---|---|
| **Onboarding** (`app/onboarding.tsx`) | First-time setup screen where the elder's name, caregiver name & phone number, reminder lead time, and notification preferences are collected before entering the app. |
| **Profile** (`app/(tabs)/profile.tsx`) | New dedicated tab that lets users update their elder profile, caregiver contact details, reminder lead time, and toggle notifications on/off at any time. |

### New Features

- **Local Push Notifications** — Medication reminders are now scheduled as daily repeating local notifications via `expo-notifications`. A "streak at risk" nudge is also sent when a dose is missed. Notifications are handled in `lib/notifications.ts`.
- **AsyncStorage Persistence** — All app data (medications, routine progress, profile, notification mapping) is now persisted across app restarts using `@react-native-async-storage/async-storage`. The `useStoredState` hook in `hooks/useStorage.ts` provides a simple `useState`-like API with automatic persistence.
- **Medication Management Hook** — `hooks/useMedications.ts` centralises all medication state: adding, marking as taken, deleting, and automatically scheduling/cancelling the corresponding notification reminders.
- **User Profile Data Model** — A new `UserProfile` type and `DEFAULT_USER_PROFILE` constant were added to `constants/data.ts`, along with `useProfile.ts` for reading and updating profile data.
- **EAS Build Configuration** — `eas.json` added to support building the app with [EAS Build](https://docs.expo.dev/build/introduction/).

### New Dependencies

| Package | Reason |
|---|---|
| `@react-native-async-storage/async-storage` | Persistent local storage |
| `expo-notifications` | Local push notification scheduling |
| `expo-device` | Detects whether the app is running on a physical device (required for push notifications) |

### Summary

V1.1.0 was a UI-only prototype — data was not persisted and there were no notifications. V2.0.0 adds a full data-persistence layer, a local notification system for medication reminders, an onboarding flow, and a profile management screen, making the app functional end-to-end.

---

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```
   OR
   ```bash
   npx expo start --clear
   ```
   or
    ```bash
   npx expo start --lan
   ```
   or for code space
    ```bash
   npx expo start --tunnel
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
