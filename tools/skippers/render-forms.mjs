/* ============================================================================
   SKIPPERS · FORMS - rasterise the two blank WA DoT forms for the portal tab
     node tools/skippers/render-forms.mjs [--keep-png <dir>]

   Source PDFs (public Department of Transport forms, blank):
     Documents/portal/skippers/Eyesight Declaration for Non MDL holders.pdf  (2 pages)
     Documents/portal/skippers/Letter of Consent for U18s.pdf                 (1 page)

   Each page is rendered at 200 dpi with pdftoppm (MiKTeX/xpdf build on PATH),
   then shrunk with sharp to SHIP_WIDTH px (about 180 dpi on A4) and written
   as webp to public/skippers-forms/<slug>-<n>.webp. Every file must stay
   under MAX_BYTES; the script exits 1 if one does not.

   --keep-png <dir> also leaves the full 200 dpi PNGs in <dir>, handy for
   measuring box positions (see fields.js for where the overlay boxes come
   from: the PDFs' own AcroForm widget rectangles, in PDF points).
   ========================================================================== */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..', '..');
const SRC_DIR = path.join(ROOT, 'Documents', 'portal', 'skippers');
const OUT_DIR = path.join(ROOT, 'public', 'skippers-forms');
const DPI = 200;
const SHIP_WIDTH = 1488;
const MAX_BYTES = 400 * 1024;

const FORMS = [
  { slug: 'eyesight', file: 'Eyesight Declaration for Non MDL holders.pdf' },
  { slug: 'consent', file: 'Letter of Consent for U18s.pdf' },
];

const keepIdx = process.argv.indexOf('--keep-png');
const KEEP = keepIdx > -1 ? path.resolve(process.argv[keepIdx + 1] || '.') : null;

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'skf-render-'));
fs.mkdirSync(OUT_DIR, { recursive: true });
if (KEEP) fs.mkdirSync(KEEP, { recursive: true });

let bad = 0;
for (const f of FORMS) {
  const pdf = path.join(SRC_DIR, f.file);
  if (!fs.existsSync(pdf)) {
    console.error(`missing source PDF: ${pdf}`);
    process.exit(1);
  }
  // pdftoppm writes <prefix>-1.png, <prefix>-2.png ... (zero padded for >9 pages)
  execFileSync('pdftoppm', ['-r', String(DPI), '-png', pdf, path.join(tmp, f.slug)], { stdio: ['ignore', 'ignore', 'ignore'] });
  const pngs = fs
    .readdirSync(tmp)
    .filter((n) => n.startsWith(`${f.slug}-`) && n.endsWith('.png'))
    .sort((a, b) => parseInt(a.slice(f.slug.length + 1), 10) - parseInt(b.slice(f.slug.length + 1), 10));
  for (const png of pngs) {
    const n = parseInt(png.slice(f.slug.length + 1), 10);
    const src = path.join(tmp, png);
    const out = path.join(OUT_DIR, `${f.slug}-${n}.webp`);
    const meta = await sharp(src).metadata();
    await sharp(src).resize({ width: SHIP_WIDTH }).webp({ quality: 80, effort: 6 }).toFile(out);
    const bytes = fs.statSync(out).size;
    const okSize = bytes <= MAX_BYTES;
    if (!okSize) bad++;
    console.log(
      `${okSize ? 'ok  ' : 'FAIL'} ${path.relative(ROOT, out)}  ${meta.width}x${meta.height} -> ${SHIP_WIDTH}w  ${(bytes / 1024).toFixed(0)} KB`,
    );
    if (KEEP) fs.copyFileSync(src, path.join(KEEP, `${f.slug}-${n}.png`));
  }
}
fs.rmSync(tmp, { recursive: true, force: true });
if (bad) {
  console.error(`${bad} file(s) over ${MAX_BYTES / 1024} KB`);
  process.exit(1);
}
