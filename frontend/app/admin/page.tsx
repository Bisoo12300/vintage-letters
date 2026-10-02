'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiFetch, formatDate, formatDuration, TEMPLATES, type Letter, type LetterStats } from '@/lib/api';
import { SiteShell } from '@/components/SiteShell';
import { useIdentity } from '@/components/IdentityGate';
import { authorLabel, type AuthorId } from '@/lib/identity';
import { AuthorGlyph, OrbitLoader } from '@/components/brand';
import { Pager } from '@/components/Pager';
import { pageFromParams, usePagination } from '@/lib/usePagination';

const PAGE_SIZE = 15;

function shortDate(iso: string) {
  const d = new Date(iso);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }) });
}

export default function AdminPage() {
  return (
    <SiteShell>
      <Suspense
        fallback={
          <div className="flex justify-center py-24">
            <OrbitLoader />
          </div>
        }
      >
        <MyLetters />
      </Suspense>
    </SiteShell>
  );
}

/** One page of my letters; tapping one pushes ?letter=<id> (keeping ?page) and shows the editor. */
function MyLetters() {
  const { identity } = useIdentity();
  const router = useRouter();
  const params = useSearchParams();
  const selectedId = params.get('letter');
  const page = pageFromParams(params);
  const list = usePagination<LetterStats>('/letters', identity, page, PAGE_SIZE);
  const listScrollY = useRef(0);
  const pushedFromList = useRef(false);
  const listUrl = page > 1 ? `/admin?page=${page}` : '/admin';

  function openLetter(id: string) {
    listScrollY.current = window.scrollY;
    pushedFromList.current = true;
    router.push(`${listUrl}${page > 1 ? '&' : '?'}letter=${id}`, { scroll: false });
    window.scrollTo({ top: 0 });
  }

  const backToList = useCallback(() => {
    // Pop our own history entry so the browser/phone back button stays in sync
    if (pushedFromList.current) router.back();
    else router.replace(listUrl, { scroll: false });
  }, [router, listUrl]);

  function goToPage(next: number) {
    router.push(next === 1 ? '/admin' : `/admin?page=${next}`, { scroll: false });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // A stale ?page= past the end (e.g. after deleting the last letter on a page) lands on the last page
  useEffect(() => {
    if (!selectedId && list.loaded && page > list.pageCount) {
      router.replace(list.pageCount > 1 ? `/admin?page=${list.pageCount}` : '/admin', { scroll: false });
    }
  }, [selectedId, list.loaded, list.pageCount, page, router]);

  // Returning to the list restores where you were
  useEffect(() => {
    if (selectedId) return;
    pushedFromList.current = false;
    const y = listScrollY.current;
    requestAnimationFrame(() => window.scrollTo({ top: y }));
  }, [selectedId]);

  const letters = list.items;

  return (
    <>
      {/* The list stays mounted (just hidden) so loaded pages survive opening a letter */}
      <div className={`mx-auto max-w-2xl px-4 pt-10 sm:px-8 sm:pt-16 ${selectedId ? 'hidden' : ''}`}>
        <header className="animate-fade-in-up mb-8 flex flex-wrap items-end justify-between gap-4 px-1">
          <div>
            <h1 className="font-display text-[2.75rem] font-semibold leading-none tracking-[-0.02em] text-ink-800 sm:text-6xl">
              My letters
            </h1>
            <p className="mt-3 font-body text-[17px] text-ink-500">
              Tap a letter to edit it or see when it was read.
            </p>
          </div>
          <Link href="/" className="btn-primary">
            New letter
          </Link>
        </header>

        {list.initialLoading && (
          <div className="flex justify-center py-16">
            <OrbitLoader label="Gathering your letters…" />
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
            <p className="font-body text-[17px] text-ink-600">You haven't sent a letter yet.</p>
            <Link href="/" className="btn-primary mt-5">
              Write your first letter
            </Link>
          </div>
        )}

        {letters.length > 0 && (
          <ul
            className={`glass overflow-hidden rounded-glass-lg transition-opacity duration-200 ${list.loading ? 'opacity-60' : ''}`}
            aria-busy={list.loading}
          >
            {letters.map((letter, i) => (
              <li key={letter.id}>
                <button
                  type="button"
                  onClick={() => openLetter(letter.id)}
                  className="group flex w-full items-center gap-4 px-4 py-3.5 text-left transition-colors hover:bg-white/50 active:bg-white/70 sm:px-5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="truncate font-body text-[17px] font-semibold text-ink-800">{letter.title}</p>
                      <span className="shrink-0 font-body text-[13px] text-ink-400">{shortDate(letter.created_at)}</span>
                    </div>
                    <p className="mt-0.5 font-body text-[14px] text-ink-500">
                      {letter.read_count === 0
                        ? 'Not opened yet'
                        : `Opened ${letter.read_count === 1 ? 'once' : `${letter.read_count} times`} · ${formatDuration(letter.total_read_seconds)}`}
                    </p>
                  </div>
                  <svg viewBox="0 0 8 14" className="h-3.5 w-2 shrink-0 text-ink-300 transition-transform duration-300 ease-spring group-hover:translate-x-0.5" aria-hidden>
                    <path d="M1 1l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                {i < letters.length - 1 && <div className="ml-4 h-px bg-ink-800/[0.08] sm:ml-5" />}
              </li>
            ))}
          </ul>
        )}

        {letters.length > 0 && (
          <Pager page={page} pageCount={list.pageCount} total={list.total} onChange={goToPage} />
        )}
      </div>

      {selectedId && identity && (
        <LetterEditor
          key={selectedId}
          id={selectedId}
          identity={identity}
          onBack={backToList}
          onSaved={(updated) => list.updateItem((l) => l.id === updated.id, updated)}
          onDeleted={() => {
            // Totals and page boundaries shift — refetch the current page
            list.reload();
            backToList();
          }}
        />
      )}
    </>
  );
}

function LetterEditor({
  id,
  identity,
  onBack,
  onSaved,
  onDeleted,
}: {
  id: string;
  identity: AuthorId;
  onBack: () => void;
  onSaved: (letter: LetterStats) => void;
  onDeleted: (id: string) => void;
}) {
  const [stats, setStats] = useState<LetterStats | null>(null);
  const [form, setForm] = useState({ title: '', content: '', template: TEMPLATES[0].id as string });
  const [loadError, setLoadError] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [savedAt, setSavedAt] = useState(0);

  const loadStats = useCallback(
    async (fillForm: boolean) => {
      const data = await apiFetch<LetterStats>(`/letters/${id}/stats`, { author: identity });
      setStats(data);
      if (fillForm) setForm({ title: data.title, content: data.content, template: data.template });
    },
    [id, identity]
  );

  useEffect(() => {
    loadStats(true).catch((err) =>
      setLoadError(err instanceof Error ? err.message : 'This letter could not be loaded.')
    );
    // Reading stats change while you're away — refresh them (not the form) on return
    const refresh = () => loadStats(false).catch(() => {});
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, [loadStats]);

  const dirty =
    !!stats && (form.title !== stats.title || form.content !== stats.content || form.template !== stats.template);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!stats) return;
    setBusy(true);
    setError('');
    try {
      const updated = await apiFetch<Letter>(`/letters/${id}`, {
        method: 'PUT',
        body: JSON.stringify(form),
        author: identity,
      });
      const next = { ...stats, ...updated };
      setStats(next);
      onSaved(next);
      setSavedAt(Date.now());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Changes could not be saved. Try again.');
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!confirm('Delete this letter? This cannot be undone.')) return;
    setBusy(true);
    setError('');
    try {
      await apiFetch(`/letters/${id}`, { method: 'DELETE', author: identity });
      onDeleted(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The letter could not be deleted. Try again.');
      setBusy(false);
    }
  }

  return (
    <div className="animate-push-in mx-auto max-w-2xl px-4 pt-6 sm:px-8 sm:pt-10">
      <button
        type="button"
        onClick={onBack}
        className="-ml-1 mb-4 flex h-10 items-center gap-1 rounded-full pl-1 pr-3 font-body text-[17px] font-medium text-ink-600 transition-transform duration-300 ease-spring hover:text-ink-800 active:scale-95"
      >
        <svg viewBox="0 0 10 16" className="h-4 w-2.5" aria-hidden>
          <path d="M8.5 1.5 2 8l6.5 6.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        My letters
      </button>

      {loadError ? (
        <div className="glass-card text-center">
          <p className="font-body text-[15px] text-rose">{loadError}</p>
          <button type="button" onClick={onBack} className="btn mt-4">
            Back to my letters
          </button>
        </div>
      ) : !stats ? (
        <div className="flex justify-center py-16">
          <OrbitLoader label="Opening letter…" />
        </div>
      ) : (
        <div className="space-y-6">
          <form onSubmit={handleSave} className="glass-card space-y-6">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h1 className="font-display text-3xl font-semibold text-ink-800">Edit letter</h1>
              <span className="font-body text-[13px] text-ink-400">Sent {formatDate(stats.created_at)}</span>
            </div>

            <fieldset>
              <legend className="mb-3 font-body text-[13px] font-semibold text-ink-500">Paper</legend>
              <div className="grid grid-cols-3 gap-3">
                {TEMPLATES.map((t) => {
                  const active = form.template === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setForm({ ...form, template: t.id })}
                      aria-pressed={active}
                      className={`relative overflow-hidden rounded-2xl transition-transform duration-500 ease-spring active:scale-95 ${
                        active ? 'scale-[1.02] ring-2 ring-ink-800 ring-offset-2 ring-offset-white/0' : 'opacity-80 hover:opacity-100'
                      }`}
                    >
                      <div className="aspect-[4/3] bg-cover bg-center" style={{ backgroundImage: `url(${t.background})` }} />
                      <span className="glass absolute inset-x-1.5 bottom-1.5 truncate rounded-xl px-2 py-1 text-center font-body text-[12px] font-semibold text-ink-800">
                        {t.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <label className="block">
              <span className="mb-2 block font-body text-[13px] font-semibold text-ink-500">Title</span>
              <input
                className="field font-letter"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                required
              />
            </label>

            <label className="block">
              <span className="mb-2 block font-body text-[13px] font-semibold text-ink-500">Letter</span>
              <textarea
                className="field-area font-letter leading-[1.8]"
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                required
              />
            </label>

            {error && <p className="font-body text-[14px] text-rose">{error}</p>}

            <div className="flex flex-wrap items-center gap-2">
              <button type="submit" className="btn-primary" disabled={busy || !dirty}>
                {busy ? 'Saving…' : 'Save changes'}
              </button>
              <Link href={`/letter/${id}`} className="btn">
                Preview
              </Link>
              <Link href={`/qr/${id}`} className="btn">
                QR code
              </Link>
              <button type="button" onClick={handleDelete} className="btn-danger sm:ml-auto" disabled={busy}>
                Delete
              </button>
            </div>
            {savedAt > 0 && !dirty && (
              <p className="font-body text-[13px] text-ink-500" role="status">
                Saved
              </p>
            )}
          </form>

          <section className="glass-card">
            <h2 className="mb-4 font-display text-2xl font-semibold text-ink-800">Reading</h2>
            <div className="grid grid-cols-2 gap-3 font-body text-[14px]">
              <div className="rounded-2xl bg-white/55 p-4 text-center">
                <p className="font-display text-4xl font-semibold text-ink-800">{stats.read_count}</p>
                <p className="text-ink-500">times opened</p>
              </div>
              <div className="rounded-2xl bg-white/55 p-4 text-center">
                <p className="font-display text-4xl font-semibold text-ink-800">{formatDuration(stats.total_read_seconds)}</p>
                <p className="text-ink-500">spent reading</p>
              </div>
            </div>

            {stats.readers && stats.readers.length > 0 && (
              <ul className="mt-4 space-y-2">
                {stats.readers.map((r) => (
                  <li
                    key={r.reader}
                    className="flex items-center gap-2 rounded-xl bg-white/55 px-4 py-2 font-body text-[14px] text-ink-600"
                  >
                    <AuthorGlyph author={r.reader} className="h-4 w-4" />
                    {authorLabel(r.reader)}, last opened {formatDate(r.last_read_at)}
                  </li>
                ))}
              </ul>
            )}

            {stats.sessions && stats.sessions.length > 0 && (
              <ul className="mt-2 max-h-48 space-y-2 overflow-y-auto">
                {stats.sessions.map((s) => (
                  <li
                    key={s.id}
                    className="flex items-center gap-2 rounded-xl bg-white/55 px-4 py-2 font-body text-[14px] text-ink-600"
                  >
                    {s.reader && <AuthorGlyph author={s.reader} className="h-4 w-4" />}
                    {s.reader ? `${authorLabel(s.reader)} · ` : ''}
                    {formatDate(s.started_at)} · {formatDuration(s.duration_seconds)}
                  </li>
                ))}
              </ul>
            )}

            {stats.read_count === 0 && (
              <p className="mt-4 font-body text-[14px] text-ink-500">Not opened yet. You'll see each visit here.</p>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
