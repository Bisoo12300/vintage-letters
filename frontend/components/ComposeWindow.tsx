'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch, PETS_CHANGED } from '@/lib/api';
import { TEMPLATES } from '@/lib/papers';
import { authorLabel } from '@/lib/identity';
import { PlanModal } from '@/components/plans/PlanModal';
import { TemplatePicker } from '@/components/TemplatePicker';
import { LetterPaper } from '@/components/LetterPaper';
import { AuthorGlyph, LogoMark } from '@/components/brand';
import { useIdentity } from '@/components/IdentityGate';

export interface SentLetter {
  id: string;
  url: string;
  qrUrl: string;
}

/**
 * The letter composer, as a window: opened from Mine → New letter, or from
 * "Write back" on a letter (pass `replyTo`). An unsent draft survives closing
 * the window; it is cleared once the letter is sent.
 */
export function ComposeWindow({
  open,
  onClose,
  replyTo,
  onSent,
}: {
  open: boolean;
  onClose: () => void;
  replyTo?: { id: string; title: string } | null;
  onSent?: (letter: SentLetter) => void;
}) {
  const { identity } = useIdentity();
  const recipient = authorLabel(identity === 'moon' ? 'sun' : 'moon');

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [template, setTemplate] = useState(TEMPLATES[0].id);
  const [notify, setNotify] = useState(true);
  const [tab, setTab] = useState<'write' | 'preview'>('write');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState<(SentLetter & { notified: boolean }) | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSent(null);
    setError('');
    setCopied(false);
    setTab('write');
  }, [open]);

  const ready = title.trim() !== '' && content.trim() !== '';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready || loading) return;
    setLoading(true);
    setError('');
    try {
      const data = await apiFetch<SentLetter>('/letters', {
        method: 'POST',
        body: JSON.stringify({
          title,
          content,
          template,
          notify,
          ...(replyTo ? { reply_to: replyTo.id } : {}),
        }),
      });
      setSent({ ...data, notified: notify });
      setTitle('');
      setContent('');
      onSent?.(data);
      window.dispatchEvent(new Event(PETS_CHANGED)); // a cat just set off with the letter
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The letter could not be sent. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <PlanModal
      open={open}
      onClose={onClose}
      title={sent ? 'Sealed and sent' : replyTo ? 'Write back' : 'New letter'}
      className={sent ? 'max-w-md' : 'max-w-2xl lg:max-w-5xl'}
    >
      {sent ? (
        <div className="animate-fade-in-up flex flex-col items-center pb-2 pt-4 text-center">
          <LogoMark className="h-14 w-14 drop-shadow-[0_8px_20px_rgba(35,40,88,0.25)]" />
          <p className="mt-4 max-w-xs font-body text-[15px] leading-relaxed text-ink-500">
            {sent.notified
              ? `${recipient} has been told a letter is waiting.`
              : `Sent quietly. It is waiting in ${recipient}'s inbox with no notification.`}{' '}
            Share the link or print the QR code to hand it over in person.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <button
              type="button"
              className="btn"
              onClick={() =>
                navigator.clipboard
                  ?.writeText(sent.url)
                  .then(() => setCopied(true))
                  .catch(() => {})
              }
            >
              {copied ? 'Link copied' : 'Copy link'}
            </button>
            <Link href={`/qr/${sent.id}`} className="btn">
              Print QR
            </Link>
            <button type="button" className="btn" onClick={() => setSent(null)}>
              Write another
            </button>
            <button type="button" className="btn-primary" onClick={onClose}>
              Done
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="flex items-center gap-3">
            {identity && <AuthorGlyph author={identity} className="h-9 w-9 shrink-0" />}
            <div className="min-w-0">
              <p className="font-body text-[15px] font-semibold text-ink-800">
                To {recipient}
                {identity && <span className="font-normal text-ink-500">, from {authorLabel(identity)}</span>}
              </p>
              {replyTo && <p className="truncate font-body text-[13px] text-ink-500">In reply to “{replyTo.title}”</p>}
            </div>
          </div>

          {/* Phones switch between writing and the preview; wide screens show both */}
          <div className="segmented grid-cols-2 lg:hidden">
            <span
              aria-hidden
              className="absolute bottom-1 left-1 top-1 w-[calc(50%-0.25rem)] rounded-full bg-white shadow-[0_2px_8px_rgba(35,40,88,0.15)] transition-transform duration-500 ease-spring"
              style={{ transform: tab === 'preview' ? 'translateX(100%)' : 'none' }}
            />
            {(['write', 'preview'] as const).map((id) => (
              <button
                key={id}
                type="button"
                aria-pressed={tab === id}
                onClick={() => setTab(id)}
                className={`relative z-10 rounded-full py-2 font-body text-[14px] font-semibold capitalize transition-colors ${
                  tab === id ? 'text-ink-800' : 'text-ink-500'
                }`}
              >
                {id}
              </button>
            ))}
          </div>

          <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,23rem)] lg:gap-7">
            <div className={`min-w-0 space-y-5 ${tab === 'preview' ? 'hidden lg:block' : ''}`}>
              <TemplatePicker value={template} onChange={setTemplate} />

              <label className="block">
                <span className="mb-2 block font-body text-[13px] font-semibold text-ink-500">Title</span>
                <input
                  className="field font-letter"
                  placeholder="To my dearest…"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </label>

              <label className="block">
                <span className="mb-2 block font-body text-[13px] font-semibold text-ink-500">Letter</span>
                <textarea
                  className="field-area font-letter leading-[1.8]"
                  placeholder="Write from your heart…"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                />
              </label>
            </div>

            <div className={`min-w-0 ${tab === 'write' ? 'hidden lg:block' : ''}`}>
              <p className="mb-2 hidden font-body text-[13px] font-semibold text-ink-500 lg:block">Preview</p>
              <LetterPaper
                template={template}
                title={title || 'To my dearest…'}
                content={content || 'Your words will appear here, on the paper you chose.'}
                author={identity ?? undefined}
                replyToTitle={replyTo?.title}
              />
            </div>
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={notify}
            onClick={() => setNotify((v) => !v)}
            className="flex w-full items-center gap-3 rounded-2xl bg-white/55 px-4 py-3 text-left transition-colors hover:bg-white/75"
          >
            <span className="min-w-0 flex-1">
              <span className="block font-body text-[15px] font-semibold text-ink-800">Notify {recipient}</span>
              <span className="block font-body text-[13px] text-ink-500">
                {notify
                  ? `${recipient} gets a notification as soon as it is sent.`
                  : `No notification. The letter waits quietly in the inbox.`}
              </span>
            </span>
            <span
              aria-hidden
              className={`relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors duration-300 ${
                notify ? 'bg-ink-800' : 'bg-ink-800/20'
              }`}
            >
              <span
                className="absolute left-[2px] top-[2px] h-[27px] w-[27px] rounded-full bg-white shadow-[0_2px_5px_rgba(35,40,88,0.3)] transition-transform duration-500 ease-spring"
                style={{ transform: notify ? 'translateX(20px)' : 'none' }}
              />
            </span>
          </button>

          {error && <p className="font-body text-[14px] text-rose">{error}</p>}

          <button type="submit" className="btn-primary w-full sm:w-auto sm:px-8" disabled={!ready || loading}>
            {loading ? 'Sealing…' : notify ? 'Seal and send' : 'Seal and send quietly'}
          </button>
        </form>
      )}
    </PlanModal>
  );
}
