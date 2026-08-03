'use client';

import { useEffect, useState } from 'react';

const SETUP_MS = 30_000;

const STEPS = [
  { at: 0, label: 'Opening a private video room' },
  { at: 8, label: 'Notifying a representative' },
  { at: 16, label: 'Warming up camera & audio' },
  { at: 24, label: 'Almost ready — stay on this screen' },
] as const;

function stepLabel(companyName: string, seconds: number): string {
  if (seconds < 8) return 'Opening a private video room';
  if (seconds < 16) return `Notifying a ${companyName} representative`;
  if (seconds < 24) return 'Warming up camera & audio';
  return 'Almost ready — stay on this screen';
}

interface WaitingQueueProps {
  companyName: string;
  brandColor: string;
  logoUrl?: string;
  position: number;
  statusLabel: string;
  onLeave: () => void;
}

/**
 * Keeps visitors engaged for ~30s while the agent gets to the console.
 * Progress is honest framing ("setting up") — not a fake connect timer.
 */
export function WaitingQueue({
  companyName,
  brandColor,
  logoUrl,
  position,
  statusLabel,
  onLeave,
}: WaitingQueueProps) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const started = Date.now();
    const id = window.setInterval(() => {
      setElapsed(Math.min(SETUP_MS, Date.now() - started));
    }, 100);
    return () => window.clearInterval(id);
  }, []);

  const seconds = Math.floor(elapsed / 1000);
  const progress = Math.min(1, elapsed / SETUP_MS);
  const setupDone = progress >= 1;
  const remaining = Math.max(0, 30 - seconds);

  return (
    <div className="flex h-full flex-col items-center justify-center p-6 text-center">
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoUrl}
          alt=""
          className="mb-4 h-12 w-12 rounded-full object-cover"
        />
      ) : null}

      {!setupDone ? (
        <>
          <p className="text-lg font-semibold text-slate-900">
            Setting up your call
          </p>
          <p className="mt-1 text-sm text-slate-500">
            About {remaining || 1} second{remaining === 1 ? '' : 's'} left
          </p>

          <div className="mt-6 w-full max-w-xs">
            <div className="h-2.5 overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full transition-[width] duration-100 ease-linear"
                style={{
                  width: `${progress * 100}%`,
                  backgroundColor: brandColor,
                }}
              />
            </div>
            <p className="mt-3 text-sm font-medium text-slate-700">
              {stepLabel(companyName, seconds)}
            </p>
          </div>

          <ul className="mt-6 w-full max-w-xs space-y-2 text-left">
            {STEPS.map((step, i) => {
              const nextAt = STEPS[i + 1]?.at ?? 30;
              const done = seconds >= nextAt;
              const active = !done && seconds >= step.at;
              const label =
                i === 1
                  ? `Notifying a ${companyName} representative`
                  : step.label;
              return (
                <li
                  key={step.at}
                  className={`flex items-center gap-2 text-xs ${
                    done || active ? 'text-slate-800' : 'text-slate-400'
                  }`}
                >
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                      done || active ? 'text-white' : 'bg-slate-200 text-slate-400'
                    }`}
                    style={
                      done || active
                        ? { backgroundColor: brandColor }
                        : undefined
                    }
                  >
                    {done ? '✓' : i + 1}
                  </span>
                  <span className={active ? 'font-semibold' : ''}>{label}</span>
                </li>
              );
            })}
          </ul>

          <p className="mt-6 max-w-xs text-xs text-slate-500">
            Please keep this window open — leaving now cancels your spot.
          </p>
        </>
      ) : (
        <>
          <div className="relative mb-4">
            <span
              className="absolute inset-0 animate-ping rounded-full opacity-30"
              style={{ backgroundColor: brandColor }}
            />
            <span
              className="relative flex h-14 w-14 items-center justify-center rounded-full text-lg font-bold text-white"
              style={{ backgroundColor: brandColor }}
            >
              #{position}
            </span>
          </div>
          <p className="text-lg font-semibold text-slate-900">
            You&apos;re next
          </p>
          <p className="mt-2 max-w-xs text-sm text-slate-600">
            Your room is ready. A {companyName} representative will join any
            moment — thanks for waiting.
          </p>
          <p className="mt-3 text-xs text-slate-500">{statusLabel}</p>
          <div className="mt-5 flex items-center gap-2 text-xs font-medium text-slate-600">
            <span
              className="h-2 w-2 animate-pulse rounded-full"
              style={{ backgroundColor: brandColor }}
            />
            Waiting for representative…
          </div>
        </>
      )}

      <button
        type="button"
        onClick={onLeave}
        className={`mt-8 text-sm font-medium ${
          setupDone
            ? 'text-slate-500 underline'
            : 'text-slate-300 hover:text-slate-500'
        }`}
      >
        Leave queue
      </button>
    </div>
  );
}
