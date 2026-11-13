'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import type { Letter } from '@/lib/api';
import { authorLabel } from '@/lib/identity';
import { AuthorGlyph, LogoMark } from '@/components/brand';
import { PaperSheet } from '@/components/LetterPaper';

type Phase = 'idle' | 'seal' | 'flap' | 'pull' | 'exit';

const SEAL_MS = 560;
const FLAP_MS = 650;
const EXIT_MS = 460;
/** Pull is a fraction of the letter's own height, so it scales with the envelope.
    Once the flap is open the letter slides this far out by itself. */
const PEEK = 0.38;
const MAX = 0.82;
/** Fraction of MAX that counts as "out" on release */
const REVEAL_AT = 0.6;
/** Upward flick speed (px/ms) that opens regardless of distance */
const FLICK_VELOCITY = 0.55;

const VB = { w: 560, h: 400 };
const BODY = { x: 48, y: 128, w: 464, h: 224 };
const FLAP_H = BODY.h * 0.52;
/** Depth of the front pocket's V-shaped mouth — must stay above the flap tip */
const MOUTH = BODY.h * 0.46;
const CX = BODY.x + BODY.w / 2;
const pct = (v: number, total: number) => `${(v / total) * 100}%`;

/** Wax seal outline: a slightly uneven scalloped disc */
const WAX = Array.from({ length: 90 }, (_, i) => {
  const a = (i / 90) * Math.PI * 2;
  const r = 45 + 2.2 * Math.sin(a * 11) + 1.3 * Math.sin(a * 5 + 1);
  return `${(50 + Math.cos(a) * r).toFixed(1)},${(50 + Math.sin(a) * r).toFixed(1)}`;
}).join(' ');

/** The wax and the scene take the sender's colours */
const TONES = {
  moon: { wax: ['#9AA6EC', '#4A56A0', '#262D6B'], spark: '#FFFFFF' },
  sun: { wax: ['#FFD98A', '#F2A541', '#C5601C'], spark: '#FFE2A0' },
};

const SPARK_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];

/** Stars around a letter from the Moon (sizes in cqw of the stage) */
const TWINKLES = [
  { left: '2%', top: '6%', s: 3.4, d: 3.6, t: 0 },
  { left: '18%', top: '-9%', s: 2.2, d: 4.4, t: -1.2 },
  { left: '82%', top: '-6%', s: 3, d: 3.9, t: -2.4 },
  { left: '96%', top: '18%', s: 2.2, d: 4.8, t: -0.6 },
  { left: '-4%', top: '62%', s: 2.4, d: 4.1, t: -3 },
  { left: '99%', top: '70%', s: 3.2, d: 3.4, t: -1.8 },
  { left: '50%', top: '-14%', s: 2, d: 5, t: -2.9 },
];

function canMorph() {
  return (
    typeof document !== 'undefined' &&
    'startViewTransition' in document &&
    !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

export function EnvelopeReveal({
  letter,
  onRevealed,
}: {
  letter: Letter;
  /** `morphed` is true when the small letter grew into the page (no landing animation needed) */
  onRevealed: (morphed: boolean) => void;
}) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [pull, setPull] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [morph] = useState(canMorph);
  const letterRef = useRef<HTMLDivElement>(null);
  const pullRef = useRef(0);
  const drag = useRef({ startY: 0, startPull: 0, lastY: 0, lastT: 0, velocity: 0, moved: 0 });
  const timers = useRef<number[]>([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  };

  const setPullValue = (v: number) => {
    pullRef.current = v;
    setPull(v);
  };

  /** Measured on every use, so rotating the phone mid-pull can't leave a stale size */
  const letterHeight = () => letterRef.current?.offsetHeight || 1;

  const finish = useCallback(() => {
    setPhase('exit');
    later(() => {
      if (!morph) return onRevealed(false);
      (document as unknown as { startViewTransition: (update: () => void) => unknown }).startViewTransition(() =>
        flushSync(() => onRevealed(true))
      );
    }, EXIT_MS - 40);
  }, [onRevealed, morph]);

  const open = () => {
    if (phase !== 'idle') return;
    setPhase('seal');
    later(() => setPhase('flap'), SEAL_MS);
    later(() => {
      setPhase('pull');
      setPullValue(PEEK);
      letterRef.current?.focus({ preventScroll: true });
    }, SEAL_MS + FLAP_MS);
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (phase !== 'pull') return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { startY: e.clientY, startPull: pullRef.current, lastY: e.clientY, lastT: e.timeStamp, velocity: 0, moved: 0 };
    setDragging(true);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    const d = drag.current;
    const dy = d.startY - e.clientY;
    const raw = d.startPull + dy / letterHeight();
    // Rubber-band past either end, like iOS overscroll.
    setPullValue(raw > MAX ? MAX + (raw - MAX) * 0.3 : raw < 0 ? raw * 0.3 : raw);

    const dt = e.timeStamp - d.lastT;
    if (dt > 0) d.velocity = (d.lastY - e.clientY) / dt;
    d.lastY = e.clientY;
    d.lastT = e.timeStamp;
    d.moved = Math.max(d.moved, Math.abs(dy));
  };

  const onPointerUp = () => {
    if (!dragging) return;
    setDragging(false);
    const d = drag.current;
    const tapped = d.moved < 5;
    const flicked = d.velocity > FLICK_VELOCITY;
    if (tapped || flicked || pullRef.current / MAX >= REVEAL_AT) finish();
    else setPullValue(PEEK);
  };

  const fromSun = letter.author === 'sun';
  const tone = TONES[fromSun ? 'sun' : 'moon'];
  const flapOpen = phase === 'flap' || phase === 'pull' || phase === 'exit';
  const exiting = phase === 'exit';
  const past = phase === 'pull' && pull / MAX >= REVEAL_AT;
  // On exit the letter either stays out to grow into the page, or lifts away and fades.
  const lift = exiting ? (morph ? Math.max(pull, 0.72) : MAX + 0.4) : pull;
  const sink = (zIndex?: number): React.CSSProperties => ({
    zIndex,
    transform: exiting ? 'translateY(10cqw) scale(0.96)' : undefined,
    opacity: exiting ? 0 : 1,
    transition: `transform ${EXIT_MS}ms var(--ios), opacity ${EXIT_MS}ms var(--ios)`,
  });
  const fade: React.CSSProperties = { opacity: exiting ? 0 : 1, transition: `opacity ${EXIT_MS}ms var(--ios)` };

  const hint =
    phase === 'idle'
      ? 'Tap to break the seal'
      : phase === 'pull'
        ? past
          ? 'Let go to read'
          : 'Pull the letter up'
        : ' ';

  return (
    <div
      className="flex w-full select-none flex-col items-center"
      style={{ touchAction: phase === 'pull' ? 'none' : 'pan-y', '--spark': tone.spark } as React.CSSProperties}
    >
      <div className="mb-[clamp(2rem,9vh,4.5rem)]" style={fade}>
        <p className="animate-fade-in-up flex items-center gap-2 font-display text-[1.6rem] font-semibold italic text-ink-800">
          <AuthorGlyph author={letter.author} className="h-7 w-7" />
          A letter from {authorLabel(letter.author)}
        </p>
      </div>

      <div className="env-stage">
        {/* Light behind the envelope: sun rays or night stars, after the sender */}
        <div className="absolute inset-0" style={fade} aria-hidden>
          <div className="env-aura" />
          {fromSun ? (
            <div className="env-rays" />
          ) : (
            TWINKLES.map((p) => (
              <span
                key={p.left}
                className="sky-spark"
                style={{ left: p.left, top: p.top, '--s': `${p.s}cqw`, '--d': `${p.d}s`, '--t': `${p.t}s` } as React.CSSProperties}
              />
            ))
          )}
        </div>

        {/* Envelope parts and the letter are siblings so z-index interleaves them;
            each part sinks away on exit via `sink`. */}
        <div className={`absolute inset-0 ${phase === 'idle' ? 'animate-envelope-float' : ''}`}>
          {/* Shadow */}
          <svg viewBox={`0 0 ${VB.w} ${VB.h}`} className="absolute inset-0 h-full w-full" style={sink()} aria-hidden>
            <defs>
              <radialGradient id="env-shadow">
                <stop offset="0" stopColor="#232858" stopOpacity="0.24" />
                <stop offset="1" stopColor="#232858" stopOpacity="0" />
              </radialGradient>
            </defs>
            <ellipse cx={CX} cy={BODY.y + BODY.h + 22} rx="230" ry="18" fill="url(#env-shadow)" />
          </svg>

          {/* Back wall / liner — visible once open */}
          <svg viewBox={`0 0 ${VB.w} ${VB.h}`} className="absolute inset-0 h-full w-full" style={sink(1)} aria-hidden>
            <defs>
              <linearGradient id="env-liner" x1={BODY.x} y1={BODY.y} x2={BODY.x + BODY.w} y2={BODY.y + BODY.h} gradientUnits="userSpaceOnUse">
                <stop offset="0" stopColor="#B9C4F2" />
                <stop offset="0.5" stopColor="#F2CCDA" />
                <stop offset="1" stopColor="#FAD9AE" />
              </linearGradient>
              <pattern id="env-dots" width="22" height="22" patternUnits="userSpaceOnUse">
                <circle cx="5" cy="6" r="1.3" fill="#fff" opacity="0.75" />
                <circle cx="16" cy="17" r="1" fill="#fff" opacity="0.55" />
              </pattern>
            </defs>
            <rect x={BODY.x} y={BODY.y} width={BODY.w} height={BODY.h} rx="14" fill="url(#env-liner)" />
            <rect x={BODY.x} y={BODY.y} width={BODY.w} height={BODY.h} rx="14" fill="url(#env-dots)" />
          </svg>

          {/* Top flap — the wrapper sinks and fades; the inner hinge only rotates
              (fading a preserve-3d element would flatten it and flash the wrong face) */}
          <div
            className="absolute"
            style={{
              left: pct(BODY.x, VB.w),
              width: pct(BODY.w, VB.w),
              top: pct(BODY.y, VB.h),
              height: pct(FLAP_H, VB.h),
              ...sink(phase === 'pull' || exiting ? 2 : 5),
            }}
          >
            <div
              className="absolute inset-0"
              style={{
                transformOrigin: '50% 0%',
                transformStyle: 'preserve-3d',
                transform: `perspective(1100px) rotateX(${flapOpen ? 180 : 0}deg)`,
                transition: `transform ${FLAP_MS}ms var(--spring)`,
              }}
            >
              <svg
                viewBox="0 0 464 116"
                preserveAspectRatio="none"
                className="absolute inset-0 h-full w-full overflow-visible"
                style={{ backfaceVisibility: 'hidden', filter: 'drop-shadow(0 0.8cqw 1cqw rgba(35, 40, 88, 0.16))' }}
                aria-hidden
              >
                <defs>
                  <linearGradient id="env-flap" x1="232" y1="0" x2="232" y2="116" gradientUnits="userSpaceOnUse">
                    <stop offset="0" stopColor="#FFFFFF" />
                    <stop offset="1" stopColor="#E6E9F7" />
                  </linearGradient>
                </defs>
                <path d="M8 0H456Q464 0 458 6L246 110Q232 118 218 110L6 6Q0 0 8 0Z" fill="url(#env-flap)" />
                <path d="M6 6 218 110Q232 118 246 110L458 6" fill="none" stroke="#CBD1EC" strokeWidth="1.2" />
              </svg>
              {/* Inner face: turned about the vertical axis, so it keeps its wide edge on the hinge.
                  (Turning it about the horizontal axis left the open flap upside down, floating above.) */}
              <svg
                viewBox="0 0 464 116"
                preserveAspectRatio="none"
                className="absolute inset-0 h-full w-full"
                style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
                aria-hidden
              >
                <defs>
                  <linearGradient id="env-flap-in" x1="0" y1="0" x2="464" y2="116" gradientUnits="userSpaceOnUse">
                    <stop offset="0" stopColor="#B9C4F2" />
                    <stop offset="0.5" stopColor="#F2CCDA" />
                    <stop offset="1" stopColor="#FAD9AE" />
                  </linearGradient>
                </defs>
                <path d="M8 0H456Q464 0 458 6L246 110Q232 118 218 110L6 6Q0 0 8 0Z" fill="url(#env-flap-in)" />
              </svg>
            </div>
          </div>

          {/* Front pocket */}
          <svg viewBox={`0 0 ${VB.w} ${VB.h}`} className="pointer-events-none absolute inset-0 h-full w-full" style={sink(4)} aria-hidden>
            <defs>
              <linearGradient id="env-paper" x1={BODY.x} y1={BODY.y} x2={BODY.x + BODY.w} y2={BODY.y + BODY.h} gradientUnits="userSpaceOnUse">
                <stop offset="0" stopColor="#FFFFFF" />
                <stop offset="1" stopColor="#E3E7F6" />
              </linearGradient>
              <linearGradient id="env-sheen" x1={CX} y1={BODY.y} x2={CX} y2={BODY.y + BODY.h} gradientUnits="userSpaceOnUse">
                <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.9" />
                <stop offset="0.3" stopColor="#FFFFFF" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path
              d={`M${BODY.x} ${BODY.y + 6}L${CX} ${BODY.y + MOUTH}L${BODY.x + BODY.w} ${BODY.y + 6}V${BODY.y + BODY.h - 14}Q${BODY.x + BODY.w} ${BODY.y + BODY.h} ${BODY.x + BODY.w - 14} ${BODY.y + BODY.h}H${BODY.x + 14}Q${BODY.x} ${BODY.y + BODY.h} ${BODY.x} ${BODY.y + BODY.h - 14}Z`}
              fill="url(#env-paper)"
              stroke="#D6DBF1"
              strokeWidth="1"
            />
            <path
              d={`M${BODY.x + 6} ${BODY.y + BODY.h - 6}L${CX - 18} ${BODY.y + BODY.h * 0.66}Q${CX} ${BODY.y + BODY.h * 0.6} ${CX + 18} ${BODY.y + BODY.h * 0.66}L${BODY.x + BODY.w - 6} ${BODY.y + BODY.h - 6}`}
              fill="none"
              stroke="#CBD1EC"
              strokeWidth="1.2"
            />
            <rect x={BODY.x} y={BODY.y} width={BODY.w} height={BODY.h} rx="14" fill="url(#env-sheen)" opacity="0.5" />
          </svg>

          {/* Wax seal in the sender's colour — cracks down the middle with a burst of sparks */}
          {(phase === 'idle' || phase === 'seal') && (
            <div
              className={`env-seal ${phase === 'seal' ? 'env-seal--breaking' : 'env-seal--idle'}`}
              style={{ top: pct(BODY.y + FLAP_H * 0.8, VB.h) }}
            >
              <span className="env-seal__glow" aria-hidden />
              {SPARK_ANGLES.map((a) => (
                <span key={a} className="env-spark" style={{ '--a': `${a}deg` } as React.CSSProperties} aria-hidden />
              ))}
              {(['l', 'r'] as const).map((half) => (
                <div key={half} className={`env-seal__half env-seal__half--${half}`}>
                  <svg viewBox="0 0 100 100" className="h-full w-full overflow-visible" aria-hidden>
                    <defs>
                      <radialGradient id={`env-wax-${half}`} cx="36%" cy="30%" r="75%">
                        <stop offset="0" stopColor={tone.wax[0]} />
                        <stop offset="0.55" stopColor={tone.wax[1]} />
                        <stop offset="1" stopColor={tone.wax[2]} />
                      </radialGradient>
                    </defs>
                    <polygon points={WAX} fill={`url(#env-wax-${half})`} strokeLinejoin="round" />
                    <circle cx="50" cy="50" r="34" fill="none" stroke="#000" strokeOpacity="0.16" strokeWidth="1.2" />
                    <circle cx="50" cy="50" r="31.5" fill="none" stroke="#fff" strokeOpacity="0.32" strokeWidth="1.4" />
                  </svg>
                  <LogoMark className="absolute left-[25%] top-[25%] h-1/2 w-1/2" />
                </div>
              ))}
            </div>
          )}

          {phase === 'idle' && (
            <button
              type="button"
              onClick={open}
              aria-label="Break the seal and open the letter"
              className="absolute inset-0 cursor-pointer rounded-3xl"
              style={{ zIndex: 7 }}
            />
          )}

          {/* The letter */}
          <div
            className="absolute"
            style={{
              left: pct(BODY.x + 16, VB.w),
              width: pct(BODY.w - 32, VB.w),
              bottom: pct(VB.h - (BODY.y + BODY.h) + 10, VB.h),
              height: pct(BODY.h - 24, VB.h),
              zIndex: 3,
              visibility: flapOpen ? 'visible' : 'hidden',
            }}
          >
            <div
              ref={letterRef}
              role={phase === 'pull' ? 'button' : undefined}
              tabIndex={phase === 'pull' ? 0 : -1}
              aria-label="Take the letter out"
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              onKeyDown={(e) => {
                if (phase === 'pull' && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault();
                  finish();
                }
              }}
              className={`relative h-full w-full outline-none ${phase === 'pull' ? 'cursor-grab touch-none active:cursor-grabbing' : ''}`}
              style={
                {
                  transform: `translateY(${-lift * 100}%) scale(${exiting ? 1.04 : past ? 1.02 : 1})`,
                  opacity: exiting && !morph ? 0 : 1,
                  transition: dragging
                    ? 'transform 0.12s var(--ios)'
                    : exiting
                      ? `transform ${EXIT_MS}ms var(--ios), opacity ${EXIT_MS}ms var(--ios)`
                      : 'transform 0.7s var(--spring)',
                  viewTransitionName: exiting && morph ? 'letter-sheet' : undefined,
                } as React.CSSProperties
              }
            >
              {/* Sits above the letter, not on it, and steps aside once the letter is being pulled */}
              {phase === 'pull' && (
                <span
                  className="glass absolute bottom-full left-1/2 z-10 mb-[1.8cqw] flex h-8 -translate-x-1/2 items-center gap-1 rounded-full px-3 font-body text-[12px] font-semibold text-ink-700 transition-opacity duration-300"
                  style={{ opacity: !dragging && pull <= PEEK + 0.04 ? 1 : 0 }}
                >
                  <svg viewBox="0 0 12 12" className="animate-nudge-up h-3 w-3" aria-hidden>
                    <path d="M2.5 7.5 6 4l3.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Pull
                </span>
              )}
              {/* The real paper in miniature, so what comes out is what you then read */}
              <PaperSheet
                template={letter.template}
                view="paper"
                className="h-full rounded-[3cqw] shadow-[0_8px_24px_-8px_rgba(35,40,88,0.4)] ring-1 ring-black/5"
              >
                <p className="truncate text-center font-letter font-semibold leading-tight text-ink-800" style={{ fontSize: '5.6cqw' }}>
                  {letter.title}
                </p>
                <p
                  className="line-clamp-3 whitespace-pre-wrap font-letter leading-relaxed text-ink-800/70"
                  style={{ fontSize: '3.4cqw', marginTop: '2.4cqw' }}
                >
                  {letter.content}
                </p>
              </PaperSheet>
            </div>
          </div>
        </div>
      </div>

      <p className="mt-[clamp(1.5rem,6vh,2.5rem)] flex justify-center" aria-live="polite">
        <span
          className={`glass rounded-full px-4 py-2 font-body text-[14px] font-medium transition-all duration-300 ease-ios ${
            hint === ' ' || exiting ? 'opacity-0' : 'opacity-100'
          } ${past ? 'text-ink-800' : 'text-ink-500'}`}
        >
          {hint}
        </span>
      </p>
    </div>
  );
}
