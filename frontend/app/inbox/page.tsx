'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { SiteShell } from '@/components/SiteShell';
import { BookLoader } from '@/components/BookLoader';
import { useIdentity } from '@/components/IdentityGate';
import { apiFetch, formatDate, type InboxLetter } from '@/lib/api';
import { authorEmoji, authorLabel } from '@/lib/identity';

export default function InboxPage() {
  const { identity } = useIdentity();
  const [letters, setLetters] = useState<InboxLetter[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!identity) return;
    setLoading(true);
    setError('');
    apiFetch<InboxLetter[]>('/inbox', { author: identity })
      .then(setLetters)
      .catch((err) =>
        setError(err instanceof Error ? err.message : 'Could not load inbox')
      )
      .finally(() => setLoading(false));
  }, [identity]);

  const unread = letters.filter((l) => l.unread).length;
  const other = identity === 'moon' ? 'Fox' : 'Moon';

  return (
    <SiteShell>
      <div className="mx-auto max-w-2xl px-5 py-10 sm:px-8">
        <header className="mb-10 text-center">
          <h1 className="font-display text-3xl font-semibold text-mora-brown-800">Inbox</h1>
          <p className="font-body mt-2 text-lg text-mora-brown-500">
            Letters from {other}
            {unread > 0 ? (
              <>
                {' · '}
                <span className="font-medium text-mora-brown-700">
                  {unread} unread
                </span>
              </>
            ) : (
              <> · {letters.length} {letters.length === 1 ? 'letter' : 'letters'}</>
            )}
          </p>
        </header>

        {loading && (
          <div className="flex justify-center py-16">
            <BookLoader label="Loading inbox…" />
          </div>
        )}
        {error && <p className="font-body mb-4 text-center text-sm text-red-700">{error}</p>}

        {!loading && !error && letters.length === 0 ? (
          <div className="mora-card text-center">
            <p className="font-body text-mora-brown-500">
              No letters from {other} yet.
            </p>
          </div>
        ) : (
          <ul className="space-y-4">
            {letters.map((letter, i) => (
              <li key={letter.id} className="animate-fade-in-up" style={{ animationDelay: `${i * 0.1}s` }}>
                <Link
                  href={`/letter/${letter.id}`}
                  className={`mora-card group block !p-5 transition hover:shadow-soft-lg ${
                    letter.unread ? 'ring-2 ring-mora-brown-400/40' : ''
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <span className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-mora-brown-600 text-lg text-white">
                      {authorEmoji(letter.author)}
                      {letter.unread && (
                        <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full bg-red-500 ring-2 ring-mora-cream" />
                      )}
                    </span>
                    <div>
                      <h2 className="font-display text-xl font-medium text-mora-brown-800 group-hover:text-mora-brown-600">
                        {letter.unread && (
                          <span className="mr-2 font-body text-xs font-semibold tracking-wide text-red-600 uppercase">
                            New
                          </span>
                        )}
                        {letter.title}
                      </h2>
                      <p className="font-body mt-1 text-sm text-mora-brown-500">
                        {authorLabel(letter.author)} · {formatDate(letter.created_at)}
                      </p>
                    </div>
                    <span className="ml-auto font-body text-sm text-mora-brown-400 opacity-0 transition group-hover:opacity-100">
                      read →
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </SiteShell>
  );
}
