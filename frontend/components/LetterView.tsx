'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { EnvelopeReveal } from '@/components/EnvelopeReveal';
import { LetterPaper } from '@/components/LetterPaper';
import { LetterTimelineDrawer } from '@/components/LetterTimelineDrawer';
import { useReadingTracker } from '@/components/ReadingTracker';
import { OrbitLoader } from '@/components/brand';
import { apiFetch, type Letter } from '@/lib/api';

export function LetterView({ id }: { id: string }) {
  const [letter, setLetter] = useState<Letter | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [revealed, setRevealed] = useState(false);

  useReadingTracker(revealed ? id : '');

  useEffect(() => {
    setRevealed(false);
    setLoading(true);
    apiFetch<Letter>(`/letters/${id}`)
      .then(setLetter)
      .catch(() => setError('This letter could not be found. Check the link or ask for a new one.'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <OrbitLoader label="Finding your letter…" />
      </main>
    );
  }

  if (error || !letter) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-6 text-center">
        <p className="max-w-sm font-body text-[17px] text-ink-600">{error}</p>
        <Link href="/" className="btn">
          Go home
        </Link>
      </main>
    );
  }

  if (!revealed) {
    return (
      <main className="flex min-h-screen items-center justify-center overflow-x-hidden overscroll-none px-4 py-10">
        <EnvelopeReveal letter={letter} onRevealed={() => setRevealed(true)} />
      </main>
    );
  }

  return (
    <>
      <LetterTimelineDrawer currentId={id} />
      <main className="flex min-h-screen justify-center px-4 pb-32 pt-10 sm:px-6 sm:pt-16">
        <div className="animate-letter-land w-full max-w-2xl">
          <LetterPaper
            template={letter.template}
            title={letter.title}
            content={letter.content}
            author={letter.author}
            replyToTitle={letter.reply_to_title}
            replyToId={letter.reply_to}
          />
        </div>
      </main>

      {/* Floating action capsule */}
      <div
        className="fixed inset-x-0 bottom-0 z-40 flex justify-center px-4"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1rem)' }}
      >
        <div className="glass-thick animate-fade-in-up flex items-center gap-1.5 rounded-full p-1.5" style={{ animationDelay: '0.35s' }}>
          <Link href="/" className="flex h-11 items-center rounded-full px-5 font-body text-[15px] font-semibold text-ink-700 transition-transform duration-300 ease-spring hover:bg-white/60 active:scale-95">
            Home
          </Link>
          <Link href={`/?reply_to=${letter.id}`} className="btn-primary">
            Write back
          </Link>
        </div>
      </div>
    </>
  );
}
