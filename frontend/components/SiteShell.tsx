'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useIdentity } from '@/components/IdentityGate';
import { authorEmoji, authorLabel } from '@/lib/identity';
import { apiFetch } from '@/lib/api';
import { syncAppBadge } from '@/lib/push';

const NAV = [
  { href: '/', label: 'Letterbook' },
  { href: '/admin', label: 'My letters' },
  { href: '/inbox', label: 'Inbox' },
  { href: '/plans', label: 'Plans' },
];

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
          syncAppBadge(data.count);
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
    <div className="flex min-h-screen flex-col">
      {!hideNav && (
        <header className="sticky top-0 z-50 border-b border-mora-beige-200/80 bg-mora-cream/90 backdrop-blur-md">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4 sm:px-8">
            <Link href="/" className="group flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-mora-brown-600 text-lg text-white shadow-soft">
                ✉
              </span>
              <span className="font-display text-base font-semibold tracking-wide text-mora-brown-800 sm:text-lg">
                Clair de Lune
              </span>
            </Link>
            <nav className="flex items-center gap-1 sm:gap-2">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="relative rounded-full px-3 py-2 font-body text-sm text-mora-brown-600 transition hover:bg-mora-beige-100 hover:text-mora-brown-800 sm:px-4"
                >
                  {item.label}
                  {item.href === '/inbox' && unread > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 font-body text-[10px] font-bold text-white">
                      {unread > 9 ? '9+' : unread}
                    </span>
                  )}
                </Link>
              ))}
              {identity && (
                <button
                  type="button"
                  onClick={switchIdentity}
                  className="rounded-full px-3 py-2 font-body text-sm text-mora-brown-700 transition hover:bg-mora-beige-100 sm:px-4"
                  title="Switch identity"
                >
                  {authorEmoji(identity)} {authorLabel(identity)}
                </button>
              )}
            </nav>
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
      <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-mora-beige-200/60 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-10 -left-16 h-48 w-48 rounded-full bg-mora-brown-200/30 blur-2xl" />

      <div className="relative mx-auto grid max-w-5xl items-center gap-10 lg:grid-cols-2">
        <div className="animate-fade-in-up">
          <p className="mb-3 font-body text-sm tracking-widest text-mora-brown-500 uppercase">
            Words from the heart
          </p>
          <h1 className="font-display text-3xl font-semibold leading-snug text-mora-brown-800 sm:text-4xl lg:text-[2.75rem]">
            {title}
          </h1>
          <p className="mt-5 max-w-md font-body text-base leading-relaxed text-mora-brown-600 sm:text-lg">
            {subtitle}
          </p>
        </div>

        {image && (
          <div className="animate-fade-in-up relative overflow-hidden rounded-[2rem] shadow-soft-lg" style={{ animationDelay: '0.15s' }}>
            <div
              className="aspect-[4/3] bg-cover bg-center"
              style={{ backgroundImage: `url(${image})` }}
            />
            <div className="absolute inset-0 rounded-[2rem] ring-1 ring-mora-brown-800/5 ring-inset" />
          </div>
        )}
      </div>
    </section>
  );
}
