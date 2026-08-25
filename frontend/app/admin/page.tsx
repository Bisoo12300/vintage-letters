'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch, formatDate, formatDuration, TEMPLATES, type LetterStats } from '@/lib/api';
import { SiteShell } from '@/components/SiteShell';
import { useIdentity } from '@/components/IdentityGate';
import { authorEmoji, authorLabel } from '@/lib/identity';

const emptyForm = { title: '', content: '', template: TEMPLATES[0].id as string };

export default function AdminPage() {
  const { identity } = useIdentity();
  const [letters, setLetters] = useState<LetterStats[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [stats, setStats] = useState<LetterStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadLetters = useCallback(async () => {
    if (!identity) return;
    const data = await apiFetch<LetterStats[]>('/letters', { author: identity });
    setLetters(data);
  }, [identity]);

  useEffect(() => {
    startNew();
    loadLetters().catch(() => setError('Could not load letters'));
  }, [loadLetters]);

  useEffect(() => {
    if (!selectedId) return;
    const refresh = () => {
      loadStats(selectedId).catch(() => {});
      loadLetters().catch(() => {});
    };
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, [selectedId, loadLetters]);

  async function loadStats(id: string) {
    const data = await apiFetch<LetterStats>(`/letters/${id}/stats`, { author: identity });
    setStats(data);
  }

  function selectLetter(letter: LetterStats) {
    setSelectedId(letter.id);
    setForm({ title: letter.title, content: letter.content, template: letter.template });
    setError('');
    loadStats(letter.id).catch(() => setStats(null));
  }

  function startNew() {
    setSelectedId(null);
    setForm(emptyForm);
    setStats(null);
    setError('');
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      if (selectedId) {
        await apiFetch(`/letters/${selectedId}`, {
          method: 'PUT',
          body: JSON.stringify(form),
          author: identity,
        });
        await loadLetters();
        await loadStats(selectedId);
      } else {
        await apiFetch('/letters', {
          method: 'POST',
          body: JSON.stringify(form),
          author: identity,
        });
        await loadLetters();
        startNew();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!selectedId) return;
    if (!confirm('Delete this letter permanently?')) return;
    setLoading(true);
    setError('');
    try {
      await apiFetch(`/letters/${selectedId}`, { method: 'DELETE', author: identity });
      startNew();
      await loadLetters();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SiteShell>
      <div className="mx-auto max-w-5xl px-5 py-10 sm:px-8">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-semibold text-mora-brown-800">My letters</h1>
            <p className="font-body mt-1 text-mora-brown-500">
              {identity
                ? `${authorEmoji(identity)} ${authorLabel(identity)} — only your letters`
                : 'Create, edit & manage letters you wrote'}
            </p>
          </div>
          <button type="button" onClick={startNew} className="mora-btn-primary text-sm">
            + New Letter
          </button>
        </header>

        <div className="grid gap-6 lg:grid-cols-5">
          <div className="space-y-3 lg:col-span-2">
            <h2 className="font-body text-sm font-medium text-mora-brown-500">
              Your letters ({letters.length})
            </h2>
            {letters.length === 0 ? (
              <p className="font-body text-mora-brown-400">No letters yet.</p>
            ) : (
              letters.map((letter) => (
                <button
                  key={letter.id}
                  type="button"
                  onClick={() => selectLetter(letter)}
                  className={`mora-card w-full !p-4 text-left transition hover:shadow-soft-lg ${
                    selectedId === letter.id ? 'ring-2 ring-mora-brown-400' : ''
                  }`}
                >
                  <p className="font-display font-medium text-mora-brown-800">{letter.title}</p>
                  <p className="font-body mt-1 text-sm text-mora-brown-500">{formatDate(letter.created_at)}</p>
                  <div className="mt-2 flex gap-4 font-body text-xs text-mora-brown-400">
                    <span>{letter.read_count} reads</span>
                    <span>{formatDuration(letter.total_read_seconds)}</span>
                  </div>
                </button>
              ))
            )}
          </div>

          <div className="space-y-6 lg:col-span-3">
            <form onSubmit={handleSave} className="mora-card space-y-4">
              <h2 className="font-display text-lg font-semibold text-mora-brown-800">
                {selectedId ? 'Edit Letter' : 'New Letter'}
              </h2>

              <div>
                <label className="mb-2 block font-body text-sm font-medium text-mora-brown-600">Paper</label>
                <select
                  className="mora-input"
                  value={form.template}
                  onChange={(e) => setForm({ ...form, template: e.target.value })}
                >
                  {TEMPLATES.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block font-body text-sm font-medium text-mora-brown-600">Title</label>
                <input
                  className="mora-input"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  required
                />
              </div>

              <div>
                <label className="mb-2 block font-body text-sm font-medium text-mora-brown-600">Body</label>
                <textarea
                  className="mora-textarea min-h-[200px]"
                  value={form.content}
                  onChange={(e) => setForm({ ...form, content: e.target.value })}
                  required
                />
              </div>

              {error && <p className="font-body text-sm text-red-700">{error}</p>}

              <div className="flex flex-wrap gap-2">
                <button type="submit" className="mora-btn-primary text-sm" disabled={loading}>
                  {loading ? 'Saving...' : selectedId ? 'Update' : 'Create'}
                </button>
                {selectedId && (
                  <>
                    <Link href={`/letter/${selectedId}`} className="mora-btn text-sm">
                      Preview
                    </Link>
                    <Link href={`/qr/${selectedId}`} className="mora-btn text-sm">
                      QR Code
                    </Link>
                    <button
                      type="button"
                      onClick={handleDelete}
                      className="mora-btn border-red-200 text-sm text-red-700 hover:border-red-300"
                      disabled={loading}
                    >
                      Delete
                    </button>
                  </>
                )}
              </div>
            </form>

            {stats && (
              <div className="mora-card">
                <h3 className="mb-4 font-body text-sm font-medium text-mora-brown-500">Reading Stats</h3>
                <div className="mb-4 grid grid-cols-2 gap-4 font-body text-sm">
                  <div className="rounded-2xl bg-mora-beige-50 p-4 text-center">
                    <p className="text-2xl font-bold text-mora-brown-700">{stats.read_count}</p>
                    <p className="text-mora-brown-500">Times Read</p>
                  </div>
                  <div className="rounded-2xl bg-mora-beige-50 p-4 text-center">
                    <p className="text-2xl font-bold text-mora-brown-700">
                      {formatDuration(stats.total_read_seconds)}
                    </p>
                    <p className="text-mora-brown-500">Total Time</p>
                  </div>
                </div>
                {stats.readers && stats.readers.length > 0 && (
                  <div className="mb-4">
                    <p className="mb-2 font-body text-xs text-mora-brown-500">Read by</p>
                    <ul className="space-y-2">
                      {stats.readers.map((r) => (
                        <li
                          key={r.reader}
                          className="rounded-xl border border-mora-beige-200 bg-mora-beige-50 px-4 py-2 font-body text-sm text-mora-brown-600"
                        >
                          {authorEmoji(r.reader)} {authorLabel(r.reader)} · last{' '}
                          {formatDate(r.last_read_at)}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {stats.sessions && stats.sessions.length > 0 && (
                  <ul className="max-h-40 space-y-2 overflow-y-auto">
                    {stats.sessions.map((s) => (
                      <li
                        key={s.id}
                        className="rounded-xl border border-mora-beige-200 bg-mora-beige-50 px-4 py-2 font-body text-sm text-mora-brown-600"
                      >
                        {s.reader ? `${authorEmoji(s.reader)} ${authorLabel(s.reader)} · ` : ''}
                        {formatDate(s.started_at)} · {formatDuration(s.duration_seconds)}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </SiteShell>
  );
}
