import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth, initializeAuth, type Auth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { Platform } from 'react-native';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

const hasFirebaseConfig = Boolean(
  firebaseConfig.apiKey &&
    firebaseConfig.authDomain &&
    firebaseConfig.projectId &&
    firebaseConfig.storageBucket &&
    firebaseConfig.messagingSenderId &&
    firebaseConfig.appId
);

const fallbackConfig = {
  apiKey: 'missing',
  authDomain: 'missing',
  projectId: 'missing',
  storageBucket: 'missing',
  messagingSenderId: 'missing',
  appId: 'missing',
};

const app = getApps().length
  ? getApp()
  : initializeApp(hasFirebaseConfig ? firebaseConfig : fallbackConfig);

let auth: Auth;
let analytics: unknown | null = null;

if (Platform.OS === 'web') {
  auth = getAuth(app);
  try {
    const { getAnalytics } = require('firebase/analytics');
    analytics = getAnalytics(app);
  } catch {
    analytics = null;
  }
} else {
  try {
    const { getReactNativePersistence } = require('firebase/auth/react-native');
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    auth = initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch (error: any) {
    // If auth is already initialized, re-use the existing instance.
    if (error?.code === 'auth/already-initialized') {
      auth = getAuth(app);
    } else {
      auth = getAuth(app);
    }
  }
}

export const db = getFirestore(app);
export { analytics, auth, hasFirebaseConfig };

