/* ============================================================================
   DISSERTATION · RED PEN — headless browser check of the portal page
   (puppeteer-core + Edge, like tools/rsvp/reader-check.mjs)
   ----------------------------------------------------------------------------
   Runs against the dev server, which is the only thing that serves the data:

     npx vite --port 5199 --strictPort
     node tools/dissertation-diff/page-check.mjs

   Checks that the page gets past the gate, both columns render real page
   images with the markup, "Next" walks the changes and the original column
   follows, the section menu jumps both columns, the single-column views and
   the dark arcade theme work, and nothing logs a console error. For a
   proposal build (manifest with tags): the margin tags sit right of the text
   on their pages, a click flags one, "Copy IDs" copies the flagged list and a
   title in the ID list jumps to its tag.
   DDF_SHOTS=<dir> writes screenshots there.
   ========================================================================== */
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const BASE = process.env.SITE_URL || 'http://127.0.0.1:5199';
const SHOTS = process.env.DDF_SHOTS || '';
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });

const fails = [];
const ok = (cond, label, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${extra !== '' ? '  — ' + extra : ''}`);
  if (!cond) fails.push(label);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = (page, name, opts = {}) =>
  (SHOTS ? page.screenshot({ path: path.join(SHOTS, `${name}.png`), ...opts }) : Promise.resolve());

// Every <img> in a column that is meant to be live has decoded.
async function loaded(page, side) {
  return page.$$eval(`.ddf-col--${side} .ddf-page img`, (imgs) =>
    imgs.map((i) => ({ done: i.complete, w: i.naturalWidth })));
}
async function waitLoaded(page, side, timeout = 20000) {
  const t0 = Date.now();
  for (;;) {
    const imgs = await loaded(page, side);
    if (imgs.length && imgs.every((i) => i.done && i.w > 0)) return imgs.length;
    if (Date.now() - t0 > timeout) return -imgs.length;
    await sleep(150);
  }
}
const scrollTop = (page, side) => page.$eval(`.ddf-col--${side} .ddf-scroll`, (el) => el.scrollTop);

const browser = await puppeteer.launch({ executablePath: EDGE, headless: 'new', args: ['--hide-scrollbars'] });
const errors = [];
try {
  const page = await browser.newPage();
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.setViewport({ width: 1680, height: 1000, deviceScaleFactor: 1 });
  await page.evaluateOnNewDocument(() => {
    sessionStorage.setItem('portal_auth', JSON.stringify({ token: 'mock-session-token', key: 'wiggy1', issued_at: new Date().toISOString() }));
    localStorage.removeItem('portal:dissertationDiff');
    localStorage.removeItem('portal:dissertationDiff:flags');
  });
  await browser.defaultBrowserContext().overridePermissions(BASE, ['clipboard-read', 'clipboard-write', 'clipboard-sanitized-write']);

  await page.goto(`${BASE}/portal/dissertation-red-pen`, { waitUntil: 'networkidle0' });
  await page.waitForSelector('.ddf-col--edited .ddf-page img', { timeout: 20000 });
  ok(await page.$eval('.portal__topbar-title', (el) => el.textContent.includes('Dissertation')), 'the deep link opens the tool behind the gate');
  ok(await page.$('.portal__nav-item[aria-current="page"]').then(Boolean), 'the tool is selected in the University section');

  const nO = await waitLoaded(page, 'original');
  const nE = await waitLoaded(page, 'edited');
  ok(nO > 0 && nE > 0, 'both columns show decoded page images', `original ${nO}, edited ${nE}`);
  const boxes = await page.$$eval('.ddf-col', (cols) => cols.map((c) => c.getBoundingClientRect().toJSON()));
  ok(boxes.length === 2 && boxes[0].width > 500 && boxes[1].width > 500 && Math.abs(boxes[0].top - boxes[1].top) < 2,
    'two columns side by side', boxes.map((b) => Math.round(b.width)).join(' + '));
  const counts = await page.$$eval('.ddf-col', (cols) => cols.map((c) => c.querySelectorAll('.ddf-page').length));
  const man = await page.evaluate(() => fetch('/__dissertation-diff/manifest.json').then((r) => r.json()));
  ok(counts[0] === man.original.pages.length && counts[1] === man.edited.pages.length, 'one slot per PDF page', counts.join(' / '));
  ok(await page.$eval('.ddf-stats', (el) => el.textContent.includes('both readings match')), 'the header reports the check as passed');
  const svgType = await page.evaluate(() => fetch('/__dissertation-diff/edited/page-001.svg').then((r) => r.headers.get('content-type')));
  ok(svgType === 'image/svg+xml', 'page renders are served as SVG by the dev server', svgType);
  // (from Node, so the expected 404 does not land in the page's console)
  const hidden = await fetch(`${BASE}/__dissertation-diff/.work/diff/main.tex`).then((r) => r.status);
  ok(hidden === 404, 'build scratch is not served', String(hidden));
  ok(await scrollTop(page, 'original') === 0 && await scrollTop(page, 'edited') === 0, 'both columns start level at the top');
  await shot(page, '01-overview');

  // Walk the changes: the counter moves, the edited column scrolls and the original follows.
  const before = { e: await scrollTop(page, 'edited'), o: await scrollTop(page, 'original') };
  // (clicked through the DOM: the first Next scrolls the page itself, so a mouse
  // click at fixed coordinates would miss the moving button)
  for (let i = 0; i < 12; i++) {
    await page.$eval('button[title^="Next change"]', (b) => b.click());
    await sleep(120);
  }
  // let the smooth scroll settle
  for (let last = -1, now = await scrollTop(page, 'edited'); now !== last; await sleep(250)) {
    last = now;
    now = await scrollTop(page, 'edited');
  }
  await sleep(300);
  const after = { e: await scrollTop(page, 'edited'), o: await scrollTop(page, 'original') };
  const counter = await page.$eval('.ddf-seg__count', (el) => el.textContent);
  ok(after.e > before.e + 500, 'Next scrolls the edited column', `${before.e} -> ${Math.round(after.e)}`);
  ok(after.o > before.o + 300, 'the original column follows with sync on', `${before.o} -> ${Math.round(after.o)}`);
  ok(/^\d+ \/ \d+$/.test(counter) && Number(counter.split(' / ')[0]) === 12, 'twelve quick Nexts walk twelve changes', counter);
  const viewerTop = await page.$eval('.ddf-viewer', (el) => el.getBoundingClientRect().top);
  ok(viewerTop < 200, 'the viewer comes up under the top bar on Next', String(Math.round(viewerTop)));
  await waitLoaded(page, 'edited');
  await waitLoaded(page, 'original');
  ok(await page.$$eval('.ddf-cbar', (b) => b.length) > 0, 'change bars are drawn beside the edited pages');
  await shot(page, '02-after-next');

  // Section menu: Chapter 4 in both columns.
  const ch4 = man.sections.findIndex((s) => s.level === 'chapter' && s.number === '4');
  await page.select('.ddf-pick select', String(ch4));
  await sleep(700);
  await waitLoaded(page, 'edited');
  await waitLoaded(page, 'original');
  const tops = await page.$$eval('.ddf-col', (cols) => cols.map((c) => {
    const sc = c.querySelector('.ddf-scroll');
    const pages = [...c.querySelectorAll('.ddf-page')];
    const i = pages.findIndex((p) => p.offsetTop + p.offsetHeight > sc.scrollTop + 20);
    return i + 1;
  }));
  ok(tops[0] === man.sections[ch4].original.page && tops[1] === man.sections[ch4].edited.page,
    'Go to Chapter 4 lands both columns on its first page', `${tops[0]} / ${tops[1]}`);
  await shot(page, '03-chapter-4');

  // A close look at the markup: 2x pixels on part of an edited page.
  await page.setViewport({ width: 1680, height: 1000, deviceScaleFactor: 2 });
  await sleep(500);
  await waitLoaded(page, 'edited');
  const r = await page.$eval('.ddf-col--edited .ddf-scroll', (el) => el.getBoundingClientRect().toJSON());
  await shot(page, '04-markup-close', { clip: { x: r.x, y: r.y, width: r.width, height: Math.min(r.height, 700) } });
  await page.setViewport({ width: 1680, height: 1000, deviceScaleFactor: 1 });

  // Change tags (a proposal build only).
  if (man.tags) {
    const nTags = await page.$$eval('.ddf-tag--page', (t) => t.length);
    ok(nTags === man.tags.placed.length, 'one margin tag per placed change ID', `${nTags} / ${man.tags.placed.length}`);
    // Tags in view sit in the right margin of the page they are on.
    const where = await page.$eval('.ddf-col--edited', (c) => {
      const pages = [...c.querySelectorAll('.ddf-page')].map((p) => p.getBoundingClientRect());
      const view = c.querySelector('.ddf-scroll').getBoundingClientRect();
      return [...c.querySelectorAll('.ddf-tag--page')].map((t) => t.getBoundingClientRect())
        .filter((r) => r.top > view.top && r.bottom < view.bottom)
        .map((r) => {
          const p = pages.find((q) => r.top + r.height / 2 >= q.top && r.top + r.height / 2 <= q.bottom);
          return p ? [(r.left - p.left) / p.width, (r.right - p.left) / p.width] : null;
        });
    });
    ok(where.length > 0 && where.every((w) => w && w[0] > man.tags.text[1] && w[1] < 1.02),
      'tags in view sit in the right margin of their page', where.slice(0, 4).map((w) => w && w.map((x) => x.toFixed(2)).join('-')).join(', '));
    const first = await page.$eval('.ddf-tag--page', (t) => t.textContent.trim());
    await page.$eval('.ddf-tag--page', (t) => t.click());
    await sleep(200);
    const flagged = await page.$$eval('.ddf-tag--page.is-flagged', (t) => t.map((x) => x.textContent.trim()));
    ok(flagged.length > 0 && flagged.every((x) => x.endsWith(first)), 'a click flags that ID wherever it is tagged', `${first}: ${flagged.length}`);
    ok(await page.$eval('.ddf-stats', (el) => el.textContent.includes('1 flagged')), 'the header counts the flag');
    ok(await page.$eval('.ddf-card--ids', (el) => el.textContent.includes('Flagged (1)')), 'the ID list shows the flag');
    await page.$$eval('.ddf-seg button', (bs) => bs.find((b) => b.textContent === 'Copy IDs').click());
    await sleep(300);
    const clip = await page.evaluate(() => navigator.clipboard.readText().catch((e) => `error: ${e.message}`));
    ok(clip.includes(first), '"Copy IDs" copies the flagged list', clip);
    await shot(page, '04b-tag-flagged');
    await page.$eval('.ddf-tag--page.is-flagged', (t) => t.click());
    await sleep(200);
    ok(await page.$$eval('.ddf-tag--page.is-flagged', (t) => t.length) === 0, 'a second click unflags it');
    // A title in the ID list brings its tag into view.
    const target = man.tags.placed[man.tags.placed.length - 1].id;
    await page.$$eval('.ddf-idgroup', (g) => g.forEach((d) => { d.open = true; }));
    await page.$$eval('.ddf-card--ids li', (lis, id) => {
      const li = lis.find((l) => l.querySelector('.ddf-tag')?.textContent.trim() === id);
      li.querySelector('.ddf-idlink').click();
    }, target);
    for (let last = -1, now = await scrollTop(page, 'edited'); now !== last; await sleep(250)) {
      last = now;
      now = await scrollTop(page, 'edited');
    }
    const seen = await page.$eval('.ddf-col--edited', (c, id) => {
      const view = c.querySelector('.ddf-scroll').getBoundingClientRect();
      return [...c.querySelectorAll('.ddf-tag--page')].some((t) => {
        const r = t.getBoundingClientRect();
        return t.textContent.trim() === id && r.top > view.top && r.bottom < view.bottom;
      });
    }, target);
    ok(seen, 'a title in the ID list jumps to its tag', target);
    await waitLoaded(page, 'edited');
    await shot(page, '04c-tag-jump');
    // back to Chapter 4 for the view checks below
    await page.select('.ddf-pick select', String(ch4));
    await sleep(700);
  }

  // Single column views.
  for (const v of ['Edited', 'Original']) {
    await page.$$eval('.ddf-seg button', (bs, label) => bs.find((b) => b.textContent === label).click(), v);
    await sleep(500);
    const cols = await page.$$eval('.ddf-col', (c) => c.map((x) => x.className));
    ok(cols.length === 1 && cols[0].includes(v === 'Edited' ? 'edited' : 'original'), `the ${v.toLowerCase()}-only view shows one column`);
  }
  await page.$$eval('.ddf-seg button', (bs) => bs.find((b) => b.textContent === 'Side by side').click());
  await sleep(300);

  const backTo = await page.$$eval('.ddf-col', (cols) => cols.map((c) => {
    const sc = c.querySelector('.ddf-scroll');
    return [...c.querySelectorAll('.ddf-page')].findIndex((p) => p.offsetTop + p.offsetHeight > sc.scrollTop + 20) + 1;
  }));
  ok(backTo[1] === tops[1], 'switching views keeps the place', `${tops[1]} -> ${backTo[1]}`);

  // Zoom keeps both columns, keeps the place and lets the pages scroll sideways.
  await page.$$eval('.ddf-seg button', (bs) => bs.find((b) => b.textContent === '150%').click());
  await sleep(600);
  const wide = await page.$$eval('.ddf-scroll', (s) => s.map((x) => x.scrollWidth > x.clientWidth));
  ok(wide.length === 2 && wide.every(Boolean), 'zoom 150% widens the pages past the columns');
  const zoomed = await page.$eval('.ddf-col--edited', (c) => {
    const sc = c.querySelector('.ddf-scroll');
    return [...c.querySelectorAll('.ddf-page')].findIndex((p) => p.offsetTop + p.offsetHeight > sc.scrollTop + 20) + 1;
  });
  ok(zoomed === tops[1], 'zooming keeps the page in view', `${tops[1]} -> ${zoomed}`);
  await waitLoaded(page, 'edited');
  await shot(page, '06-zoom-150');
  await page.$$eval('.ddf-seg button', (bs) => bs.find((b) => b.textContent === 'Fit').click());

  // Dark theme: the chrome follows the theme, the paper stays white.
  await page.click('button[aria-label="Arcade theme"]').catch(() => {});
  await sleep(500);
  const paper = await page.$eval('.ddf-page', (el) => getComputedStyle(el).backgroundColor);
  ok(paper === 'rgb(255, 255, 255)', 'pages stay white under the arcade theme', paper);
  await shot(page, '05-arcade');

  ok(errors.length === 0, 'no console errors', errors.slice(0, 3).join(' | '));
} finally {
  await browser.close();
}
console.log(fails.length ? `\n${fails.length} check(s) failed` : '\nall checks passed');
process.exit(fails.length ? 1 : 0);
