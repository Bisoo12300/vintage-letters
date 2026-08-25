'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  apiFetch,
  groupLettersByDate,
  formatTimelineTime,
  type TimelineLetter,
} from '@/lib/api';
import { authorEmoji } from '@/lib/identity';
import { useIdentity } from '@/components/IdentityGate';

const DRAWER_W = 320;
const CLOSED_X = -DRAWER_W;
const SNAP_OPEN = 72;

export function LetterTimelineDrawer({ currentId }: { currentId: string }) {
  const { identity } = useIdentity();
  const [letters, setLetters] = useState<TimelineLetter[]>([]);
  const [translateX, setTranslateX] = useState(CLOSED_X);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef({ startX: 0, startTx: CLOSED_X });

  const isOpen = translateX > CLOSED_X + SNAP_OPEN;
  const openProgress = (translateX - CLOSED_X) / DRAWER_W;

  useEffect(() => {
    if (!identity) return;
    apiFetch<TimelineLetter[]>('/letters/timeline', { author: identity })
      .then(setLetters)
      .catch(() => {});
  }, [identity]);

  const snap = useCallback((tx: number) => {
    const pulled = tx - CLOSED_X;
    setTranslateX(pulled >= SNAP_OPEN ? 0 : CLOSED_X);
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    dragRef.current = { startX: e.clientX, startTx: translateX };
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging) return;
    const dx = e.clientX - dragRef.current.startX;
    const next = Math.min(0, Math.max(CLOSED_X, dragRef.current.startTx + dx));
    setTranslateX(next);
  };

  const onPointerUp = () => {
    if (!dragging) return;
    setDragging(false);
    snap(translateX);
  };

  const close = () => setTranslateX(CLOSED_X);

  const groups = groupLettersByDate(letters);

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-mora-brown-800/20 backdrop-blur-[2px] transition-opacity duration-300"
        style={{
          opacity: openProgress * 0.85,
          pointerEvents: isOpen ? 'auto' : 'none',
        }}
        onClick={close}
        aria-hidden={!isOpen}
      />

      <div
        className={`fixed left-0 top-0 z-50 flex h-full items-center ${dragging ? '' : 'transition-transform duration-300 ease-out'}`}
        style={{ transform: `translateX(${translateX}px)` }}
      >
        <aside className="flex h-full w-[320px] shrink-0 flex-col border-r border-mora-beige-200 bg-mora-cream shadow-soft-lg">
          <div className="flex-1 overflow-y-auto px-5 py-8">
            {letters.length === 0 ? (
              <p className="font-body text-sm text-mora-brown-400">No letters yet.</p>
            ) : (
              <ol className="relative space-y-8">
                <span
                  className="absolute bottom-2 left-[7px] top-2 w-px bg-mora-beige-300"
                  aria-hidden
                />
                {groups.map((group) => (
                  <li key={group.date}>
                    <p className="mb-4 font-body text-xs font-semibold tracking-wide text-mora-brown-500 uppercase">
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
                                  ? 'border-mora-brown-600 bg-mora-brown-600'
                                  : 'border-mora-brown-400 bg-white'
                              }`}
                              aria-hidden
                            />
                            <Link
                              href={`/letter/${letter.id}`}
                              onClick={close}
                              className={`block rounded-xl px-3 py-2 transition ${
                                active
                                  ? 'bg-mora-brown-600 text-white'
                                  : 'text-mora-brown-700 hover:bg-mora-beige-100'
                              }`}
                            >
                              <p className={`font-display text-sm font-medium ${active ? 'text-white' : ''}`}>
                                {authorEmoji(letter.author)} {letter.title}
                              </p>
                              {letter.reply_to_title && (
                                <p
                                  className={`mt-0.5 font-body text-xs italic ${
                                    active ? 'text-mora-beige-100/90' : 'text-mora-brown-400'
                                  }`}
                                >
                                  ↳ Re: {letter.reply_to_title}
                                </p>
                              )}
                              <p
                                className={`mt-0.5 font-body text-xs ${
                                  active ? 'text-mora-beige-100' : 'text-mora-brown-400'
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

        {/* Compact washi tape — pull handle only */}
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
          className="relative mx-0 flex w-[44px] shrink-0 cursor-grab touch-none select-none flex-col items-center justify-center py-3 active:cursor-grabbing"
          style={{ touchAction: 'none' }}
        >
          <div
            className="relative flex flex-col items-center justify-center rounded-sm px-2 py-4 rotate-[1.5deg] shadow-md"
            style={{
              background:
                'linear-gradient(180deg, rgba(228,210,180,0.95) 0%, rgba(210,190,160,0.9) 50%, rgba(228,210,180,0.95) 100%)',
              boxShadow: '2px 0 8px rgba(61,52,41,0.12), inset 0 1px 0 rgba(255,255,255,0.35)',
            }}
          >
            <span
              className="font-display text-[10px] font-semibold tracking-[0.3em] text-mora-brown-700 uppercase"
              style={{ writingMode: 'vertical-rl' }}
            >
              pull
            </span>
            <span className="mt-2 text-xs text-mora-brown-600" aria-hidden>
              ›
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
