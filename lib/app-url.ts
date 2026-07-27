/**
 * Public app origin for absolute watch/embed URLs.
 */
export function getAppOrigin(request?: Request): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '');
  if (fromEnv) return fromEnv;

  if (request) {
    const proto = request.headers.get('x-forwarded-proto') || 'https';
    const host =
      request.headers.get('x-forwarded-host') ||
      request.headers.get('host');
    if (host) return `${proto}://${host}`.replace(/\/$/, '');
  }

  return 'https://live-desk-taupe.vercel.app';
}

export function liveWatchUrl(slug: string, request?: Request): string {
  return `${getAppOrigin(request)}/live/${encodeURIComponent(slug)}`;
}
