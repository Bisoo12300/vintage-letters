import type { Metadata, Viewport } from 'next';
import { Cormorant_Garamond, Lora } from 'next/font/google';
import { IdentityGate } from '@/components/IdentityGate';
import { Sky } from '@/components/brand';
import { IDENTITY_KEY } from '@/lib/identity';
import './globals.css';

const cormorant = Cormorant_Garamond({
  subsets: ['latin', 'vietnamese'],
  variable: '--font-cormorant',
  weight: ['500', '600', '700'],
  style: ['normal', 'italic'],
});

const lora = Lora({
  subsets: ['latin', 'vietnamese'],
  variable: '--font-lora',
  weight: ['400', '500', '600'],
  style: ['normal', 'italic'],
});

export const metadata: Metadata = {
  title: 'Clair de Lune',
  description: 'Letters between the Moon and the Sun',
};

export const viewport: Viewport = {
  themeColor: '#DCDCF3',
  viewportFit: 'cover',
};

// Tint the sky before first paint so returning users don't see a flash.
const identityScript = `try{var i=localStorage.getItem('${IDENTITY_KEY}');if(i==='moon'||i==='sun')document.documentElement.dataset.identity=i}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${cormorant.variable} ${lora.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: identityScript }} />
      </head>
      <body>
        <Sky />
        <IdentityGate>{children}</IdentityGate>
      </body>
    </html>
  );
}
