import type { CSSProperties } from 'react';

/**
 * Letter papers. Everything is sized from the sheet's own width (`--w` = 1% of
 * the drawn artwork, see `.paper-sheet` in globals.css), so the writing area
 * always sits inside the artwork whatever the screen size or letter length.
 *
 * - photo: a top cap, a repeatable band and a bottom cap cut by
 *   scripts/build-papers.mjs. `inset` is where the blank paper starts, as a
 *   fraction of the artwork [top, right, bottom, left]. `caps` are the heights
 *   of the top and bottom caps. `narrow` zooms into the sheet on phones
 *   [zoom, left shift] so wide decorations don't squeeze the text.
 * - frame: a 600x400 SVG drawn by the same script, used as a 9-slice border.
 */
interface PaperBase {
  id: string;
  name: string;
  description: string;
  /** Paper colour, shown while the artwork loads */
  paper: string;
}

interface PhotoPaper extends PaperBase {
  kind: 'photo';
  ratio: number;
  caps: [top: number, bottom: number];
  inset: [top: number, right: number, bottom: number, left: number];
  narrow?: [zoom: number, shift: number];
  /** Crop to the sheet of paper itself [zoom, left shift, top], for the letter inside the envelope */
  mini?: [zoom: number, shift: number, top: number];
}

interface FramePaper extends PaperBase {
  kind: 'frame';
  /** Ruled lines under the letter text */
  ruled?: boolean;
}

export type Paper = PhotoPaper | FramePaper;

export const TEMPLATES: readonly Paper[] = [
  {
    id: 'daisy-paper',
    name: 'Daisy Meadow',
    description: 'A taped note in a field of daisies',
    paper: '#f8f3ef',
    kind: 'photo',
    ratio: 1.4993,
    caps: [0.4, 0.28],
    inset: [0.14, 0.23, 0.1, 0.23],
    narrow: [1.59, 0.295],
    mini: [1.75, 0.375, 0.085],
  },
  {
    id: 'torn-beige',
    name: 'Torn Beige',
    description: 'Aged beige paper with torn edges',
    paper: '#f1dcc6',
    kind: 'photo',
    ratio: 1.4993,
    caps: [0.56, 0.24],
    inset: [0.15, 0.19, 0.135, 0.2],
    narrow: [1.41, 0.212],
    mini: [1.47, 0.243, 0.105],
  },
  {
    id: 'christmas-letter',
    name: 'Christmas Letter',
    description: 'Vintage Christmas airmail sheet',
    paper: '#ecebd9',
    kind: 'photo',
    ratio: 1.431,
    caps: [0.295, 0.2],
    inset: [0.3, 0.075, 0.2, 0.075],
  },
  { id: 'moonlit-night', name: 'Moonlit Night', description: 'A crescent moon over cream paper', paper: '#FBF6EA', kind: 'frame' },
  { id: 'golden-sunrise', name: 'Golden Sunrise', description: 'The sun coming up over the page', paper: '#FFF9EC', kind: 'frame' },
  { id: 'ruled-notebook', name: 'Notebook', description: 'A ruled page torn from a notebook', paper: '#FDFCF6', kind: 'frame', ruled: true },
  { id: 'sakura', name: 'Sakura', description: 'A cherry branch and falling petals', paper: '#FFF7F8', kind: 'frame' },
  { id: 'autumn-leaves', name: 'Autumn Leaves', description: 'Stitched kraft paper with fallen leaves', paper: '#F5E7CD', kind: 'frame' },
  { id: 'airmail', name: 'Airmail', description: 'Par avion stripes, stamp and postmark', paper: '#FFFEF9', kind: 'frame' },
  { id: 'botanical-fern', name: 'Fern', description: 'Pressed fern fronds', paper: '#F7F9F0', kind: 'frame' },
];

export function findTemplate(id: string | undefined): Paper {
  return TEMPLATES.find((t) => t.id === id) ?? TEMPLATES[0];
}

/** Frame SVG geometry — keep in step with scripts/build-papers.mjs */
const FRAME = { top: 110, bottom: 90, side: 40, width: 600, height: 400 };

/** `pct` percent of the drawn artwork width */
const w = (pct: number) => `calc(${+pct.toFixed(3)} * var(--w))`;

/**
 * `fit` shows the whole artwork at any width (thumbnails). `paper` crops a photo
 * paper to the sheet itself, so a small letter reads as paper and not as its backdrop.
 */
export type PaperView = 'fit' | 'paper';

/** Inline style for `.paper-sheet`. Without a view, photo papers zoom in on phones. */
export function paperSheetStyle(tpl: Paper, view?: PaperView): CSSProperties {
  if (tpl.kind === 'frame') {
    const unit = 100 / FRAME.width;
    const side = FRAME.side * unit;
    return {
      backgroundColor: tpl.paper,
      borderStyle: 'solid',
      borderColor: 'transparent',
      borderWidth: `${w(FRAME.top * unit)} ${w(side)} ${w(FRAME.bottom * unit)}`,
      borderImage: `url(/backgrounds/${tpl.id}.svg) ${(FRAME.top / FRAME.height) * 100}% ${side}% ${(FRAME.bottom / FRAME.height) * 100}% fill / 1 / 0 round`,
      padding: `${w(1)} ${w(3.5)} ${w(2)}`,
    };
  }

  const [top, right, bottom, left] = tpl.inset;
  const k = tpl.ratio * 100;
  const base = `/backgrounds/${tpl.id}`;
  return {
    backgroundColor: tpl.paper,
    backgroundImage: `url(${base}-top.webp), url(${base}-bottom.webp), url(${base}-tile.webp)`,
    backgroundSize: '100% auto',
    backgroundRepeat: 'no-repeat, no-repeat, repeat-y',
    backgroundPosition: `0 0, 0 100%, 0 ${w(tpl.caps[0] * k)}`,
    padding: `${w(top * k)} ${w(right * 100)} ${w(bottom * k)} ${w(left * 100)}`,
    minHeight: w((tpl.caps[0] + tpl.caps[1]) * k),
    ...(view === 'paper' && tpl.mini
      ? { '--z': tpl.mini[0], '--shift': tpl.mini[1], marginTop: w(-tpl.mini[2] * k) }
      : tpl.narrow && !view
        ? { '--z-narrow': tpl.narrow[0], '--shift-narrow': tpl.narrow[1] }
        : {}),
  } as CSSProperties;
}
