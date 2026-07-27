'use client';

import Link from 'next/link';
import { Video, Users, Puzzle } from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top_left,_#99f6e4_0%,_transparent_40%),radial-gradient(ellipse_at_bottom_right,_#cbd5e1_0%,_transparent_45%),linear-gradient(180deg,#f8fafc_0%,#ecfeff_100%)]">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-6">
        <p className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight text-teal-900">
          LiveDesk
        </p>
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-white/60"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="rounded-xl bg-teal-800 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-900"
          >
            Start free
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-24 pt-10 md:pt-16">
        <section className="relative overflow-hidden rounded-[2rem] border border-teal-900/10 bg-teal-950 text-teal-50 shadow-2xl">
          <div
            className="absolute inset-0 opacity-40"
            style={{
              backgroundImage:
                'linear-gradient(120deg, transparent 20%, rgba(45,212,191,.35) 45%, transparent 70%), radial-gradient(circle at 80% 20%, rgba(94,234,212,.5), transparent 35%)',
            }}
          />
          <div className="relative grid gap-10 px-8 py-14 md:grid-cols-[1.1fr_0.9fr] md:px-14 md:py-20">
            <div>
              <h1 className="font-[family-name:var(--font-display)] text-4xl font-semibold leading-[1.05] tracking-tight md:text-6xl">
                LiveDesk
              </h1>
              <p className="mt-5 max-w-lg text-lg text-teal-100/90 md:text-xl">
                Put a real video representative on your website. Visitors tap
                once, join a queue if you are busy, and meet your team face to
                face.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/signup"
                  className="rounded-xl bg-teal-300 px-5 py-3 text-sm font-bold text-teal-950 hover:bg-teal-200"
                >
                  Create your company
                </Link>
                <Link
                  href="/login"
                  className="rounded-xl border border-teal-100/30 px-5 py-3 text-sm font-semibold text-teal-50 hover:bg-white/10"
                >
                  Open console
                </Link>
              </div>
            </div>
            <div className="relative min-h-[240px] rounded-3xl border border-white/10 bg-black/20 p-4 backdrop-blur">
              <div className="mb-3 flex items-center gap-2 text-xs text-teal-100/70">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                Agent online · 1 waiting
              </div>
              <div className="grid h-[200px] grid-cols-2 gap-3">
                <div className="rounded-2xl bg-gradient-to-br from-teal-700 to-slate-900 p-4">
                  <p className="text-xs text-teal-100/70">Visitor</p>
                  <p className="mt-auto pt-16 text-sm font-semibold">Alex</p>
                </div>
                <div className="rounded-2xl bg-gradient-to-br from-slate-700 to-teal-900 p-4">
                  <p className="text-xs text-teal-100/70">You</p>
                  <p className="mt-auto pt-16 text-sm font-semibold">Rep</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-20 grid gap-10 md:grid-cols-3">
          <Feature
            icon={<Puzzle className="text-teal-700" size={22} />}
            title="Embeddable widget"
            body="One script tag. A floating Talk to us button opens a branded video panel on any site."
          />
          <Feature
            icon={<Users className="text-teal-700" size={22} />}
            title="Smart queue"
            body="When two visitors show up, the second waits in line until your agent is free to accept."
          />
          <Feature
            icon={<Video className="text-teal-700" size={22} />}
            title="LiveKit video"
            body="Crystal-clear 1:1 calls powered by LiveKit — not another chat inbox."
          />
        </section>
      </main>
    </div>
  );
}

function Feature({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div>
      <div className="mb-4 inline-flex rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
        {icon}
      </div>
      <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-slate-900">
        {title}
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">{body}</p>
    </div>
  );
}
