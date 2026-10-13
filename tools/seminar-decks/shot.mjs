// Screenshot one portal URL or one deck slide.
//   node tools/seminar-decks/shot.mjs url /portal/seminar-decks out.png [w h]
//   node tools/seminar-decks/shot.mjs slide one-scan title out.png [step]
//   node tools/seminar-decks/shot.mjs deck one-scan outdir [w]     every slide, finished state
import fs from 'node:fs';
import path from 'node:path';
import { BASE, gatesData, gotoRender, newPage, openBrowser } from './lib.mjs';

const [, , kind, a, b, c, d] = process.argv;
const log = [];
const browser = await openBrowser();
try {
  if (kind === 'url') {
    const w = Number(c) || 1600;
    const h = Number(d) || 1000;
    const page = await newPage(browser, { width: w, height: h, log });
    await page.goto(`${BASE}${a}`, { waitUntil: 'networkidle2', timeout: 120000 });
    await new Promise((r) => setTimeout(r, 1500));
    await page.screenshot({ path: b, fullPage: false });
  } else if (kind === 'slide') {
    const page = await newPage(browser, { log });
    await gotoRender(page, a, b, { step: d === undefined ? undefined : Number(d) });
    await page.screenshot({ path: c });
  } else if (kind === 'deck') {
    const width = Number(c) || 960;
    const page = await newPage(browser, { log });
    const g = await gatesData(page);
    const deck = g.decks.find((x) => x.slug === a);
    fs.mkdirSync(b, { recursive: true });
    for (const s of deck.slides) {
      await gotoRender(page, a, s.id);
      const file = path.join(b, `${a}-${String(s.label).padStart(2, '0')}-${s.id}.png`);
      const buf = await page.screenshot({ type: 'png' });
      if (width === 1920) fs.writeFileSync(file, buf);
      else {
        const p2 = await newPage(browser, { width, height: Math.round((width * 9) / 16) });
        await p2.setContent(`<html><body style="margin:0;background:#000"><img src="data:image/png;base64,${buf.toString('base64')}" style="width:${width}px;height:auto;display:block"></body></html>`);
        await p2.screenshot({ path: file });
        await p2.close();
      }
      console.log(file);
    }
  }
} finally {
  await browser.close();
}
if (log.length) console.log(log.join('\n'));
