// Export every slide of every deck to 1920x1080 PNG (seminar-export/<deck>/), then build per deck
//   public/seminar-decks/pdf/<deck>-slides.pdf   one page per slide, finished state (clip slides show their hold)
//   public/seminar-decks/pdf/<deck>-script.pdf   the script view printed (thumbnail + transcript per slide)
// Needs the dev server on 5179 (or SD_BASE).   node tools/seminar-decks/export.mjs [--deck one-scan]
import fs from 'node:fs';
import path from 'node:path';
import { BASE, gatesData, gotoRender, newPage, openBrowser, SLUGS } from './lib.mjs';

const args = process.argv.slice(2);
const i = args.indexOf('--deck');
const decks = i >= 0 ? args[i + 1].split(',') : SLUGS;
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..', '..');
const OUT = path.join(ROOT, 'seminar-export');
const PDF = path.join(ROOT, 'public', 'seminar-decks', 'pdf');
fs.mkdirSync(PDF, { recursive: true });

const log = [];
const browser = await openBrowser();
const page = await newPage(browser, { log });
const G = await gatesData(page);

for (const slug of decks) {
  const deck = G.decks.find((d) => d.slug === slug);
  const dir = path.join(OUT, slug);
  fs.mkdirSync(dir, { recursive: true });
  for (const f of fs.readdirSync(dir)) if (/\.(png|jpg)$/.test(f)) fs.unlinkSync(path.join(dir, f));
  const jpgs = [];
  let n = 0;
  for (const s of deck.slides) {
    n += 1;
    await gotoRender(page, slug, s.id);
    const stem = `${String(n).padStart(2, '0')}-${s.kind === 'backup' ? s.label : `S${s.label}`}-${s.id}`;
    await page.screenshot({ path: path.join(dir, `${stem}.png`), type: 'png' });
    const jpg = await page.screenshot({ type: 'jpeg', quality: 86 });
    jpgs.push(jpg);
    process.stdout.write('.');
  }
  // Slides PDF from the JPEGs, one 1920x1080 page each.
  const p = await newPage(browser, { log });
  const html = `<!doctype html><html><head><style>
    @page { size: 1920px 1080px; margin: 0; }
    html, body { margin: 0; padding: 0; background: #000; }
    img { display: block; width: 1920px; height: 1080px; page-break-after: always; break-after: page; }
    img:last-child { page-break-after: auto; break-after: auto; }
  </style></head><body>${jpgs.map((b) => `<img src="data:image/jpeg;base64,${b.toString('base64')}">`).join('')}</body></html>`;
  await p.setContent(html, { waitUntil: 'load' });
  await p.pdf({ path: path.join(PDF, `${slug}-slides.pdf`), width: '1920px', height: '1080px', printBackground: true, pageRanges: '' });
  await p.close();
  // Script PDF: the script view's print stylesheet.
  const q = await newPage(browser, { width: 1400, height: 1000, log });
  await q.goto(`${BASE}/portal/seminar-decks/${slug}/script`, { waitUntil: 'networkidle2', timeout: 180000 });
  await q.waitForSelector('.sd-print-root .sd-script__row', { timeout: 120000 });
  await q.evaluate(async () => {
    await document.fonts.ready;
    const imgs = [...document.querySelectorAll('.sd-print-root img')];
    await Promise.all(imgs.map((im) => (im.complete ? null : new Promise((r) => { im.onload = r; im.onerror = r; }))));
  });
  await new Promise((r) => setTimeout(r, 800));
  await q.pdf({ path: path.join(PDF, `${slug}-script.pdf`), format: 'A4', printBackground: true, margin: { top: '12mm', bottom: '12mm', left: '12mm', right: '12mm' } });
  await q.close();
  const sz = (f) => (fs.statSync(path.join(PDF, f)).size / 1048576).toFixed(1);
  console.log(`\n${slug}: ${n} slides -> ${slug}-slides.pdf ${sz(`${slug}-slides.pdf`)} MB, ${slug}-script.pdf ${sz(`${slug}-script.pdf`)} MB`);
}
await browser.close();
if (log.length) console.log(log.filter((l) => !/favicon/.test(l)).slice(0, 30).join('\n'));
