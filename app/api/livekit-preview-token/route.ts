import { AccessToken } from 'livekit-server-sdk';
import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function previewRoomName(companyId: string) {
  return `preview_${companyId}`.slice(0, 64);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const role = body.role as 'publisher' | 'viewer' | undefined;
    const slug = typeof body.slug === 'string' ? body.slug.trim() : '';
    const companyIdBody =
      typeof body.companyId === 'string' ? body.companyId.trim() : '';
    const participantName =
      typeof body.participantName === 'string'
        ? body.participantName.trim().slice(0, 64)
        : 'Agent';

    if (!role || (role !== 'publisher' && role !== 'viewer')) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    const wsUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;
    if (!apiKey || !apiSecret || !wsUrl) {
      return NextResponse.json(
        { error: 'Server misconfigured — missing LiveKit credentials' },
        { status: 500 }
      );
    }

    const { getAdminAuth, getAdminDb } = await import('@/lib/firebase/admin');
    const db = getAdminDb();

    let companyId = companyIdBody;

    if (role === 'viewer') {
      if (!slug) {
        return NextResponse.json({ error: 'Missing slug' }, { status: 400 });
      }
      const slugSnap = await db.collection('slugs').doc(slug).get();
      if (!slugSnap.exists) {
        return NextResponse.json({ error: 'Company not found' }, { status: 404 });
      }
      companyId = slugSnap.data()!.companyId as string;
      const companySnap = await db.collection('companies').doc(companyId).get();
      if (!companySnap.exists || !companySnap.data()?.liveFeedActive) {
        return NextResponse.json(
          { error: 'Live feed is not active' },
          { status: 404 }
        );
      }
    } else {
      const authHeader = request.headers.get('authorization');
      if (!authHeader?.startsWith('Bearer ')) {
        return NextResponse.json({ error: 'Missing auth token' }, { status: 401 });
      }
      let uid: string;
      try {
        const decoded = await getAdminAuth().verifyIdToken(
          authHeader.slice('Bearer '.length)
        );
        uid = decoded.uid;
      } catch {
        return NextResponse.json({ error: 'Invalid auth token' }, { status: 401 });
      }
      if (!companyId) {
        return NextResponse.json({ error: 'Missing companyId' }, { status: 400 });
      }
      const memberSnap = await db
        .collection('companies')
        .doc(companyId)
        .collection('members')
        .doc(uid)
        .get();
      if (!memberSnap.exists) {
        return NextResponse.json({ error: 'Not a company member' }, { status: 403 });
      }
    }

    const roomName = previewRoomName(companyId);
    const identity =
      role === 'publisher'
        ? `agent_preview_${companyId}`.slice(0, 64)
        : `viewer_${randomUUID().replace(/-/g, '').slice(0, 24)}`;

    const at = new AccessToken(apiKey, apiSecret, {
      identity,
      name: role === 'publisher' ? participantName : 'Viewer',
    });
    at.addGrant({
      room: roomName,
      roomJoin: true,
      canPublish: role === 'publisher',
      canSubscribe: true,
      canPublishData: false,
    });

    const token = await at.toJwt();
    return NextResponse.json({ token, wsUrl, roomName, companyId });
  } catch (error) {
    console.error('preview token failed:', error);
    return NextResponse.json(
      { error: 'Failed to create preview token' },
      { status: 500 }
    );
  }
}
