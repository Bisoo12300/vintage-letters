'use client';

import { TEMPLATES } from '@/lib/papers';
import { PaperSheet } from '@/components/LetterPaper';

const LINE_WIDTHS = ['62%', '100%', '100%', '78%'];

/** Paper chooser: each thumbnail is the real sheet in miniature. */
export function TemplatePicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  return (
    <fieldset className="min-w-0">
      <legend className="mb-2 font-body text-[13px] font-semibold text-ink-500">Paper</legend>
      <div className="-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-2 pt-1.5 sm:grid sm:grid-cols-5 sm:overflow-visible">
        {TEMPLATES.map((t) => {
          const active = value === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onChange(t.id)}
              aria-pressed={active}
              title={t.description}
              className={`w-[5.25rem] shrink-0 snap-start transition duration-500 ease-spring active:scale-95 sm:w-auto ${
                active ? '' : 'opacity-70 hover:opacity-100'
              }`}
            >
              <PaperSheet
                template={t.id}
                view="fit"
                className={`aspect-[3/4] rounded-xl shadow-[0_4px_12px_-4px_rgba(35,40,88,0.35)] ${
                  active ? 'ring-2 ring-ink-800 ring-offset-2 ring-offset-white/60' : 'ring-1 ring-black/5'
                }`}
              >
                {LINE_WIDTHS.map((width, i) => (
                  <span
                    key={i}
                    className="block rounded-full bg-ink-800/15"
                    style={{ width, height: '2.6cqw', marginTop: i ? '4.5cqw' : '2cqw', marginInline: i ? 0 : 'auto' }}
                  />
                ))}
              </PaperSheet>
              <span
                className={`mt-1.5 block truncate text-center font-body text-[12px] ${
                  active ? 'font-semibold text-ink-800' : 'font-medium text-ink-600'
                }`}
              >
                {t.name}
              </span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
