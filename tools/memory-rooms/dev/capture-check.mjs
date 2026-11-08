#!/usr/bin/env node
/* Drives /memories/new at 390×844 end to end against a dev Vite (MR_APP) proxying a
   local Worker (MR_API):
     A. gate → who → interior → title → 6 photos (incl. EXIF-rotated + a small one) →
        note + preset → GPS → save → upload finishes → API has 6 photos + 6 thumbs at
        the right sizes.
     B. offline: setOfflineMode before save → outbox pending → reload with the API
        unreachable (entry survives) → back online → it uploads.
     C. a stale password (401) sends the app back to the gate.
   The spots it creates are soft-deleted at the end.

     node tools/memory-rooms/dev/capture-check.mjs */

import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { APP, PASSWORD, PHONE, REPO, api, check, launch, newPage, shot, sleep, watchConsole } from './lib.mjs';

const FIXTURES = path.join(REPO, 'memory-rooms-work', '_dev', 'test-photos');
fs.mkdirSync(FIXTURES, { recursive: true });

/* Six test photos: three 4032×3024, one 1200×900 (must not upscale), one portrait,
   one landscape stored with EXIF orientation 6 (must come out portrait). */
const SPECS = [
  { name: 'p1.jpg', w: 4032, h: 3024, hue: 20, expect: [2048, 1536] },
  { name: 'p2.jpg', w: 4032, h: 3024, hue: 60, expect: [2048, 1536] },
  { name: 'p3.jpg', w: 4032, h: 3024, hue: 120, expect: [2048, 1536] },
  { name: 'p4-small.jpg', w: 1200, h: 900, hue: 180, expect: [1200, 900] },
  { name: 'p5-portrait.jpg', w: 3024, h: 4032, hue: 240, expect: [1536, 2048] },
  { name: 'p6-exif6.jpg', w: 4032, h: 3024, hue: 300, orientation: 6, expect: [1536, 2048] },
];

async function fixtures() {
  for (const [i, s] of SPECS.entries()) {
    const file = path.join(FIXTURES, s.name);
    if (fs.existsSync(file)) continue;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${s.w}" height="${s.h}">
      <rect width="100%" height="100%" fill="hsl(${s.hue},22%,62%)"/>
      <rect x="${s.w * 0.1}" y="${s.h * 0.55}" width="${s.w * 0.5}" height="${s.h * 0.3}" fill="hsl(${s.hue},25%,40%)"/>
      <circle cx="${s.w * 0.75}" cy="${s.h * 0.3}" r="${Math.min(s.w, s.h) * 0.12}" fill="hsl(${s.hue + 30},40%,80%)"/>
      <text x="${s.w * 0.08}" y="${s.h * 0.2}" font-family="Segoe UI, Arial" font-size="${Math.round(s.h / 9)}" fill="#fff">PHOTO ${i + 1}  ↑ top</text></svg>`;
    let img = sharp(Buffer.from(svg)).jpeg({ quality: 88 });
    if (s.orientation) img = img.withMetadata({ orientation: s.orientation });
    fs.writeFileSync(file, await img.toBuffer());
  }
  return SPECS.map((s) => path.join(FIXTURES, s.name));
}

const results = [];
const logs = [];
const created = [];
let browser = null;
const smallTargets = new Set();

/** Every visible tap target on screen must be at least 44 × 44 px. */
async function auditTargets(page, step) {
  const bad = await page.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll('.mr button, .mr a[href], .mr label.mr-btn, .mr input:not([type="file"]), .mr textarea')) {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height || r.bottom < 0 || r.top > innerHeight) continue;
      if (getComputedStyle(el).visibility === 'hidden') continue;
      if (r.height < 43.5 || r.width < 43.5) out.push(`${el.dataset.mr || el.className || el.tagName} ${Math.round(r.width)}×${Math.round(r.height)}`);
    }
    return out;
  });
  bad.forEach((b) => smallTargets.add(`${step}: ${b}`));
}

async function mr(page, name, opts) {
  return page.waitForSelector(`[data-mr="${name}"]`, { timeout: 15000, ...opts });
}
async function tap(page, name) {
  const el = await mr(page, name, { visible: true });
  await el.click();
}

async function main() {
  const photos = await fixtures();
  browser = await launch();
  const page = await newPage(browser, { permissions: ['geolocation'] });
  // On purpose below: a wrong password (401), an offline save, a blocked API, a stale token (401).
  watchConsole(page, logs, 'capture', {
    allow: [/status of 401 .*<\/api\/memories\//, /ERR_INTERNET_DISCONNECTED/, /ERR_FAILED .*<\/api\/memories\//],
  });
  await page.setViewport(PHONE);
  await page.setGeolocation({ latitude: 51.1784, longitude: -115.5708, accuracy: 18 });

  /* ── A. full capture ─────────────────────────────────────────────────── */
  await page.goto(`${APP}/memories/new`, { waitUntil: 'networkidle0' });
  await mr(page, 'gate-password');
  await shot(page, 'cap-390-00-gate');
  await page.type('[data-mr="gate-password"]', 'wrong-password');
  await tap(page, 'gate-submit');
  await page.waitForSelector('#mr-gate-error', { timeout: 10000 });
  check(results, true, 'wrong password shows an inline message');
  await shot(page, 'cap-390-00-gate-wrong');
  await page.$eval('[data-mr="gate-password"]', (el) => el.select());
  await page.keyboard.press('Backspace');
  await page.type('[data-mr="gate-password"]', PASSWORD);
  await tap(page, 'gate-submit');
  await mr(page, 'who-james');
  await shot(page, 'cap-390-00-who');
  await auditTargets(page, 'who');
  await tap(page, 'who-james');

  await mr(page, 'kind-interior');
  await shot(page, 'cap-390-01-kind-empty');
  await tap(page, 'kind-interior');
  const title = `Test bunk room ${Date.now().toString(36)}`;
  await page.type('[data-mr="title-input"]', title);
  await shot(page, 'cap-390-01-kind');
  await auditTargets(page, '01');
  await tap(page, 'next');

  const input = await mr(page, 'photo-input');
  const firstShot = await page.$eval('.mr-shot-text .mr-label', (el) => el.textContent);
  check(results, /shot 1 of 4/i.test(firstShot), 'the guide counts the 4 needed shots', firstShot);
  await shot(page, 'cap-390-02-photos-empty');
  await input.uploadFile(...photos);
  await page.waitForFunction(() => document.querySelectorAll('[data-mr="photo-thumb"]').length === 6, { timeout: 60000 });
  await page.waitForFunction(() => !document.querySelector('.mr-processing'), { timeout: 30000 });
  check(results, true, '6 photos processed into thumbnails');
  await shot(page, 'cap-390-02-photos');
  await auditTargets(page, '02');

  // back and forward keeps everything
  await tap(page, 'back');
  await mr(page, 'title-input');
  const keptTitle = await page.$eval('[data-mr="title-input"]', (el) => el.value);
  await tap(page, 'next');
  await page.waitForFunction(() => document.querySelectorAll('[data-mr="photo-thumb"]').length === 6);
  check(results, keptTitle === title, 'Back keeps the title and photos');

  await tap(page, 'next');
  await mr(page, 'note-input');
  await page.type('[data-mr="note-input"]', 'Where we planned the whole Canada leg over instant noodles.');
  await page.click('[data-mr="scale-preset"][data-value="small room"]');
  await shot(page, 'cap-390-03-memory');
  await auditTargets(page, '03');
  await tap(page, 'next');

  await mr(page, 'loc-gps');
  await page.waitForSelector('[data-mr="loc-pick-map"]', { timeout: 10000 });
  await shot(page, 'cap-390-04-location-empty');
  await tap(page, 'loc-gps');
  await page.waitForSelector('[data-mr="loc-status"][data-source="gps"]', { timeout: 25000 });
  const placeVal = await page.$eval('[data-mr="loc-place-input"]', (el) => el.value);
  check(results, placeVal === 'Banff, AB', 'GPS fix is labelled from the gazetteer', placeVal);
  await sleep(1400); // pick map flies to the fix
  const pickZoom = await page.$eval('[data-mr="loc-pick-map"]', (el) => Number(el.dataset.zoom));
  check(results, pickZoom > 10, 'the pick map flies to the GPS fix', `zoom ${pickZoom}`);
  await shot(page, 'cap-390-04-location');
  await auditTargets(page, '04');

  // the pin stays draggable after GPS
  const pin = await page.$('[data-mr="loc-pin"]');
  const box = pin && (await pin.boundingBox());
  if (box) {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 30, box.y + box.height / 2 + 12, { steps: 6 });
    await page.mouse.up();
    await page.waitForSelector('[data-mr="loc-status"][data-source="pin"]', { timeout: 5000 }).catch(() => null);
  }
  const srcAfterDrag = await page.$eval('[data-mr="loc-status"]', (el) => el.dataset.source);
  check(results, srcAfterDrag === 'pin', 'dragging the pin after GPS switches the source to pin', srcAfterDrag);

  await tap(page, 'save');
  const saved = await mr(page, 'saved', { timeout: 20000 });
  const id = await saved.evaluate((el) => el.dataset.id);
  created.push(id);
  await shot(page, 'cap-390-05-saved-uploading');
  await page.waitForSelector('[data-mr="saved"][data-upload="done"]', { timeout: 90000 });
  await sleep(400);
  await shot(page, 'cap-390-05-saved');
  await auditTargets(page, 'saved');
  const savedView = await page.evaluate(() => ({
    status: document.querySelector('[data-mr="saved-status"]').textContent,
    thumbs: document.querySelectorAll('.mr-saved-thumbs img').length,
    full: Boolean(document.querySelector('.mr-progress[data-done]')),
    strip: document.querySelector('[data-mr="outbox"]')?.hidden !== false,
  }));
  check(
    results,
    /uploaded/i.test(savedView.status) && savedView.thumbs === 6 && savedView.full && savedView.strip,
    'saved screen: one status (done), full bar, 6 thumbnails, no strip',
    `${savedView.status} · ${savedView.thumbs} thumbs`,
  );

  const got = await api(`/spots/${id}`);
  const media = got.data?.media || [];
  const ph = media.filter((m) => m.type === 'photo').sort((a, b) => a.sort - b.sort);
  const th = media.filter((m) => m.type === 'thumb').sort((a, b) => a.sort - b.sort);
  check(results, got.status === 200 && ph.length === 6 && th.length === 6, 'API has 6 photos + 6 thumbs', `${ph.length}/${th.length}`);
  const dims = ph.map((m) => `${m.width}x${m.height}`);
  const want = SPECS.map((s) => `${s.expect[0]}x${s.expect[1]}`);
  check(results, dims.join() === want.join(), 'photo sizes: 2048 long edge, no upscale, EXIF applied', dims.join(' '));
  check(results, th.every((m) => Math.max(m.width, m.height) === 480 || Math.max(m.width, m.height) <= 480), 'thumbs ≤ 480 long edge', th.map((m) => `${m.width}x${m.height}`).join(' '));
  const s = got.data || {};
  check(
    results,
    s.createdBy === 'james' && s.kind === 'interior' && s.scaleHint === 'small room' && s.locSource === 'pin' && s.placeLabel === 'Banff, AB' && Math.abs(s.lat - 51.18) < 0.2,
    'spot fields saved',
    `${s.createdBy} ${s.kind} ${s.scaleHint} ${s.locSource} ${s.placeLabel} ${s.lat?.toFixed(4)},${s.lng?.toFixed(4)} ±${s.locAccuracyM}`,
  );
  // the photo really is a decodable JPEG at the right size
  const first = ph[0] ? await fetch(`${APP}${ph[0].url}`) : null;
  if (first?.ok) {
    const meta = await sharp(Buffer.from(await first.arrayBuffer())).metadata();
    check(results, meta.format === 'jpeg' && meta.width === 2048, 'uploaded photo decodes as a 2048 px JPEG', `${meta.format} ${meta.width}x${meta.height}`);
  }

  /* ── B. offline save, reload, then upload ────────────────────────────── */
  await tap(page, 'capture-another');
  await tap(page, 'kind-exterior');
  const title2 = `Offline test ${Date.now().toString(36)}`;
  await page.type('[data-mr="title-input"]', title2);
  await tap(page, 'next');
  const input2 = await mr(page, 'library-input');
  await input2.uploadFile(...photos.slice(0, 4));
  await page.waitForFunction(() => document.querySelectorAll('[data-mr="photo-thumb"]').length === 4, { timeout: 60000 });
  await page.waitForFunction(() => !document.querySelector('.mr-processing'));
  await tap(page, 'next');
  await page.type('[data-mr="note-input"]', 'Saved with no signal.');
  await page.type('[data-mr="scale-input"]', 'a lookout over the lake');
  const scanFile = path.join(FIXTURES, 'test-scan.spz');
  if (!fs.existsSync(scanFile)) fs.writeFileSync(scanFile, Buffer.alloc(300 * 1024, 7));
  await (await mr(page, 'scan-input')).uploadFile(scanFile);
  const scanText = await (await mr(page, 'scan-file')).evaluate((el) => el.textContent);
  check(results, /test-scan\.spz/.test(scanText) && /300 KB/.test(scanText), 'a .spz scan shows its name and size', scanText);
  await shot(page, 'cap-390-03-memory-scan');
  await tap(page, 'next');
  await page.type('[data-mr="loc-place-input"]', 'lake lou');
  await page.waitForSelector('[data-mr="place-suggestion"]', { timeout: 5000 });
  const opensNear = await page.$eval('[data-mr="loc-pick-map"]', (el) => Number(el.dataset.zoom));
  check(results, opensNear > 4, 'the location map opens near the last saved spot', `zoom ${opensNear}`);
  await shot(page, 'cap-390-04-location-typed');
  await page.click('[data-mr="place-suggestion"]');
  await page.waitForSelector('[data-mr="loc-status"][data-source="typed"]', { timeout: 5000 });
  await sleep(1400);
  const chosen = await page.evaluate(() => ({
    zoom: Number(document.querySelector('[data-mr="loc-pick-map"]').dataset.zoom),
    pin: Boolean(document.querySelector('[data-mr="loc-pin"]')),
  }));
  check(results, chosen.pin && chosen.zoom >= 20, 'choosing a place drops the pin there and centres the map', `zoom ${chosen.zoom}`);
  await shot(page, 'cap-390-04-location-chosen');

  await page.setOfflineMode(true);
  await tap(page, 'save');
  const saved2 = await mr(page, 'saved', { timeout: 20000 });
  const id2 = await saved2.evaluate((el) => el.dataset.id);
  created.push(id2);
  await page.waitForSelector('[data-mr="outbox"][data-pending="1"]', { timeout: 10000 });
  await page.waitForSelector('[data-mr="saved"][data-state="waiting"]', { timeout: 10000 });
  const offText = await page.$eval('[data-mr="saved-status"]', (el) => el.textContent);
  check(results, /waiting for signal/i.test(offText), 'offline save → kept in the outbox, saved screen says "Waiting for signal"', offText);
  await shot(page, 'cap-390-06-offline-saved');

  // "No signal" for the API while the app itself can still load (no service worker in dev).
  await page.setRequestInterception(true);
  const blockApi = (req) => (req.url().includes('/api/memories') ? req.abort('internetdisconnected') : req.continue());
  page.on('request', blockApi);
  await page.setOfflineMode(false);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-mr="outbox"][data-pending="1"]', { timeout: 15000 });
  await page.waitForSelector('[data-mr="outbox"][data-state="waiting"]', { timeout: 20000 }).catch(() => null);
  const stripText = await page.$eval('[data-mr="outbox"]', (el) => el.textContent);
  check(results, /waiting for signal/i.test(stripText), 'after a reload with no API the entry is still in the outbox, same wording', stripText.replace(/\s+/g, ' ').trim());
  await sleep(500);
  await shot(page, 'cap-390-07-offline-reloaded');
  const before = await api(`/spots/${id2}`);
  check(results, before.status === 404, 'nothing reached the server while offline', `status ${before.status}`);

  page.off('request', blockApi);
  await page.setRequestInterception(false);
  // Fire `online` the way a phone would when signal comes back.
  await page.setOfflineMode(true);
  await sleep(200);
  await page.setOfflineMode(false);
  await page.waitForSelector('[data-mr="outbox"][data-pending="0"]', { timeout: 90000 });
  const after = await api(`/spots/${id2}`);
  const m2 = after.data?.media || [];
  check(
    results,
    after.status === 200 &&
      m2.filter((m) => m.type === 'photo').length === 4 &&
      m2.filter((m) => m.type === 'thumb').length === 4 &&
      m2.some((m) => m.type === 'scan' && m.bytes === 300 * 1024),
    'back online → the offline capture uploaded (4 photos + 4 thumbs + the scan)',
    `${after.data?.title} · ${after.data?.placeLabel} · ${after.data?.scaleHint} · ${after.data?.locSource}`,
  );

  /* ── C. password changed → gate ──────────────────────────────────────── */
  await page.evaluate(() => localStorage.setItem('mr:token', 'stale-password'));
  await page.goto(`${APP}/memories`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-mr="gate-password"]', { timeout: 15000 });
  check(results, true, 'a 401 sends the app back to the gate');
  await shot(page, 'cap-390-08-gate-expired');

  await browser.close();
}

try {
  await main();
} catch (err) {
  console.error(err);
  check(results, false, 'script ran to the end', err.message);
} finally {
  await browser?.close().catch(() => {});
  for (const id of created) await api(`/spots/${id}`, { method: 'DELETE' }).catch(() => {});
  if (created.length) console.log(`soft-deleted ${created.length} test spot(s)`);
  check(results, smallTargets.size === 0, 'tap targets ≥ 44 px on every 390 px step', [...smallTargets].join(' | '));
  const bad = logs;
  console.log(`\nconsole: ${bad.length ? bad.join('\n') : 'clean'} (${logs.expected || 0} expected network errors from the offline/401 steps)`);
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed`);
  process.exitCode = failed || bad.length ? 1 : 0;
}
