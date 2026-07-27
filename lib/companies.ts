import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  updateDoc,
  where,
  type Firestore,
  type Unsubscribe,
} from 'firebase/firestore';
import { getClientDb } from '@/lib/firebase/client';
import type { CallSession, Company, Member } from '@/lib/types';

function dbOrDefault(db?: Firestore): Firestore {
  return db ?? getClientDb();
}

export async function getCompanyBySlug(
  slug: string,
  db?: Firestore
): Promise<Company | null> {
  const database = dbOrDefault(db);
  const slugSnap = await getDoc(doc(database, 'slugs', slug));
  if (!slugSnap.exists()) return null;
  const companyId = slugSnap.data().companyId as string;
  const companySnap = await getDoc(doc(database, 'companies', companyId));
  if (!companySnap.exists()) return null;
  const data = companySnap.data();
  return {
    id: companyId,
    name: data.name as string,
    slug: data.slug as string,
    brandColor: (data.brandColor as string) || '#0f766e',
    logoUrl: (data.logoUrl as string) || '',
    welcomeMessage:
      (data.welcomeMessage as string) || 'Talk to our team on video',
    ntfyTopic: (data.ntfyTopic as string) || '',
    liveFeedActive: Boolean(data.liveFeedActive),
    createdAt: (data.createdAt as number) || Date.now(),
    ownerId: data.ownerId as string,
  };
}

export async function updateCompanySettings(
  companyId: string,
  updates: Partial<
    Pick<
      Company,
      'name' | 'brandColor' | 'logoUrl' | 'welcomeMessage' | 'ntfyTopic'
    >
  >
): Promise<void> {
  await updateDoc(doc(getClientDb(), 'companies', companyId), updates);
}

export async function setLiveFeedActive(
  companyId: string,
  active: boolean
): Promise<void> {
  await updateDoc(doc(getClientDb(), 'companies', companyId), {
    liveFeedActive: active,
  });
}

export function subscribeCompany(
  companyId: string,
  onChange: (company: Company | null) => void,
  db?: Firestore
): Unsubscribe {
  return onSnapshot(
    doc(dbOrDefault(db), 'companies', companyId),
    (snap) => {
      if (!snap.exists()) {
        onChange(null);
        return;
      }
      const data = snap.data();
      onChange({
        id: companyId,
        name: data.name as string,
        slug: data.slug as string,
        brandColor: (data.brandColor as string) || '#0f766e',
        logoUrl: (data.logoUrl as string) || '',
        welcomeMessage:
          (data.welcomeMessage as string) || 'Talk to our team on video',
        ntfyTopic: (data.ntfyTopic as string) || '',
        liveFeedActive: Boolean(data.liveFeedActive),
        createdAt: (data.createdAt as number) || Date.now(),
        ownerId: data.ownerId as string,
      });
    },
    () => onChange(null)
  );
}

export async function setMemberOnline(
  companyId: string,
  uid: string,
  online: boolean
): Promise<void> {
  await updateDoc(doc(getClientDb(), 'companies', companyId, 'members', uid), {
    online,
    updatedAt: Date.now(),
  });
}

export function subscribeMember(
  companyId: string,
  uid: string,
  onChange: (member: Member | null) => void
): Unsubscribe {
  return onSnapshot(
    doc(getClientDb(), 'companies', companyId, 'members', uid),
    (snap) => {
      if (!snap.exists()) {
        onChange(null);
        return;
      }
      const data = snap.data();
      onChange({
        uid,
        email: (data.email as string) || '',
        displayName: (data.displayName as string) || '',
        role: data.role as Member['role'],
        online: Boolean(data.online),
        updatedAt: (data.updatedAt as number) || Date.now(),
      });
    },
    () => onChange(null)
  );
}

export function subscribeWaitingSessions(
  companyId: string,
  onChange: (sessions: CallSession[]) => void,
  onError?: (message: string) => void
): Unsubscribe {
  // Equality-only query avoids requiring a composite index; sort client-side.
  const q = query(
    collection(getClientDb(), 'companies', companyId, 'sessions'),
    where('status', '==', 'waiting')
  );
  return onSnapshot(
    q,
    (snap) => {
      const sessions = snap.docs
        .map((d) => mapSession(d.id, d.data()))
        .sort((a, b) => a.createdAt - b.createdAt);
      onChange(sessions);
    },
    (err) => {
      console.error('Waiting sessions subscription failed:', err);
      onChange([]);
      onError?.(err.message || 'Could not load waiting queue');
    }
  );
}

export function subscribeSession(
  companyId: string,
  sessionId: string,
  onChange: (session: CallSession | null) => void,
  db?: Firestore
): Unsubscribe {
  const database = dbOrDefault(db);
  return onSnapshot(
    doc(database, 'companies', companyId, 'sessions', sessionId),
    (snap) => {
      if (!snap.exists()) {
        onChange(null);
        return;
      }
      onChange(mapSession(snap.id, snap.data()));
    },
    () => onChange(null)
  );
}

export function subscribeMembersOnline(
  companyId: string,
  onChange: (onlineCount: number) => void,
  db?: Firestore
): Unsubscribe {
  const database = dbOrDefault(db);
  const q = query(
    collection(database, 'companies', companyId, 'members'),
    where('online', '==', true)
  );
  return onSnapshot(
    q,
    (snap) => onChange(snap.size),
    () => onChange(0)
  );
}

export async function acceptSession(
  companyId: string,
  sessionId: string,
  agentId: string
): Promise<string> {
  const roomName = `call_${sessionId}`;
  await updateDoc(
    doc(getClientDb(), 'companies', companyId, 'sessions', sessionId),
    {
      status: 'connected',
      roomName,
      agentId,
      connectedAt: Date.now(),
    }
  );
  return roomName;
}

export async function endSession(
  companyId: string,
  sessionId: string,
  db?: Firestore
): Promise<void> {
  await updateDoc(
    doc(dbOrDefault(db), 'companies', companyId, 'sessions', sessionId),
    {
      status: 'ended',
      endedAt: Date.now(),
    }
  );
}

export async function createVisitorSession(
  companyId: string,
  visitorUid: string,
  visitorName: string,
  db?: Firestore
): Promise<string> {
  const ref = await addDoc(
    collection(dbOrDefault(db), 'companies', companyId, 'sessions'),
    {
      visitorName: visitorName.trim(),
      visitorUid,
      status: 'waiting',
      roomName: null,
      agentId: null,
      createdAt: Date.now(),
      connectedAt: null,
      endedAt: null,
    }
  );
  return ref.id;
}

export async function getQueuePosition(
  companyId: string,
  sessionId: string,
  createdAt: number,
  db?: Firestore
): Promise<number> {
  const q = query(
    collection(dbOrDefault(db), 'companies', companyId, 'sessions'),
    where('status', '==', 'waiting')
  );
  const snap = await getDocs(q);
  const waiting = snap.docs
    .map((d) => ({ id: d.id, createdAt: d.data().createdAt as number }))
    .sort((a, b) => a.createdAt - b.createdAt);
  const index = waiting.findIndex((s) => s.id === sessionId);
  if (index >= 0) return index + 1;
  return waiting.filter((s) => s.createdAt < createdAt).length + 1;
}

function mapSession(
  id: string,
  data: Record<string, unknown>
): CallSession {
  return {
    id,
    visitorName: data.visitorName as string,
    visitorUid: data.visitorUid as string,
    status: data.status as CallSession['status'],
    roomName: (data.roomName as string | null) ?? null,
    agentId: (data.agentId as string | null) ?? null,
    createdAt: data.createdAt as number,
    connectedAt: (data.connectedAt as number | null) ?? null,
    endedAt: (data.endedAt as number | null) ?? null,
  };
}

export type { Member };
