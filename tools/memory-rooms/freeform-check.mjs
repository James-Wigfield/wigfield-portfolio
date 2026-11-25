#!/usr/bin/env node
/* freeform-check: old photos ("I can't retake them", CONTRACTS.md 8) and the layout + viewpoint editor, in headless
   Edge (SVG atlas only: no Mapbox loads).

     node tools/memory-rooms/freeform-check.mjs [--base http://127.0.0.1:8788] [--dark] [--keep]

   capture 1440   /memories/new → interior + "These are old photos" → 5 steps (Place, Photos, Layout, Memory,
                  Location), no shot guide, "Add from library" first; 14 photos (one with EXIF: an iPhone's 24 mm)
                  → "14 of 40", a caption; Layout → Sketch it → the editor
   editor 1440    (mouse) four corners + a tap on the first closes the outline, live edge lengths; drag a
                  thumbnail onto the plan → a wedge (its photo shows large); drag the wedge's body → it moves;
                  drag its tip → it turns; Undo / Redo round-trip both; R turns it 5° by keyboard; Delete + Undo;
                  an edge → "Door here"; no long task (> 50 ms) while dragging
   saved          note + era → save (no location) → the outbox uploads → the API: capture.mode freeform, era, the
                  caption under photo 2, the closed outline + its door, the viewpoint on photo 1, 14 photos + 14
                  thumbs (the guided limit is 12), photo 1's media row carries its EXIF (focal35 24)
   editor 390     the edit page on a phone (touch): open the editor, tap a thumbnail then the plan → a viewpoint; a
                  finger drag on its wedge moves it and the page does NOT scroll meanwhile (window + the form);
                  every handle ≥ 44 px; Save → the API has both viewpoints; no horizontal overflow
   console        zero console / page errors
   Screenshots → memory-rooms-work/_page-check/freeform-*.png. The spot is deleted at the end (--keep keeps it). */

import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
import sharp from 'sharp';
import { client, config, WORK } from './lib/api.mjs';

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const args = process.argv.slice(2);
const opt = (n, d) => (args.includes(n) ? args[args.indexOf(n) + 1] : d);
const base = opt('--base', process.env.MEMORIES_API || 'http://127.0.0.1:8788').replace(/\/+$/, '');
const scheme = args.includes('--dark') ? 'dark' : 'light';
const OUT = path.join(WORK, '_page-check');
fs.mkdirSync(OUT, { recursive: true });
const cfg = config();
cfg.base = base;
const api = client(cfg);
const results = [];
const record = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? `  ${detail}` : ''}`);
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const sel = (n) => `[data-mr="${n}"]`;
const shot = (page, name) => page.screenshot({ path: path.join(OUT, `freeform-${name}-${scheme}.png`) });

const ping = await api.ping();
if (!(ping.features || []).includes('freeform')) {
  console.error('This Worker has no freeform spots (ping): deploy it / run supabase/memory_freeform.sql.');
  process.exit(2);
}

// ── 14 test photos (portrait 1536 × 2048), photo 1 with an iPhone's EXIF ────────────────────────────────────────
const PHOTO_DIR = path.join(OUT, 'freeform-photos');
fs.mkdirSync(PHOTO_DIR, { recursive: true });
const files = [];
for (let i = 1; i <= 14; i++) {
  const hue = (i * 47) % 360;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1536" height="2048"><rect width="100%" height="100%" fill="hsl(${hue},30%,55%)"/><text x="120" y="1900" font-family="Arial" font-size="260" fill="#fff">old ${i}</text></svg>`;
  let img = sharp(Buffer.from(svg));
  if (i === 1) img = img.withExif({ IFD0: { Make: 'Apple', Model: 'iPhone 15 Pro' }, IFD2: { FocalLengthIn35mmFilm: '24', FocalLength: '6.86', DateTimeOriginal: '2019:06:02 18:40:11', OffsetTimeOriginal: '+08:00' } });
  const file = path.join(PHOTO_DIR, `old-${String(i).padStart(2, '0')}.jpg`);
  fs.writeFileSync(file, await img.jpeg({ quality: 80 }).toBuffer());
  files.push(file);
}

const browser = await puppeteer.launch({ executablePath: EDGE, headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
async function open(width, ctx = browser) {
  const page = await ctx.newPage();
  const mobile = width < 600;
  await page.emulate({ viewport: { width, height: mobile ? 844 : 900, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile }, userAgent: mobile ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' : await browser.userAgent() });
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: scheme }]);
  page.problems = [];
  page.on('pageerror', (e) => page.problems.push(`pageerror: ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && page.problems.push(`console.error: ${m.text()}`));
  await page.evaluateOnNewDocument((token) => {
    try {
      localStorage.setItem('mr:token', token);
      localStorage.setItem('mr:who', 'james');
      localStorage.setItem('mr:map', 'atlas');
    } catch {
      /* ignore */
    }
  }, cfg.token);
  return page;
}
const noErrors = (page, label) => {
  record(`${label}: no console/page errors`, page.problems.length === 0, page.problems.slice(0, 3).join(' | '));
  page.problems.length = 0;
};
const box = (page, s) => page.$eval(s, (el) => {
  const r = el.getBoundingClientRect();
  return { x: r.left, y: r.top, w: r.width, h: r.height, cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
});
const transformOf = (page, photo) => page.$eval(`${sel('layout-view')}[data-photo="${photo}"]`, (g) => g.getAttribute('transform')).catch(() => null);
const yawText = (page) => page.$eval('.mr-lay__yaw', (e) => e.textContent).catch(() => null);
async function mouseDrag(page, from, to, steps = 18) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let k = 1; k <= steps; k++) await page.mouse.move(from.x + ((to.x - from.x) * k) / steps, from.y + ((to.y - from.y) * k) / steps);
  await page.mouse.up();
  await wait(150);
}

const title = `freeform-check ${new Date().toISOString().slice(11, 19)}`;
let spotId = null;

// ── capture at 1440 ────────────────────────────────────────────────────────────────────────────────────────────
{
  const ctx = await browser.createBrowserContext();
  const page = await open(1440, ctx);
  await page.goto(`${base}/memories/new`, { waitUntil: 'networkidle2' });
  await page.waitForSelector(sel('kind-interior'), { timeout: 20000 });
  await page.click(sel('kind-interior'));
  await page.type(sel('title-input'), title);
  const toggle = await page.$(`${sel('freeform-toggle')} input`);
  record('capture 1440: "These are old photos" shows once a kind is picked', Boolean(toggle));
  await toggle.click();
  const steps = await page.$$eval('.mr-step-name', (els) => els.map((e) => e.textContent));
  record('capture 1440: old photos make it 5 steps (Place, Photos, Layout, Memory, Location)', steps.join(',') === 'Place,Photos,Layout,Memory,Location', steps.join(' → '));
  await page.click(sel('next'));
  await page.waitForSelector(sel('freeform-photos'), { timeout: 8000 });
  const libFirst = await page.$eval('.mr-photo-actions .mr-btn--primary', (e) => e.textContent.includes('library'));
  const guide = Boolean(await page.$('.mr-shot'));
  record('capture 1440: photos: no shot guide, "Add from library" is the main action', libFirst && !guide);
  const input = await page.$(sel('library-input'));
  await input.uploadFile(...files);
  await page.waitForFunction(() => document.querySelectorAll('[data-mr="photo-thumb"]').length === 14, { timeout: 90000 }).catch(() => {});
  const status = await page.$eval(sel('photo-status'), (e) => e.textContent);
  record('capture 1440: 14 old photos in (the guided limit is 12)', /14 of 40/.test(status), status);
  const caps = await page.$$(sel('photo-caption'));
  await caps[1].type('from the bed');
  await shot(page, 'capture-photos-1440');
  await page.click(sel('next'));
  await page.waitForSelector(sel('layout-step'), { timeout: 8000 });
  record('capture 1440: the layout step offers Skip (default) and Sketch it', Boolean(await page.$(sel('layout-skip'))) && Boolean(await page.$(sel('layout-sketch'))));
  await page.click(sel('layout-sketch'));
  await page.waitForSelector(sel('layout-stage'), { timeout: 15000 });
  await wait(400);

  // ── the editor with a mouse ──
  await page.click(sel('layout-mode-outline'));
  const st = await box(page, sel('layout-stage'));
  const pts = [
    [0.3, 0.3],
    [0.7, 0.3],
    [0.7, 0.72],
    [0.3, 0.72],
  ].map(([fx, fy]) => ({ x: st.x + st.w * fx, y: st.y + st.h * fy }));
  for (const p of pts) {
    await page.mouse.click(p.x, p.y);
    await wait(120);
  }
  const first = await box(page, '[data-role="corner"][data-first]');
  await page.mouse.click(first.cx, first.cy);
  await wait(200);
  const closed = await page.$eval(sel('layout-stage'), (e) => e.hasAttribute('data-closed') && Number(e.dataset.corners));
  const lens = await page.$$eval('.mr-lay__len text', (els) => els.map((e) => e.textContent));
  record('editor 1440: four taps + a tap on the first corner close the outline, each edge labelled in metres', closed === 4 && lens.length === 4 && lens.every((t) => /\d m$/.test(t)), `${closed} corners, ${lens.join(' / ')}`);
  // an edge → a door on it
  const edge = await page.$('[data-role="edge"][data-i="2"]');
  const eb = await edge.boundingBox();
  await page.mouse.click(eb.x + eb.width / 2, eb.y + eb.height / 2);
  await wait(150);
  const doorBtn = await page.$(sel('layout-add-door'));
  if (doorBtn) await doorBtn.click();
  await wait(150);
  record('editor 1440: tapping an edge offers a door; "Door here" puts one on it', Boolean(doorBtn) && (await page.$$('.mr-lay__opening[data-type="door"]')).length === 1);

  // drag a thumbnail onto the plan (beside it on a desktop: both in view)
  await page.click(sel('layout-mode-views'));
  await page.$eval(sel('layout-stage'), (e) => e.scrollIntoView({ block: 'center' }));
  await wait(300);
  const inView = await page.evaluate(() => {
    const a = document.querySelector('[data-mr="layout-stage"]').getBoundingClientRect();
    const b = document.querySelector('[data-mr="layout-thumb"][data-n="1"]').getBoundingClientRect();
    return a.top >= 0 && a.bottom <= innerHeight + 1 && b.top >= 0 && b.bottom <= innerHeight;
  });
  record('editor 1440: the plan and the photo strip are in view together (a drag needs both)', inView);
  const thumb = await box(page, `${sel('layout-thumb')}[data-n="1"]`);
  Object.assign(st, await box(page, sel('layout-stage')));
  const target = { x: st.x + st.w * 0.45, y: st.y + st.h * 0.55 };
  await mouseDrag(page, { x: thumb.cx, y: thumb.cy }, target, 24);
  await wait(250);
  const placed = await page.$eval(sel('layout-stage'), (e) => Number(e.dataset.views));
  const big = await page.$eval(`${sel('layout-photo')} img`, (e) => e.getAttribute('src')).catch(() => null);
  record('editor 1440: dragging a thumbnail onto the plan drops a wedge, and its photo shows large', placed === 1 && Boolean(big), `${placed} viewpoint(s), photo ${big ? 'shown' : 'missing'}`);
  await shot(page, 'editor-1440');

  // move it by its body, with a long-task watch
  await page.evaluate(() => {
    window.__long = 0;
    try {
      new PerformanceObserver((l) => (window.__long += l.getEntries().length)).observe({ type: 'longtask', buffered: false });
    } catch {
      /* no longtask support */
    }
  });
  const t0 = await transformOf(page, 1);
  const body = await box(page, `${sel('layout-view')}[data-photo="1"] .mr-lay__body`);
  await mouseDrag(page, { x: body.cx, y: body.cy }, { x: body.cx + 70, y: body.cy - 40 }, 30);
  const t1 = await transformOf(page, 1);
  const longs = await page.evaluate(() => window.__long);
  record('editor 1440: dragging a wedge moves it (and nothing blocks a frame while dragging)', t0 && t1 && t0 !== t1 && longs === 0, `${t0} → ${t1}, ${longs} long task(s)`);
  // aim it by its tip
  const y0 = await yawText(page);
  const aim = await box(page, `${sel('layout-view')}[data-photo="1"] [data-role="view-aim"] .mr-lay__aim-dot`);
  const b2 = await box(page, `${sel('layout-view')}[data-photo="1"] .mr-lay__body`);
  // swing the tip a quarter turn round the body
  const rx = aim.cx - b2.cx;
  const ry = aim.cy - b2.cy;
  await mouseDrag(page, { x: aim.cx, y: aim.cy }, { x: b2.cx - ry, y: b2.cy + rx }, 24);
  const y1 = await yawText(page);
  record('editor 1440: dragging the wedge\'s tip turns it', y0 && y1 && y0 !== y1, `${y0} → ${y1}`);
  // undo / redo
  await page.click(sel('layout-undo'));
  await wait(120);
  const tU = await transformOf(page, 1);
  await page.click(`${sel('layout-view')}[data-photo="1"] .mr-lay__body`).catch(() => {});
  const yU = await yawText(page);
  await page.click(sel('layout-redo'));
  await wait(120);
  await page.click(`${sel('layout-view')}[data-photo="1"] .mr-lay__body`).catch(() => {});
  const yR = await yawText(page);
  record('editor 1440: Undo takes the turn back, Redo puts it back', yU === y0 && yR === y1 && tU === t1, `undo ${yU}, redo ${yR}`);
  // keyboard: R turns 5°, Delete removes, Undo brings it back
  await page.focus(sel('layout-stage'));
  await page.keyboard.press('KeyR');
  await wait(100);
  const yK = await yawText(page);
  await page.keyboard.press('Delete');
  await wait(100);
  const gone = await page.$eval(sel('layout-stage'), (e) => Number(e.dataset.views));
  await page.keyboard.down('Control');
  await page.keyboard.press('KeyZ');
  await page.keyboard.up('Control');
  await wait(100);
  const back = await page.$eval(sel('layout-stage'), (e) => Number(e.dataset.views));
  const deg = (t) => Number((t || '').match(/-?\d+/)?.[0]);
  record('editor 1440: R turns the viewpoint 5°, Delete removes it, Ctrl+Z brings it back', ((deg(yK) - deg(y1) + 360) % 360) === 5 && gone === 0 && back === 1, `${y1} → ${yK}; after Delete ${gone}, after Ctrl+Z ${back}`);
  const placedMark = await page.$eval(`${sel('layout-thumb')}[data-n="1"]`, (e) => e.hasAttribute('data-placed'));
  record('editor 1440: a placed photo is marked "Placed" in the strip', placedMark);

  // memory (+ era), no location, save
  await page.click(sel('next'));
  await page.waitForSelector(sel('note-input'), { timeout: 8000 });
  await page.type(sel('note-input'), 'Where I lived through uni.');
  await page.type(sel('era-input'), 'lived here 2019–2021');
  await page.click(sel('next'));
  await wait(400);
  await page.click(sel('save'));
  const saved = await page.waitForSelector('[data-mr="saved"], .mr-saved', { timeout: 20000 }).then(() => true).catch(() => false);
  record('capture 1440: saves (no location yet is fine)', saved);
  // wait for the outbox to upload everything
  let spot = null;
  for (let i = 0; i < 90 && !spot; i++) {
    await wait(1000);
    const list = await api.listSpots();
    const s = list.find((x) => x.title === title);
    if (s && s.media.filter((m) => m.type === 'photo').length === 14 && s.media.filter((m) => m.type === 'thumb').length === 14) spot = s;
  }
  spotId = spot?.id || null;
  const cap = spot?.capture || {};
  const p1 = spot?.media.find((m) => m.type === 'photo' && m.name === '1');
  record('saved: the spot is freeform with its era and the caption under photo 2', cap.mode === 'freeform' && cap.era === 'lived here 2019–2021' && cap.captions?.['2'] === 'from the bed', JSON.stringify({ mode: cap.mode, era: cap.era, captions: cap.captions }));
  record('saved: the closed outline, its door and the viewpoint on photo 1 came with it', cap.layout?.outline?.length === 4 && cap.layout.openings?.[0]?.type === 'door' && cap.views?.length === 1 && cap.views[0].photo === 1 && ['rough', 'exact'].includes(cap.views[0].conf), JSON.stringify({ outline: cap.layout?.outline?.length, openings: cap.layout?.openings, views: cap.views }));
  record('saved: 14 photos + 14 thumbs uploaded (a freeform spot takes up to 40)', Boolean(spot), spot ? '14 + 14' : 'not all uploaded');
  record("saved: photo 1's media row has its EXIF (focal35 24, Apple, taken 2019-06-02)", p1?.exif?.focal35 === 24 && p1.exif.make === 'Apple' && /^2019-06-02T18:40:11/.test(p1.exif.takenAt || '') && p1.exif.width === 1536, JSON.stringify(p1?.exif || null));
  noErrors(page, 'capture 1440');
  await page.close();
  await ctx.close();
}

// ── the edit page on a phone: touch ────────────────────────────────────────────────────────────────────────────
if (spotId) {
  const page = await open(390);
  await page.goto(`${base}/memories/${spotId}/edit`, { waitUntil: 'networkidle2' });
  await page.waitForSelector(sel('edit-layout-open'), { timeout: 20000 });
  await page.$eval(sel('edit-layout-open'), (e) => e.scrollIntoView({ block: 'center' }));
  await page.tap(sel('edit-layout-open'));
  await page.waitForSelector(sel('layout-stage'), { timeout: 15000 });
  await page.$eval(sel('layout-stage'), (e) => e.scrollIntoView({ block: 'center' }));
  await wait(500);
  // every handle on the plan is a ≥ 44 px target on touch
  const hits = await page.$$eval('.mr-lay__hit', (els) => els.map((e) => e.getBoundingClientRect()).map((r) => Math.min(r.width, r.height)));
  record('editor 390: every handle is a ≥ 44 px target on touch', hits.length > 0 && hits.every((v) => v >= 43.5), `${hits.length} handles, smallest ${Math.min(...hits).toFixed(0)} px`);
  // tap a thumbnail, then the plan
  await page.$eval(`${sel('layout-thumb')}[data-n="3"]`, (e) => e.scrollIntoView({ block: 'nearest', inline: 'center' }));
  await page.tap(`${sel('layout-thumb')}[data-n="3"]`);
  await wait(200);
  const st = await box(page, sel('layout-stage'));
  await page.touchscreen.tap(st.x + st.w * 0.3, st.y + st.h * 0.4);
  await wait(300);
  const n = await page.$eval(sel('layout-stage'), (e) => Number(e.dataset.views));
  record('editor 390: tap a thumbnail, then the plan: a viewpoint for that photo', n === 2 && Boolean(await page.$(`${sel('layout-view')}[data-photo="3"]`)), `${n} viewpoints`);
  // a finger drag on its wedge moves it, and nothing scrolls meanwhile
  const t0 = await transformOf(page, 3);
  const b = await box(page, `${sel('layout-view')}[data-photo="3"] .mr-lay__body`);
  const cdp = await page.createCDPSession();
  const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
  const scroll0 = await page.evaluate(() => ({ win: scrollY, form: document.querySelector('.mr-edit-body')?.scrollTop ?? 0, doc: document.scrollingElement.scrollTop }));
  await touch('touchStart', b.cx, b.cy);
  let mid = null;
  for (let k = 1; k <= 16; k++) {
    await touch('touchMove', b.cx + k * 3, b.cy + k * 6);
    if (k === 8) mid = await page.evaluate(() => ({ win: scrollY, form: document.querySelector('.mr-edit-body')?.scrollTop ?? 0, doc: document.scrollingElement.scrollTop }));
  }
  await touch('touchEnd');
  await wait(300);
  const t1 = await transformOf(page, 3);
  const still = mid && mid.win === scroll0.win && mid.form === scroll0.form && mid.doc === scroll0.doc;
  record('editor 390: a finger drag moves the wedge and the page does not scroll meanwhile', t0 !== t1 && still, `${t0} → ${t1}; scroll before ${JSON.stringify(scroll0)}, mid-drag ${JSON.stringify(mid)}`);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  record('editor 390: no horizontal overflow', overflow <= 1, `${overflow}px`);
  await shot(page, 'editor-390');
  // save through the edit form (one PATCH, ifUpdatedAt). Chrome swallows a tap within ~1.5 s of a fast synthetic touch
  // drag, so wait first, and tap again if the page didn't go
  await wait(1700);
  for (let attempt = 0; attempt < 2; attempt++) {
    await page.$eval(sel('edit-save'), (e) => e.scrollIntoView({ block: 'center' })).catch(() => {});
    await page.tap(sel('edit-save')).catch(() => {});
    const went = await page.waitForFunction((id) => location.pathname.endsWith(`/memories/${id}`), { timeout: 8000 }, spotId).then(() => true).catch(() => false);
    if (went) break;
    await wait(1700);
  }
  const after = await api.getSpot(spotId);
  record('editor 390: Save → the API has both viewpoints (photos 1 and 3)', after.capture?.views?.map((v) => v.photo).sort().join(',') === '1,3', JSON.stringify(after.capture?.views));
  noErrors(page, 'editor 390');
  await page.close();
}

await browser.close();
if (spotId && !args.includes('--keep')) await api.deleteSpot(spotId).catch(() => {});
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed (${scheme}). Screenshots: ${OUT}`);
process.exit(failed.length ? 1 : 0);
