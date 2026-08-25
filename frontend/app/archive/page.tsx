'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { SiteShell } from '@/components/SiteShell';
import { useIdentity } from '@/components/IdentityGate';
import { apiFetch, formatDate, type ArchiveLetter } from '@/lib/api';
import { authorEmoji, authorLabel } from '@/lib/identity';

export default function ArchivePage() {
  const { identity } = useIdentity();
  const [letters, setLetters] = useState<ArchiveLetter[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!identity) return;
    setLoading(true);
    setError('');
    apiFetch<ArchiveLetter[]>('/archive', { author: identity })
      .then(setLetters)
      .catch((err) =>
        setError(err instanceof Error ? err.message : 'Could not load the archive')
      )
      .finally(() => setLoading(false));
  }, [identity]);

  return (
    <SiteShell>
      <div className="mx-auto max-w-2xl px-5 py-10 sm:px-8">
        <header className="mb-10 text-center">
          <h1 className="font-display text-3xl font-semibold text-mora-brown-800">Letter Archive</h1>
          <p className="font-body mt-2 text-lg text-mora-brown-500">
            Shared between Moon & Fox · {letters.length}{' '}
            {letters.length === 1 ? 'letter' : 'letters'}
          </p>
        </header>

        {loading && (
          <p className="font-body text-center text-mora-brown-400">Loading archive…</p>
        )}
        {error && <p className="font-body mb-4 text-center text-sm text-red-700">{error}</p>}

        {!loading && !error && letters.length === 0 ? (
          <div className="mora-card text-center">
            <p className="font-body text-mora-brown-500">No letters yet. Write the first one.</p>
          </div>
        ) : (
          <ul className="space-y-4">
            {letters.map((letter, i) => (
              <li key={letter.id} className="animate-fade-in-up" style={{ animationDelay: `${i * 0.1}s` }}>
                <Link
                  href={`/letter/${letter.id}`}
                  className="mora-card group block !p-5 transition hover:shadow-soft-lg"
                >
                  <div className="flex items-center gap-4">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-mora-brown-600 text-lg text-white">
                      {authorEmoji(letter.author)}
                    </span>
                    <div>
                      <h2 className="font-display text-xl font-medium text-mora-brown-800 group-hover:text-mora-brown-600">
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
