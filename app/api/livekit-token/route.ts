import { AccessToken } from 'livekit-server-sdk';
import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebase/admin';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing auth token' }, { status: 401 });
    }

    const idToken = authHeader.slice('Bearer '.length);
    let uid: string;
    try {
      const decoded = await getAdminAuth().verifyIdToken(idToken);
      uid = decoded.uid;
    } catch {
      return NextResponse.json({ error: 'Invalid auth token' }, { status: 401 });
    }

    const body = await request.json();
    const { companyId, sessionId, roomName, participantName, role } = body as {
      companyId?: string;
      sessionId?: string;
      roomName?: string;
      participantName?: string;
      role?: 'agent' | 'visitor';
    };

    if (!companyId || !sessionId || !roomName || !participantName || !role) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const db = getAdminDb();
    const sessionRef = db
      .collection('companies')
      .doc(companyId)
      .collection('sessions')
      .doc(sessionId);
    const sessionSnap = await sessionRef.get();
    if (!sessionSnap.exists) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const session = sessionSnap.data()!;
    if (session.status !== 'connected') {
      return NextResponse.json(
        { error: 'Session is not connected' },
        { status: 403 }
      );
    }
    if (session.roomName !== roomName) {
      return NextResponse.json({ error: 'Room mismatch' }, { status: 403 });
    }

    if (role === 'visitor') {
      if (session.visitorUid !== uid) {
        return NextResponse.json({ error: 'Not the session visitor' }, { status: 403 });
      }
    } else {
      const memberSnap = await db
        .collection('companies')
        .doc(companyId)
        .collection('members')
        .doc(uid)
        .get();
      if (!memberSnap.exists) {
        return NextResponse.json({ error: 'Not a company member' }, { status: 403 });
      }
      if (session.agentId && session.agentId !== uid) {
        return NextResponse.json(
          { error: 'Another agent owns this session' },
          { status: 403 }
        );
      }
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

    const identity = `${role}_${uid}`.slice(0, 64);
    const at = new AccessToken(apiKey, apiSecret, {
      identity,
      name: participantName,
    });
    at.addGrant({
      room: roomName,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    const token = await at.toJwt();
    return NextResponse.json({ token, wsUrl });
  } catch (error) {
    console.error('Error generating token:', error);
    return NextResponse.json(
      { error: 'Failed to generate token' },
      { status: 500 }
    );
  }
}
