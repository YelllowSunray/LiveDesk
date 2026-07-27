/**
 * Free iPhone alerts via ntfy.sh (install the ntfy app and subscribe to the topic).
 * https://ntfy.sh
 */
export async function notifyVisitorWaiting(input: {
  ntfyTopic: string;
  companyName: string;
  visitorName: string;
  consoleUrl?: string;
}): Promise<void> {
  const topic = sanitizeNtfyTopic(input.ntfyTopic);
  if (!topic) return;

  const title = `${input.companyName}: visitor waiting`;
  const body = `${input.visitorName} joined the LiveDesk queue. Open the agent console to accept.`;
  const headers: Record<string, string> = {
    Title: title,
    Priority: 'high',
    Tags: 'telephone_receiver,bell',
  };
  if (input.consoleUrl) {
    headers.Click = input.consoleUrl;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4000);
  try {
    await fetch(`https://ntfy.sh/${encodeURIComponent(topic)}`, {
      method: 'POST',
      headers,
      body,
      signal: controller.signal,
    });
  } catch (err) {
    console.error('ntfy notify failed:', err);
  } finally {
    clearTimeout(timeout);
  }
}

/** Topics: letters, numbers, _ and - only (ntfy public topic rules). */
export function sanitizeNtfyTopic(raw: string): string {
  const topic = raw.trim();
  if (!topic) return '';
  if (!/^[a-zA-Z0-9_-]{3,64}$/.test(topic)) return '';
  return topic;
}
