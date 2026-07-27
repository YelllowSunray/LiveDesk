'use client';

import { useEffect, useState } from 'react';
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useTracks,
  VideoTrack,
} from '@livekit/components-react';
import { Track } from 'livekit-client';
import { getClientAuth } from '@/lib/firebase/client';

function PublisherStage() {
  const tracks = useTracks(
    [{ source: Track.Source.Camera, withPlaceholder: true }],
    { onlySubscribed: false }
  );
  const localCam = tracks.find((t) => t.participant.isLocal && t.publication);

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-slate-950">
      {localCam?.publication ? (
        <VideoTrack
          trackRef={localCam}
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full items-center justify-center text-sm text-slate-400">
          Starting camera…
        </div>
      )}
      <div className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-md bg-red-600 px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-white">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
        Live
      </div>
      <RoomAudioRenderer />
    </div>
  );
}

interface LiveFeedPublisherProps {
  companyId: string;
  participantName: string;
  onError?: (message: string) => void;
}

export function LiveFeedPublisher({
  companyId,
  participantName,
  onError,
}: LiveFeedPublisherProps) {
  const [token, setToken] = useState('');
  const [wsUrl, setWsUrl] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function connect() {
      try {
        const user = getClientAuth().currentUser;
        if (!user) throw new Error('Not authenticated');
        const idToken = await user.getIdToken();
        const res = await fetch('/api/livekit-preview-token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            role: 'publisher',
            companyId,
            participantName,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to start live feed');
        if (!cancelled) {
          setToken(data.token);
          setWsUrl(data.wsUrl);
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to start live feed';
        if (!cancelled) {
          setError(message);
          onError?.(message);
        }
      }
    }
    void connect();
    return () => {
      cancelled = true;
    };
  }, [companyId, participantName, onError]);

  if (error) {
    return (
      <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
        {error}
      </p>
    );
  }

  if (!token || !wsUrl) {
    return (
      <div className="flex aspect-video items-center justify-center rounded-2xl bg-slate-100 text-sm text-slate-500">
        Connecting camera…
      </div>
    );
  }

  return (
    <LiveKitRoom
      token={token}
      serverUrl={wsUrl}
      video
      audio={false}
      connectOptions={{ autoSubscribe: true }}
      onError={(err) => {
        setError(err.message);
        onError?.(err.message);
      }}
      className="w-full"
    >
      <PublisherStage />
    </LiveKitRoom>
  );
}
