import { NextRequest, NextResponse } from 'next/server';

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
 * Public presence for embeds / host sites.
 * GET /api/status/[slug] → { online, onlineCount, liveFeedActive, brandColor, name }
 */
export async function GET(
  _request: NextRequest,
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
    const membersSnap = await db
      .collection('companies')
      .doc(companyId)
      .collection('members')
      .where('online', '==', true)
      .get();

    const onlineCount = membersSnap.size;

    return NextResponse.json(
      {
        slug,
        name: (data.name as string) || 'LiveDesk',
        brandColor: (data.brandColor as string) || '#0f766e',
        online: onlineCount > 0,
        onlineCount,
        liveFeedActive: Boolean(data.liveFeedActive),
      },
      { headers: corsHeaders() }
    );
  } catch (err) {
    console.error('status api error', err);
    return NextResponse.json(
      { error: 'Failed to load status' },
      { status: 500, headers: corsHeaders() }
    );
  }
}
