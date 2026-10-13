// Live-behaviour checks (run against the dev server and against `npm run cf:dev`, via SD_BASE):
//   node tools/seminar-decks/live.mjs [--deck one-scan] [--checks range,sync,offline,keys]
// range    an MP4 under /seminar-decks answers a Range request with 206 and Content-Range
// sync     presenter view -> "Open audience window": the audience window opens past the password
//          gate, and keys in either window move both (BroadcastChannel, postMessage backup)
// offline  present mode runs the Ready check; then the network is cut (page.setOfflineMode) and
//          every slide and build step is stepped through: no failed request, no clip error, fonts loaded
// keys     Right/Space/PageDown forward, Left/PageUp back, Home/End, number+Enter, B blackout
import { BASE, gatesData, newPage, openBrowser, SLUGS } from './lib.mjs';

const args = process.argv.slice(2);
const opt = (k, d) => {
  const i = args.indexOf(k);
  return i >= 0 ? args[i + 1] : d;
};
const decks = opt('--deck', SLUGS.join(',')).split(',');
const checks = new Set(opt('--checks', 'range,sync,offline,keys').split(','));
const results = [];
const res = (name, okv, detail = '') => {
  results.push({ name, ok: okv, detail });
  console.log(`${okv ? 'PASS' : 'FAIL'} ${name}${detail ? `: ${detail}` : ''}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await openBrowser();
const log = [];
const page = await newPage(browser, { log });
const G = await gatesData(page);

if (checks.has('range')) {
  const r = await page.evaluate(async (u) => {
    const x = await fetch(u, { headers: { Range: 'bytes=0-1023' } });
    const b = await x.arrayBuffer();
    return { status: x.status, cr: x.headers.get('content-range'), len: b.byteLength, type: x.headers.get('content-type') };
  }, `${BASE}/seminar-decks/clips/case-a-1-scan.mp4`);
  res('range request on an MP4', r.status === 206 && r.len === 1024, `${r.status} ${r.cr} ${r.len} bytes ${r.type}`);
}

for (const slug of decks) {
  const deck = G.decks.find((d) => d.slug === slug);
  const seq = deck.slides;

  if (checks.has('keys')) {
    const p = await newPage(browser, { log });
    await p.goto(`${BASE}/portal/seminar-decks/${slug}/present`, { waitUntil: 'domcontentloaded' });
    await p.waitForSelector('.sd-present');
    const st = () => p.evaluate(() => {
      const e = document.querySelector('.sd-present');
      return { i: Number(e.dataset.index), s: Number(e.dataset.step), black: !!document.querySelector('.sd-present__black') };
    });
    const press = async (k) => { await p.keyboard.press(k); await sleep(120); };
    const first = await st();
    await press('ArrowRight');
    const a = await st();
    await press('PageDown');
    const b = await st();
    await press('PageUp');
    const c = await st();
    await press('End');
    const d = await st();
    await press('Home');
    const e = await st();
    await press('1'); await press('2'); await press('Enter');
    const f = await st();
    await press('b');
    const g = await st();
    await press('.');
    const h = await st();
    const lastMain = seq.filter((x) => x.kind === 'main').length - 1;
    const moved = (x, y) => x.i !== y.i || x.s !== y.s;
    res(`${slug} keys`, moved(first, a) && moved(a, b) && c.i === a.i && c.s === a.s && d.i === lastMain && e.i === 0 && f.i === 11 && g.black && !h.black,
      JSON.stringify({ first, a, b, c, d, e, f, g, h }));
    await p.close();
  }

  if (checks.has('sync')) {
    const p = await newPage(browser, { width: 1440, height: 900, log });
    await p.goto(`${BASE}/portal/seminar-decks/${slug}/presenter`, { waitUntil: 'domcontentloaded' });
    await p.waitForSelector('.sd-pv');
    const popupP = new Promise((resolve) => browser.once('targetcreated', (t) => resolve(t)));
    await p.evaluate(() => [...document.querySelectorAll('.sd-pv__bar button')].find((b) => /audience/i.test(b.textContent)).click());
    const target = await popupP;
    let aud = await target.page();
    for (let k = 0; k < 50 && !aud; k += 1) { await sleep(100); aud = await target.page(); }
    await sleep(2500);
    const audState = async () => aud.evaluate(() => {
      const e = document.querySelector('.sd-present');
      return { gate: !!document.querySelector('.portal-gate'), present: !!e, i: e ? Number(e.dataset.index) : -1, s: e ? Number(e.dataset.step) : -1, url: location.pathname };
    });
    const pvState = async () => p.evaluate(() => {
      const e = document.querySelector('.sd-pv');
      return { i: Number(e.dataset.index), s: Number(e.dataset.step) };
    });
    const a0 = await audState();
    res(`${slug} audience window opens past the gate`, a0.present && !a0.gate, JSON.stringify(a0));
    await p.bringToFront();
    await p.keyboard.press('ArrowRight'); await sleep(150);
    await p.keyboard.press('ArrowRight'); await sleep(400);
    const pv1 = await pvState();
    const a1 = await audState();
    res(`${slug} presenter keys move the audience`, a1.i === pv1.i && a1.s === pv1.s && (pv1.i > 0 || pv1.s > 0), `presenter ${JSON.stringify(pv1)} audience ${JSON.stringify(a1)}`);
    await aud.bringToFront();
    await aud.keyboard.press('ArrowRight'); await sleep(400);
    const pv2 = await pvState();
    const a2 = await audState();
    res(`${slug} audience keys move the presenter`, a2.i === pv2.i && a2.s === pv2.s && (a2.i !== a1.i || a2.s !== a1.s), `presenter ${JSON.stringify(pv2)} audience ${JSON.stringify(a2)}`);
    // Crib jump to a backup.
    await p.bringToFront();
    await p.evaluate(() => [...document.querySelectorAll('.sd-pv__crib button')].find((b) => /Show backup/.test(b.textContent))?.click());
    await sleep(400);
    const pv3 = await pvState();
    const a3 = await audState();
    res(`${slug} crib jump reaches the audience`, a3.i === pv3.i && seq[pv3.i]?.kind === 'backup', `presenter ${JSON.stringify(pv3)} audience ${JSON.stringify(a3)}`);
    await aud.close();
    await p.close();
  }

  if (checks.has('offline')) {
    const p = await newPage(browser, { log });
    const failed = [];
    p.on('requestfailed', (r) => failed.push(r.url()));
    await p.goto(`${BASE}/portal/seminar-decks/${slug}/present`, { waitUntil: 'domcontentloaded' });
    await p.waitForSelector('.sd-present[data-ready="ready"], .sd-present[data-ready="failed"]', { timeout: 180000 });
    const readyState = await p.evaluate(() => document.querySelector('.sd-present').dataset.ready);
    await p.setOfflineMode(true);
    failed.length = 0;
    let steps = 0;
    const errs = [];
    const total = seq.reduce((a, s) => a + (s.steps || 1), 0);
    for (let k = 0; k < total + 2; k += 1) {
      await sleep(900);
      const info = await p.evaluate(() => {
        const cur = document.querySelector('.sd-present__slot.is-current');
        const vids = [...cur.querySelectorAll('video')];
        const imgs = [...cur.querySelectorAll('img')];
        return {
          i: Number(document.querySelector('.sd-present').dataset.index),
          videoErrors: vids.filter((v) => v.error).length,
          nonBlobVideos: vids.filter((v) => !v.currentSrc.startsWith('blob:') && v.currentSrc).map((v) => v.currentSrc),
          brokenImgs: imgs.filter((im) => im.complete && im.naturalWidth === 0).map((im) => im.src.slice(0, 80)),
          holds: [...cur.querySelectorAll('.sd-clip')].map((c) => c.dataset.clipState),
        };
      });
      if (info.videoErrors || info.nonBlobVideos.length || info.brokenImgs.length) errs.push(info);
      steps += 1;
      await p.keyboard.press('ArrowRight');
    }
    const fontsOk = await p.evaluate(() => [...document.fonts].filter((f) => f.family.startsWith('"SD') || f.family.startsWith('SD')).some((f) => f.status === 'loaded'));
    res(`${slug} offline after the Ready check`, readyState === 'ready' && !failed.length && !errs.length && fontsOk,
      `ready=${readyState}, ${steps} steps, failed requests ${failed.length}${failed.length ? ` (${failed.slice(0, 3).join(', ')})` : ''}, slide problems ${errs.length}${errs.length ? ` ${JSON.stringify(errs.slice(0, 2))}` : ''}, fonts ${fontsOk}`);
    await p.setOfflineMode(false);
    await p.close();
  }
}

await browser.close();
const bad = results.filter((r) => !r.ok);
console.log(`\n${results.length - bad.length} / ${results.length} live checks passed`);
const noisy = log.filter((l) => !/favicon|ERR_INTERNET_DISCONNECTED|net::ERR_FAILED/.test(l));
if (noisy.length) console.log(noisy.slice(0, 20).join('\n'));
process.exitCode = bad.length ? 1 : 0;
