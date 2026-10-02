'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  apiFetch,
  groupLettersByDate,
  formatTimelineTime,
  type TimelineLetter,
} from '@/lib/api';
import { AuthorGlyph } from '@/components/brand';
import { useIdentity } from '@/components/IdentityGate';

const DRAWER_W = 320;
const CLOSED_X = -DRAWER_W;
const SNAP_OPEN = 72;

export function LetterTimelineDrawer({ currentId }: { currentId: string }) {
  const { identity } = useIdentity();
  const [letters, setLetters] = useState<TimelineLetter[]>([]);
  const [translateX, setTranslateX] = useState(CLOSED_X);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef({ startX: 0, startTx: CLOSED_X, lastX: 0, lastT: 0, velocity: 0 });

  const isOpen = translateX > CLOSED_X + SNAP_OPEN;
  const openProgress = Math.max(0, Math.min(1, (translateX - CLOSED_X) / DRAWER_W));

  useEffect(() => {
    if (!identity) return;
    apiFetch<TimelineLetter[]>('/letters/timeline', { author: identity })
      .then(setLetters)
      .catch(() => {});
  }, [identity]);

  const snap = useCallback((tx: number, velocity: number) => {
    const pulled = tx - CLOSED_X;
    // Fast flick wins over the distance threshold — like iOS's edge-swipe recognizer.
    if (Math.abs(velocity) > 0.5) {
      setTranslateX(velocity > 0 ? 0 : CLOSED_X);
    } else {
      setTranslateX(pulled >= SNAP_OPEN ? 0 : CLOSED_X);
    }
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    dragRef.current = { startX: e.clientX, startTx: translateX, lastX: e.clientX, lastT: e.timeStamp, velocity: 0 };
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging) return;
    const dx = e.clientX - dragRef.current.startX;
    const raw = dragRef.current.startTx + dx;
    // Rubber-band past either edge instead of a hard stop.
    let next: number;
    if (raw > 0) next = raw * 0.28;
    else if (raw < CLOSED_X) next = CLOSED_X + (raw - CLOSED_X) * 0.28;
    else next = raw;
    setTranslateX(next);

    const dt = e.timeStamp - dragRef.current.lastT;
    if (dt > 0) dragRef.current.velocity = (e.clientX - dragRef.current.lastX) / dt;
    dragRef.current.lastX = e.clientX;
    dragRef.current.lastT = e.timeStamp;
  };

  const onPointerUp = () => {
    if (!dragging) return;
    setDragging(false);
    snap(translateX, dragRef.current.velocity);
  };

  const close = () => setTranslateX(CLOSED_X);

  const groups = groupLettersByDate(letters);

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-ink-900/25 backdrop-blur-[3px] transition-opacity duration-300"
        style={{
          opacity: openProgress * 0.85,
          pointerEvents: isOpen ? 'auto' : 'none',
        }}
        onClick={close}
        aria-hidden={!isOpen}
      />

      <div
        className="fixed left-0 top-0 z-50 flex h-full items-center"
        style={{
          transform: `translateX(${translateX}px)`,
          transition: dragging ? 'none' : 'transform 0.55s var(--spring)',
        }}
      >
        <aside className="glass-thick flex h-full w-[320px] shrink-0 flex-col rounded-r-[2rem] border-l-0">
          <div
            className="flex-1 overflow-y-auto px-5 py-8"
            style={{
              paddingTop: 'calc(2rem + env(safe-area-inset-top))',
              paddingBottom: 'calc(2rem + env(safe-area-inset-bottom))',
            }}
          >
            {letters.length === 0 ? (
              <p className="font-body text-[15px] text-ink-400">Your letters will line up here as you write them.</p>
            ) : (
              <ol className="relative space-y-8">
                <span
                  className="absolute bottom-2 left-[7px] top-2 w-px bg-ink-200/70"
                  aria-hidden
                />
                {groups.map((group) => (
                  <li key={group.date}>
                    <p className="mb-4 font-display text-lg font-semibold text-ink-700">
                      {group.date}
                    </p>
                    <ul className="space-y-4">
                      {group.letters.map((letter) => {
                        const active = letter.id === currentId;
                        return (
                          <li key={letter.id} className="relative pl-6">
                            <span
                              className={`absolute left-0 top-2 h-[15px] w-[15px] rounded-full border-2 ${
                                active
                                  ? 'border-ink-800 bg-ink-800'
                                  : 'border-ink-300 bg-white/80'
                              }`}
                              aria-hidden
                            />
                            <Link
                              href={`/letter/${letter.id}`}
                              onClick={close}
                              className={`block rounded-2xl px-3 py-2 transition-transform duration-300 ease-spring active:scale-[0.98] ${
                                active
                                  ? 'bg-ink-800 text-white shadow-[0_8px_20px_-8px_rgba(35,40,88,0.6)]'
                                  : 'text-ink-700 hover:bg-white/60'
                              }`}
                            >
                              <p className={`flex items-center gap-1.5 font-body text-[15px] font-semibold ${active ? 'text-white' : ''}`}>
                                <AuthorGlyph author={letter.author} className="h-4 w-4 shrink-0" />
                                <span className="truncate">{letter.title}</span>
                              </p>
                              {letter.reply_to_title && (
                                <p
                                  className={`mt-0.5 font-body text-xs italic ${
                                    active ? 'text-white/70' : 'text-ink-400'
                                  }`}
                                >
                                  Re: {letter.reply_to_title}
                                </p>
                              )}
                              <p
                                className={`mt-0.5 font-body text-xs ${
                                  active ? 'text-white/70' : 'text-ink-400'
                                }`}
                              >
                                {formatTimelineTime(letter.created_at)}
                              </p>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </aside>

        {/* Glass grabber — pull to open the timeline */}
        <div
          role="slider"
          aria-label="Pull to open letter timeline"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(openProgress * 100)}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          className="flex w-11 shrink-0 cursor-grab touch-none select-none items-center justify-center active:cursor-grabbing"
          style={{ touchAction: 'none' }}
        >
          <div className="glass flex h-20 w-6 items-center justify-center rounded-r-full border-l-0">
            <span className="h-8 w-1 rounded-full bg-ink-400/60" />
          </div>
        </div>
      </div>
    </>
  );
}
