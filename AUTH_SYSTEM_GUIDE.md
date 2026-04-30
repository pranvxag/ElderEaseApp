# ElderEase Authentication System - Setup & Integration Guide

## Overview

A complete, production-ready authentication system has been implemented with the following flow:

1. **User not logged in** → Google Sign-In screen
2. **After Google Sign-In** → Check phone verification status in Firestore
3. **If phone not verified** → Phone number input + OTP verification flow
4. **After verification** → Onboarding or App (tabs)
5. **In Profile** → Phone number display with option to change (same OTP flow)

## Completed Files

### Core Authentication

- **`hooks/useAuth.tsx`** - Main auth context with phone verification methods
  - `signInWithGoogle()` - Google authentication
  - `startPhoneVerification(phoneNumber)` - Send OTP
  - `confirmPhoneVerification(verificationId, otp)` - Verify OTP & update Firestore
  - `phoneVerified` - Boolean state for route guards
  - Handles Firebase user document creation and profile initialization

- **`types/user.ts`** - Updated UserProfile type
  - Added `phoneNumber?: string`
  - Added `phoneVerified?: boolean`

### Authentication Screens

- **`app/(auth)/_layout.tsx`** - Auth folder layout (new)
  - Manages navigation between login, phone, and OTP screens

- **`app/(auth)/login.tsx`** - Google Sign-In screen (renamed from auth.tsx)
  - Large, clear CTA button
  - Configuration validation
  - Error handling with user-friendly messages
  - Info box explaining benefits

- **`app/(auth)/phone.tsx`** - Phone number input
  - Country code selector (+91 default)
  - 10-digit number validation
  - Formatted display while typing
  - Hint text and error messages
  - Info box with why we need it

- **`app/(auth)/otp.tsx`** - OTP verification
  - 6-digit OTP input with letter spacing
  - Resend button with 30-second countdown timer
  - Phone number confirmation display
  - Tips section (OTP expiry, SMS rates, etc.)
  - Back button to change phone number

### Profile Phone Management

- **`app/(tabs)/profile/phone-edit.tsx`** - Edit phone from profile
  - Shows current phone number
  - Input for new phone number
  - Same validation as initial phone screen
  - Initiates OTP verification

- **`app/(tabs)/profile/phone-edit-otp.tsx`** - Verify new phone
  - Same OTP input as auth flow
  - Updates phone in Firestore upon success
  - Returns to profile screen

- **`app/(tabs)/profile/_layout.tsx`** - Profile folder layout (new)
  - Manages nested profile screens

### Navigation & Route Guards

- **`app/_layout.tsx`** - Updated root layout
  - Enhanced route guards checking `phoneVerified` state
  - Flow:
    1. Not logged in → `/(auth)` (shows login)
    2. Logged in but no phone verified → `/(auth)/phone`
    3. Fully verified but not onboarded → `/onboarding`
    4. Fully verified and onboarded → `/(tabs)`
  - Prevents redirect loops with careful segment checking

### Profile Screen

- **`app/(tabs)/profile.tsx`** - Updated to show phone
  - New `PhoneInfoRow` component for editable phone display
  - "Change" button navigates to phone-edit
  - Phone status shows "Not verified" if empty, else shows number

## Firestore Data Structure

User documents are created/updated at `users/{uid}` with structure:

```typescript
{
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  phoneNumber?: string;          // null until verified
  phoneVerified: boolean;        // false by default
  createdAt: string;             // ISO timestamp
  updatedAt: string;             // ISO timestamp
}
```

Profile sub-document at `users/{uid}/profile/data`:

```typescript
{
  displayName: string;
  email: string;
  photoURL?: string;
  phoneNumber?: string;          // mirrors main doc
  preferredLanguage: 'en' | 'hi' | 'mr';
  emergencyContacts: EmergencyContact[];
  medicines: Medicine[];
  updatedAt: string;
}
```

## Key Features

✅ **Security**
- Firebase Phone Authentication with OTP verification
- Phone credentials linked to user account
- Firestore security rules can be configured per your requirements

✅ **User Experience**
- Clear, step-by-step flow
- Helpful error messages and hints
- Resend OTP timer to prevent abuse
- Back buttons and cancellation options
- Loading states during async operations

✅ **Accessibility**
- Phone input with country code prefix
- Clear typography and spacing (uses theme constants)
- Sufficient contrast ratios
- Keyboard-aware views (KeyboardAvoidingView on auth screens)

✅ **Production-Ready Code**
- Full TypeScript typing
- Comprehensive error handling
- Console logging for debugging
- Comments explaining complex logic
- Theme constants for consistent styling
- Proper cleanup in useEffect hooks

## Testing Checklist

- [ ] **Google Sign-In**
  - Tap "Continue with Google"
  - Sign in with Google account
  - Verify user redirected to phone screen

- [ ] **Phone Verification**
  - Enter 10-digit phone number
  - Verify formatting as you type
  - Tap "Send OTP"
  - Check SMS for 6-digit code
  - Enter OTP and tap "Verify OTP"
  - Verify success message and redirect to tabs

- [ ] **Route Guards**
  - Sign in → should go to phone (not verified)
  - After phone verification → should go to onboarding or tabs
  - Close and reopen app → should maintain auth state
  - Try navigating to protected routes directly → should redirect appropriately

- [ ] **Phone Edit from Profile**
  - Go to Profile tab
  - Find "Phone Number" section
  - Tap "Change" button
  - Enter new phone number
  - Verify OTP from new number
  - Check phone updated in profile

- [ ] **Sign Out**
  - Tap "Sign Out" in profile
  - Verify redirected to login screen
  - Verify Google sign-in state cleared
  - Sign in again should start fresh flow

## Integration Notes

### For Firebase Console Setup

No additional setup needed - Phone Authentication should already be enabled per requirements.

### For Environment Variables

Ensure `.env` has:
```
EXPO_PUBLIC_FIREBASE_API_KEY=...
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=...
EXPO_PUBLIC_FIREBASE_PROJECT_ID=...
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=...
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
EXPO_PUBLIC_FIREBASE_APP_ID=...
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=...
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=...
```

### For Custom Branding

- Update `app/(auth)/login.tsx` title and subtitle
- Update color references (using `Colors` from theme constants)
- Modify phone hint text if different country codes needed
- Update OTP expiry time in tips if your Firebase config differs

### For Security Rules (Firestore)

Consider adding rules like:

```
match /users/{uid} {
  allow read, write: if request.auth.uid == uid;
  allow read: if request.auth.uid != null; // let other users read basic info if needed
  
  match /profile/data {
    allow read, write: if request.auth.uid == uid;
  }
}
```

## Troubleshooting

### "Firebase Admin SDK not configured" in server logs
- This is expected if running without firebase-key.json
- Does not affect authentication flow

### OTP not received
- Check phone number format (+91 followed by 10 digits for India)
- Verify SMS access on device
- Wait a few seconds - OTP might be delayed
- Tap "Resend OTP" if countdown reaches zero

### Phone verification fails with "reCAPTCHA not configured"
- On web, you need to set up Firebase reCAPTCHA
- On native (iOS/Android), Firebase handles this automatically
- For development, test primarily on native platforms

### Route not navigating correctly
- Check that segments[0] comparison matches folder names: '(auth)', '(tabs)', 'onboarding'
- Verify `phoneVerified` state is updating (check Redux DevTools or Flipper)
- Check browser console for navigation errors

## Next Steps (Optional Enhancements)

1. **Phone number editing restrictions**
   - Limit to 1 change per month
   - Store last change timestamp

2. **SMS OTP customization**
   - Use Firebase Cloud Functions to customize OTP message text
   - Add branding to SMS if purchased premium

3. **Biometric authentication**
   - Add fingerprint/face unlock after first login
   - Use `expo-local-authentication`

4. **Two-factor authentication**
   - Add optional 2FA for sensitive operations
   - Store backup codes

5. **Phone-based sign-in**
   - Allow signing in with phone number + OTP instead of Google
   - Store phone as optional auth method

## File Structure Summary

```
app/
├── _layout.tsx (UPDATED: route guards + phone verification)
├── (auth)/
│   ├── _layout.tsx (NEW: auth folder layout)
│   ├── login.tsx (NEW: Google Sign-In)
│   ├── phone.tsx (NEW: Phone input)
│   └── otp.tsx (NEW: OTP verification)
├── (tabs)/
│   ├── profile.tsx (UPDATED: phone display + edit button)
│   └── profile/
│       ├── _layout.tsx (NEW: profile folder layout)
│       ├── phone-edit.tsx (NEW: phone edit form)
│       └── phone-edit-otp.tsx (NEW: verify new phone)

hooks/
├── useAuth.tsx (UPDATED: phone auth methods)

types/
└── user.ts (UPDATED: phoneNumber, phoneVerified fields)
```

---

**Last Updated**: Implementation complete with all screens, route guards, and Firestore integration
