/* ============================================================================
   MEMORY ROOMS · PLAN — headless check of /portal/memory-rooms-plan
   (puppeteer-core + local Edge, seeded through the portal gate)
   ----------------------------------------------------------------------------
     npx vite --port 5187 --strictPort      (in another terminal)
     node tools/memory-rooms-plan/page-check.mjs [outDir]
     SITE_URL=http://localhost:5173 node tools/memory-rooms-plan/page-check.mjs

   Checks: every tab renders with its hook; the prompt drawer opens; Copy puts
   the exact build-prompt.md text on the clipboard; the live diorama paints
   non-blank pixels; no horizontal page scroll at 390 px; no tone-coloured
   left-border callouts; zero console errors/warnings; screenshots of every
   tab in 3 themes × 1440/390.
   ========================================================================== */
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const BASE = process.env.SITE_URL || 'http://localhost:5187';
const ROUTE = '/portal/memory-rooms-plan';
const OUT = path.resolve(process.argv[2] || path.join(HERE, 'out'));
fs.mkdirSync(OUT, { recursive: true });

const PROMPT = fs.readFileSync(path.join(REPO, 'src/components/portal/modules/memory-rooms-plan/build-prompt.md'), 'utf8').replace(/\r\n/g, '\n');
const TABS = ['verdict', 'capture', 'framework', 'render', 'house', 'roadmap'];
const THEMES = ['jade', 'coral', 'arcade'];

const fails = [];
const ok = (cond, label, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${extra !== '' ? `  — ${extra}` : ''}`);
  if (!cond) fails.push(label);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: 'new',
  args: ['--use-angle=d3d11', '--enable-unsafe-swiftshader', '--window-size=1440,1000'],
});
const ctx = browser.defaultBrowserContext();
await ctx.overridePermissions(BASE, ['clipboard-read', 'clipboard-write', 'clipboard-sanitized-write']);

const consoleIssues = [];
async function open(theme, width) {
  const page = await browser.newPage();
  page.on('console', (m) => {
    const t = m.type();
    if (t === 'error' || t === 'warn' || t === 'warning') {
      const text = m.text();
      // three.js dev builds log nothing by default; vite HMR noise is filtered
      if (!/\[vite\]|Download the React DevTools/.test(text)) consoleIssues.push(`${theme}@${width}: ${text}`);
    }
  });
  page.on('pageerror', (e) => consoleIssues.push(`${theme}@${width}: pageerror ${e.message}`));
  await page.evaluateOnNewDocument((th) => {
    sessionStorage.setItem('portal_auth', JSON.stringify({ token: 'mock-session-token', key: 'wiggy1', issued_at: new Date().toISOString() }));
    localStorage.setItem('portal:theme', th);
  }, theme);
  await page.setViewport({ width, height: width < 600 ? 860 : 1000, deviceScaleFactor: 1 });
  return page;
}

// ── functional run (jade, 1440) ────────────────────────────────────────────
{
  const page = await open('jade', 1440);
  await page.goto(BASE + ROUTE, { waitUntil: 'networkidle0' });
  await page.waitForSelector('.mrp-tabs');

  for (const id of TABS) {
    await page.click(`#mrp-tab-${id}`);
    await page.waitForFunction((n) => document.querySelector('.mrp-head__n')?.textContent === n, { timeout: 5000 }, String(TABS.indexOf(id) + 1).padStart(2, '0')).catch(() => {});
    const hook = await page.$eval('.mrp-head__hook', (el) => el.textContent.trim()).catch(() => '');
    const url = await page.evaluate(() => location.pathname);
    ok(hook.length > 10, `tab ${id} renders a hook`, hook.slice(0, 60));
    ok(id === 'verdict' ? url === ROUTE : url === `${ROUTE}/${id}`, `tab ${id} deep link`, url);
  }

  // deep link straight to a tab
  await page.goto(`${BASE}${ROUTE}/house`, { waitUntil: 'networkidle0' });
  ok(await page.$eval('[aria-selected="true"]', (el) => el.id) === 'mrp-tab-house', 'deep link /house selects the tab');

  // prompt drawer + copy
  ok(await page.$eval('#mrp-prompt-body', (el) => el.hidden), 'prompt drawer starts closed');
  await page.click('.mrp-copy');
  await sleep(250);
  // the Windows clipboard turns LF into CRLF on read, so compare normalised text
  const norm = (t) => t.replace(/\r\n/g, '\n');
  let clip = norm(await page.evaluate(() => navigator.clipboard.readText()));
  ok(clip === PROMPT, 'Copy (collapsed) puts the exact prompt on the clipboard', `${clip.length}/${PROMPT.length} chars`);
  ok((await page.$eval('.mrp-copy', (el) => el.textContent)).includes('Copied'), 'Copy button confirms');
  await page.evaluate(() => navigator.clipboard.writeText(''));
  await page.click('.mrp-prompt__toggle');
  await sleep(200);
  ok(!(await page.$eval('#mrp-prompt-body', (el) => el.hidden)), 'prompt drawer opens');
  const lines = await page.$$eval('.mrp-editor__line', (els) => els.length);
  ok(lines === PROMPT.split('\n').length, 'editor shows every prompt line', `${lines}`);
  await page.click('.mrp-editor__copy');
  await sleep(250);
  clip = norm(await page.evaluate(() => navigator.clipboard.readText()));
  ok(clip === PROMPT, 'Copy (in editor) puts the exact prompt on the clipboard');
  await page.screenshot({ path: path.join(OUT, 'prompt-open-1440.png') });
  await page.click('.mrp-prompt__toggle');

  // the Render loop tab opens on the Blender test render, which must load
  const seg = (label) => page.evaluate((l) => [...document.querySelectorAll('.mrp-seg button')].find((b) => b.textContent === l)?.click(), label);
  await page.click('#mrp-tab-render');
  await page.waitForSelector('.mrp-dio__img');
  await page.waitForFunction(() => document.querySelector('.mrp-dio__img')?.complete, { timeout: 8000 }).catch(() => {});
  const img = await page.$eval('.mrp-dio__img', (el) => el.naturalWidth);
  ok(img === 800, 'Blender test render loads by default', img);

  // live layout preview paints
  await seg('Layout preview');
  await page.waitForSelector('.mrp-dio[data-state="ready"]', { timeout: 15000 }).catch(() => {});
  await sleep(1200);
  const paint = await page.evaluate(() => {
    const c = document.querySelector('.mrp-dio canvas');
    if (!c) return { ok: false, why: 'no canvas' };
    const g = document.createElement('canvas');
    g.width = 64; g.height = 48;
    const x = g.getContext('2d');
    x.drawImage(c, 0, 0, 64, 48);
    const d = x.getImageData(0, 0, 64, 48).data;
    let opaque = 0;
    const colours = new Set();
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] > 10) { opaque++; colours.add(`${d[i] >> 4},${d[i + 1] >> 4},${d[i + 2] >> 4}`); }
    }
    return { ok: opaque > 400 && colours.size > 20, opaque, colours: colours.size };
  });
  ok(paint.ok, 'live diorama paints a coloured room', JSON.stringify(paint));
  // clicking a loop step pins it, and the highlight matches the caption
  await page.click('.mrp-loop__node:nth-of-type(4)');
  await sleep(2500);
  const loop = await page.evaluate(() => ({
    on: [...document.querySelectorAll('.mrp-loop__node')].findIndex((n) => n.dataset.on === 'true'),
    cap: document.querySelector('.mrp-detail--loop .mrp-dot').textContent,
  }));
  ok(loop.cap.startsWith(String(loop.on + 1).padStart(2, '0')), 'loop highlight matches its caption and stays pinned', JSON.stringify(loop));
  await seg('scene.json');
  ok((await page.$eval('.mrp-json', (el) => el.textContent)).includes('"kit": "bed"'), 'scene.json view shows the spec');

  // no tone-coloured left-border callouts in the module
  const callouts = await page.evaluate(() => [...document.querySelectorAll('.mrp *')].filter((el) => {
    const s = getComputedStyle(el);
    return parseFloat(s.borderLeftWidth) >= 2 && s.borderLeftStyle !== 'none' && parseFloat(s.borderRightWidth) === 0;
  }).length);
  ok(callouts === 0, 'no left-border callout boxes', callouts);
  await page.close();
}

// ── screenshots: 3 themes × 1440/390, every tab ────────────────────────────
for (const theme of THEMES) {
  for (const width of [1440, 390]) {
    const page = await open(theme, width);
    for (const id of TABS) {
      await page.goto(`${BASE}${ROUTE}${id === 'verdict' ? '' : `/${id}`}`, { waitUntil: 'networkidle0' });
      await page.waitForSelector('.mrp-head__hook');
      if (id === 'render') { await page.waitForFunction(() => document.querySelector('.mrp-dio__img')?.complete, { timeout: 8000 }).catch(() => {}); await sleep(500); }
      else await sleep(400);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      if (width === 390) ok(overflow <= 1, `${theme} ${id} @390 no horizontal scroll`, overflow);
      const el = await page.$('.mrp');
      await el.screenshot({ path: path.join(OUT, `${theme}-${id}-${width}.png`) });
    }
    await page.close();
  }
}

ok(consoleIssues.length === 0, 'zero console errors / warnings', consoleIssues.slice(0, 5).join(' | '));
await browser.close();
console.log(fails.length ? `\n${fails.length} FAILED` : '\nALL PASS');
process.exit(fails.length ? 1 : 0);
