'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useIdentity } from '@/components/IdentityGate';
import { authorEmoji, authorLabel } from '@/lib/identity';
import { apiFetch } from '@/lib/api';

export function SiteShell({
  children,
  hideNav,
}: {
  children: React.ReactNode;
  hideNav?: boolean;
}) {
  const { identity, switchIdentity } = useIdentity();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!identity) {
      setUnread(0);
      return;
    }
    let active = true;
    const load = () => {
      apiFetch<{ count: number }>('/inbox/unread-count', { author: identity })
        .then((data) => {
          if (active) setUnread(data.count);
        })
        .catch(() => {});
    };
    load();
    window.addEventListener('focus', load);
    return () => {
      active = false;
      window.removeEventListener('focus', load);
    };
  }, [identity]);

  return (
    <div className="flex min-h-screen flex-col bg-mora-cream">
      {!hideNav && (
        <header className="sticky top-0 z-50 border-b border-mora-beige-200/80 bg-white/90 backdrop-blur-md">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
            <Link href="/" className="group flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-mora-brown-600 text-sm text-white shadow-soft">
                ✉
              </span>
              <div className="leading-tight">
                <span className="font-display block text-base font-semibold text-mora-brown-800">
                  Clair de Lune
                </span>
                <span className="font-body text-[11px] text-mora-brown-500">CRM</span>
              </div>
            </Link>
            <div className="flex items-center gap-2">
              {unread > 0 && (
                <span className="rounded-full bg-red-600 px-2 py-0.5 font-body text-[10px] font-bold text-white">
                  {unread > 9 ? '9+' : unread} unread
                </span>
              )}
              {identity && (
                <button
                  type="button"
                  onClick={switchIdentity}
                  className="rounded-lg px-3 py-2 font-body text-sm text-mora-brown-700 transition hover:bg-mora-beige-100"
                  title="Switch identity"
                >
                  {authorEmoji(identity)} {authorLabel(identity)}
                </button>
              )}
            </div>
          </div>
        </header>
      )}

      <main className="flex-1">{children}</main>
    </div>
  );
}

export function MoraHero({
  title,
  subtitle,
  image,
}: {
  title: string;
  subtitle: string;
  image?: string;
}) {
  return (
    <section className="relative overflow-hidden px-5 pb-12 pt-10 sm:px-8 sm:pb-16 sm:pt-14">
      <div className="relative mx-auto max-w-5xl">
        <h1 className="font-display text-3xl font-semibold text-mora-brown-800">{title}</h1>
        <p className="mt-3 max-w-md font-body text-mora-brown-600">{subtitle}</p>
        {image && (
          <div
            className="mt-8 aspect-[4/3] max-w-md rounded-2xl bg-cover bg-center shadow-soft"
            style={{ backgroundImage: `url(${image})` }}
          />
        )}
      </div>
    </section>
  );
}
