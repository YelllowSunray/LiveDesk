import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const info: Record<string, unknown> = {
    hasProjectId: Boolean(process.env.FIREBASE_ADMIN_PROJECT_ID),
    hasClientEmail: Boolean(process.env.FIREBASE_ADMIN_CLIENT_EMAIL),
    hasPrivateKey: Boolean(process.env.FIREBASE_ADMIN_PRIVATE_KEY),
    hasPrivateKeyBase64: Boolean(process.env.FIREBASE_ADMIN_PRIVATE_KEY_BASE64),
    projectIdLen: process.env.FIREBASE_ADMIN_PROJECT_ID?.length ?? 0,
    clientEmailLen: process.env.FIREBASE_ADMIN_CLIENT_EMAIL?.length ?? 0,
    privateKeyLen: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.length ?? 0,
    privateKeyBase64Len: process.env.FIREBASE_ADMIN_PRIVATE_KEY_BASE64?.length ?? 0,
  };

  try {
    const { getAdminDb, getAdminAuth } = await import('@/lib/firebase/admin');
    const db = getAdminDb();
    const snap = await db.collection('slugs').doc('samirdev').get();
    info.slugExists = snap.exists;
    const token = await getAdminAuth().createCustomToken('diag_visitor_1');
    info.tokenLen = token.length;
    info.ok = true;
  } catch (e) {
    info.ok = false;
    info.errorName = e instanceof Error ? e.name : typeof e;
    info.errorMessage = e instanceof Error ? e.message : String(e);
  }

  return NextResponse.json(info);
}
