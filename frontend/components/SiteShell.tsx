'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useIdentity } from '@/components/IdentityGate';
import { AuthorGlyph, LogoMark, Wordmark } from '@/components/brand';
import { authorLabel } from '@/lib/identity';
import { apiFetch } from '@/lib/api';
import { syncAppBadge } from '@/lib/push';

const NAV = [
  { href: '/', label: 'Write', icon: IconEnvelope },
  { href: '/admin', label: 'Mine', icon: IconQuill },
  { href: '/inbox', label: 'Inbox', icon: IconTray },
  { href: '/plans', label: 'Plans', icon: IconCalendar },
  { href: '/milestones', label: 'Moments', icon: IconSunrise },
];

function UnreadDot({ count, className }: { count: number; className: string }) {
  if (count <= 0) return null;
  return (
    <span
      className={`absolute flex items-center justify-center rounded-full bg-rose px-1 font-body font-bold text-white shadow-[0_2px_6px_rgba(224,102,138,0.5)] ${className}`}
    >
      {count > 9 ? '9+' : count}
    </span>
  );
}

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
  const activeIndex = NAV.findIndex((item) => item.href === pathname);

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
          className="sticky top-0 z-50 px-3 sm:px-6"
          style={{ paddingTop: 'calc(env(safe-area-inset-top) + 0.625rem)' }}
        >
          <div className="glass mx-auto flex max-w-5xl items-center justify-between gap-3 rounded-full py-1.5 pl-3 pr-1.5">
            <Link href="/" className="flex items-center gap-2.5 rounded-full pr-2" aria-label="Clair de Lune home">
              <LogoMark className="h-8 w-8" />
              <Wordmark />
            </Link>

            {/* Desktop — segmented capsule with a sliding lens; mobile uses the bottom tab bar */}
            <nav className="relative hidden grid-cols-5 rounded-full bg-ink-800/[0.06] p-1 md:grid">
              {activeIndex >= 0 && (
                <span
                  aria-hidden
                  className="absolute bottom-1 left-1 top-1 rounded-full bg-white/90 shadow-[0_2px_8px_rgba(35,40,88,0.14),inset_0_1px_0_#fff] transition-transform duration-500 ease-spring"
                  style={{
                    width: 'calc((100% - 0.5rem) / 5)',
                    transform: `translateX(${activeIndex * 100}%)`,
                  }}
                />
              )}
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={pathname === item.href ? 'page' : undefined}
                  className={`relative z-10 rounded-full px-4 py-1.5 text-center font-body text-[14px] font-medium transition-colors ${
                    pathname === item.href ? 'text-ink-800' : 'text-ink-500 hover:text-ink-800'
                  }`}
                >
                  {item.label}
                  {item.href === '/inbox' && <UnreadDot count={unread} className="-right-0.5 -top-1 h-[18px] min-w-[18px] text-[10px]" />}
                </Link>
              ))}
            </nav>

            {identity && (
              <button
                type="button"
                onClick={switchIdentity}
                className="flex h-10 items-center gap-2 rounded-full bg-white/50 pl-1.5 pr-3 font-body text-[14px] font-medium text-ink-700 transition-transform duration-300 ease-spring hover:bg-white/80 active:scale-95"
                title="Switch between Moon and Sun"
              >
                <AuthorGlyph author={identity} className="h-7 w-7" />
                <span className="hidden sm:inline">{authorLabel(identity)}</span>
              </button>
            )}
          </div>
        </header>
      )}

      <main
        className={hideNav ? 'flex-1' : 'flex-1 pb-[calc(6.5rem+env(safe-area-inset-bottom))] md:pb-10'}
      >
        {children}
      </main>

      {!hideNav && (
        <nav
          className="fixed inset-x-0 bottom-0 z-50 px-4 md:hidden"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 0.75rem)' }}
        >
          <div className="glass-thick relative mx-auto grid max-w-md grid-cols-5 rounded-full p-1.5">
            {activeIndex >= 0 && (
              <span
                aria-hidden
                className="absolute bottom-1.5 left-1.5 top-1.5 rounded-full bg-white/80 shadow-[0_2px_10px_rgba(35,40,88,0.14),inset_0_1px_0_#fff] transition-transform duration-500 ease-spring"
                style={{
                  width: 'calc((100% - 0.75rem) / 5)',
                  transform: `translateX(${activeIndex * 100}%)`,
                }}
              />
            )}
            {NAV.map((item) => {
              const active = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className="relative z-10 flex flex-col items-center justify-center gap-0.5 rounded-full py-1.5 transition-transform duration-300 ease-spring active:scale-90"
                >
                  <span className="relative">
                    <Icon active={active} className={`h-6 w-6 transition-colors ${active ? 'text-ink-800' : 'text-ink-400'}`} />
                    {item.href === '/inbox' && (
                      <UnreadDot count={unread} className="-right-2 -top-1 h-4 min-w-4 text-[9px] ring-2 ring-white/80" />
                    )}
                  </span>
                  <span
                    className={`font-body text-[10px] leading-none transition-colors ${
                      active ? 'font-semibold text-ink-800' : 'font-medium text-ink-400'
                    }`}
                  >
                    {item.label}
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

/* ─── Tab icons — 24px grid, 1.8 stroke, filled tint when active ─────────── */
type IconProps = { active?: boolean; className?: string };
const stroke = { stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

function IconEnvelope({ active, className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <rect x="3" y="5.5" width="18" height="13" rx="3" fill="currentColor" fillOpacity={active ? 0.16 : 0} {...stroke} />
      <path d="m3.8 7.2 7 5.2a2 2 0 0 0 2.4 0l7-5.2" {...stroke} />
    </svg>
  );
}

function IconQuill({ active, className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M19.5 3.5c-6.5.5-11 4.6-12 11.3l-.6 3.9 3.8-.9c6.3-1.6 9-6.6 8.8-14.3Z"
        fill="currentColor"
        fillOpacity={active ? 0.16 : 0}
        {...stroke}
      />
      <path d="M4.5 20.5 13 11" {...stroke} />
    </svg>
  );
}

function IconTray({ active, className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path d="M3.5 13.5 6 6.4A1.5 1.5 0 0 1 7.4 5.5h9.2a1.5 1.5 0 0 1 1.4.9l2.5 7.1" {...stroke} />
      <path
        d="M3.5 13.5h4.6l1.1 2h5.6l1.1-2h4.6v3.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2v-3.5Z"
        fill="currentColor"
        fillOpacity={active ? 0.16 : 0}
        {...stroke}
      />
    </svg>
  );
}

function IconCalendar({ active, className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <rect x="3.5" y="5" width="17" height="15" rx="3.2" fill="currentColor" fillOpacity={active ? 0.16 : 0} {...stroke} />
      <path d="M3.5 9.5h17M8 3v3.5M16 3v3.5" {...stroke} />
      <circle cx="12" cy="14.5" r="1.4" fill="currentColor" />
    </svg>
  );
}

/** Half-risen sun over the horizon — "moments" are days rising toward us. */
function IconSunrise({ active, className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path d="M6.5 16.5a5.5 5.5 0 0 1 11 0" fill="currentColor" fillOpacity={active ? 0.16 : 0} {...stroke} />
      <path d="M2.5 16.5h19M6 20h12M12 4.5v2.5M5.2 8.2l1.6 1.6M18.8 8.2l-1.6 1.6" {...stroke} />
    </svg>
  );
}

/** Large page title — left-aligned, display serif, no decoration. */
export function PageHero({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <section className="px-5 pb-6 pt-10 sm:px-8 sm:pb-10 sm:pt-16">
      <div className="animate-fade-in-up mx-auto max-w-3xl">
        <h1 className="font-display text-[2.75rem] font-semibold leading-[1.02] tracking-[-0.02em] text-ink-800 sm:text-6xl">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-4 max-w-lg font-body text-[17px] leading-relaxed text-ink-500 sm:text-lg">{subtitle}</p>
        )}
      </div>
    </section>
  );
}
