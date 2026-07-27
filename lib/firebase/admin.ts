import {
  cert,
  getApps,
  initializeApp,
  type App,
  type ServiceAccount,
} from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

/**
 * Vercel/env pastes of PEM keys come in many broken shapes:
 * quoted, literal \n, real newlines, or mixed. Normalize to a valid PEM.
 */
function normalizePrivateKey(raw: string): string {
  let key = raw.trim();

  if (
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'"))
  ) {
    key = key.slice(1, -1).trim();
  }

  // Handle double-escaped and single-escaped newlines
  key = key.replace(/\\\\n/g, '\n').replace(/\\n/g, '\n');
  key = key.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  key = key
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n');

  if (
    !key.includes('BEGIN PRIVATE KEY') &&
    !key.includes('BEGIN RSA PRIVATE KEY')
  ) {
    throw new Error(
      'FIREBASE_ADMIN_PRIVATE_KEY is not a valid PEM key. Paste the full key including BEGIN/END lines, using \\n for newlines in Vercel.'
    );
  }

  return `${key}\n`;
}

function getServiceAccount(): ServiceAccount {
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID?.trim();
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL?.trim();
  const rawKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;

  if (!projectId || !clientEmail || !rawKey) {
    throw new Error(
      'Missing Firebase Admin credentials. Set FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL, and FIREBASE_ADMIN_PRIVATE_KEY.'
    );
  }

  return {
    projectId,
    clientEmail,
    privateKey: normalizePrivateKey(rawKey),
  };
}

function getAdminApp(): App {
  if (getApps().length) {
    return getApps()[0]!;
  }
  return initializeApp({ credential: cert(getServiceAccount()) });
}

export function getAdminAuth(): Auth {
  return getAuth(getAdminApp());
}

export function getAdminDb(): Firestore {
  return getFirestore(getAdminApp());
}
