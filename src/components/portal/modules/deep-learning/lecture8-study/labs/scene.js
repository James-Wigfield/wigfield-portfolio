import { posEncoding, vitPatches } from '../attn';
import { imageUrl, maskUrl } from './pixmap';

/* ============================================================================
   §15 · THE PARK (the two vision labs' own drawn image)
   ----------------------------------------------------------------------------
   A small pixel picture echoing Figure 16-12 (no photo): sky, a band of
   trees, a pond, a tree, a woman mid-throw on the left with a red frisbee in
   the air level with her head, and a child at the lower right. It is this
   page's own drawing, 96 × 96 pixels (the slides give no image size), so the
   ViT lab chops it into 16 × 16 squares: 6 × 6 = 36 of them.

     park()            { rgb, url, dimUrl }: the pixels (0…255, row-major,
                       3 per pixel), the picture, and a darkened grey copy
                       (Figure 16-12's dimmed "not looked at" look)
     patchBars()       the 36 squares flattened, 768 numbers each, drawn as
                       a band of bars (R, G, B columns of 256 values)
     linearMasks()     the same band after this page's toy linear layer
                       (768 → 768), as positive / negative masks
     posBandMasks()    a stand-in positional embedding per position, as
                       masks (the slide gives no values)
     CAPTION, attnFor  slide 45's caption and, for each word, this page's
                       own illustrative weights over an 8 × 8 grid of CNN
                       feature-map cells (only "frisbee" is backed by the
                       slide: "most of its attention was focused on the
                       frisbee")
   ========================================================================== */

export const PX = 96; // the page's own image size (pixels a side)
export const PATCH = 16; // slide 46: 16 × 16 squares
export const VIT = vitPatches(PX, PX, PATCH, 3); // { rows: 6, cols: 6, count: 36, dim: 768 }
export const FEAT = 8; // the page's own feature-map grid (8 × 8 cells of 12 px)
export const FRISBEE_PATCH = 12; // the frisbee (x ≈ 3–14, y ≈ 36–40) sits in square row 2, column 0

/* ── the painter ──────────────────────────────────────────────────────── */
const hash = (x, y) => {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
const lerp = (a, b, t) => a.map((v, i) => v + (b[i] - v) * Math.max(0, Math.min(1, t)));
const shade = (c, f) => c.map((v) => v * f);
const ell = (ex, ey, rx, ry) => (x, y) => ((x - ex) / rx) ** 2 + ((y - ey) / ry) ** 2 <= 1;
const circ = (ex, ey, r) => ell(ex, ey, r, r);
const box = (x0, y0, x1, y1) => (x, y) => x >= x0 && x <= x1 && y >= y0 && y <= y1;
const seg = (x0, y0, x1, y1, w) => (x, y) => {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const t = Math.max(0, Math.min(1, ((x - x0) * dx + (y - y0) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(x - (x0 + t * dx), y - (y0 + t * dy)) <= w / 2;
};

const SKIN = [232, 186, 148];
const HAIR = [92, 58, 36];
const TOP = [40, 140, 84];
const TROUSERS = [176, 214, 146];
const SHOE = [70, 56, 46];
const FRISBEE = [226, 50, 34];

function paint() {
  const rgb = new Float32Array(PX * PX * 3);
  const layer = (inside, color) => {
    for (let y = 0; y < PX; y++) {
      for (let x = 0; x < PX; x++) {
        const cx = x + 0.5;
        const cy = y + 0.5;
        if (!inside(cx, cy)) continue;
        const c = typeof color === 'function' ? color(cx, cy, x, y) : color;
        const k = (y * PX + x) * 3;
        rgb[k] = c[0];
        rgb[k + 1] = c[1];
        rgb[k + 2] = c[2];
      }
    }
  };

  // sky, a few clouds
  layer(() => true, (x, y) => lerp([112, 182, 234], [204, 232, 248], y / 46));
  for (const [ex, ey, rx, ry] of [[18, 11, 9, 2.6], [23, 9.2, 5, 2.2], [64, 17, 10, 2.4], [70, 15.2, 5.5, 2]]) layer(ell(ex, ey, rx, ry), [248, 251, 255]);

  // the band of trees on the horizon
  const greens = [[60, 128, 72], [46, 110, 60], [76, 144, 82]];
  for (let k = 0; k < 14; k++) {
    const g = greens[k % 3];
    layer(circ(-3 + k * 8.2, 38 + (k % 2) * 2.4, 6 + (k % 3) * 1.3), (x, y, ix, iy) => shade(g, (0.88 + 0.16 * hash(ix, iy)) * (1 - 0.18 * Math.max(0, (y - 32) / 12))));
  }

  // grass
  layer((x, y) => y >= 44, (x, y, ix, iy) => shade(lerp([132, 198, 98], [74, 156, 60], (y - 44) / 52), 0.92 + 0.13 * hash(ix + 7, iy + 3)));

  // the pond
  layer(ell(61, 52, 17, 4.4), [92, 160, 212]);
  layer(ell(57, 51.2, 8, 0.9), [168, 210, 238]);
  layer(ell(68, 53.4, 5, 0.6), [150, 198, 232]);

  // a tree on the right
  layer(box(84.5, 34, 88, 64), (x, y, ix, iy) => shade([118, 84, 52], 0.9 + 0.15 * hash(ix, iy)));
  for (const [ex, ey, r] of [[86, 30, 9], [79, 35, 7], [92.5, 35, 7], [86, 39, 7.5]]) {
    layer(circ(ex, ey, r), (x, y, ix, iy) => shade([50, 122, 62], (0.86 + 0.18 * hash(ix + 3, iy)) * (1 - 0.2 * Math.max(0, (y - 30) / 16))));
  }
  layer(circ(82.5, 26.5, 3.6), [86, 158, 86]);

  // the woman, mid-throw, on the left
  layer(seg(25.5, 64, 22, 83, 4.4), TROUSERS);
  layer(seg(30.5, 64, 34.6, 83, 4.4), TROUSERS);
  layer(ell(21, 84.6, 2.8, 1.4), SHOE);
  layer(ell(35.6, 84.6, 2.8, 1.4), SHOE);
  layer(box(23, 47.5, 33.5, 65.5), TOP);
  layer(ell(28.2, 48.6, 5.8, 2.4), TOP);
  layer(seg(32.6, 50, 37, 59.5, 3.2), TOP);
  layer(seg(37, 59.5, 38.4, 64, 2.6), SKIN);
  layer(seg(24.2, 49.4, 19.2, 45.2, 3.4), TOP);
  layer(seg(19.2, 45.2, 14.6, 41.2, 2.7), SKIN);
  layer(circ(14.2, 40.6, 1.7), SKIN);
  layer(box(26.8, 44.5, 29.4, 47.6), SKIN);
  layer(circ(29, 40.6, 4.5), HAIR);
  layer(ell(33.4, 43.4, 1.8, 3.2), HAIR);
  layer(circ(27.6, 42, 3.5), SKIN);

  // the frisbee, in the air at the upper left, level with her head
  layer(ell(8.6, 38, 5.4, 2), FRISBEE);
  layer(ell(8.2, 37.3, 3.2, 0.7), [248, 124, 98]);

  // the child, lower right
  layer(seg(72.6, 82, 72.2, 89, 3), [90, 94, 166]);
  layer(seg(76.4, 82, 76.8, 89, 3), [90, 94, 166]);
  layer((x, y) => y > 82 && y < 89 && x > 70.5 && x < 78.5 && hash(Math.floor(x) + 50, Math.floor(y)) > 0.72, [170, 176, 226]);
  layer(ell(71.8, 89.6, 2, 1), SHOE);
  layer(ell(77.4, 89.6, 2, 1), SHOE);
  layer(box(70.6, 73, 78.4, 82.4), [204, 46, 142]);
  layer(seg(70.8, 74.4, 68.6, 80, 2.3), [204, 46, 142]);
  layer(seg(78.2, 74.4, 80.2, 80, 2.3), [204, 46, 142]);
  layer(circ(74.4, 69.2, 3.4), [62, 42, 30]);
  layer(circ(74, 70.2, 2.8), SKIN);

  return rgb;
}

const px3 = (rgb, x, y) => {
  const k = (y * PX + x) * 3;
  return [rgb[k], rgb[k + 1], rgb[k + 2]];
};

let PARK = null;
export function park() {
  if (PARK) return PARK;
  const rgb = paint();
  const url = imageUrl(PX, PX, (x, y) => px3(rgb, x, y).map(Math.round));
  const dimUrl = imageUrl(PX, PX, (x, y) => {
    const [r, g, b] = px3(rgb, x, y);
    const l = Math.round((0.3 * r + 0.59 * g + 0.11 * b) * 0.3 + 8);
    return [l, l, l + 4];
  });
  PARK = { rgb, url, dimUrl };
  return PARK;
}

/* ── the patch chopper's bands ───────────────────────────────────────────
   Every band is one image laid out like the row of squares: square k
   (reading order: row r, column c → k = 6r + c, this page's numbering)
   owns columns BAR_PITCH·k … BAR_PITCH·k + 12, split R | G | B, and 256
   rows: its 16 × 16 pixels in reading order. 256 × 3 = 768 numbers.     */
export const BAR_PITCH = 14;
export const BAND_W = BAR_PITCH * VIT.count; // 504
// the bands are drawn ~50 px tall: each image row averages 4 of the 256
// values (a quarter of a pixel row), so the browser never has to shrink 256
// rows and invent moiré
export const BAND_ROWS = 64;
const PER_ROW = (PATCH * PATCH) / BAND_ROWS;
const rowAvg = (f, y) => {
  let s = 0;
  for (let j = y * PER_ROW; j < (y + 1) * PER_ROW; j++) s += f(j);
  return s / PER_ROW;
};
const CH = [[0, 4], [4, 8], [8, 13]]; // the R, G, B columns inside a bar

function barCell(x) {
  const k = Math.floor(x / BAR_PITCH);
  const off = x - k * BAR_PITCH;
  const ch = CH.findIndex(([a, b]) => off >= a && off < b);
  return { k, ch };
}
function patchPixel(k, j) {
  const r = Math.floor(k / VIT.cols);
  const c = k % VIT.cols;
  return [c * PATCH + (j % PATCH), r * PATCH + Math.floor(j / PATCH)];
}

let BARS = null;
export function patchBars() {
  if (BARS) return BARS;
  const { rgb } = park();
  BARS = imageUrl(BAND_W, BAND_ROWS, (x, y) => {
    const { k, ch } = barCell(x);
    if (ch < 0) return [0, 0, 0, 0];
    const c = [0, 0, 0, 255];
    c[ch] = Math.round(rowAvg((j) => px3(rgb, ...patchPixel(k, j))[ch], y));
    return c;
  });
  return BARS;
}

/* This page's toy linear layer: each pixel's (R, G, B), centred to −1…1, is
   mixed by one 3 × 3 matrix. That is a 768 × 768 linear map (block
   diagonal), so the output still has 768 numbers: "transforms them but
   retains their dimensionality" (slide 46). The weights are made up.      */
const MIX = [[0.9, -0.6, 0.2], [-0.3, 0.8, -0.7], [0.5, 0.4, -0.9]];
let LIN = null;
export function linearMasks() {
  if (LIN) return LIN;
  const { rgb } = park();
  const lin = (k, ch, j) => {
    const v = px3(rgb, ...patchPixel(k, j)).map((u) => (u / 255 - 0.5) * 2);
    return Math.max(-1, Math.min(1, MIX[ch].reduce((s, m, i) => s + m * v[i], 0)));
  };
  const part = (sign) => (x, y) => {
    const { k, ch } = barCell(x);
    return ch < 0 ? 0 : rowAvg((j) => Math.max(0, sign * lin(k, ch, j)), y);
  };
  LIN = { pos: maskUrl(BAND_W, BAND_ROWS, part(1)), neg: maskUrl(BAND_W, BAND_ROWS, part(-1)) };
  return LIN;
}

/* A stand-in positional embedding for each of the 36 positions, 8 numbers
   tall, drawn with §10's sine/cosine pattern on a small base so it varies
   across 36 positions. The slide only says "adding positional embeddings"
   and gives no values: this is the page's own picture.                   */
export const POS_ROWS = 8;
let POSB = null;
export function posBandMasks() {
  if (POSB) return POSB;
  const P = posEncoding(VIT.count, POS_ROWS, 36);
  const val = (x, y) => {
    const { k, ch } = barCell(x);
    return ch < 0 ? 0 : P[k][y];
  };
  POSB = { pos: maskUrl(BAND_W, POS_ROWS, (x, y) => val(x, y)), neg: maskUrl(BAND_W, POS_ROWS, (x, y) => -val(x, y)) };
  return POSB;
}

/* ── visual attention: slide 45's caption, verbatim ─────────────────────── */
export const CAPTION = ['A', 'woman', 'is', 'throwing', 'a', 'frisbee', 'in', 'a', 'park'];
export const FRISBEE_STEP = 5;

/* Where the decoder looks at each word: this page's own illustrative blobs
   (pixel centre x, y, spread σ, strength), on top of a flat base. Only
   "frisbee" follows the slide (Figure 16-12: a bright region over the
   frisbee that extends down over the woman's head and upper body).      */
const LOOKS = [
  { base: 1, blobs: [[28, 58, 22, 1.2]], say: 'a broad look over the whole scene' }, // A
  { base: 0.18, blobs: [[28, 54, 9, 6], [28, 42, 6, 3]], say: 'the woman' }, // woman
  { base: 0.7, blobs: [[28, 56, 14, 2.2]], say: 'still mostly the woman' }, // is
  { base: 0.2, blobs: [[17, 44, 7, 6], [9, 38, 6, 3], [28, 54, 9, 2]], say: 'her raised arm, and the frisbee leaving it' }, // throwing
  { base: 1, blobs: [[18, 44, 18, 1.2]], say: 'a broad look again' }, // a
  { base: 0.12, blobs: [[9, 38, 8, 10], [25, 47, 9, 4]], say: '' }, // frisbee (slide 45)
  { base: 1, blobs: [[48, 76, 24, 1.5]], say: 'a broad look, lower down' }, // in
  { base: 1, blobs: [[56, 70, 22, 1.4]], say: 'a broad look over the ground' }, // a
  { base: 0.3, blobs: [[56, 80, 22, 3], [44, 36, 18, 2.4], [86, 34, 9, 2]], say: 'the grass and the trees' }, // park
];

const CELL = PX / FEAT;
const WEIGHTS = LOOKS.map(({ base, blobs }) => {
  const s = Array.from({ length: FEAT }, (_, r) => Array.from({ length: FEAT }, (_, c) => {
    const x = c * CELL + CELL / 2;
    const y = r * CELL + CELL / 2;
    return base + blobs.reduce((acc, [bx, by, sg, a]) => acc + a * Math.exp(-((x - bx) ** 2 + (y - by) ** 2) / (2 * sg * sg)), 0);
  }));
  const tot = s.flat().reduce((a, b) => a + b, 0);
  return s.map((row) => row.map((v) => v / tot));
});

// the 8 × 8 weights for caption word t (they add up to 1)
export const attnFor = (t) => WEIGHTS[t];
export const lookSay = (t) => LOOKS[t].say;
