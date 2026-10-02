'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import QRCode from 'qrcode';
import { SiteShell } from '@/components/SiteShell';
import { apiFetch, type Letter } from '@/lib/api';
import { OrbitLoader } from '@/components/brand';

export function QRView({ id }: { id: string }) {
  const [letter, setLetter] = useState<Letter | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    apiFetch<Letter>(`/letters/${id}`)
      .then(async (data) => {
        setLetter(data);
        const url =
          typeof window !== 'undefined'
            ? `${window.location.origin}/letter/${id}`
            : `/letter/${id}`;
        const qr = await QRCode.toDataURL(url, {
          width: 320,
          margin: 2,
          color: { dark: '#232858', light: '#FFFFFF' },
        });
        setQrDataUrl(qr);
      })
      .catch(() => setError('Letter not found'));
  }, [id]);

  if (error) {
    return (
      <SiteShell>
        <div className="flex min-h-[50vh] items-center justify-center">
          <p className="font-body text-[17px] text-ink-600">This letter could not be found.</p>
        </div>
      </SiteShell>
    );
  }

  if (!letter || !qrDataUrl) {
    return (
      <SiteShell>
        <div className="flex min-h-[50vh] items-center justify-center">
          <OrbitLoader label="Making the QR code…" />
        </div>
      </SiteShell>
    );
  }

  return (
    <SiteShell>
      <div className="flex min-h-[60vh] items-center justify-center p-6">
        <div className="glass-card animate-fade-in-up max-w-md text-center">
          <h1 className="mb-2 font-display text-3xl font-semibold text-ink-800">{letter.title}</h1>
          <p className="mb-6 font-body text-[15px] text-ink-500">Scan with a phone camera to open the envelope</p>

          <div className="mx-auto inline-block max-w-full rounded-[1.75rem] bg-white p-4 shadow-[0_12px_32px_-12px_rgba(35,40,88,0.3)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qrDataUrl}
              alt={`QR code for letter ${letter.title}`}
              width={320}
              height={320}
              className="h-auto w-full max-w-[280px] rounded-xl"
            />
          </div>

          <p className="mt-6 font-body text-[14px] text-ink-400">
            Print it or save a screenshot to hand over
          </p>

          <div className="mt-6 flex justify-center gap-3">
            <Link href={`/letter/${id}`} className="btn text-sm">
              Open letter
            </Link>
            <Link href="/" className="btn text-sm">
              Write another
            </Link>
          </div>
        </div>
      </div>
    </SiteShell>
  );
}
