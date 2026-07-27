import { NextRequest, NextResponse } from 'next/server';
import { notifyVisitorWaiting, sanitizeNtfyTopic } from '@/lib/notify';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const topic = sanitizeNtfyTopic(
      typeof body.topic === 'string' ? body.topic : ''
    );
    if (!topic) {
      return NextResponse.json({ error: 'Invalid topic' }, { status: 400 });
    }

    const appUrl = (
      process.env.NEXT_PUBLIC_APP_URL || 'https://live-desk-taupe.vercel.app'
    ).replace(/\/$/, '');

    await notifyVisitorWaiting({
      ntfyTopic: topic,
      companyName: 'LiveDesk',
      visitorName: 'Test visitor',
      consoleUrl: `${appUrl}/dashboard/console`,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('notify test failed:', error);
    return NextResponse.json({ error: 'Failed to send test' }, { status: 500 });
  }
}
