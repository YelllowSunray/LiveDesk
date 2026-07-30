'use client';

import { useEffect, useState } from 'react';
import {
  LiveKitRoom,
  useConnectionState,
  useRoomContext,
  VideoTrack,
  useTracks,
} from '@livekit/components-react';
import {
  ConnectionState,
  LocalVideoTrack,
  RoomEvent,
  Track,
  createLocalVideoTrack,
} from 'livekit-client';
import { getClientAuth } from '@/lib/firebase/client';

/**
 * Publish a *clone* of the shared camera into the preview room.
 * Never publish the shared LocalVideoTrack itself — LiveKit unpublish/cleanup
 * was leaving the agent joined with 0 tracks (viewers see black).
 */
function PublishSharedCamera({ track }: { track: LocalVideoTrack }) {
  const room = useRoomContext();
  const connectionState = useConnectionState();

  useEffect(() => {
    if (connectionState !== ConnectionState.Connected) return;

    let cancelled = false;
    let published: LocalVideoTrack | null = null;

    async function ensurePublished() {
      if (cancelled) return;
      try {
        if (track.mediaStreamTrack.readyState === 'ended') {
          console.error('preview camera track ended');
          return;
        }

        const existing = room.localParticipant
          .getTrackPublications()
          .find((p) => p.source === Track.Source.Camera);
        if (existing?.track && existing.track.mediaStreamTrack.readyState === 'live') {
          return;
        }

        // Drop a stale empty camera publication if present.
        if (existing?.track && existing.track instanceof LocalVideoTrack) {
          try {
            await room.localParticipant.unpublishTrack(existing.track, true);
          } catch {
            // ignore
          }
        }

        if (published) {
          try {
            published.stop();
          } catch {
            // ignore
          }
          published = null;
        }

        const clone = new LocalVideoTrack(track.mediaStreamTrack.clone());
        published = clone;
        await room.localParticipant.publishTrack(clone, {
          source: Track.Source.Camera,
        });
      } catch (err) {
        if (!cancelled) console.error('preview publish failed', err);
      }
    }

    void ensurePublished();

    const onReconnected = () => {
      void ensurePublished();
    };
    const onLocalUnpublished = () => {
      // Unexpected unpublish (network blip) — try again shortly.
      window.setTimeout(() => {
        void ensurePublished();
      }, 500);
    };

    room.on(RoomEvent.Reconnected, onReconnected);
    room.on(RoomEvent.LocalTrackUnpublished, onLocalUnpublished);

    const watchdog = window.setInterval(() => {
      const cam = room.localParticipant
        .getTrackPublications()
        .find((p) => p.source === Track.Source.Camera);
      if (!cam?.track || cam.track.mediaStreamTrack.readyState !== 'live') {
        void ensurePublished();
      }
    }, 5000);

    return () => {
      cancelled = true;
      window.clearInterval(watchdog);
      room.off(RoomEvent.Reconnected, onReconnected);
      room.off(RoomEvent.LocalTrackUnpublished, onLocalUnpublished);
      if (published) {
        try {
          room.localParticipant.unpublishTrack(published, true);
        } catch {
          published.stop();
        }
        published = null;
      }
    };
  }, [room, track, connectionState]);

  return null;
}

function PublisherStage({ track }: { track: LocalVideoTrack }) {
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
        <video
          ref={(el) => {
            if (el) track.attach(el);
          }}
          muted
          playsInline
          autoPlay
          className="h-full w-full object-cover"
        />
      )}
      <div className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-md bg-red-600 px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-white">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
        Live
      </div>
    </div>
  );
}

interface LiveFeedPublisherProps {
  companyId: string;
  participantName: string;
  cameraTrack: LocalVideoTrack;
  compact?: boolean;
  onError?: (message: string) => void;
}

export function LiveFeedPublisher({
  companyId,
  participantName,
  cameraTrack,
  compact = false,
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
      video={false}
      audio={false}
      connectOptions={{ autoSubscribe: false }}
      onError={(err) => {
        setError(err.message);
        onError?.(err.message);
      }}
      className={compact ? 'w-40' : 'w-full'}
    >
      <PublishSharedCamera track={cameraTrack} />
      {!compact && <PublisherStage track={cameraTrack} />}
      {compact && (
        <div className="relative overflow-hidden rounded-xl bg-slate-950">
          <video
            ref={(el) => {
              if (el) cameraTrack.attach(el);
            }}
            muted
            playsInline
            autoPlay
            className="aspect-video w-full object-cover"
          />
          <div className="absolute left-2 top-2 inline-flex items-center gap-1 rounded bg-red-600 px-1.5 py-0.5 text-[9px] font-bold uppercase text-white">
            Live
          </div>
        </div>
      )}
    </LiveKitRoom>
  );
}

/** Create/stop the shared agent camera used by lobby feed + 1:1 calls. */
export function useSharedAgentCamera(enabled: boolean) {
  const [track, setTrack] = useState<LocalVideoTrack | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    let created: LocalVideoTrack | null = null;

    async function start() {
      if (!enabled) return;
      try {
        created = await createLocalVideoTrack({
          facingMode: 'user',
        });
        if (cancelled) {
          created.stop();
          return;
        }
        setTrack(created);
        setError('');
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : 'Could not access camera'
          );
        }
      }
    }

    void start();

    return () => {
      cancelled = true;
      created?.stop();
      setTrack(null);
    };
  }, [enabled]);

  return { track, error };
}
