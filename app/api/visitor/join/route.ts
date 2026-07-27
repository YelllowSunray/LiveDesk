import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const slug = typeof body.slug === 'string' ? body.slug.trim() : '';

    if (!slug) {
      return NextResponse.json({ error: 'Missing slug' }, { status: 400 });
    }

    const { getAdminAuth, getAdminDb } = await import('@/lib/firebase/admin');
    const db = getAdminDb();
    const slugSnap = await db.collection('slugs').doc(slug).get();
    if (!slugSnap.exists) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }
    const companyId = slugSnap.data()!.companyId as string;
    const companySnap = await db.collection('companies').doc(companyId).get();
    const companyData = companySnap.data() || {};
    const companyName = (companyData.name as string) || 'LiveDesk';
    const ntfyTopic = (companyData.ntfyTopic as string) || '';

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

    if (ntfyTopic) {
      const { notifyVisitorWaiting } = await import('@/lib/notify');
      const appUrl = (
        process.env.NEXT_PUBLIC_APP_URL || 'https://live-desk-taupe.vercel.app'
      ).replace(/\/$/, '');
      // Don't block the visitor on notification delivery.
      void notifyVisitorWaiting({
        ntfyTopic,
        companyName,
        visitorName,
        consoleUrl: `${appUrl}/dashboard/console`,
      });
    }

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
    return NextResponse.json(
      {
        error: 'Failed to join queue',
        detail: message,
      },
      { status: 500 }
    );
  }
}
