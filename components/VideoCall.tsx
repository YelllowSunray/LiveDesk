'use client';

import { useEffect, useState } from 'react';
import {
  LiveKitRoom,
  RoomAudioRenderer,
  VideoConference,
  useRoomContext,
} from '@livekit/components-react';
import { Menu, PhoneOff, X } from 'lucide-react';
import { getClientAuth } from '@/lib/firebase/client';
import { getWidgetAuth } from '@/lib/firebase/widget-client';
import { PomodoroTimer } from '@/components/PomodoroTimer';
import { RadioPlayer } from '@/components/RadioPlayer';

interface VideoCallProps {
  roomName: string;
  participantName: string;
  companyId: string;
  sessionId: string;
  role: 'agent' | 'visitor';
  brandColor?: string;
  title?: string;
  onEnded?: () => void;
  /** Visitors must use the isolated widget Firebase app. */
  auth?: 'default' | 'widget';
}

function CallRoomContent({
  title,
  participantName,
  brandColor,
  onEnded,
}: {
  title: string;
  participantName: string;
  brandColor: string;
  onEnded?: () => void;
}) {
  const room = useRoomContext();
  const [showTools, setShowTools] = useState(false);

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-slate-950">
      <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-3 py-2.5 sm:px-4">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">{title}</p>
          <p className="truncate text-xs text-slate-400">{participantName}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setShowTools((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-2.5 py-1.5 text-xs font-medium text-slate-200 hover:bg-white/15 lg:hidden"
            aria-expanded={showTools}
            aria-label={showTools ? 'Hide tools' : 'Show timer and radio'}
          >
            {showTools ? <X size={16} /> : <Menu size={16} />}
            Tools
          </button>
          {onEnded && (
            <button
              type="button"
              onClick={onEnded}
              className="inline-flex items-center gap-2 rounded-lg bg-red-500/20 px-3 py-1.5 text-sm font-medium text-red-300 hover:bg-red-500/30"
            >
              <PhoneOff size={16} />
              End
            </button>
          )}
        </div>
      </div>

      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
        {/* Left sidebar — Pomodoro + Radio (same as previous StudyRoom) */}
        <aside
          className={`${
            showTools ? 'flex' : 'hidden'
          } absolute inset-0 z-20 flex-col overflow-y-auto border-white/10 bg-slate-900 lg:static lg:z-0 lg:flex lg:w-80 lg:shrink-0 lg:border-r`}
        >
          <div className="space-y-4 p-4">
            <div className="flex items-center justify-between lg:hidden">
              <p className="text-sm font-semibold text-white">Call tools</p>
              <button
                type="button"
                onClick={() => setShowTools(false)}
                className="rounded-lg bg-white/10 p-2 text-slate-200"
                aria-label="Close tools"
              >
                <X size={16} />
              </button>
            </div>
            <PomodoroTimer room={room} />
            <RadioPlayer room={room} />
          </div>
        </aside>

        {/* Video stage */}
        <div
          className="relative min-h-0 min-w-0 flex-1 overflow-hidden bg-slate-950"
          style={{ ['--lk-accent-bg' as string]: brandColor }}
        >
          <VideoConference />
          <RoomAudioRenderer />
        </div>
      </div>
    </div>
  );
}

export function VideoCall({
  roomName,
  participantName,
  companyId,
  sessionId,
  role,
  brandColor = '#0f766e',
  title = 'LiveDesk Call',
  onEnded,
  auth = 'default',
}: VideoCallProps) {
  const [token, setToken] = useState('');
  const [wsUrl, setWsUrl] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function connect() {
      setError('');
      try {
        const authClient = auth === 'widget' ? getWidgetAuth() : getClientAuth();
        const user = authClient.currentUser;
        if (!user) {
          throw new Error('Not authenticated');
        }
        const idToken = await user.getIdToken();
        const res = await fetch('/api/livekit-token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            companyId,
            sessionId,
            roomName,
            participantName,
            role,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Failed to get call token');
        }
        if (!cancelled) {
          setToken(data.token);
          setWsUrl(data.wsUrl);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Connection failed');
        }
      }
    }

    void connect();
    return () => {
      cancelled = true;
    };
  }, [companyId, sessionId, roomName, participantName, role, auth]);

  if (error) {
    return (
      <div className="flex h-full min-h-[320px] items-center justify-center p-6">
        <div className="max-w-sm text-center">
          <p className="mb-2 text-lg font-semibold text-red-600">Call error</p>
          <p className="text-sm text-slate-600">{error}</p>
        </div>
      </div>
    );
  }

  if (!token || !wsUrl) {
    return (
      <div className="flex h-full min-h-[320px] items-center justify-center p-6">
        <div className="text-center">
          <div
            className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-transparent"
            style={{ borderTopColor: brandColor }}
          />
          <p className="text-sm text-slate-600">Connecting to video…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full min-h-[320px] overflow-hidden rounded-2xl">
      <LiveKitRoom
        video
        audio
        token={token}
        serverUrl={wsUrl}
        connectOptions={{ autoSubscribe: true }}
        onError={(err) => setError(err.message)}
        className="h-full w-full"
        data-lk-theme="default"
      >
        <CallRoomContent
          title={title}
          participantName={participantName}
          brandColor={brandColor}
          onEnded={onEnded}
        />
      </LiveKitRoom>
    </div>
  );
}
