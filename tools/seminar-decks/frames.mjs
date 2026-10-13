// Frames of a built slide's timeline, in present mode, for checking motion.
//   node tools/seminar-decks/frames.mjs --deck plain --slides 1,2,3 --out <dir> [--read 30,88,57] [--at 12.5,20]
// Opens the slide as the audience sees it (present from slide n, so its timeline
// plays from the start), pauses every Web Animation on the current slide and
// seeks them together. For each slide it saves frames at 0, 25, 50, 75 and 100%
// of the read time (--read, seconds; default: the end of the motion), at the end
// of the motion, and at any extra --at times, plus one contact sheet.
import fs from 'node:fs';
import path from 'node:path';
import { BASE, newPage, openBrowser } from './lib.mjs';

const args = process.argv.slice(2);
const opt = (k, d) => {
  const i = args.indexOf(k);
  return i >= 0 ? args[i + 1] : d;
};
const deck = opt('--deck', 'plain');
const slides = opt('--slides', '1').split(',').map(Number);
const reads = (opt('--read', '') || '').split(',').filter(Boolean).map(Number);
const extra = (opt('--at', '') || '').split(',').filter(Boolean).map(Number);
const out = opt('--out', 'frames');
fs.mkdirSync(out, { recursive: true });

const browser = await openBrowser();
const log = [];
const page = await newPage(browser, { log });
const report = [];
for (const [k, n] of slides.entries()) {
  await page.goto(`${BASE}/portal/seminar-decks/${deck}/${n}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForSelector('.sd-present__slot.is-current .sd-slide', { timeout: 120000 });
  await page.evaluate(async () => {
    await document.fonts.ready;
    const imgs = [...document.querySelectorAll('.sd-present__slot.is-current img')];
    await Promise.all(imgs.map((im) => (im.complete ? null : new Promise((r) => { im.onload = r; im.onerror = r; }))));
  });
  const end = await page.evaluate(() => {
    const cur = document.querySelector('.sd-present__slot.is-current');
    const anims = document.getAnimations().filter((a) => a.effect?.target && cur.contains(a.effect.target));
    anims.forEach((a) => a.pause());
    window.__sdAnims = anims;
    return anims.reduce((m, a) => {
      const t = a.effect.getTiming();
      return Math.max(m, (t.delay + t.duration) / 1000);
    }, 0);
  });
  const read = reads[k] || end;
  const times = [
    ['000', 0], ['025', read * 0.25], ['050', read * 0.5], ['075', read * 0.75], ['100', read], ['end', end],
    ...extra.map((t) => [`t${t}`, t]),
  ];
  const shots = [];
  for (const [tag, t] of times) {
    await page.evaluate((ms) => window.__sdAnims.forEach((a) => { a.currentTime = ms; }), t * 1000);
    await new Promise((r) => setTimeout(r, 120));
    const file = path.join(out, `${deck}-${String(n).padStart(2, '0')}-${tag}.png`);
    await page.screenshot({ path: file });
    shots.push({ tag, t: Number(t.toFixed(2)), file });
  }
  report.push({ slide: n, motionEnd: Number(end.toFixed(2)), read, count: await page.evaluate(() => window.__sdAnims.length), shots });
  // Contact sheet: three across, captioned with the time.
  const sheet = await newPage(browser, { width: 1950, height: 1200 });
  const cells = shots.map((s) => `<figure style="margin:0;width:640px"><img src="data:image/png;base64,${fs.readFileSync(s.file).toString('base64')}" style="width:640px;display:block;border:1px solid #999"><figcaption style="font:16px sans-serif;padding:4px 0 10px">slide ${n} · ${s.tag} · ${s.t} s</figcaption></figure>`).join('');
  await sheet.setContent(`<html><body style="margin:0;padding:8px;background:#fff;display:flex;flex-wrap:wrap;gap:0 10px;width:1950px">${cells}</body></html>`);
  await sheet.screenshot({ path: path.join(out, `${deck}-${String(n).padStart(2, '0')}-sheet.png`), fullPage: true });
  await sheet.close();
}
await browser.close();
console.log(JSON.stringify(report.map(({ shots, ...r }) => r)));
if (log.length) console.log(log.filter((l) => !/favicon|DevTools|React DevTools/.test(l)).slice(0, 20).join('\n'));
