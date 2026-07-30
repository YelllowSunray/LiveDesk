import { NextRequest, NextResponse } from 'next/server';
import { notifyVisitorWaiting, sanitizeNtfyTopic } from '@/lib/notify';
import {
  callAgentAboutVisitor,
  isPhoneCallConfigured,
  sanitizeE164Phone,
} from '@/lib/phone-call';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const channel = body.channel === 'phone' ? 'phone' : 'ntfy';
    const appUrl = (
      process.env.NEXT_PUBLIC_APP_URL || 'https://live-desk-taupe.vercel.app'
    ).replace(/\/$/, '');

    if (channel === 'phone') {
      const phone = sanitizeE164Phone(
        typeof body.phone === 'string' ? body.phone : ''
      );
      if (!phone) {
        return NextResponse.json(
          {
            error:
              'Invalid phone. Use E.164 with country code, e.g. +31612345678',
          },
          { status: 400 }
        );
      }
      if (!isPhoneCallConfigured()) {
        return NextResponse.json(
          {
            error:
              'Phone calling is not configured. Set VONAGE_APPLICATION_ID, VONAGE_PRIVATE_KEY (or _BASE64), and VONAGE_FROM_NUMBER on Vercel.',
          },
          { status: 503 }
        );
      }
      const result = await callAgentAboutVisitor({
        toPhone: phone,
        companyName: 'SamirDev',
        visitorName: 'Test visitor',
      });
      if (!result.ok) {
        return NextResponse.json(
          { error: result.error || 'Call failed' },
          { status: 502 }
        );
      }
      return NextResponse.json({ ok: true, channel: 'phone' });
    }

    const topic = sanitizeNtfyTopic(
      typeof body.topic === 'string' ? body.topic : ''
    );
    if (!topic) {
      return NextResponse.json({ error: 'Invalid topic' }, { status: 400 });
    }

    await notifyVisitorWaiting({
      ntfyTopic: topic,
      companyName: 'LiveDesk',
      visitorName: 'Test visitor',
      consoleUrl: `${appUrl}/dashboard/console`,
    });

    return NextResponse.json({ ok: true, channel: 'ntfy' });
  } catch (error) {
    console.error('notify test failed:', error);
    return NextResponse.json({ error: 'Failed to send test' }, { status: 500 });
  }
}
