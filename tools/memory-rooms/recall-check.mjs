#!/usr/bin/env node
/* recall-check: the "Recall" design pass, in headless Edge (no Mapbox loads: the map runs ?map=atlas).

     node tools/memory-rooms/recall-check.mjs [--base http://127.0.0.1:8794] [--dark]

   Against a LOCAL Worker with rendered spots (any store). At 1440 and 390 (touch):
   - the spot page recalls its room: data-recall goes points -> room -> done, and only then
     data-state="ready"; points were drawn; reduced motion skips the cloud and still gets ready;
   - the title block: sheet MR-###, place, date, a scale label that changes when zooming, a north
     arrow that turns when the view is dragged;
   - pins: every visible callout has a leader line; clicking one opens it;
   - the panel: serif title, the note as a pull-quote signed "— <name>", the captured date;
   - the phone: a bottom sheet that peeks (title + Walk in) and opens with its handle;
   - the map's index: "No. 001"…, no day strip (DECISIONS 212), dates with the year;
     a row under the mouse marks its spot on the map;
   - "Open" on the card and "Walk in" go through document.startViewTransition; Walk in lands on the walk;
   - no console errors, no sideways scroll at 390.
   Screens: memory-rooms-work/_recall-check/. Exit 1 on any failure. */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = path.join(REPO, 'memory-rooms-work', '_recall-check');
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const args = process.argv.slice(2);
const BASE = (args.includes('--base') ? args[args.indexOf('--base') + 1] : process.env.MEMORIES_API || 'http://127.0.0.1:8794').replace(/\/+$/, '');
const SCHEME = args.includes('--dark') ? 'dark' : 'light';
const TOKEN = process.env.MEMORIES_PASSWORD || 'trip-local';
fs.mkdirSync(OUT, { recursive: true });

const results = [];
const record = (label, ok, detail = '') => {
  results.push({ label, ok, detail });
  console.log(`${ok ? '✓' : '✗'} ${label}${detail ? `  ${detail}` : ''}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sel = (n) => `[data-mr="${n}"]`;

const spots = (await (await fetch(`${BASE}/api/memories/spots`, { headers: { authorization: `Bearer ${TOKEN}` } })).json()).data || [];
const rendered = spots.filter((s) => s.status === 'rendered' && (s.media || []).some((m) => m.type === 'model'));
if (!rendered.length) {
  console.error(`no rendered spot with a model at ${BASE}`);
  process.exit(2);
}
const withPins = rendered.find((s) => s.scene?.pins?.length) || rendered[0];

const browser = await puppeteer.launch({ executablePath: EDGE, headless: true, args: ['--use-gl=angle', '--use-angle=d3d11', '--ignore-gpu-blocklist'] });

async function open(width, { reduced = false } = {}) {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  page.problems = [];
  page.on('console', (m) => (m.type() === 'error' || m.type() === 'warn') && page.problems.push(`${m.type()}: ${m.text()}`));
  page.on('pageerror', (e) => page.problems.push(`pageerror: ${e.message}`));
  const features = [{ name: 'prefers-color-scheme', value: SCHEME }];
  if (reduced) features.push({ name: 'prefers-reduced-motion', value: 'reduce' });
  await page.emulateMediaFeatures(features);
  if (width < 600) await page.setViewport({ width, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  else await page.setViewport({ width, height: 900, deviceScaleFactor: 1 });
  await page.evaluateOnNewDocument((token) => {
    localStorage.setItem('mr:token', token);
    localStorage.setItem('mr:who', 'james');
    // count view transitions (the page calls the real one)
    window.__mrVT = 0;
    if (document.startViewTransition) {
      const real = document.startViewTransition.bind(document);
      document.startViewTransition = (cb) => {
        window.__mrVT += 1;
        return real(cb);
      };
    }
  }, TOKEN);
  await page.bringToFront();
  return page;
}
const tag = (width, name) => `${name}-${width}-${SCHEME}`;
const shot = (page, width, name) => page.screenshot({ path: path.join(OUT, `${tag(width, name)}.png`) });
const noErrors = (page, label) => {
  record(`${label}: no console/page errors`, page.problems.length === 0, page.problems.slice(0, 3).join(' | '));
  page.problems.length = 0;
};

try {
  for (const width of [1440, 390]) {
    const L = `${width}`;
    // ── the recall ─────────────────────────────────────────────────────────
    const page = await open(width);
    await page.evaluateOnNewDocument(() => {
      window.__mrRecall = [];
      new MutationObserver(() => {
        const v = document.querySelector('[data-mr="viewer"]');
        const r = v?.dataset.recall;
        const st = v?.dataset.state;
        const last = window.__mrRecall[window.__mrRecall.length - 1];
        if (r && (!last || last.r !== r || last.st !== st)) window.__mrRecall.push({ r, st, t: performance.now() });
      }).observe(document, { subtree: true, attributes: true, attributeFilter: ['data-recall', 'data-state'] });
    });
    await page.goto(`${BASE}/memories/${withPins.id}`, { waitUntil: 'domcontentloaded' });
    await sleep(900);
    await shot(page, width, 'recall-mid');
    const ready = await page.waitForSelector(`${sel('viewer')}[data-state="ready"]`, { timeout: 60000 }).then(() => true).catch(() => false);
    const seq = await page.evaluate(() => window.__mrRecall);
    const phases = seq.map((s) => s.r);
    const readyAt = seq.find((s) => s.st === 'ready');
    record(`recall ${L}: points -> room -> done, then ready`, ready && phases.includes('points') && phases.includes('room') && phases.at(-1) === 'done' && readyAt?.r === 'done', JSON.stringify(seq.map((s) => `${s.r}/${s.st}@${Math.round(s.t)}`)));
    await sleep(500);
    await shot(page, width, 'spot');

    // title block
    const tb = await page.$eval(sel('titleblock'), (el) => ({
      text: el.textContent,
      sheet: el.querySelector('[data-mr="sheet"]')?.textContent || '',
      scale: el.querySelector('.mr-scalebar__label')?.textContent || '',
      north: el.querySelector('.mr-north svg')?.style.transform || '',
    })).catch(() => null);
    record(`title block ${L}: sheet number, date and a live scale`, Boolean(tb && /^MR-\d{3}$/.test(tb.sheet) && /\d{4}/.test(tb.text) && / m$/.test(tb.scale) && /rotate/.test(tb.north)), JSON.stringify(tb));
    // pins: a leader per visible callout; clicking opens it
    const pins = await page.$$eval(`${sel('pin')}:not([hidden])`, (els) => els.length);
    const leaders = await page.$$eval('.mr-leader', (els) => els.filter((e) => e.style.display !== 'none' && (e.getAttribute('points') || '').split(' ').length === 3).length);
    if (withPins.scene?.pins?.length) {
      record(`pins ${L}: every callout has a leader line`, pins > 0 && leaders === pins, `${pins} callouts, ${leaders} leaders`);
      const first = await page.$(`${sel('pin')}:not([hidden])`);
      if (first) {
        if (width < 600) await first.tap();
        else await first.click();
        await sleep(250);
        const expanded = await first.evaluate((e) => e.getAttribute('aria-expanded'));
        record(`pins ${L}: a callout opens`, expanded === 'true');
        if (width < 600) await first.tap();
        else await first.click();
      }
    }

    const box = await (await page.$(sel('viewer'))).boundingBox();
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height * 0.4;
    if (width >= 600) {
      await page.mouse.move(cx, cy);
      for (let i = 0; i < 6; i++) await page.mouse.wheel({ deltaY: -240 });
    } else {
      await page.touchscreen.touchStart(cx, cy);
      await page.touchscreen.touchMove(cx - 1, cy + 1);
      await page.touchscreen.touchEnd();
    }
    await sleep(700);
    if (width >= 600) {
      await page.mouse.move(cx, cy);
      await page.mouse.down();
      for (let k = 1; k <= 14; k++) await page.mouse.move(cx - k * 14, cy);
      await page.mouse.up();
    } else {
      await page.touchscreen.touchStart(cx, cy);
      for (let k = 1; k <= 14; k++) await page.touchscreen.touchMove(cx - k * 14, cy);
      await page.touchscreen.touchEnd();
    }
    await sleep(900);
    const tb2 = await page.$eval(sel('titleblock'), (el) => ({ scale: el.querySelector('.mr-scalebar__label')?.textContent || '', bar: el.querySelector('.mr-scalebar__bar')?.style.width || '', north: el.querySelector('.mr-north svg')?.style.transform || '' }));
    record(`title block ${L}: the north arrow turns with the orbit`, tb2.north !== tb.north, `${tb.north} -> ${tb2.north}`);
    if (width >= 600) record(`title block ${L}: the scale bar follows the zoom`, tb2.scale !== tb.scale || tb2.bar !== '', `${tb.scale} -> ${tb2.scale} (${tb2.bar})`);

    // the panel
    const panel = await page.evaluate(() => {
      const t = document.querySelector('.mr-spot__title');
      return {
        serif: t ? getComputedStyle(t).fontFamily : '',
        quote: document.querySelector('.mr-quote cite')?.textContent || '',
        date: document.querySelector('[data-mr="spot-date"]')?.textContent || null,
      };
    });
    record(`panel ${L}: serif title, the note signed`, /Instrument Serif/.test(panel.serif) && /^— \S/.test(panel.quote), JSON.stringify(panel));

    // phone: the sheet
    if (width < 600) {
      const peek = await page.evaluate(() => {
        const spot = document.querySelector('.mr-spot');
        const vis = (sel) => {
          const el = document.querySelector(sel);
          return Boolean(el && el.getBoundingClientRect().height > 0 && getComputedStyle(el).display !== 'none');
        };
        return { sheet: spot?.dataset.sheet, title: vis('.mr-spot__title'), walk: vis('[data-mr="walk-link"]'), meta: vis('.mr-meta') };
      });
      record(`sheet ${L}: it peeks with the title and Walk in`, peek.sheet === 'peek' && peek.title && peek.walk && !peek.meta, JSON.stringify(peek));
      // let the orbit drag above settle first: Chrome treats Puppeteer's fast synthetic drag as a fling and
      // swallows a tap that lands within ~1.5 s of it (its touchstart arrives non-cancelable, no click follows)
      await sleep(1800);
      await (await page.$(`${sel('sheet-handle')}`)).tap();
      await sleep(450);
      const opened = await page.evaluate(() => ({ sheet: document.querySelector('.mr-spot')?.dataset.sheet, meta: document.querySelector('.mr-meta')?.getBoundingClientRect().height > 0 }));
      record(`sheet ${L}: the handle opens it`, opened.sheet === 'open' && opened.meta, JSON.stringify(opened));
      await shot(page, width, 'sheet-open');
      await (await page.$(`${sel('sheet-handle')}`)).tap();
      await sleep(400);
    }

    // Walk in: the dive, a view transition, then the walk
    const vt0 = await page.evaluate(() => window.__mrVT);
    const walk = await page.$(sel('walk-link'));
    if (walk) {
      if (width < 600) await walk.tap();
      else await walk.click();
      const arrived = await page.waitForFunction((id) => location.pathname === `/memories/${id}/walk`, { timeout: 8000 }, withPins.id).then(() => true).catch(() => false);
      const vt = await page.evaluate(() => window.__mrVT);
      const supported = await page.evaluate(() => typeof document.startViewTransition === 'function');
      record(`walk in ${L}: the camera dives, then the walk opens${supported ? ' through a view transition' : ''}`, arrived && (!supported || vt > vt0), `vt ${vt0} -> ${vt}`);
    }
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    if (width < 600) record(`spot ${L}: no sideways scroll`, overflow <= 0, `${overflow}px`);
    noErrors(page, `spot ${L}`);
    await page.browserContext().close();

    // ── reduced motion: no cloud, still ready ─────────────────────────────
    const rm = await open(width, { reduced: true });
    await rm.goto(`${BASE}/memories/${withPins.id}`, { waitUntil: 'domcontentloaded' });
    const rmReady = await rm.waitForSelector(`${sel('viewer')}[data-state="ready"]`, { timeout: 60000 }).then(() => true).catch(() => false);
    const rmRecall = await rm.$eval(sel('viewer'), (v) => v.dataset.recall || null);
    record(`reduced motion ${L}: no point cloud, and the room is ready`, rmReady && !rmRecall, `ready ${rmReady}, recall ${rmRecall}`);
    noErrors(rm, `reduced motion ${L}`);
    await rm.browserContext().close();

    // ── the map's index ───────────────────────────────────────────────────
    const map = await open(width);
    await map.goto(`${BASE}/memories?map=atlas`, { waitUntil: 'networkidle0' });
    await map.waitForSelector(sel('spot-row'), { timeout: 20000 });
    const nos = await map.$$eval(`${sel('row-no')}`, (els) => els.map((e) => e.textContent));
    record(`index ${L}: rows numbered "No. 001"…`, nos.length > 0 && nos.every((t) => /^No\. \d{3}$/.test(t)), nos.slice(0, 3).join(', '));
    // the map is for any place now: no trip day strip, and the index's dates carry the year (DECISIONS 212)
    const strip = await map.$('.mr-days');
    const dated = await map.$$eval('.mr-row-sub', (els) => els.map((e) => e.textContent).filter((t) => /\b(19|20)\d\d\b/.test(t)).length);
    record(`index ${L}: no day-of-the-trip strip; rows dated with the year`, !strip && dated > 0, `${dated} dated rows`);
    // the map opens on Perth: zoom the atlas out to the world so every spot is on screen for the hover check
    for (let i = 0; i < 12; i++) await map.click(sel('zoom-out')).catch(() => {});
    await sleep(900);
    if (width >= 600) {
      // a row under the mouse marks its spot on the map
      const row = await map.$(sel('spot-row'));
      const id = await row.evaluate((r) => r.dataset.id);
      await row.hover();
      await sleep(250);
      const lifted = await map.evaluate((id) => {
        const dot = document.querySelector(`[data-mr="spot-dot"][data-id="${id}"]`);
        if (dot) return dot.hasAttribute('data-hover');
        return [...document.querySelectorAll('[data-mr="cluster"]')].some((c) => c.hasAttribute('data-hover'));
      }, id);
      record(`index ${L}: a row under the mouse marks its spot on the map`, lifted);
      // Open from the card: a view transition
      await row.click();
      await map.waitForSelector(sel('spot-open'), { timeout: 5000 });
      const v0 = await map.evaluate(() => window.__mrVT);
      await map.click(sel('spot-open'));
      const there = await map.waitForFunction(() => /^\/memories\/[0-9a-f-]{36}$/.test(location.pathname), { timeout: 8000 }).then(() => true).catch(() => false);
      const supported = await map.evaluate(() => typeof document.startViewTransition === 'function');
      record(`map ${L}: "Open" goes to the spot${supported ? ' through a view transition' : ''}`, there && (!supported || (await map.evaluate(() => window.__mrVT)) > v0));
    }
    const mo = await map.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    if (width < 600) record(`map ${L}: no sideways scroll`, mo <= 0, `${mo}px`);
    noErrors(map, `map ${L}`);
    await map.browserContext().close();
  }
} finally {
  await browser.close();
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed (${SCHEME}). Screens: ${OUT}`);
process.exit(failed.length ? 1 : 0);
