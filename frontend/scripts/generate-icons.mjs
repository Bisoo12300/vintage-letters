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

  // Maskable: full-bleed sky (no rounded corners) so the OS mask never shows a seam;
  // the heart already sits inside the 80% safe zone.
  const fullBleed = readFileSync(join(__dirname, '..', 'app', 'apple-icon.svg'));
  await sharp(fullBleed).resize(512, 512).png().toFile(join(outDir, 'icon-512-maskable.png'));
  // Next.js only picks up apple-icon as png/jpg — iOS rounds the corners itself.
  await sharp(fullBleed).resize(180, 180).png().toFile(join(__dirname, '..', 'app', 'apple-icon.png'));

  console.log('Generated PWA icons in', outDir);
}

main();
