#!/usr/bin/env node
/* place-check: capturing a whole place on the phone, end to end, in headless Edge (no Mapbox loads).

     node tools/memory-rooms/place-check.mjs [--base http://127.0.0.1:8794] [--dark]

   Against a LOCAL Worker. At 390 (touch) unless said otherwise:
   A. /memories/new: "A whole place" → name → location (typed) → a floor-plan photo → two outside
      shots → OFFLINE → Save: the place page opens from this phone alone (outbox + IndexedDB).
   B. Offline still: add two rooms on the checklist; sketch the plan: place a room on the grid, drag
      it, size it by its corner handle, name it; mark a room on the floor-plan photo; a sketch with
      overlapping rooms is kept on the phone and flagged, not sent.
   C. Back online: the outbox sends the place, its photos and the sketch; the API has them.
   D. A room from the checklist: the normal capture opens with the room filled in, 4 photos, a
      note, a typed location, Save; the checklist shows it captured; the API spot has the
      buildingId + roomId; "Back to <place>" on the saved screen.
   E. 1440: the place page and the sketch at desktop size, the plan view filled in.
   Everything it creates is deleted at the end. Screens: memory-rooms-work/_place-check/. */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import sharp from 'sharp';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = path.join(REPO, 'memory-rooms-work', '_place-check');
const FIX = path.join(REPO, 'memory-rooms-work', '_dev', 'place-photos');
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const args = process.argv.slice(2);
const BASE = (args.includes('--base') ? args[args.indexOf('--base') + 1] : process.env.MEMORIES_API || 'http://127.0.0.1:8794').replace(/\/+$/, '');
const SCHEME = args.includes('--dark') ? 'dark' : 'light';
const TOKEN = process.env.MEMORIES_PASSWORD || 'trip-local';
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(FIX, { recursive: true });

const results = [];
const record = (label, ok, detail = '') => {
  results.push({ label, ok, detail });
  console.log(`${ok ? '✓' : '✗'} ${label}${detail ? `  ${detail}` : ''}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sel = (n) => `[data-mr="${n}"]`;
const api = async (p, init = {}) => {
  const res = await fetch(`${BASE}/api/memories${p}`, { ...init, headers: { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json', ...(init.headers || {}) } });
  return { status: res.status, body: await res.json().catch(() => null) };
};

// test photos: a "floor plan" (lines on white) and coloured rooms
const photo = async (name, w, h, svg) => {
  const f = path.join(FIX, name);
  if (!fs.existsSync(f)) await sharp(Buffer.from(svg(w, h))).jpeg({ quality: 82 }).toFile(f);
  return f;
};
const planPhoto = await photo('plan.jpg', 1600, 1200, (w, h) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="#fff"/><g stroke="#222" stroke-width="14" fill="none"><rect x="100" y="100" width="1400" height="1000"/><path d="M800 100 V1100 M100 600 H800"/></g><text x="300" y="380" font-size="60">KITCHEN</text><text x="1050" y="600" font-size="60">BED 1</text></svg>`);
const rooms = await Promise.all(
  ['#b5865f', '#7d9a58', '#5d6b73', '#c2592a', '#8f6aa0', '#d9c59c'].map((c, i) =>
    photo(`room${i + 1}.jpg`, 1600, 1200, (w, h) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="${c}"/><circle cx="${400 + i * 100}" cy="500" r="220" fill="#fff" opacity="0.4"/></svg>`),
  ),
);

const browser = await puppeteer.launch({ executablePath: EDGE, headless: true, args: ['--use-gl=angle', '--use-angle=d3d11', '--ignore-gpu-blocklist'] });
let buildingId = null;
let roomSpotId = null;

async function open(width) {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  page.problems = [];
  page.on('console', (m) => {
    if (m.type() !== 'error' && m.type() !== 'warn') return;
    const t = m.text();
    if (/Failed to load resource|net::ERR_INTERNET_DISCONNECTED|ERR_NETWORK|Failed to fetch/i.test(t)) return; // offline on purpose
    page.problems.push(`${m.type()}: ${t}`);
  });
  page.on('pageerror', (e) => page.problems.push(`pageerror: ${e.message}`));
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: SCHEME }]);
  if (width < 600) await page.setViewport({ width, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  else await page.setViewport({ width, height: 900, deviceScaleFactor: 1 });
  await page.evaluateOnNewDocument((token) => {
    localStorage.setItem('mr:token', token);
    localStorage.setItem('mr:who', 'james');
    // the free atlas map on EVERY page (a room capture opened from the place page has no ?map=atlas,
    // and the Mapbox pick map is a billed load)
    localStorage.setItem('mr:map', 'atlas');
  }, TOKEN);
  await page.bringToFront();
  return page;
}
const shot = (page, name, width = 390) => page.screenshot({ path: path.join(OUT, `${name}-${width}-${SCHEME}.png`) });
const tap = async (page, s) => {
  const el = typeof s === 'string' ? await page.waitForSelector(s, { visible: true, timeout: 10000 }) : s;
  await el.tap();
};
const type = async (page, s, text) => {
  const el = await page.waitForSelector(s, { visible: true, timeout: 10000 });
  await el.click({ clickCount: 3 });
  await el.type(text);
};

try {
  const page = await open(390);
  // ── A. capture the place ────────────────────────────────────────────────
  await page.goto(`${BASE}/memories/new?map=atlas`, { waitUntil: 'networkidle0' });
  await tap(page, sel('kind-place'));
  await type(page, sel('title-input'), 'Check house');
  await tap(page, sel('next'));
  await page.waitForSelector(sel('place-capture'), { timeout: 10000 });
  const title = await page.$eval(sel('place-title'), (e) => e.value);
  record('A: "A whole place" opens its own capture with the name carried over', title === 'Check house', title);
  await tap(page, sel('next'));
  await type(page, sel('loc-place-input'), 'Brooklyn');
  const sug = await page.waitForSelector(sel('place-suggestion'), { timeout: 8000 }).catch(() => null);
  if (sug) await sug.tap();
  await sleep(300);
  await shot(page, 'a-location');
  await tap(page, sel('next'));
  const planInput = await page.waitForSelector(sel('plan-input'), { timeout: 8000 });
  await planInput.uploadFile(planPhoto);
  await page.waitForFunction(() => document.querySelectorAll('.mr-place-capture__thumbs li').length === 1, { timeout: 20000 });
  await shot(page, 'a-plan');
  await tap(page, sel('next'));
  const outInput = await page.waitForSelector(sel('outside-input'), { timeout: 8000 });
  await outInput.uploadFile(rooms[0], rooms[1]);
  await page.waitForFunction(() => document.querySelectorAll('.mr-place-capture__thumbs li').length === 2, { timeout: 20000 });
  await shot(page, 'a-outside');
  await page.setOfflineMode(true);
  await tap(page, sel('save'));
  await page.waitForFunction(() => /^\/memories\/b\/[0-9a-f-]{36}$/.test(location.pathname), { timeout: 15000 });
  buildingId = page.url().split('/b/')[1];
  await page.waitForSelector(sel('place'), { timeout: 10000 });
  const head = await page.$eval('.mr-place__title', (e) => e.textContent);
  record('A: offline, Save opens the place page from this phone alone', head === 'Check house', `${buildingId} "${head}"`);
  const pending = await page.evaluate(() => document.querySelector('[data-mr="outbox"]')?.textContent || '');
  record('A: the outbox holds it until there is signal', /waiting|signal|upload/i.test(pending), pending.replace(/\s+/g, ' ').slice(0, 90));
  await shot(page, 'a-place-offline');

  // ── B. offline: rooms, the sketch ───────────────────────────────────────
  for (const name of ['Kitchen', 'Bed 1']) {
    await type(page, sel('add-room-input'), name);
    await tap(page, sel('add-room'));
    await page.waitForFunction((n) => [...document.querySelectorAll('[data-mr="checklist-room"]')].some((r) => r.textContent.includes(n)), { timeout: 8000 }, name);
  }
  const checklist = await page.$$eval(sel('checklist-room'), (els) => els.map((e) => `${e.dataset.id}:${e.dataset.state}`));
  record('B: offline, rooms join the checklist (to capture)', checklist.join() === 'kitchen:todo,bed-1:todo', checklist.join());
  await tap(page, sel('sketch-link'));
  await page.waitForSelector(sel('sketch-grid'), { timeout: 10000 });
  // place Kitchen, drag it, size it
  await page.$$eval('.mr-sketch__undrawn .mr-linkbtn', (els) => els.find((e) => e.textContent === 'Kitchen')?.click());
  await sleep(200);
  await page.$$eval('.mr-sketch__room .mr-btn', (els) => els[0]?.click()); // "Place it on the grid"
  await page.waitForSelector(`${sel('sketch-rect')}[data-id="kitchen"]`, { timeout: 5000 });
  const rectOf = (id) => page.$eval(`${sel('sketch-rect')}[data-id="${id}"] rect`, (r) => [r.getAttribute('x'), r.getAttribute('y'), r.getAttribute('width'), r.getAttribute('height')].map(Number));
  const r0 = await rectOf('kitchen');
  const box = await (await page.$(`${sel('sketch-rect')}[data-id="kitchen"] rect`)).boundingBox();
  const px = box.width / r0[2]; // screen px per metre
  await page.touchscreen.touchStart(box.x + box.width / 2, box.y + box.height / 2);
  for (let k = 1; k <= 8; k++) await page.touchscreen.touchMove(box.x + box.width / 2 + (k * px * 2) / 8, box.y + box.height / 2 + (k * px) / 8);
  await page.touchscreen.touchEnd();
  await sleep(200);
  const r1 = await rectOf('kitchen');
  record('B: dragging a room moves it, snapped to the half-metre grid', r1[0] === r0[0] + 2 && r1[1] === r0[1] + 1, `${r0} -> ${r1}`);
  const h = await (await page.$(sel('sketch-handle'))).boundingBox();
  await page.touchscreen.touchStart(h.x + h.width / 2, h.y + h.height / 2);
  for (let k = 1; k <= 8; k++) await page.touchscreen.touchMove(h.x + h.width / 2 + (k * px) / 8, h.y + h.height / 2 + (k * px * 0.5) / 8);
  await page.touchscreen.touchEnd();
  await sleep(200);
  const r2 = await rectOf('kitchen');
  record('B: the corner handle sizes it', r2[2] === r1[2] + 1 && r2[3] === r1[3] + 0.5, `${r1} -> ${r2}`);
  // a second room overlapping: flagged, kept local
  await page.$$eval('.mr-sketch__undrawn .mr-linkbtn', (els) => els.find((e) => e.textContent === 'Bed 1')?.click());
  await sleep(150);
  await page.$$eval('.mr-sketch__room .mr-btn', (els) => els[0]?.click());
  await page.waitForSelector(`${sel('sketch-rect')}[data-id="bed-1"]`, { timeout: 5000 });
  const k2 = await rectOf('kitchen');
  // drag Bed 1 onto the kitchen
  const b1 = await (await page.$(`${sel('sketch-rect')}[data-id="bed-1"] rect`)).boundingBox();
  const kb = await (await page.$(`${sel('sketch-rect')}[data-id="kitchen"] rect`)).boundingBox();
  await page.touchscreen.touchStart(b1.x + 10, b1.y + 10);
  for (let k = 1; k <= 8; k++) await page.touchscreen.touchMove(b1.x + 10 + ((kb.x + 20 - b1.x) * k) / 8, b1.y + 10 + ((kb.y + 20 - b1.y) * k) / 8);
  await page.touchscreen.touchEnd();
  await sleep(900);
  const flagged = await page.$(sel('sketch-errors'));
  const savedLine = await page.$eval(sel('sketch-saved'), (e) => e.textContent);
  record('B: overlapping rooms are flagged and kept on this phone', Boolean(flagged) && /kept on this phone/i.test(savedLine), savedLine);
  await shot(page, 'b-sketch-overlap');
  // move Bed 1 clear (east of the kitchen) with the number fields
  const b1r = await rectOf('bed-1');
  const want = k2[0] + k2[2];
  // drag it east of the kitchen, by whole metres
  const nb = await (await page.$(`${sel('sketch-rect')}[data-id="bed-1"] rect`)).boundingBox();
  const dxm = want - b1r[0] + 0.5;
  const dzm = k2[1] - b1r[1];
  await page.touchscreen.touchStart(nb.x + nb.width / 2, nb.y + nb.height / 2);
  for (let k = 1; k <= 10; k++) await page.touchscreen.touchMove(nb.x + nb.width / 2 + (k * px * dxm) / 10, nb.y + nb.height / 2 + (k * px * dzm) / 10);
  await page.touchscreen.touchEnd();
  await sleep(900);
  const okNow = !(await page.$(sel('sketch-errors')));
  record('B: moved apart, the sketch is valid again and goes to the outbox', okNow, await page.$eval(sel('sketch-saved'), (e) => e.textContent));
  await shot(page, 'b-sketch');
  // mark Kitchen on the floor-plan photo
  const mark = await page.$(sel('mode-mark'));
  if (mark) {
    await mark.tap();
    await page.waitForSelector(sel('mark-photo'), { timeout: 5000 });
    await page.$$eval(sel('mark-room'), (els) => els.find((e) => e.textContent.startsWith('Kitchen'))?.click());
    const fb = await (await page.$('.mr-markphoto__frame')).boundingBox();
    await page.touchscreen.tap(fb.x + fb.width * 0.25, fb.y + fb.height * 0.3);
    await sleep(800);
    const marked = await page.$$eval('.mr-markphoto__frame .mr-planphoto__mark', (els) => els.length);
    record('B: a room marked on the floor-plan photo', marked === 1, `${marked} marks`);
    await shot(page, 'b-mark');
  }
  // the place page offline: the plan view
  await page.goto(`${BASE}/memories/b/${buildingId}`, { waitUntil: 'domcontentloaded' }).catch(() => {});
  const offlinePlan = await page.waitForSelector(sel('plan-view'), { timeout: 10000 }).then(() => true).catch(() => false);
  record('B: offline, the place page draws the sketch (after a reload with no signal)', offlinePlan);

  // ── C. back online: everything goes up ─────────────────────────────────
  await page.setOfflineMode(false);
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  let server = null;
  for (let i = 0; i < 40; i++) {
    const r = await api(`/buildings/${buildingId}`);
    if (r.status === 200 && r.body.data.media?.length >= 5 && r.body.data.sketch?.rooms?.some((x) => x.rect && x.id === 'kitchen' && x.mark)) {
      server = r.body.data;
      break;
    }
    await sleep(1000);
  }
  record('C: online, the place, its photos and its sketch reach the server', Boolean(server), server ? `${server.media.length} files, ${server.sketch.rooms.length} rooms` : 'not there after 40 s');
  if (server) {
    const kitchen = server.sketch.rooms.find((r) => r.id === 'kitchen');
    record('C: the sketch kept the drag and the size', kitchen.rect.join() === k2.join(), kitchen.rect.join());
    record('C: one floor-plan photo, two outside shots (+ thumbs)', server.media.filter((m) => m.type === 'plan').length === 1 && server.media.filter((m) => m.type === 'photo').length === 2 && server.media.filter((m) => m.type === 'thumb').length === 2);
  }

  // ── D. capture a room from the checklist ───────────────────────────────
  await page.goto(`${BASE}/memories/b/${buildingId}`, { waitUntil: 'networkidle0' });
  await page.waitForSelector(`${sel('checklist-room')}[data-id="kitchen"]`, { timeout: 10000 });
  await page.$eval(`${sel('checklist-room')}[data-id="kitchen"] button`, (b) => b.click());
  await page.waitForFunction(() => location.pathname === '/memories/new' && /building=/.test(location.search), { timeout: 8000 });
  await page.waitForSelector(sel('room-of'), { timeout: 8000 });
  const pre = await page.$eval(sel('title-input'), (e) => e.value);
  const interior = await page.$eval(sel('kind-interior'), (e) => e.getAttribute('aria-pressed'));
  record('D: "Capture" opens the usual capture with the room filled in', pre === 'Kitchen' && interior === 'true', `"${pre}", interior ${interior}`);
  await tap(page, sel('next'));
  const lib = await page.waitForSelector(sel('library-input'), { timeout: 8000 });
  await lib.uploadFile(...rooms.slice(0, 4));
  await page.waitForFunction(() => !document.querySelector('[data-mr="next"]')?.disabled, { timeout: 30000 });
  await tap(page, sel('next'));
  await type(page, sel('note-input'), 'Where the check made toast.');
  await tap(page, sel('next'));
  await type(page, sel('loc-place-input'), 'Brooklyn');
  const sug2 = await page.waitForSelector(sel('place-suggestion'), { timeout: 8000 }).catch(() => null);
  if (sug2) await sug2.tap();
  await sleep(200);
  await tap(page, sel('save'));
  await page.waitForSelector(sel('saved'), { timeout: 15000 });
  roomSpotId = await page.$eval(sel('saved'), (e) => e.dataset.id);
  const back = await page.$(sel('saved-place'));
  record('D: the saved screen leads back to the place', Boolean(back));
  await shot(page, 'd-saved');
  let spot = null;
  for (let i = 0; i < 40; i++) {
    const r = await api(`/spots/${roomSpotId}`);
    if (r.status === 200 && r.body.data.media?.length >= 8) {
      spot = r.body.data;
      break;
    }
    await sleep(1000);
  }
  record('D: the room is a spot of the place (buildingId + roomId)', spot?.buildingId === buildingId && spot?.roomId === 'kitchen', spot ? `${spot.buildingId} / ${spot.roomId}` : 'no spot');
  // "Capture another" from here is a plain capture: the URL still names the room, it must not prefill again
  await tap(page, sel('capture-another'));
  await page.waitForSelector(sel('title-input'), { timeout: 8000 });
  await sleep(600);
  const another = await page.evaluate(() => ({ title: document.querySelector('[data-mr="title-input"]')?.value, roomOf: Boolean(document.querySelector('[data-mr="room-of"]')) }));
  record('D: "Capture another" after a room is a plain capture', another.title === '' && !another.roomOf, JSON.stringify(another));
  await page.goto(`${BASE}/memories/b/${buildingId}`, { waitUntil: 'networkidle0' });
  await page.waitForSelector(`${sel('checklist-room')}[data-id="kitchen"]`, { timeout: 10000 });
  await page.waitForFunction(() => document.querySelector('[data-mr="checklist-room"][data-id="kitchen"]')?.dataset.state === 'captured', { timeout: 20000 }).catch(() => {});
  const state = await page.$eval(`${sel('checklist-room')}[data-id="kitchen"]`, (e) => e.dataset.state);
  record('D: the checklist fills in', state === 'captured', state);
  const filled = await page.$eval(`${sel('plan-room')}[data-id="kitchen"]`, (e) => e.dataset.state).catch(() => null);
  record('D: and so does the plan', filled === 'captured', filled);
  await shot(page, 'd-place');

  // ── F. offline again: a room already uploaded stays captured on the checklist ─────────
  await page.setOfflineMode(true);
  await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.waitForSelector(`${sel('checklist-room')}[data-id="kitchen"]`, { timeout: 15000 });
  await sleep(800);
  const offState = await page.$eval(`${sel('checklist-room')}[data-id="kitchen"]`, (e) => e.dataset.state);
  record('F: offline, an uploaded room is still captured (not "to capture" again)', offState === 'captured', offState);

  // ── G. two phones: this one adds a room offline while the other adds one online; both survive ─
  await type(page, sel('add-room-input'), 'Hall');
  await tap(page, sel('add-room'));
  await page.waitForSelector(`${sel('checklist-room')}[data-id="hall"]`, { timeout: 8000 });
  const srv = (await api(`/buildings/${buildingId}`)).body.data;
  const other = { ...srv.sketch, rooms: [...srv.sketch.rooms, { id: 'study', name: 'Study', level: srv.sketch.levels[0].id }] };
  const pr = await api(`/buildings/${buildingId}`, { method: 'PATCH', body: JSON.stringify({ sketch: other }) });
  await page.setOfflineMode(false);
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  let merged = null;
  for (let i = 0; i < 40; i++) {
    const r = await api(`/buildings/${buildingId}`);
    const ids = (r.body.data?.sketch?.rooms || []).map((x) => x.id);
    if (ids.includes('hall')) {
      merged = ids;
      break;
    }
    await sleep(750);
  }
  record("G: two phones' rooms merge (the other phone's Study + this phone's Hall)", pr.status === 200 && merged && merged.includes('study') && merged.includes('kitchen') && merged.includes('bed-1'), merged ? merged.join(',') : `patch ${pr.status}, hall never arrived`);

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  record('390: no sideways scroll on the place page', overflow <= 0, `${overflow}px`);
  record('390: no console/page errors', page.problems.length === 0, page.problems.slice(0, 3).join(' | '));
  await page.browserContext().close();

  // ── E. desktop ─────────────────────────────────────────────────────────
  const desk = await open(1440);
  await desk.goto(`${BASE}/memories/b/${buildingId}`, { waitUntil: 'networkidle0' });
  await desk.waitForSelector(sel('plan-view'), { timeout: 10000 });
  await shot(desk, 'e-place', 1440);
  await desk.click(`${sel('plan-room')}[data-id="bed-1"]`);
  const pick = await desk.waitForSelector(sel('room-pick'), { timeout: 5000 }).then(() => true).catch(() => false);
  record('E 1440: tapping a room on the plan picks it (capture or open)', pick);
  await desk.goto(`${BASE}/memories/b/${buildingId}/plan`, { waitUntil: 'networkidle0' });
  await desk.waitForSelector(sel('sketch-grid'), { timeout: 10000 });
  await shot(desk, 'e-sketch', 1440);
  record('1440: no console/page errors', desk.problems.length === 0, desk.problems.slice(0, 3).join(' | '));
  await desk.browserContext().close();
} catch (err) {
  record('ran to the end', false, err.message);
  // what the page showed when it stopped
  for (const pg of (await browser.pages().catch(() => [])).slice(-1)) {
    await pg.screenshot({ path: path.join(OUT, `failure-${SCHEME}.png`) }).catch(() => {});
    console.log(`  at ${pg.url()}; problems: ${(pg.problems || []).slice(0, 3).join(' | ')}`);
  }
} finally {
  await browser.close();
  // clean up what it made
  if (roomSpotId) await api(`/spots/${roomSpotId}`, { method: 'DELETE' });
  if (buildingId) await api(`/buildings/${buildingId}`, { method: 'DELETE' });
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed (${SCHEME}). Screens: ${OUT}`);
process.exit(failed.length ? 1 : 0);
