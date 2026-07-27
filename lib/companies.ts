import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { getClientDb } from '@/lib/firebase/client';
import type { CallSession, Company, Member } from '@/lib/types';

export async function getCompanyBySlug(slug: string): Promise<Company | null> {
  const db = getClientDb();
  const slugSnap = await getDoc(doc(db, 'slugs', slug));
  if (!slugSnap.exists()) return null;
  const companyId = slugSnap.data().companyId as string;
  const companySnap = await getDoc(doc(db, 'companies', companyId));
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
    createdAt: (data.createdAt as number) || Date.now(),
    ownerId: data.ownerId as string,
  };
}

export async function updateCompanySettings(
  companyId: string,
  updates: Partial<
    Pick<Company, 'name' | 'brandColor' | 'logoUrl' | 'welcomeMessage'>
  >
): Promise<void> {
  await updateDoc(doc(getClientDb(), 'companies', companyId), updates);
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

export function subscribeWaitingSessions(
  companyId: string,
  onChange: (sessions: CallSession[]) => void
): Unsubscribe {
  const q = query(
    collection(getClientDb(), 'companies', companyId, 'sessions'),
    where('status', '==', 'waiting'),
    orderBy('createdAt', 'asc')
  );
  return onSnapshot(q, (snap) => {
    const sessions = snap.docs.map((d) => mapSession(d.id, d.data()));
    onChange(sessions);
  });
}

export function subscribeSession(
  companyId: string,
  sessionId: string,
  onChange: (session: CallSession | null) => void
): Unsubscribe {
  return onSnapshot(
    doc(getClientDb(), 'companies', companyId, 'sessions', sessionId),
    (snap) => {
      if (!snap.exists()) {
        onChange(null);
        return;
      }
      onChange(mapSession(snap.id, snap.data()));
    }
  );
}

export function subscribeMembersOnline(
  companyId: string,
  onChange: (onlineCount: number) => void
): Unsubscribe {
  const q = query(
    collection(getClientDb(), 'companies', companyId, 'members'),
    where('online', '==', true)
  );
  return onSnapshot(q, (snap) => onChange(snap.size));
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
  sessionId: string
): Promise<void> {
  await updateDoc(
    doc(getClientDb(), 'companies', companyId, 'sessions', sessionId),
    {
      status: 'ended',
      endedAt: Date.now(),
    }
  );
}

export async function createVisitorSession(
  companyId: string,
  visitorUid: string,
  visitorName: string
): Promise<string> {
  const ref = await addDoc(
    collection(getClientDb(), 'companies', companyId, 'sessions'),
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
  createdAt: number
): Promise<number> {
  const q = query(
    collection(getClientDb(), 'companies', companyId, 'sessions'),
    where('status', '==', 'waiting'),
    where('createdAt', '<', createdAt)
  );
  const snap = await getDocs(q);
  return snap.size + 1;
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
