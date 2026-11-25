/* ============================================================================
   DREAM ROOMS · page-check: the real pages, driven headlessly (puppeteer-core +
   local Edge), against a running site whose API is seeded with the fictional
   fixtures (tools/dream-rooms/samples/fixtures-nights.json).

     SITE=http://127.0.0.1:8796 node tools/dream-rooms/page-check.mjs
       SITE      default http://127.0.0.1:8796 (wrangler dev serving dist + the API)
       ONLY      comma list of sections: gate,capture,list,dream,walk,corridor
       KEEP=1    keep the two dreams the capture check makes (default: purged)
       WALK_TIMEOUT  ms to wait for an autopilot walk to reach the wake (default 240000)

   Seed first:  DREAMS_API=<SITE> node tools/dream-rooms/seed-local.mjs
   Password: DREAMS_PASSWORD (env), else .dev.vars DREAMS_PASSWORD, then PORTAL_PASSWORD.

   Prints PASS/FAIL/SKIP lines with ids, counts and states only (decision 14: no
   dream words; the two texts it types are its own fictional lines). Exits 1 on any
   FAIL. Screenshots: tools/dream-rooms/out/shots/.
   ========================================================================== */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { COPY } from '../../src/dream-rooms/copy.js';
import { buildCorridorWorld, doorState } from '../../src/dream-rooms/contracts/corridorWorld.js';
import { dreamtOnFor, nightLabel, UUID_RE } from '../../src/dream-rooms/contracts/rows.js';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SITE = (process.env.SITE || 'http://127.0.0.1:8796').replace(/\/$/, '');
const EDGE = process.env.EDGE || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const SHOTS = path.join(REPO, 'tools/dream-rooms/out/shots');
const ONLY = (process.env.ONLY || '').split(',').map((s) => s.trim()).filter(Boolean);
const KEEP = process.env.KEEP === '1';
const WALK_TIMEOUT = Number(process.env.WALK_TIMEOUT || 240000);
const FIXTURES = JSON.parse(fs.readFileSync(path.join(REPO, 'tools/dream-rooms/samples/fixtures-nights.json'), 'utf8')).dreams;
const FIXTURE_IDS = new Set(FIXTURES.map((f) => f.id));

// Its own fictional lines (never James's).
const TEXT_1 = 'page-check: a fictional dream about a lift that only went sideways.';
const TEXT_2 = 'page-check: a second fictional dream, a library with no floor.';
const TEXT_MORE = 'page-check: a fictional detail remembered later.';

/* ── password ─────────────────────────────────────────────────────────── */

function devVars() {
  try {
    const out = {};
    for (const line of fs.readFileSync(path.join(REPO, '.dev.vars'), 'utf8').split(/\r?\n/)) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
      if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
    return out;
  } catch {
    return {};
  }
}
const vars = devVars();
const TOKEN = process.env.DREAMS_PASSWORD || vars.DREAMS_PASSWORD || vars.PORTAL_PASSWORD || '';

/* ── results ──────────────────────────────────────────────────────────── */

const results = [];
const line = (kind, name, detail = '') => {
  results.push({ kind, name, detail });
  console.log(`${kind.padEnd(4)}  ${name}${detail ? `  (${detail})` : ''}`);
};
const pass = (name, detail) => line('PASS', name, detail);
const fail = (name, detail) => line('FAIL', name, detail);
const skip = (name, detail) => line('SKIP', name, detail);
const check = (ok, name, detail) => (ok ? pass(name, detail) : fail(name, detail));
const want = (section) => !ONLY.length || ONLY.includes(section);

/* ── the API, straight (to verify what the pages did) ─────────────────── */

async function api(method, p = '', body, { token = TOKEN } = {}) {
  const headers = {};
  if (token) headers.authorization = `Bearer ${token}`;
  if (body !== undefined) headers['content-type'] = 'application/json';
  const res = await fetch(`${SITE}/api/dreams${p}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { status: res.status, data: json?.data, error: json?.error };
}
const list = async () => (await api('GET')).data || [];
const getRow = async (id) => (await api('GET', `/${id}`)).data || null;

async function poll(fn, timeout = 10000, every = 250) {
  const end = Date.now() + timeout;
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() > end) return null;
    await new Promise((r) => setTimeout(r, every));
  }
}

/* ── the browser ──────────────────────────────────────────────────────── */

const consoleErrors = [];
let browser;

async function openPage({ width = 1440, height = 900, mobile = false, token = true, label, allow = [], context = null, reducedMotion = false } = {}) {
  const page = await (context || browser).newPage();
  await page.setViewport({ width, height, deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile });
  if (reducedMotion) await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  if (token) {
    await page.evaluateOnNewDocument((t) => {
      try {
        localStorage.setItem('dr:token', t);
      } catch {
        /* no storage */
      }
    }, TOKEN);
  }
  // Records every stage/corridor state change (the pages navigate without reloading).
  await page.evaluateOnNewDocument(() => {
    window.__states = [];
    let last = '';
    setInterval(() => {
      const s = `${window.__dream?.state ? `d:${window.__dream.state}` : ''}|${window.__corridor?.state ? `c:${window.__corridor.state}` : ''}`;
      if (s !== last) {
        last = s;
        window.__states.push(s);
      }
    }, 40);
  });
  const allowed = (text) => allow.some((re) => re.test(text));
  page.on('console', (m) => {
    if (m.type() === 'error' && !allowed(m.text())) consoleErrors.push({ label, text: m.text().slice(0, 200) });
  });
  page.on('pageerror', (e) => consoleErrors.push({ label, text: `pageerror: ${String(e?.message || e).slice(0, 200)}` }));
  return page;
}

const goto = (page, p) => page.goto(`${SITE}${p}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
const shot = (page, name) => page.screenshot({ path: path.join(SHOTS, name) });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitFn(page, fn, arg, timeout = 15000) {
  try {
    await page.waitForFunction(fn, { timeout, polling: 100 }, arg);
    return true;
  } catch {
    return false;
  }
}
async function waitSel(page, sel, timeout = 15000) {
  try {
    await page.waitForSelector(sel, { timeout });
    return true;
  } catch {
    return false;
  }
}

/** Robots noindex, no horizontal scroll (phones), no left-border callouts: on every page. */
async function basics(page, label, { phone = false } = {}) {
  const r = await page.evaluate(() => {
    const robots = document.querySelector('meta[name="robots"]')?.getAttribute('content') || '';
    const hscroll = document.documentElement.scrollWidth > window.innerWidth + 1;
    const callouts = [...document.querySelectorAll('body *')]
      .filter((el) => {
        const cs = getComputedStyle(el);
        return parseFloat(cs.borderLeftWidth) >= 2 && cs.borderLeftStyle !== 'none' && parseFloat(cs.borderRightWidth) < 1;
      })
      .map((el) => `${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]}`);
    return { robots, hscroll, callouts };
  });
  check(/noindex/.test(r.robots) && /nofollow/.test(r.robots), `${label}: robots noindex, nofollow`, r.robots || 'missing');
  if (phone) check(!r.hscroll, `${label}: no horizontal scroll at 390`);
  check(!r.callouts.length, `${label}: no left-border callouts`, r.callouts.slice(0, 3).join(', '));
}

/** Nothing white (all channels ≥ 235): text, backgrounds, borders, caret, placeholders. */
const noWhite = () => {
  const white = (c) => {
    const m = /rgba?\(([^)]+)\)/.exec(c || '');
    if (!m) return false;
    const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
    const a = p.length > 3 ? p[3] : 1;
    return a > 0.05 && p[0] >= 235 && p[1] >= 235 && p[2] >= 235;
  };
  const bad = [];
  for (const el of [document.documentElement, document.body, ...document.querySelectorAll('body *')]) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0) continue;
    const r = el.getBoundingClientRect();
    if (el !== document.documentElement && el !== document.body && (r.width === 0 || r.height === 0)) continue;
    const props = ['background-color', 'caret-color'];
    if ((el.textContent || '').trim() || el.matches('input, textarea')) props.push('color');
    for (const s of ['top', 'right', 'bottom', 'left']) if (parseFloat(cs[`border-${s}-width`]) > 0) props.push(`border-${s}-color`);
    const name = `${el.tagName.toLowerCase()}.${String(el.className || '').split(' ')[0]}`;
    for (const p of props) if (white(cs.getPropertyValue(p))) bad.push(`${name} ${p}`);
    if (el.matches('input, textarea') && white(getComputedStyle(el, '::placeholder').color)) bad.push(`${name} ::placeholder`);
  }
  return bad;
};

/** A door's dream id (the hook may carry the dream id, or the door id `d<hex>`). */
function dreamOf(door) {
  if (door?.dream) return door.dream;
  if (UUID_RE.test(door?.id || '')) return door.id;
  const m = /^d([0-9a-f]{32})$/.exec(door?.id || '');
  return m ? `${m[1].slice(0, 8)}-${m[1].slice(8, 12)}-${m[1].slice(12, 16)}-${m[1].slice(16, 20)}-${m[1].slice(20)}` : null;
}

/* ── sections ─────────────────────────────────────────────────────────── */

async function checkGate() {
  const ctx = await browser.createBrowserContext();
  const page = await openPage({ width: 390, height: 844, mobile: true, token: false, label: 'gate', allow: [/status of 404/], context: ctx });
  await goto(page, '/dreams');
  check(await waitSel(page, '[data-dr="gate-password"]'), 'gate: shows with no token');
  await basics(page, 'gate', { phone: true });
  const white = await page.evaluate(noWhite);
  check(!white.length, 'gate: no white anywhere', white.slice(0, 3).join(', '));
  await shot(page, 'gate-390.png');
  await page.type('[data-dr="gate-password"]', 'not-the-password');
  await page.click('[data-dr="gate-submit"]');
  const wrong = await waitSel(page, '[data-dr="gate-note"][data-status="failed"]', 10000);
  check(wrong && (await page.$('[data-dr="gate-password"]')), 'gate: a wrong password stays at the gate (ping 404)');
  await page.click('[data-dr="gate-password"]');
  await page.keyboard.down('Control');
  await page.keyboard.press('KeyA');
  await page.keyboard.up('Control');
  await page.keyboard.press('Backspace');
  await page.type('[data-dr="gate-password"]', TOKEN);
  await page.click('[data-dr="gate-submit"]');
  const inside = await waitFn(page, () => !document.querySelector('[data-dr="gate"]'), null, 10000);
  check(inside, 'gate: the right password opens dreams');
  const stored = await page.evaluate(() => localStorage.getItem('dr:token'));
  check(stored === TOKEN, 'gate: the password is kept as dr:token');
  await ctx.close();
}

async function idbRead(page, store, key) {
  return page.evaluate(
    (s, k) =>
      new Promise((resolve) => {
        const r = indexedDB.open('dream-rooms');
        r.onsuccess = () => {
          const db = r.result;
          if (!db.objectStoreNames.contains(s)) return resolve(null);
          const q = k == null ? db.transaction(s).objectStore(s).getAll() : db.transaction(s).objectStore(s).get(k);
          q.onsuccess = () => resolve(q.result ?? null);
          q.onerror = () => resolve(null);
        };
        r.onerror = () => resolve(null);
      }),
    store,
    key ?? null,
  );
}

async function checkCapture() {
  const ctx = await browser.createBrowserContext();
  const page = await openPage({ width: 390, height: 844, mobile: true, label: 'capture', context: ctx });
  const night = dreamtOnFor(new Date());
  const before = (await list()).filter((r) => r.dreamt_on === night).length;
  const made = [];
  try {
    await goto(page, '/dreams/new');
    check(await waitSel(page, '[data-dr="capture-text"]:not([disabled])'), 'capture: the textarea is there');
    const focused = await waitFn(page, () => document.activeElement?.dataset?.dr === 'capture-text', null, 5000);
    check(focused, 'capture: the textarea is already focused');
    await basics(page, 'capture', { phone: true });
    const head = await page.evaluate(() => ({
      manifest: document.querySelector('link[rel="manifest"]')?.getAttribute('href'),
      touch: document.querySelector('link[rel="apple-touch-icon"]')?.getAttribute('href'),
      capable: document.querySelector('meta[name="apple-mobile-web-app-capable"]')?.getAttribute('content'),
    }));
    check(head.manifest === '/dreams/manifest.webmanifest' && head.touch && head.capable === 'yes', 'capture: manifest + Apple home-screen tags', JSON.stringify(head));
    const mf = await fetch(`${SITE}/dreams/manifest.webmanifest`).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    check(mf?.start_url === '/dreams/new' && mf?.display === 'standalone', 'capture: the manifest opens /dreams/new standalone');
    const white = await page.evaluate(noWhite);
    check(!white.length, 'capture: no white anywhere', white.slice(0, 3).join(', '));
    const chip = await page.$eval('[data-dr="night-chip"]', (el) => ({ date: el.dataset.date, text: el.textContent }));
    check(chip.date === night && chip.text.includes(nightLabel(night)), 'capture: the night chip follows the before-2-pm rule', `${chip.date}, expected ${night}`);
    await shot(page, 'capture-390.png');

    // autosave
    await page.keyboard.type(TEXT_1, { delay: 2 });
    const kept = await waitSel(page, '[data-dr="autosave"][data-state="saved"]', 5000);
    const draft = await idbRead(page, 'draft', 'current');
    check(kept && draft?.text === TEXT_1, 'capture: typing autosaves to IndexedDB (the dot)');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitSel(page, '[data-dr="capture-text"]:not([disabled])');
    const restored = await waitFn(page, (t) => document.querySelector('[data-dr="capture-text"]')?.value === t, TEXT_1, 5000);
    check(restored, 'capture: the draft survives a reload');
    await shot(page, 'capture-typed-390.png');

    // save → uploaded
    await page.click('[data-dr="save"]');
    const up1 = await waitSel(page, '[data-dr="saved"][data-upload="uploaded"]', 20000);
    const id1 = await page.$eval('[data-dr="saved"]', (el) => el.dataset.id).catch(() => null);
    if (id1) made.push(id1);
    const row1 = id1 ? await getRow(id1) : null;
    check(up1 && row1?.raw_text === TEXT_1 && row1?.dreamt_on === night && row1?.status === 'captured', 'capture: Save → uploaded (verified via the API)', `${id1 || 'no id'}, night ${row1?.dreamt_on}`);
    check(row1?.night_order === before + 1, 'capture: the first dream of a night comes after the ones already there', `night_order ${row1?.night_order}, ${before} before`);
    const left = await idbRead(page, 'outbox', id1);
    check(!left, "capture: the phone's copy is deleted once the upload is confirmed");
    await shot(page, 'capture-saved-390.png');
    const savedWhite = await page.evaluate(noWhite);
    check(!savedWhite.length, 'capture (saved): no white anywhere', savedWhite.slice(0, 3).join(', '));

    // another dream from the same night
    await page.click('[data-dr="another"]');
    await waitSel(page, '[data-dr="capture-text"]:not([disabled])');
    const fresh = await waitFn(page, () => document.activeElement?.dataset?.dr === 'capture-text' && !document.activeElement.value, null, 5000);
    check(fresh, 'capture: "Another dream from the same night" opens a fresh, focused textarea');
    const chip2 = await waitFn(page, (n) => document.querySelector('[data-dr="night-chip"]')?.dataset.order === String(n), (row1?.night_order || 0) + 1, 5000);
    const date2 = await page.$eval('[data-dr="night-chip"]', (el) => el.dataset.date);
    check(chip2 && date2 === night, 'capture: the chip keeps the night and shows the next number', `${date2}`);
    await page.keyboard.type(TEXT_2, { delay: 2 });
    await waitSel(page, '[data-dr="autosave"][data-state="saved"]', 5000);
    await page.click('[data-dr="save"]');
    const up2 = await waitSel(page, '[data-dr="saved"][data-upload="uploaded"]', 20000);
    const id2 = await page.$eval('[data-dr="saved"]', (el) => el.dataset.id).catch(() => null);
    if (id2 && id2 !== id1) made.push(id2);
    const row2 = id2 && id2 !== id1 ? await getRow(id2) : null;
    check(up2 && row2?.dreamt_on === row1?.dreamt_on && row2?.night_order === (row1?.night_order || 0) + 1, 'capture: another dream = same dreamt_on, next night_order (via the API)', `${row2?.dreamt_on} #${row2?.night_order}`);

    // the chip changes the night
    await page.click('[data-dr="another"]');
    await waitSel(page, '[data-dr="night-input"]');
    const other = '2026-01-07';
    await page.evaluate((v) => {
      const el = document.querySelector('[data-dr="night-input"]');
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, v);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }, other);
    const moved = await waitFn(page, (v) => document.querySelector('[data-dr="night-chip"]')?.dataset.date === v, other, 3000);
    const movedText = await page.$eval('[data-dr="night-chip"]', (el) => el.textContent);
    check(moved && movedText.includes(nightLabel(other)), 'capture: the night chip can change the night', movedText.replace(/\s+/g, ' ').trim());
  } finally {
    if (!KEEP) for (const id of made) await api('DELETE', `/${id}?purge=1`);
    await ctx.close();
  }
  await checkOffline();
}

/** No signal at 6 am: Save keeps the dream in the outbox; it goes up when the signal comes back. */
async function checkOffline() {
  const ctx = await browser.createBrowserContext();
  const page = await openPage({ width: 390, height: 844, mobile: true, label: 'capture offline', context: ctx, allow: [/ERR_INTERNET_DISCONNECTED/] });
  let id = null;
  try {
    await goto(page, '/dreams/new');
    await waitSel(page, '[data-dr="capture-text"]:not([disabled])');
    await waitFn(page, () => document.activeElement?.dataset?.dr === 'capture-text', null, 5000);
    await page.setOfflineMode(true);
    await page.keyboard.type(TEXT_1, { delay: 2 });
    await waitSel(page, '[data-dr="autosave"][data-state="saved"]', 5000);
    await page.click('[data-dr="save"]');
    const waiting = await waitSel(page, '[data-dr="saved"][data-upload="waiting"]', 5000);
    id = await page.$eval('[data-dr="saved"]', (el) => el.dataset.id).catch(() => null);
    const held = id ? await idbRead(page, 'outbox', id) : null;
    check(waiting && held?.row?.raw_text === TEXT_1 && !(await getRow(id)), 'capture offline: Save keeps the dream in the outbox on the phone');
    await page.setOfflineMode(false);
    const up = await waitSel(page, '[data-dr="saved"][data-upload="uploaded"]', 30000);
    const row = id ? await getRow(id) : null;
    const gone = id ? !(await idbRead(page, 'outbox', id)) : false;
    check(up && row?.raw_text === TEXT_1 && gone, 'capture offline: back online → uploaded once, the phone copy deleted');
  } finally {
    await page.setOfflineMode(false).catch(() => {});
    if (id && !KEEP) await api('DELETE', `/${id}?purge=1`);
    await ctx.close();
  }
}

async function checkList() {
  const rows = await list();
  const nights = [...new Set(rows.map((r) => r.dreamt_on))].sort().reverse();
  for (const [w, h, phone] of [
    [1440, 900, false],
    [390, 844, true],
  ]) {
    const label = `list ${w}`;
    const page = await openPage({ width: w, height: h, mobile: phone, label });
    await goto(page, '/dreams?list=1');
    check(await waitSel(page, '[data-dr="night"]'), `${label}: shows the nights`);
    const dom = await page.$$eval('[data-dr="night"]', (els) =>
      els.map((el) => ({ night: el.dataset.night, rows: [...el.querySelectorAll('[data-dr="row"]')].map((r) => ({ id: r.dataset.id, order: Number(r.dataset.order), status: r.dataset.status, label: r.querySelector('[data-dr="status"]')?.textContent, walk: r.querySelector('[data-dr="walk"]')?.getAttribute('href') || null })) })),
    );
    check(JSON.stringify(dom.map((n) => n.night)) === JSON.stringify(nights), `${label}: grouped by night, newest night first`, dom.map((n) => n.night).join(' > '));
    const inOrder = dom.every((n) => n.rows.every((r, i) => r.order === i + 1));
    check(inOrder, `${label}: each night in night_order 1..n`);
    const labels = dom.every((n) => n.rows.every((r) => r.label === COPY.status[r.status]));
    check(labels, `${label}: every row has its status dot and label`);
    const walks = dom.every((n) => n.rows.every((r) => (r.status === 'rendered' ? r.walk === `/dreams?at=${r.id}&enter=1` : r.walk === null)));
    check(walks, `${label}: "walk" only on rendered rows, to /dreams?at=<id>&enter=1`);
    await basics(page, label, { phone });
    await shot(page, `list-${w}.png`);
    if (w === 1440) await reorder(page);
    await page.close();
  }
}

async function reorder(page) {
  const rows = await list();
  const counts = rows.reduce((m, r) => m.set(r.dreamt_on, (m.get(r.dreamt_on) || 0) + 1), new Map());
  const night = [...counts.keys()].sort().reverse().find((k) => counts.get(k) >= 2);
  if (!night) return skip('list: reorder', 'no night with two dreams');
  const first = rows.find((r) => r.dreamt_on === night && r.night_order === 1);
  await page.click(`[data-dr="row"][data-id="${first.id}"] [data-dr="down"]`);
  const down = await poll(async () => (await list()).find((r) => r.id === first.id)?.night_order === 2);
  const domDown = await waitSel(page, `[data-dr="row"][data-id="${first.id}"][data-order="2"]`, 10000);
  check(down && domDown, 'list: "down" moves a dream later in its night (via the API)', `${night}`);
  await waitFn(page, (id) => !document.querySelector(`[data-dr="row"][data-id="${id}"] [data-dr="up"]`)?.disabled, first.id, 10000);
  await page.click(`[data-dr="row"][data-id="${first.id}"] [data-dr="up"]`);
  const up = await poll(async () => (await list()).find((r) => r.id === first.id)?.night_order === 1);
  check(up, 'list: "up" moves it back (via the API)');
  const after = await list();
  const contiguous = [...new Set(after.map((r) => r.dreamt_on))].every((n) => {
    const orders = after.filter((r) => r.dreamt_on === n).map((r) => r.night_order).sort((a, b) => a - b);
    return orders.every((o, i) => o === i + 1);
  });
  check(contiguous, 'list: every night stays 1..n after reordering');
}

async function checkDreamPages() {
  const rows = await list();
  const seen = new Set();
  for (const lean of rows.filter((r) => FIXTURE_IDS.has(r.id))) {
    const row = await getRow(lean.id);
    const page = await openPage({ width: 1440, height: 900, label: `dream ${lean.status}` });
    await goto(page, `/dreams/${lean.id}`);
    const ok = await waitSel(page, `[data-dr="dream"][data-status="${lean.status}"]`);
    const label = await page.$eval('[data-dr="dream"] [data-dr="status"]', (el) => el.textContent).catch(() => null);
    const parts = await page.evaluate(() => ({
      edit: Boolean(document.querySelector('[data-dr="edit-text"]')),
      words: (document.querySelector('[data-dr="raw-text"]')?.textContent || '').length,
      remember: Boolean(document.querySelector('[data-dr="remember"]')),
      reason: document.querySelector('[data-dr="fail-reason"]')?.textContent || '',
      hero: Boolean(document.querySelector('[data-dr="hero"]')),
      enter: Boolean(document.querySelector('[data-dr="enter"]')),
    }));
    let shape = false;
    if (lean.status === 'captured') shape = parts.edit && !parts.remember;
    else if (lean.status === 'reading' || lean.status === 'building') shape = !parts.edit && parts.words > 0 && parts.remember;
    else if (lean.status === 'failed') shape = !parts.edit && parts.words > 0 && parts.reason.includes(row?.fail_reason || '');
    else if (lean.status === 'rendered') shape = parts.hero && (parts.enter || !row?.world) && parts.remember;
    check(ok && label === COPY.status[lean.status] && shape, `dream page (${lean.status}): ${lean.id.slice(-4)} shows the right parts`, JSON.stringify(parts));
    if (!seen.has(lean.status)) {
      seen.add(lean.status);
      await basics(page, `dream ${lean.status}`);
      await shot(page, `dream-${lean.status}-1440.png`);
    }
    await page.close();
  }

  // 390: the rendered page on a phone
  const rendered = rows.find((r) => r.status === 'rendered' && FIXTURE_IDS.has(r.id));
  if (rendered) {
    const page = await openPage({ width: 390, height: 844, mobile: true, label: 'dream 390' });
    await goto(page, `/dreams/${rendered.id}`);
    await waitSel(page, '[data-dr="dream"][data-status]');
    await basics(page, 'dream rendered 390', { phone: true });
    await shot(page, 'dream-rendered-390.png');
    await page.close();
  }

  // captured: edit, then a 409 from a write elsewhere
  const cap = rows.find((r) => r.status === 'captured' && FIXTURE_IDS.has(r.id));
  if (cap) {
    const original = (await getRow(cap.id))?.raw_text;
    const page = await openPage({ width: 1440, height: 900, label: 'dream edit', allow: [/status of 409/] });
    try {
      await goto(page, `/dreams/${cap.id}`);
      await waitSel(page, '[data-dr="edit-text"]');
      await page.click('[data-dr="edit-text"]');
      await page.keyboard.press('End');
      await page.keyboard.type(' (edited)');
      await page.click('[data-dr="edit-save"]');
      const saved = await waitSel(page, '[data-dr="edit-state"][data-state="saved"]', 10000);
      check(saved && (await getRow(cap.id))?.raw_text === `${original} (edited)`, 'dream page (captured): an edit saves raw_text (via the API)');
      const fresh = await getRow(cap.id);
      await api('PATCH', `/${cap.id}`, { raw_text: original, ifUpdatedAt: fresh.updated_at }); // a write from "elsewhere"
      await page.click('[data-dr="edit-text"]');
      await page.keyboard.press('End');
      await page.keyboard.type(' again');
      await page.click('[data-dr="edit-save"]');
      const conflict = await waitSel(page, '[data-dr="edit-state"][data-state="conflict"]', 10000);
      const kept = await page.$eval('[data-dr="edit-text"]', (el) => el.value.endsWith(' again'));
      check(conflict && kept, 'dream page (captured): a 409 reloads the row and keeps his edit');
      await page.click('[data-dr="edit-save"]');
      const second = await waitSel(page, '[data-dr="edit-state"][data-state="saved"]', 10000);
      check(second, 'dream page (captured): saving again after the reload works');
    } finally {
      const now = await getRow(cap.id);
      if (now && now.raw_text !== original) await api('PATCH', `/${cap.id}`, { raw_text: original, ifUpdatedAt: now.updated_at });
      await page.close();
    }
  }

  // after the read: "Remembered more" appends to extra_text
  const read = rows.find((r) => (r.status === 'reading' || r.status === 'building') && FIXTURE_IDS.has(r.id));
  if (read) {
    const start = await getRow(read.id);
    const prev = start?.extra_text || '';
    const page = await openPage({ width: 1440, height: 900, label: 'dream remember' });
    try {
      await goto(page, `/dreams/${read.id}`);
      await waitSel(page, '[data-dr="remember-open"]');
      check(!(await page.$('[data-dr="edit-text"]')), 'dream page (after the read): raw_text is not editable');
      await page.click('[data-dr="remember-open"]');
      await waitSel(page, '[data-dr="remember-text"]');
      await page.type('[data-dr="remember-text"]', TEXT_MORE);
      await page.click('[data-dr="remember-save"]');
      await waitSel(page, '[data-dr="remember-state"]', 10000);
      const after = await getRow(read.id);
      check((after?.extra_text || '').endsWith(TEXT_MORE) && after?.raw_text === start?.raw_text, '"Remembered more" appends to extra_text, raw_text untouched (via the API)');
      await shot(page, 'dream-remembered-1440.png');
    } finally {
      const now = await getRow(read.id);
      if (now && (now.extra_text || '') !== prev) await api('PATCH', `/${read.id}`, { extra_text: prev, ifUpdatedAt: now.updated_at });
      await page.close();
    }
  }
}

/** A rendered fixture to walk (one with a model first). */
async function walkable() {
  const rows = (await list()).filter((r) => r.status === 'rendered');
  for (const r of rows) {
    const full = await getRow(r.id);
    if (full?.world && full?.files?.model_url) return full;
  }
  for (const r of rows) {
    const full = await getRow(r.id);
    if (full?.world) return full;
  }
  return null;
}

async function checkWalk() {
  const row = await walkable();
  if (!row) return fail('walk: no rendered dream with a world to walk', 'seed first');
  const placeholder = /PLACEHOLDER/.test(fs.readFileSync(path.join(REPO, 'src/dream-rooms/viewer/DreamStage.jsx'), 'utf8'));
  if (placeholder) console.log('NOTE  src/dream-rooms/viewer/DreamStage.jsx is still the UI placeholder: the walk checks below need the real viewer');

  const page = await openPage({ width: 1440, height: 900, label: 'walk' });
  await goto(page, `/dreams/${row.id}`);
  await waitSel(page, '[data-dr="enter"]');
  await page.click('[data-dr="enter"]');
  const walking = await waitFn(page, () => window.__dream?.state === 'walking', null, 60000);
  check(walking, 'walk: Enter → window.__dream.state reaches walking', row.id.slice(-4));
  const box = await page.evaluate(() => {
    const r = document.querySelector('[data-dr="stage"] canvas')?.getBoundingClientRect();
    return r ? { w: Math.round(r.width), h: Math.round(r.height), x: Math.round(r.left), y: Math.round(r.top) } : null;
  });
  check(box && box.w >= 1440 * 0.98 && box.h >= 900 * 0.98 && box.x === 0 && box.y === 0, 'walk: the walk fills the screen', JSON.stringify(box));
  if (walking) await shot(page, 'walk-1440.png');
  await page.close();

  const auto = await openPage({ width: 1440, height: 900, label: 'walk autopilot' });
  await goto(auto, `/dreams/${row.id}?autopilot=1`);
  const landed = await waitFn(auto, (id) => location.pathname === '/dreams' && new URLSearchParams(location.search).get('at') === id, row.id, WALK_TIMEOUT);
  const states = await auto.evaluate(() => window.__states || []);
  const woke = states.some((s) => s.includes('d:woken'));
  check(landed && woke, 'walk: ?autopilot=1 reaches woken and lands on /dreams?at=<id>', `${woke ? 'woken' : 'no woken'}, ${landed ? 'landed' : 'did not land'}`);
  await auto.close();
}

async function corridorReady(page, timeout = 60000) {
  return waitFn(page, () => window.__corridor?.state === 'corridor', null, timeout);
}

async function checkCorridor() {
  const rows = await list();
  const page = await openPage({ width: 1440, height: 900, label: 'corridor 1440' });
  await goto(page, '/dreams');
  const ready = await corridorReady(page);
  check(ready, 'corridor: __corridor.state reaches corridor');
  await basics(page, 'corridor 1440');
  const corner = await page.$$eval('[data-dr="corner"] a', (as) => as.map((a) => a.getAttribute('href')));
  check(JSON.stringify(corner) === JSON.stringify(['/dreams/new', '/dreams?list=1']), 'corridor: only two quiet links, "new dream" and "list"', corner.join(' '));
  await sleep(3000);
  await shot(page, 'corridor-1440.png');
  if (!ready) {
    await page.close();
    return fail('corridor: the remaining corridor checks need __corridor', 'skipped');
  }

  const hook = await page.evaluate(() => ({ doors: window.__corridor.doors || [], breaks: window.__corridor.breaks || [] }));
  const doors = hook.doors.map((d) => ({ ...d, dream: dreamOf(d) }));
  const byId = new Map(doors.map((d) => [d.dream, d]));
  check(rows.length === doors.length && rows.every((r) => byId.has(r.id)), 'corridor: one door per dream', `${doors.length} doors, ${rows.length} rows`);
  const ordered = [...rows].sort((a, b) => (a.dreamt_on === b.dreamt_on ? a.night_order - b.night_order : a.dreamt_on < b.dreamt_on ? 1 : -1));
  const zs = ordered.map((r) => byId.get(r.id)?.z);
  const mono = zs.every((z, i) => typeof z === 'number' && (i === 0 || z < zs[i - 1]));
  check(mono, 'corridor: door z monotonic in (dreamt_on, night_order): newest night nearest, deeper = older, in order within a night');

  // a night break exactly where the date changes: entrance > break(n1) > doors(n1) > break(n2) > doors(n2) …
  const nights = [...new Set(ordered.map((r) => r.dreamt_on))];
  const breakOf = new Map(hook.breaks.map((b) => [b.night, b.z]));
  const seq = [];
  for (const n of nights) {
    seq.push(breakOf.get(n));
    for (const r of ordered.filter((x) => x.dreamt_on === n)) seq.push(byId.get(r.id)?.z);
  }
  const breaksOk = hook.breaks.length === nights.length && seq.every((z, i) => typeof z === 'number' && (i === 0 || z < seq[i - 1]));
  check(breaksOk, 'corridor: a night break exactly where the date changes', `${hook.breaks.length} breaks, ${nights.length} nights`);

  const statesOk = rows.every((r) => byId.get(r.id)?.status === r.status && (byId.get(r.id)?.state === undefined || byId.get(r.id).state === doorState(r.status)));
  check(statesOk, 'corridor: every door matches its row (status, door state)');

  // only rendered doors open
  const shut = rows.find((r) => r.status !== 'rendered');
  if (shut) {
    await page.evaluate((id) => window.__corridor.enter?.(id), shut.id);
    await sleep(3000);
    const st = await page.evaluate(() => window.__corridor.state);
    check(st === 'corridor', 'corridor: a door that is not rendered does not open', `${shut.status} → ${st}`);
  }
  await page.close();

  // deep link ?at=<id>
  const target = rows[Math.floor(rows.length / 2)];
  if (target) {
    const p2 = await openPage({ width: 1440, height: 900, label: 'corridor at' });
    await goto(p2, `/dreams?at=${target.id}`);
    const at = (await corridorReady(p2)) && (await waitFn(p2, (id) => window.__corridor?.at === id, target.id, 10000));
    check(at, 'corridor: ?at=<id> starts at that door', target.id.slice(-4));
    await p2.close();
  }

  // ?list=1
  const p3 = await openPage({ width: 1440, height: 900, label: 'corridor list' });
  await goto(p3, '/dreams?list=1');
  check(await waitSel(p3, '[data-dr="list"]'), 'corridor: ?list=1 shows the list');
  await p3.close();

  // reduced motion → the list, with "walk the corridor anyway"
  const p4 = await openPage({ width: 1440, height: 900, label: 'corridor reduced', reducedMotion: true });
  await goto(p4, '/dreams');
  const listed = await waitSel(p4, '[data-dr="list"][data-reason="motion"] [data-dr="walk-anyway"]');
  check(listed, 'corridor: prefers-reduced-motion shows the list with "walk the corridor anyway"');
  if (listed) {
    await p4.click('[data-dr="walk-anyway"]');
    check(await waitSel(p4, '[data-dr="corridor"]'), 'corridor: "walk the corridor anyway" opens the corridor');
  }
  await p4.close();

  // phone
  const p5 = await openPage({ width: 390, height: 844, mobile: true, label: 'corridor 390' });
  await goto(p5, '/dreams');
  await corridorReady(p5);
  await basics(p5, 'corridor 390', { phone: true });
  await sleep(3000);
  await shot(p5, 'corridor-390.png');
  await p5.close();

  // the empty state: no dreams at all
  const p6 = await openPage({ width: 1440, height: 900, label: 'corridor empty' });
  await p6.setRequestInterception(true);
  p6.on('request', (req) => {
    const u = new URL(req.url());
    if (req.method() === 'GET' && u.pathname === '/api/dreams') req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [] }) });
    else req.continue();
  });
  await goto(p6, '/dreams');
  const emptyReady = await corridorReady(p6);
  const empty = await p6.evaluate(() => ({ doors: window.__corridor?.doors || [], empty: window.__corridor?.empty }));
  // The hook lists dream doors only and flags the empty corridor; the end door's sign comes from the contract.
  const endDoor = buildCorridorWorld([]).doors;
  const signed = endDoor.length === 1 && endDoor[0].sign.join(' ') === 'nothing dreamt yet';
  const one = (empty.empty === true && empty.doors.length === 0) || (empty.doors.length === 1 && JSON.stringify(empty.doors[0].sign || '').includes('nothing dreamt yet'));
  check(emptyReady && one && signed, 'corridor: zero dreams → one shut door, "nothing dreamt yet"', `empty ${empty.empty}, ${empty.doors.length} dream doors`);
  await sleep(2500);
  await shot(p6, 'corridor-empty-1440.png');
  await p6.close();

  // a real click on a rendered door's sign drifts in, plays it, wakes back at that door
  const p7 = await openPage({ width: 1440, height: 900, label: 'corridor enter' });
  // nearest the entrance first: the newest night, then night_order
  const rendered = rows.filter((r) => r.status === 'rendered').sort((a, b) => (a.dreamt_on === b.dreamt_on ? a.night_order - b.night_order : a.dreamt_on < b.dreamt_on ? 1 : -1));
  const onScreen = (pt) => pt && pt.x >= 0 && pt.y >= 0 && pt.x <= 1440 && pt.y <= 900;
  let chosen = null;
  // From the entrance first (the newest signs are in view), then standing at each door in turn.
  for (const start of [null, ...rendered.map((r) => r.id)]) {
    await goto(p7, start ? `/dreams?at=${start}&autopilot=1` : '/dreams?autopilot=1');
    if (!(await corridorReady(p7))) break;
    await sleep(2500);
    for (const r of start ? rendered.filter((x) => x.id === start) : rendered) {
      const pt = await p7.evaluate((id) => window.__corridor.signScreen?.(id) || null, r.id);
      if (onScreen(pt)) {
        chosen = { id: r.id, pt };
        break;
      }
    }
    if (chosen) break;
  }
  if (!chosen) {
    fail('corridor: a rendered door sign on screen to click', 'signScreen gave nothing on screen');
  } else {
    await p7.mouse.click(chosen.pt.x, chosen.pt.y);
    // the tap drifts him to the door first (state stays `corridor`), then through it
    const entering = await waitFn(p7, () => ['entering', 'dream'].includes(window.__corridor?.state), null, 90000);
    check(entering, 'corridor: a click on a rendered door sign drifts in', chosen.id.slice(-4));
    const back = await waitFn(p7, (id) => window.__corridor?.state === 'corridor' && window.__corridor?.at === id && (window.__states || []).some((s) => s.includes('c:waking') || s.includes('d:woken')), chosen.id, WALK_TIMEOUT);
    const states = await p7.evaluate(() => (window.__states || []).join(' '));
    check(back, 'corridor: ?autopilot=1 plays it to the wake and leaves him at that door (__corridor.at)', /dream/.test(states) ? 'played' : 'never reached dream');
  }
  await p7.close();
}

/* ── run ──────────────────────────────────────────────────────────────── */

async function main() {
  fs.mkdirSync(SHOTS, { recursive: true });
  if (!TOKEN) {
    fail('password', 'no DREAMS_PASSWORD / PORTAL_PASSWORD in env or .dev.vars');
    return;
  }
  const ping = await api('GET', '/ping').catch(() => ({ status: 0 }));
  check(ping.status === 200 && ping.data?.ok, `api: ping ${SITE}`, `HTTP ${ping.status}`);
  if (ping.status !== 200) return;
  const anon = await api('GET', '/ping', undefined, { token: '' });
  check(anon.status === 404, 'api: no password → 404');
  const rows = await list();
  const seeded = FIXTURES.every((f) => rows.some((r) => r.id === f.id));
  check(seeded, 'api: the fixtures are seeded', `${rows.length} rows`);
  if (!seeded) return;

  browser = await puppeteer.launch({
    executablePath: EDGE,
    headless: true,
    args: ['--use-angle=d3d11', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required', '--no-first-run', '--no-default-browser-check'],
  });
  try {
    const sections = [
      ['gate', checkGate],
      ['capture', checkCapture],
      ['list', checkList],
      ['dream', checkDreamPages],
      ['walk', checkWalk],
      ['corridor', checkCorridor],
    ];
    for (const [name, fn] of sections) {
      if (!want(name)) continue;
      try {
        await fn();
      } catch (err) {
        fail(`${name}: threw`, String(err?.message || err).slice(0, 160));
      }
    }
  } finally {
    await browser.close();
  }
  check(!consoleErrors.length, 'everywhere: zero console errors', consoleErrors.slice(0, 4).map((e) => `[${e.label}] ${e.text}`).join(' | '));
}

await main();
const failed = results.filter((r) => r.kind === 'FAIL').length;
console.log(`\n${results.filter((r) => r.kind === 'PASS').length} passed, ${failed} failed, ${results.filter((r) => r.kind === 'SKIP').length} skipped · shots in ${path.relative(REPO, SHOTS)}`);
process.exit(failed ? 1 : 0);
