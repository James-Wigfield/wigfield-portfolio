// Split the dissertation's architecture figure (Figure 3.3, option F) into layers.
//   MSYS_NO_PATHCONV=1 node tools/seminar-decks/split_optf.mjs
//
// The plain deck's slides 7 and 8 animate the figure piece by piece. Nothing is
// redrawn: every layer file is the original SVG with only some of its top-level
// elements kept (each element unchanged), and the defs pruned to what those use.
// Each top-level element goes to the first layer whose rule matches its bounding
// box (viewBox units, measured in the browser) and paint. Elements in DROP are in
// no layer: the patch-size note, the per-stage size column, "432 tokens ...",
// "bottleneck: 6 x 12 x 6", "(log scales)" and the dashed connectors to the inset.
// The script fails if any element matches no rule.
//
// Writes public/seminar-decks/figures/optf/<layer>.svg and
// src/components/portal/modules/seminar-decks/decks/plain/optf.gen.js (each
// layer's bounding box, for placing labels and moves).
import fs from 'node:fs';
import path from 'node:path';
import { openBrowser } from './lib.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')), '..', '..');
const SRC = path.join(ROOT, 'public/seminar-decks/figures/architecture-option-f.svg');
const OUT = path.join(ROOT, 'public/seminar-decks/figures/optf');
const JS = path.join(ROOT, 'src/components/portal/modules/seminar-decks/decks/plain/optf.gen.js');

// Rules, in order: [layer, test(b)] where b = { cx, cy, x0, y0, x1, y1, w, h, blue, dash }.
// `blue`: the Mamba blocks' blues (fill or stroke); `dash`: a dashed stroke.
const inR = (b, x0, y0, x1, y1) => b.cx >= x0 && b.cx <= x1 && b.cy >= y0 && b.cy <= y1;
const ROW0 = 329.25; // centre of the first "Mamba layer" row in the inset
const ROWSTEP = 11.33;
const RULES = [
  ['DROP', (b) => inR(b, 0, 48, 64, 105)], // "input patch, 96 x 192 x 96, two channels; faces show projections"
  ['DROP', (b) => inR(b, 0, 120, 90, 295)], // per-stage channels, sizes, voxels and sequence lengths
  ['DROP', (b) => inR(b, 195, 312, 300, 325) && !b.blue], // "432 tokens   own weights"
  ['DROP', (b) => inR(b, 0, 324, 95, 335)], // "bottleneck: 6 x 12 x 6"
  ['DROP', (b) => inR(b, 318, 403, 366, 418)], // "(log scales)"
  ['DROP', (b) => b.dash && b.y0 > 292 && b.y1 < 307], // dashed connectors from the bracket to the inset
  ['bracket', (b) => inR(b, 225, 289.5, 300, 293.5)],
  // Text, kept apart from the shapes so a slide can leave small figure text out.
  ['organtext', (b) => b.text && inR(b, 205, 15, 270, 60)],
  ['headlab', (b) => b.text && inR(b, 310, 82, 362, 93)], // "lesion head"
  ...[[105, 120], [155, 168], [196, 208], [233, 245]].map(([y0, y1], i) => [`skiplab${i + 1}`, (b) => b.text && inR(b, 220, y0, 290, y1)]),
  ['organ', (b) => inR(b, 205, 15, 270, 60) || (b.dash && b.x0 > 230 && b.x1 < 365 && b.y0 > 50 && b.y1 < 115)],
  ['outlabel', (b) => inR(b, 268, 24, 345, 47)],
  // (the first encoder and last decoder blocks' top faces sit just below, centred near y 107)
  ['output', (b) => inR(b, 340, 0, 410, 100)],
  ['input', (b) => inR(b, 40, 0, 140, 100) || (b.h < 4 && inR(b, 40, 0, 140, 112))],
  ['enc1', (b) => inR(b, 90, 100, 116, 185)],
  ['enc2', (b) => inR(b, 116, 150, 138, 218)],
  ['mb3', (b) => b.blue && inR(b, 149, 190, 182, 234)],
  ['mb4', (b) => b.blue && inR(b, 188, 229, 223, 264)],
  ['mb5', (b) => b.blue && inR(b, 230, 265, 294, 290)],
  ['enc3', (b) => !b.blue && inR(b, 138, 190, 175, 252)],
  ['enc4', (b) => !b.blue && inR(b, 175, 229, 216, 282)],
  ['enc5', (b) => !b.blue && inR(b, 216, 265, 236, 290)],
  ['skip1', (b) => inR(b, 110, 105, 349, 125)],
  ['skip2', (b) => inR(b, 130, 155, 329.5, 172)],
  ['skip3', (b) => inR(b, 175, 196, 309.5, 212)],
  ['skip4', (b) => inR(b, 218, 233, 289.5, 247)],
  ['dec4', (b) => inR(b, 289.5, 229, 321, 286)],
  ['dec3', (b) => inR(b, 309.5, 190, 341, 233.5)],
  ['dec2', (b) => inR(b, 329.5, 150, 361, 193)],
  ['dec1', (b) => inR(b, 349, 100, 381, 152)],
  ...[0, 1, 2, 3, 4, 5].map((k) => [`dir${k}`, (b) => b.h < 12 && inR(b, 180, ROW0 + k * ROWSTEP - 5.6, 300, ROW0 + k * ROWSTEP + 5.6)]),
  ['panel', (b) => inR(b, 0, 300, 410, 402)],
  ['legend', (b) => inR(b, 0, 402, 410, 420)],
];

const svgText = fs.readFileSync(SRC, 'utf8');
const browser = await openBrowser({ width: 1200, height: 1200 });
const page = await browser.newPage();
await page.setContent(`<html><body style="margin:0">${svgText}</body></html>`);
const boxes = await page.evaluate(() => {
  const root = document.querySelector('svg');
  const inv = root.getScreenCTM().inverse();
  const isBlue = (c) => /^rgb\(0%, (44\.7|33\.7|24\.7)/.test(c || '') || /^rgb\(35\.68/.test(c || '');
  return [...root.children].map((el, k) => {
    if (el.tagName === 'defs') return { k, defs: true };
    const b = el.getBBox();
    const m = inv.multiply(el.getScreenCTM());
    const pts = [[b.x, b.y], [b.x + b.width, b.y], [b.x, b.y + b.height], [b.x + b.width, b.y + b.height]]
      .map(([x, y]) => new DOMPoint(x, y).matrixTransform(m));
    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    const paints = [el, ...el.querySelectorAll('*')].flatMap((e) => [e.getAttribute('fill'), e.getAttribute('stroke')]);
    const x0 = Math.min(...xs); const x1 = Math.max(...xs); const y0 = Math.min(...ys); const y1 = Math.max(...ys);
    return {
      k, x0, y0, x1, y1, w: x1 - x0, h: y1 - y0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2,
      blue: paints.some(isBlue),
      dash: !!el.getAttribute('stroke-dasharray'),
      text: el.tagName === 'g', // the figure's words are groups of glyph uses
    };
  });
});

const layerOf = {};
const unmatched = [];
for (const b of boxes) {
  if (b.defs) continue;
  const hit = RULES.find(([, test]) => test(b));
  if (!hit) unmatched.push(b);
  else layerOf[b.k] = hit[0];
}
if (unmatched.length) {
  console.error('elements matching no rule:', JSON.stringify(unmatched.map(({ k, x0, y0, x1, y1 }) => ({ k, x0, y0, x1, y1 }))));
  await browser.close();
  process.exit(1);
}

const layers = [...new Set(Object.values(layerOf))].filter((l) => l !== 'DROP');
// Composites: several layers in one file. `body` is the network's blocks and their
// arrows (no text, no skips), for small thumbnails of the network.
const COMPOSITES = {
  body: ['enc1', 'enc2', 'enc3', 'enc4', 'enc5', 'mb3', 'mb4', 'mb5', 'dec4', 'dec3', 'dec2', 'dec1'],
};
const groups = { ...Object.fromEntries(layers.map((L) => [L, [L]])), ...COMPOSITES };
// Serialise one SVG per group: keep its layers' top-level elements, prune unused defs.
const files = await page.evaluate((layerOf, groups) => {
  const src = document.querySelector('svg');
  const out = {};
  for (const [L, members] of Object.entries(groups)) {
    const svg = src.cloneNode(true);
    [...svg.children].forEach((el, k) => {
      if (el.tagName !== 'defs' && !members.includes(layerOf[k])) el.remove();
    });
    // defs: keep what is referenced (directly or through other defs), transitively.
    const defs = svg.querySelector('defs');
    const byId = new Map([...defs.querySelectorAll('[id]')].map((e) => [e.id, e]));
    const refsOf = (e) => [...e.querySelectorAll('*'), e].flatMap((n) => [
      n.getAttribute('xlink:href'), n.getAttribute('href'), n.getAttribute('clip-path'), n.getAttribute('mask'), n.getAttribute('fill'),
    ]).filter(Boolean).map((r) => (r.match(/#([^)"']+)/) || [])[1]).filter(Boolean);
    const keep = new Set();
    const queue = [...svg.children].filter((e) => e.tagName !== 'defs').flatMap(refsOf);
    while (queue.length) {
      const id = queue.pop();
      if (keep.has(id) || !byId.has(id)) continue;
      keep.add(id);
      queue.push(...refsOf(byId.get(id)));
    }
    // remove unreferenced id'd defs whose ancestors are not kept
    [...defs.querySelectorAll('[id]')].reverse().forEach((e) => {
      const kept = keep.has(e.id) || [...keep].some((id) => e.contains(byId.get(id)) && e !== byId.get(id));
      if (!kept) e.remove();
    });
    out[L] = new XMLSerializer().serializeToString(svg);
  }
  return out;
}, layerOf, groups);
await browser.close();

fs.mkdirSync(OUT, { recursive: true });
const bbox = {};
for (const [L, members] of Object.entries(groups)) {
  fs.writeFileSync(path.join(OUT, `${L}.svg`), `<?xml version="1.0" encoding="UTF-8"?>\n${files[L]}\n`);
  const mine = boxes.filter((b) => members.includes(layerOf[b.k]));
  bbox[L] = {
    x0: +Math.min(...mine.map((b) => b.x0)).toFixed(2),
    y0: +Math.min(...mine.map((b) => b.y0)).toFixed(2),
    x1: +Math.max(...mine.map((b) => b.x1)).toFixed(2),
    y1: +Math.max(...mine.map((b) => b.y1)).toFixed(2),
    n: mine.length,
  };
  console.log(`${L.padEnd(9)} ${String(mine.length).padStart(3)} elements  ${(files[L].length / 1024).toFixed(0).padStart(4)} KB  ` +
    `x ${bbox[L].x0}-${bbox[L].x1}  y ${bbox[L].y0}-${bbox[L].y1}`);
}
const dropped = boxes.filter((b) => layerOf[b.k] === 'DROP').length;
console.log(`dropped ${dropped} elements`);
const header = '/* GENERATED by tools/seminar-decks/split_optf.mjs: do not edit.\n'
  + '   Layers of figures/architecture-option-f.svg (dissertation Figure 3.3) in figures/optf/,\n'
  + '   with each layer\'s bounding box in the figure\'s viewBox units (409.888 x 419.525). */\n';
fs.writeFileSync(JS, `${header}export const OPTF_VB = { w: 409.888, h: 419.525 };\nexport const OPTF_LAYERS = ${JSON.stringify(bbox)};\n`);
console.log('wrote', JS);
