'use client';

import { useCallback, useEffect, useState } from 'react';
import { Headphones, UserRound, Video } from 'lucide-react';
import { VideoCall } from '@/components/VideoCall';
import {
  LiveFeedPublisher,
  useSharedAgentCamera,
} from '@/components/LiveFeedPublisher';
import { useAuth } from '@/lib/firebase/auth-context';
import {
  acceptSession,
  endSession,
  setLiveFeedActive,
  setMemberOnline,
  subscribeCompany,
  subscribeMember,
  subscribeWaitingSessions,
} from '@/lib/companies';
import type { CallSession } from '@/lib/types';

export default function ConsolePage() {
  const { user, company, profile, refreshCompany } = useAuth();
  const [online, setOnline] = useState(false);
  const [liveFeed, setLiveFeed] = useState(false);
  const [queue, setQueue] = useState<CallSession[]>([]);
  const [active, setActive] = useState<CallSession | null>(null);
  const [error, setError] = useState('');
  const [acceptingId, setAcceptingId] = useState<string | null>(null);

  // Keep camera alive while live feed is on (including during 1:1 calls).
  const { track: sharedCamera, error: cameraError } =
    useSharedAgentCamera(liveFeed);

  useEffect(() => {
    if (cameraError) setError(cameraError);
  }, [cameraError]);

  useEffect(() => {
    if (!company || !user) return;
    return subscribeMember(company.id, user.uid, (member) => {
      if (member) setOnline(member.online);
    });
  }, [company, user]);

  useEffect(() => {
    if (!company) return;
    setLiveFeed(Boolean(company.liveFeedActive));
    return subscribeCompany(company.id, (next) => {
      if (next) setLiveFeed(Boolean(next.liveFeedActive));
    });
  }, [company]);

  useEffect(() => {
    if (!company) return;
    return subscribeWaitingSessions(
      company.id,
      setQueue,
      (message) => setError(message)
    );
  }, [company]);

  useEffect(() => {
    if (!online || !company || !user) return;

    const goOffline = () => {
      void setMemberOnline(company.id, user.uid, false);
      void setLiveFeedActive(company.id, false);
    };

    window.addEventListener('pagehide', goOffline);
    window.addEventListener('beforeunload', goOffline);
    return () => {
      window.removeEventListener('pagehide', goOffline);
      window.removeEventListener('beforeunload', goOffline);
    };
  }, [online, company, user]);

  async function toggleOnline() {
    if (!company || !user) return;
    setError('');
    try {
      const next = !online;
      await setMemberOnline(company.id, user.uid, next);
      setOnline(next);
      if (!next) {
        await setLiveFeedActive(company.id, false);
        setLiveFeed(false);
        await refreshCompany();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update status');
    }
  }

  async function toggleLiveFeed() {
    if (!company || !user) return;
    setError('');
    try {
      const next = !liveFeed;
      if (next && !online) {
        await setMemberOnline(company.id, user.uid, true);
        setOnline(true);
      }
      await setLiveFeedActive(company.id, next);
      setLiveFeed(next);
      await refreshCompany();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to update live feed'
      );
    }
  }

  async function onAccept(session: CallSession) {
    if (!company || !user) return;
    setAcceptingId(session.id);
    setError('');
    try {
      // Keep live feed on so other visitors still see the lobby camera.
      await acceptSession(company.id, session.id, user.uid);
      setActive({
        ...session,
        status: 'connected',
        roomName: `call_${session.id}`,
        agentId: user.uid,
        connectedAt: Date.now(),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to accept');
    } finally {
      setAcceptingId(null);
    }
  }

  const onEndCall = useCallback(async () => {
    if (!company || !active) return;
    await endSession(company.id, active.id);
    setActive(null);
  }, [company, active]);

  if (!company || !user || !profile) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-slate-900">
            Agent console
          </h1>
          <p className="text-sm text-slate-600">
            Live feed stays on during calls so other visitors can still see you
            on the widget.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void toggleLiveFeed()}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white ${
              liveFeed
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-slate-600 hover:bg-slate-700'
            }`}
          >
            <Video size={16} />
            {liveFeed ? 'Live feed on' : 'Show live feed'}
          </button>
          <button
            type="button"
            onClick={() => void toggleOnline()}
            className={`rounded-xl px-5 py-3 text-sm font-semibold text-white ${
              online
                ? 'bg-emerald-600 hover:bg-emerald-700'
                : 'bg-slate-700 hover:bg-slate-800'
            }`}
          >
            {online ? 'Online — click to go offline' : 'Go online'}
          </button>
        </div>
      </div>

      {error && (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {liveFeed && sharedCamera && (
        <section
          className={`rounded-3xl border border-red-200 bg-white shadow-sm ${
            active ? 'p-3' : 'p-4'
          }`}
        >
          {!active && (
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  Widget live feed
                </p>
                <p className="text-xs text-slate-500">
                  Visitors see this camera with a red LIVE badge. Stays on while
                  you take calls.
                </p>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-md bg-red-600 px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-white">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                Live
              </span>
            </div>
          )}
          <div className={active ? 'max-w-[180px]' : 'mx-auto max-w-xl'}>
            <LiveFeedPublisher
              companyId={company.id}
              participantName={profile.displayName || 'Agent'}
              cameraTrack={sharedCamera}
              compact={!!active}
              onError={setError}
            />
          </div>
          {active && (
            <p className="mt-2 text-xs text-slate-500">
              Lobby LIVE feed still broadcasting to the widget.
            </p>
          )}
        </section>
      )}

      {active?.roomName ? (
        <div className="h-[min(820px,calc(100vh-9rem))] overflow-hidden rounded-3xl border border-slate-200 bg-slate-950 p-2 shadow-sm">
          <VideoCall
            companyId={company.id}
            sessionId={active.id}
            roomName={active.roomName}
            participantName={profile.displayName || 'Agent'}
            role="agent"
            brandColor={company.brandColor}
            title={`Call with ${active.visitorName}`}
            onEnded={() => void onEndCall()}
            sharedCameraTrack={liveFeed ? sharedCamera : null}
          />
        </div>
      ) : (
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Headphones className="text-teal-700" size={20} />
            <h2 className="text-lg font-semibold text-slate-900">
              Waiting queue
            </h2>
          </div>
          {!online && (
            <p className="mb-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
              You are offline. Visitors can still join the queue; go online to
              accept calls.
            </p>
          )}
          {queue.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 py-16 text-center">
              <UserRound className="mb-3 text-slate-300" size={36} />
              <p className="font-medium text-slate-700">No visitors waiting</p>
              <p className="mt-1 text-sm text-slate-500">
                When someone taps Start video call on your widget, they appear
                here.
              </p>
            </div>
          ) : (
            <ul className="space-y-3">
              {queue.map((session, index) => (
                <li
                  key={session.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3"
                >
                  <div>
                    <p className="font-semibold text-slate-900">
                      #{index + 1} · {session.visitorName}
                    </p>
                    <p className="text-xs text-slate-500">
                      Waiting since{' '}
                      {new Date(session.createdAt).toLocaleTimeString()}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={!online || !!acceptingId}
                    onClick={() => void onAccept(session)}
                    className="rounded-xl bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {acceptingId === session.id ? 'Connecting…' : 'Accept'}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
