'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import QRCode from 'qrcode';
import { SiteShell } from '@/components/SiteShell';
import { apiFetch, type Letter } from '@/lib/api';

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
          color: { dark: '#3D3429', light: '#FAF8F4' },
        });
        setQrDataUrl(qr);
      })
      .catch(() => setError('Letter not found'));
  }, [id]);

  if (error) {
    return (
      <SiteShell>
        <div className="flex min-h-[50vh] items-center justify-center">
          <p className="font-body text-mora-brown-700">{error}</p>
        </div>
      </SiteShell>
    );
  }

  if (!letter || !qrDataUrl) {
    return (
      <SiteShell>
        <div className="flex min-h-[50vh] items-center justify-center">
          <p className="font-display animate-pulse text-xl text-mora-brown-400">Crafting QR code...</p>
        </div>
      </SiteShell>
    );
  }

  return (
    <SiteShell>
      <div className="flex min-h-[60vh] items-center justify-center p-6">
        <div className="mora-card animate-fade-in-up max-w-md text-center">
          <h1 className="font-display mb-2 text-2xl font-semibold text-mora-brown-800">{letter.title}</h1>
          <p className="font-body mb-6 text-sm text-mora-brown-500">Scan to open this letter</p>

          <div className="mx-auto inline-block max-w-full rounded-2xl border-4 border-mora-beige-200 bg-mora-cream p-4 shadow-soft">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qrDataUrl}
              alt={`QR code for letter ${letter.title}`}
              width={320}
              height={320}
              className="h-auto w-full max-w-[280px] rounded-xl"
            />
          </div>

          <p className="mt-6 font-body text-sm text-mora-brown-400">
            Print or screenshot for your recipient
          </p>

          <div className="mt-6 flex justify-center gap-3">
            <Link href={`/letter/${id}`} className="mora-btn text-sm">
              View Letter
            </Link>
            <Link href="/" className="mora-btn text-sm">
              Compose New
            </Link>
          </div>
        </div>
      </div>
    </SiteShell>
  );
}
