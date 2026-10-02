'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { SiteShell } from '@/components/SiteShell';
import { PlanModal } from '@/components/plans/PlanModal';
import { OrbitLoader } from '@/components/brand';
import { useIdentity } from '@/components/IdentityGate';
import { apiFetch, type Milestone } from '@/lib/api';
import { authorLabel } from '@/lib/identity';
import { AuthorGlyph } from '@/components/brand';

type Mode = Milestone['mode'];

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function toDateLocalValue(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Date-only YYYY-MM-DD → local midnight ISO with offset. */
function toOffsetISOFromDate(dateValue: string) {
  const [y, m, d] = dateValue.split('-').map(Number);
  if (!y || !m || !d) throw new Error('Invalid at');
  const local = new Date(y, m - 1, d, 0, 0, 0, 0);
  const offsetMin = -local.getTimezoneOffset();
  const sign = offsetMin >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMin);
  return `${y}-${pad(m)}-${pad(d)}T00:00:00${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}

function startOfLocalDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function dayDiff(atIso: string, now = new Date()) {
  const target = startOfLocalDay(new Date(atIso));
  const today = startOfLocalDay(now);
  return Math.round((target - today) / 86_400_000);
}

function formatDayCount(days: number) {
  const n = Math.abs(days);
  return n === 1 ? '1 day' : `${n} days`;
}

function describeDays(m: Milestone) {
  const diff = dayDiff(m.at);

  if (m.mode === 'countup') {
    if (diff > 0) return { primary: formatDayCount(diff), label: 'until start', tone: 'upcoming' as const };
    if (diff === 0) return { primary: 'Today', label: 'day zero', tone: 'arrived' as const };
    return { primary: formatDayCount(diff), label: 'since', tone: 'elapsed' as const };
  }

  if (diff > 0) return { primary: formatDayCount(diff), label: 'left', tone: 'upcoming' as const };
  if (diff === 0) return { primary: 'Today', label: "it's here", tone: 'arrived' as const };
  return { primary: formatDayCount(diff), label: 'ago', tone: 'passed' as const };
}

function formatDay(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function CountLine({ m, size = 'md' }: { m: Milestone; size?: 'md' | 'lg' }) {
  const desc = describeDays(m);
  const days = Math.abs(dayDiff(m.at));
  const today = desc.tone === 'arrived';
  const tone = today ? 'text-rose' : desc.tone === 'passed' ? 'text-ink-400' : 'text-ink-800';
  return (
    <p className="flex items-baseline gap-2">
      <span
        className={`font-display font-semibold leading-none tracking-[-0.03em] tabular-nums ${tone} ${
          size === 'lg' ? 'text-6xl' : 'text-5xl'
        }`}
      >
        {today ? 'Today' : days}
      </span>
      <span className="font-body text-[14px] text-ink-500">
        {today ? desc.label : `${days === 1 ? 'day' : 'days'} ${desc.label}`}
      </span>
    </p>
  );
}

function MomentCard({ m, onOpen }: { m: Milestone; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="glass w-full rounded-glass-lg p-4 text-left transition-transform duration-300 ease-spring hover:-translate-y-0.5 active:scale-[0.98] sm:p-5"
    >
      <p className="truncate font-body text-[15px] font-semibold text-ink-800">{m.title}</p>
      <p className="mt-0.5 font-body text-[12px] text-ink-500">{formatDay(m.at)}</p>
      <div className="mt-5">
        <CountLine m={m} />
      </div>
    </button>
  );
}

function Column({
  title,
  glyph,
  items,
  empty,
  onOpen,
}: {
  title: string;
  glyph: 'moon' | 'sun';
  items: Milestone[];
  empty: string;
  onOpen: (m: Milestone) => void;
}) {
  return (
    <section className="min-w-0">
      <h2 className="mb-3 flex items-center gap-2 px-1 font-display text-2xl font-semibold text-ink-800">
        <AuthorGlyph author={glyph} className="h-5 w-5" />
        {title}
      </h2>
      {items.length === 0 ? (
        <p className="glass rounded-glass-lg px-4 py-8 text-center font-body text-[14px] text-ink-400">{empty}</p>
      ) : (
        <ul className="space-y-3">
          {items.map((m) => (
            <li key={m.id}>
              <MomentCard m={m} onOpen={() => onOpen(m)} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function MilestonesPage() {
  const { identity } = useIdentity();
  const [items, setItems] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Milestone | null>(null);
  const [title, setTitle] = useState('');
  const [mode, setMode] = useState<Mode>('countdown');
  const [atLocal, setAtLocal] = useState(() => toDateLocalValue(new Date()));

  const ups = useMemo(() => items.filter((m) => m.mode === 'countup'), [items]);
  const downs = useMemo(() => items.filter((m) => m.mode === 'countdown'), [items]);

  const load = useCallback(async () => {
    if (!identity) return;
    const data = await apiFetch<Milestone[]>('/milestones', { author: identity });
    setItems(data);
  }, [identity]);

  useEffect(() => {
    if (!identity) return;
    setLoading(true);
    setError('');
    load()
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load moments'))
      .finally(() => setLoading(false));
  }, [identity, load]);

  function openCreate(preferred: Mode = 'countdown') {
    setEditing(null);
    setTitle('');
    setMode(preferred);
    setAtLocal(toDateLocalValue(new Date()));
    setModalOpen(true);
  }

  function openDetail(m: Milestone) {
    setEditing(m);
    setTitle(m.title);
    setMode(m.mode);
    setAtLocal(toDateLocalValue(new Date(m.at)));
    setModalOpen(true);
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!identity || !title.trim()) return;
    setBusy(true);
    setError('');
    try {
      const body = {
        title: title.trim(),
        mode,
        at: toOffsetISOFromDate(atLocal),
      };
      if (editing) {
        await apiFetch<Milestone>(`/milestones/${editing.id}`, {
          method: 'PUT',
          author: identity,
          body: JSON.stringify(body),
        });
      } else {
        await apiFetch<Milestone>('/milestones', {
          method: 'POST',
          author: identity,
          body: JSON.stringify(body),
        });
      }
      setModalOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save');
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string) {
    if (!identity) return;
    if (!window.confirm('Delete this moment?')) return;
    setBusy(true);
    setError('');
    try {
      await apiFetch(`/milestones/${id}`, { method: 'DELETE', author: identity });
      setModalOpen(false);
      setEditing(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete');
    } finally {
      setBusy(false);
    }
  }

  return (
    <SiteShell>
      <div className="mx-auto max-w-4xl px-4 pt-10 sm:px-8 sm:pt-16">
        <header className="animate-fade-in-up mb-8 flex flex-wrap items-end justify-between gap-4 px-1">
          <div>
            <h1 className="font-display text-[2.75rem] font-semibold leading-none tracking-[-0.02em] text-ink-800 sm:text-6xl">
              Moments
            </h1>
            <p className="mt-3 font-body text-[17px] text-ink-500">Count the days since, and the days until.</p>
          </div>
          <button type="button" className="btn-primary" onClick={() => openCreate()}>
            New moment
          </button>
        </header>

        {loading && (
          <div className="flex justify-center py-16">
            <OrbitLoader label="Loading moments…" />
          </div>
        )}
        {error && <p className="mb-4 text-center font-body text-[14px] text-rose">{error}</p>}

        {!loading && (
          <div className="grid gap-8 sm:grid-cols-2 sm:gap-6">
            <Column title="Since" glyph="moon" items={ups} empty="Add a day you count from, like your first date." onOpen={openDetail} />
            <Column title="Until" glyph="sun" items={downs} empty="Add a day you're waiting for." onOpen={openDetail} />
          </div>
        )}
      </div>

      <PlanModal
        open={modalOpen}
        title={editing ? editing.title : 'New moment'}
        onClose={() => setModalOpen(false)}
      >
        {editing && (
          <div className="mb-5 rounded-2xl bg-white/55 px-4 py-4">
            <CountLine m={editing} size="lg" />
            <p className="mt-2 flex items-center gap-1.5 font-body text-[14px] text-ink-500">
              {formatDay(editing.at)} · added by
              <AuthorGlyph author={editing.created_by} className="h-4 w-4" />
              {authorLabel(editing.created_by)}
            </p>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-4">
          <label className="block">
            <span className="mb-2 block font-body text-[13px] font-semibold text-ink-500">Name</span>
            <input
              className="field"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Our anniversary"
              required
              maxLength={120}
            />
          </label>

          <fieldset>
            <legend className="mb-2 font-body text-[13px] font-semibold text-ink-500">Count</legend>
            <div className="segmented grid-cols-2">
              <span
                aria-hidden
                className="absolute bottom-1 left-1 top-1 w-[calc(50%-0.25rem)] rounded-full bg-white shadow-[0_2px_8px_rgba(35,40,88,0.15)] transition-transform duration-500 ease-spring"
                style={{ transform: mode === 'countdown' ? 'translateX(100%)' : 'none' }}
              />
              {(
                [
                  { id: 'countup' as const, label: 'Days since' },
                  { id: 'countdown' as const, label: 'Days until' },
                ]
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  aria-pressed={mode === opt.id}
                  onClick={() => setMode(opt.id)}
                  className={`relative z-10 rounded-full py-2 font-body text-[14px] font-semibold transition-colors ${
                    mode === opt.id ? 'text-ink-800' : 'text-ink-500'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </fieldset>

          <label className="block">
            <span className="mb-2 block font-body text-[13px] font-semibold text-ink-500">Date</span>
            <input
              type="date"
              className="field"
              value={atLocal}
              onChange={(e) => setAtLocal(e.target.value)}
              required
            />
          </label>

          <div className="flex flex-col gap-2 pt-1 sm:flex-row">
            <button type="submit" className="btn-primary flex-1" disabled={busy || !title.trim()}>
              {busy ? 'Saving…' : editing ? 'Save' : 'Add moment'}
            </button>
            {editing && (
              <button
                type="button"
                className="btn-danger"
                disabled={busy}
                onClick={() => handleDelete(editing.id)}
              >
                Delete
              </button>
            )}
          </div>
        </form>
      </PlanModal>
    </SiteShell>
  );
}
