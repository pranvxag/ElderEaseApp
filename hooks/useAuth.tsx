import { auth, hasFirebaseConfig } from '@/lib/firebase';
import {
    GoogleAuthProvider,
    onAuthStateChanged,
    signInWithCredential,
    signInWithPopup,
    signOut as firebaseSignOut,
    User,
} from 'firebase/auth';
import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';

// Android-only import — tree-shaken on web by Metro/bundler
let GoogleSignin: typeof import('@react-native-google-signin/google-signin').GoogleSignin;
let statusCodes: typeof import('@react-native-google-signin/google-signin').statusCodes;
if (Platform.OS !== 'web') {
  const mod = require('@react-native-google-signin/google-signin');
  GoogleSignin = mod.GoogleSignin;
  statusCodes = mod.statusCodes;

  GoogleSignin.configure({
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    offlineAccess: true,
  });
}

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  configured: boolean;
  signInWithGoogle: () => Promise<{ ok: boolean; message?: string }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const signInWithGoogle = useCallback(async (): Promise<{ ok: boolean; message?: string }> => {
    if (!hasFirebaseConfig) {
      return {
        ok: false,
        message: 'Firebase config is missing. Add EXPO_PUBLIC_FIREBASE_* env values.',
      };
    }

    if (Platform.OS === 'web') {
      try {
        const provider = new GoogleAuthProvider();
        await signInWithPopup(auth, provider);
        return { ok: true };
      } catch (error: any) {
        console.error('Google sign-in failed:', error);
        return { ok: false, message: 'Google sign-in failed. Please try again.' };
      }
    }

    // Android path
    try {
      await GoogleSignin.hasPlayServices();
      const signInResult = await GoogleSignin.signIn();
      const idToken =
        (signInResult as any).data?.idToken ?? (signInResult as any).idToken ?? null;

      if (!idToken) {
        return { ok: false, message: 'Google did not return a usable token. Please try again.' };
      }

      const credential = GoogleAuthProvider.credential(idToken);
      await signInWithCredential(auth, credential);
      return { ok: true };
    } catch (error: any) {
      if (statusCodes && error.code === statusCodes.SIGN_IN_CANCELLED) {
        return { ok: false, message: 'Sign-in was cancelled.' };
      }
      if (statusCodes && error.code === statusCodes.IN_PROGRESS) {
        return { ok: false, message: 'Sign-in is already in progress.' };
      }
      if (statusCodes && error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        return { ok: false, message: 'Google Play Services are not available.' };
      }
      console.error('Google sign-in failed:', error);
      return { ok: false, message: 'Google sign-in failed. Please try again.' };
    }
  }, []);

  const signOut = useCallback(async () => {
    if (Platform.OS !== 'web') {
      await GoogleSignin.signOut();
    }
    await firebaseSignOut(auth);
  }, []);

  const value: AuthContextValue = {
    user,
    loading,
    configured:
      hasFirebaseConfig && Boolean(process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID),
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
