'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ComposeWindow } from '@/components/ComposeWindow';
import { EnvelopeReveal } from '@/components/EnvelopeReveal';
import { LetterPaper } from '@/components/LetterPaper';
import { LetterTimelineDrawer } from '@/components/LetterTimelineDrawer';
import { useReadingTracker } from '@/components/ReadingTracker';
import { PigeonLoader } from '@/components/brand';
import { apiFetch, type Letter } from '@/lib/api';

export function LetterView({ id }: { id: string }) {
  const [letter, setLetter] = useState<Letter | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [revealed, setRevealed] = useState(false);
  /** True when the small letter morphed into the page, so it must not animate in again */
  const [morphed, setMorphed] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);

  useReadingTracker(revealed ? id : '');

  useEffect(() => {
    // "?reply=1" (old "/?reply_to=" links) skips the envelope and opens the reply window
    const replying = new URLSearchParams(window.location.search).get('reply') === '1';
    setRevealed(replying);
    setMorphed(false);
    setComposeOpen(replying);
    setLoading(true);
    apiFetch<Letter>(`/letters/${id}`)
      .then(setLetter)
      .catch(() => setError('This letter could not be found. Check the link or ask for a new one.'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleRevealed = useCallback((viaMorph: boolean) => {
    setMorphed(viaMorph);
    setRevealed(true);
  }, []);
  const closeCompose = useCallback(() => setComposeOpen(false), []);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <PigeonLoader label="Finding your letter…" />
      </main>
    );
  }

  if (error || !letter) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-6 text-center">
        <p className="max-w-sm font-body text-[17px] text-ink-600">{error}</p>
        <Link href="/milestones" className="btn">
          Go home
        </Link>
      </main>
    );
  }

  if (!revealed) {
    return (
      // overflow-clip (not hidden): the glow behind the envelope must not add scrolling, and
      // `hidden` would turn this into a scroll box
      <main className="flex min-h-[100dvh] items-center justify-center overflow-clip overscroll-none px-4 py-10">
        <EnvelopeReveal letter={letter} onRevealed={handleRevealed} />
      </main>
    );
  }

  return (
    <>
      <LetterTimelineDrawer currentId={id} />
      <main className="flex min-h-screen justify-center px-3 pb-32 pt-10 sm:px-6 sm:pt-16">
        <div
          className={`w-full max-w-2xl ${morphed ? '' : 'animate-letter-land'}`}
          style={{ viewTransitionName: 'letter-sheet' } as React.CSSProperties}
        >
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
          <Link href="/milestones" className="flex h-11 items-center rounded-full px-5 font-body text-[15px] font-semibold text-ink-700 transition-transform duration-300 ease-spring hover:bg-white/60 active:scale-95">
            Home
          </Link>
          <button type="button" className="btn-primary" onClick={() => setComposeOpen(true)}>
            Write back
          </button>
        </div>
      </div>

      <ComposeWindow open={composeOpen} onClose={closeCompose} replyTo={{ id: letter.id, title: letter.title }} />
    </>
  );
}
