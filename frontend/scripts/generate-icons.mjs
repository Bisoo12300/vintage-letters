import { readFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const svgPath = join(__dirname, '..', 'app', 'icon.svg');
const outDir = join(__dirname, '..', 'public', 'icons');
const svg = readFileSync(svgPath);

mkdirSync(outDir, { recursive: true });

async function main() {
  await sharp(svg).resize(192, 192).png().toFile(join(outDir, 'icon-192.png'));
  await sharp(svg).resize(512, 512).png().toFile(join(outDir, 'icon-512.png'));

  const inner = await sharp(svg).resize(360, 360).png().toBuffer();
  await sharp({
    create: { width: 512, height: 512, channels: 4, background: '#FAF8F4' },
  })
    .composite([{ input: inner, gravity: 'center' }])
    .png()
    .toFile(join(outDir, 'icon-512-maskable.png'));

  console.log('Generated PWA icons in', outDir);
}

main();
