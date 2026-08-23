import { TEMPLATES } from '@/lib/api';

interface LetterPaperProps {
  template: string;
  title: string;
  content: string;
  children?: React.ReactNode;
}

export function LetterPaper({ template, title, content, children }: LetterPaperProps) {
  const tpl = TEMPLATES.find((t) => t.id === template) || TEMPLATES[0];

  return (
    <div className="relative mx-auto w-full max-w-2xl">
      <div
        className="absolute -top-3 left-1/2 z-20 h-7 w-20 -translate-x-1/2 rounded-sm opacity-70"
        style={{
          background: 'linear-gradient(135deg, #E0D6C8, #D4C9B8)',
          boxShadow: '0 1px 3px rgba(61,52,41,0.1)',
        }}
        aria-hidden
      />

      <article
        className="relative overflow-hidden rounded-mora-lg shadow-letter"
        style={{
          backgroundImage: `url(${tpl.background})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="relative bg-paper-texture px-8 py-12 sm:px-12 sm:py-16">
          <div className="mb-6 flex items-center gap-3">
            <span className="h-px flex-1 bg-gradient-to-r from-transparent via-mora-brown-400/30 to-transparent" />
            <span className="font-display text-xl text-mora-brown-500">✦</span>
            <span className="h-px flex-1 bg-gradient-to-r from-transparent via-mora-brown-400/30 to-transparent" />
          </div>

          <h1 className="font-display mb-8 text-center text-2xl font-semibold text-mora-brown-800 sm:text-3xl">
            {title}
          </h1>

          <div
            className="font-body mx-auto w-[60%] whitespace-pre-wrap text-lg leading-relaxed text-mora-brown-700"
            style={{ textIndent: '1.5em' }}
          >
            {content}
          </div>

          <div className="mt-10 flex items-center gap-3">
            <span className="h-px flex-1 bg-gradient-to-r from-transparent via-mora-brown-400/20 to-transparent" />
            <span className="font-body text-xs tracking-[0.3em] text-mora-brown-400 uppercase">
              ~ love you ~
            </span>
            <span className="h-px flex-1 bg-gradient-to-r from-transparent via-mora-brown-400/20 to-transparent" />
          </div>

          {children}
        </div>
      </article>
    </div>
  );
}
