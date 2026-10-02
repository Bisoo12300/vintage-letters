'use client';

import { useId } from 'react';

/** Heart split by an S-curve: night with a crescent on the left, day with a sun on the right. */
const HEART =
  'M32 57C14 45 5 34 5 21.5 5 12.5 11.8 6 20 6c5.2 0 9.4 2.6 12 6.8C34.6 8.6 38.8 6 44 6c8.2 0 15 6.5 15 15.5C59 34 50 45 32 57Z';
const SEAM = 'M32 12.8C40 24 24 40 32 57';
const LEFT_HALF = 'M0 0H32V12.8C40 24 24 40 32 57V64H0Z';
const RIGHT_HALF = 'M64 0H32V12.8C40 24 24 40 32 57V64H64Z';
const RAYS = Array.from({ length: 8 }, (_, i) => (i * Math.PI) / 4);

export function LogoMark({ className, title }: { className?: string; title?: string }) {
  const id = useId().replace(/:/g, '');
  return (
    <svg viewBox="0 0 64 64" className={className} role={title ? 'img' : undefined} aria-hidden={title ? undefined : true}>
      {title && <title>{title}</title>}
      <defs>
        <linearGradient id={`${id}n`} x1="10" y1="8" x2="30" y2="54" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#3B4390" />
          <stop offset="1" stopColor="#7482CF" />
        </linearGradient>
        <linearGradient id={`${id}d`} x1="50" y1="8" x2="34" y2="54" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#FFD27A" />
          <stop offset="1" stopColor="#EE8A45" />
        </linearGradient>
        <clipPath id={`${id}h`}>
          <path d={HEART} />
        </clipPath>
        <clipPath id={`${id}r`}>
          <path d={RIGHT_HALF} />
        </clipPath>
        <mask id={`${id}c`}>
          <circle cx="19" cy="23" r="7.2" fill="#fff" />
          <circle cx="22.6" cy="20.4" r="6.2" fill="#000" />
        </mask>
      </defs>
      <g clipPath={`url(#${id}h)`}>
        <path d={LEFT_HALF} fill={`url(#${id}n)`} />
        <path d={RIGHT_HALF} fill={`url(#${id}d)`} />
        <rect x="0" y="0" width="64" height="64" fill="#EEF1FF" mask={`url(#${id}c)`} />
        <circle cx="11.5" cy="15" r="0.9" fill="#fff" opacity="0.9" />
        <circle cx="23" cy="35" r="0.75" fill="#fff" opacity="0.75" />
        <g clipPath={`url(#${id}r)`}>
          <circle cx="45" cy="23" r="5.2" fill="#FFF5DD" />
          {RAYS.map((a) => (
            <line
              key={a}
              x1={45 + Math.cos(a) * 8}
              y1={23 + Math.sin(a) * 8}
              x2={45 + Math.cos(a) * 10.6}
              y2={23 + Math.sin(a) * 10.6}
              stroke="#FFF5DD"
              strokeWidth="1.7"
              strokeLinecap="round"
            />
          ))}
        </g>
        <path d={SEAM} stroke="#fff" strokeWidth="1.6" fill="none" opacity="0.9" />
        {/* glass highlight */}
        <ellipse cx="22" cy="14" rx="15" ry="7" fill="#fff" opacity="0.18" transform="rotate(-18 22 14)" />
      </g>
      <path d={HEART} fill="none" stroke="#fff" strokeOpacity="0.55" strokeWidth="1" />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={`font-display text-[1.35rem] font-semibold italic leading-none tracking-[-0.01em] text-ink-800 ${className ?? ''}`}>
      Clair de Lune
    </span>
  );
}

/** Small sun / moon glyph used wherever an author is shown. */
export function AuthorGlyph({ author, className }: { author?: string | null; className?: string }) {
  const id = useId().replace(/:/g, '');
  if (author === 'sun') {
    return (
      <svg viewBox="0 0 24 24" className={className} aria-hidden>
        <defs>
          <radialGradient id={`${id}s`} cx="40%" cy="38%" r="65%">
            <stop offset="0" stopColor="#FFE7B8" />
            <stop offset="0.6" stopColor="#F2A541" />
            <stop offset="1" stopColor="#E07A2E" />
          </radialGradient>
        </defs>
        {RAYS.map((a) => (
          <line
            key={a}
            x1={12 + Math.cos(a) * 8}
            y1={12 + Math.sin(a) * 8}
            x2={12 + Math.cos(a) * 10.4}
            y2={12 + Math.sin(a) * 10.4}
            stroke="#F2A541"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        ))}
        <circle cx="12" cy="12" r="5.6" fill={`url(#${id}s)`} />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <defs>
        <linearGradient id={`${id}m`} x1="4" y1="3" x2="18" y2="21" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#B7C2F2" />
          <stop offset="1" stopColor="#4A56A0" />
        </linearGradient>
        <mask id={`${id}k`}>
          <rect width="24" height="24" fill="#fff" />
          <circle cx="16.4" cy="8.4" r="7.4" fill="#000" />
        </mask>
      </defs>
      <circle cx="11.5" cy="12.5" r="8.5" fill={`url(#${id}m)`} mask={`url(#${id}k)`} />
      <circle cx="19" cy="15.5" r="0.9" fill="#8C9BD6" />
    </svg>
  );
}

/** Living backdrop behind every glass surface. Tint follows html[data-identity]. */
export function Sky() {
  return (
    <div className="sky" aria-hidden>
      <div className="sky-stars" />
      <div className="sky-orb sky-orb--moon" />
      <div className="sky-orb sky-orb--sun" />
      <div className="sky-orb sky-orb--rose" />
    </div>
  );
}

export function OrbitLoader({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4" role="status" aria-live="polite">
      <div className="orbit-loader" aria-hidden>
        <span className="orbit-loader__body orbit-loader__body--sun" />
        <span className="orbit-loader__body orbit-loader__body--moon" />
      </div>
      {label && <p className="font-body text-[15px] text-ink-500">{label}</p>}
      <span className="sr-only">{label || 'Loading'}</span>
    </div>
  );
}
