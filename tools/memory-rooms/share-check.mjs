#!/usr/bin/env node
/* share-check: private share links (/memories/s/:token), end to end, against a running Worker.

     node tools/memory-rooms/dev/seed-place.mjs <buildingId> --base http://127.0.0.1:8796    (or seed-building.mjs)
     node tools/memory-rooms/seed-dev.mjs --examples-only --base http://127.0.0.1:8796       (a spot to share)
     node tools/memory-rooms/share-check.mjs --building <id> [--base http://127.0.0.1:8796] [--no-page]

   Works against the live site too (MEMORIES_PASSWORD=<live> --base https://jameswigfield.com): every link it
   makes it switches off again at the end.

   API:
   - POST /shares makes a 32-character token for a place and for a room; GET /shares?kind&id lists it;
   - GET /shared/:token with NO password gives that one place / room: the right id, no location (row lat/lng or
     plan.geo), note, sketch, createdBy; only model/render (place) or photo/thumb/model/scan/render (room)
     files, every one signed under that place's / room's own R2 folder, and they open;
   - with no password, or the token as the password: /spots, /buildings, /buildings/:id, /shares, /ping → 401;
   - a signed file url pointed at another file → 403; a made-up or malformed token → 404;
   - DELETE /shares/:token switches it off: /shared/:token → 404.
   Page (headless Edge, a fresh profile with no password, 1440 and 390 touch):
   - the 3D place loads (ready) with no gate, no header, no link anywhere on the page, a noindex robots meta;
   - tapping the house doesn't leave the page; no console errors; no sideways scroll at 390;
   - the owner (with the password) sees the Share privately panel on the place page, listing the link;
   - a switched-off link shows the "does not open anything" page.
   Screens: memory-rooms-work/_share-check/. */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = path.join(REPO, 'memory-rooms-work', '_share-check');
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const args = process.argv.slice(2);
const opt = (name, dflt) => (args.includes(name) ? args[args.indexOf(name) + 1] : dflt);
const BASE = opt('--base', process.env.MEMORIES_API || 'http://127.0.0.1:8796').replace(/\/+$/, '');
const PASSWORD = process.env.MEMORIES_PASSWORD || 'trip-local';
const BID = opt('--building', null);
const PAGE = !args.includes('--no-page');
if (!BID) {
  console.error('usage: node tools/memory-rooms/share-check.mjs --building <id> [--base <url>] [--no-page]');
  process.exit(2);
}
fs.mkdirSync(OUT, { recursive: true });

const results = [];
const record = (label, ok, detail = '') => {
  results.push({ label, ok });
  console.log(`${ok ? '✓' : '✗'} ${label}${detail ? `  ${detail}` : ''}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const API = `${BASE}/api/memories`;
async function call(p, { method = 'GET', body, auth = PASSWORD } = {}) {
  const headers = {};
  if (auth) headers.authorization = `Bearer ${auth}`;
  if (body) headers['content-type'] = 'application/json';
  const res = await fetch(`${API}${p}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  let json = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  return { status: res.status, json, headers: res.headers };
}

const made = [];
try {
  // ── the API ──
  const spots = (await call('/spots')).json?.data || [];
  const spot = spots.find((s) => !s.deletedAt && s.buildingId !== BID && s.lat != null) || spots.find((s) => !s.deletedAt);

  const mk = await call('/shares', { method: 'POST', body: { kind: 'building', id: BID, label: 'share-check' } });
  const token = mk.json?.data?.token;
  if (token) made.push(token);
  record('POST /shares makes a link for the place', mk.status === 201 && /^[A-Za-z0-9_-]{32}$/.test(token || ''), `${mk.status}`);
  const bad = await call('/shares', { method: 'POST', body: { kind: 'building', id: '00000000-0000-4000-8000-0000000dead0' } });
  record('a link for a place that is not there → 404', bad.status === 404, `${bad.status}`);
  const listed = (await call(`/shares?kind=building&id=${BID}`)).json?.data || [];
  record('GET /shares?kind&id lists it', listed.some((s) => s.token === token));

  const sh = await call(`/shared/${token}`, { auth: null });
  const item = sh.json?.data?.item;
  record('GET /shared/:token with no password opens the place', sh.status === 200 && sh.json?.data?.kind === 'building' && item?.id === BID, `${sh.status}`);
  record('…marked noindex + no-store', /noindex/.test(sh.headers.get('x-robots-tag') || '') && /no-store/.test(sh.headers.get('cache-control') || ''));
  const leaked = ['lat', 'lng', 'note', 'sketch', 'createdBy', 'locAccuracyM', 'tripStopId', 'deletedAt', 'collectionId', 'collection'].filter((k) => item && k in item);
  record('…with no location, note, sketch, who or collection', leaked.length === 0 && !item?.plan?.geo && !/collection/i.test(JSON.stringify(sh.json || {})), leaked.join(', '));
  const types = [...new Set((item?.media || []).map((m) => m.type))];
  record('…only its model / render files', types.length > 0 && types.every((t) => ['model', 'render'].includes(t)), types.join(','));
  const own = (item?.media || []).every((m) => m.url.startsWith(`/api/memories/file/buildings/${BID}/`) && /\?t=/.test(m.url) && !('r2Key' in m));
  record('…every file signed under its own folder', own);
  const model = (item?.media || []).find((m) => m.type === 'model');
  const fileRes = model ? await fetch(`${BASE}${model.url}`, { method: 'HEAD' }) : null;
  record('…and a signed file opens with no password', fileRes?.status === 200, `${fileRes?.status}`);

  if (spot && model) {
    const t = model.url.split('?t=')[1];
    const other = await fetch(`${API}/file/spots/${spot.id}/model/room.glb?t=${t}`, { method: 'HEAD' });
    record("a place's signed token can't open another file", other.status === 403, `${other.status}`);
  }

  for (const p of ['/ping', '/spots', '/buildings', `/buildings/${BID}`, '/shares', spot ? `/spots/${spot.id}` : null].filter(Boolean)) {
    const a = await call(p, { auth: null });
    const b = await call(p, { auth: token });
    record(`no password / the token as password: ${p} → 401`, a.status === 401 && b.status === 401, `${a.status}/${b.status}`);
  }
  const delAnon = await call(`/shares/${token}`, { method: 'DELETE', auth: null });
  record('switching a link off needs the password', delAnon.status === 401, `${delAnon.status}`);
  const fake = await call('/shared/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', { auth: null });
  const junk = await call('/shared/..%2Fshares%2Fx', { auth: null });
  record('a made-up or malformed token → 404', fake.status === 404 && junk.status === 404, `${fake.status}/${junk.status}`);

  if (spot) {
    const ms = await call('/shares', { method: 'POST', body: { kind: 'spot', id: spot.id, label: 'share-check' } });
    const st = ms.json?.data?.token;
    if (st) made.push(st);
    const ss = await call(`/shared/${st}`, { auth: null });
    const si = ss.json?.data?.item;
    const sl = ['lat', 'lng', 'note', 'createdBy', 'frameGroup', 'collectionId', 'capture'].filter((k) => si && k in si);
    const stypes = [...new Set((si?.media || []).map((m) => m.type))];
    const exif = (si?.media || []).some((m) => 'exif' in m);
    record('a room link opens that room alone, trimmed (no collection, no old-photo capture or EXIF)', ss.status === 200 && si?.id === spot.id && sl.length === 0 && !exif && !/collection/i.test(JSON.stringify(ss.json || {})) && stypes.every((x) => ['photo', 'thumb', 'model', 'scan', 'render'].includes(x)), `${ss.status} ${sl.join(',')}${exif ? ' exif' : ''} ${stypes.join(',')}`);
  }

  // ── the page ──
  if (PAGE) {
    const { default: puppeteer } = await import('puppeteer-core');
    const browser = await puppeteer.launch({ executablePath: EDGE, headless: true, args: ['--use-gl=angle', '--use-angle=d3d11', '--ignore-gpu-blocklist'] });
    try {
      for (const width of [1440, 390]) {
        const L = `${width}`;
        const ctx = await browser.createBrowserContext();
        const page = await ctx.newPage();
        const problems = [];
        page.on('console', (m) => m.type() === 'error' && problems.push(m.text()));
        page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
        if (width < 600) await page.setViewport({ width, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
        else await page.setViewport({ width, height: 900, deviceScaleFactor: 1 });
        const url = `${BASE}/memories/s/${token}`;
        await page.goto(url, { waitUntil: 'domcontentloaded' });
        const ready = await page.waitForSelector('[data-mr="building"] [data-mr="viewer"][data-state="ready"]', { timeout: 90000 }).then(() => true).catch(() => false);
        record(`${L}: the shared place loads in 3D with no password`, ready);
        await sleep(800);
        const dom = await page.evaluate(() => ({
          gate: Boolean(document.querySelector('[data-mr="gate-password"]')),
          header: Boolean(document.querySelector('.mr-header')),
          links: [...document.querySelectorAll('.mr a[href]')].map((a) => a.getAttribute('href')),
          robots: document.querySelector('meta[name="robots"]')?.content || '',
          token: localStorage.getItem('mr:token'),
          sideways: document.documentElement.scrollWidth - window.innerWidth,
          title: document.title,
        }));
        record(`${L}: no gate, no header, no links anywhere`, !dom.gate && !dom.header && dom.links.length === 0, dom.links.join(' '));
        record(`${L}: robots noindex, nothing stored as a password`, /noindex/.test(dom.robots) && !dom.token);
        if (width < 600) record(`${L}: no sideways scroll`, dom.sideways <= 0, `${dom.sideways}px`);
        await page.screenshot({ path: path.join(OUT, `shared-${L}.png`) });
        // tap the middle of the house: it stays on this page
        const box = await (await page.$('[data-mr="building"] [data-mr="viewer"]')).boundingBox();
        if (width < 600) await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
        else await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
        await sleep(1500);
        record(`${L}: tapping the house stays on the shared page`, page.url() === url, page.url());
        for (const s of ['inside', 'plan']) {
          await page.click(`[data-mr="building-${s}"]`).catch(() => {});
          await sleep(1400);
          await page.screenshot({ path: path.join(OUT, `shared-${L}-${s}.png`) });
        }
        record(`${L}: no console errors`, problems.length === 0, problems.slice(0, 3).join(' | '));
        await ctx.close();
      }

      // the owner's panel
      const ctx = await browser.createBrowserContext();
      const page = await ctx.newPage();
      await page.setViewport({ width: 1440, height: 900 });
      await page.evaluateOnNewDocument((pw) => {
        localStorage.setItem('mr:token', pw);
        localStorage.setItem('mr:who', 'james');
      }, PASSWORD);
      await page.goto(`${BASE}/memories/b/${BID}`, { waitUntil: 'domcontentloaded' });
      const panel = await page.waitForSelector(`[data-mr="share-row"][data-token="${token}"]`, { timeout: 30000 }).then(() => true).catch(() => false);
      record('the owner sees Share privately on the place page, with the link', panel);
      const el = await page.$('[data-mr="share-panel"]');
      if (el) await el.screenshot({ path: path.join(OUT, 'owner-panel.png') });
      await ctx.close();

      // switch it off: the page says so
      await call(`/shares/${token}`, { method: 'DELETE' });
      const ctx2 = await browser.createBrowserContext();
      const p2 = await ctx2.newPage();
      await p2.goto(`${BASE}/memories/s/${token}`, { waitUntil: 'domcontentloaded' });
      const goneShown = await p2.waitForSelector('[data-mr="shared"][data-mr-page="missing"]', { timeout: 20000 }).then(() => true).catch(() => false);
      const goneLinks = await p2.evaluate(() => document.querySelectorAll('.mr a[href]').length);
      record('a switched-off link shows "does not open anything", with no links', goneShown && goneLinks === 0);
      await p2.screenshot({ path: path.join(OUT, 'switched-off.png') });
      await ctx2.close();
    } finally {
      await browser.close();
    }
  }
} finally {
  for (const t of made) await call(`/shares/${t}`, { method: 'DELETE' });
  const after = made.length ? await call(`/shared/${made[0]}`, { auth: null }) : null;
  if (after) record('DELETE /shares/:token switches it off (→ 404)', after.status === 404, `${after.status}`);
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} share checks passed`);
process.exit(failed.length ? 1 : 0);
