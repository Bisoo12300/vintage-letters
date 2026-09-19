'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useIdentity } from '@/components/IdentityGate';
import { authorEmoji, authorLabel } from '@/lib/identity';
import { apiFetch } from '@/lib/api';
import { syncAppBadge } from '@/lib/push';

const NAV = [
  { href: '/', label: 'Letterbook', icon: IconBook },
  { href: '/admin', label: 'My letters', icon: IconFeather },
  { href: '/inbox', label: 'Inbox', icon: IconTray },
  { href: '/plans', label: 'Plans', icon: IconCalendar },
];

export function SiteShell({
  children,
  hideNav,
}: {
  children: React.ReactNode;
  hideNav?: boolean;
}) {
  const { identity, switchIdentity } = useIdentity();
  const pathname = usePathname();
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
        <header
          className="sticky top-0 z-50 border-b border-mora-beige-200/80 bg-mora-cream/80 backdrop-blur-xl backdrop-saturate-150"
          style={{ paddingTop: 'env(safe-area-inset-top)' }}
        >
          <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-3.5 sm:px-8 sm:py-4">
            <Link href="/" className="group flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-mora-brown-600 text-base text-white shadow-soft sm:h-10 sm:w-10 sm:text-lg">
                ✉
              </span>
              <span className="font-display text-base font-semibold tracking-wide text-mora-brown-800 sm:text-lg">
                Clair de Lune
              </span>
            </Link>

            {/* Desktop nav — mobile uses the bottom tab bar instead */}
            <nav className="hidden items-center gap-1 sm:flex sm:gap-2">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`relative rounded-full px-4 py-2 font-body text-sm transition ${
                    pathname === item.href
                      ? 'bg-mora-beige-100 text-mora-brown-800'
                      : 'text-mora-brown-600 hover:bg-mora-beige-100 hover:text-mora-brown-800'
                  }`}
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
                  className="rounded-full px-4 py-2 font-body text-sm text-mora-brown-700 transition hover:bg-mora-beige-100 active:scale-95"
                  title="Switch identity"
                >
                  {authorEmoji(identity)} {authorLabel(identity)}
                </button>
              )}
            </nav>

            {/* Mobile — identity switcher only; tabs live in the bottom bar */}
            {identity && (
              <button
                type="button"
                onClick={switchIdentity}
                className="flex h-9 min-w-9 items-center justify-center gap-1 rounded-full bg-mora-beige-100 px-3 font-body text-sm text-mora-brown-700 transition active:scale-90 sm:hidden"
                title="Switch identity"
              >
                {authorEmoji(identity)}
              </button>
            )}
          </div>
        </header>
      )}

      <main
        className={hideNav ? 'flex-1' : 'flex-1 pb-[calc(4.75rem+env(safe-area-inset-bottom))] sm:pb-0'}
      >
        {children}
      </main>

      {!hideNav && (
        <nav
          className="fixed inset-x-0 bottom-0 z-50 border-t border-mora-beige-200/80 bg-mora-cream/80 backdrop-blur-xl backdrop-saturate-150 sm:hidden"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          <div className="mx-auto flex max-w-5xl items-stretch justify-around px-1">
            {NAV.map((item) => {
              const active = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="relative flex min-w-[4.25rem] flex-1 flex-col items-center justify-center gap-0.5 py-2 transition active:scale-90"
                >
                  <span className="relative">
                    <Icon
                      active={active}
                      className={`h-6 w-6 transition ${active ? 'text-mora-brown-800' : 'text-mora-brown-400'}`}
                    />
                    {item.href === '/inbox' && unread > 0 && (
                      <span className="absolute -right-1.5 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 font-body text-[9px] font-bold text-white ring-2 ring-mora-cream">
                        {unread > 9 ? '9+' : unread}
                      </span>
                    )}
                  </span>
                  <span
                    className={`font-body text-[10px] leading-none transition ${
                      active ? 'font-semibold text-mora-brown-800' : 'text-mora-brown-400'
                    }`}
                  >
                    {item.label === 'My letters' ? 'Mine' : item.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}

type IconProps = { active?: boolean; className?: string };

function IconBook({ active, className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M4 5.5c0-.83.67-1.5 1.5-1.5H11a1 1 0 0 1 1 1v14.5a.5.5 0 0 1-.77.42C9.98 19.06 8.2 18.5 5.8 18.5H5a1 1 0 0 1-1-1V5.5Z"
        fill={active ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path
        d="M20 5.5c0-.83-.67-1.5-1.5-1.5H13a1 1 0 0 0-1 1v14.5a.5.5 0 0 0 .77.42c2.25-1.86 4.03-2.42 6.43-2.42h.3a1 1 0 0 0 1-1V5.5Z"
        fill={active ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconFeather({ active, className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M20 4c-6 0-13 3-13 11 0 2 .5 3.5 1 4.5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <path
        d="M20 4c0 7-3.5 12.5-9 15-1.5.7-3 1-5 1"
        fill={active ? 'currentColor' : 'none'}
        fillOpacity={active ? 0.18 : 0}
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M4 20 12 12" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

function IconTray({ active, className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M4 13.5 6.3 5.9A1 1 0 0 1 7.26 5.2h9.48a1 1 0 0 1 .96.72L20 13.5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path
        d="M4 13.5h4.4a1 1 0 0 1 .9.55l.6 1.2a1 1 0 0 0 .9.55h2.4a1 1 0 0 0 .9-.55l.6-1.2a1 1 0 0 1 .9-.55H20V18a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-4.5Z"
        fill={active ? 'currentColor' : 'none'}
        fillOpacity={active ? 0.18 : 0}
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconCalendar({ active, className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <rect
        x="4"
        y="5.5"
        width="16"
        height="14"
        rx="2.5"
        fill={active ? 'currentColor' : 'none'}
        fillOpacity={active ? 0.18 : 0}
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <path d="M4 9.5h16" stroke="currentColor" strokeWidth="1.75" />
      <path d="M8 3.5v3M16 3.5v3" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      {active && <circle cx="12" cy="14.5" r="1.6" fill="currentColor" />}
    </svg>
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
