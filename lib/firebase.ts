import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth, initializeAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
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

let auth = getAuth(app);
try {
  auth = initializeAuth(app);
} catch {
  auth = getAuth(app);
}

export const db = getFirestore(app);
export { auth, hasFirebaseConfig };

