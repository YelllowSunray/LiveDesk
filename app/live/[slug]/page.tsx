'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { LiveFeedViewer } from '@/components/LiveFeedViewer';

/**
 * Embeddable lobby live feed — same camera shown in the widget before "Start call".
 * Agency sites can iframe: <iframe src="https://…/live/{slug}" …>
 */
export default function LiveWatchPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const [streaming, setStreaming] = useState<boolean | null>(null);
  const [brandColor, setBrandColor] = useState('#0f766e');
  const [name, setName] = useState('');

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch(`/api/live/${encodeURIComponent(slug)}`, {
          cache: 'no-store',
        });
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setStreaming(false);
          return;
        }
        setStreaming(Boolean(data.streaming));
        if (data.brandColor) setBrandColor(data.brandColor);
        if (data.name) setName(data.name);
      } catch {
        if (!cancelled) setStreaming(false);
      }
    }

    void load();
    const id = window.setInterval(() => void load(), 10000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [slug]);

  return (
    <div className="flex h-[100dvh] w-full items-center justify-center bg-slate-950">
      {streaming === null ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : streaming ? (
        <div className="h-full w-full">
          <LiveFeedViewer
            slug={slug}
            brandColor={brandColor}
            fill
            rounded={false}
          />
        </div>
      ) : (
        <div className="px-6 text-center">
          <p className="text-sm font-medium text-slate-200">
            {name || 'Live feed'} is offline
          </p>
          <p className="mt-1 text-xs text-slate-500">
            The camera will appear here when the live feed is turned on.
          </p>
        </div>
      )}
    </div>
  );
}
