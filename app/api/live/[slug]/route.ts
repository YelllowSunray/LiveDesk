import { NextRequest, NextResponse } from 'next/server';
import { getAppOrigin, liveWatchUrl } from '@/lib/app-url';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'no-store',
  };
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

/**
 * Public live-feed flag for host sites.
 * GET /api/live/[slug] → { streaming: true | false, watchUrl, ... }
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug: raw } = await context.params;
    const slug = typeof raw === 'string' ? raw.trim() : '';
    if (!slug) {
      return NextResponse.json(
        { error: 'Missing slug' },
        { status: 400, headers: corsHeaders() }
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
    if (!companySnap.exists) {
      return NextResponse.json(
        { error: 'Company not found' },
        { status: 404, headers: corsHeaders() }
      );
    }

    const data = companySnap.data() || {};
    const streaming = Boolean(data.liveFeedActive);
    const origin = getAppOrigin(request);
    const watchUrl = liveWatchUrl(slug, request);

    return NextResponse.json(
      {
        slug,
        streaming,
        liveFeedActive: streaming,
        name: (data.name as string) || 'LiveDesk',
        brandColor: (data.brandColor as string) || '#0f766e',
        watchUrl,
        embedUrl: watchUrl,
        streamUrl: `${origin}/api/live/${encodeURIComponent(slug)}/stream`,
      },
      { headers: corsHeaders() }
    );
  } catch (err) {
    console.error('live status api error', err);
    return NextResponse.json(
      { error: 'Failed to load live status' },
      { status: 500, headers: corsHeaders() }
    );
  }
}
