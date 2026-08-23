'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { SiteShell } from '@/components/SiteShell';
import { apiFetch, formatDate, type ArchiveLetter } from '@/lib/api';

export default function ArchivePage() {
  const [token, setToken] = useState('');
  const [authenticated, setAuthenticated] = useState(false);
  const [letters, setLetters] = useState<ArchiveLetter[]>([]);
  const [error, setError] = useState('');

  async function loadArchive(t: string) {
    const data = await apiFetch<ArchiveLetter[]>('/archive', { readerToken: t });
    setLetters(data);
    setAuthenticated(true);
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('reader-token', t);
    }
  }

  useEffect(() => {
    const saved = sessionStorage.getItem('reader-token');
    if (saved) {
      loadArchive(saved).catch(() => sessionStorage.removeItem('reader-token'));
    }
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    try {
      await loadArchive(token);
      setError('');
    } catch {
      setError('Invalid access code');
    }
  }

  if (!authenticated) {
    return (
      <SiteShell>
        <div className="flex min-h-[60vh] items-center justify-center p-6">
          <div className="mora-card animate-fade-in-up w-full max-w-md text-center">
            <div className="wax-seal mx-auto mb-6">📚</div>
            <h1 className="font-display mb-2 text-3xl font-semibold text-mora-brown-800">The Archive</h1>
            <p className="font-body mb-8 text-mora-brown-500">A treasury of letters received</p>
            <form onSubmit={handleLogin} className="space-y-4">
              <input
                type="password"
                className="mora-input text-center"
                placeholder="Archive access code"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                required
              />
              {error && <p className="font-body text-sm text-red-700">{error}</p>}
              <button type="submit" className="mora-btn-primary w-full">
                Enter the Archive
              </button>
            </form>
            <p className="mt-6 font-body text-sm text-mora-brown-400">
              Or scan a QR code on a letter to read directly
            </p>
          </div>
        </div>
      </SiteShell>
    );
  }

  return (
    <SiteShell>
      <div className="mx-auto max-w-2xl px-5 py-10 sm:px-8">
        <header className="mb-10 text-center">
          <h1 className="font-display text-3xl font-semibold text-mora-brown-800">Letter Archive</h1>
          <p className="font-body mt-2 text-lg text-mora-brown-500">
            {letters.length} {letters.length === 1 ? 'letter' : 'letters'} await you
          </p>
        </header>

        {letters.length === 0 ? (
          <div className="mora-card text-center">
            <p className="font-body text-mora-brown-500">
              No letters yet. Scan a QR code from the sender to begin.
            </p>
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
                      ✉
                    </span>
                    <div>
                      <h2 className="font-display text-xl font-medium text-mora-brown-800 group-hover:text-mora-brown-600">
                        {letter.title}
                      </h2>
                      <p className="font-body mt-1 text-sm text-mora-brown-500">
                        {formatDate(letter.created_at)}
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
