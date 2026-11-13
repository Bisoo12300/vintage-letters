'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { SiteShell } from '@/components/SiteShell';
import { AuthorGlyph, PigeonLoader } from '@/components/brand';
import { Cat, Room, type CatPose } from '@/components/Cat';
import { ComposeWindow } from '@/components/ComposeWindow';
import { useIdentity } from '@/components/IdentityGate';
import { PlanModal } from '@/components/plans/PlanModal';
import { apiFetch, PETS_CHANGED, type CatState, type MoodEntry, type PetsState } from '@/lib/api';
import { authorLabel, type AuthorId } from '@/lib/identity';

const NOTE_MAX = 140;
const HISTORY_DAYS = 14;
const OWNERS: AuthorId[] = ['moon', 'sun'];
/** Cat size per growth stage: px on a phone-wide room; it scales with the room up to 1.4x */
const SIZE = [128, 118, 138, 156];

function ago(iso: string) {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  return hours < 24 ? `${hours}h ago` : `${Math.round(hours / 24)}d ago`;
}

/** The last `count` calendar days ending at `day` (YYYY-MM-DD), oldest first. */
function lastDays(day: string, count: number) {
  const out: string[] = [];
  const d = new Date(`${day}T12:00:00Z`);
  for (let i = 0; i < count; i++) {
    out.unshift(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return out;
}

function Meter({ label, value, hint, color }: { label: string; value: number; hint?: string; color: string }) {
  return (
    <div>
      <div className="mb-1 flex justify-between gap-2 font-body text-[12px] font-semibold text-ink-500">
        <span>{label}</span>
        <span>{hint ?? `${value}%`}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-ink-800/[0.08]" role="meter" aria-label={label} aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
        <span className="meter-fill" style={{ width: `${value}%`, background: color }} />
      </div>
    </div>
  );
}

export default function PetsPage() {
  const { identity } = useIdentity();
  const [pets, setPets] = useState<PetsState | null>(null);
  const [history, setHistory] = useState<MoodEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [feedNote, setFeedNote] = useState('');
  const [busy, setBusy] = useState('');
  const [eating, setEating] = useState<AuthorId | null>(null);
  const [petted, setPetted] = useState<{ owner: AuthorId; n: number } | null>(null);
  /** Counts taps on the hint bubble: each one scatters it into droplets that gather again */
  const [burst, setBurst] = useState(0);
  const [emoji, setEmoji] = useState('');
  const [note, setNote] = useState('');
  const [editingMood, setEditingMood] = useState(false);
  const [moodError, setMoodError] = useState('');
  const [naming, setNaming] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [openDay, setOpenDay] = useState<string | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [checkinOpen, setCheckinOpen] = useState(false);
  const historyRef = useRef<HTMLDivElement>(null);
  const timers = useRef<number[]>([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const load = useCallback(async () => {
    if (!identity) return;
    const [state, moods] = await Promise.all([
      apiFetch<PetsState>('/pets', { author: identity }),
      apiFetch<MoodEntry[]>(`/pets/moods?days=${HISTORY_DAYS}`, { author: identity }),
    ]);
    setPets(state);
    setHistory(moods);
  }, [identity]);

  useEffect(() => {
    if (!identity) return;
    setLoading(true);
    setError('');
    load()
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not find the cats'))
      .finally(() => setLoading(false));
    // Cats get hungry and move house while the page is open: refresh on return and after a letter
    const refresh = () => load().catch(() => {});
    window.addEventListener('focus', refresh);
    window.addEventListener(PETS_CHANGED, refresh);
    return () => {
      window.removeEventListener('focus', refresh);
      window.removeEventListener(PETS_CHANGED, refresh);
    };
  }, [identity, load]);

  const loaded = pets !== null;
  const openCheckin = useCallback(() => setCheckinOpen(true), []);
  const closeCheckin = useCallback(() => {
    setCheckinOpen(false);
    setEditingMood(false);
    setMoodError('');
    setEmoji('');
    setNote('');
  }, []);

  // On narrow screens the two weeks scroll sideways: start at today, on the right
  useEffect(() => {
    const el = historyRef.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [loaded]);

  // Opened from the 18:00 notification: go straight to the question
  useEffect(() => {
    if (!loaded || new URLSearchParams(window.location.search).get('checkin') !== '1') return;
    openCheckin();
    const url = new URL(window.location.href);
    url.searchParams.delete('checkin');
    window.history.replaceState({}, '', url.pathname + url.search);
  }, [loaded, openCheckin]);

  if (!identity) return null;
  const partnerId: AuthorId = identity === 'moon' ? 'sun' : 'moon';
  const partnerName = authorLabel(partnerId);
  const mine = pets?.today[identity] ?? null;
  const showMoodForm = !mine || editingMood;

  async function feed(owner: AuthorId) {
    if (busy) return;
    setBusy(`feed-${owner}`);
    setFeedNote('');
    try {
      setPets(await apiFetch<PetsState>(`/pets/${owner}/feed`, { method: 'POST', author: identity }));
      setEating(owner);
      timers.current.push(window.setTimeout(() => setEating(null), 1700));
      window.dispatchEvent(new Event(PETS_CHANGED));
    } catch (err) {
      setFeedNote(err instanceof Error ? err.message : 'Could not feed the cat');
    } finally {
      setBusy('');
    }
  }

  async function sendMood(e: React.FormEvent) {
    e.preventDefault();
    if (!emoji || busy) return;
    setBusy('mood');
    setMoodError('');
    try {
      setPets(await apiFetch<PetsState>('/pets/mood', { method: 'PUT', author: identity, body: JSON.stringify({ emoji, note }) }));
      setEditingMood(false);
      setCheckinOpen(false);
      setPetted((p) => ({ owner: identity!, n: (p?.n ?? 0) + 1 }));
      setHistory(await apiFetch<MoodEntry[]>(`/pets/moods?days=${HISTORY_DAYS}`, { author: identity }));
      window.dispatchEvent(new Event(PETS_CHANGED));
    } catch (err) {
      setMoodError(err instanceof Error ? err.message : 'Could not send your mood');
    } finally {
      setBusy('');
    }
  }

  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy('name');
    try {
      setPets(await apiFetch<PetsState>('/pets/name', { method: 'PUT', author: identity, body: JSON.stringify({ name: nameDraft }) }));
      setNaming(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not rename your cat');
    } finally {
      setBusy('');
    }
  }

  const label = (e: string) => pets?.moods.find((m) => m.emoji === e)?.label ?? '';
  const byDay = (day: string, who: AuthorId) => history.find((m) => m.day === day && m.author === who);
  const days = pets ? lastDays(pets.day, HISTORY_DAYS) : [];

  /** A room: the cats that are there, their bubbles, and how to care for them. Only your own house is ever shown. */
  function house(p: PetsState, houseOwner: AuthorId) {
    const cats = OWNERS.filter((o) => p.cats[o].location === houseOwner).map((o) => p.cats[o]);
    const isMine = houseOwner === identity;
    const pair = cats.length === 2;
    const away = p.cats[houseOwner];
    // Letters go in a cat's pouch: a visiting cat carries your reply home, otherwise your own cat takes it over
    const carrier = cats.find((c) => c.owner !== houseOwner) ?? cats[0];

    const poseOf = (cat: CatState): CatPose => (cat.asleep ? 'sleep' : eating === cat.owner ? 'eat' : pair ? 'cuddle' : 'sit');

    return (
      <section key={houseOwner} className="glass-card !p-4 sm:!p-5">
        <h2 className="mb-3 flex items-center gap-2 px-1 font-display text-2xl font-semibold text-ink-800">
          <AuthorGlyph author={houseOwner} className="h-5 w-5" />
          {isMine ? 'Your house' : `${authorLabel(houseOwner)}'s house`}
        </h2>

        {/* The cats watch your finger: --lx/--ly (-1..1) say where it is in the room */}
        <div
          className="house"
          onPointerMove={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            e.currentTarget.style.setProperty('--lx', String(((e.clientX - r.left) / r.width) * 2 - 1));
            e.currentTarget.style.setProperty('--ly', String(((e.clientY - r.top) / r.height) * 2 - 1));
          }}
          onPointerLeave={(e) => {
            e.currentTarget.style.setProperty('--lx', '0');
            e.currentTarget.style.setProperty('--ly', '0');
          }}
        >
          <Room owner={houseOwner} fed={cats.some((c) => c.fullness > 40)} />
          {cats.length === 0 ? (
            <p className="glass absolute inset-x-8 top-[38%] rounded-2xl px-4 py-3 text-center font-body text-[14px] font-medium text-ink-700">
              Nobody home. {away.name} is at {authorLabel(away.location)}&apos;s house.
            </p>
          ) : (
            <>
            <div className="absolute inset-x-0 bottom-[5%] flex items-end justify-center">
              {pair && !cats[0].asleep && (
                <span className="cat-bubble cat-bubble--heart" style={{ bottom: '72%' }} aria-hidden>
                  💕
                </span>
              )}
              {cats.map((cat, i) => {
                const pose = poseOf(cat);
                const mood = p.today[cat.owner];
                const side = pair ? (i === 0 ? 'cat-bubble--left' : 'cat-bubble--right') : '';
                return (
                  <div key={cat.owner} className="relative" style={{ width: `${SIZE[cat.stage.index] / 3.3}%`, maxWidth: SIZE[cat.stage.index] * 1.4, marginInline: pair ? -6 : 0 }}>
                    {/* Sticker bubble sits on the cat and points down at it */}
                    <div className={`cat-bubble cat-bubble--say cat-bubble--${cat.owner} ${side} font-display`}>
                      <span className="mb-0.5 flex items-center gap-1 text-[11px] font-semibold text-ink-500">
                        <AuthorGlyph author={cat.owner} className="h-3 w-3" />
                        {cat.name}
                      </span>
                      {mood ? (
                        cat.owner === identity ? (
                          <button
                            type="button"
                            onClick={() => {
                              setEmoji(mood.emoji);
                              setNote(mood.note);
                              setEditingMood(false);
                              openCheckin();
                            }}
                            className="text-left"
                          >
                            <span className="mr-1 text-[18px] leading-none">{mood.emoji}</span>
                            {mood.note || label(mood.emoji)}
                          </button>
                        ) : (
                          <>
                            <span className="mr-1 text-[18px] leading-none">{mood.emoji}</span>
                            {mood.note || label(mood.emoji)}
                          </>
                        )
                      ) : cat.owner === identity ? (
                        <button type="button" onClick={openCheckin} className="font-semibold text-ink-800 underline decoration-ink-300 underline-offset-2">
                          How was your day?
                        </button>
                      ) : (
                        <span className="text-ink-500">Waiting for {authorLabel(cat.owner)}&apos;s day…</span>
                      )}
                      {cat.hungry && !cat.asleep && <span className="mt-0.5 block font-semibold text-sun-deep">🐟 I&apos;m hungry!</span>}
                    </div>
                    {petted?.owner === cat.owner && (
                      <div key={petted.n} className="pointer-events-none absolute inset-0" aria-hidden>
                        {['💗', '💕', '💗'].map((h, k) => (
                          <span key={k} className="cat-heart" style={{ left: `${30 + k * 20}%`, top: '10%', '--x': `${(k - 1) * 16}px`, '--t': `${k * 0.12}s` } as React.CSSProperties}>
                            {h}
                          </span>
                        ))}
                      </div>
                    )}
                    {cat === carrier && (
                      <button
                        type="button"
                        className={`cat-hint font-display ${pair && i === 0 ? 'cat-hint--left' : 'cat-hint--right'}`}
                        onClick={() => setBurst((n) => n + 1)}
                        aria-label="Pop the bubble"
                      >
                        <span key={burst} className={`cat-hint-body ${burst ? 'is-burst' : ''}`}>
                          Tap me
                          <br />
                          💌
                        </span>
                        {burst > 0 && (
                          <span key={`drops-${burst}`} aria-hidden>
                            {Array.from({ length: 9 }, (_, k) => {
                              const a = (k / 9) * Math.PI * 2;
                              const r = 30 + (k % 3) * 9;
                              return (
                                <i
                                  key={k}
                                  className="cat-hint-drop"
                                  style={{ '--dx': `${Math.cos(a) * r}px`, '--dy': `${Math.sin(a) * r}px`, '--s': 0.6 + (k % 3) * 0.3 } as React.CSSProperties}
                                />
                              );
                            })}
                          </span>
                        )}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setPetted((prev) => ({ owner: cat.owner, n: (prev?.n ?? 0) + 1 }));
                        setComposeOpen(true);
                      }}
                      aria-label={`Put a letter in ${cat.name}'s pouch`}
                      className="block w-full"
                      style={{ transform: pair && i === 1 ? 'scaleX(-1)' : undefined }}
                    >
                      <Cat owner={cat.owner} stage={cat.stage.index} pose={pose} pouch letter={cat.location !== cat.owner} />
                    </button>
                  </div>
                );
              })}
            </div>
            </>
          )}
        </div>

        <div className={`mt-4 grid gap-3 ${isMine ? 'sm:grid-cols-2' : cats.length > 1 ? 'sm:grid-cols-2' : ''}`}>
          <div className={cats.length > 1 && isMine ? 'space-y-3' : 'contents'}>
            {cats.map((cat) => (
              <div key={cat.owner} className="rounded-2xl bg-white/50 p-4">
                <div className="flex items-start justify-between gap-2">
                  {naming && cat.owner === identity ? (
                    <form onSubmit={saveName} className="flex flex-1 gap-2">
                      <input className="field min-h-9 py-1.5 text-[15px]" value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} maxLength={24} aria-label="Cat name" autoFocus />
                      <button type="submit" className="btn-primary min-h-9 px-3 text-[13px]" disabled={busy === 'name' || !nameDraft.trim()}>
                        Save
                      </button>
                    </form>
                  ) : (
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 font-body text-[16px] font-semibold text-ink-800">
                        <AuthorGlyph author={cat.owner} className="h-4 w-4 shrink-0" />
                        <span className="truncate">{cat.name}</span>
                        {cat.owner === identity && (
                          <button
                            type="button"
                            onClick={() => {
                              setNameDraft(cat.name);
                              setNaming(true);
                            }}
                            className="font-body text-[12px] font-medium text-ink-400 underline underline-offset-2 hover:text-ink-700"
                          >
                            rename
                          </button>
                        )}
                      </p>
                      <p className="font-body text-[13px] text-ink-500">
                        {cat.stage.label}
                        {cat.location !== cat.owner && ' · visiting'}
                      </p>
                    </div>
                  )}
                </div>
                <div className="mt-3 space-y-2.5">
                  <Meter label="Full" value={cat.fullness} color="linear-gradient(90deg, #f6c56b, #e58a2e)" />
                  <Meter
                    label="Growing"
                    value={cat.stage.progress}
                    hint={cat.stage.next === null ? 'Grown up' : `${cat.xp}/${cat.stage.next}`}
                    color="linear-gradient(90deg, #a9b5ee, #6f7fd0)"
                  />
                </div>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <p className="font-body text-[12px] text-ink-400">
                    {cat.last_fed_at && cat.last_fed_by ? `${authorLabel(cat.last_fed_by)} fed ${ago(cat.last_fed_at)}` : 'Not fed yet'}
                  </p>
                  {isMine ? (
                    <button type="button" className="btn-primary min-h-9 px-4 text-[14px]" onClick={() => feed(cat.owner)} disabled={!cat.canFeed || busy === `feed-${cat.owner}`}>
                      {cat.canFeed ? 'Feed 🐟' : 'Full'}
                    </button>
                  ) : (
                    <span className="font-body text-[12px] text-ink-400">{authorLabel(houseOwner)} feeds here</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {isMine && (
            <div className="rounded-2xl bg-white/50 p-4">
              <h3 className="font-display text-xl font-semibold text-ink-800">The last two weeks</h3>
              <div ref={historyRef} className="-mx-1 mt-3 overflow-x-auto px-1 pb-1">
                <div className="grid min-w-[18rem] grid-cols-[auto_repeat(14,minmax(0,1fr))] items-center gap-y-1 text-center">
                  <span />
                  {days.map((d) => (
                    <span key={d} className={`font-body text-[10px] font-semibold ${d === p.day ? 'text-ink-800' : 'text-ink-400'}`}>
                      {new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'narrow', timeZone: 'UTC' })}
                    </span>
                  ))}
                  {OWNERS.map((who) => (
                    <div key={who} className="contents">
                      <AuthorGlyph author={who} className="mr-1 h-4 w-4" />
                      {days.map((d) => {
                        const m = byDay(d, who);
                        return (
                          <button
                            key={d}
                            type="button"
                            onClick={() => setOpenDay(openDay === d ? null : d)}
                            className={`mx-auto flex h-7 w-7 items-center justify-center rounded-full text-[15px] transition ${openDay === d ? 'bg-white shadow-sm' : 'hover:bg-white/60'}`}
                            aria-label={`${authorLabel(who)}, ${d}: ${m ? label(m.emoji) : 'no check-in'}`}
                          >
                            {m ? m.emoji : <span className="h-1.5 w-1.5 rounded-full bg-ink-800/15" />}
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
              {openDay && (
                <div className="animate-fade-in-up mt-2 space-y-1.5">
                  <p className="font-body text-[12px] font-semibold text-ink-500">
                    {new Date(`${openDay}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'UTC' })}
                  </p>
                  {OWNERS.map((who) => {
                    const m = byDay(openDay, who);
                    return (
                      <p key={who} className="flex items-start gap-2 rounded-xl bg-white/70 px-2.5 py-1.5 font-body text-[13px] text-ink-700">
                        <AuthorGlyph author={who} className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        <span className="min-w-0 break-words">{m ? `${m.emoji} ${label(m.emoji)}${m.note ? ` — ${m.note}` : ''}` : 'No check-in'}</span>
                      </p>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
        {isMine && feedNote && (
          <p className="mt-2 text-right font-body text-[13px] text-rose" role="status">
            {feedNote}
          </p>
        )}
      </section>
    );
  }

  return (
    <SiteShell>
      <div className="mx-auto max-w-2xl px-4 pt-10 sm:px-8 sm:pt-16">
        <header className="animate-fade-in-up mb-8 flex flex-wrap items-end justify-between gap-4 px-1">
          <div>
            <h1 className="title-shine font-display text-[2.75rem] font-semibold leading-none tracking-[-0.02em] text-ink-800 sm:text-6xl">Pets</h1>
            <p className="mt-3 font-body text-[17px] text-ink-500">One kitten each. They carry your letters between the two houses.</p>
          </div>
          {pets && (
            <span className="chip" title="Days in a row you both checked in">
              🔥 {pets.streak} {pets.streak === 1 ? 'day' : 'days'}
            </span>
          )}
        </header>

        {loading && (
          <div className="flex justify-center py-16">
            <PigeonLoader label="Looking for the cats…" />
          </div>
        )}
        {error && <p className="mb-4 text-center font-body text-[14px] text-rose">{error}</p>}

        {pets && (
          <div className="stagger space-y-6">
            {house(pets, identity)}
          </div>
        )}
      </div>

      <ComposeWindow open={composeOpen} onClose={() => setComposeOpen(false)} />

      <PlanModal open={checkinOpen} title="How was your day?" onClose={closeCheckin} className="max-w-lg">
        {pets && (
          <>
            <p className="font-body text-[14px] text-ink-500">
              {pets.cats[identity].name} shows it in its bubble for {partnerName}. You can change it until midnight.
            </p>

            {showMoodForm ? (
              <form onSubmit={sendMood} className="mt-5 space-y-4">
                <div className="grid grid-cols-4 gap-2" role="group" aria-label="Your mood">
                  {pets.moods.map((m) => {
                    const active = emoji === m.emoji;
                    return (
                      <button
                        key={m.emoji}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setEmoji(m.emoji)}
                        className={`flex flex-col items-center gap-1 rounded-2xl py-3 transition duration-300 ease-spring active:scale-90 ${
                          active ? 'scale-105 bg-white shadow-[0_6px_18px_-6px_rgba(35,40,88,0.35)] ring-2 ring-ink-800' : 'bg-white/45 hover:bg-white/75'
                        }`}
                      >
                        <span className="text-[28px] leading-none">{m.emoji}</span>
                        <span className="font-body text-[12px] font-medium text-ink-600">{m.label}</span>
                      </button>
                    );
                  })}
                </div>
                <label className="block">
                  <span className="mb-2 flex justify-between font-body text-[13px] font-semibold text-ink-500">
                    <span>A few words (optional)</span>
                    <span className={[...note].length > NOTE_MAX - 20 ? 'text-rose' : ''}>
                      {[...note].length}/{NOTE_MAX}
                    </span>
                  </span>
                  <textarea
                    className="field min-h-[88px] resize-none font-letter leading-relaxed"
                    value={note}
                    onChange={(e) => setNote([...e.target.value].slice(0, NOTE_MAX).join(''))}
                    placeholder="Today I…"
                    rows={3}
                  />
                </label>
                {moodError && <p className="font-body text-[14px] text-rose">{moodError}</p>}
                <div className="flex gap-2">
                  <button type="submit" className="btn-primary" disabled={!emoji || busy === 'mood'}>
                    {busy === 'mood' ? 'Sending…' : `Tell ${pets.cats[identity].name}`}
                  </button>
                  {editingMood && (
                    <button type="button" className="btn" onClick={() => setEditingMood(false)}>
                      Cancel
                    </button>
                  )}
                </div>
              </form>
            ) : (
              mine && (
                <div className="mt-5 flex items-start gap-3 rounded-2xl bg-white/55 p-4">
                  <span className="text-[34px] leading-none">{mine.emoji}</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-body text-[14px] font-semibold text-ink-700">You · {label(mine.emoji)}</p>
                    {mine.note && <p className="mt-0.5 break-words font-letter text-[15px] text-ink-700">{mine.note}</p>}
                  </div>
                  <button
                    type="button"
                    className="btn min-h-9 px-4 text-[14px]"
                    onClick={() => {
                      setEmoji(mine.emoji);
                      setNote(mine.note);
                      setEditingMood(true);
                    }}
                  >
                    Edit
                  </button>
                </div>
              )
            )}
          </>
        )}
      </PlanModal>
    </SiteShell>
  );
}
