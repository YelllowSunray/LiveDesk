/** E.164 phone helpers (safe for client + server). */

export function sanitizeE164Phone(raw: string): string {
  const trimmed = raw.trim().replace(/[\s()-]/g, '');
  if (!trimmed) return '';
  if (!/^\+[1-9]\d{7,14}$/.test(trimmed)) return '';
  return trimmed;
}
