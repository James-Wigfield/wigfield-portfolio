/* ============================================================================
   DL LECTURE 4 STUDY — pixel-compare two folders of screenshots
   (puppeteer-core + local Edge: the images are decoded and diffed on a canvas)
   ----------------------------------------------------------------------------
     node tools/dl-lecture4-study/compare-shots.mjs <baselineDir> <newDir> [--map=from:to] [--diff=<dir>]

   Pairs files by name (after the optional --map rename, e.g.
   --map=-nb-:-legacy- pairs s03-nb-jade-1440.png with s03-legacy-jade-1440.png)
   and prints, per pair, whether the sizes match, how many pixels differ and
   the largest channel difference. --diff writes a red-on-grey diff image for
   every pair that isn't identical. Exit code 1 if any pair differs.
   ========================================================================== */
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const args = process.argv.slice(2);
const flags = Object.fromEntries(args.filter((a) => a.startsWith('--')).map((a) => {
  const [k, ...v] = a.slice(2).split('=');
  return [k, v.join('=') || true];
}));
const [A, B] = args.filter((a) => !a.startsWith('--')).map((p) => path.resolve(p));
if (!A || !B) {
  console.log('usage: compare-shots.mjs <baselineDir> <newDir> [--map=from:to] [--diff=<dir>]');
  process.exit(2);
}
const [mapFrom, mapTo] = typeof flags.map === 'string' ? flags.map.split(':') : [null, null];
const diffDir = typeof flags.diff === 'string' ? path.resolve(flags.diff) : null;
if (diffDir) fs.mkdirSync(diffDir, { recursive: true });

const pairs = fs.readdirSync(A).filter((f) => f.endsWith('.png')).map((f) => [f, mapFrom ? f.replace(mapFrom, mapTo) : f]).filter(([, g]) => fs.existsSync(path.join(B, g)));

const browser = await puppeteer.launch({ executablePath: EDGE, headless: 'new' });
const page = await browser.newPage();
await page.setContent('<html><body></body></html>');
let bad = 0;
try {
  for (const [fa, fb] of pairs) {
    const a = fs.readFileSync(path.join(A, fa)).toString('base64');
    const b = fs.readFileSync(path.join(B, fb)).toString('base64');
    const r = await page.evaluate(async (a64, b64, wantDiff) => {
      const load = (src) => new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = `data:image/png;base64,${src}`; });
      const [ia, ib] = await Promise.all([load(a64), load(b64)]);
      if (ia.width !== ib.width || ia.height !== ib.height) return { size: `${ia.width}×${ia.height} vs ${ib.width}×${ib.height}` };
      const px = (im) => { const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const x = c.getContext('2d'); x.drawImage(im, 0, 0); return x.getImageData(0, 0, im.width, im.height); };
      const da = px(ia);
      const db = px(ib);
      let n = 0;
      let max = 0;
      const out = wantDiff ? new ImageData(ia.width, ia.height) : null;
      for (let i = 0; i < da.data.length; i += 4) {
        const d = Math.max(Math.abs(da.data[i] - db.data[i]), Math.abs(da.data[i + 1] - db.data[i + 1]), Math.abs(da.data[i + 2] - db.data[i + 2]));
        if (d > 0) n += 1;
        if (d > max) max = d;
        if (out) {
          const g = 235 - (da.data[i] + da.data[i + 1] + da.data[i + 2]) / 12;
          out.data.set(d ? [255, 0, 0, 255] : [g, g, g, 255], i);
        }
      }
      let png = null;
      if (out && n) {
        const c = document.createElement('canvas');
        c.width = ia.width;
        c.height = ia.height;
        c.getContext('2d').putImageData(out, 0, 0);
        png = c.toDataURL('image/png').split(',')[1];
      }
      return { n, max, png, w: ia.width, h: ia.height };
    }, a, b, !!diffDir);
    if (r.size) {
      bad += 1;
      console.log(`SIZE  ${fa}  ${r.size}`);
      continue;
    }
    if (r.n) bad += 1;
    console.log(`${r.n ? 'DIFF ' : 'SAME '} ${fa}${fa !== fb ? ` ↔ ${fb}` : ''}  ${r.w}×${r.h}${r.n ? `  ${r.n} px differ, max Δ ${r.max}` : ''}`);
    if (r.png) fs.writeFileSync(path.join(diffDir, fa.replace('.png', '-diff.png')), Buffer.from(r.png, 'base64'));
  }
} finally {
  await browser.close();
}
console.log(`\n${pairs.length} pairs, ${bad} differ`);
process.exit(bad ? 1 : 0);
