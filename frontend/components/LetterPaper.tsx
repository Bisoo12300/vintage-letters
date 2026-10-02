import Link from 'next/link';
import { TEMPLATES } from '@/lib/api';
import { authorLabel } from '@/lib/identity';
import { AuthorGlyph, LogoMark } from '@/components/brand';

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
  const tpl = TEMPLATES.find((t) => t.id === template) || TEMPLATES[0];

  return (
    <article
      className="relative mx-auto w-full max-w-2xl overflow-hidden rounded-[2rem] shadow-letter ring-1 ring-white/60"
      style={{
        backgroundImage: `url(${tpl.background})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <div className="relative bg-paper-texture px-6 pb-12 pt-10 sm:px-14 sm:pb-16 sm:pt-14">
        <LogoMark className="mx-auto mb-6 h-7 w-7 opacity-80" />

        <h1 className="text-balance text-center font-letter text-[1.75rem] font-semibold leading-tight text-ink-800 sm:text-[2.1rem]">
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
          className="mx-auto mt-10 max-w-[34rem] whitespace-pre-wrap font-letter text-[17px] leading-[1.85] text-ink-800/90 sm:text-[18px]"
          style={{ textIndent: '1.5em' }}
        >
          {content}
        </div>

        <p className="mt-12 text-center font-letter text-[17px] italic text-ink-500">with love</p>

        {children}
      </div>
    </article>
  );
}
