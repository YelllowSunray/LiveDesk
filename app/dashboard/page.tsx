'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { useAuth } from '@/lib/firebase/auth-context';
import { updateCompanySettings } from '@/lib/companies';
import { sanitizeNtfyTopic } from '@/lib/notify';

export default function DashboardPage() {
  const { company, refreshCompany } = useAuth();
  const [name, setName] = useState(company?.name ?? '');
  const [brandColor, setBrandColor] = useState(company?.brandColor ?? '#0f766e');
  const [logoUrl, setLogoUrl] = useState(company?.logoUrl ?? '');
  const [welcomeMessage, setWelcomeMessage] = useState(
    company?.welcomeMessage ?? ''
  );
  const [ntfyTopic, setNtfyTopic] = useState(company?.ntfyTopic ?? '');

  useEffect(() => {
    if (!company) return;
    setName(company.name);
    setBrandColor(company.brandColor);
    setLogoUrl(company.logoUrl);
    setWelcomeMessage(company.welcomeMessage);
    setNtfyTopic(company.ntfyTopic || '');
  }, [company]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [copied, setCopied] = useState(false);
  const [testingNotify, setTestingNotify] = useState(false);

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ||
    (typeof window !== 'undefined' ? window.location.origin : '');

  const embedSnippet = useMemo(() => {
    if (!company) return '';
    return `<script src="${appUrl}/widget.js" data-company="${company.slug}" async></script>`;
  }, [appUrl, company]);

  const suggestedTopic = useMemo(() => {
    if (!company) return 'livedesk-queue';
    return `livedesk-${company.slug}-${company.id.slice(0, 6)}`;
  }, [company]);

  if (!company) return null;
  const companyId = company.id;
  const companySlug = company.slug;

  async function onSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      const topic = ntfyTopic.trim();
      if (topic && !sanitizeNtfyTopic(topic)) {
        throw new Error(
          'ntfy topic must be 3–64 characters: letters, numbers, _ or - only'
        );
      }
      await updateCompanySettings(companyId, {
        name: name.trim(),
        brandColor,
        logoUrl: logoUrl.trim(),
        welcomeMessage: welcomeMessage.trim(),
        ntfyTopic: topic,
      });
      await refreshCompany();
      setMessage('Settings saved');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  async function copyEmbed() {
    await navigator.clipboard.writeText(embedSnippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function sendTestNotification() {
    const topic = sanitizeNtfyTopic(ntfyTopic);
    if (!topic) {
      setMessage('Save a valid ntfy topic first');
      return;
    }
    setTestingNotify(true);
    setMessage('');
    try {
      const res = await fetch('/api/notify/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Test failed');
      setMessage('Test notification sent — check your iPhone');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Test failed');
    } finally {
      setTestingNotify(false);
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-slate-900">
          Company settings
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Branding shown in your embeddable visitor widget.
        </p>
        <form onSubmit={onSave} className="mt-6 space-y-4">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-slate-700">
              Company name
            </span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none ring-teal-600/30 focus:ring-2"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-slate-700">
              Widget slug
            </span>
            <input
              value={companySlug}
              disabled
              className="w-full rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-slate-500"
            />
            <span className="text-xs text-slate-500">
              Used in your embed URL: /w/{companySlug}
            </span>
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-slate-700">
              Brand color
            </span>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={brandColor}
                onChange={(e) => setBrandColor(e.target.value)}
                className="h-11 w-14 cursor-pointer rounded-lg border border-slate-200 bg-white p-1"
              />
              <input
                value={brandColor}
                onChange={(e) => setBrandColor(e.target.value)}
                className="flex-1 rounded-xl border border-slate-200 px-4 py-3 font-mono text-sm outline-none ring-teal-600/30 focus:ring-2"
              />
            </div>
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-slate-700">
              Logo URL (optional)
            </span>
            <input
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder="https://…"
              className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none ring-teal-600/30 focus:ring-2"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-slate-700">
              Welcome message
            </span>
            <textarea
              value={welcomeMessage}
              onChange={(e) => setWelcomeMessage(e.target.value)}
              rows={3}
              className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none ring-teal-600/30 focus:ring-2"
            />
          </label>

          <div className="rounded-2xl border border-teal-100 bg-teal-50/60 p-4 space-y-3">
            <div>
              <p className="text-sm font-semibold text-teal-950">
                Free iPhone alerts (ntfy)
              </p>
              <ol className="mt-2 list-decimal space-y-1 pl-4 text-xs text-teal-900/90">
                <li>
                  Install{' '}
                  <a
                    href="https://apps.apple.com/app/ntfy/id1625396347"
                    target="_blank"
                    rel="noreferrer"
                    className="underline"
                  >
                    ntfy
                  </a>{' '}
                  on your iPhone
                </li>
                <li>
                  In the app, tap +, subscribe to a topic (use a hard-to-guess
                  name)
                </li>
                <li>Paste that topic below and save</li>
              </ol>
            </div>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-slate-700">
                ntfy topic
              </span>
              <input
                value={ntfyTopic}
                onChange={(e) => setNtfyTopic(e.target.value)}
                placeholder={suggestedTopic}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 font-mono text-sm outline-none ring-teal-600/30 focus:ring-2"
              />
              <span className="text-xs text-slate-500">
                Suggested: <code>{suggestedTopic}</code> — anyone who knows this
                topic can see your alerts, so keep it secret.
              </span>
            </label>
            <button
              type="button"
              onClick={() => void sendTestNotification()}
              disabled={testingNotify || !ntfyTopic.trim()}
              className="rounded-xl border border-teal-700/30 bg-white px-4 py-2 text-sm font-semibold text-teal-900 hover:bg-teal-50 disabled:opacity-50"
            >
              {testingNotify ? 'Sending…' : 'Send test notification'}
            </button>
          </div>

          {message && (
            <p className="text-sm text-teal-800">{message}</p>
          )}
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-teal-700 px-5 py-3 font-semibold text-white hover:bg-teal-800 disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save settings'}
          </button>
        </form>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-slate-900">
          Embed on your site
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Paste this snippet before <code>&lt;/body&gt;</code>. Visitors get a
          floating “Talk to us” button.
        </p>
        <pre className="mt-4 overflow-x-auto rounded-2xl bg-slate-900 p-4 text-xs leading-relaxed text-teal-100">
          {embedSnippet}
        </pre>
        <button
          type="button"
          onClick={() => void copyEmbed()}
          className="mt-4 inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
        >
          {copied ? <Check size={16} /> : <Copy size={16} />}
          {copied ? 'Copied' : 'Copy snippet'}
        </button>
        <div className="mt-6 rounded-2xl border border-teal-100 bg-teal-50/70 p-4 text-sm text-teal-900">
          <p className="font-semibold">Preview</p>
          <p className="mt-1">
            Open{' '}
            <a
              href={`/w/${companySlug}`}
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              /w/{companySlug}
            </a>{' '}
            to test the visitor flow.
          </p>
        </div>
      </section>
    </div>
  );
}
