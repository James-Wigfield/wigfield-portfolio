#!/usr/bin/env node
/* Checks /memories (map + list) at 1440×900 and 390×844, light and dark, against
   the seeded dev Worker: the opening view framed on the spots, dots + clusters,
   cluster zoom (and the member list for spots that can't split at the state-level
   cap), the preview card, filters, Elsewhere, zoom buttons, labels kept inside the
   map, and zero console errors. Saves screenshots.

     node tools/memory-rooms/dev/map-check.mjs */

import { APP, DESKTOP, PHONE, api, check, launch, newPage, presetLogin, shot, sleep, watchConsole } from './lib.mjs';

const results = [];
const logs = [];
let browser = null;
let ids = {};

const count = (page, sel) => page.$$eval(sel, (els) => els.length);
const zoom = (page) => page.$eval('[data-mr="map"]', (el) => Number(el.dataset.zoom));

/** Clicks (or taps) the first element matching `sel` whose centre is inside the map; false if none. */
async function hitOnMap(page, sel, { tap = false } = {}) {
  const pt = await page.evaluate((sel) => {
    const map = document.querySelector('[data-mr="map"]').getBoundingClientRect();
    for (const el of document.querySelectorAll(sel)) {
      const r = el.getBoundingClientRect();
      const x = r.x + r.width / 2;
      const y = r.y + r.height / 2;
      if (x > map.left + 20 && x < map.right - 20 && y > map.top + 20 && y < map.bottom - 20) return { x, y };
    }
    return null;
  }, sel);
  if (!pt) return false;
  if (tap) await page.touchscreen.tap(pt.x, pt.y);
  else await page.mouse.click(pt.x, pt.y);
  return true;
}

/** How much of the map the land fills, and whether every place label sits inside it. */
const layout = (page) =>
  page.evaluate(() => {
    const svg = document.querySelector('[data-mr="map"]').getBoundingClientRect();
    const land = document.querySelector('.mr-atlas-land').getBoundingClientRect();
    const labels = Array.from(document.querySelectorAll('.mr-atlas-places text')).map((t) => t.getBoundingClientRect());
    const inside = labels.every((r) => r.left >= svg.left - 0.5 && r.right <= svg.right + 0.5 && r.top >= svg.top && r.bottom <= svg.bottom);
    return {
      fillW: Math.min(1, land.width / svg.width),
      fillH: Math.min(1, land.height / svg.height),
      labels: labels.length,
      inside,
      controlsClear: (() => {
        const ctl = document.querySelector('.mr-mapctl').getBoundingClientRect();
        return Array.from(document.querySelectorAll('[data-mr="spot-dot"] .mr-glyph, [data-mr="cluster"] .mr-cluster-disc')).every((d) => {
          const r = d.getBoundingClientRect();
          return r.right < ctl.left || r.left > ctl.right || r.bottom < ctl.top || r.top > ctl.bottom;
        });
      })(),
    };
  });

async function open(viewport, scheme, label) {
  const page = await newPage(browser);
  watchConsole(page, logs, label);
  await presetLogin(page);
  await page.setViewport(viewport);
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: scheme }]);
  await page.goto(`${APP}/memories`, { waitUntil: 'networkidle0' });
  await page.waitForSelector('[data-mr="map"]', { timeout: 15000 });
  await page.waitForSelector('[data-mr="spot-dot"], [data-mr="cluster"]', { timeout: 15000 });
  await sleep(400);
  return page;
}

async function desktop(scheme) {
  const tag = `map-1440-${scheme}`;
  const page = await open(DESKTOP, scheme, tag);
  const dots = await count(page, '[data-mr="spot-dot"]');
  const clusters = await count(page, '[data-mr="cluster"]');
  const rows = await count(page, '[data-mr="spot-row"]');
  check(results, dots + clusters > 0 && rows > 0, `${tag}: dots, clusters and rows render`, `${dots} dots, ${clusters} clusters, ${rows} rows`);
  const note = await page.$eval('[data-mr="elsewhere-note"]', (el) => el.textContent).catch(() => '');
  const elsewhereRows = await count(page, '[data-mr="elsewhere"] [data-mr="spot-row"]');
  check(results, /elsewhere/i.test(note) && elsewhereRows >= 1, `${tag}: Perth goes to Elsewhere`, `${note} · ${elsewhereRows} row(s)`);
  const l0 = await layout(page);
  check(results, l0.fillW > 0.8 && l0.controlsClear, `${tag}: opens framed on the trip, controls clear of markers`, `land ${Math.round(l0.fillW * 100)}% × ${Math.round(l0.fillH * 100)}%`);
  await shot(page, tag);

  if (scheme === 'light') {
    const z0 = await zoom(page);

    // Alberta: a cluster that splits as you zoom in
    const alberta = `[data-mr="cluster"][data-ids*="${ids.banff}"]`;
    if (await hitOnMap(page, alberta)) {
      await sleep(1300);
      const z1 = await zoom(page);
      check(results, z1 > z0 * 1.5, `${tag}: clicking the Alberta cluster zooms in`, `zoom ${z0} → ${z1}`);
      const l1 = await layout(page);
      check(results, l1.inside, `${tag}: place labels stay inside the map`, `${l1.labels} labels`);
      await shot(page, `${tag}-cluster-zoomed`);
      await page.click('[data-mr="zoom-reset"]');
      await sleep(1300);
    }

    // New York: spots under a kilometre apart never split at the state-level cap → member list
    await hitOnMap(page, `[data-mr="cluster"][data-ids*="${ids.hostel}"]`);
    await sleep(900);
    const list = await page.$$eval('[data-mr="cluster-card"] .mr-card-member', (els) => els.length).catch(() => 0);
    check(results, list >= 2 && (await zoom(page)) <= 16.01, `${tag}: a cluster that can't split lists its members`, `${list} members, zoom ${await zoom(page)}`);
    await shot(page, `${tag}-cluster-split`);
    await page.click('[data-mr="cluster-card"] .mr-card-close');

    // a dot → card beside it
    await hitOnMap(page, '[data-mr="spot-dot"][data-status="rendered"]');
    await page.waitForSelector('[data-mr="spot-card"]', { timeout: 5000 });
    const card = await page.$eval('[data-mr="spot-card"]', (el) => {
      const r = el.getBoundingClientRect();
      const link = el.querySelector('a[href*="/memories/"]');
      return { w: r.width, h: r.height, href: link?.getAttribute('href'), img: Boolean(el.querySelector('img')) };
    });
    check(results, card.w > 200 && card.h < 420 && card.href && card.img, `${tag}: preview card with image + Open link`, `${card.href} ${Math.round(card.h)}px tall`);
    await shot(page, `${tag}-card`);

    // zoom buttons, the cap, reset
    const zb = await zoom(page);
    await page.click('[data-mr="zoom-out"]');
    await sleep(900);
    check(results, (await zoom(page)) < zb, `${tag}: zoom out button`, `${zb} → ${await zoom(page)}`);
    await page.click('[data-mr="zoom-reset"]');
    await sleep(1300);
    check(results, Math.abs((await zoom(page)) - z0) < 0.01, `${tag}: show-everything returns to the opening view`, `${await zoom(page)}`);
    for (let i = 0; i < 6; i++) {
      await page.click('[data-mr="zoom-in"]').catch(() => {});
      await sleep(700);
    }
    check(results, (await zoom(page)) <= 16.01 && (await zoom(page)) > 8, `${tag}: zoom in stops at state level`, `${await zoom(page)}`);
    await page.click('[data-mr="zoom-reset"]');
    await sleep(1300);

    // wheel zoom
    const mapBox = await (await page.$('[data-mr="map"]')).boundingBox();
    await page.mouse.move(mapBox.x + mapBox.width * 0.7, mapBox.y + mapBox.height * 0.6);
    await page.mouse.wheel({ deltaY: -400 });
    await sleep(200);
    check(results, (await zoom(page)) > z0 * 1.5, `${tag}: wheel zooms`, `${await zoom(page)}`);
    await page.click('[data-mr="zoom-reset"]');
    await sleep(1300);

    // filters
    await page.click('[data-mr="filter-person"][data-value="justin"]');
    await sleep(200);
    const justinRows = await page.$$eval('[data-mr="spot-row"]', (els) => els.map((e) => e.textContent));
    check(results, justinRows.length > 0 && justinRows.every((t) => /Justin/.test(t)), `${tag}: person filter`, `${justinRows.length} rows`);
    await page.click('[data-mr="filter-status"][data-value="modelling"]');
    await sleep(300);
    const modelRows = await page.$$eval('[data-mr="spot-row"]', (els) => els.length);
    const modelDots = await page.$$eval('[data-mr="spot-dot"]', (els) => els.every((e) => e.dataset.status === 'modelling'));
    check(results, modelRows >= 1 && modelDots, `${tag}: status filter applies to list and map`, `${modelRows} rows`);
    await shot(page, `${tag}-filtered`);
    await page.click('[data-mr="filter-person"][data-value="all"]');
    await page.click('[data-mr="filter-status"][data-value="all"]');
    await sleep(300);

    // row → its dot highlights (revealed out of its cluster)
    await page.click(`[data-mr="spot-row"][data-id="${ids.calgary}"]`);
    await sleep(1600);
    const sel = await page.$(`[data-mr="spot-dot"][data-id="${ids.calgary}"][data-selected]`);
    check(results, Boolean(sel), `${tag}: selecting a row highlights its dot (out of its cluster)`);
    await shot(page, `${tag}-row-selected`);
  }
  await page.close();
}

async function phone(scheme) {
  const tag = `map-390-${scheme}`;
  const page = await open(PHONE, scheme, tag);
  await shot(page, tag);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth || document.documentElement.scrollHeight > window.innerHeight + 1);
  check(results, !overflow, `${tag}: no page scroll`);
  const l = await layout(page);
  const rowsVisible = await page.$$eval('[data-mr="spot-row"]', (els) => els.filter((e) => e.getBoundingClientRect().top < innerHeight).length);
  check(
    results,
    l.fillW > 0.85 && l.fillH > 0.5 && l.controlsClear && rowsVisible >= 3,
    `${tag}: map fills its area, controls clear of markers, list visible below`,
    `land ${Math.round(l.fillW * 100)}% × ${Math.round(l.fillH * 100)}%, ${rowsVisible} rows on screen`,
  );

  if (scheme === 'light') {
    await hitOnMap(page, '[data-mr="spot-dot"][data-status="rendered"]', { tap: true });
    await page.waitForSelector('[data-mr="spot-card"]', { timeout: 5000 });
    await sleep(600);
    await shot(page, `${tag}-card`);
    await page.tap('[data-mr="spot-card"] .mr-card-close');
    const z0 = await zoom(page);
    if (await hitOnMap(page, `[data-mr="cluster"][data-ids*="${ids.banff}"]`, { tap: true })) {
      await sleep(1300);
      const z1 = await zoom(page);
      const l1 = await layout(page);
      check(results, z1 > z0 && l1.inside, `${tag}: tapping a cluster zooms in, labels stay inside`, `zoom ${z0} → ${z1}, ${l1.labels} labels`);
      await shot(page, `${tag}-cluster-zoomed`);
      await page.tap('[data-mr="zoom-reset"]');
      await sleep(1300);
    }
    await page.tap(`[data-mr="spot-row"][data-id="${ids.frenchmen}"]`);
    await page.waitForSelector('[data-mr="spot-card"]', { visible: true, timeout: 5000 });
    await sleep(1400);
    const highlighted = await page.$(`[data-mr="spot-dot"][data-id="${ids.frenchmen}"][data-selected]`);
    check(results, Boolean(highlighted), `${tag}: a list row highlights its dot and opens its card`);
    await shot(page, `${tag}-row-card`);
  }
  await page.close();
}

try {
  const all = (await api('/spots')).data || [];
  const idOf = (title) => all.find((s) => s.title === title)?.id || 'missing';
  ids = { banff: idOf('Banff cabin'), hostel: idOf('Hostel common room'), calgary: idOf('Calgary bar'), frenchmen: idOf('Frenchmen Street') };
  browser = await launch();
  await desktop('light');
  await desktop('dark');
  await phone('light');
  await phone('dark');
  await browser.close();
} catch (err) {
  console.error(err);
  check(results, false, 'script ran to the end', err.message);
} finally {
  await browser?.close().catch(() => {});
  console.log(`\nconsole: ${logs.length ? logs.join('\n') : 'clean'}`);
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed`);
  process.exitCode = failed || logs.length ? 1 : 0;
}
