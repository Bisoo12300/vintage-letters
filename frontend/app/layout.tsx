import type { Metadata, Viewport } from 'next';
import { Lora, Nunito } from 'next/font/google';
import { IdentityGate } from '@/components/IdentityGate';
import './globals.css';

const nunito = Nunito({
  subsets: ['latin'],
  variable: '--font-nunito',
  weight: ['400', '500', '600', '700'],
});

const lora = Lora({
  subsets: ['latin'],
  variable: '--font-lora',
  weight: ['400', '500', '600', '700'],
  style: ['normal', 'italic'],
});

export const metadata: Metadata = {
  title: 'Clair de Lune',
  description: 'Write letters on aged paper, share through QR codes',
};

export const viewport: Viewport = {
  themeColor: '#6B5A4A',
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${nunito.variable} ${lora.variable}`}>
      <body>
        <IdentityGate>{children}</IdentityGate>
      </body>
    </html>
  );
}
