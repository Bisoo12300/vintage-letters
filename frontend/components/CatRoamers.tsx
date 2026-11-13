'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Cat, type CatPose } from '@/components/Cat';
import { useIdentity } from '@/components/IdentityGate';
import { apiFetch, PETS_CHANGED, type PetsState } from '@/lib/api';
import type { AuthorId } from '@/lib/identity';

/** Where a cat is on screen (x in % of the width), which way it faces and what it is doing. */
type Act = { x: number; face: 1 | -1; pose: CatPose; ms: number };
type Acts = Record<AuthorId, Act>;
/** One beat of a little scene: what changes, and how long before the next beat. */
type Frame = { acts: Partial<Record<AuthorId, Partial<Act>>>; hold: number };

const OWNERS: AuthorId[] = ['moon', 'sun'];
/** Width in px per growth stage (nest, 2 months, 6 months, adult) */
const SIZE = [60, 60, 70, 80];

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const clamp = (x: number) => Math.min(90, Math.max(10, x));
const walkMs = (from: number, to: number) => 400 + Math.abs(to - from) * 70;
const walk = (cur: Act, to: number): Partial<Act> => ({ x: to, face: to >= cur.x ? 1 : -1, pose: 'walk', ms: walkMs(cur.x, to) });

/** A cat on its own: wander, roll over, ask for attention, or just sit. */
function solo(owner: AuthorId, cur: Act): Frame[] {
  const r = Math.random();
  if (r < 0.45) {
    const step = walk(cur, clamp(cur.x + rand(-35, 35)));
    return [
      { acts: { [owner]: step }, hold: step.ms! },
      { acts: { [owner]: { pose: 'sit' } }, hold: rand(1500, 3500) },
    ];
  }
  if (r < 0.62) {
    const dir = cur.x > 50 ? -1 : 1;
    return [
      { acts: { [owner]: { x: clamp(cur.x + dir * 12), face: dir, pose: 'roll', ms: 1300 } }, hold: 1500 },
      { acts: { [owner]: { pose: 'sit' } }, hold: 1500 },
    ];
  }
  if (r < 0.72) return [{ acts: { [owner]: { pose: 'beg' } }, hold: 2600 }];
  if (r < 0.82) return [{ acts: { [owner]: { pose: 'lick' } }, hold: 3200 }];
  if (r < 0.9) return [{ acts: { [owner]: { pose: 'stretch' } }, hold: 2400 }];
  if (r < 0.95) return [{ acts: { [owner]: { pose: 'sleep' } }, hold: 6000 }]; // a quick nap
  return [{ acts: { [owner]: { pose: 'sit' } }, hold: rand(2000, 4000) }];
}

/** Two cats in one house: meet and cuddle, chase each other, or each do their own thing. */
function together(cur: Acts): Frame[] {
  const r = Math.random();
  if (r < 0.45) {
    const mid = clamp(rand(25, 75));
    const moon = walk(cur.moon, mid - 5);
    const sun = walk(cur.sun, mid + 5);
    return [
      { acts: { moon, sun }, hold: Math.max(moon.ms!, sun.ms!) },
      { acts: { moon: { face: 1, pose: 'cuddle' }, sun: { face: -1, pose: 'cuddle' } }, hold: 5200 },
    ];
  }
  if (r < 0.7) {
    const [leader, chaser] = Math.random() < 0.5 ? OWNERS : [...OWNERS].reverse();
    const to = clamp(rand(15, 85));
    const lead = walk(cur[leader], to);
    const follow = walk(cur[chaser], clamp(to + (cur[chaser].x < to ? -9 : 9)));
    return [
      { acts: { [leader]: lead, [chaser]: follow }, hold: Math.max(lead.ms!, follow.ms!) },
      { acts: { [leader]: { pose: 'sit' }, [chaser]: { pose: 'pounce', face: follow.x! < to ? 1 : -1 } }, hold: 1250 },
      { acts: { moon: { pose: 'sit' }, sun: { pose: 'sit' } }, hold: 1200 },
    ];
  }
  const a = solo('moon', cur.moon);
  const b = solo('sun', cur.sun);
  return [
    { acts: { ...a[0].acts, ...b[0].acts }, hold: Math.max(a[0].hold, b[0].hold) },
    { acts: { moon: { pose: 'sit' }, sun: { pose: 'sit' } }, hold: 1200 },
  ];
}

/** Each page mounts its own shell, so where the cats were is remembered here across tab changes. */
let memory: { acts: Acts; anchor: number } | null = null;

/**
 * The cats that are at your house, wandering along the bottom of whatever tab
 * you are on. They follow you when you change tab (`anchor` = where the active
 * tab sits, in % of the width) and tapping one opens the pets page.
 */
export function CatRoamers({ anchor }: { anchor: number }) {
  const { identity } = useIdentity();
  const pathname = usePathname();
  const router = useRouter();
  const [pets, setPets] = useState<PetsState | null>(null);
  const [acts, setActs] = useState<Acts>(
    () => memory?.acts ?? { moon: { x: 32, face: 1, pose: 'sit', ms: 0 }, sun: { x: 66, face: -1, pose: 'sit', ms: 0 } }
  );
  const actsRef = useRef(acts);
  const anchorRef = useRef(anchor);
  anchorRef.current = anchor;

  const load = useCallback(() => {
    if (!identity) return;
    apiFetch<PetsState>('/pets', { author: identity })
      .then(setPets)
      .catch(() => {});
  }, [identity]);

  useEffect(() => {
    load();
    window.addEventListener('focus', load);
    window.addEventListener(PETS_CHANGED, load);
    return () => {
      window.removeEventListener('focus', load);
      window.removeEventListener(PETS_CHANGED, load);
    };
  }, [load]);

  const hidden = pathname === '/pets'; // the pets page shows them full size
  const here = identity && pets ? OWNERS.filter((o) => pets.cats[o].location === identity) : [];
  const moversKey = here.join();
  const asleep = here.some((o) => pets!.cats[o].asleep);

  useEffect(() => {
    if (!moversKey || hidden || asleep) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const owners = moversKey.split(',') as AuthorId[];
    let stopped = false;
    let timer = 0;

    const play = (frames: Frame[]) => {
      if (stopped) return;
      window.clearTimeout(timer);
      const [frame, ...rest] = frames.length
        ? frames
        : owners.length === 2
          ? together(actsRef.current)
          : solo(owners[0], actsRef.current[owners[0]]);
      const next = { ...actsRef.current };
      for (const o of owners) if (frame.acts[o]) next[o] = { ...next[o], ...frame.acts[o] };
      actsRef.current = next;
      memory = { acts: next, anchor: anchorRef.current };
      setActs(next);
      timer = window.setTimeout(() => play(rest), frame.hold);
    };

    // You changed tab: the cats trot over to sit under the tab you picked
    const to = anchorRef.current;
    const steps = owners.map((o, i) => [o, walk(actsRef.current[o], clamp(to + (owners.length === 2 ? (i ? 6 : -6) : 0)))] as const);
    const follow: Frame[] =
      memory && memory.anchor !== to
        ? [
            { acts: Object.fromEntries(steps), hold: Math.max(...steps.map(([, step]) => step.ms!)) },
            { acts: Object.fromEntries(owners.map((o) => [o, { pose: 'sit' as const }])), hold: 1800 },
          ]
        : [];
    timer = window.setTimeout(() => play(follow), 400);
    return () => {
      stopped = true;
      window.clearTimeout(timer);
    };
  }, [moversKey, hidden, asleep]);

  if (!identity || !pets || hidden || here.length === 0) return null;

  return (
    <div className="cat-roam">
      {here.map((o) => {
        const cat = pets.cats[o];
        const act = acts[o];
        const pose: CatPose = cat.asleep ? 'sleep' : act.pose;
        const mood = pets.today[o];
        const moving = act.pose === 'walk' || act.pose === 'roll';
        // What the cat has on its mind, most pressing first
        const bubble =
          pose === 'sleep'
            ? null
            : pose === 'cuddle'
              ? '💕'
              : cat.hungry
                ? '🐟'
                : mood
                  ? mood.emoji
                  : o === identity
                    ? 'How was your day?'
                    : null;
        return (
          <div
            key={o}
            className="cat-actor"
            style={{ left: `${act.x}%`, width: SIZE[cat.stage.index], transitionDuration: `${moving ? act.ms : 0}ms` }}
          >
            {bubble && (
              <span
                key={bubble}
                className={`cat-bubble cat-bubble--${o}${bubble === '💕' ? ' cat-bubble--heart' : ''}`}
                style={bubble.length > 4 ? { fontSize: 11, fontWeight: 600 } : undefined}
              >
                {bubble}
              </span>
            )}
            <button
              type="button"
              onClick={() => router.push('/pets')}
              aria-label={`${cat.name}${cat.hungry ? ' is hungry' : ''}. Open the pets page`}
              className="block w-full"
              style={{ transform: `scaleX(${act.face})` }}
            >
              {/* The nest stays on the pets page: out here a newborn is drawn as a kitten so it can walk */}
              <Cat owner={o} stage={cat.stage.index || 1} pose={pose} pouch letter={o !== identity} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
