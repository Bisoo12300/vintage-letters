'use client';

import { useCallback, useRef, useState } from 'react';
import { TEMPLATES, type Letter } from '@/lib/api';

type Phase = 'idle' | 'seal' | 'flap' | 'pull' | 'exit';

const SEAL_MS = 380;
const FLAP_MS = 920;
const LETTER_PULL_MAX = 216;
const LETTER_REVEAL = 0.82;

const VB = { w: 560, h: 400 };
const BODY = { x: 48, y: 128, w: 464, h: 224 };
const CX = BODY.x + BODY.w / 2;
const FLAP_TIP_Y = BODY.y + BODY.h * 0.44;
/** Front panel starts below opening — letter shows through top strip */
const OPENING_VB = 44;

const BODY_LEFT = `${(BODY.x / VB.w) * 100}%`;
const BODY_WIDTH = `${(BODY.w / VB.w) * 100}%`;
const BODY_TOP = `${(BODY.y / VB.h) * 100}%`;
const BODY_BOTTOM = `${((BODY.y + BODY.h) / VB.h) * 100}%`;
const SEAL_TOP = `${((BODY.y + (FLAP_TIP_Y - BODY.y) * 0.55) / VB.h) * 100}%`;

function templateBg(templateId: string) {
  return TEMPLATES.find((t) => t.id === templateId)?.background ?? TEMPLATES[0].background;
}

function PullTab({ onDown, onMove, onUp }: { onDown: (e: React.PointerEvent) => void; onMove: (e: React.PointerEvent) => void; onUp: () => void }) {
  return (
    <div
      role="slider"
      aria-label="Pull letter out"
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      className="cursor-grab touch-none active:cursor-grabbing"
      style={{ touchAction: 'none' }}
    >
      <div
        className="flex items-center gap-1 rounded-sm px-3 py-1.5 shadow-md rotate-[-1deg]"
        style={{ background: 'linear-gradient(180deg, #e4d2b4, #d2bea0)' }}
      >
        <span className="font-display text-[10px] font-semibold tracking-[0.2em] text-mora-brown-700 uppercase">pull</span>
        <span className="text-[10px] text-mora-brown-600">↑</span>
      </div>
    </div>
  );
}

function LetterCard({ title, background }: { title: string; background: string }) {
  return (
    <div
      className="flex h-[320px] w-full flex-col overflow-hidden rounded-t-xl bg-white"
      style={{
        border: '2px solid rgba(107, 90, 74, 0.5)',
        boxShadow: 'inset 0 0 0 1px rgba(196, 181, 163, 0.45)',
      }}
    >
      <div className="mx-1.5 mt-1.5 flex min-h-0 flex-1 flex-col overflow-hidden rounded-t-lg border border-mora-brown-400/20 bg-parchment-50">
        <div className="shrink-0 bg-parchment-50 px-3 py-2 text-center">
          <p className="font-display line-clamp-1 text-sm font-semibold text-mora-brown-800">{title}</p>
        </div>
        <div className="min-h-[220px] flex-1 bg-cover bg-top" style={{ backgroundImage: `url(${background})` }} />
      </div>
    </div>
  );
}

function LetterWithPull({
  title,
  template,
  showPull,
  onPullDown,
  onPullMove,
  onPullUp,
}: {
  title: string;
  template: string;
  showPull: boolean;
  onPullDown: (e: React.PointerEvent) => void;
  onPullMove: (e: React.PointerEvent) => void;
  onPullUp: () => void;
}) {
  return (
    <div className="flex w-full flex-col items-center">
      {showPull && (
        <div className="relative z-10 -mb-1.5 shrink-0">
          <PullTab onDown={onPullDown} onMove={onPullMove} onUp={onPullUp} />
        </div>
      )}
      <LetterCard title={title} background={templateBg(template)} />
    </div>
  );
}

function EnvelopeAnimated({
  letter,
  phase,
  letterPull,
  dragging,
  onOpen,
  onPullDown,
  onPullMove,
  onPullUp,
}: {
  letter: Letter;
  phase: Phase;
  letterPull: number;
  dragging: boolean;
  onOpen: () => void;
  onPullDown: (e: React.PointerEvent) => void;
  onPullMove: (e: React.PointerEvent) => void;
  onPullUp: () => void;
}) {
  const flapOpen = phase === 'flap' || phase === 'pull' || phase === 'exit';
  const sealBroken = phase !== 'idle';
  const pullPhase = phase === 'pull' || phase === 'exit';
  const exiting = phase === 'exit';
  const frontY = BODY.y + OPENING_VB;
  const frontH = BODY.h - OPENING_VB;

  return (
    <div className={`relative h-full w-full overflow-visible ${exiting ? 'animate-envelope-exit' : ''}`}>
      {phase === 'idle' && (
        <button type="button" onClick={onOpen} aria-label="Open envelope" className="absolute inset-0 z-50 cursor-pointer" />
      )}

      <div className="relative h-full w-full overflow-visible" style={{ perspective: 1000, perspectiveOrigin: '50% 40%' }}>
        <svg viewBox={`0 0 ${VB.w} ${VB.h}`} fill="none" className="pointer-events-none absolute inset-0 z-[1] h-full w-full" aria-hidden>
          <ellipse cx={CX} cy={VB.h - 24} rx="180" ry="10" fill="#3D3429" opacity="0.07" />
        </svg>

        {/* Back: top flap */}
        <div
          className="absolute"
          style={{
            left: BODY_LEFT,
            width: BODY_WIDTH,
            top: BODY_TOP,
            height: `${((FLAP_TIP_Y - BODY.y) / VB.h) * 100}%`,
            zIndex: flapOpen ? 5 : 28,
            transformStyle: 'preserve-3d',
            transformOrigin: '50% 0%',
            transform: flapOpen ? 'rotateX(-180deg)' : 'rotateX(0deg)',
            transition: 'transform 0.55s cubic-bezier(0.33, 1.15, 0.54, 1)',
          }}
        >
          <svg viewBox="0 0 464 100" preserveAspectRatio="none" className="h-full w-full">
            <defs>
              <linearGradient id="vl-flap" x1="232" y1="0" x2="232" y2="100" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#fffdf8" />
                <stop offset="100%" stopColor="#e9dece" />
              </linearGradient>
            </defs>
            <polygon points="0,0 464,0 232,100" fill="url(#vl-flap)" stroke="#D4C9B8" strokeWidth="1" strokeLinejoin="round" />
          </svg>
        </div>

        {/* Middle: pocket interior */}
        {flapOpen && (
          <svg viewBox={`0 0 ${VB.w} ${VB.h}`} fill="none" className="pointer-events-none absolute inset-0 z-[10] h-full w-full" aria-hidden>
            <defs>
              <linearGradient id="vl-pocket" x1={CX} y1={BODY.y} x2={CX} y2={BODY.y + 96} gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#ede5d6" />
                <stop offset="100%" stopColor="#d4c4ae" />
              </linearGradient>
            </defs>
            <path
              d={`M${BODY.x + 1} ${BODY.y + 1} L${CX} ${BODY.y + 68} L${BODY.x + BODY.w - 1} ${BODY.y + 1} L${BODY.x + BODY.w - 1} ${BODY.y + 28} L${CX} ${BODY.y + 92} L${BODY.x + 1} ${BODY.y + 28} Z`}
              fill="url(#vl-pocket)"
            />
          </svg>
        )}

        {/* Letter — anchored at body bottom, slides up */}
        {pullPhase && (
          <div
            className="absolute overflow-visible"
            style={{
              left: BODY_LEFT,
              width: BODY_WIDTH,
              bottom: `calc(100% - ${BODY_BOTTOM})`,
              zIndex: letterPull > 0 ? 25 : 15,
            }}
          >
            <div
              className={dragging ? '' : 'transition-transform duration-300 ease-out'}
              style={{ transform: `translateY(${-letterPull}px)` }}
            >
              <LetterWithPull
                title={letter.title}
                template={letter.template}
                showPull={phase === 'pull'}
                onPullDown={onPullDown}
                onPullMove={onPullMove}
                onPullUp={onPullUp}
              />
            </div>
          </div>
        )}

        {/* Front body — full when closed (behind flap), lower lip when open */}
        <svg viewBox={`0 0 ${VB.w} ${VB.h}`} fill="none" className="pointer-events-none absolute inset-0 h-full w-full" style={{ zIndex: flapOpen ? 20 : 15 }} aria-hidden>
          <defs>
            <linearGradient id="vl-paper" x1={BODY.x} y1={BODY.y} x2={BODY.x + BODY.w} y2={BODY.y + BODY.h} gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#faf6ef" />
              <stop offset="100%" stopColor="#e8dfd0" />
            </linearGradient>
            <filter id="vl-shadow">
              <feDropShadow dx="0" dy="8" stdDeviation="10" floodColor="#3D3429" floodOpacity="0.12" />
            </filter>
          </defs>
          <g filter="url(#vl-shadow)">
            {flapOpen ? (
              <>
                <rect x={BODY.x} y={frontY} width={BODY.w} height={frontH} rx="2" fill="url(#vl-paper)" stroke="#D4C9B8" strokeWidth="1.2" />
                <line x1={BODY.x} y1={BODY.y + OPENING_VB} x2={BODY.x + BODY.w} y2={BODY.y + OPENING_VB} stroke="#D4C9B8" strokeWidth="0.8" />
              </>
            ) : (
              <rect x={BODY.x} y={BODY.y} width={BODY.w} height={BODY.h} rx="2" fill="url(#vl-paper)" stroke="#D4C9B8" strokeWidth="1.2" />
            )}
          </g>
        </svg>

        {!sealBroken && (
          <div
            className="pointer-events-none absolute left-1/2 z-[30] -translate-x-1/2 -translate-y-1/2 transition-transform duration-200 group-hover:scale-105"
            style={{ top: SEAL_TOP }}
          >
            <svg viewBox="0 0 68 68" width="56" height="56" aria-hidden>
              <defs>
                <radialGradient id="vl-seal" cx="50%" cy="35%" r="55%">
                  <stop offset="0%" stopColor="#a85c52" />
                  <stop offset="100%" stopColor="#6B2A24" />
                </radialGradient>
              </defs>
              <circle cx="34" cy="34" r="32" fill="url(#vl-seal)" filter="drop-shadow(0 2px 4px rgba(61,52,41,0.25))" />
              <path
                d="M34 46 C34 46 18 33 18 22 C18 15 23 10 30 10 C32 10 34 11 34 13 C34 11 36 10 38 10 C45 10 50 15 50 22 C50 33 34 46 34 46 Z"
                fill="#F5E6E4"
                opacity="0.85"
              />
            </svg>
          </div>
        )}

        {sealBroken && phase === 'seal' && (
          <div className="pointer-events-none absolute left-1/2 z-[30] -translate-x-1/2 -translate-y-1/2 animate-envelope-seal-break" style={{ top: SEAL_TOP }}>
            <svg viewBox="0 0 68 68" width="56" height="56" aria-hidden>
              <circle cx="34" cy="34" r="32" fill="#8B3D35" opacity="0.5" />
            </svg>
          </div>
        )}
      </div>
    </div>
  );
}

export function EnvelopeReveal({ letter, onRevealed }: { letter: Letter; onRevealed: () => void }) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [letterPull, setLetterPull] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef({ startY: 0, startPull: 0 });
  const pullRef = useRef(0);

  const finish = useCallback(() => {
    pullRef.current = LETTER_PULL_MAX;
    setLetterPull(LETTER_PULL_MAX);
    setPhase('exit');
    setTimeout(onRevealed, 450);
  }, [onRevealed]);

  const open = useCallback(() => {
    if (phase !== 'idle') return;
    setPhase('seal');
    setTimeout(() => setPhase('flap'), SEAL_MS);
    setTimeout(() => setPhase('pull'), FLAP_MS);
  }, [phase]);

  const onPullDown = (e: React.PointerEvent) => {
    if (phase !== 'pull') return;
    dragRef.current = { startY: e.clientY, startPull: letterPull };
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPullMove = (e: React.PointerEvent) => {
    if (!dragging) return;
    const dy = dragRef.current.startY - e.clientY;
    const next = Math.min(LETTER_PULL_MAX, Math.max(0, dragRef.current.startPull + dy));
    pullRef.current = next;
    setLetterPull(next);
  };

  const onPullUp = () => {
    if (!dragging) return;
    setDragging(false);
    if (pullRef.current / LETTER_PULL_MAX >= LETTER_REVEAL) finish();
    else {
      pullRef.current = 0;
      setLetterPull(0);
    }
  };

  const hint =
    phase === 'idle' ? 'Tap to open the envelope' : phase === 'pull' ? 'Pull the letter out' : '';

  return (
    <div className="group relative mx-auto w-full max-w-2xl overflow-visible">
      <div
        className="relative w-full overflow-visible transition-transform hover:scale-[1.01]"
        style={{ aspectRatio: '560 / 400', minHeight: 280 }}
      >
        <EnvelopeAnimated
          letter={letter}
          phase={phase}
          letterPull={letterPull}
          dragging={dragging}
          onOpen={open}
          onPullDown={onPullDown}
          onPullMove={onPullMove}
          onPullUp={onPullUp}
        />
      </div>
      <p className="mt-8 text-center font-display text-sm italic text-mora-brown-400">{hint}</p>
    </div>
  );
}
