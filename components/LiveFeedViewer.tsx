'use client';

import { useEffect, useState } from 'react';
import {
  LiveKitRoom,
  useTracks,
  VideoTrack,
} from '@livekit/components-react';
import { Track } from 'livekit-client';

function ViewerStage({
  brandColor,
  fill,
}: {
  brandColor: string;
  fill: boolean;
}) {
  const tracks = useTracks(
    [{ source: Track.Source.Camera, withPlaceholder: false }],
    { onlySubscribed: true }
  );
  const remoteCam = tracks.find((t) => !t.participant.isLocal && t.publication);

  const frameClass = fill
    ? 'relative h-full w-full overflow-hidden bg-slate-950'
    : 'relative aspect-[4/3] w-full overflow-hidden bg-slate-950';

  if (!remoteCam?.publication) {
    return (
      <div
        className={`${
          fill ? 'flex h-full w-full' : 'flex aspect-[4/3]'
        } items-center justify-center bg-slate-900 text-sm text-slate-400`}
      >
        Waiting for live camera…
      </div>
    );
  }

  return (
    <div className={frameClass}>
      <VideoTrack
        trackRef={remoteCam}
        className="h-full w-full object-cover"
      />
      <div className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-md bg-red-600 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white shadow">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
        Live
      </div>
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/50 to-transparent"
        style={{ boxShadow: `inset 0 -2px 0 ${brandColor}33` }}
      />
    </div>
  );
}

interface LiveFeedViewerProps {
  slug: string;
  brandColor?: string;
  /** Fill parent height (for /live/[slug] embeds). */
  fill?: boolean;
  rounded?: boolean;
}

export function LiveFeedViewer({
  slug,
  brandColor = '#0f766e',
  fill = false,
  rounded = true,
}: LiveFeedViewerProps) {
  const [token, setToken] = useState('');
  const [wsUrl, setWsUrl] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function connect() {
      try {
        const res = await fetch(`/api/live/${encodeURIComponent(slug)}/stream`, {
          method: 'GET',
          cache: 'no-store',
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Live feed unavailable');
        if (!cancelled) {
          setToken(data.token);
          setWsUrl(data.wsUrl);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Live feed unavailable');
        }
      }
    }
    void connect();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (error) {
    if (fill) {
      return (
        <div className="flex h-full w-full items-center justify-center bg-slate-950 text-sm text-slate-400">
          Live feed unavailable
        </div>
      );
    }
    return null;
  }

  if (!token || !wsUrl) {
    return (
      <div
        className={`${
          fill ? 'flex h-full w-full' : 'flex aspect-[4/3]'
        } items-center justify-center ${
          rounded ? 'rounded-2xl' : ''
        } bg-slate-100 text-sm text-slate-500`}
      >
        Loading live feed…
      </div>
    );
  }

  return (
    <div
      className={`h-full w-full overflow-hidden ${
        rounded ? 'rounded-2xl border border-slate-200 shadow-sm' : ''
      }`}
    >
      <LiveKitRoom
        token={token}
        serverUrl={wsUrl}
        video={false}
        audio={false}
        connectOptions={{ autoSubscribe: true }}
        onError={(err) => setError(err.message)}
        className="h-full w-full"
      >
        <ViewerStage brandColor={brandColor} fill={fill} />
      </LiveKitRoom>
    </div>
  );
}
