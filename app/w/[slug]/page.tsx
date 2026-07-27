'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { VideoCall } from '@/components/VideoCall';
import {
  endSession,
  getCompanyBySlug,
  getQueuePosition,
  subscribeCompany,
  subscribeMembersOnline,
  subscribeSession,
} from '@/lib/companies';
import { LiveFeedViewer } from '@/components/LiveFeedViewer';
import {
  getWidgetDb,
  signInWidgetWithCustomToken,
} from '@/lib/firebase/widget-client';
import type { CallSession, Company } from '@/lib/types';

export default function WidgetPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;

  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [session, setSession] = useState<CallSession | null>(null);
  const [position, setPosition] = useState(1);
  const [onlineAgents, setOnlineAgents] = useState(0);
  const [error, setError] = useState('');
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const c = await getCompanyBySlug(slug, getWidgetDb());
        if (cancelled) return;
        if (!c) {
          setNotFound(true);
        } else {
          setCompany(c);
        }
      } catch {
        if (!cancelled) setNotFound(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  useEffect(() => {
    if (!company) return;
    return subscribeMembersOnline(company.id, setOnlineAgents, getWidgetDb());
  }, [company]);

  useEffect(() => {
    if (!company) return;
    return subscribeCompany(
      company.id,
      (next) => {
        if (next) setCompany(next);
      },
      getWidgetDb()
    );
  }, [company?.id]);

  useEffect(() => {
    if (!company || !session) return;
    return subscribeSession(
      company.id,
      session.id,
      (next) => {
        if (next) setSession(next);
      },
      getWidgetDb()
    );
  }, [company, session?.id]);

  useEffect(() => {
    if (!company || !session || session.status !== 'waiting') return;
    let cancelled = false;
    async function refreshPosition() {
      const pos = await getQueuePosition(
        company!.id,
        session!.id,
        session!.createdAt,
        getWidgetDb()
      );
      if (!cancelled) setPosition(pos);
    }
    void refreshPosition();
    const id = window.setInterval(() => void refreshPosition(), 3000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [company, session]);

  const brand = company?.brandColor || '#0f766e';

  const statusLabel = useMemo(() => {
    if (onlineAgents > 0) return 'A representative is available';
    return 'No one is online — leave your place in line';
  }, [onlineAgents]);

  async function onJoin() {
    if (!company || !slug || joining) return;
    setJoining(true);
    setError('');
    try {
      const res = await fetch('/api/visitor/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug }),
      });
      const raw = await res.text();
      let data: {
        error?: string;
        customToken?: string;
        session?: CallSession;
      } = {};
      try {
        data = JSON.parse(raw) as typeof data;
      } catch {
        throw new Error(
          res.ok
            ? 'Invalid server response'
            : 'Server error joining queue. Check Firebase Admin env vars on Vercel.'
        );
      }
      if (!res.ok) {
        throw new Error(data.error || 'Could not join queue');
      }
      if (!data.customToken || !data.session) {
        throw new Error('Invalid join response from server');
      }
      await signInWidgetWithCustomToken(data.customToken);
      setSession(data.session);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not join queue');
    } finally {
      setJoining(false);
    }
  }

  async function leaveQueue() {
    if (!company || !session) return;
    try {
      await endSession(company.id, session.id, getWidgetDb());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not leave queue');
      return;
    }
    setSession(null);
  }

  if (loading) {
    return (
      <Shell>
        <div className="flex h-full items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-teal-700" />
        </div>
      </Shell>
    );
  }

  if (notFound || !company) {
    return (
      <Shell>
        <div className="flex h-full items-center justify-center p-6 text-center">
          <div>
            <p className="text-lg font-semibold text-slate-900">Widget not found</p>
            <p className="mt-1 text-sm text-slate-600">
              This company slug is invalid or unavailable.
            </p>
          </div>
        </div>
      </Shell>
    );
  }

  if (session?.status === 'connected' && session.roomName) {
    return (
      <Shell>
        <div className="flex h-full flex-col p-3">
          <VideoCall
            companyId={company.id}
            sessionId={session.id}
            roomName={session.roomName}
            participantName={session.visitorName}
            role="visitor"
            brandColor={brand}
            title={company.name}
            onEnded={() => void leaveQueue()}
            auth="widget"
          />
        </div>
      </Shell>
    );
  }

  if (session?.status === 'ended') {
    return (
      <Shell>
        <div className="flex h-full flex-col items-center justify-center p-6 text-center">
          <p className="text-lg font-semibold text-slate-900">Call ended</p>
          <button
            type="button"
            onClick={() => setSession(null)}
            className="mt-4 rounded-xl px-4 py-2 text-sm font-semibold text-white"
            style={{ backgroundColor: brand }}
          >
            Start again
          </button>
        </div>
      </Shell>
    );
  }

  if (session?.status === 'waiting') {
    return (
      <Shell>
        <div className="flex h-full flex-col items-center justify-center p-6 text-center">
          {company.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={company.logoUrl}
              alt=""
              className="mb-4 h-12 w-12 rounded-full object-cover"
            />
          ) : null}
          <p className="text-lg font-semibold text-slate-900">
            You&apos;re in line
          </p>
          <p className="mt-2 text-4xl font-bold" style={{ color: brand }}>
            #{position}
          </p>
          <p className="mt-3 max-w-xs text-sm text-slate-600">
            Hang tight. A {company.name} representative will connect you on
            video soon.
          </p>
          <p className="mt-2 text-xs text-slate-500">{statusLabel}</p>
          <button
            type="button"
            onClick={() => void leaveQueue()}
            className="mt-6 text-sm font-medium text-slate-500 underline"
          >
            Leave queue
          </button>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="flex h-full flex-col justify-between gap-4 overflow-y-auto p-4 sm:p-6">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            {company.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={company.logoUrl}
                alt=""
                className="h-10 w-10 rounded-full object-cover"
              />
            ) : (
              <div
                className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white"
                style={{ backgroundColor: brand }}
              >
                {company.name.slice(0, 1).toUpperCase()}
              </div>
            )}
            <div>
              <p className="font-semibold text-slate-900">{company.name}</p>
              <p className="text-xs text-slate-500">{statusLabel}</p>
            </div>
          </div>

          {company.liveFeedActive ? (
            <LiveFeedViewer slug={slug} brandColor={brand} />
          ) : (
            <>
              <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-slate-900">
                {company.welcomeMessage}
              </h1>
              <p className="text-sm text-slate-600">
                Start a live video conversation with our team — no chat bots.
              </p>
            </>
          )}
        </div>
        <div className="space-y-3">
          {error && (
            <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}
          <button
            type="button"
            onClick={() => void onJoin()}
            disabled={joining}
            className="w-full rounded-xl px-4 py-3 font-semibold text-white disabled:opacity-60"
            style={{ backgroundColor: brand }}
          >
            {joining ? 'Joining…' : 'Start video call'}
          </button>
        </div>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-screen w-screen overflow-hidden bg-[radial-gradient(circle_at_top,_#ecfdf5,_#f8fafc_55%)]">
      {children}
    </div>
  );
}
