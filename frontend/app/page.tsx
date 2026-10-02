'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { apiFetch, TEMPLATES, type Letter, type TemplateId } from '@/lib/api';
import { PageHero, SiteShell } from '@/components/SiteShell';
import { AuthorGlyph, OrbitLoader } from '@/components/brand';
import { useIdentity } from '@/components/IdentityGate';
import { authorLabel } from '@/lib/identity';

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
      setError(err instanceof Error ? err.message : 'The letter could not be sent. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {result && (
        <div className="glass-card animate-fade-in-up mb-6 flex flex-col gap-5 sm:flex-row sm:items-center">
          <div className="flex-1">
            <p className="font-display text-2xl font-semibold text-ink-800">Sealed and sent</p>
            <p className="mt-1 font-body text-[15px] text-ink-500">
              It's waiting in their inbox. Share the link or print the QR code to hand it over in person.
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              className="btn"
              onClick={() => navigator.clipboard?.writeText(result.url).catch(() => {})}
            >
              Copy link
            </button>
            <Link href={`/qr/${result.id}`} className="btn-primary">
              Print QR
            </Link>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="glass-card space-y-7">
        <div className="flex items-center gap-3">
          {identity && <AuthorGlyph author={identity} className="h-9 w-9" />}
          <div>
            <p className="font-body text-[15px] font-semibold text-ink-800">
              {replyParent ? 'Writing back' : 'New letter'}
              {identity && <span className="font-normal text-ink-500"> as {authorLabel(identity)}</span>}
            </p>
            {replyParent && (
              <p className="font-body text-[13px] text-ink-500">
                To{' '}
                <Link href={`/letter/${replyParent.id}`} className="underline decoration-ink-300 underline-offset-2">
                  {replyParent.title}
                </Link>
                {' · '}
                <Link href="/" className="text-ink-600 underline decoration-ink-300 underline-offset-2">
                  Cancel
                </Link>
              </p>
            )}
          </div>
        </div>

        <fieldset>
          <legend className="mb-3 font-body text-[13px] font-semibold text-ink-500">Paper</legend>
          <div className="grid grid-cols-3 gap-3">
            {TEMPLATES.map((t) => {
              const active = template === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTemplate(t.id)}
                  aria-pressed={active}
                  className={`group relative overflow-hidden rounded-2xl transition-transform duration-500 ease-spring active:scale-95 ${
                    active ? 'scale-[1.02] ring-2 ring-ink-800 ring-offset-2 ring-offset-white/0' : 'opacity-80 hover:opacity-100'
                  }`}
                >
                  <div className="aspect-[4/5] bg-cover bg-center sm:aspect-[4/3]" style={{ backgroundImage: `url(${t.background})` }} />
                  <span className="glass absolute inset-x-1.5 bottom-1.5 truncate rounded-xl px-2 py-1 text-center font-body text-[12px] font-semibold text-ink-800">
                    {t.name}
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>

        <label className="block">
          <span className="mb-2 block font-body text-[13px] font-semibold text-ink-500">Title</span>
          <input
            className="field font-letter"
            placeholder="To my dearest…"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </label>

        <label className="block">
          <span className="mb-2 block font-body text-[13px] font-semibold text-ink-500">Letter</span>
          <textarea
            className="field-area font-letter leading-[1.8]"
            placeholder="Write from your heart…"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            required
          />
        </label>

        {error && <p className="font-body text-[14px] text-rose">{error}</p>}

        <button type="submit" className="btn-primary w-full sm:w-auto sm:px-8" disabled={loading}>
          {loading ? 'Sealing…' : replyParent ? 'Seal and send reply' : 'Seal and send'}
        </button>
      </form>
    </>
  );
}

export default function HomePage() {
  return (
    <SiteShell>
      <PageHero
        title="Write to the other half of your sky"
        subtitle="Pick a paper, take your time, and seal it. They'll open it like a real envelope."
      />

      <section className="mx-auto max-w-3xl px-4 sm:px-8">
        <Suspense fallback={<OrbitLoader label="Loading…" />}>
          <ComposeForm />
        </Suspense>
      </section>
    </SiteShell>
  );
}
