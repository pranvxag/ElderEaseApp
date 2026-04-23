import { auth, hasFirebaseConfig } from '@/lib/firebase';
import {
    signOut as firebaseSignOut,
    GoogleAuthProvider,
    onAuthStateChanged,
    signInWithCredential,
    signInWithPopup,
    User,
} from 'firebase/auth';
import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  configured: boolean;
  signInWithGoogle: () => Promise<{ ok: boolean; message?: string }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

let GoogleSignin: any = undefined;
let statusCodes: any = undefined;
if (Platform.OS === 'android') {
  // require at runtime to avoid web bundling issues
  const mod = require('@react-native-google-signin/google-signin');
  GoogleSignin = mod.GoogleSignin;
  statusCodes = mod.statusCodes;
  try {
    GoogleSignin.configure({
      webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
      offlineAccess: true,
    });
  } catch (e) {
    // configure may throw during SSR/build; ignore here
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const configured = hasFirebaseConfig && Boolean(process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const signInWithGoogle = useCallback(async (): Promise<{ ok: boolean; message?: string }> => {
    if (!hasFirebaseConfig) {
      return { ok: false, message: 'Firebase config is missing. Add EXPO_PUBLIC_FIREBASE_* env values.' };
    }

    if (Platform.OS === 'web') {
      try {
        const provider = new GoogleAuthProvider();
        // force account picker to avoid unexpected silent closes
        try {
          provider.setCustomParameters?.({ prompt: 'select_account' });
        } catch {}
        await signInWithPopup(auth, provider);
        return { ok: true };
      } catch (error: any) {
        console.error('Web Google sign-in failed:', error);
        const code = error?.code ?? (error && error.name) ?? 'unknown';
        const message = error?.message ?? String(error);
        if (code === 'auth/unauthorized-domain') {
          return {
            ok: false,
            message:
              'This web origin is not authorized in Firebase Auth. Add the current domain to Firebase Console > Authentication > Settings > Authorized domains.',
          };
        }
        if (code === 'auth/popup-blocked') {
          return { ok: false, message: 'The browser blocked the Google sign-in popup.' };
        }
        if (code === 'auth/popup-closed-by-user') {
          return { ok: false, message: 'The Google sign-in popup closed before authentication completed.' };
        }
        if (code === 'auth/cancelled-popup-request') {
          return { ok: false, message: 'A Google sign-in request is already in progress.' };
        }
        if (code === 'auth/operation-not-supported-in-this-environment') {
          return { ok: false, message: 'Firebase popup sign-in is not supported in this browser environment.' };
        }
        if (code === 'auth/configuration-not-found') {
          const isLocalhost = typeof window !== 'undefined' && window.location.hostname === 'localhost';
          if (isLocalhost) {
            return {
              ok: false,
              message:
                'Firebase OAuth not configured for localhost. Go to Firebase Console > Authentication > Google provider > Add http://localhost:* to authorized redirect URIs.',
            };
          }
          return {
            ok: false,
            message: 'Firebase OAuth configuration not found. Configure Google Sign-In in Firebase Console > Authentication.',
          };
        }
        return { ok: false, message: `Web sign-in error (${code}): ${message}` };
      }
    }

    if (Platform.OS === 'android') {
      try {
        if (!GoogleSignin) {
          return { ok: false, message: 'Google Sign-In is not configured on this device.' };
        }
        await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
        const userInfo = await GoogleSignin.signIn();
        const idToken = userInfo?.idToken;
        if (!idToken) {
          return { ok: false, message: 'No idToken returned from Google Sign-In.' };
        }
        const credential = GoogleAuthProvider.credential(idToken);
        await signInWithCredential(auth, credential);
        return { ok: true };
      } catch (error: any) {
        console.error('Android Google sign-in error:', error);
        if (statusCodes) {
          if (error.code === statusCodes.SIGN_IN_CANCELLED) {
            return { ok: false, message: 'Sign-in was cancelled.' };
          }
          if (error.code === statusCodes.IN_PROGRESS) {
            return { ok: false, message: 'Sign-in already in progress.' };
          }
          if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
            return { ok: false, message: 'Play services not available or outdated.' };
          }
        }
        return { ok: false, message: 'Google sign-in failed. Please try again.' };
      }
    }

    return { ok: false, message: 'Platform not supported for Google sign-in.' };
  }, []);

  const signOut = useCallback(async () => {
    if (Platform.OS === 'android' && GoogleSignin) {
      try {
        await GoogleSignin.signOut();
      } catch (e) {
        // ignore errors from native sign-out
      }
    }
    await firebaseSignOut(auth);
  }, []);

  const value: AuthContextValue = {
    user,
    loading,
    configured,
    signInWithGoogle,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return context;
}
