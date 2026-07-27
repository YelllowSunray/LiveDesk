'use client';

import { initializeApp, getApp, getApps, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  signInWithCustomToken,
  type Auth,
  type User,
} from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';

const WIDGET_APP_NAME = 'livedesk-widget';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

function getWidgetApp(): FirebaseApp {
  if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
    throw new Error('Missing Firebase client config');
  }
  const existing = getApps().find((app) => app.name === WIDGET_APP_NAME);
  if (existing) return existing;
  try {
    return getApp(WIDGET_APP_NAME);
  } catch {
    return initializeApp(firebaseConfig, WIDGET_APP_NAME);
  }
}

/** Isolated auth/db so the widget never reuses a logged-in agent session. */
export function getWidgetAuth(): Auth {
  return getAuth(getWidgetApp());
}

export function getWidgetDb(): Firestore {
  return getFirestore(getWidgetApp());
}

export async function signInWidgetWithCustomToken(
  customToken: string
): Promise<User> {
  const cred = await signInWithCustomToken(getWidgetAuth(), customToken);
  return cred.user;
}
