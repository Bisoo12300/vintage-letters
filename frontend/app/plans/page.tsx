'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { SiteShell } from '@/components/SiteShell';
import { PlanModal } from '@/components/plans/PlanModal';
import { useIdentity } from '@/components/IdentityGate';
import { apiFetch, formatDate, type DatePlan } from '@/lib/api';
import { authorEmoji, authorLabel } from '@/lib/identity';

const HOUR_START = 8;
const HOUR_END = 22;
const HOUR_H = 52;
const DEFAULT_HOURS = 1;
const HOURS = Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i);

const STATUS_LABEL: Record<DatePlan['status'], string> = {
  pending: 'Pending',
  accepted: 'Accepted',
  declined: 'Declined',
};

const STATUS_STYLE: Record<DatePlan['status'], string> = {
  pending: 'border-amber-300 bg-amber-50 text-amber-950',
  accepted: 'border-emerald-300 bg-emerald-50 text-emerald-950',
  declined: 'border-mora-beige-200 bg-mora-beige-50 text-mora-brown-500 line-through opacity-70',
};

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function startOfWeek(d: Date) {
  const x = startOfDay(d);
  x.setDate(x.getDate() - x.getDay()); // Sunday
  return x;
}

function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function toDatetimeLocalValue(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatHour(h: number) {
  if (h === 0) return '12 AM';
  if (h < 12) return `${h} AM`;
  if (h === 12) return '12 PM';
  return `${h - 12} PM`;
}

function formatWeekRange(weekStart: Date) {
  const end = addDays(weekStart, 6);
  const opts: Intl.DateTimeFormatOptions = { month: 'long', day: 'numeric', year: 'numeric' };
  if (weekStart.getMonth() === end.getMonth()) {
    return `${weekStart.toLocaleDateString('en-US', { month: 'long' })} ${weekStart.getDate()} – ${end.getDate()}, ${end.getFullYear()}`;
  }
  return `${weekStart.toLocaleDateString('en-US', opts)} – ${end.toLocaleDateString('en-US', opts)}`;
}

function monthMatrix(year: number, month: number) {
  const first = new Date(year, month, 1);
  const start = startOfWeek(first);
  const weeks: Date[][] = [];
  let cursor = start;
  for (let w = 0; w < 6; w++) {
    const row: Date[] = [];
    for (let d = 0; d < 7; d++) {
      row.push(new Date(cursor));
      cursor = addDays(cursor, 1);
    }
    weeks.push(row);
    if (cursor.getMonth() !== month && w >= 3) break;
  }
  return weeks;
}

function MiniMonth({
  year,
  month,
  selected,
  today,
  onSelect,
  onPrev,
  onNext,
  showNav,
}: {
  year: number;
  month: number;
  selected: Date;
  today: Date;
  onSelect: (d: Date) => void;
  onPrev?: () => void;
  onNext?: () => void;
  showNav?: boolean;
}) {
  const weeks = monthMatrix(year, month);
  const label = new Date(year, month, 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="font-body text-xs text-mora-brown-700">
      <div className="mb-2 flex items-center justify-between">
        {showNav ? (
          <button type="button" onClick={onPrev} className="rounded px-1.5 py-0.5 hover:bg-mora-beige-100">
            ‹
          </button>
        ) : (
          <span className="w-5" />
        )}
        <span className="font-medium text-mora-brown-800">{label}</span>
        {showNav ? (
          <button type="button" onClick={onNext} className="rounded px-1.5 py-0.5 hover:bg-mora-beige-100">
            ›
          </button>
        ) : (
          <span className="w-5" />
        )}
      </div>
      <div className="mb-1 grid grid-cols-7 gap-0.5 text-center text-[10px] text-mora-brown-400">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5 text-center">
        {weeks.flat().map((day) => {
          const inMonth = day.getMonth() === month;
          const isSelected = sameDay(day, selected);
          const isToday = sameDay(day, today);
          return (
            <button
              key={day.toISOString()}
              type="button"
              onClick={() => onSelect(day)}
              className={`mx-auto flex h-7 w-7 items-center justify-center rounded-full transition ${
                isSelected
                  ? 'bg-mora-brown-600 font-semibold text-white'
                  : isToday
                    ? 'bg-mora-beige-200 font-semibold text-mora-brown-800'
                    : inMonth
                      ? 'text-mora-brown-700 hover:bg-mora-beige-100'
                      : 'text-mora-brown-300'
              }`}
            >
              {day.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function PlansPage() {
  const { identity } = useIdentity();
  const today = useMemo(() => startOfDay(new Date()), []);
  const [anchor, setAnchor] = useState(() => startOfDay(new Date()));
  const [miniMonth, setMiniMonth] = useState(() => {
    const d = new Date();
    return { y: d.getFullYear(), m: d.getMonth() };
  });
  const [plans, setPlans] = useState<DatePlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [startsAt, setStartsAt] = useState(toDatetimeLocalValue(new Date()));
  const [note, setNote] = useState('');
  const [selected, setSelected] = useState<DatePlan | null>(null);

  const weekStart = useMemo(() => startOfWeek(anchor), [anchor]);
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  const load = useCallback(async () => {
    if (!identity) return;
    const data = await apiFetch<DatePlan[]>('/plans', { author: identity });
    setPlans(data);
  }, [identity]);

  useEffect(() => {
    if (!identity) return;
    setLoading(true);
    setError('');
    load()
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load plans'))
      .finally(() => setLoading(false));
  }, [identity, load]);

  function openCreate(at: Date) {
    setStartsAt(toDatetimeLocalValue(at));
    setNote('');
    setCreateOpen(true);
  }

  function onSlotClick(day: Date, hour: number) {
    const at = new Date(day);
    at.setHours(hour, 0, 0, 0);
    openCreate(at);
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!identity || !startsAt) return;
    setBusy(true);
    setError('');
    try {
      await apiFetch<DatePlan>('/plans', {
        method: 'POST',
        author: identity,
        body: JSON.stringify({
          startsAt: new Date(startsAt).toISOString(),
          note,
        }),
      });
      setCreateOpen(false);
      setNote('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create plan');
    } finally {
      setBusy(false);
    }
  }

  async function respond(id: string, action: 'accept' | 'decline') {
    if (!identity) return;
    setBusy(true);
    try {
      await apiFetch(`/plans/${id}/${action}`, { method: 'POST', author: identity });
      setSelected(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Could not ${action}`);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!identity) return;
    setBusy(true);
    try {
      await apiFetch(`/plans/${id}`, { method: 'DELETE', author: identity });
      setSelected(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete');
    } finally {
      setBusy(false);
    }
  }

  const nextMonth = miniMonth.m === 11 ? { y: miniMonth.y + 1, m: 0 } : { y: miniMonth.y, m: miniMonth.m + 1 };

  const gridH = (HOUR_END - HOUR_START) * HOUR_H;

  return (
    <SiteShell>
      <div className="mx-auto flex max-w-[1400px] flex-col gap-4 px-3 py-4 sm:px-5 lg:flex-row lg:gap-0">
        {/* Sidebar */}
        <aside className="shrink-0 space-y-5 rounded-2xl border border-mora-beige-100 bg-white p-4 shadow-soft lg:w-56 lg:rounded-r-none lg:border-r-0">
          <div>
            <h1 className="font-display text-xl font-semibold text-mora-brown-800">Plans</h1>
            <p className="font-body mt-0.5 text-xs text-mora-brown-500">Shared hangouts</p>
          </div>
          <MiniMonth
            year={miniMonth.y}
            month={miniMonth.m}
            selected={anchor}
            today={today}
            showNav
            onSelect={(d) => {
              setAnchor(d);
              setMiniMonth({ y: d.getFullYear(), m: d.getMonth() });
            }}
            onPrev={() =>
              setMiniMonth((m) =>
                m.m === 0 ? { y: m.y - 1, m: 11 } : { y: m.y, m: m.m - 1 }
              )
            }
            onNext={() =>
              setMiniMonth((m) =>
                m.m === 11 ? { y: m.y + 1, m: 0 } : { y: m.y, m: m.m + 1 }
              )
            }
          />
          <div className="hidden border-t border-mora-beige-100 pt-4 sm:block">
            <MiniMonth
              year={nextMonth.y}
              month={nextMonth.m}
              selected={anchor}
              today={today}
              onSelect={(d) => {
                setAnchor(d);
                setMiniMonth({ y: d.getFullYear(), m: d.getMonth() });
              }}
            />
          </div>
          <div className="border-t border-mora-beige-100 pt-3 font-body text-xs text-mora-brown-600">
            <p className="mb-2 font-medium text-mora-brown-500">Calendars</p>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked readOnly className="accent-mora-brown-600" />
              Shared (Moon + Fox)
            </label>
          </div>
          <button
            type="button"
            className="mora-btn-primary w-full text-sm"
            onClick={() => openCreate(new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate(), 10, 0))}
          >
            + New plan
          </button>
        </aside>

        {/* Week view */}
        <section className="min-w-0 flex-1 overflow-hidden rounded-2xl border border-mora-beige-100 bg-white shadow-soft lg:rounded-l-none">
          <div className="flex flex-wrap items-center gap-2 border-b border-mora-beige-100 px-3 py-2.5 sm:px-4">
            <button
              type="button"
              className="mora-btn !px-3 !py-1.5 text-xs"
              onClick={() => {
                setAnchor(today);
                setMiniMonth({ y: today.getFullYear(), m: today.getMonth() });
              }}
            >
              Today
            </button>
            <button
              type="button"
              className="rounded-lg px-2 py-1 text-mora-brown-600 hover:bg-mora-beige-50"
              onClick={() => setAnchor(addDays(weekStart, -7))}
              aria-label="Previous week"
            >
              ‹
            </button>
            <button
              type="button"
              className="rounded-lg px-2 py-1 text-mora-brown-600 hover:bg-mora-beige-50"
              onClick={() => setAnchor(addDays(weekStart, 7))}
              aria-label="Next week"
            >
              ›
            </button>
            <h2 className="font-display text-base font-semibold text-mora-brown-800 sm:text-lg">
              {formatWeekRange(weekStart)}
            </h2>
            <span className="ml-auto font-body text-xs text-mora-brown-400">Week</span>
          </div>

          {error && (
            <p className="font-body border-b border-red-100 bg-red-50 px-4 py-2 text-sm text-red-700">
              {error}
            </p>
          )}
          {loading && (
            <p className="font-body px-4 py-8 text-center text-mora-brown-400">Loading…</p>
          )}

          {!loading && (
            <div className="overflow-x-auto">
              <div className="min-w-[720px]">
                {/* Day headers */}
                <div className="grid grid-cols-[3.5rem_repeat(7,minmax(0,1fr))] border-b border-mora-beige-100">
                  <div />
                  {days.map((day) => {
                    const isToday = sameDay(day, today);
                    const isSelected = sameDay(day, anchor);
                    return (
                      <button
                        key={day.toISOString()}
                        type="button"
                        onClick={() => setAnchor(day)}
                        className={`border-l border-mora-beige-100 px-2 py-2 text-center font-body ${
                          isToday ? 'bg-mora-beige-50' : ''
                        } ${isSelected ? 'ring-inset ring-1 ring-mora-brown-400' : ''}`}
                      >
                        <div className="text-[10px] uppercase tracking-wide text-mora-brown-400">
                          {day.toLocaleDateString('en-US', { weekday: 'short' })}
                        </div>
                        <div
                          className={`mx-auto mt-0.5 flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${
                            isToday
                              ? 'bg-mora-brown-600 text-white'
                              : 'text-mora-brown-800'
                          }`}
                        >
                          {day.getDate()}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Time grid */}
                <div className="grid grid-cols-[3.5rem_repeat(7,minmax(0,1fr))]">
                  <div className="relative" style={{ height: gridH }}>
                    {HOURS.map((h) => (
                      <div
                        key={h}
                        className="absolute right-1 -translate-y-1/2 font-body text-[10px] text-mora-brown-400"
                        style={{ top: (h - HOUR_START) * HOUR_H }}
                      >
                        {formatHour(h)}
                      </div>
                    ))}
                  </div>

                  {days.map((day) => (
                    <div
                      key={day.toISOString()}
                      className="relative border-l border-mora-beige-100"
                      style={{ height: gridH }}
                    >
                      {HOURS.map((h) => (
                        <button
                          key={h}
                          type="button"
                          aria-label={`Add plan ${formatHour(h)}`}
                          className="absolute left-0 right-0 w-full border-t border-mora-beige-50 hover:bg-mora-beige-50/80"
                          style={{ top: (h - HOUR_START) * HOUR_H, height: HOUR_H }}
                          onClick={() => onSlotClick(day, h)}
                        />
                      ))}

                      {plans
                        .filter((p) => sameDay(new Date(p.starts_at), day))
                        .map((plan) => {
                          const start = new Date(plan.starts_at);
                          const minutes = start.getHours() * 60 + start.getMinutes();
                          const top =
                            ((minutes - HOUR_START * 60) / 60) * HOUR_H;
                          const height = DEFAULT_HOURS * HOUR_H - 4;
                          if (top + height < 0 || top > gridH) return null;
                          return (
                            <button
                              key={plan.id}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelected(plan);
                              }}
                              className={`absolute left-0.5 right-0.5 z-10 overflow-hidden rounded-md border px-1.5 py-1 text-left shadow-sm transition hover:brightness-95 ${STATUS_STYLE[plan.status]}`}
                              style={{
                                top: Math.max(0, top),
                                height: Math.max(28, height),
                              }}
                            >
                              <p className="truncate font-body text-[11px] font-semibold leading-tight">
                                {plan.note?.trim() || 'Hangout'}
                              </p>
                              <p className="truncate font-body text-[10px] opacity-80">
                                {authorEmoji(plan.proposed_by)} {STATUS_LABEL[plan.status]}
                              </p>
                            </button>
                          );
                        })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </section>
      </div>

      <PlanModal open={createOpen} title="New plan" onClose={() => setCreateOpen(false)}>
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="mb-1 block font-body text-sm text-mora-brown-600">When</label>
            <input
              type="datetime-local"
              required
              className="mora-input"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block font-body text-sm text-mora-brown-600">Note</label>
            <textarea
              className="mora-textarea min-h-[100px]"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Coffee, walk, movie…"
            />
          </div>
          <button type="submit" className="mora-btn-primary text-sm" disabled={busy || !identity}>
            {busy ? 'Saving…' : 'Propose'}
          </button>
        </form>
      </PlanModal>

      <PlanModal
        open={!!selected}
        title="Plan"
        onClose={() => setSelected(null)}
      >
        {selected && (
          <div className="space-y-4 font-body text-sm text-mora-brown-700">
            <div>
              <p className="font-display text-lg font-semibold text-mora-brown-800">
                {selected.note?.trim() || 'Hangout'}
              </p>
              <p className="mt-1 text-mora-brown-500">{formatDate(selected.starts_at)}</p>
              <p className="mt-1">
                {authorEmoji(selected.proposed_by)} {authorLabel(selected.proposed_by)} ·{' '}
                {STATUS_LABEL[selected.status]}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {selected.status === 'pending' &&
                identity &&
                selected.proposed_by !== identity && (
                  <>
                    <button
                      type="button"
                      className="mora-btn-primary text-sm"
                      disabled={busy}
                      onClick={() => respond(selected.id, 'accept')}
                    >
                      Accept
                    </button>
                    <button
                      type="button"
                      className="mora-btn text-sm"
                      disabled={busy}
                      onClick={() => respond(selected.id, 'decline')}
                    >
                      Decline
                    </button>
                  </>
                )}
              <button
                type="button"
                className="mora-btn border-red-200 text-sm text-red-700"
                disabled={busy}
                onClick={() => remove(selected.id)}
              >
                Delete
              </button>
            </div>
          </div>
        )}
      </PlanModal>
    </SiteShell>
  );
}
