# ElderEase App 👴👵

> Release: `V2.2.0-CS-01-18/02` — updated April 18, 2026
>
This is an [Expo](https://expo.dev) project built with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

---

## What's New in V2.2.0-CS-01-18/02

### New Screens

| Screen | Description |
|---|---|
| **Onboarding** (`app/onboarding.tsx`) | First-time setup screen where the elder's name, caregiver name & phone number, reminder lead time, notification preferences, voice consent, one starter medication, and a primary emergency contact are collected before entering the app. |
| **Profile** (`app/(tabs)/profile.tsx`) | Dedicated profile tab for updating elder profile details, caregiver contact information, reminder lead time, and notification settings at any time. |
| **Scan** (`app/(tabs)/scan.tsx`) | New scan hub for uploading or scanning prescriptions and blood reports using camera or image picker. |
| **Scan Prescription** (`app/(tabs)/scan-prescription.tsx`) | Scan or paste prescription text, parse medication details, and create medication reminders automatically. |
| **Upload Report** (`app/(tabs)/upload-report.tsx`) | Upload lab report images or paste OCR text, then extract and save blood sugar values from reports. |
| **AI Call** (`app/(tabs)/ai-call.tsx`) | Voice prompt and transcript parsing demo for capturing blood sugar readings. |
| **Emergency** (`app/(tabs)/emergency.tsx`) | Emergency screen now surfaces the latest blood sugar reading and offers a quick path back to the AI health call flow. |

### New Features

- **Scan + upload workflow** — Added a central `Scan` hub that supports prescription scanning and report upload with camera fallback and image picker integration.
- **Prescription parsing** — Automatically parse medicine text from prescriptions and create medication reminders through `hooks/useMedications.ts`.
- **Report value extraction** — Extract blood sugar values from uploaded lab reports using the new `Upload Report` flow.
- **AI-assisted health entry** — Added an AI call demo that uses `expo-speech` to prompt for health data, parses transcript text, and saves blood sugar readings.
- **Persistent health data** — Added `hooks/useHealthData.ts` to store blood sugar entries, expose the latest reading, and trigger alerts for out-of-range values.
- **Emergency screen enhancement** — Emergency tab now shows the most recent health entry and includes a fast re-check route to the AI call screen.
- **Updated tab navigation** — Added `Scan` and `AI Call` tabs while keeping prescription/report flows hidden until needed.

### New Dependencies

| Package | Reason |
|---|---|
| `@react-native-async-storage/async-storage` | Persistent local storage |
| `expo-notifications` | Local push notification scheduling |
| `expo-device` | Detects whether the app is running on a physical device (required for push notifications) |
| `expo-image-picker` | Upload and camera scanning support for reports and prescriptions |
| `expo-speech` | Voice prompt support for the AI call demo |

### Summary

V2.2.0-CS-01-18/02 builds on the existing medication reminder and profile foundation by introducing intelligent elder care workflows: scan and upload support for prescriptions and lab reports, AI-assisted health entry, and persistent blood sugar tracking. This release expands the app from reminders to more complete care capture and diagnostic workflows.

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

## Development Build (Android, EAS Cloud)

Use this when you want full `expo-notifications` behavior on Android (Expo Go has SDK 53+ limitations for remote notification APIs).

1. Install dependencies

   ```bash
   npm install
   ```

2. Log in to Expo account (first time only)

   ```bash
   npx eas login
   ```

3. Create an Android development build

   ```bash
   npm run build:dev:android
   ```

4. Install the generated build on your Android device (use the EAS install link / QR from build output)

5. Start Metro for dev client from Codespaces

   ```bash
   npm run dev-client:start
   ```

6. Open the installed development build app on device, then connect to the running Metro server

Notes:

- Use `npx expo start --tunnel` (or `npm start`) for Expo Go quick testing.
- Use dev builds for notification behavior that Expo Go does not fully support.

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
