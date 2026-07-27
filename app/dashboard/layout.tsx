'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ReactNode, useEffect } from 'react';
import { useAuth } from '@/lib/firebase/auth-context';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { user, profile, company, loading, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && (!user || user.isAnonymous || !profile)) {
      router.replace('/login');
    }
  }, [loading, user, profile, router]);

  if (loading || !user || !profile || !company) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-teal-700" />
      </div>
    );
  }

  const links = [
    { href: '/dashboard', label: 'Settings' },
    { href: '/dashboard/console', label: 'Console' },
  ];

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f0fdfa_0%,#f8fafc_28%,#f1f5f9_100%)]">
      <header className="border-b border-slate-200/80 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="font-[family-name:var(--font-display)] text-xl font-semibold text-teal-800">
              LiveDesk
            </Link>
            <nav className="flex gap-1">
              {links.map((link) => {
                const active = pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                      active
                        ? 'bg-teal-700 text-white'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden text-slate-600 sm:inline">
              {company.name}
            </span>
            <button
              type="button"
              onClick={() => void signOut().then(() => router.push('/login'))}
              className="rounded-lg border border-slate-200 px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-50"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
