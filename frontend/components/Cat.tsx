export type CatPose = 'sit' | 'walk' | 'roll' | 'beg' | 'cuddle' | 'pounce' | 'eat' | 'sleep' | 'lick' | 'stretch';

/** Soft brown outline shared by the cats and their room */
const OUT = '#5B4636';
const PINK = '#F6A8B8';
const EYE = '#3B2A22';
const line = { stroke: OUT, strokeWidth: 2.6, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };

/** Sun's cat is orange with tabby marks, Moon's is white. */
const COATS = {
  sun: { fur: '#F7B267', mark: '#E8873A', soft: '#FFF1DC', far: '#E9A257' },
  moon: { fur: '#FFFDF8', mark: '#EDE4EE', soft: '#FFFFFF', far: '#E9E3EC' },
};
type Coat = (typeof COATS)['sun'];
type Eyes = 'open' | 'closed' | 'happy';

/** Growth: body scale and head scale per stage (1 = 2 months, 2 = 6 months, 3 = adult). Kittens are mostly head. */
const GROW = [null, { body: 0.7, head: 0.92 }, { body: 0.85, head: 0.92 }, { body: 1, head: 0.9 }];

function Eye({ x, eyes }: { x: number; eyes: Eyes }) {
  if (eyes !== 'open') {
    return <path d={eyes === 'happy' ? `M${x - 4.4} 3q4.4-6 8.8 0` : `M${x - 4.4} 1.5q4.4 4 8.8 0`} fill="none" stroke={EYE} strokeWidth="2.2" strokeLinecap="round" />;
  }
  return (
    <g transform={`translate(${x} 2)`}>
      <g className="cat-eye">
        <g className="cat-look">
          <ellipse rx="3.7" ry="4.9" fill={EYE} />
          <circle cx="1.2" cy="-1.9" r="1.5" fill="#fff" />
          <circle cx="-1.1" cy="1.7" r="0.7" fill="#fff" />
        </g>
      </g>
    </g>
  );
}

/** Head drawn around (0,0). `look` slides the face sideways for a three-quarter view. */
function Head({ coat, eyes, striped, look = 0, tongue = false }: { coat: Coat; eyes: Eyes; striped: boolean; look?: number; tongue?: boolean }) {
  return (
    <>
      <g className="cat-ear">
        <path d="M-27-8-24-31q2-3 5-1l13 10z" fill={coat.fur} {...line} />
        <path d="M-22.5-13l1-13 9.5 6z" fill={PINK} />
      </g>
      <g className="cat-ear cat-ear--r">
        <path d="M27-8 24-31q-2-3-5-1L6-22z" fill={coat.fur} {...line} />
        <path d="M22.5-13l-1-13-9.5 6z" fill={PINK} />
      </g>
      <ellipse rx="30" ry="25" fill={coat.fur} {...line} />
      {striped && <path d="M0-23.5v8M-9-22v6M9-22v6" stroke={coat.mark} strokeWidth="3.2" strokeLinecap="round" fill="none" />}
      <g transform={`translate(${look} 0)`}>
        <ellipse cy="11.5" rx="12.5" ry="8" fill={coat.soft} />
        <Eye x={-12.5} eyes={eyes} />
        <Eye x={12.5} eyes={eyes} />
        <ellipse cx="-20" cy="10.5" rx="4.6" ry="2.8" fill={PINK} opacity="0.7" />
        <ellipse cx="20" cy="10.5" rx="4.6" ry="2.8" fill={PINK} opacity="0.7" />
        {tongue && <path d="M-2.4 13.5h4.8v3.4q-2.4 2.6-4.8 0z" fill="#F08BA0" stroke={OUT} strokeWidth="1" />}
        <path d="M-2.3 8h4.6q-.5 2.9-2.3 2.9T-2.3 8z" fill="#E98AA0" />
        <path d="M0 11q-3 4.4-6.6 1.6M0 11q3 4.4 6.6 1.6" fill="none" stroke={OUT} strokeWidth="1.6" strokeLinecap="round" />
        <path d="M-17 7.5h-11M-17 12l-10 3M17 7.5h11M17 12l10 3" stroke={OUT} strokeWidth="1" strokeLinecap="round" opacity="0.45" />
      </g>
    </>
  );
}

/** Tail as a fat outlined stroke */
function Tail({ d, coat }: { d: string; coat: Coat }) {
  return (
    <g className="cat-tail">
      <path d={d} fill="none" stroke={OUT} strokeWidth="13" strokeLinecap="round" />
      <path d={d} fill="none" stroke={coat.fur} strokeWidth="8" strokeLinecap="round" />
    </g>
  );
}

/** Collar with the letter pouch, drawn around the point under the chin */
function Pouch({ x, y, letter }: { x: number; y: number; letter: boolean }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path d="M-13-3q13 8 26 0" fill="none" stroke="#D2584B" strokeWidth="3.4" strokeLinecap="round" />
      {letter && (
        <g>
          <rect x="-7" y="-1" width="14" height="10" rx="1.4" fill="#FFFDF5" stroke={OUT} strokeWidth="1.2" />
          <path d="M0 4.6q-2.6-2.6-1.3-3.6t1.3.5q.2-1.5 1.3-.5T0 4.6z" fill="#E0668A" />
        </g>
      )}
      <rect x="-9.5" y="4" width="19" height="13.5" rx="3.4" fill="#C08A55" stroke={OUT} strokeWidth="1.6" />
      <path d="M-9.5 7q9.5 7.5 19 0" fill="none" stroke={OUT} strokeWidth="1.4" />
      <circle cy="11.2" r="1.5" fill="#F6DDA9" stroke={OUT} strokeWidth="0.8" />
    </g>
  );
}

function Zzz({ x, y }: { x: number; y: number }) {
  return (
    <g className="cat-zzz" fill="#6C73A6" fontFamily="Georgia, serif" fontWeight="700">
      <text x={x} y={y} fontSize="11">z</text>
      <text x={x + 9} y={y - 11} fontSize="14">z</text>
    </g>
  );
}

/**
 * One of the two cats. Which drawing is used depends on what it is doing:
 * sitting up facing you, walking in profile on four legs, or curled up asleep.
 * `stage` 0 is a newborn in its nest. The pose class is animated in globals.css.
 */
export function Cat({
  owner,
  stage,
  pose = 'sit',
  pouch = false,
  letter = false,
  className = '',
}: {
  owner: 'moon' | 'sun';
  stage: 0 | 1 | 2 | 3;
  pose?: CatPose;
  pouch?: boolean;
  letter?: boolean;
  className?: string;
}) {
  const coat = COATS[owner];
  const striped = owner === 'sun';
  const svg = (p: string, children: React.ReactNode) => (
    <svg viewBox="0 0 120 120" className={`cat cat--${p} ${className}`} aria-hidden>
      {children}
    </svg>
  );

  if (stage === 0) {
    return svg(
      'sleep',
      <>
        <ellipse cx="60" cy="113" rx="44" ry="4.5" fill={OUT} opacity="0.13" />
        <ellipse cx="60" cy="93" rx="45" ry="14" fill="#D9A566" {...line} />
        <ellipse cx="60" cy="91" rx="37" ry="9" fill="#FBD5DF" />
        <g className="cat-torso">
          <g transform="translate(60 78) scale(0.62)">
            <Head coat={coat} eyes="closed" striped={striped} />
          </g>
        </g>
        <path d="M15 93q45 25 90 0v8q-45 25-90 0z" fill="#C8904F" {...line} />
        <path d="M34 104l3 9M52 107l1 9M70 107l-1 9M86 104l-3 9" stroke={OUT} strokeWidth="1.4" strokeLinecap="round" opacity="0.5" />
        <Zzz x={84} y={56} />
      </>
    );
  }

  const g = GROW[stage]!;

  if (pose === 'sleep') {
    return svg(
      'sleep',
      <>
        <ellipse cx="62" cy="113" rx="40" ry="4.5" fill={OUT} opacity="0.13" />
        <g transform={`translate(60 112) scale(${g.body * 0.92 + 0.08}) translate(-60 -112)`}>
          <g className="cat-torso">
            <ellipse cx="66" cy="94" rx="34" ry="18.5" fill={coat.fur} {...line} />
            {striped && <path d="M62 76.500v8M72 77v8M82 79.500v7" stroke={coat.mark} strokeWidth="3.2" strokeLinecap="round" />}
            <g transform="translate(40 88) rotate(-6) scale(0.8)">
              <Head coat={coat} eyes="closed" striped={striped} />
            </g>
            <Tail d="M94 102C100 114 62 115 44 110" coat={coat} />
          </g>
        </g>
        <Zzz x={70} y={62} />
      </>
    );
  }

  // Profile, facing right, on four legs
  if (pose === 'walk' || pose === 'pounce' || pose === 'stretch') {
    const s = g.body * 0.85 + 0.15;
    const leg = (x: number, far: boolean, cls: string) => (
      <rect className={`cat-leg ${cls}`} x={x} y="86" width="10.5" height="26" rx="5.2" fill={far ? coat.far : coat.fur} {...line} />
    );
    return svg(
      pose,
      <>
        <ellipse cx="60" cy="113" rx={36 * s} ry="4.5" fill={OUT} opacity="0.13" />
        <g transform={`translate(60 112) scale(${s}) translate(-60 -112)`}>
          <g className="cat-all">
            <Tail d="M30 80C12 78 9 58 19 49" coat={coat} />
            {leg(42, true, 'cat-leg--b')}
            {leg(76, true, 'cat-leg--a')}
            <rect x="24" y="62" width="64" height="35" rx="17.5" fill={coat.fur} {...line} />
            <ellipse cx="56" cy="91" rx="19" ry="4.5" fill={coat.soft} />
            {striped && <path d="M40 63.500v8M50 62.500v8M60 62.500v8" stroke={coat.mark} strokeWidth="3.2" strokeLinecap="round" />}
            {leg(31, false, 'cat-leg--a')}
            {leg(65, false, 'cat-leg--b')}
            <g className="cat-head">
              <g transform={`translate(87 55) scale(${g.head / s * 0.78})`}>
                <Head coat={coat} eyes={pose === 'stretch' ? 'closed' : 'open'} striped={striped} look={3.5} />
              </g>
            </g>
            {pouch && <Pouch x={84} y={76} letter={letter} />}
          </g>
        </g>
      </>
    );
  }

  // Sitting up, facing you
  const eyes: Eyes = pose === 'cuddle' || pose === 'beg' || pose === 'lick' ? 'happy' : 'open';
  const headY = 112 - 44 * g.body - 16 * g.head;
  return svg(
    pose,
    <>
      <ellipse cx="60" cy="113" rx={30 * g.body + 6} ry="4.5" fill={OUT} opacity="0.13" />
      <g className="cat-all">
        <g transform={`translate(60 112) scale(${g.body}) translate(-60 -112)`}>
          <Tail d="M80 104C101 104 105 84 94 75" coat={coat} />
          <ellipse cx="43" cy="109.5" rx="8.5" ry="5.2" fill={coat.fur} {...line} />
          <ellipse cx="77" cy="109.5" rx="8.5" ry="5.2" fill={coat.fur} {...line} />
          <g className="cat-torso">
            <path d="M38 111C33 86 44 68 60 68s27 18 22 43q-22 4-44 0z" fill={coat.fur} {...line} />
            <ellipse cx="60" cy="96" rx="12.5" ry="14" fill={coat.soft} />
            {striped && <path d="M38.5 90h7M37.5 98h8M81.5 90h-7M82.5 98h-8" stroke={coat.mark} strokeWidth="3.2" strokeLinecap="round" />}
          </g>
          {(['l', 'r'] as const).map((side) => (
            <g key={side} className={`cat-arm cat-arm--${side}`}>
              <rect x={side === 'l' ? 47.5 : 62} y="90" width="10.5" height="22" rx="5.2" fill={coat.fur} {...line} />
              <path d={side === 'l' ? 'M51 108v3M54.5 108v3' : 'M65.5 108v3M69 108v3'} stroke={OUT} strokeWidth="1.2" strokeLinecap="round" opacity="0.6" />
            </g>
          ))}
        </g>
        <g className="cat-head">
          <g transform={`translate(60 ${headY}) scale(${g.head})`}>
            <Head coat={coat} eyes={eyes} striped={striped} tongue={pose === 'lick' || pose === 'eat'} />
          </g>
        </g>
        {pouch && pose !== 'lick' && <Pouch x={60} y={headY + 22 * g.head} letter={letter} />}
      </g>
    </>
  );
}

/**
 * The room the cats live in (one per house). Moon's looks out on the night,
 * Sun's on a bright morning. `fed` fills the food bowl.
 */
export function Room({ owner, fed }: { owner: 'moon' | 'sun'; fed: boolean }) {
  const night = owner === 'moon';
  const wall = night ? '#DCDFF5' : '#FDE7CF';
  const wallStripe = night ? '#D2D6F0' : '#FADDBF';
  const floor = night ? '#C9B79F' : '#E3BE8C';
  return (
    <svg viewBox="0 0 360 300" preserveAspectRatio="xMidYMax slice" className="absolute inset-0 h-full w-full" aria-hidden>
      {/* The top 60 units are bare wall: room for the speech bubbles, and safe to crop on wide screens */}
      <rect width="360" height="62" fill={wall} />
      {Array.from({ length: 12 }, (_, i) => (
        <rect key={i} x={i * 30 + 11} width="8" height="62" fill={wallStripe} />
      ))}
      <g transform="translate(0 60)">
      <rect width="360" height="176" fill={wall} />
      {Array.from({ length: 12 }, (_, i) => (
        <rect key={i} x={i * 30 + 11} width="8" height="176" fill={wallStripe} />
      ))}
      <rect y="168" width="360" height="10" fill="#FFF8EE" stroke={OUT} strokeWidth="2" />
      <rect y="178" width="360" height="62" fill={floor} />
      <path d="M0 197h360M0 217h360M60 178v19M190 178v19M300 178v19M120 197v20M250 197v20M40 217v23M170 217v23M310 217v23" stroke={OUT} strokeWidth="1.3" opacity="0.28" />

      {/* Window with curtains */}
      <rect x="232" y="26" width="84" height="84" rx="8" fill={night ? '#39428C' : '#A8DCF7'} {...line} strokeWidth="3" />
      {night ? (
        <>
          <circle cx="292" cy="50" r="11" fill="#FFF3C4" />
          <circle cx="287" cy="46" r="10" fill="#39428C" />
          <path d="M250 44l1.5 3 3 1.5-3 1.5-1.5 3-1.5-3-3-1.5 3-1.500zM268 76l1 2 2 1-2 1-1 2-1-2-2-1 2-1z" fill="#FFF3C4" />
        </>
      ) : (
        <>
          <circle cx="292" cy="50" r="12" fill="#FFD76A" />
          <path d="M244 84q4-10 14-6 4-8 13-3 9 0 7 9z" fill="#fff" />
        </>
      )}
      <path d="M274 26v84M232 68h84" stroke="#FFF8EE" strokeWidth="5" />
      <path d="M274 26v84M232 68h84" stroke={OUT} strokeWidth="1" opacity="0.35" />
      <rect x="226" y="108" width="96" height="8" rx="3" fill="#FFF8EE" {...line} strokeWidth="2.2" />
      <path d="M224 20h100" stroke={OUT} strokeWidth="4" strokeLinecap="round" />
      <path d="M228 22q16 30 0 78 12 4 20-2-8-40 4-76z" fill={night ? '#F3B8CB' : '#FFD98F'} {...line} strokeWidth="2.2" />
      <path d="M320 22q-16 30 0 78-12 4-20-2 8-40-4-76z" fill={night ? '#F3B8CB' : '#FFD98F'} {...line} strokeWidth="2.2" />

      {/* Shelf with a plant and books, a framed heart */}
      <rect x="34" y="72" width="92" height="7" rx="3" fill="#C8904F" {...line} strokeWidth="2.2" />
      <path d="M52 72v-14h16v14z" fill="#E98A6B" {...line} strokeWidth="2.2" />
      <path d="M60 58q-12-6-9-18 9 2 9 18zM60 58q12-6 9-18-9 2-9 18zM60 58V38" fill="#8FC48C" {...line} strokeWidth="2" />
      <path d="M86 72V50h9v22zM96 72V54h8v18zM105 72l5-18 8 2-5 16z" fill="#9FB1E6" {...line} strokeWidth="2" />
      <rect x="150" y="34" width="46" height="40" rx="5" fill="#FFF8EE" {...line} strokeWidth="2.6" />
      <path d="M173 64q-13-10-8-17 5-4 8 3 3-7 8-3 5 7-8 17z" fill="#F08BA0" />

      {/* Rug, bowl and a ball of yarn */}
      <ellipse cx="180" cy="214" rx="120" ry="17" fill={night ? '#F6C9D6' : '#FBDFA6'} stroke={OUT} strokeWidth="2" opacity="0.9" />
      <ellipse cx="180" cy="214" rx="96" ry="11" fill="none" stroke="#fff" strokeWidth="2.5" strokeDasharray="5 7" opacity="0.8" />
      <g transform="translate(304 206)">
        <path d="M-20 0h40l-5 15h-30z" fill="#8FB7E8" {...line} strokeWidth="2.2" />
        <ellipse rx="20" ry="5" fill={fed ? '#C98A4B' : '#EAF2FC'} {...line} strokeWidth="2.2" />
        {fed && <path d="M-9-2a3 3 0 0 1 6 0M0-3a3 3 0 0 1 6 0M7-1.500a3 3 0 0 1 6 0" fill="#B5753A" />}
        <path d="M0 6.500q-2.6-2.6-1.3-3.600t1.3.5q.2-1.5 1.3-.5T0 6.500z" transform="translate(0 4)" fill="#fff" />
      </g>
      <g transform="translate(50 210)">
        <circle r="13" fill="#F29DB8" {...line} strokeWidth="2.2" />
        <path d="M-10-6q10 6 20-2M-12 2q12 5 23-3M-6 10q9-1 15-8" fill="none" stroke={OUT} strokeWidth="1.3" opacity="0.5" />
        <path d="M11 7q12 8 22 0" fill="none" stroke="#F29DB8" strokeWidth="2.6" strokeLinecap="round" />
      </g>
      </g>
    </svg>
  );
}
