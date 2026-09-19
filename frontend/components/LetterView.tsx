'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { EnvelopeReveal } from '@/components/EnvelopeReveal';
import { LetterPaper } from '@/components/LetterPaper';
import { LetterTimelineDrawer } from '@/components/LetterTimelineDrawer';
import { useReadingTracker } from '@/components/ReadingTracker';
import { BookLoader } from '@/components/BookLoader';
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
      .catch(() => setError('This letter could not be found.'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-mora-cream">
        <BookLoader label="Opening letter…" />
      </main>
    );
  }

  if (error || !letter) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-mora-cream p-6">
        <p className="font-body text-lg text-mora-brown-600">{error}</p>
      </main>
    );
  }

  if (!revealed) {
    return (
      <main className="flex min-h-screen items-center justify-center overflow-x-hidden bg-mora-cream px-4 py-10 overscroll-none">
        <EnvelopeReveal letter={letter} onRevealed={() => setRevealed(true)} />
      </main>
    );
  }

  return (
    <>
      <LetterTimelineDrawer currentId={id} />
      <div
        className="fixed inset-x-4 bottom-6 z-40 flex flex-col items-stretch gap-2 sm:inset-x-auto sm:right-6 sm:items-end"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <Link href="/" className="mora-btn text-sm shadow-md">
          Back to home
        </Link>
        <Link href={`/?reply_to=${letter.id}`} className="mora-btn-primary text-sm shadow-md">
          Reply to this letter
        </Link>
      </div>
      <main className="flex min-h-screen items-center justify-center bg-mora-cream px-4 py-10 sm:px-6">
        <div className="animate-fade-in-up w-full max-w-2xl">
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
    </>
  );
}
