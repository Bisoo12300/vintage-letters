'use client';

import { useId } from 'react';

/** Side view of the pigeon in flight with a letter tied to its leg — the loading indicator. */
export function FlyingPigeon({ className = '' }: { className?: string }) {
  const id = useId().replace(/:/g, '');
  return (
    <svg viewBox="0 0 140 96" className={`pgf ${className}`} aria-hidden>
      <defs>
        <linearGradient id={`${id}b`} x1="30" y1="30" x2="100" y2="70" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#E3E6F5" />
          <stop offset="1" stopColor="#A9B0D3" />
        </linearGradient>
        <linearGradient id={`${id}n`} x1="80" y1="28" x2="96" y2="50" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#7FC7A8" />
          <stop offset="1" stopColor="#9C86D6" />
        </linearGradient>
      </defs>

      {/* Wind streaks passing behind */}
      <g className="pgf-wind" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" opacity="0.9">
        <path d="M8 30h22" />
        <path d="M2 52h16" />
        <path d="M14 72h20" />
      </g>

      <g className="pgf-bird">
        {/* Far wing (behind the body) */}
        <g className="pgf-wing pgf-wing--far">
          <path d="M64 40C58 22 44 10 30 8c-3 0-4 3-2 5 10 10 16 22 24 32z" fill="#8E96BF" />
        </g>

        {/* Tail */}
        <path d="M36 50 12 46c-3 0-4 4-1 5l26 9z" fill="#8790BB" />

        {/* Letter on the leg: string, then the envelope swinging under it */}
        <g className="pgf-letter">
          <path d="M66 60v12" stroke="#B58A5A" strokeWidth="1.4" />
          <g transform="translate(55 70)">
            <rect width="22" height="15" rx="2" fill="#FFF8EC" stroke="#D9B98B" strokeWidth="1.2" />
            <path d="M1 1.5 11 9l10-7.5" fill="none" stroke="#D9B98B" strokeWidth="1.2" strokeLinejoin="round" />
            <circle cx="11" cy="9.5" r="2.6" fill="#E0668A" />
          </g>
        </g>
        {/* Tucked feet */}
        <path d="M62 58l4 4 4-3" stroke="#E58A8A" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />

        {/* Body and neck */}
        <path d="M34 48c4-14 20-20 40-18 14 1 24 6 26 16 1 9-8 16-26 16-22 0-42-4-40-14z" fill={`url(#${id}b)`} />
        <path d="M82 30c8-2 15 3 15 11 0 6-6 9-12 8-6-1-8-6-7-11 0-4 1-7 4-8z" fill={`url(#${id}n)`} />

        {/* Head */}
        <circle cx="99" cy="32" r="11" fill="#C9CEE6" />
        <path d="M109 31l9 3-9 3z" fill="#3B3F5E" />
        <ellipse cx="109" cy="30.5" rx="2.6" ry="1.8" fill="#F4F2F7" />
        <circle cx="102" cy="29" r="3.2" fill="#F7B267" />
        <circle cx="102.5" cy="29" r="1.9" fill="#1C1F38" />
        <ellipse cx="97" cy="37" rx="3" ry="1.7" fill="#F29DB8" opacity="0.6" />

        {/* Near wing (in front) */}
        <g className="pgf-wing pgf-wing--near">
          <path d="M70 42C66 22 54 6 38 2c-3-1-5 2-3 5 8 12 12 26 18 38 4 6 14 4 17-3z" fill="#B3BADB" />
          <path d="M60 36C56 26 50 18 42 12" stroke="#7E86B4" strokeWidth="2" strokeLinecap="round" fill="none" />
        </g>
      </g>
    </svg>
  );
}
