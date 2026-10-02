'use client';

/** Page numbers to show: always first and last, a window around the current page, gaps as null. */
function pageWindow(page: number, pageCount: number): (number | null)[] {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, i) => i + 1);
  const pages = new Set([1, pageCount, page - 1, page, page + 1]);
  if (page <= 3) [2, 3, 4].forEach((p) => pages.add(p));
  if (page >= pageCount - 2) [pageCount - 3, pageCount - 2, pageCount - 1].forEach((p) => pages.add(p));
  const sorted = [...pages].filter((p) => p >= 1 && p <= pageCount).sort((a, b) => a - b);
  const out: (number | null)[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push(null);
    out.push(p);
  });
  return out;
}

function Chevron({ dir }: { dir: 'left' | 'right' }) {
  return (
    <svg viewBox="0 0 8 14" className="h-3.5 w-2" aria-hidden>
      <path
        d={dir === 'left' ? 'M7 1 1 7l6 6' : 'M1 1l6 6-6 6'}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Pager({
  page,
  pageCount,
  total,
  noun = 'letter',
  onChange,
}: {
  page: number;
  pageCount: number;
  total: number;
  noun?: string;
  onChange: (page: number) => void;
}) {
  const count = `${total} ${total === 1 ? noun : `${noun}s`}`;
  if (pageCount <= 1) {
    return total > 0 ? <p className="py-5 text-center font-body text-[13px] text-ink-400">{count}</p> : null;
  }

  const step =
    'flex h-10 min-w-10 items-center justify-center rounded-full px-3 font-body text-[15px] font-semibold transition-transform duration-300 ease-spring active:scale-90 disabled:pointer-events-none disabled:opacity-35';

  return (
    <nav aria-label="Pages" className="flex flex-col items-center gap-2 py-5">
      <div className="glass flex items-center gap-0.5 rounded-full p-1">
        <button
          type="button"
          onClick={() => onChange(page - 1)}
          disabled={page <= 1}
          aria-label="Previous page"
          className={`${step} text-ink-600 hover:bg-white/60`}
        >
          <Chevron dir="left" />
        </button>
        {pageWindow(page, pageCount).map((p, i) =>
          p === null ? (
            <span key={`gap-${i}`} className="w-6 text-center font-body text-[15px] text-ink-400" aria-hidden>
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => onChange(p)}
              aria-current={p === page ? 'page' : undefined}
              aria-label={`Page ${p}`}
              className={`${step} ${
                p === page
                  ? 'bg-ink-800 text-white shadow-[0_6px_14px_-6px_rgba(35,40,88,0.7)]'
                  : 'text-ink-600 hover:bg-white/60'
              }`}
            >
              {p}
            </button>
          )
        )}
        <button
          type="button"
          onClick={() => onChange(page + 1)}
          disabled={page >= pageCount}
          aria-label="Next page"
          className={`${step} text-ink-600 hover:bg-white/60`}
        >
          <Chevron dir="right" />
        </button>
      </div>
      <p className="font-body text-[13px] text-ink-400">
        Page {page} of {pageCount} · {count}
      </p>
    </nav>
  );
}
