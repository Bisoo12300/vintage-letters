'use client';

import { useEffect, useState } from 'react';
import { EnvelopeReveal } from '@/components/EnvelopeReveal';
import { LetterPaper } from '@/components/LetterPaper';
import { LetterTimelineDrawer } from '@/components/LetterTimelineDrawer';
import { useReadingTracker } from '@/components/ReadingTracker';
import { apiFetch, type Letter } from '@/lib/api';

export function LetterView({ id }: { id: string }) {
  const [letter, setLetter] = useState<Letter | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [revealed, setRevealed] = useState(false);

  useReadingTracker(revealed ? id : '');

  useEffect(() => {
    apiFetch<Letter>(`/letters/${id}`)
      .then(setLetter)
      .catch(() => setError('This letter could not be found.'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-mora-cream">
        <p className="font-display animate-pulse text-xl text-mora-brown-400">Opening letter...</p>
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
      <main className="flex min-h-screen items-center justify-center bg-mora-cream px-4 py-10 sm:px-6">
        <div className="animate-fade-in-up w-full max-w-2xl">
          <LetterPaper template={letter.template} title={letter.title} content={letter.content} />
        </div>
      </main>
    </>
  );
}
