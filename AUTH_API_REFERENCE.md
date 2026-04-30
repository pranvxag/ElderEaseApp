# Authentication API Quick Reference

## useAuth Hook

Import and use the authentication context throughout your app:

```typescript
import { useAuth } from '@/hooks/useAuth';

function MyComponent() {
  const {
    user,                                    // Firebase User object (null if not logged in)
    loading,                                // Auth loading state
    configured,                             // Whether Firebase is configured
    phoneVerified,                          // Boolean: has phone been verified?
    phoneVerificationInProgress,            // Boolean: OTP verification in progress?
    signInWithGoogle,                       // async () => Promise
    signOut,                                // async () => Promise
    startPhoneVerification,                 // async (phoneNumber: string) => Promise
    confirmPhoneVerification,               // async (verificationId, otp) => Promise
  } = useAuth();
}
```

## Core Methods

### Sign In with Google

```typescript
const handleGoogleSignIn = async () => {
  const result = await signInWithGoogle();
  if (!result.ok) {
    console.error('Sign-in failed:', result.message);
  }
  // On success, route guards automatically handle navigation
};
```

**Returns**: `{ ok: boolean; message?: string }`

### Start Phone Verification (Send OTP)

```typescript
const handleSendOTP = async (phoneNumber: string) => {
  // phoneNumber should be like "+919876543210"
  const result = await startPhoneVerification(phoneNumber);
  
  if (!result.ok) {
    console.error('Failed to send OTP:', result.message);
    return;
  }
  
  // Store verificationId for next step
  const { verificationId } = result;
  
  // Navigate to OTP verification screen
  router.push({
    pathname: '/(auth)/otp',
    params: { verificationId, phoneNumber }
  });
};
```

**Returns**: `{ ok: boolean; message?: string; verificationId?: string }`

### Confirm Phone Verification (Verify OTP)

```typescript
const handleVerifyOTP = async (verificationId: string, otp: string) => {
  // otp should be 6 digits like "123456"
  const result = await confirmPhoneVerification(verificationId, otp);
  
  if (!result.ok) {
    console.error('Invalid OTP:', result.message);
    return;
  }
  
  // Success! User is now fully authenticated
  // Route guards will automatically navigate to next screen
};
```

**Returns**: `{ ok: boolean; message?: string }`

### Sign Out

```typescript
const handleSignOut = async () => {
  await signOut();
  // Route guards automatically redirect to login
};
```

## Conditional Rendering Examples

### Show content only if authenticated and phone verified

```typescript
function ProtectedScreen() {
  const { user, phoneVerified, loading } = useAuth();
  
  if (loading) return <LoadingSpinner />;
  if (!user || !phoneVerified) return <AccessDenied />;
  
  return <AppContent />;
}
```

### Show different UI based on phone verification state

```typescript
function AuthStatusBadge() {
  const { user, phoneVerified } = useAuth();
  
  if (!user) {
    return <Text>Not logged in</Text>;
  }
  
  if (!phoneVerified) {
    return <Text>Phone verification pending</Text>;
  }
  
  return <Text>Fully verified</Text>;
}
```

## Route Guard Flow

The app automatically enforces this navigation flow via `app/_layout.tsx`:

```
Start
  ↓
Is user logged in?
  ├─ NO  → show /(auth)/login
  └─ YES → Is phone verified?
       ├─ NO  → show /(auth)/phone → /(auth)/otp
       └─ YES → Is onboarded?
             ├─ NO  → show /onboarding
             └─ YES → show /(tabs) [HOME]
```

You don't need to manually navigate - just focus on the UI, and route guards handle the rest.

## Firestore Document Structure

When a user signs in, the following documents are created:

```typescript
// Main user document
users/{uid}
{
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  phoneNumber?: string;
  phoneVerified: boolean;
  createdAt: string;    // ISO timestamp
  updatedAt: string;    // ISO timestamp
}

// Profile sub-document (detailed info)
users/{uid}/profile/data
{
  displayName: string;
  email: string;
  photoURL?: string;
  phoneNumber?: string;  // mirrors main doc
  preferredLanguage: 'en' | 'hi' | 'mr';
  emergencyContacts: EmergencyContact[];
  medicines: Medicine[];
  updatedAt: string;
}
```

## Error Handling

All auth methods return `{ ok: boolean; message?: string }` structure:

```typescript
const result = await signInWithGoogle();

if (!result.ok) {
  // Show user-friendly error message
  Alert.alert('Error', result.message || 'Sign-in failed');
  
  // Log for debugging
  console.error('Auth error:', result.message);
}
```

Common error messages:
- "Sign-in was cancelled" - User tapped back button
- "Sign-in is in progress" - Wait for previous sign-in to complete
- "Google Play Services not available" - Android only, device issue
- "Could not extract sugar level from transcript" - AI call parsing error
- "Invalid OTP" - User entered wrong code, let them retry
- "Verification session expired" - Ask them to start over

## Phone Number Formatting

The system expects phone numbers in E.164 format:

```typescript
// Valid formats
"+919876543210"      // Full format with country code
"+1234567890"        // Any country code

// Invalid formats (will be rejected)
"9876543210"         // Missing country code
"919876543210"       // Country code without +
"+91 98765 43210"    // Spaces
```

The phone input screens handle formatting automatically:
- Accept 10-digit input for Indian numbers
- Automatically prepend +91
- Display with spacing for readability

## Testing in Development

### Firebase Emulator (if using local emulator)

Phone auth is NOT available in the Firebase emulator. Always test against live Firebase.

### Test Credentials

To test without receiving SMS:
1. Use a test phone number registered in Firebase Console
2. Firebase will show the OTP in the console instead of sending SMS

### Debugging Tips

```typescript
// Log auth state changes
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';

onAuthStateChanged(auth, (user) => {
  console.log('Auth state changed:', user?.uid);
});

// Check Firestore user document
import { getDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

const userDoc = await getDoc(doc(db, 'users', user.uid));
console.log('User doc:', userDoc.data());
```

## Types Reference

```typescript
// From Firebase
interface User {
  uid: string;
  email?: string;
  displayName?: string;
  photoURL?: string;
  phoneNumber?: string;  // Set after phone verification
  // ... other Firebase properties
}

// From our app
interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string;
  phoneNumber?: string;
  phoneVerified?: boolean;
  age?: string;
  bloodGroup?: string;
  allergies?: string;
  preferredLanguage: 'en' | 'hi' | 'mr';
  emergencyContacts: EmergencyContact[];
  medicines: Medicine[];
  createdAt: string;
  updatedAt: string;
}
```

## Best Practices

✅ **DO:**
- Call `useAuth()` at the top level of components that need auth
- Check `loading` state before rendering conditional content
- Always handle the `ok: false` case from auth methods
- Use route guards for navigation, not manual routing
- Show loading spinners during async operations

❌ **DON'T:**
- Call `useAuth()` inside loops or conditional blocks
- Try to use auth methods outside `AuthProvider` (will throw)
- Manually set `phoneVerified` state (it's controlled by the system)
- Store user documents in local state (Firestore handles this)
- Use phone number as unique ID (user UID is the unique ID)

---

For more details, see `AUTH_SYSTEM_GUIDE.md`
