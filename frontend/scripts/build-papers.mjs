// Builds the letter papers in public/backgrounds. Run: node scripts/build-papers.mjs
//
// Photo papers (daisy, torn, christmas) are cut into a top cap, a mirrored
// repeatable band and a feathered bottom cap, so a letter of any length keeps
// the artwork undistorted. Frame papers are drawn here as 9-slice SVGs.
// The numbers in PHOTOS must match TEMPLATES in lib/api.ts.
import sharp from 'sharp';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(root, 'public', 'backgrounds');

/* ─── Photo papers ───────────────────────────────────────────────────────── */

const PHOTOS = [
  { id: 'daisy-paper', width: 1400, top: 0.4, band: 0.16, bottom: 0.72 },
  { id: 'torn-beige', width: 1400, top: 0.56, band: 0.14, bottom: 0.76 },
  // Cropped to the sheet itself; the printed ruled lines are removed so text can flow freely.
  { id: 'christmas-letter', cropToPaper: true, top: 0.295, band: 0.16, bottom: 0.8, deline: true },
];

/** Bounding box of the light sheet on the dark backdrop (christmas). */
async function paperBox(src) {
  const { data, info } = await sharp(src).greyscale().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const light = (x, y) => data[y * w + x] > 150;
  const cx = w >> 1;
  const cy = h >> 1;
  let x0 = cx, x1 = cx, y0 = cy, y1 = cy;
  while (x0 > 0 && light(x0 - 1, cy)) x0--;
  while (x1 < w - 1 && light(x1 + 1, cy)) x1++;
  // Walk a column near the left edge: the centre column crosses dark artwork.
  const px = x0 + Math.round((x1 - x0) * 0.08);
  while (y0 > 0 && light(px, y0 - 1)) y0--;
  while (y1 < h - 1 && light(px, y1 + 1)) y1++;
  const pad = 3; // stay inside the drop shadow
  return { left: x0 + pad, top: y0 + pad, width: x1 - x0 + 1 - pad * 2, height: y1 - y0 + 1 - pad * 2 };
}

/** Replace thin dark horizontal rules with the rows around them (in place, RGB). */
function removeRules(data, w, h, { x0, x1, y0 = 0, y1 = h }) {
  const a = Math.round(w * 0.3);
  const b = Math.round(w * 0.6);
  const mean = [];
  for (let y = 0; y < h; y++) {
    let s = 0;
    for (let x = a; x < b; x++) s += data[(y * w + x) * 3 + 1];
    mean.push(s / (b - a));
  }
  const sorted = [...mean].sort((p, q) => p - q);
  const base = sorted[sorted.length >> 1];
  const isRule = (y) => mean[y] < base - 4;
  for (let y = y0; y < y1; y++) {
    if (!isRule(y)) continue;
    let end = y;
    while (end + 1 < y1 && isRule(end + 1)) end++;
    if (end - y > 8) {
      y = end; // too tall to be a rule: artwork, leave it
      continue;
    }
    const up = Math.max(0, y - 2);
    const down = Math.min(h - 1, end + 2);
    for (let yy = up + 1; yy < down; yy++) {
      const t = (yy - up) / (down - up);
      for (let x = x0; x < x1; x++) {
        for (let c = 0; c < 3; c++) {
          const i = (yy * w + x) * 3 + c;
          data[i] = Math.round(data[(up * w + x) * 3 + c] * (1 - t) + data[(down * w + x) * 3 + c] * t);
        }
      }
    }
    y = end;
  }
}

async function buildPhoto(p) {
  const src = path.join(OUT, `${p.id}.jpg`);
  let img = sharp(src);
  if (p.cropToPaper) img = img.extract(await paperBox(src));
  if (p.width) img = img.resize({ width: p.width });
  const { data, info } = await img.removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const raw = { raw: { width: w, height: h, channels: 3 } };
  const rows = (f) => Math.round(f * h);

  if (p.deline) {
    // Only the ruled zone between the header and the footer; the stamp (right of 71%) is left alone.
    removeRules(data, w, h, { x0: Math.round(w * 0.08), x1: Math.round(w * 0.92), y0: rows(p.top), y1: rows(p.bottom) });
    removeRules(data, w, h, { x0: Math.round(w * 0.08), x1: Math.round(w * 0.71), y0: rows(p.bottom), y1: rows(0.88) });
  }

  const webp = { quality: 82 };
  const topH = rows(p.top);
  await sharp(data, raw).extract({ left: 0, top: 0, width: w, height: topH }).webp(webp).toFile(path.join(OUT, `${p.id}-top.webp`));

  // Band + its mirror image tiles seamlessly and continues the top cap.
  const bandH = rows(p.band);
  const band = await sharp(data, raw).extract({ left: 0, top: topH, width: w, height: bandH }).png().toBuffer();
  const flipped = await sharp(band).flip().png().toBuffer();
  await sharp({ create: { width: w, height: bandH * 2, channels: 3, background: '#fff' } })
    .composite([{ input: band, top: 0, left: 0 }, { input: flipped, top: bandH, left: 0 }])
    .webp(webp)
    .toFile(path.join(OUT, `${p.id}-tile.webp`));

  // Bottom cap fades in over its first rows so it blends into whatever band row it lands on.
  const bottomTop = rows(p.bottom);
  const bottomH = h - bottomTop;
  const mask = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${bottomH}"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset="0.16" stop-color="#fff"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/></svg>`
  );
  await sharp(data, raw)
    .extract({ left: 0, top: bottomTop, width: w, height: bottomH })
    .ensureAlpha()
    .composite([{ input: mask, blend: 'dest-in' }])
    .webp(webp)
    .toFile(path.join(OUT, `${p.id}-bottom.webp`));

  console.log(`${p.id}: ${w}x${h} ratio ${(h / w).toFixed(4)}`);
}

/* ─── Frame papers (SVG, 9-slice) ────────────────────────────────────────────
   600x400: top band 110, repeatable middle 200, bottom band 90, side bands 40.
   Top and bottom bands render exactly as drawn; the middle rows repeat down the
   page, so anything in the side bands there must tile every 200 units. */

const W = 600;
const H = 400;

function rng(seed) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const n = (v) => +v.toFixed(1);
const sparkle = (x, y, r, fill, o = 1) =>
  `<path d="M${n(x)} ${n(y - r)}Q${n(x)} ${n(y)} ${n(x + r)} ${n(y)}Q${n(x)} ${n(y)} ${n(x)} ${n(y + r)}Q${n(x)} ${n(y)} ${n(x - r)} ${n(y)}Q${n(x)} ${n(y)} ${n(x)} ${n(y - r)}Z" fill="${fill}" opacity="${o}"/>`;
const dot = (x, y, r, fill, o = 1) => `<circle cx="${n(x)}" cy="${n(y)}" r="${r}" fill="${fill}" opacity="${o}"/>`;
const svg = (body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${W * 2}" height="${H * 2}" viewBox="0 0 ${W} ${H}">${body}</svg>\n`;

function moonlitNight() {
  const paper = '#FBF6EA';
  const gold = '#D9B45F';
  const r = rng(7);
  let scallops = '';
  for (let i = 0; i < 20; i++) scallops += 'q-15 15 -30 0';
  let stars = '';
  for (let i = 0; i < 34; i++) {
    const x = 16 + r() * 568;
    const y = 8 + r() * 58;
    if (Math.hypot(x - 508, y - 40) < 40) continue;
    stars += r() < 0.35 ? sparkle(x, y, 3 + r() * 4, '#FFF4C9', 0.95) : dot(x, y, 0.7 + r() * 0.9, '#fff', 0.5 + r() * 0.5);
  }
  return svg(`
<defs>
  <linearGradient id="night" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#141943"/><stop offset="1" stop-color="#2E3679"/></linearGradient>
  <mask id="crescent"><rect width="${W}" height="${H}" fill="#fff"/><circle cx="518" cy="33" r="19"/></mask>
</defs>
<rect width="${W}" height="${H}" fill="${paper}"/>
<path d="M0 0H${W}V76${scallops}Z" fill="url(#night)"/>
${stars}
<circle cx="508" cy="40" r="36" fill="#FFF4C9" opacity="0.12"/>
<circle cx="508" cy="40" r="22" fill="#FDF0BE" mask="url(#crescent)"/>
<rect x="0" y="0" width="10" height="${H}" fill="#1F2658"/>
<rect x="590" y="0" width="10" height="${H}" fill="#1F2658"/>
<rect x="0" y="390" width="${W}" height="10" fill="#1F2658"/>
<path d="M16.5 100V383.5H583.5V100" fill="none" stroke="${gold}" stroke-width="1"/>
${sparkle(28, 160, 5, gold, 0.9)}${dot(30, 262, 1.6, gold, 0.9)}${sparkle(572, 262, 5, gold, 0.9)}${dot(570, 160, 1.6, gold, 0.9)}
${sparkle(300, 352, 7, gold)}${sparkle(274, 354, 4, gold, 0.8)}${sparkle(326, 354, 4, gold, 0.8)}${dot(252, 355, 1.5, gold, 0.7)}${dot(348, 355, 1.5, gold, 0.7)}
`);
}

function goldenSunrise() {
  const paper = '#FFF9EC';
  const amber = '#EBA243';
  let rays = '';
  for (let i = 0; i <= 12; i++) {
    const a = Math.PI + (i * Math.PI) / 12;
    const r1 = 56;
    const r2 = i % 2 ? 72 : 86;
    rays += `<line x1="${n(300 + Math.cos(a) * r1)}" y1="${n(96 + Math.sin(a) * r1)}" x2="${n(300 + Math.cos(a) * r2)}" y2="${n(96 + Math.sin(a) * r2)}"/>`;
  }
  const cloud = (x, y, s) =>
    `<g fill="#fff" opacity="0.75" transform="translate(${x} ${y}) scale(${s})"><ellipse cx="0" cy="0" rx="26" ry="9"/><ellipse cx="-12" cy="-7" rx="13" ry="9"/><ellipse cx="9" cy="-9" rx="15" ry="11"/></g>`;
  let mini = '';
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    mini += `<line x1="${n(300 + Math.cos(a) * 10)}" y1="${n(375.5 + Math.sin(a) * 10)}" x2="${n(300 + Math.cos(a) * 14)}" y2="${n(375.5 + Math.sin(a) * 14)}"/>`;
  }
  return svg(`
<defs>
  <linearGradient id="dawn" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F7A072"/><stop offset="0.55" stop-color="#FFCB85"/><stop offset="1" stop-color="${paper}"/></linearGradient>
  <radialGradient id="sun" cx="0.5" cy="1" r="1"><stop offset="0" stop-color="#FFF6C9"/><stop offset="1" stop-color="#FFBE4A"/></radialGradient>
  <clipPath id="above"><rect width="${W}" height="96"/></clipPath>
</defs>
<rect width="${W}" height="${H}" fill="${paper}"/>
<rect width="${W}" height="104" fill="url(#dawn)"/>
<g clip-path="url(#above)">
  <g stroke="#FFF1C4" stroke-width="3.2" stroke-linecap="round" opacity="0.95">${rays}</g>
  <circle cx="300" cy="96" r="44" fill="url(#sun)"/>
</g>
${cloud(118, 62, 1)}${cloud(486, 48, 0.8)}${cloud(214, 30, 0.55)}
<path d="M14.5 96V378.5H585.5V96" fill="none" stroke="${amber}" stroke-width="1.4"/>
<path d="M20.5 96V372.5H579.5V96" fill="none" stroke="${amber}" stroke-width="0.8" opacity="0.7"/>
<path d="M20.5 96H579.5" stroke="${amber}" stroke-width="0.8" opacity="0.7"/>
<circle cx="300" cy="375.5" r="19" fill="${paper}"/>
<circle cx="300" cy="375.5" r="6" fill="#FFC65C" stroke="${amber}" stroke-width="1"/>
<g stroke="${amber}" stroke-width="1.6" stroke-linecap="round">${mini}</g>
`);
}

function ruledNotebook() {
  const paper = '#FDFCF6';
  let holes = '';
  for (let y = 35; y < H; y += 50) holes += `<circle cx="20" cy="${y}" r="7.5" fill="#DFE2F0" stroke="#C3C8DF" stroke-width="1"/>`;
  return svg(`
<rect width="${W}" height="${H}" fill="${paper}"/>
${holes}
<path d="M38.5 0V${H}" stroke="#E98C8C" stroke-width="1.5"/>
<path d="M0 96.5H${W}M0 101.5H${W}" stroke="#9DB4E8" stroke-width="1.2"/>
<path d="M430 62.5H566" stroke="#C9D3EE" stroke-width="1"/>
<path d="M0 322.5H${W}" stroke="#9DB4E8" stroke-width="1.2" opacity="0.7"/>
`);
}

function sakura() {
  const paper = '#FFF7F8';
  const petal = 'M0 0C-7 -6 -8.5 -15 -3 -20L0 -17L3 -20C8.5 -15 7 -6 0 0Z';
  const blossom = (x, y, s, a) => `<use href="#bl" transform="translate(${x} ${y}) rotate(${a}) scale(${s})"/>`;
  const loose = (x, y, a, s = 0.8, fill = '#F8BFD0') =>
    `<path d="${petal}" fill="${fill}" opacity="0.9" transform="translate(${x} ${y}) rotate(${a}) scale(${s})"/>`;
  let five = '';
  for (let i = 0; i < 5; i++) five += `<path d="${petal}" transform="rotate(${i * 72})"/>`;
  return svg(`
<defs>
  <g id="bl"><g fill="#F9C9D7" stroke="#F3AAC0" stroke-width="0.6">${five}</g><circle r="3.4" fill="#E9879F"/><g fill="#FFF3B8"><circle cx="0" cy="-6" r="1"/><circle cx="5.5" cy="-2" r="1"/><circle cx="3.5" cy="5" r="1"/><circle cx="-3.5" cy="5" r="1"/><circle cx="-5.5" cy="-2" r="1"/></g></g>
</defs>
<rect width="${W}" height="${H}" fill="${paper}"/>
<g fill="none" stroke="#7B5647" stroke-linecap="round">
  <path d="M-10 16C70 10 140 48 232 44S330 70 376 60" stroke-width="5"/>
  <path d="M118 30Q140 6 170 8" stroke-width="3"/>
  <path d="M236 45Q252 70 282 78" stroke-width="3"/>
  <path d="M40 16Q52 40 76 50" stroke-width="2.5"/>
</g>
${blossom(60, 20, 1.15, 10)}${blossom(170, 10, 0.95, 40)}${blossom(126, 42, 1.3, -15)}${blossom(210, 46, 1, 25)}
${blossom(284, 80, 1.1, 5)}${blossom(300, 56, 0.85, 60)}${blossom(372, 60, 1.2, -30)}${blossom(78, 54, 0.9, 50)}${blossom(18, 34, 0.8, -40)}
${dot(340, 70, 4, '#F29DB8')}${dot(150, 24, 3.5, '#F29DB8')}${dot(252, 30, 3.5, '#F29DB8')}
${loose(436, 36, 40)}${loose(486, 78, -60, 0.7, '#FAD3DE')}${loose(540, 30, 120)}${loose(580, 70, 20, 0.7)}${loose(410, 92, 200, 0.6, '#FAD3DE')}
${loose(18, 158, 35, 0.6)}${loose(28, 262, -50, 0.55, '#FAD3DE')}${loose(582, 196, 70, 0.6, '#FAD3DE')}${loose(572, 290, -25, 0.55)}
${loose(40, 384, 80)}${loose(92, 392, -30, 0.7, '#FAD3DE')}${loose(150, 386, 150, 0.75)}${loose(214, 394, 20, 0.6)}${loose(300, 388, -70, 0.7, '#FAD3DE')}${loose(372, 394, 110, 0.6)}${loose(430, 386, 10, 0.8)}
<path d="M610 350Q560 356 520 380" fill="none" stroke="#7B5647" stroke-width="3.5" stroke-linecap="round"/>
${blossom(520, 378, 1.2, 15)}${blossom(566, 352, 0.95, -35)}${dot(544, 366, 3.5, '#F29DB8')}
`);
}

function autumnLeaves() {
  const paper = '#F5E7CD';
  const leaf = (x, y, a, s, fill) =>
    `<g transform="translate(${x} ${y}) rotate(${a}) scale(${s})"><path d="M0 -26C13 -14 14 8 0 24C-14 8 -13 -14 0 -26Z" fill="${fill}"/><path d="M0 -22V34M0 -10L7 -16M0 -10L-7 -16M0 0L9 -7M0 0L-9 -7M0 10L7 4M0 10L-7 4" fill="none" stroke="#6B3F1D" stroke-width="1" stroke-linecap="round" opacity="0.55"/></g>`;
  const stitch = 'fill="none" stroke="#B58A5A" stroke-width="1.6" stroke-dasharray="10 10" stroke-linecap="round"';
  return svg(`
<rect width="${W}" height="${H}" fill="${paper}"/>
<path d="M12 12H588" ${stitch}/><path d="M12 388H588" ${stitch}/><path d="M12 12V388" ${stitch}/><path d="M588 12V388" ${stitch}/>
${leaf(44, 40, 130, 1.5, '#C2502B')}${leaf(88, 30, 100, 1.25, '#E0872F')}${leaf(34, 84, 165, 1.15, '#E6A93B')}${leaf(130, 26, 80, 0.95, '#9A5A2A')}${leaf(84, 72, 140, 0.9, '#D56A2B')}
${leaf(556, 38, -130, 1.45, '#E0872F')}${leaf(512, 28, -100, 1.15, '#C2502B')}${leaf(566, 84, -165, 1.05, '#9A5A2A')}${leaf(470, 30, -75, 0.85, '#E6A93B')}
${dot(160, 52, 3, '#9A5A2A')}${dot(172, 44, 2.2, '#C2502B')}${dot(440, 50, 3, '#C2502B')}${dot(428, 42, 2.2, '#9A5A2A')}
${leaf(560, 362, -40, 1.35, '#C2502B')}${leaf(520, 374, -75, 1.1, '#E6A93B')}${leaf(574, 328, -15, 0.95, '#E0872F')}
${leaf(42, 366, 50, 1.15, '#E0872F')}${leaf(80, 378, 80, 0.9, '#9A5A2A')}
`);
}

function airmail() {
  const paper = '#FFFEF9';
  const blue = '#2F4F9E';
  const red = '#D2423F';
  const stripe = (o, fill) =>
    `<path d="M${o} 50H${o + 15}L${o + 65} 0H${o + 50}Z" fill="${fill}"/><path d="M${o - 50} 50H${o - 35}L${o + 15} 0H${o}Z" fill="${fill}"/>`;
  let waves = '';
  for (let i = 0; i < 4; i++) waves += `<path d="M318 ${40 + i * 9}q10 -6 20 0t20 0t20 0t20 0t20 0"/>`;
  return svg(`
<defs>
  <pattern id="am" width="50" height="50" patternUnits="userSpaceOnUse">${stripe(0, red)}${stripe(25, blue)}</pattern>
</defs>
<rect width="${W}" height="${H}" fill="${paper}"/>
<path fill-rule="evenodd" d="M0 0H${W}V${H}H0ZM14 14V386H586V14Z" fill="url(#am)"/>
<g fill="none" stroke="${blue}">
  <rect x="34" y="34" width="150" height="42" rx="4" stroke-width="2"/>
  <rect x="38" y="38" width="142" height="34" rx="2" stroke-width="0.8"/>
</g>
<g fill="${blue}" font-family="Georgia, 'Times New Roman', serif" text-anchor="middle">
  <text x="109" y="57" font-size="15" font-weight="700" letter-spacing="2.5">PAR AVION</text>
  <text x="109" y="68" font-size="7.5" letter-spacing="2">BY AIR MAIL</text>
</g>
<g fill="none" stroke="#8D97BD" stroke-width="1.3" opacity="0.85">
  ${waves}
  <circle cx="440" cy="54" r="27"/><circle cx="440" cy="54" r="21" stroke-width="0.8"/>
</g>
${sparkle(440, 54, 9, '#8D97BD', 0.85)}
<rect x="498" y="26" width="70" height="78" fill="#FBE7CB"/>
<rect x="498" y="26" width="70" height="78" fill="none" stroke="${paper}" stroke-width="6" stroke-dasharray="0.1 7.4" stroke-linecap="round"/>
<rect x="506" y="34" width="54" height="62" fill="#DCE5FA"/>
<circle cx="524" cy="56" r="10" fill="#F2A541"/>
<path d="M549 46a11 11 0 1 0 5 20a13 13 0 0 1 -5 -20Z" fill="#4A56A0"/>
<path d="M506 80q14 -10 27 0t27 0V96H506Z" fill="#9FB1E6"/>
`);
}

function botanicalFern() {
  const paper = '#F7F9F0';
  // Stem follows a quadratic curve; leaflet pairs taper toward the tip.
  const frond = (p0, p1, p2, len, count = 15) => {
    let out = `<path d="M${p0[0]} ${p0[1]}Q${p1[0]} ${p1[1]} ${p2[0]} ${p2[1]}" fill="none" stroke="#4F7A54" stroke-width="1.6" stroke-linecap="round"/>`;
    for (let i = 1; i <= count; i++) {
      const t = 0.1 + (0.9 * i) / (count + 0.6);
      const x = (1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0];
      const y = (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1];
      const dx = 2 * (1 - t) * (p1[0] - p0[0]) + 2 * t * (p2[0] - p1[0]);
      const dy = 2 * (1 - t) * (p1[1] - p0[1]) + 2 * t * (p2[1] - p1[1]);
      const tangent = (Math.atan2(dy, dx) * 180) / Math.PI;
      const rx = len * (1 - t * 0.82);
      for (const side of [-1, 1]) {
        const a = tangent + side * 62;
        out += `<ellipse cx="${n(rx)}" cy="0" rx="${n(rx)}" ry="${n(Math.max(1.6, rx * 0.26))}" fill="${i % 2 ? '#6C9A6B' : '#86B083'}" transform="translate(${n(x)} ${n(y)}) rotate(${n(a)})"/>`;
      }
    }
    return out;
  };
  return svg(`
<rect width="${W}" height="${H}" fill="${paper}"/>
<rect x="12.5" y="12.5" width="575" height="375" fill="none" stroke="#9DBB9A" stroke-width="1"/>
<rect x="17.5" y="17.5" width="565" height="365" fill="none" stroke="#9DBB9A" stroke-width="0.6" opacity="0.6"/>
${frond([606, -6], [520, 20], [404, 86], 15, 17)}
${frond([604, 36], [560, 70], [498, 100], 10, 11)}
${frond([-6, -4], [60, 20], [150, 78], 13, 14)}
${frond([-6, 406], [70, 372], [176, 326], 14, 15)}
${frond([606, 404], [566, 376], [500, 352], 9, 10)}
`);
}

const FRAMES = {
  'moonlit-night': moonlitNight,
  'golden-sunrise': goldenSunrise,
  'ruled-notebook': ruledNotebook,
  sakura,
  'autumn-leaves': autumnLeaves,
  airmail,
  'botanical-fern': botanicalFern,
};

for (const p of PHOTOS) await buildPhoto(p);
for (const [id, draw] of Object.entries(FRAMES)) {
  await writeFile(path.join(OUT, `${id}.svg`), draw());
  console.log(`${id}.svg`);
}
