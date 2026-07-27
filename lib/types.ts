export type MemberRole = 'owner' | 'agent';

export type SessionStatus = 'waiting' | 'connected' | 'ended';

export interface Company {
  id: string;
  name: string;
  slug: string;
  brandColor: string;
  logoUrl: string;
  welcomeMessage: string;
  createdAt: number;
  ownerId: string;
}

export interface Member {
  uid: string;
  email: string;
  displayName: string;
  role: MemberRole;
  online: boolean;
  updatedAt: number;
}

export interface UserProfile {
  uid: string;
  companyId: string;
  email: string;
  displayName: string;
}

export interface CallSession {
  id: string;
  visitorName: string;
  visitorUid: string;
  status: SessionStatus;
  roomName: string | null;
  agentId: string | null;
  createdAt: number;
  connectedAt: number | null;
  endedAt: number | null;
}

export interface SlugDoc {
  companyId: string;
}
