import Link from 'next/link';
import { findTemplate, paperSheetStyle, type PaperView } from '@/lib/papers';
import { authorLabel } from '@/lib/identity';
import { AuthorGlyph, LogoMark } from '@/components/brand';

/**
 * A sheet of the chosen paper. Children are laid out on the blank part of the
 * artwork, never over its decoration. `view` picks a miniature framing: `fit`
 * for thumbnails, `paper` for the letter inside the envelope.
 */
export function PaperSheet({
  template,
  view,
  className = '',
  children,
}: {
  template: string;
  view?: PaperView;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={`paper-wrap ${className}`}>
      <div className="paper-sheet" style={paperSheetStyle(findTemplate(template), view)}>
        {children}
      </div>
    </div>
  );
}

interface LetterPaperProps {
  template: string;
  title: string;
  content: string;
  author?: string;
  replyToId?: string | null;
  replyToTitle?: string | null;
  children?: React.ReactNode;
}

export function LetterPaper({
  template,
  title,
  content,
  author,
  replyToId,
  replyToTitle,
  children,
}: LetterPaperProps) {
  const tpl = findTemplate(template);
  const ruled = tpl.kind === 'frame' && tpl.ruled;

  return (
    <article className="mx-auto w-full max-w-2xl">
      <PaperSheet template={template} className="rounded-[1.5rem] shadow-letter ring-1 ring-black/5 sm:rounded-[2rem]">
        <LogoMark className="mx-auto mb-5 h-7 w-7 opacity-80" />

        <h1 className="text-balance text-center font-letter text-[1.6rem] font-semibold leading-tight text-ink-800 sm:text-[2.1rem]">
          {title}
        </h1>

        {author && (
          <p className="mt-3 flex items-center justify-center gap-1.5 font-body text-[14px] font-medium text-ink-500">
            <AuthorGlyph author={author} className="h-4 w-4" />
            From {authorLabel(author)}
          </p>
        )}
        {replyToTitle && (
          <p className="mt-1.5 text-center font-body text-[13px] text-ink-400">
            In reply to{' '}
            {replyToId ? (
              <Link href={`/letter/${replyToId}`} className="underline decoration-ink-300 underline-offset-2 hover:text-ink-700">
                {replyToTitle}
              </Link>
            ) : (
              replyToTitle
            )}
          </p>
        )}

        <div
          className={`mt-8 whitespace-pre-wrap font-letter text-[16px] leading-[1.85] text-ink-800/90 sm:mt-10 sm:text-[18px] ${
            ruled ? 'paper-ruled' : ''
          }`}
          style={{ textIndent: '1.5em' }}
        >
          {content}
        </div>

        <p className="mt-10 text-center font-letter text-[17px] italic text-ink-500">with love</p>

        {children}
      </PaperSheet>
    </article>
  );
}
