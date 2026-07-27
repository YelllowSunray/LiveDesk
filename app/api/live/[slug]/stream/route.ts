import { AccessToken } from 'livekit-server-sdk';
import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { liveWatchUrl } from '@/lib/app-url';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'no-store',
  };
}

function previewRoomName(companyId: string) {
  return `preview_${companyId}`.slice(0, 64);
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

/**
 * Public LiveKit viewer credentials + watch page URL for the lobby live feed.
 * GET|POST /api/live/[slug]/stream
 */
async function issueViewerToken(slug: string, request: NextRequest) {
  if (!slug) {
    return NextResponse.json(
      { error: 'Missing slug' },
      { status: 400, headers: corsHeaders() }
    );
  }

  const watchUrl = liveWatchUrl(slug, request);
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  const wsUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;
  if (!apiKey || !apiSecret || !wsUrl) {
    return NextResponse.json(
      { error: 'Server misconfigured — missing LiveKit credentials' },
      { status: 500, headers: corsHeaders() }
    );
  }

  const { getAdminDb } = await import('@/lib/firebase/admin');
  const db = getAdminDb();
  const slugSnap = await db.collection('slugs').doc(slug).get();
  if (!slugSnap.exists) {
    return NextResponse.json(
      { error: 'Company not found' },
      { status: 404, headers: corsHeaders() }
    );
  }

  const companyId = slugSnap.data()!.companyId as string;
  const companySnap = await db.collection('companies').doc(companyId).get();
  const data = companySnap.data() || {};
  const streaming = Boolean(data.liveFeedActive);

  if (!companySnap.exists || !streaming) {
    return NextResponse.json(
      {
        streaming: false,
        watchUrl,
        embedUrl: watchUrl,
        error: 'Not streaming',
      },
      { status: 404, headers: corsHeaders() }
    );
  }

  const roomName = previewRoomName(companyId);
  const identity = `viewer_${randomUUID().replace(/-/g, '').slice(0, 24)}`;

  const at = new AccessToken(apiKey, apiSecret, {
    identity,
    name: 'Viewer',
  });
  at.addGrant({
    room: roomName,
    roomJoin: true,
    canPublish: false,
    canSubscribe: true,
    canPublishData: false,
  });

  const token = await at.toJwt();

  return NextResponse.json(
    {
      streaming: true,
      /** Drop this URL into an iframe on your agency site */
      watchUrl,
      embedUrl: watchUrl,
      embedHtml: `<iframe src="${watchUrl}" title="Live feed" allow="autoplay; camera; microphone" style="width:100%;aspect-ratio:4/3;border:0;border-radius:16px;overflow:hidden"></iframe>`,
      token,
      wsUrl,
      roomName,
      companyId,
      slug,
      brandColor: (data.brandColor as string) || '#0f766e',
      name: (data.name as string) || 'LiveDesk',
    },
    { headers: corsHeaders() }
  );
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug: raw } = await context.params;
    return await issueViewerToken(
      typeof raw === 'string' ? raw.trim() : '',
      request
    );
  } catch (err) {
    console.error('live stream api error', err);
    return NextResponse.json(
      { error: 'Failed to create stream token' },
      { status: 500, headers: corsHeaders() }
    );
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug: raw } = await context.params;
    return await issueViewerToken(
      typeof raw === 'string' ? raw.trim() : '',
      request
    );
  } catch (err) {
    console.error('live stream api error', err);
    return NextResponse.json(
      { error: 'Failed to create stream token' },
      { status: 500, headers: corsHeaders() }
    );
  }
}
