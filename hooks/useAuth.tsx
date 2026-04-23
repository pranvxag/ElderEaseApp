import { auth, hasFirebaseConfig } from '@/lib/firebase';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import {
    signOut as firebaseSignOut,
    GoogleAuthProvider,
    onAuthStateChanged,
    signInWithCredential,
    User,
} from 'firebase/auth';
import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';

WebBrowser.maybeCompleteAuthSession();

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  requestReady: boolean;
  configured: boolean;
  signInWithGoogle: () => Promise<{ ok: boolean; message?: string }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const [request, response, promptAsync] = Google.useAuthRequest({
    clientId:
      process.env.EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID ??
      process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    scopes: ['profile', 'email'],
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (response?.type !== 'success') return;

    const idToken = response.authentication?.idToken;
    if (!idToken) return;

    const credential = GoogleAuthProvider.credential(idToken);
    signInWithCredential(auth, credential).catch((error) => {
      console.error('Google sign-in failed:', error);
    });
  }, [response]);

  const value = useMemo<AuthContextValue>(() => {
    return {
      user,
      loading,
      requestReady: Boolean(request),
      configured:
        hasFirebaseConfig &&
        Boolean(process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID),
      signInWithGoogle: async () => {
        if (!hasFirebaseConfig) {
          return {
            ok: false,
            message: 'Firebase config is missing. Add EXPO_PUBLIC_FIREBASE_* env values.',
          };
        }

        if (!request) {
          return { ok: false, message: 'Google sign-in is not ready yet. Please retry.' };
        }

        const result = await promptAsync();
        if (result.type === 'success') {
          return { ok: true };
        }
        if (result.type === 'cancel') {
          return { ok: false, message: 'Sign-in was cancelled.' };
        }
        return { ok: false, message: 'Google sign-in failed. Please try again.' };
      },
      signOut: async () => {
        await firebaseSignOut(auth);
      },
    };
  }, [loading, promptAsync, request, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return context;
}
