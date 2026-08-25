'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { apiFetch, TEMPLATES, type Letter, type TemplateId } from '@/lib/api';
import { MoraHero, SiteShell } from '@/components/SiteShell';
import { BookLoader } from '@/components/BookLoader';
import { useIdentity } from '@/components/IdentityGate';
import { authorEmoji, authorLabel } from '@/lib/identity';

function ComposeForm() {
  const { identity } = useIdentity();
  const searchParams = useSearchParams();
  const replyToId = searchParams.get('reply_to');

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [template, setTemplate] = useState<TemplateId>(TEMPLATES[0].id);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ url: string; qrUrl: string; id: string } | null>(null);
  const [error, setError] = useState('');
  const [replyParent, setReplyParent] = useState<Letter | null>(null);

  useEffect(() => {
    if (!replyToId) {
      setReplyParent(null);
      return;
    }
    apiFetch<Letter>(`/letters/${replyToId}`)
      .then(setReplyParent)
      .catch(() => setReplyParent(null));
  }, [replyToId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const data = await apiFetch<{ id: string; url: string; qrUrl: string }>('/letters', {
        method: 'POST',
        body: JSON.stringify({
          title,
          content,
          template,
          ...(replyToId ? { reply_to: replyToId } : {}),
        }),
      });
      setResult(data);
      setTitle('');
      setContent('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send letter');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {result && (
        <div className="mora-card animate-fade-in-up mb-8 border-mora-beige-200">
          <span className="mora-badge mb-4">Letter saved</span>
          <p className="font-display mb-4 text-lg font-medium text-mora-brown-800">
            Your letter has been sealed & saved
          </p>
          <div className="space-y-2 font-body text-sm text-mora-brown-600">
            <p>
              Letter link:{' '}
              <a href={result.url} className="text-mora-brown-700 underline" target="_blank" rel="noreferrer">
                {result.url}
              </a>
            </p>
            <p>
              QR page:{' '}
              <a href={result.qrUrl} className="text-mora-brown-700 underline" target="_blank" rel="noreferrer">
                {result.qrUrl}
              </a>
            </p>
          </div>
          <Link href={`/qr/${result.id}`} className="mora-btn-primary mt-5 inline-flex">
            Print QR Code
          </Link>
        </div>
      )}

      <form onSubmit={handleSubmit} className="mora-card space-y-6">
        <div>
          <h2 className="font-display mb-1 text-xl font-semibold text-mora-brown-800">
            {replyParent ? 'Reply' : 'Compose'}
          </h2>
          <p className="font-body text-sm text-mora-brown-500">
            Writing as {identity ? `${authorEmoji(identity)} ${authorLabel(identity)}` : '…'}
          </p>
          {replyParent && (
            <p className="font-body mt-2 text-sm italic text-mora-brown-500">
              ↳ Replying to{' '}
              <Link href={`/letter/${replyParent.id}`} className="underline hover:text-mora-brown-700">
                {replyParent.title}
              </Link>
              {' · '}
              <Link href="/" className="underline hover:text-mora-brown-700">
                Cancel
              </Link>
            </p>
          )}
        </div>

        <div>
          <label className="mb-3 block font-body text-sm font-medium text-mora-brown-600">
            Choose Paper
          </label>
          <div className="grid gap-4 sm:grid-cols-3">
            {TEMPLATES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTemplate(t.id)}
                className={`overflow-hidden rounded-2xl border-2 transition ${
                  template === t.id
                    ? 'border-mora-brown-500 shadow-soft'
                    : 'border-mora-beige-200 opacity-80 hover:opacity-100'
                }`}
              >
                <div
                  className="h-28 bg-cover bg-center"
                  style={{ backgroundImage: `url(${t.background})` }}
                />
                <p className="bg-mora-beige-50 px-4 py-3 font-body text-sm text-mora-brown-700">
                  {t.name}
                </p>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-2 block font-body text-sm font-medium text-mora-brown-600">Title</label>
          <input
            className="mora-input"
            placeholder="To my dearest..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </div>

        <div>
          <label className="mb-2 block font-body text-sm font-medium text-mora-brown-600">
            Letter Body
          </label>
          <textarea
            className="mora-textarea"
            placeholder="Write from your heart..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            required
          />
        </div>

        {error && <p className="font-body text-sm text-red-700">{error}</p>}

        <button type="submit" className="mora-btn-primary w-full sm:w-auto" disabled={loading}>
          {loading ? 'Sealing...' : replyParent ? 'Seal & Reply' : 'Seal & Send'}
        </button>
      </form>
    </>
  );
}

export default function HomePage() {
  return (
    <SiteShell>
      <MoraHero
        title="The Letterbook"
        subtitle="Slow down, choose your paper, and write each word with care — just like a craftsman shaping something precious."
        image={TEMPLATES[0].background}
      />

      <section className="mx-auto max-w-3xl px-5 pb-20 sm:px-8">
        <Suspense fallback={<BookLoader label="Loading…" />}>
          <ComposeForm />
        </Suspense>
      </section>
    </SiteShell>
  );
}
