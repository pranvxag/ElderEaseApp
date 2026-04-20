# ElderEase — Project Report
Release: V2.3.0-CS-01-20/04
Branch: V2.2.0-CS-01-18/02 (working)
Status: In development — version updated for today’s work
Generated: 2026-04-20

---

## Table of contents
- Executive summary
- Release summary
- App scope & audience
- Screens & routes
- Key components & UI primitives
- Hooks, stores and data flows
- Libraries & AI parsing logic
- Notifications & scheduling
- Design language & UI/UX decisions
- Data model & storage keys
- Project structure
- Build, run & platform notes
- Limitations & privacy considerations
- Recommendations & next steps
- Appendix: Key files & assets

---

## Executive summary
ElderEase is a mobile-first Expo app focused on medication reminders and simple elder-care workflows (scan prescriptions, upload lab reports, voice-assisted health entries, and an emergency flow). Current development is targeted at v2.3.0-CS-01-20/04 and includes a modern in-app AI call experience for medication reminders alongside ongoing OCR and AI parsing improvements.

---

## Development status & roadmap

- Status: We have shifted to a new development cycle (post V2.2.0). Work is in progress on the `V2.x` line; as of this note, no functional changes have been merged to release.
- Focus areas (high level):
  - Add real OCR scanning (on-device + cloud fallbacks) to replace the current manual/paste-edit flow.
  - Integrate an AI-powered call/parse flow (prototype in simulation mode, then wire to a real LLM endpoint) to improve extraction for prescriptions and lab reports.
  - Migrate heuristic parsers to a hybrid OCR+AI pipeline using cleaned OCR text as AI input.
  - Add explicit privacy/consent UI for voice and OCR uploads and document data flows.
  - Device QA (iOS/Android) for notifications, TTS/STT and camera/scan flows.

### Short roadmap
1. Prototype OCR integration (local proof-of-concept). 
2. Prototype AI-call simulation + parsing improvements.
3. Wire AI provider, add secure secrets handling and opt-in consent flows.
4. Beta device testing and accessibility audit.

---

## Release summary (what changed in V2.2.0-CS-01-18/02)
- New screens: Onboarding, Profile, Scan hub, Scan Prescription, Upload Report, AI Call, improved Emergency tab.
- Scan + upload workflow for prescriptions and lab reports (camera + image picker fallback).
- Prescription parsing → automatic medication creation.
- Report parsing → extract blood-sugar values and persist readings.
- AI call demo → TTS prompt, editable transcript, numeric extraction and saving.
- Ongoing v2.3.0 work: modern full-screen AI health call UI and richer simulated call flow.
- Persistent health data via a local store and out-of-range push alerts.
- Tab navigation updated to include Scan and AI Call; prescription/report screens hidden from tab bar.

---

## App scope & audience
- Target users: seniors (65+) and their caregivers.
- Primary features: medication reminders, adherence tracking, routine tracking, quick emergency actions, simple ways to capture blood-sugar readings (OCR, AI-assisted voice), offline-first local storage.
- No backend authentication or remote sync included (local-only model).

---

## Screens & routes (overview)
Main routing uses Expo Router with two layouts:
- Root layout: `app/_layout.tsx` — redirects to onboarding if not onboarded.
- Tabs layout: `app/(tabs)/_layout.tsx` — manages bottom tabs and header.

Primary screens:
- Onboarding (`app/onboarding.tsx`): collects elder name, caregiver name & phone, reminder lead time, and whether reminders are enabled. Persists to local profile store and marks onboarding complete.
- Home (`app/(tabs)/index.tsx`): greeting banner, streak, quick stats (med adherence, routine percent, SOS), upcoming medications, routine snapshot, daily health tip, emergency quick banner with latest blood-sugar.
- Medications (`app/(tabs)/medications.tsx`): list of medications, add med modal, mark taken (increments streak and status), delete med (with notif cancel). Uses `useMedications` hook.
- Routine (`app/(tabs)/routine.tsx`): routine items snapshot, progress bars, share weekly report via native Share API, stores last report send timestamp.
- Scan hub (`app/(tabs)/scan.tsx`): central hub to choose between scanning/uploading prescription or report, auto-launch camera on native runtimes.
- Scan Prescription (`app/(tabs)/scan-prescription.tsx`): pick or scan image, paste/edit OCR text, parse with `parsePrescription`, create medication reminders via `useMedications`.
- Upload Report (`app/(tabs)/upload-report.tsx`): pick or scan image, paste/edit OCR text, extract lab values via `parseLabReport`, save blood-sugar entries via `useHealthData`.
- AI Call (`app/(tabs)/ai-call.tsx`): TTS prompt (Hindi example), editable transcript, parse numeric sugar via `extractSugarFromText`, save as health entry.
- Emergency (`app/(tabs)/emergency.tsx`): warning banner, latest BG strip (from `useHealthData.latest`), large pulsating SOS button with 5s countdown and call flow, quick actions (call 112/108/primary), emergency contacts list.
- Profile (`app/(tabs)/profile.tsx`): view/edit profile fields, reminder lead time, toggles for reminders and voice consent.

Auxiliary:
- Modal screen `app/modal.tsx` used by Stack.
- Hidden screens `scan-prescription` & `upload-report` are accessible from Scan hub (excluded from tab bar).

---

## Key components & UI primitives
- Themed primitives:
  - ThemedText (`components/themed-text.tsx`) and ThemedView (`components/themed-view.tsx`) — unify light/dark color selection via `useThemeColor`.
  - useThemeColor uses `useColorScheme()` to choose Colors.light/dark tokens.
- Icons:
  - Small brand icons: AICallLogo, ScanLogo, UploadReportLogo (`components/icons/*`) — simple text-shape badges.
  - IconSymbol fallback components: `components/ui/icon-symbol.ios.tsx` (SF Symbols) and `components/ui/icon-symbol.tsx` (MaterialIcons fallback).
- Navigation UI:
  - Bottom tabs layout with custom TabIcon wrapper for active states (`app/(tabs)/_layout.tsx`).
  - HapticTab (`components/haptic-tab.tsx`) provides light haptics on iOS tab press.
- Layout / UX helpers:
  - ParallaxScrollView (`components/parallax-scroll-view.tsx`) — animated header + content, used when needed.
  - Collapsible (`components/ui/collapsible.tsx`) — simple expand/collapse blocks.
- Cards, badges and buttons are implemented within screen files with consistent tokens from `constants/theme.ts`.

---

## Hooks, stores and data flows
- useStoredState (`hooks/useStorage.ts`)
  - Wraps AsyncStorage with local in-memory `storageSubscribers` (Map) to keep multiple hook instances in sync.
  - Exposes `storageGet`, `storageSet`, `storageRemove`.
  - Standard interface: `[value, setValue, loading] = useStoredState(key, defaultValue)`.
  - Storage keys (STORAGE_KEYS):
    - `elderease:medications`
    - `elderease:routine`
    - `elderease:notification_map`
    - `elderease:user_profile`
    - `elderease:onboarded`
    - `elderease:last_report_sent`
    - `elderease:blood_sugar_entries`
- useMedications (`hooks/useMedications.ts`)
  - Primary logic for medications array: addMedication, markTaken, deleteMed.
  - Maintains a notification map (medId → notificationId) persisted in storage.
  - On mount, requests notification permission and schedules reminders for meds missing scheduled notifications.
  - When adding a med, schedules notif (if permission).
  - Deletes cancel scheduled notification if mapping exists.
- useProfile (`hooks/useProfile.ts`): thin wrapper over useStoredState for USER_PROFILE.
- useHealthData (`hooks/useHealthData.ts`):
  - Stores `BloodSugarEntry[]` in storage key `elderease:blood_sugar_entries`.
  - addEntry constructs entry, prepends to array, triggers `sendBloodSugarAlert` (out-of-range if value < 70 or >= 180).
  - Exposes `entries`, `addEntry`, `clear`, `latest`, `loading`.

---

## Libraries & AI parsing logic
- AI/utils are minimal heuristics bundled in `lib/ai`:
  - `parse.ts`
    - normalizeDevanagariDigits: maps Devanagari digits (०–९) to ASCII equivalents for better numeric parsing.
    - extractSugarFromText: regex to find explicit sugar phrases (Hindi/English) and fallback to first 2–3 digit number.
  - `parsePrescription.ts`
    - Line-based heuristics: splits text, removes headers like `Rx`, detects dosage via dosageRegex and pillCountRegex, returns ParsedMed[] with `name`, optional `dosage`, and raw line.
    - Good for quick OCR->med heuristics but not foolproof.
  - `parseReport.ts`
    - Looks for patterns like "blood sugar", "random blood sugar", "fasting blood sugar", and Hindi 'शुगर' with numeric capture; returns LabValue[] including `key: blood_sugar`.
- These utilities intentionally use regex/heuristic-based parsing — lightweight and fully client-side.

---

## Notifications & scheduling
- Implementations: `lib/notifications.ts`
  - Foreground handler configured to show alerts, play sound, set badge.
  - requestNotificationPermission: returns false on web or emulator; requires physical device (uses expo-device).
  - Android channel: `medication-reminders`, importance HIGH, vibration pattern, sound.
  - `parseTime` supports `(\d{1,2}):(\d{2})\s*(AM|PM)` for times like "9:00 AM".
  - `scheduleMedicationReminder(med)` schedules daily repeating notifications using `Notifications.scheduleNotificationAsync` with trigger type `Notifications.SchedulableTriggerInputTypes.DAILY`.
  - `cancelMedicationReminder`, `scheduleAllReminders`, `cancelAllReminders` helpers provided.
  - `sendStreakReminderNow` and `sendBloodSugarAlert` (out-of-range alert) included for immediate nudges.

---

## Design language & UI/UX
- Theme tokens in `constants/theme.ts`:
  - Brand palette: primary `#1A7A6E` (teal/green), accent `#F5A623`, emergency red `#D93025`.
  - High-contrast neutrals and warm background `#F5F0EA`.
  - Large typography tokens: FontSizes (xs 14 → display 36) are intentionally large for readability.
  - Spacing tokens: base 16, larger margins/padding for touch targets.
  - Radii and shadows tuned for approachable components.
- UX decisions:
  - Large labels, high contrast, explicit emojis and icons for immediate recognition.
  - Big emergency CTA with visual pulse and countdown to reduce accidental triggers.
  - Simple, shallow navigation — key flows accessible within 1–2 taps.
  - Voice assistance (AI Call) enabled only with explicit `voiceConsent` flag in profile.
  - Haptic feedback for tabs on iOS for tactile confirmation.
- Accessibility:
  - Larger font sizes and padded touch targets.
  - Clear primary/secondary/disabled color states.
  - Voice prompt and transcript editing supports users with low vision or motor limitations (but real TTS/STT requires a device).

---

## Data model & storage keys (summary)
Primary interfaces are defined in `constants/data.ts`:
- Medication
  - id, name, dosage, time (string '9:00 AM'), frequency, color, status (upcoming/taken/missed/skipped), purpose, streak, instructions?
- UserProfile
  - name, caregiverName, caregiverPhone, remindersEnabled, reminderLeadMinutes, voiceConsent?
- BloodSugarEntry
  - id, value, unit ('mg/dL'|'mmol/L'), timestamp, source, transcript, note
- RoutineItem & EmergencyContact are also defined with sample MOCK data.

Persistent keys (`hooks/useStorage.ts`):
- elderease:medications
- elderease:routine
- elderease:notification_map
- elderease:user_profile
- elderease:onboarded
- elderease:last_report_sent
- elderease:blood_sugar_entries

---

## Build, run & dev notes
- Install:
```bash
npm install
```

## Project structure
- `/app`
  - `_layout.tsx`
  - `modal.tsx`
  - `onboarding.tsx`
  - `(tabs)/_layout.tsx`
  - `(tabs)/ai-call.tsx`
  - `(tabs)/emergency.tsx`
  - `(tabs)/index.tsx`
  - `(tabs)/medications.tsx`
  - `(tabs)/profile.tsx`
  - `(tabs)/routine.tsx`
  - `(tabs)/scan-prescription.tsx`
  - `(tabs)/scan.tsx`
  - `(tabs)/upload-report.tsx`
- `/components`
  - `external-link.tsx`
  - `haptic-tab.tsx`
  - `hello-wave.tsx`
  - `parallax-scroll-view.tsx`
  - `themed-text.tsx`
  - `themed-view.tsx`
  - `icons/AICallLogo.tsx`
  - `icons/ScanLogo.tsx`
  - `icons/UploadReportLogo.tsx`
  - `ui/collapsible.tsx`
  - `ui/icon-symbol.ios.tsx`
  - `ui/icon-symbol.tsx`
- `/constants`
  - `data.ts`
  - `theme.ts`
- `/hooks`
  - `use-color-scheme.ts`
  - `use-color-scheme.web.ts`
  - `use-theme-color.ts`
  - `useHealthData.ts`
  - `useMedications.ts`
  - `useProfile.ts`
  - `useStorage.ts`
- `/lib`
  - `notifications.ts`
  - `ai/parse.ts`
  - `ai/parsePrescription.ts`
  - `ai/parseReport.ts`
- `/assets/images`
  - `android-icon-background.png`
  - `android-icon-foreground.png`
  - `android-icon-monochrome.png`
  - `favicon.png`
  - `icon.png`
  - `partial-react-logo.png`
  - `react-logo.png`
  - `react-logo@2x.png`
  - `react-logo@3x.png`
  - `splash-icon.png`
- `/scripts/reset-project.js`
- project metadata: `app.json`, `package.json`, `tsconfig.json`, `babel.config.js`, `eas.json`, `eslint.config.js`, `expo-env.d.ts`, `README.md`

## Today’s changes (v2.3.0-CS-01-20/04)
- Updated the AI call feature in `app/(tabs)/ai-call.tsx` with a modern in-app call UI and enhanced simulated health call workflow.
- Added full project structure documentation to this report.
- Revised report metadata for today’s version and development status.
- Continued work on turn-based AI audio pipeline, Twilio integration, and device/privacy QA.

## Limitations & privacy considerations
