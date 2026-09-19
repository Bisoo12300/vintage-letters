import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Clair de Lune',
    short_name: 'Clair de Lune',
    description: 'Write letters on aged paper, share through QR codes',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#FAF8F4',
    theme_color: '#6B5A4A',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
