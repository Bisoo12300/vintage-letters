'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { TEMPLATES, type Letter } from '@/lib/api';
import { LogoMark } from '@/components/brand';

type Phase = 'idle' | 'seal' | 'flap' | 'pull' | 'exit';

const SEAL_MS = 520;
const FLAP_MS = 650;
const EXIT_MS = 520;
/** Fraction of the max pull that counts as "out" on release */
const REVEAL_AT = 0.6;
/** Upward flick speed (px/ms) that opens regardless of distance */
const FLICK_VELOCITY = 0.55;
/** Letter peeks this fraction of its height once the flap is open */
const PEEK = 0.26;

const VB = { w: 560, h: 400 };
const BODY = { x: 48, y: 128, w: 464, h: 224 };
const FLAP_H = BODY.h * 0.52;
/** Depth of the front pocket's V-shaped mouth — must stay above the flap tip */
const MOUTH = BODY.h * 0.46;
const CX = BODY.x + BODY.w / 2;
const pct = (v: number, total: number) => `${(v / total) * 100}%`;

function templateBg(templateId: string) {
  return TEMPLATES.find((t) => t.id === templateId)?.background ?? TEMPLATES[0].background;
}

export function EnvelopeReveal({ letter, onRevealed }: { letter: Letter; onRevealed: () => void }) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [pull, setPull] = useState(0);
  const [dragging, setDragging] = useState(false);
  const letterRef = useRef<HTMLDivElement>(null);
  const pullRef = useRef(0);
  const maxRef = useRef(160);
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

  const finish = useCallback(() => {
    setPhase('exit');
    later(onRevealed, EXIT_MS - 40);
  }, [onRevealed]);

  const open = () => {
    if (phase !== 'idle') return;
    setPhase('seal');
    later(() => setPhase('flap'), SEAL_MS);
    later(() => {
      const h = letterRef.current?.offsetHeight ?? 200;
      maxRef.current = h * 0.82;
      setPhase('pull');
      setPullValue(h * PEEK);
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
    const max = maxRef.current;
    const raw = d.startPull + dy;
    // Rubber-band past either end, like iOS overscroll.
    const next = raw > max ? max + (raw - max) * 0.3 : raw < 0 ? raw * 0.3 : raw;
    setPullValue(next);

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
    if (tapped || flicked || pullRef.current / maxRef.current >= REVEAL_AT) {
      finish();
    } else {
      setPullValue((letterRef.current?.offsetHeight ?? 200) * PEEK);
    }
  };

  const flapOpen = phase === 'flap' || phase === 'pull' || phase === 'exit';
  const exiting = phase === 'exit';
  const past = phase === 'pull' && pull / maxRef.current >= REVEAL_AT;
  const letterLift = exiting ? maxRef.current + 80 : pull;
  const SINK = exiting ? 'translateY(56px) scale(0.96)' : '';
  const sinkFade = `opacity ${EXIT_MS}ms var(--ios)`;
  const sink = (zIndex?: number): React.CSSProperties => ({
    zIndex,
    transform: SINK || undefined,
    opacity: exiting ? 0 : 1,
    transition: `transform ${EXIT_MS}ms var(--ios), ${sinkFade}`,
  });

  const hint =
    phase === 'idle'
      ? 'Tap to break the seal'
      : phase === 'pull'
        ? past
          ? 'Let go to read'
          : 'Pull the letter up'
        : ' ';

  return (
    <div className="mx-auto w-full max-w-2xl select-none" style={{ touchAction: phase === 'pull' ? 'none' : 'pan-y' }}>
      <div className={phase === 'idle' ? 'animate-envelope-float' : ''}>
        <div
          className="relative w-full"
          style={{ aspectRatio: `${VB.w} / ${VB.h}`, minHeight: 260 }}
        >
          {/* Envelope parts are siblings of the letter (no wrapper) so z-index interleaves them;
              each part sinks away on exit via `sink`. */}
            {/* Shadow */}
            <svg viewBox={`0 0 ${VB.w} ${VB.h}`} className="absolute inset-0 h-full w-full" style={sink()} aria-hidden>
              <defs>
                <radialGradient id="env-shadow">
                  <stop offset="0" stopColor="#232858" stopOpacity="0.22" />
                  <stop offset="1" stopColor="#232858" stopOpacity="0" />
                </radialGradient>
              </defs>
              <ellipse cx={CX} cy={BODY.y + BODY.h + 22} rx="230" ry="18" fill="url(#env-shadow)" />
            </svg>

            {/* Back wall / liner — visible once open */}
            <svg viewBox={`0 0 ${VB.w} ${VB.h}`} className="absolute inset-0 h-full w-full" style={sink(1)} aria-hidden>
              <defs>
                <linearGradient id="env-liner" x1={BODY.x} y1={BODY.y} x2={BODY.x + BODY.w} y2={BODY.y + BODY.h} gradientUnits="userSpaceOnUse">
                  <stop offset="0" stopColor="#C3CCF4" />
                  <stop offset="0.5" stopColor="#F2CCDA" />
                  <stop offset="1" stopColor="#FAD9AE" />
                </linearGradient>
              </defs>
              <rect x={BODY.x} y={BODY.y} width={BODY.w} height={BODY.h} rx="14" fill="url(#env-liner)" />
            </svg>

            {/* Top flap — two faces, hinged at the top edge */}
            <div
              className="absolute"
              style={{
                left: pct(BODY.x, VB.w),
                width: pct(BODY.w, VB.w),
                top: pct(BODY.y, VB.h),
                height: pct(FLAP_H, VB.h),
                zIndex: phase === 'pull' || exiting ? 2 : 5,
                transformOrigin: '50% 0%',
                transformStyle: 'preserve-3d',
                transform: `${SINK} perspective(1100px) rotateX(${flapOpen ? 180 : 0}deg)`,
                opacity: exiting ? 0 : 1,
                transition: exiting
                  ? `transform ${EXIT_MS}ms var(--ios), ${sinkFade}`
                  : `transform ${FLAP_MS}ms var(--spring)`,
              }}
            >
              <svg viewBox="0 0 464 116" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" style={{ backfaceVisibility: 'hidden' }} aria-hidden>
                <defs>
                  <linearGradient id="env-flap" x1="232" y1="0" x2="232" y2="116" gradientUnits="userSpaceOnUse">
                    <stop offset="0" stopColor="#FFFFFF" />
                    <stop offset="1" stopColor="#E6E9F7" />
                  </linearGradient>
                </defs>
                <path d="M8 0H456Q464 0 458 6L246 110Q232 118 218 110L6 6Q0 0 8 0Z" fill="url(#env-flap)" />
                <path d="M6 6 218 110Q232 118 246 110L458 6" fill="none" stroke="#CBD1EC" strokeWidth="1.2" />
              </svg>
              <svg
                viewBox="0 0 464 116"
                preserveAspectRatio="none"
                className="absolute inset-0 h-full w-full"
                style={{ backfaceVisibility: 'hidden', transform: 'rotateX(180deg)' }}
                aria-hidden
              >
                <defs>
                  <linearGradient id="env-flap-in" x1="0" y1="0" x2="464" y2="116" gradientUnits="userSpaceOnUse">
                    <stop offset="0" stopColor="#C3CCF4" />
                    <stop offset="0.5" stopColor="#F2CCDA" />
                    <stop offset="1" stopColor="#FAD9AE" />
                  </linearGradient>
                </defs>
                <path d="M8 0H456Q464 0 458 6L246 110Q232 118 218 110L6 6Q0 0 8 0Z" fill="url(#env-flap-in)" />
              </svg>
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
              />
              <path
                d={`M${BODY.x + 6} ${BODY.y + BODY.h - 6}L${CX - 18} ${BODY.y + BODY.h * 0.66}Q${CX} ${BODY.y + BODY.h * 0.6} ${CX + 18} ${BODY.y + BODY.h * 0.66}L${BODY.x + BODY.w - 6} ${BODY.y + BODY.h - 6}`}
                fill="none"
                stroke="#CBD1EC"
                strokeWidth="1.2"
              />
              <path
                d={`M${BODY.x} ${BODY.y + 6}L${CX} ${BODY.y + MOUTH}L${BODY.x + BODY.w} ${BODY.y + 6}`}
                fill="none"
                stroke="#D6DBF1"
                strokeWidth="1"
              />
              <rect x={BODY.x} y={BODY.y} width={BODY.w} height={BODY.h} rx="14" fill="url(#env-sheen)" opacity="0.5" />
            </svg>

            {/* Seal — splits into a moon half and a sun half */}
            {(phase === 'idle' || phase === 'seal') && (
              <div
                className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2"
                style={{ left: '50%', top: pct(BODY.y + FLAP_H * 0.78, VB.h), zIndex: 6 }}
              >
                {phase === 'seal' && (
                  <span className="animate-seal-glow absolute inset-0 rounded-full bg-white/80 blur-md" aria-hidden />
                )}
                <div className="relative h-16 w-16 sm:h-[72px] sm:w-[72px]">
                  {(['moon', 'sun'] as const).map((half) => (
                    <div
                      key={half}
                      className={`absolute inset-0 ${
                        phase === 'seal' ? (half === 'moon' ? 'animate-seal-moon' : 'animate-seal-sun') : ''
                      }`}
                      style={{ clipPath: half === 'moon' ? 'inset(0 50% 0 0)' : 'inset(0 0 0 50%)' }}
                    >
                      {/* No backdrop-filter here: under a clip-path Chromium paints it as a square */}
                      <div className="flex h-full w-full items-center justify-center rounded-full border border-white bg-gradient-to-b from-white to-mist-100 shadow-[0_6px_16px_-6px_rgba(35,40,88,0.35),inset_0_1px_0_#fff]">
                        <LogoMark className="h-9 w-9 sm:h-10 sm:w-10" />
                      </div>
                    </div>
                  ))}
                </div>
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
              className={`relative h-full w-full ${phase === 'pull' ? 'cursor-grab touch-none active:cursor-grabbing' : ''}`}
              style={{
                transform: `translateY(${-letterLift}px) scale(${exiting ? 1.05 : past ? 1.02 : 1})`,
                opacity: exiting ? 0 : 1,
                transition: dragging
                  ? 'transform 0.12s var(--ios)'
                  : exiting
                    ? `transform ${EXIT_MS}ms var(--ios), opacity ${EXIT_MS}ms var(--ios)`
                    : 'transform 0.7s var(--spring)',
              }}
            >
              {phase === 'pull' && (
                <span className="glass absolute -top-4 left-1/2 z-10 flex h-8 -translate-x-1/2 items-center gap-1 rounded-full px-3 font-body text-[12px] font-semibold text-ink-700">
                  <svg viewBox="0 0 12 12" className="animate-nudge-up h-3 w-3" aria-hidden>
                    <path d="M2.5 7.5 6 4l3.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Pull
                </span>
              )}
              <div className="flex h-full w-full flex-col overflow-hidden rounded-2xl bg-parchment-50 p-1.5 shadow-[0_8px_24px_-8px_rgba(35,40,88,0.35)] ring-1 ring-black/5">
                <p className="truncate px-3 pb-1.5 pt-3 text-center font-letter text-[15px] font-semibold text-ink-800">
                  {letter.title}
                </p>
                <div
                  className="min-h-0 flex-1 rounded-xl bg-cover bg-top"
                  style={{ backgroundImage: `url(${templateBg(letter.template)})` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <p className="mt-10 flex justify-center" aria-live="polite">
        <span
          className={`glass rounded-full px-4 py-2 font-body text-[14px] font-medium transition-all duration-300 ease-ios ${
            hint === ' ' ? 'opacity-0' : 'opacity-100'
          } ${past ? 'text-ink-800' : 'text-ink-500'}`}
        >
          {hint}
        </span>
      </p>
    </div>
  );
}
