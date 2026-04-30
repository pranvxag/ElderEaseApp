# ElderEase Authentication System - Architecture & Flow Diagrams

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         ELDEREASE APP                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────┐                                           │
│  │  App Screens     │                                           │
│  │  (tabs, pages)   │                                           │
│  └────────┬─────────┘                                           │
│           │ useAuth()                                           │
│           │                                                     │
│  ┌────────▼──────────────────────────────────────────────────┐ │
│  │ Route Guards (app/_layout.tsx)                           │ │
│  │ - Check: user logged in? ✓                              │ │
│  │ - Check: phone verified? ✓                              │ │
│  │ - Check: onboarded? ✓                                  │ │
│  │ - Auto-navigate to correct screen                      │ │
│  └────────┬───────────────────────────────────────────────┬─┘ │
│           │                                               │    │
│  ┌────────▼────────────────┐            ┌────────────────▼──┐ │
│  │ Auth Context (useAuth)  │            │  Auth Screens     │ │
│  │                         │            │                   │ │
│  │ State:                  │            │ • login.tsx       │ │
│  │ • user                  │            │ • phone.tsx       │ │
│  │ • phoneVerified         │            │ • otp.tsx         │ │
│  │ • phoneVerificationInProg         │ • phone-edit.tsx │ │
│  │                         │            │ • phone-edit-otp │ │
│  │ Methods:                │            │                   │ │
│  │ • signInWithGoogle()    │            └─────────┬──────────┘ │
│  │ • startPhoneVerif()     │                      │            │
│  │ • confirmPhoneVerif()   │                      │            │
│  │ • signOut()             │                      │            │
│  └────────┬────────────────┘                      │            │
│           │                                       │            │
│           │ Firebase Auth                         │            │
│           │ (Google + Phone)                      │            │
│  ┌────────▼──────────────────────────────────────▼──────────┐  │
│  │  Firebase Authentication                                  │  │
│  │  ├─ Google Sign-In (via @react-native-google-signin)    │  │
│  │  ├─ Phone Authentication (Firebase SMS OTP)             │  │
│  │  └─ Session Persistence (AsyncStorage)                 │  │
│  └────────┬──────────────────────────────────────────────┬──┘  │
│           │                                              │     │
│           │ user.uid, user.phoneNumber                  │     │
│  ┌────────▼──────────────────────────────────────────────▼──┐  │
│  │  Firestore                                              │  │
│  │                                                         │  │
│  │  /users/{uid}                                          │  │
│  │  ├─ uid: string                                        │  │
│  │  ├─ email: string                                      │  │
│  │  ├─ displayName: string                                │  │
│  │  ├─ phoneNumber: string | null                         │  │
│  │  ├─ phoneVerified: boolean                             │  │
│  │  ├─ createdAt: timestamp                               │  │
│  │  └─ updatedAt: timestamp                               │  │
│  │                                                         │  │
│  │  /users/{uid}/profile/data                             │  │
│  │  ├─ displayName, email, photoURL                       │  │
│  │  ├─ phoneNumber (mirrors main doc)                     │  │
│  │  ├─ preferredLanguage: 'en' | 'hi' | 'mr'             │  │
│  │  ├─ emergencyContacts: []                              │  │
│  │  ├─ medicines: []                                      │  │
│  │  └─ updatedAt: timestamp                               │  │
│  │                                                         │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Authentication Flow Diagram

```
START
  │
  ├─ user logged in?
  │  ├─ NO  ──┬──────────────────────────────┐
  │  │        │                              │
  │  │        ▼                              │
  │  │   ┌──────────────────┐                │
  │  │   │  LOGIN SCREEN    │                │
  │  │   │  (login.tsx)     │                │
  │  │   │                  │                │
  │  │   │ [Google Sign-In] │                │
  │  │   └────────┬─────────┘                │
  │  │            │                          │
  │  │            ▼ (Success)                │
  │  │
  │  └─ YES ──┬────────────────────────────────┐
  │           │                                 │
  │           ▼                                 │
  │    phone verified?                         │
  │    ├─ NO  ──┬───────────────────────────┐  │
  │    │        │                           │  │
  │    │        ▼                           │  │
  │    │   ┌──────────────────┐             │  │
  │    │   │  PHONE SCREEN    │             │  │
  │    │   │  (phone.tsx)     │             │  │
  │    │   │                  │             │  │
  │    │   │ [Enter Phone]    │             │  │
  │    │   │ [Send OTP]       │             │  │
  │    │   └────────┬─────────┘             │  │
  │    │            │                       │  │
  │    │            ▼                       │  │
  │    │   ┌──────────────────┐             │  │
  │    │   │  OTP SCREEN      │             │  │
  │    │   │  (otp.tsx)       │             │  │
  │    │   │                  │             │  │
  │    │   │ [Enter 6-Digit]  │             │  │
  │    │   │ [Verify OTP]     │             │  │
  │    │   │ [Resend Timer]   │             │  │
  │    │   └────────┬─────────┘             │  │
  │    │            │                       │  │
  │    │            ▼ (Success)             │  │
  │    │   ┌──────────────────┐             │  │
  │    │   │ Create/Update:   │             │  │
  │    │   │ users/{uid}      │             │  │
  │    │   │ phoneVerified: ✓ │             │  │
  │    │   └────────┬─────────┘             │  │
  │    │            │                       │  │
  │    └─ YES ──────┴───────────────────────┘  │
  │           │                                 │
  │           ▼                                 │
  │    onboarded?                              │
  │    ├─ NO  ──┐                              │
  │    │        │                              │
  │    │        ▼                              │
  │    │   ┌──────────────────┐                │
  │    │   │ ONBOARDING SCREEN│                │
  │    │   │ (onboarding.tsx) │                │
  │    │   └────────┬─────────┘                │
  │    │            │                          │
  │    │            ▼                          │
  │    │   Mark: onboarded ✓                  │
  │    │            │                          │
  │    └─ YES ──────┴──────┐                  │
  │                        │                  │
  │                        ▼                  │
  │                  ┌──────────────┐         │
  │                  │  TABS HOME   │         │
  │                  │ (tabs/index) │         │
  │                  │              │         │
  │                  │ • Emergency  │         │
  │                  │ • Scan       │         │
  │                  │ • AI Call    │         │
  │                  │ • Meds       │         │
  │                  │ • Profile    │         │
  │                  └──────────────┘         │
  │                        │                  │
  │                        ▼                  │
  │                   [IN APP]                │
  │                        │                  │
  │                        ├──EditPhone──┐    │
  │                        │             │    │
  │                        │             ▼    │
  │                        │        ┌──────────────────┐
  │                        │        │  PHONE-EDIT SCR  │
  │                        │        │ (phone-edit.tsx) │
  │                        │        │                  │
  │                        │        │ [Enter New Phone]│
  │                        │        │ [Send OTP]       │
  │                        │        └────────┬─────────┘
  │                        │                 │
  │                        │                 ▼
  │                        │        ┌──────────────────┐
  │                        │        │  PHONE-EDIT-OTP  │
  │                        │        │ (phone-edit-otp) │
  │                        │        │                  │
  │                        │        │ [Verify OTP]     │
  │                        │        └────────┬─────────┘
  │                        │                 │
  │                        │                 ▼
  │                        │        Update: users/{uid}
  │                        │        phoneNumber: new
  │                        │                 │
  │                        └─────────────────┘
  │                             │
  │                             ▼
  │                       [CONTINUE IN APP]
  │
  └─────────────────────────────────────────►  END (User in App)

SignOut:
  [Profile] → [Sign Out] → Clear Auth + Firestore → Route Guard → Login
```

---

## 📱 Screen State Machine

```
LOGIN SCREEN
│
├─ [Google Sign-In]
│  ├─ Network Error → Show error, allow retry
│  ├─ Sign Cancelled → Return to login
│  └─ Success → Firebase User Created
│
└─ Auto-navigate to PHONE SCREEN (due to phoneVerified = false)

PHONE SCREEN  
│
├─ [Send OTP]
│  ├─ Validation Error → Show "Invalid phone number"
│  ├─ Network Error → Show "Failed to send OTP"
│  └─ Success
│
└─ Auto-navigate to OTP SCREEN + pass verificationId

OTP SCREEN
│
├─ [Verify OTP]
│  ├─ Format Error → Show "Enter 6-digit code"
│  ├─ OTP Error → Show "Invalid OTP", allow retry
│  └─ Success → Phone verified in Firestore
│
├─ [Resend OTP] (after 30s countdown)
│  └─ Success → Reset timer
│
└─ Auto-navigate to ONBOARDING (if needed) or TABS

PROFILE SCREEN → [Change Phone]
│
└─ Navigate to PHONE-EDIT SCREEN

PHONE-EDIT SCREEN
│
├─ [Send OTP]
│  └─ Success → Pass to PHONE-EDIT-OTP SCREEN
│
└─ Navigate to PHONE-EDIT-OTP SCREEN

PHONE-EDIT-OTP SCREEN
│
├─ [Verify OTP]
│  ├─ Success → Update user/profile docs
│  └─ Return to PROFILE SCREEN
│
└─ Show updated phone number
```

---

## 🔐 Data Flow Diagram

```
User Taps "Continue with Google"
         │
         ▼
    useAuth.signInWithGoogle()
         │
         ├─ Android: GoogleSignin.signIn()
         │ └─ Returns: idToken
         │    │
         │    ▼
         │ signInWithCredential(auth, credential)
         │
         └─ Web/iOS: signInWithPopup(auth, provider)
                     │
                     ▼
              Returns: Firebase User
         │
         ▼
    ensureUserProfile(firebaseUser)
         │
         ├─ Check: Document exists at users/{uid}?
         │
         ├─ NO  → Create new user document:
         │        users/{uid} = {
         │          uid, email, displayName,
         │          phoneNumber: null,
         │          phoneVerified: false,
         │          createdAt, updatedAt
         │        }
         │
         │ YES → Update existing:
         │        users/{uid} = {
         │          email (latest), displayName,
         │          updatedAt
         │        }
         │
         ├─ Check: Profile sub-doc exists?
         │  └─ NO → Create: users/{uid}/profile/data
         │  └─ YES → Skip (exists)
         │
         └─ Call: registerPushToken(uid)
            └─ Get Expo push token → Save to profile

Route Guard (app/_layout.tsx)
         │
         ├─ Check: user != null? ✓
         │
         └─ Check: phoneVerified = true?
            ├─ NO  → Redirect to /(auth)/phone
            │        │
            │        ▼
            │   User enters phone + taps "Send OTP"
            │        │
            │        ├─ Validate: 10-digit number ✓
            │        │
            │        ▼
            │   startPhoneVerification("+919876543210")
            │        │
            │        ├─ Web: RecaptchaVerifier → SMS
            │        └─ Native: PhoneAuthProvider → SMS
            │           │
            │           └─ Returns: verificationId
            │              │
            │              ▼
            │   Navigate to /(auth)/otp
            │   Pass: verificationId, phoneNumber
            │
            │        ▼
            │   User receives SMS + enters OTP
            │        │
            │        ▼
            │   confirmPhoneVerification(verificationId, "123456")
            │        │
            │        ├─ Verify OTP ✓
            │        │
            │        ├─ linkWithCredential(user, credential)
            │        │  └─ Links phone to Firebase User
            │        │
            │        ├─ Update Firestore:
            │        │  users/{uid} = {
            │        │    phoneNumber: "+919876543210",
            │        │    phoneVerified: true,
            │        │    updatedAt: now
            │        │  }
            │        │
            │        └─ Update profile/data = {
            │           phoneNumber: "+919876543210",
            │           updatedAt: now
            │        }
            │
            └─ YES → Check: onboarded = true?
               ├─ NO  → Redirect to /onboarding
               └─ YES → Redirect to /(tabs)
```

---

## 🔗 Component Dependency Graph

```
RootLayout (app/_layout.tsx)
│
├─ AuthProvider
│  │
│  ├─ useAuth Hook (Firebase, Firestore)
│  │  │
│  │  ├─ signInWithGoogle()
│  │  │  └─ @react-native-google-signin
│  │  │
│  │  ├─ startPhoneVerification()
│  │  │  └─ Firebase Phone Auth
│  │  │
│  │  └─ confirmPhoneVerification()
│  │     └─ Firebase Firestore (update)
│  │
│  └─ RootLayoutContent
│     │
│     ├─ useCloudSync()
│     ├─ useStoredState() (onboarded flag)
│     │
│     └─ Navigation Stack
│        │
│        ├─ (auth) Stack
│        │  ├─ login.tsx
│        │  │  └─ useAuth()
│        │  ├─ phone.tsx
│        │  │  └─ useAuth()
│        │  └─ otp.tsx
│        │     └─ useAuth()
│        │
│        ├─ (tabs) Stack
│        │  ├─ profile.tsx
│        │  │  ├─ useAuth()
│        │  │  ├─ useUserProfile()
│        │  │  └─ profile/ Stack
│        │  │     ├─ phone-edit.tsx
│        │  │     │  └─ useAuth()
│        │  │     └─ phone-edit-otp.tsx
│        │  │        └─ useAuth()
│        │  │
│        │  └─ [other tabs...]
│        │
│        └─ onboarding.tsx
```

---

## 🔄 State Management Flow

```
Firebase Auth State Change
         │
         ▼
   onAuthStateChanged listener
         │
         ├─ Sets: user = FirebaseUser | null
         ├─ Sets: loading = false
         │
         └─ Calls: ensureUserProfile()
                   │
                   └─ Checks Firestore → Sets: phoneVerified
                      │
                      ▼
                   Component re-renders
                      │
                      ▼
                   Route Guard runs
                      │
                      └─ Checks user, phoneVerified, onboarded
                         │
                         ▼
                      Navigation Decision
                         │
                         ├─ Not logged in → /(auth)/login
                         ├─ No phone → /(auth)/phone
                         ├─ Not onboarded → /onboarding
                         └─ Fully ready → /(tabs)
```

---

## 🌐 Network Flow Diagram

```
Mobile App
    │
    ├─ Google Sign-In (via Firebase SDK)
    │  └─ google.com
    │     └─ Returns: idToken
    │
    ├─ Firebase Authentication
    │  └─ signInWithCredential(auth, credential)
    │     └─ *.firebaseapp.com
    │        └─ Returns: Firebase User
    │
    ├─ Firebase Phone Auth
    │  ├─ startPhoneVerification(phone)
    │  │  └─ *.firebaseapp.com
    │  │     └─ Triggers: SMS to phone
    │  │
    │  └─ confirmPhoneVerification(verificationId, otp)
    │     └─ *.firebaseapp.com
    │        └─ Verifies OTP
    │
    └─ Firestore
       ├─ Create: users/{uid}
       ├─ Update: users/{uid}
       ├─ Create: users/{uid}/profile/data
       └─ Update: users/{uid}/profile/data
          └─ *.firebaseio.com
```

---

## ✅ Implementation Checklist

```
✓ Firebase Authentication (Google Sign-In)
✓ Firebase Phone Authentication (OTP via SMS)
✓ Firestore User Documents
  ├─ users/{uid} (main user doc)
  └─ users/{uid}/profile/data (profile sub-doc)
✓ useAuth Context Hook
  ├─ signInWithGoogle()
  ├─ startPhoneVerification()
  ├─ confirmPhoneVerification()
  └─ signOut()
✓ Route Guards
  ├─ Not logged in → login
  ├─ No phone verified → phone verification
  ├─ Not onboarded → onboarding
  └─ Fully ready → tabs
✓ Auth Screens
  ├─ Login (Google Sign-In)
  ├─ Phone (Number Input)
  ├─ OTP (Verification)
  ├─ Phone Edit (From Profile)
  └─ Phone Edit OTP (Verify New Phone)
✓ Profile Integration
  ├─ Display phone number
  ├─ Edit button
  ├─ Same OTP verification flow
  └─ Updates Firestore
✓ Error Handling
  ├─ Validation errors
  ├─ Network errors
  ├─ Auth errors
  └─ User-friendly messages
✓ Loading States
  ├─ Spinners during async ops
  ├─ Button disabling
  └─ Form disable during submission
✓ Session Persistence
  ├─ AsyncStorage (Android/iOS)
  ├─ Browser Storage (Web)
  └─ Auto-restore on app reopen
✓ Type Safety
  ├─ TypeScript throughout
  ├─ Firebase types
  └─ Custom type definitions
✓ Documentation
  ├─ AUTH_SYSTEM_GUIDE.md
  ├─ AUTH_API_REFERENCE.md
  ├─ AUTHENTICATION_IMPLEMENTATION.md
  └─ Inline code comments
```

---

This architecture is **production-ready** and supports the complete authentication flow for ElderEase.
