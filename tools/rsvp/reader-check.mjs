/* ============================================================================
   RSVP PAPERS — headless browser check of the reader (puppeteer-core + Edge)
   ----------------------------------------------------------------------------
   Runs AFTER tools/rsvp/mcp-e2e.mjs has loaded the two fixture papers through
   the MCP into the stub DB. Drives the real built portal on the site Worker:

     • the deep link /portal/paper-rsvp/<id> survives the password gate
     • play / pause / rewind / speed keys, the paused context view
     • contents jump (incl. into the appendix), table + equation pause cards
       with expandable detail, the end-of-main stop card
     • progress is saved to the server and shown on the library shelf
     • library: soft delete → Bin → restore
     • no console errors, and it renders under the dark arcade theme

     npx wrangler dev --port 8788 --var SUPABASE_URL:http://127.0.0.1:8790 --var PORTAL_PASSWORD:wiggy1
     node tools/rsvp/reader-check.mjs <paperB-id> <paperA-id>

   RSVP_SHOTS=<dir> writes screenshots there.
   ========================================================================== */
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const BASE = process.env.SITE_URL || 'http://127.0.0.1:8788';
const PASSWORD = process.env.PORTAL_PASSWORD || 'wiggy1';
const [ID_B, ID_A] = process.argv.slice(2);
const SHOTS = process.env.RSVP_SHOTS || '';
if (!ID_B || !ID_A) { console.error('usage: node tools/rsvp/reader-check.mjs <paperB-id> <paperA-id>'); process.exit(2); }
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });

const fails = [];
const ok = (cond, label, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${extra !== '' ? '  — ' + extra : ''}`);
  if (!cond) fails.push(label);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = (page, name) => (SHOTS ? page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: false }) : Promise.resolve());

const text = (page, sel) => page.$eval(sel, (el) => el.textContent.trim()).catch(() => null);
const exists = (page, sel) => page.$(sel).then((h) => Boolean(h));
const count = (page, sel) => page.$$eval(sel, (els) => els.length);
async function waitFor(page, sel, timeout = 15000) {
  await page.waitForSelector(sel, { timeout });
}
async function pressUntil(page, key, sel, max = 400) {
  for (let i = 0; i < max; i++) {
    if (await exists(page, sel)) return i;
    await page.keyboard.press(key);
    await sleep(15);
  }
  return -1;
}
const counters = async (page) => {
  const t = await text(page, '.rsv-counters');
  const m = /^([\d,]+) \/ ([\d,]+) words/.exec(t || '');
  return m ? { read: Number(m[1].replace(/,/g, '')), total: Number(m[2].replace(/,/g, '')) } : null;
};

async function signIn(page) {
  await waitFor(page, '.portal-gate__input');
  await page.type('.portal-gate__input', PASSWORD);
  await page.keyboard.press('Enter');
}

// Enter on a focused <button> clicks it (browser semantics), so drop focus to
// the body first — the shortcut is meant for the stage.
async function pressEnter(page) {
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press('Enter');
}

// The MCP e2e run leaves saved progress on paper B; start this run fresh.
async function resetProgress(id) {
  await fetch(`${BASE}/api/papers/${id}/progress`, {
    method: 'PATCH',
    headers: { authorization: `Bearer ${PASSWORD}`, 'content-type': 'application/json' },
    body: JSON.stringify({ progress: { index: 0, total: 0, pct: 0, wpm: 320, heading: '', finished: false } }),
  });
}

async function main() {
  const browser = await puppeteer.launch({ executablePath: EDGE, headless: true, args: ['--window-size=1400,1000'], defaultViewport: { width: 1400, height: 1000 } });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|ERR_/.test(m.text())) errors.push(`console: ${m.text().slice(0, 200)}`); });

  // ── deep link survives the gate ────────────────────────────────────────
  console.log('--- deep link + gate ---');
  await resetProgress(ID_B);
  const deep = `${BASE}/portal/paper-rsvp/${ID_B}`;
  await page.goto(deep, { waitUntil: 'networkidle0' });
  ok(await exists(page, '.portal-gate__input'), 'gate shown for a signed-out deep link');
  await signIn(page);
  await waitFor(page, '.rsv-reader');
  ok(page.url() === deep, 'URL preserved through sign-in', page.url());
  const title = await text(page, '.rsv-title');
  ok(/Linear-Time Selective Scanning/.test(title || ''), 'reader opened the deep-linked paper', title);
  ok(await exists(page, '.rsv-hcard'), 'starts on the first heading card');
  const first = await counters(page);
  ok(first && first.total > 25000 && first.read === 0, 'counters show 0 / total words', JSON.stringify(first));
  ok(/RSVP Papers/.test(await text(page, '.portal__topbar-title')), 'sidebar/topbar reflect the tool from the URL');
  ok(await page.$eval('.portal__nav-item--active', (el) => el.textContent.includes('RSVP Papers')), 'sidebar marks RSVP Papers active');
  await shot(page, '01-reader-start');

  // ── play / pause ───────────────────────────────────────────────────────
  console.log('--- play / pause / rewind / speed ---');
  await page.keyboard.press('Space');
  await sleep(1800); // past the heading card
  const seen = new Set();
  for (let i = 0; i < 12; i++) { seen.add(await text(page, '.rsv-word')); await sleep(90); }
  ok(seen.size >= 4 && !seen.has(null), 'words flash and change while playing', `${seen.size} distinct in ~1 s`);
  ok(await page.$eval('.rsv-word__orp', (el) => el.textContent.length === 1), 'exactly one focal letter is highlighted');
  ok(await page.$eval('.rsv-btn--play', (el) => el.textContent.includes('Pause')), 'transport shows Pause while playing');
  await shot(page, '02-reader-playing');

  await page.keyboard.press('Space');
  await sleep(300);
  ok(await page.$eval('.rsv-btn--play', (el) => el.textContent.includes('Play')), 'space pauses');
  const w1 = await text(page, '.rsv-word');
  await sleep(400);
  ok((await text(page, '.rsv-word')) === w1, 'word stays put while paused');
  ok(await exists(page, '.rsv-context'), 'paused context appears');
  ok((await text(page, '.rsv-context__w--cur')) === w1, 'context marks the current word', `${w1}`);
  const ctxWords = await count(page, '.rsv-context__w');
  ok(ctxWords > 20, 'context shows the whole paragraph', `${ctxWords} words`);
  const c1 = await counters(page);
  await page.keyboard.press('ArrowLeft');
  await sleep(100);
  const c2 = await counters(page);
  ok(c2.read < c1.read, '← rewinds to the sentence start', `${c1.read} → ${c2.read}`);
  await page.keyboard.press('ArrowRight');
  await sleep(100);
  const c3 = await counters(page);
  ok(c3.read > c2.read, '→ jumps to the next sentence', `${c2.read} → ${c3.read}`);
  const wpm0 = Number((await text(page, '.rsv-transport__wpm')).replace(/\D/g, ''));
  await page.keyboard.press('ArrowUp'); await page.keyboard.press('ArrowUp');
  await sleep(80);
  const wpm1 = Number((await text(page, '.rsv-transport__wpm')).replace(/\D/g, ''));
  ok(wpm1 === wpm0 + 50, '↑ ↑ raises speed by 50 wpm', `${wpm0} → ${wpm1}`);
  await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowDown');
  await shot(page, '03-reader-paused-context');

  // click a context word → jumps there
  const target = await page.$$eval('.rsv-context__w', (els) => els[5]?.textContent);
  await page.$$eval('.rsv-context__w', (els) => els[5]?.click());
  await sleep(80);
  ok((await text(page, '.rsv-word')) === target, 'clicking a context word jumps to it', target);

  // Space with the Play button focused must toggle exactly once.
  await page.click('.rsv-btn--play');            // → playing
  await sleep(200);
  await page.keyboard.press('Space');            // button focused: keydown handler + no double click
  await sleep(300);
  ok(await page.$eval('.rsv-btn--play', (el) => el.textContent.includes('Play')), 'space on the focused Play button toggles once (pauses)');

  // ── contents + appendix jump ───────────────────────────────────────────
  console.log('--- contents ---');
  await page.keyboard.press('c');
  await waitFor(page, '.rsv-toc');
  const tocItems = await count(page, '.rsv-toc__item');
  ok(tocItems === 56, 'contents lists every section', `${tocItems}`);
  ok(await exists(page, '.rsv-toc__part'), 'appendix divider present');
  ok((await count(page, '.rsv-toc__item--l3')) > 5, 'level-3 headings indented', String(await count(page, '.rsv-toc__item--l3')));
  await page.$$eval('.rsv-toc__item--appendix-start .rsv-toc__btn', (els) => els[0].click());
  await sleep(200);
  ok(!(await exists(page, '.rsv-toc')), 'panel closes after a jump');
  ok(/appendix/i.test(await text(page, '.rsv-eyebrow__part')), 'jumped into the appendix');
  ok(/A Proofs/.test(await text(page, '.rsv-hcard__h')), 'appendix heading card shown', await text(page, '.rsv-hcard__h'));
  const pctText = await text(page, '.rsv-counters');
  ok(/\d+%/.test(pctText) && !/^0 \//.test(pctText), 'counters advanced to the appendix position', pctText);

  // ── table card + detail ────────────────────────────────────────────────
  console.log('--- pause cards ---');
  await page.keyboard.press('c');
  await waitFor(page, '.rsv-toc');
  await page.$$eval('.rsv-toc__btn', (els) => els.find((e) => /B\.1 Per-organ/.test(e.textContent)).click());
  await sleep(150);
  const stepsToTable = await pressUntil(page, 'ArrowRight', '.rsv-card--table');
  ok(stepsToTable >= 0, 'reached a table pause card by stepping sentences', `${stepsToTable} steps`);
  ok(/TABLE \d+/.test(await text(page, '.rsv-card__eyebrow')), 'table card eyebrow labelled', await text(page, '.rsv-card__eyebrow'));
  ok((await text(page, '.rsv-card__caption')).length > 40, 'table card shows its caption');
  ok(!(await exists(page, '.rsv-table')), 'detail collapsed by default');
  await pressEnter(page);
  await waitFor(page, '.rsv-table');
  const rows = await count(page, '.rsv-table tbody tr');
  ok(rows >= 5, 'enter expands the markdown table into a real table', `${rows} rows`);
  ok((await count(page, '.rsv-table__num')) > 10, 'numeric cells detected + right-aligned mono');
  await shot(page, '04-table-card');
  await page.keyboard.press('Space');
  await sleep(700);
  ok(await exists(page, '.rsv-word'), 'space continues past the card into words');
  await page.keyboard.press('Space');
  await sleep(200);

  // equation card (KaTeX)
  await page.keyboard.press('c');
  await waitFor(page, '.rsv-toc');
  await page.$$eval('.rsv-toc__btn', (els) => els.find((e) => /A\.2 Proof of Theorem 1/.test(e.textContent)).click());
  await sleep(150);
  const stepsToEq = await pressUntil(page, 'ArrowRight', '.rsv-card--equation');
  ok(stepsToEq >= 0, 'reached an equation card', `${stepsToEq} steps`);
  await pressEnter(page);
  await waitFor(page, '.rsv-katex .katex');
  ok(await exists(page, '.rsv-katex .katex-display'), 'equation renders through KaTeX in display mode');
  await shot(page, '05-equation-card');

  // key finding highlight
  await page.keyboard.press('c');
  await waitFor(page, '.rsv-toc');
  await page.$$eval('.rsv-toc__btn', (els) => els.find((e) => /^01/.test(e.textContent.trim())).click());
  await sleep(150);
  const stepsToKey = await pressUntil(page, 'ArrowRight', '.rsv-word--key', 600);
  ok(stepsToKey >= 0, 'reached a key-finding sentence', `${stepsToKey} steps`);
  ok(/key finding/i.test(await text(page, '.rsv-eyebrow')), 'eyebrow flags the key finding with a labelled dot');

  // ── end-of-main stop card ──────────────────────────────────────────────
  console.log('--- end of main body ---');
  await page.keyboard.press('c');
  await waitFor(page, '.rsv-toc');
  await page.$$eval('.rsv-toc__btn', (els) => els.find((e) => /8 Conclusion/.test(e.textContent)).click());
  await sleep(150);
  const stepsToStop = await pressUntil(page, 'ArrowRight', '.rsv-card--stop', 800);
  ok(stepsToStop >= 0, 'stepping past the conclusion reaches the stop card', `${stepsToStop} steps`);
  ok(/END OF MAIN BODY/.test(await text(page, '.rsv-card__eyebrow')), 'stop card labelled END OF MAIN BODY');
  ok(/8 Conclusion/i.test(await text(page, '.rsv-eyebrow')) && /main/i.test(await text(page, '.rsv-eyebrow__part')), 'stop card still attributed to the last main section', await text(page, '.rsv-eyebrow'));
  ok(/appendix sections remain/.test(await text(page, '.rsv-card__caption')), 'stop card summarises the appendix');
  await shot(page, '06-end-of-main');
  await page.keyboard.press('Space');
  await sleep(300);
  ok(/appendix/i.test(await text(page, '.rsv-eyebrow__part')) && (await exists(page, '.rsv-hcard')), 'space continues into the appendix (heading card)');
  await page.keyboard.press('Space'); // pause on the heading card
  await sleep(200);

  // ── progress saved server-side ─────────────────────────────────────────
  console.log('--- progress ---');
  await sleep(700);
  const saved = await page.evaluate(async (id) => {
    const key = JSON.parse(sessionStorage.getItem('portal_auth')).key;
    const r = await fetch(`/api/papers/${id}`, { headers: { authorization: `Bearer ${key}` } });
    return (await r.json()).data.progress;
  }, ID_B);
  ok(saved && saved.index > 1000 && saved.pct > 50 && /^A Proofs/.test(saved.heading), 'progress written to the server on pause', JSON.stringify(saved));

  // reload the deep link → resumes at the saved index
  await page.goto(deep, { waitUntil: 'networkidle0' });
  await waitFor(page, '.rsv-reader');
  const resumed = await counters(page);
  ok(resumed && resumed.read === Math.round(saved.pct / 100 * resumed.total) || (resumed && resumed.read > 1000), 'reload resumes near the saved position', JSON.stringify(resumed));
  ok(/appendix/i.test(await text(page, '.rsv-eyebrow__part')), 'resumed inside the appendix');

  // ── settings panel ─────────────────────────────────────────────────────
  await page.keyboard.press('s');
  await waitFor(page, '.rsv-set');
  ok((await count(page, '.rsv-seg')) >= 5, 'settings panel shows the segmented controls');
  await page.$$eval('.rsv-seg__btn', (els) => els.find((e) => e.textContent === 'Strong').click());
  await sleep(50);
  ok(await page.evaluate(() => JSON.parse(localStorage.getItem('rsvp:settings')).intensity === 1.5), 'settings persist to localStorage');
  await page.$$eval('.rsv-seg__btn', (els) => els.find((e) => e.textContent === 'Normal').click());
  await shot(page, '07-settings');
  await page.keyboard.press('Escape');
  await sleep(50);
  ok(!(await exists(page, '.rsv-set')), 'escape closes the panel');
  await page.keyboard.press('c');
  await waitFor(page, '.rsv-toc');
  await shot(page, '07b-contents');
  await page.keyboard.press('Escape');

  // ── library ────────────────────────────────────────────────────────────
  console.log('--- library ---');
  await page.click('.rsv-head .rsv-btn');
  await waitFor(page, '.rsv-lib');
  await waitFor(page, '.rsv-row'); // rows arrive after the list fetch
  ok(page.url().endsWith('/portal/paper-rsvp'), 'back to library updates the URL', page.url());
  ok((await count(page, '.rsv-rows:not(.rsv-rows--bin) .rsv-row')) === 2, 'library lists both papers');
  const rowB = await page.$$eval('.rsv-row', (els) => els.map((e) => e.textContent).find((t) => /Linear-Time/.test(t)));
  ok(/\d+%/.test(rowB) && /Complete/.test(rowB), 'shelf row shows progress % and Complete status', rowB.replace(/\s+/g, ' ').slice(0, 160));
  await shot(page, '08-library');

  // soft delete → Bin → restore
  await page.$$eval('.rsv-row', (els) => { const row = els.find((e) => /SegResMamba/.test(e.textContent)); row.querySelector('.rsv-row__actions button').click(); });
  await sleep(50);
  await page.$$eval('.rsv-row', (els) => { const row = els.find((e) => /SegResMamba/.test(e.textContent)); [...row.querySelectorAll('button')].find((b) => /Move to Bin/.test(b.textContent)).click(); });
  await sleep(600);
  ok((await count(page, '.rsv-rows:not(.rsv-rows--bin) .rsv-row')) === 1, 'delete moves the paper out of the shelf');
  ok(await exists(page, '.rsv-bin__head'), 'Bin appears');
  await page.click('.rsv-bin__head');
  await sleep(100);
  ok((await count(page, '.rsv-row--bin')) === 1, 'Bin holds the deleted paper');
  await page.$$eval('.rsv-row--bin button', (els) => els.find((b) => /Restore/.test(b.textContent)).click());
  await sleep(600);
  ok((await count(page, '.rsv-rows:not(.rsv-rows--bin) .rsv-row')) === 2, 'restore brings it back');

  // open paper A from the shelf → its first algorithm card
  await page.$$eval('.rsv-row__open', (els) => els.find((e) => /SegResMamba/.test(e.textContent)).click());
  await waitFor(page, '.rsv-reader');
  ok(page.url().endsWith(`/portal/paper-rsvp/${ID_A}`), 'opening from the shelf deep-links the paper', page.url());
  await page.keyboard.press('c');
  await waitFor(page, '.rsv-toc');
  await page.$$eval('.rsv-toc__btn', (els) => els.find((e) => /2\.1\. Encoder/.test(e.textContent)).click());
  await sleep(150);
  const stepsToAlg = await pressUntil(page, 'ArrowRight', '.rsv-card--algorithm', 600);
  ok(stepsToAlg >= 0, 'real paper: reached the Algorithm 1 card');
  await pressEnter(page);
  await waitFor(page, '.rsv-pre');
  ok(/F₁ ← Conv/.test(await text(page, '.rsv-pre')), 'algorithm pseudocode shown in a mono block');
  await shot(page, '09-algorithm-card');

  // ── arcade (dark) theme render ─────────────────────────────────────────
  await page.evaluate(() => localStorage.setItem('portal:theme', 'arcade'));
  await page.reload({ waitUntil: 'networkidle0' });
  await waitFor(page, '.rsv-reader');
  const bg = await page.$eval('.hp.portal', (el) => getComputedStyle(el).getPropertyValue('--ground').trim());
  ok(bg.toLowerCase() === '#15171c', 'arcade theme applies to the reader', bg);
  await page.keyboard.press('Space'); await sleep(1500);
  await shot(page, '10-arcade-playing');
  await page.keyboard.press('Space');
  await page.evaluate(() => localStorage.setItem('portal:theme', 'jade'));

  // ── the rest of the portal is untouched by the routing change ─────────
  console.log('--- routing ---');
  await page.goto(`${BASE}/portal`, { waitUntil: 'networkidle0' });
  await waitFor(page, '.portal__topbar-title');
  ok(/Overview/.test(await text(page, '.portal__topbar-title')), '/portal still opens the Overview', await text(page, '.portal__topbar-title'));
  await page.goto(`${BASE}/portal/no-such-tool/whatever`, { waitUntil: 'networkidle0' });
  await waitFor(page, '.portal__topbar-title');
  ok(/Overview/.test(await text(page, '.portal__topbar-title')), 'unknown tool id falls back to the Overview');
  await page.$$eval('.portal__nav-item', (els) => els.find((e) => /Deck Studio/.test(e.textContent)).click());
  await sleep(300);
  ok(page.url().endsWith('/portal/deck-studio') && /Deck Studio/.test(await text(page, '.portal__topbar-title')), 'sidebar click updates the URL (/portal/deck-studio)', page.url());
  await page.goBack({ waitUntil: 'networkidle0' });
  await sleep(200);
  ok(/Overview/.test(await text(page, '.portal__topbar-title')), 'browser back returns to the previous tool');

  ok(errors.length === 0, 'no console / page errors', errors.slice(0, 3).join(' || '));

  await browser.close();
  console.log(fails.length ? `\n${fails.length} FAILED: ${fails.join(' | ')}` : '\nall passed');
  process.exit(fails.length ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(2); });
