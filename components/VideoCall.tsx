'use client';

import { useEffect, useState } from 'react';
import {
  LiveKitRoom,
  RoomAudioRenderer,
  VideoConference,
  useRoomContext,
} from '@livekit/components-react';
import { PhoneOff } from 'lucide-react';
import { getClientAuth } from '@/lib/firebase/client';
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
}

function CallTools() {
  const room = useRoomContext();
  return (
    <div className="flex h-full w-full flex-col gap-4 overflow-y-auto p-4">
      <PomodoroTimer room={room} />
      <RadioPlayer room={room} />
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
}: VideoCallProps) {
  const [token, setToken] = useState('');
  const [wsUrl, setWsUrl] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function connect() {
      setError('');
      try {
        const user = getClientAuth().currentUser;
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
  }, [companyId, sessionId, roomName, participantName, role]);

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
    <div className="flex h-full min-h-[320px] flex-col overflow-hidden rounded-2xl bg-slate-950">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-white">{title}</p>
          <p className="text-xs text-slate-400">{participantName}</p>
        </div>
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
      <LiveKitRoom
        video
        audio
        token={token}
        serverUrl={wsUrl}
        connectOptions={{ autoSubscribe: true }}
        onError={(err) => setError(err.message)}
        className="flex min-h-0 flex-1 overflow-hidden"
      >
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden md:flex-row">
          <aside className="max-h-[42%] shrink-0 overflow-y-auto border-b border-white/10 bg-slate-900/80 md:max-h-none md:w-80 md:border-b-0 md:border-r">
            <CallTools />
          </aside>
          <div className="relative min-h-0 min-w-0 flex-1">
            <VideoConference />
            <RoomAudioRenderer />
          </div>
        </div>
      </LiveKitRoom>
    </div>
  );
}
