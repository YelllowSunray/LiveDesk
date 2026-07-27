import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebase/admin';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const slug = typeof body.slug === 'string' ? body.slug.trim() : '';

    if (!slug) {
      return NextResponse.json({ error: 'Missing slug' }, { status: 400 });
    }

    const db = getAdminDb();
    const slugSnap = await db.collection('slugs').doc(slug).get();
    if (!slugSnap.exists) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }
    const companyId = slugSnap.data()!.companyId as string;

    const visitorUid = `vis_${randomUUID().replace(/-/g, '')}`;
    const visitorName = `Visitor ${visitorUid.slice(-4).toUpperCase()}`;
    const now = Date.now();
    const sessionRef = db
      .collection('companies')
      .doc(companyId)
      .collection('sessions')
      .doc();

    await sessionRef.set({
      visitorName,
      visitorUid,
      status: 'waiting',
      roomName: null,
      agentId: null,
      createdAt: now,
      connectedAt: null,
      endedAt: null,
    });

    const customToken = await getAdminAuth().createCustomToken(visitorUid, {
      role: 'visitor',
      companyId,
    });

    return NextResponse.json({
      customToken,
      companyId,
      session: {
        id: sessionRef.id,
        visitorName,
        visitorUid,
        status: 'waiting',
        roomName: null,
        agentId: null,
        createdAt: now,
        connectedAt: null,
        endedAt: null,
      },
    });
  } catch (error) {
    console.error('visitor join failed:', error);
    const message =
      error instanceof Error ? error.message : 'Failed to join queue';
    // Surface config mistakes (bad PEM, missing env) so the widget can show them.
    const isConfigError =
      /private key|PEM|credentials|FIREBASE_ADMIN|pattern/i.test(message);
    return NextResponse.json(
      {
        error: isConfigError
          ? 'Server Firebase Admin credentials are invalid. Check FIREBASE_ADMIN_PRIVATE_KEY on Vercel (use \\n newlines).'
          : 'Failed to join queue',
      },
      { status: 500 }
    );
  }
}
