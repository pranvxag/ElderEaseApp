import { auth, db, hasFirebaseConfig } from '@/lib/firebase';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import {
  getAuth as firebaseGetAuth,
  signOut as firebaseSignOut,
  GoogleAuthProvider,
  linkWithCredential,
  onAuthStateChanged,
  PhoneAuthProvider,
  RecaptchaVerifier,
  signInWithCredential,
  signInWithPhoneNumber,
  signInWithPopup,
  User
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  configured: boolean;
  phoneVerified: boolean;
  phoneVerificationInProgress: boolean;
  signInWithGoogle: () => Promise<{ ok: boolean; message?: string }>;
  signOut: () => Promise<void>;
  startPhoneVerification: (phoneNumber: string) => Promise<{ ok: boolean; message?: string; verificationId?: string }>;
  confirmPhoneVerification: (verificationId: string, otp: string) => Promise<{ ok: boolean; message?: string }>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const googleWebClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
const googleIosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
// When true (string 'true' or '1'), disable app verification for testing (use only in dev)
const DISABLE_APP_VERIFICATION =
  (process.env.EXPO_PUBLIC_FIREBASE_DISABLE_APP_VERIFICATION === 'true' ||
    process.env.EXPO_PUBLIC_FIREBASE_DISABLE_APP_VERIFICATION === '1');

let GoogleSignin: any = undefined;
let statusCodes: any = undefined;
let nativeGoogleSigninAvailable = false;
if (Platform.OS === 'android') {
  try {
    // require at runtime to avoid web bundling issues and handle Expo Go gracefully
    const mod = require('@react-native-google-signin/google-signin');
    GoogleSignin = mod.GoogleSignin;
    statusCodes = mod.statusCodes;
    nativeGoogleSigninAvailable = Boolean(GoogleSignin);
    try {
      GoogleSignin.configure({
        webClientId: googleWebClientId,
        iosClientId: googleIosClientId || undefined,
        offlineAccess: true,
      });
    } catch {
      // configure may throw during SSR/build; ignore here
    }
  } catch {
    nativeGoogleSigninAvailable = false;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [phoneVerificationInProgress, setPhoneVerificationInProgress] = useState(false);
  const pushTokenSavedRef = useRef<string | null>(null);
  const verificationIdRef = useRef<string | null>(null);

  const hasGoogleClientId =
    Platform.OS === 'ios' ? Boolean(googleIosClientId || googleWebClientId) : Boolean(googleWebClientId);

  const configured = hasFirebaseConfig && hasGoogleClientId && (Platform.OS !== 'android' || nativeGoogleSigninAvailable);

  /**
   * Register Expo Push Token for the user
   */
  const registerPushToken = useCallback(async (uid: string) => {
    if (!hasFirebaseConfig || Platform.OS === 'web') return;

    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') return;

      const projectId =
        Constants.expoConfig?.extra?.eas?.projectId ??
        (Constants as any).easConfig?.projectId ??
        (Constants as any).expoConfig?.extra?.eas?.projectId;

      const tokenResponse = projectId
        ? await Notifications.getExpoPushTokenAsync({ projectId })
        : await Notifications.getExpoPushTokenAsync();

      const expoPushToken = tokenResponse.data;
      if (!expoPushToken || pushTokenSavedRef.current === expoPushToken) return;

      pushTokenSavedRef.current = expoPushToken;

      const ref = doc(db, 'users', uid, 'profile', 'data');
      await setDoc(ref, { expoPushToken }, { merge: true });
    } catch (error) {
      console.warn('Failed to register Expo push token:', error);
    }
  }, []);

  /**
   * Check if user's phone is verified in Firestore
   */
  const checkPhoneVerification = useCallback(async (uid: string) => {
    try {
      const userDoc = await getDoc(doc(db, 'users', uid));
      const userData = userDoc.data();
      setPhoneVerified(userData?.phoneVerified === true);
    } catch (error) {
      console.warn('Failed to check phone verification:', error);
      setPhoneVerified(false);
    }
  }, []);

  /**
   * Create or update user profile in Firestore after successful sign-in
   */
  const ensureUserProfile = useCallback(async (firebaseUser: User) => {
    try {
      const userRef = doc(db, 'users', firebaseUser.uid);
      const userSnap = await getDoc(userRef);

      const now = new Date().toISOString();

      if (!userSnap.exists()) {
        // First time login - create new user document
        await setDoc(userRef, {
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName || 'User',
          photoURL: firebaseUser.photoURL,
          phoneNumber: null,
          phoneVerified: false,
          createdAt: now,
          updatedAt: now,
        });

        // Create initial profile document
        await setDoc(doc(db, 'users', firebaseUser.uid, 'profile', 'data'), {
          displayName: firebaseUser.displayName || 'User',
          email: firebaseUser.email,
          photoURL: firebaseUser.photoURL,
          preferredLanguage: 'en',
          emergencyContacts: [],
          medicines: [],
          updatedAt: now,
        });
      } else {
        // Update existing user
        await setDoc(
          userRef,
          {
            email: firebaseUser.email,
            displayName: firebaseUser.displayName || userSnap.data()?.displayName,
            photoURL: firebaseUser.photoURL || userSnap.data()?.photoURL,
            updatedAt: now,
          },
          { merge: true }
        );
      }

      await registerPushToken(firebaseUser.uid);
      await checkPhoneVerification(firebaseUser.uid);
    } catch (error) {
      console.error('Failed to ensure user profile:', error);
      throw error;
    }
  }, [registerPushToken, checkPhoneVerification]);

  /**
   * Sign in with Google
   */
  const signInWithGoogle = useCallback(async () => {
    try {
      if (Platform.OS === 'android' && GoogleSignin) {
        try {
          await GoogleSignin.hasPlayServices();
          const result = await GoogleSignin.signIn();
          const { idToken } = result.data;
          const credential = GoogleAuthProvider.credential(idToken);
          const userCredential = await signInWithCredential(auth, credential);
          await ensureUserProfile(userCredential.user);
          return { ok: true };
        } catch (error: any) {
          if (error.code === statusCodes.SIGN_IN_CANCELLED) {
            return { ok: false, message: 'Sign-in was cancelled' };
          } else if (error.code === statusCodes.IN_PROGRESS) {
            return { ok: false, message: 'Sign-in is in progress' };
          } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
            return { ok: false, message: 'Google Play Services not available' };
          }
          return { ok: false, message: error.message };
        }
      } else {
        // Web or iOS
        const result = await signInWithPopup(auth, new GoogleAuthProvider());
        await ensureUserProfile(result.user);
        return { ok: true };
      }
    } catch (error: any) {
      console.error('Google sign-in error:', error);
      return { ok: false, message: error.message || 'Sign-in failed' };
    }
  }, [ensureUserProfile]);

  /**
   * Start phone verification - sends OTP to phone number
   */
  const startPhoneVerification = useCallback(async (phoneNumber: string) => {
    // Use auth.currentUser instead of state `user` for immediate, synchronous access
    const currentUser = auth.currentUser;
    
    // DEBUG: Log auth state
    console.log('DEBUG startPhoneVerification:', {
      currentUserUid: currentUser?.uid || null,
      currentUserEmail: currentUser?.email || null,
      authAppName: (auth as any)?.app?.name || 'unknown',
    });
    
    if (!currentUser) {
      console.warn('currentUser is null - auth may not be persisted, fallback to state user');
      // Fallback: try using the user from state (in case there's a persistence timing gap)
      if (user) {
        console.warn('Using user from state as fallback');
      } else {
        return { ok: false, message: 'User not authenticated. Please sign in first.' };
      }
    }

    try {
      setPhoneVerificationInProgress(true);

      // Use Firebase reCAPTCHA for web, or handle natively
      if (Platform.OS === 'web') {
            try {
              const containerId = 'recaptcha-container';
              if (typeof document !== 'undefined' && !document.getElementById(containerId)) {
                const div = document.createElement('div');
                div.id = containerId;
                div.style.display = 'none';
                document.body.appendChild(div);
              }

              // Obtain a valid Auth instance (fallback to firebaseGetAuth())
              let webAuth: any = auth || null;
              try {
                webAuth = webAuth || (firebaseGetAuth ? firebaseGetAuth() : null);
              } catch {
                // ignore - will validate below
              }

              if (!webAuth) {
                return { ok: false, message: 'Firebase Auth is unavailable in this environment.' };
              }

              // Ensure settings object exists (prevents SDK internal reads from failing)
              if ((webAuth as any).settings === undefined) (webAuth as any).settings = {};

              // If developer enabled the env toggle, disable app verification (DEV ONLY)
              if (DISABLE_APP_VERIFICATION) {
                try {
                  (webAuth as any).settings.appVerificationDisabledForTesting = true;
                  console.warn('Firebase appVerificationDisabledForTesting= true (dev env)');
                } catch (e) {
                  console.warn('Failed to set appVerificationDisabledForTesting:', e);
                }
              }

              // Reuse verifier if already created to avoid multiple widgets
              let verifier: any = (window as any).__firebaseRecaptchaVerifier;
              if (!verifier) {
                verifier = new RecaptchaVerifier('recaptcha-container', { size: 'invisible' }, webAuth);
                (window as any).__firebaseRecaptchaVerifier = verifier;
              }

              const confirmationResult = await signInWithPhoneNumber(webAuth, phoneNumber, verifier);
              verificationIdRef.current = (confirmationResult as any).verificationId;

              return { ok: true, verificationId: (confirmationResult as any).verificationId };
            } catch (err: any) {
              console.error('Web RecaptchaVerifier error:', err);
              return { ok: false, message: err?.message || 'Failed to initialize reCAPTCHA' };
            }
      } else {
        // For native platforms
        const verifier = new PhoneAuthProvider(auth);
        const verificationId = await verifier.verifyPhoneNumber(phoneNumber, null as any);
        verificationIdRef.current = verificationId;
        return { ok: true, verificationId };
      }
    } catch (error: any) {
      console.error('Phone verification start error:', error);
      return {
        ok: false,
        message: error.message || 'Failed to send OTP',
      };
    } finally {
      setPhoneVerificationInProgress(false);
    }
  }, [user]);

  /**
   * Confirm phone verification - verifies OTP and updates user profile
   */
  const confirmPhoneVerification = useCallback(
    async (verificationId: string, otp: string) => {
      // Use auth.currentUser instead of state `user` for immediate access
      const currentUser = auth.currentUser;
      if (!currentUser) {
        return { ok: false, message: 'User not authenticated. Please sign in first.' };
      }

      try {
        setPhoneVerificationInProgress(true);

        const credential = PhoneAuthProvider.credential(verificationId, otp);
        await linkWithCredential(currentUser, credential);

        // Update Firestore with phone number and verification status
        const phoneNumber = currentUser.phoneNumber || 'Phone verified';
        await setDoc(
          doc(db, 'users', currentUser.uid),
          {
            phoneNumber,
            phoneVerified: true,
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );

        await setDoc(
          doc(db, 'users', currentUser.uid, 'profile', 'data'),
          {
            phoneNumber,
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );

        setPhoneVerified(true);
        return { ok: true };
      } catch (error: any) {
        console.error('Phone verification confirm error:', error);
        return {
          ok: false,
          message: error.message || 'Invalid OTP',
        };
      } finally {
        setPhoneVerificationInProgress(false);
      }
    },
    []
  );

  /**
   * Sign out user
   */
  const signOut = useCallback(async () => {
    try {
      if (Platform.OS === 'android' && GoogleSignin) {
        await GoogleSignin.signOut();
      }
      await firebaseSignOut(auth);
      setPhoneVerified(false);
    } catch (error) {
      console.error('Sign-out error:', error);
      throw error;
    }
  }, []);

  /**
   * Listen to auth state changes
   */
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      if (nextUser) {
        // ensureUserProfile captured by closure; dependency array is empty
        // to prevent listener re-registration on every render
        await ensureUserProfile(nextUser);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const value: AuthContextValue = {
    user,
    loading,
    configured,
    phoneVerified,
    phoneVerificationInProgress,
    signInWithGoogle,
    signOut,
    startPhoneVerification,
    confirmPhoneVerification,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
