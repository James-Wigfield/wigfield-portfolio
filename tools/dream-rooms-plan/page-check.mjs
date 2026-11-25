/* ============================================================================
   DREAM ROOMS · PLAN — headless check of /portal/dream-rooms-plan
   (puppeteer-core + local Edge, seeded through the portal gate)
   ----------------------------------------------------------------------------
     npx vite --port 5193 --strictPort      (in another terminal)
     node tools/dream-rooms-plan/page-check.mjs [outDir]
     SITE_URL=http://localhost:5173 node tools/dream-rooms-plan/page-check.mjs

   Checks: every tab renders with its hook and deep link; the prompt drawer
   opens; Copy puts the exact build-prompt.md text on the clipboard; the sample
   dream's highlighted spans rebuild the exact text and each opens its entry;
   the Blender stills load; the live sketch paints non-blank pixels, reports a
   frame rate and loops (a new fragment appears); no horizontal page scroll at
   390 px; no left-border callouts; zero console errors/warnings; screenshots
   of every tab in 3 themes × 1440/390.
   ========================================================================== */
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const MOD = path.join(REPO, 'src/components/portal/modules/dream-rooms-plan');
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const BASE = process.env.SITE_URL || 'http://localhost:5193';
const ROUTE = '/portal/dream-rooms-plan';
const OUT = path.resolve(process.argv[2] || path.join(HERE, 'out', 'shots'));
fs.mkdirSync(OUT, { recursive: true });

const PROMPT = fs.readFileSync(path.join(MOD, 'build-prompt.md'), 'utf8').replace(/\r\n/g, '\n');
const { TABS: TAB_DEFS, SAMPLE_DREAM, FRAGMENTS } = await import(pathToFileURL(path.join(MOD, 'content.js')).href);
const TABS = TAB_DEFS.map((t) => t.id);
const THEMES = ['jade', 'coral', 'arcade'];

const fails = [];
const ok = (cond, label, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${extra !== '' ? `  — ${extra}` : ''}`);
  if (!cond) fails.push(label);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// the spans in content.js must point at real words (they're quoted in the prompt too)
{
  const bad = FRAGMENTS.filter((f) => !(f.span[0] >= 0 && f.span[1] <= SAMPLE_DREAM.length && f.span[0] < f.span[1]));
  ok(bad.length === 0, 'every fragment span sits inside the sample dream', bad.map((b) => b.id).join(','));
  const sorted = [...FRAGMENTS].sort((a, b) => a.span[0] - b.span[0]);
  const overlap = sorted.some((f, i) => i && f.span[0] < sorted[i - 1].span[1]);
  ok(!overlap, 'fragment spans do not overlap');
  // the prompt's sample dream.json quotes the sample dream: every quote must be found word for word
  const quotes = [...PROMPT.matchAll(/"quote": \[([^\]]*)\]/g)].flatMap((m) => [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]));
  const missing = quotes.filter((q) => !SAMPLE_DREAM.includes(q));
  ok(quotes.length > 15 && missing.length === 0, 'every quote in build-prompt.md is found in the sample dream', missing.length ? missing.join(' | ') : `${quotes.length} quotes`);
}

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: 'new',
  args: ['--use-angle=d3d11', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required', '--window-size=1440,1000'],
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

async function canvasPaint(page) {
  return page.evaluate(() => {
    const c = document.querySelector('.drp-sketch canvas');
    if (!c) return { ok: false, why: 'no canvas' };
    const g = document.createElement('canvas');
    g.width = 64; g.height = 40;
    const x = g.getContext('2d');
    x.drawImage(c, 0, 0, 64, 40);
    const d = x.getImageData(0, 0, 64, 40).data;
    let lit = 0;
    const colours = new Set();
    for (let i = 0; i < d.length; i += 4) {
      if (d[i] + d[i + 1] + d[i + 2] > 60) lit++;
      colours.add(`${d[i] >> 3},${d[i + 1] >> 3},${d[i + 2] >> 3}`);
    }
    return { ok: lit > 1500 && colours.size > 40, lit, colours: colours.size };
  });
}

// ── functional run (jade, 1440) ────────────────────────────────────────────
{
  const page = await open('jade', 1440);
  await page.goto(BASE + ROUTE, { waitUntil: 'networkidle0' });
  await page.waitForSelector('.drp-tabs');

  for (const id of TABS) {
    await page.click(`#drp-tab-${id}`);
    await page.waitForFunction((n) => document.querySelector('.drp-head__n')?.textContent === n, { timeout: 5000 }, String(TABS.indexOf(id) + 1).padStart(2, '0')).catch(() => {});
    const hook = await page.$eval('.drp-head__hook', (el) => el.textContent.trim()).catch(() => '');
    const url = await page.evaluate(() => location.pathname);
    ok(hook.length > 10, `tab ${id} renders a hook`, hook.slice(0, 60));
    ok(id === 'verdict' ? url === ROUTE : url === `${ROUTE}/${id}`, `tab ${id} deep link`, url);
  }

  // deep link straight to a tab
  await page.goto(`${BASE}${ROUTE}/privacy`, { waitUntil: 'networkidle0' });
  ok(await page.$eval('[aria-selected="true"]', (el) => el.id) === 'drp-tab-privacy', 'deep link /privacy selects the tab');
  await page.evaluate(() => [...document.querySelectorAll('.drp-seg button')].find((b) => b.textContent.includes('archive'))?.click());
  await sleep(200);
  ok(await page.$$eval('.drp-arch__dream', (els) => els.length) === 5, 'archive view draws its five dreams');

  // prompt drawer + copy
  ok(await page.$eval('#drp-prompt-body', (el) => el.hidden), 'prompt drawer starts closed');
  await page.click('.drp-copy');
  await sleep(250);
  const norm = (t) => t.replace(/\r\n/g, '\n');
  let clip = norm(await page.evaluate(() => navigator.clipboard.readText()));
  ok(clip === PROMPT, 'Copy (collapsed) puts the exact prompt on the clipboard', `${clip.length}/${PROMPT.length} chars`);
  ok((await page.$eval('.drp-copy', (el) => el.textContent)).includes('Copied'), 'Copy button confirms');
  await page.evaluate(() => navigator.clipboard.writeText(''));
  await page.click('.drp-prompt__toggle');
  await sleep(200);
  ok(!(await page.$eval('#drp-prompt-body', (el) => el.hidden)), 'prompt drawer opens');
  const lines = await page.$$eval('.drp-editor__line', (els) => els.length);
  ok(lines === PROMPT.split('\n').length, 'editor shows every prompt line', `${lines}`);
  await page.click('.drp-editor__copy');
  await sleep(250);
  clip = norm(await page.evaluate(() => navigator.clipboard.readText()));
  ok(clip === PROMPT, 'Copy (in editor) puts the exact prompt on the clipboard');
  await page.screenshot({ path: path.join(OUT, 'prompt-open-1440.png') });
  await page.click('.drp-prompt__toggle');

  // dream scene: the highlighted text rebuilds the sample exactly; each fragment opens its entry
  await page.click('#drp-tab-scene');
  await page.waitForSelector('.drp-dream');
  const dreamText = await page.$eval('.drp-dream', (el) => el.textContent);
  ok(dreamText === SAMPLE_DREAM, 'sample dream renders word for word');
  const fragCount = await page.$$eval('.drp-frag', (els) => els.length);
  ok(fragCount === FRAGMENTS.length, 'every fragment is highlighted', fragCount);
  let allOpen = true;
  for (let i = 0; i < fragCount; i++) {
    const r = await page.evaluate((n) => {
      const b = document.querySelectorAll('.drp-frag')[n];
      b.click();
      return new Promise((res) => requestAnimationFrame(() => res({ pressed: b.getAttribute('aria-pressed'), code: document.querySelector('.drp-code__body').textContent })));
    }, i);
    if (r.pressed !== 'true' || r.code.length < 10) allOpen = false;
  }
  ok(allOpen, 'each fragment opens its dream.json entry');
  await page.evaluate(() => [...document.querySelectorAll('.drp-seg button')].find((b) => b.textContent === 'world.json')?.click());
  await sleep(100);
  ok((await page.$eval('.drp-code__chrome', (el) => el.textContent)).includes('world.json'), 'world.json view switches');

  // pipeline: the Blender test renders load
  await page.click('#drp-tab-pipeline');
  await page.waitForSelector('.drp-still--frame img');
  await page.waitForFunction(() => document.querySelector('.drp-still--frame img')?.complete, { timeout: 8000 }).catch(() => {});
  ok(await page.$eval('.drp-still--frame img', (el) => el.naturalWidth) === 1280, 'Blender corridor still loads');
  await page.evaluate(() => [...document.querySelectorAll('.drp-seg button')].find((b) => b.textContent === 'Baked atlas')?.click());
  await page.waitForFunction(() => document.querySelector('.drp-still--frame img')?.naturalWidth === 512, { timeout: 8000 }).catch(() => {});
  ok(await page.$eval('.drp-still--frame img', (el) => el.naturalWidth) === 512, 'baked atlas loads');
  await page.click('.drp-flow__step[data-who="blender"]');
  ok((await page.$eval('.drp-lane .drp-detail .drp-dot', (el) => el.textContent)) === 'Build', 'pipeline step opens its detail');

  // experience: the live sketch paints, reports fps and loops
  await page.click('#drp-tab-experience');
  await page.waitForSelector('.drp-sketch__stage[data-state="ready"]', { timeout: 20000 }).catch(() => {});
  await sleep(1800);
  const paint = await canvasPaint(page);
  ok(paint.ok, 'live sketch paints the corridor', JSON.stringify(paint));
  const fps = await page.$eval('.drp-sketch__fps', (el) => Number(el.dataset.fps)).catch(() => 0);
  ok(fps >= 20, 'live sketch reports a frame rate (smoke test, not a phone number)', `${fps} fps`);
  ok(await page.$eval('.drp-sketch__fps', (el) => el.hidden), 'fps readout hidden without ?debug');
  const word0 = await page.$eval('.drp-sketch__fps', (el) => el.dataset.word);
  await page.waitForFunction((w) => {
    const el = document.querySelector('.drp-sketch__fps');
    return el && Number(el.dataset.lap) >= 1 && el.dataset.word !== w;
  }, { timeout: 40000 }, word0).catch(() => {});
  const after = await page.$eval('.drp-sketch__fps', (el) => ({ lap: Number(el.dataset.lap), word: el.dataset.word }));
  ok(after.lap >= 1, 'the corridor loops (teleport counted)', `lap ${after.lap}`);
  ok(word0 && after.word && after.word !== word0, 'the words on the wall move on while unseen', `${word0} → ${after.word}`);
  await page.screenshot({ path: path.join(OUT, 'sketch-dream-1440.png') });
  const btn = (label) => page.evaluate((l) => [...document.querySelectorAll('.drp-sketch__bar button')].find((b) => b.textContent === l)?.click(), label);
  await btn('Raw bake');
  await sleep(600);
  ok(await page.evaluate(() => [...document.querySelectorAll('.drp-sketch__bar button')].some((b) => b.textContent === 'Dream it')), 'raw bake toggles');
  const rawPaint = await canvasPaint(page);
  ok(rawPaint.ok, 'raw bake view paints too', JSON.stringify(rawPaint));
  await page.screenshot({ path: path.join(OUT, 'sketch-raw-1440.png') });
  await btn('Dream it');
  await btn('Hum on');
  await sleep(700);
  await btn('Hum off');
  await btn('Stop walking');
  ok((await page.evaluate(() => [...document.querySelectorAll('.drp-sketch__bar button')].map((b) => b.textContent))).includes('Walk'), 'walk toggles');
  await page.evaluate(() => document.querySelector('.drp-drawer summary').click());
  ok(await page.$$eval('.drp-table tbody tr', (r) => r.length) === 3, 'bench drawer shows the measured table');

  // no tone-coloured left-border callouts in the module
  const callouts = await page.evaluate(() => [...document.querySelectorAll('.drp *')].filter((el) => {
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
      await page.waitForSelector('.drp-head__hook');
      if (id === 'experience') {
        await page.waitForSelector('.drp-sketch__stage[data-state="ready"]', { timeout: 20000 }).catch(() => {});
        await sleep(1500);
        const p = await canvasPaint(page);
        ok(p.ok, `${theme} sketch @${width} paints`, JSON.stringify(p));
      } else {
        await page.evaluate(() => Promise.all([...document.images].map((im) => (im.complete ? 0 : new Promise((r) => { im.onload = r; im.onerror = r; })))));
        await sleep(450);
      }
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      if (width === 390) {
        ok(overflow <= 1, `${theme} ${id} @390 no horizontal scroll`, overflow);
        // nothing inside the tab may poke past the right edge unless it sits in its own scroller
        const poke = await page.evaluate(() => {
          const scroller = (el) => {
            for (let p = el.parentElement; p; p = p.parentElement) {
              const o = getComputedStyle(p).overflowX;
              if (o === 'auto' || o === 'scroll') return true;
            }
            return false;
          };
          return [...document.querySelectorAll('.drp-tab *')]
            .filter((el) => el.getBoundingClientRect().right > window.innerWidth + 1 && !scroller(el))
            .map((el) => el.className?.baseVal ?? el.className).slice(0, 4);
        });
        ok(poke.length === 0, `${theme} ${id} @390 nothing clipped at the right edge`, poke.join(','));
        const tiny = await page.evaluate(() => [...document.querySelectorAll('.drp-tab svg text')]
          .filter((t) => t.textContent.trim() && t.getBoundingClientRect().height > 0 && t.getBoundingClientRect().height < 8)
          .map((t) => t.textContent.trim()).slice(0, 4));
        ok(tiny.length === 0, `${theme} ${id} @390 no SVG text under 8 px`, tiny.join(' | '));
      }
      const el = await page.$('.drp');
      await el.screenshot({ path: path.join(OUT, `${theme}-${id}-${width}.png`) });
    }
    await page.close();
  }
}

ok(consoleIssues.length === 0, 'zero console errors / warnings', consoleIssues.slice(0, 5).join(' | '));
await browser.close();
console.log(fails.length ? `\n${fails.length} FAILED` : '\nALL PASS');
process.exit(fails.length ? 1 : 0);
