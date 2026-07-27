'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  User,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInAnonymously,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile,
} from 'firebase/auth';
import { doc, getDoc, writeBatch } from 'firebase/firestore';
import { getClientAuth, getClientDb } from '@/lib/firebase/client';
import { isValidSlug, slugify } from '@/lib/slug';
import type { Company, UserProfile } from '@/lib/types';

interface AuthContextValue {
  user: User | null;
  profile: UserProfile | null;
  company: Company | null;
  loading: boolean;
  signUp: (input: {
    email: string;
    password: string;
    displayName: string;
    companyName: string;
  }) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  ensureAnonymous: () => Promise<User>;
  refreshCompany: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function loadProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(getClientDb(), 'users', uid));
  if (!snap.exists()) return null;
  const data = snap.data();
  return {
    uid,
    companyId: data.companyId as string,
    email: data.email as string,
    displayName: data.displayName as string,
  };
}

async function loadCompany(companyId: string): Promise<Company | null> {
  const snap = await getDoc(doc(getClientDb(), 'companies', companyId));
  if (!snap.exists()) return null;
  const data = snap.data();
  return {
    id: companyId,
    name: data.name as string,
    slug: data.slug as string,
    brandColor: (data.brandColor as string) || '#0f766e',
    logoUrl: (data.logoUrl as string) || '',
    welcomeMessage:
      (data.welcomeMessage as string) || 'Talk to our team on video',
    ntfyTopic: (data.ntfyTopic as string) || '',
    createdAt: (data.createdAt as number) || Date.now(),
    ownerId: data.ownerId as string,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);

  const hydrate = useCallback(async (nextUser: User | null) => {
    if (!nextUser || nextUser.isAnonymous) {
      setProfile(null);
      setCompany(null);
      return;
    }
    const nextProfile = await loadProfile(nextUser.uid);
    setProfile(nextProfile);
    if (nextProfile?.companyId) {
      setCompany(await loadCompany(nextProfile.companyId));
    } else {
      setCompany(null);
    }
  }, []);

  useEffect(() => {
    let unsub = () => {};
    try {
      const auth = getClientAuth();
      unsub = onAuthStateChanged(auth, async (nextUser) => {
        setUser(nextUser);
        try {
          await hydrate(nextUser);
        } finally {
          setLoading(false);
        }
      });
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
    return () => unsub();
  }, [hydrate]);

  const refreshCompany = useCallback(async () => {
    if (!profile?.companyId) return;
    setCompany(await loadCompany(profile.companyId));
  }, [profile?.companyId]);

  const signUp = useCallback(
    async (input: {
      email: string;
      password: string;
      displayName: string;
      companyName: string;
    }) => {
      const auth = getClientAuth();
      const db = getClientDb();
      const baseSlug = slugify(input.companyName);
      if (!isValidSlug(baseSlug)) {
        throw new Error('Company name must produce a valid URL slug');
      }

      let slug = baseSlug;
      let attempt = 0;
      while (attempt < 20) {
        const slugSnap = await getDoc(doc(db, 'slugs', slug));
        if (!slugSnap.exists()) break;
        attempt += 1;
        slug = `${baseSlug}-${attempt + 1}`;
      }
      if (attempt >= 20) {
        throw new Error('Could not reserve a unique company slug');
      }

      const cred = await createUserWithEmailAndPassword(
        auth,
        input.email,
        input.password
      );
      await updateProfile(cred.user, { displayName: input.displayName });

      const companyRef = doc(db, 'companies', cred.user.uid);
      const companyId = companyRef.id;
      const now = Date.now();
      const batch = writeBatch(db);

      batch.set(companyRef, {
        name: input.companyName.trim(),
        slug,
        brandColor: '#0f766e',
        logoUrl: '',
        welcomeMessage: 'Talk to our team on video',
        ntfyTopic: '',
        createdAt: now,
        ownerId: cred.user.uid,
      });
      batch.set(doc(db, 'slugs', slug), { companyId });
      batch.set(doc(db, 'users', cred.user.uid), {
        companyId,
        email: input.email.trim().toLowerCase(),
        displayName: input.displayName.trim(),
      });
      batch.set(doc(db, 'companies', companyId, 'members', cred.user.uid), {
        email: input.email.trim().toLowerCase(),
        displayName: input.displayName.trim(),
        role: 'owner',
        online: false,
        updatedAt: now,
      });

      await batch.commit();
      await hydrate(cred.user);
    },
    [hydrate]
  );

  const signIn = useCallback(async (email: string, password: string) => {
    await signInWithEmailAndPassword(getClientAuth(), email, password);
  }, []);

  const signOut = useCallback(async () => {
    await firebaseSignOut(getClientAuth());
    setProfile(null);
    setCompany(null);
  }, []);

  const ensureAnonymous = useCallback(async () => {
    const auth = getClientAuth();
    if (auth.currentUser) return auth.currentUser;
    const cred = await signInAnonymously(auth);
    return cred.user;
  }, []);

  const value = useMemo(
    () => ({
      user,
      profile,
      company,
      loading,
      signUp,
      signIn,
      signOut,
      ensureAnonymous,
      refreshCompany,
    }),
    [
      user,
      profile,
      company,
      loading,
      signUp,
      signIn,
      signOut,
      ensureAnonymous,
      refreshCompany,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
