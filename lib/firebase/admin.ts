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
 * Prefer FIREBASE_ADMIN_PRIVATE_KEY_BASE64 on Vercel (avoids PEM newline issues).
 * Falls back to FIREBASE_ADMIN_PRIVATE_KEY with common escaping fixes.
 */
function normalizePrivateKey(raw: string): string {
  let key = raw.trim();

  // Base64-encoded full PEM
  if (!key.includes('BEGIN') && /^[A-Za-z0-9+/=\s]+$/.test(key)) {
    try {
      const decoded = Buffer.from(key.replace(/\s+/g, ''), 'base64').toString(
        'utf8'
      );
      if (decoded.includes('BEGIN')) {
        key = decoded.trim();
      }
    } catch {
      // keep original
    }
  }

  if (
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'"))
  ) {
    key = key.slice(1, -1).trim();
  }

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
      'FIREBASE_ADMIN_PRIVATE_KEY is not a valid PEM key. Set FIREBASE_ADMIN_PRIVATE_KEY_BASE64 on Vercel.'
    );
  }

  return `${key}\n`;
}

function getServiceAccount(): ServiceAccount {
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID?.trim();
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL?.trim();
  const rawKey =
    process.env.FIREBASE_ADMIN_PRIVATE_KEY_BASE64?.trim() ||
    process.env.FIREBASE_ADMIN_PRIVATE_KEY;

  if (!projectId || !clientEmail || !rawKey) {
    throw new Error(
      'Missing Firebase Admin credentials. Set FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL, and FIREBASE_ADMIN_PRIVATE_KEY_BASE64.'
    );
  }

  return {
    projectId,
    clientEmail,
    privateKey: normalizePrivateKey(rawKey),
  };
}

let cachedApp: App | null = null;

function getAdminApp(): App {
  if (cachedApp) return cachedApp;
  if (getApps().length) {
    cachedApp = getApps()[0]!;
    return cachedApp;
  }
  cachedApp = initializeApp({ credential: cert(getServiceAccount()) });
  return cachedApp;
}

export function getAdminAuth(): Auth {
  return getAuth(getAdminApp());
}

export function getAdminDb(): Firestore {
  return getFirestore(getAdminApp());
}
