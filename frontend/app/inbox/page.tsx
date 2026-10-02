'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { SiteShell } from '@/components/SiteShell';
import { AuthorGlyph, OrbitLoader } from '@/components/brand';
import { Pager } from '@/components/Pager';
import { useIdentity } from '@/components/IdentityGate';
import { apiFetch, type InboxLetter } from '@/lib/api';
import { pageFromParams, usePagination } from '@/lib/usePagination';

const PAGE_SIZE = 15;

/** Short list-style date ("Sep 22"), with the year only when it isn't this year. */
function shortDate(iso: string) {
  const d = new Date(iso);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }) });
}

export default function InboxPage() {
  return (
    <SiteShell>
      <Suspense
        fallback={
          <div className="flex justify-center py-24">
            <OrbitLoader />
          </div>
        }
      >
        <Inbox />
      </Suspense>
    </SiteShell>
  );
}

function Inbox() {
  const { identity } = useIdentity();
  const router = useRouter();
  const page = pageFromParams(useSearchParams());
  const list = usePagination<InboxLetter>('/inbox', identity, page, PAGE_SIZE);
  // A page holds only part of the inbox, so the header count comes from the server
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!identity) return;
    apiFetch<{ count: number }>('/inbox/unread-count', { author: identity })
      .then((d) => setUnread(d.count))
      .catch(() => {});
  }, [identity]);

  // A stale ?page= past the end lands on the last page instead of an empty one
  useEffect(() => {
    if (list.loaded && page > list.pageCount) router.replace(`/inbox?page=${list.pageCount}`, { scroll: false });
  }, [list.loaded, list.pageCount, page, router]);

  function goToPage(next: number) {
    router.push(next === 1 ? '/inbox' : `/inbox?page=${next}`, { scroll: false });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const letters = list.items;
  const other = identity === 'moon' ? 'Sun' : 'Moon';

  return (
    <div className="mx-auto max-w-2xl px-4 pt-10 sm:px-8 sm:pt-16">
      <header className="animate-fade-in-up mb-8 px-1">
        <h1 className="font-display text-[2.75rem] font-semibold leading-none tracking-[-0.02em] text-ink-800 sm:text-6xl">
          Inbox
        </h1>
        <p className="mt-3 font-body text-[17px] text-ink-500">
          {unread > 0
            ? `${unread} new from ${other}`
            : list.total > 0
              ? `Everything from ${other} is read`
              : `Letters from ${other} arrive here`}
        </p>
      </header>

      {list.initialLoading && (
        <div className="flex justify-center py-16">
          <OrbitLoader label="Checking the mailbox…" />
        </div>
      )}
      {list.error && (
        <div className="glass-card mb-4 text-center">
          <p className="font-body text-[15px] text-rose">{list.error}</p>
          <button type="button" onClick={list.reload} className="btn mt-4">
            Try again
          </button>
        </div>
      )}

      {list.loaded && list.total === 0 && !list.error && (
        <div className="glass-card text-center">
          <p className="font-body text-[17px] text-ink-600">Nothing from {other} yet.</p>
          <Link href="/" className="btn-primary mt-5">
            Write to {other} first
          </Link>
        </div>
      )}

      {letters.length > 0 && (
        <>
          <ul
            className={`glass overflow-hidden rounded-glass-lg transition-opacity duration-200 ${list.loading ? 'opacity-60' : ''}`}
            aria-busy={list.loading}
          >
            {letters.map((letter, i) => (
              <li key={letter.id}>
                <Link
                  href={`/letter/${letter.id}`}
                  className="group flex items-center gap-4 px-4 py-3.5 transition-colors hover:bg-white/50 active:bg-white/70 sm:px-5"
                >
                  <span className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/70 shadow-[inset_0_1px_0_#fff,0_2px_8px_rgba(35,40,88,0.08)]">
                    <AuthorGlyph author={letter.author} className="h-7 w-7" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <p
                        className={`truncate font-body text-[17px] ${
                          letter.unread ? 'font-semibold text-ink-800' : 'font-medium text-ink-700'
                        }`}
                      >
                        {letter.title}
                      </p>
                      <span className="shrink-0 font-body text-[13px] text-ink-400">{shortDate(letter.created_at)}</span>
                    </div>
                    <p className="mt-0.5 flex items-center gap-1.5 font-body text-[14px] text-ink-500">
                      {letter.unread && <span className="h-2 w-2 rounded-full bg-rose" aria-label="Unread" />}
                      {letter.unread ? 'Sealed, waiting for you' : 'Opened'}
                    </p>
                  </div>
                  <svg viewBox="0 0 8 14" className="h-3.5 w-2 shrink-0 text-ink-300 transition-transform duration-300 ease-spring group-hover:translate-x-0.5" aria-hidden>
                    <path d="M1 1l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </Link>
                {i < letters.length - 1 && <div className="ml-[5rem] h-px bg-ink-800/[0.08]" />}
              </li>
            ))}
          </ul>
          <Pager page={page} pageCount={list.pageCount} total={list.total} onChange={goToPage} />
        </>
      )}
    </div>
  );
}
