/**
 * Phone alerts when a visitor taps Start video call.
 * Prefers Vonage Voice; falls back to Twilio if configured.
 *
 * Vonage (recommended):
 *   VONAGE_APPLICATION_ID
 *   VONAGE_PRIVATE_KEY  (PEM; use \n or VONAGE_PRIVATE_KEY_BASE64)
 *   VONAGE_FROM_NUMBER  (E.164 or digits, e.g. 31612345678)
 *
 * Twilio (optional fallback):
 *   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER
 */

import { randomUUID } from 'crypto';
import { importPKCS8, SignJWT } from 'jose';
import { sanitizeE164Phone } from '@/lib/phone';

export { sanitizeE164Phone };

function digitsOnlyPhone(raw: string): string {
  const e164 = sanitizeE164Phone(raw);
  if (e164) return e164.replace(/^\+/, '');
  const digits = raw.trim().replace(/\D/g, '');
  return digits.length >= 8 ? digits : '';
}

function normalizePrivateKey(raw: string): string {
  let key = raw.trim();
  if (!key.includes('BEGIN') && /^[A-Za-z0-9+/=\s]+$/.test(key)) {
    try {
      const decoded = Buffer.from(key.replace(/\s+/g, ''), 'base64').toString(
        'utf8'
      );
      if (decoded.includes('BEGIN')) key = decoded.trim();
    } catch {
      // keep original
    }
  }
  if (
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'"))
  ) {
    key = key.slice(1, -1).trim();
  }
  return key.replace(/\\n/g, '\n');
}

export function isVonageConfigured(): boolean {
  const appId = process.env.VONAGE_APPLICATION_ID;
  const from = process.env.VONAGE_FROM_NUMBER;
  const key =
    process.env.VONAGE_PRIVATE_KEY_BASE64 || process.env.VONAGE_PRIVATE_KEY;
  return Boolean(appId && from && key);
}

export function isTwilioConfigured(): boolean {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_FROM_NUMBER
  );
}

export function isPhoneCallConfigured(): boolean {
  return isVonageConfigured() || isTwilioConfigured();
}

async function vonageJwt(): Promise<string> {
  const applicationId = process.env.VONAGE_APPLICATION_ID!;
  const rawKey =
    process.env.VONAGE_PRIVATE_KEY_BASE64 || process.env.VONAGE_PRIVATE_KEY!;
  const pem = normalizePrivateKey(rawKey);
  const key = await importPKCS8(pem, 'RS256');
  return new SignJWT({ application_id: applicationId })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .setIssuedAt()
    .setExpirationTime('15m')
    .setJti(randomUUID())
    .sign(key);
}

async function callWithVonage(input: {
  toPhone: string;
  companyName: string;
}): Promise<{ ok: boolean; error?: string }> {
  const to = digitsOnlyPhone(input.toPhone);
  const from = digitsOnlyPhone(process.env.VONAGE_FROM_NUMBER || '');
  if (!to) return { ok: false, error: 'Invalid phone number' };
  if (!from) return { ok: false, error: 'Invalid Vonage from number' };

  const text = `There is a SamirDev customer waiting to call. Again, there is a SamirDev customer waiting to call. Again, there is a SamirDev customer waiting to call.`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const jwt = await vonageJwt();
    const res = await fetch('https://api.nexmo.com/v1/calls', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${jwt}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: [{ type: 'phone', number: to }],
        from: { type: 'phone', number: from },
        ncco: [
          {
            action: 'talk',
            text,
            language: 'en-US',
            style: 0,
          },
        ],
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const body = await res.text();
      console.error('vonage call failed', res.status, body);
      return { ok: false, error: 'Vonage rejected the call' };
    }
    return { ok: true };
  } catch (err) {
    console.error('vonage call error', err);
    return { ok: false, error: 'Failed to place Vonage call' };
  } finally {
    clearTimeout(timeout);
  }
}

async function callWithTwilio(input: {
  toPhone: string;
  companyName: string;
}): Promise<{ ok: boolean; error?: string }> {
  const to = sanitizeE164Phone(input.toPhone);
  if (!to) return { ok: false, error: 'Invalid phone number' };

  const accountSid = process.env.TWILIO_ACCOUNT_SID!;
  const authToken = process.env.TWILIO_AUTH_TOKEN!;
  const from = process.env.TWILIO_FROM_NUMBER!;

  const say = `There is a ${input.companyName} customer waiting to call. Open your Live Desk agent console to accept.`;
  const twiml = `<Response><Say voice="alice">${escapeXml(say)}</Say></Response>`;

  const body = new URLSearchParams({
    To: to,
    From: from,
    Twiml: twiml,
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(accountSid)}/Calls.json`,
      {
        method: 'POST',
        headers: {
          Authorization:
            'Basic ' +
            Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body,
        signal: controller.signal,
      }
    );
    if (!res.ok) {
      const text = await res.text();
      console.error('twilio call failed', res.status, text);
      return { ok: false, error: 'Twilio rejected the call' };
    }
    return { ok: true };
  } catch (err) {
    console.error('twilio call error', err);
    return { ok: false, error: 'Failed to place call' };
  } finally {
    clearTimeout(timeout);
  }
}

/** Ring the agent phone when a visitor joins (same moment as ntfy). */
export async function callAgentAboutVisitor(input: {
  toPhone: string;
  companyName: string;
  visitorName: string;
}): Promise<{ ok: boolean; error?: string }> {
  if (isVonageConfigured()) {
    return callWithVonage({
      toPhone: input.toPhone,
      companyName: input.companyName,
    });
  }
  if (isTwilioConfigured()) {
    return callWithTwilio({
      toPhone: input.toPhone,
      companyName: input.companyName,
    });
  }
  return {
    ok: false,
    error:
      'Phone calling is not configured. Set Vonage Application ID, private key, and from number on Vercel.',
  };
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
