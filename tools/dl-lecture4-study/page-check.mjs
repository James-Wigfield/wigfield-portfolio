/* ============================================================================
   DL LECTURE 4 STUDY — headless check of /portal/dl-lecture-4-study
   (puppeteer-core + local Edge, seeded through the portal gate like the
   Project 2 check)
   ----------------------------------------------------------------------------
     node tools/dl-lecture4-study/page-check.mjs [outDir]      (dev server on 5173)
     SITE_URL=http://localhost:5199 ONLY=focus,persist node tools/dl-lecture4-study/page-check.mjs out

   Checks
     coverage   slides 1–52 covered once each, in order, from the section data
     render     every section with its slide receipt, Read / Play / Write beats,
                every lab mounted with a "Try this", every notebook page
     clean      no duplicate ids, no nested buttons, labelled SVG figures
     focus      focus mode enters (fullscreen or the overlay fallback), the
                root scrolls by itself and the header follows; it exits again
     persist    ticks survive a reload; "Resume at §N" offers the last section
     storage    with localStorage throwing, the page still renders and ticks
     reduced    prefers-reduced-motion: renders, labs still work
     lecture3   /portal/dl-lecture-3-study still renders without errors
     shots      full page in jade / coral / arcade at 1440 and 390, no
                horizontal page scroll
     console    zero console errors / warnings across every run
   ========================================================================== */
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const MOD = path.join(REPO, 'src/components/portal/modules/deep-learning/lecture4-study');
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const BASE = process.env.SITE_URL || 'http://localhost:5173';
const ROUTE = '/portal/dl-lecture-4-study';
const OUT = path.resolve(process.argv[2] || path.join(HERE, 'out'));
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
const want = (k) => !ONLY.length || ONLY.includes(k);
fs.mkdirSync(OUT, { recursive: true });

const { SECTIONS } = await import(pathToFileURL(path.join(MOD, 'sections.js')).href);

const fails = [];
const ok = (cond, label, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${extra !== '' ? `  — ${extra}` : ''}`);
  if (!cond) fails.push(label);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const SEED = () => {
  sessionStorage.setItem('portal_auth', JSON.stringify({ token: 'mock-session-token', key: 'wiggy1', issued_at: new Date().toISOString() }));
};

const browser = await puppeteer.launch({ executablePath: EDGE, headless: 'new', args: ['--hide-scrollbars'] });
const consoleMsgs = [];

async function open({ theme = 'jade', width = 1440, height = 900, reduced = false, brokenStorage = false, clear = false, route = ROUTE, wait = '.dl4s-sec', tag = '', page: reuse } = {}) {
  const page = reuse || (await browser.newPage());
  if (!reuse) {
    page.on('console', (m) => {
      if (m.type() === 'error' || m.type() === 'warn') consoleMsgs.push(`[${tag || theme}] ${m.type()}: ${m.text()}`);
    });
    page.on('pageerror', (e) => consoleMsgs.push(`[${tag || theme}] pageerror: ${e}`));
    await page.setViewport({ width, height, deviceScaleFactor: 1 });
    if (reduced) await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    await page.evaluateOnNewDocument(SEED);
    await page.evaluateOnNewDocument((t, wipe) => {
      try {
        if (wipe && !sessionStorage.getItem('dl4s-check-wiped')) {
          Object.keys(localStorage).filter((k) => k.startsWith('dl4s:')).forEach((k) => localStorage.removeItem(k));
          sessionStorage.setItem('dl4s-check-wiped', '1');
        }
        localStorage.setItem('portal:theme', t);
      } catch { /* broken-storage run */ }
    }, theme, clear);
    if (brokenStorage) {
      await page.evaluateOnNewDocument(() => {
        const boom = () => { throw new DOMException('storage disabled', 'SecurityError'); };
        const dead = { getItem: boom, setItem: boom, removeItem: boom, clear: boom, key: boom, length: 0 };
        Object.defineProperty(window, 'localStorage', { configurable: true, get: () => dead });
      });
    }
  }
  await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle0' });
  await page.waitForSelector(wait, { timeout: 30000 });
  await sleep(400);
  return page;
}

const currentNo = (page) => page.$eval('.dl4s-bar__nowno', (el) => el.textContent.trim());

try {
  // ── coverage (from the data) ──────────────────────────────────────────────
  if (want('coverage')) {
    const seen = [];
    SECTIONS.forEach((s) => {
      String(s.slides).split(/[,·]/).forEach((part) => {
        const [a, b] = part.trim().split(/[–-]/).map(Number);
        for (let n = a; n <= (b || a); n++) seen.push(n);
      });
    });
    const want52 = Array.from({ length: 52 }, (_, i) => i + 1);
    ok(JSON.stringify(seen) === JSON.stringify(want52), 'slides 1–52 each covered exactly once, in order', `${seen.length} slides`);
    const bad = SECTIONS.filter((s) => {
      const lines = s.notes.reduce((a, g) => a + g.lines.length, 0);
      return lines < 6 || lines > 12 || s.notes.length < 2 || s.notes.length > 4;
    }).map((s) => s.id);
    ok(bad.length === 0, 'every notebook page: 6–12 lines under 2–4 sub-headings', bad.join(', '));
  }

  const page = await open({ tag: 'main', clear: true });

  // ── render ────────────────────────────────────────────────────────────────
  if (want('render')) {
    const dom = await page.$$eval('.dl4s-sec', (els) => els.map((el) => ({
      id: el.id.replace('dl4s-', ''),
      receipt: el.querySelector('.dl4s-receipt')?.textContent.trim(),
      read: !!el.querySelector('.dl4s-beat--read .dl4s-read'),
      labs: [...el.querySelectorAll('.dl4s-beat--play .dl4s-lab')].map((l) => ({
        title: l.querySelector('.dl4s-lab__name')?.textContent.trim(),
        tryThis: !!l.querySelector('.dl4s-try'),
        size: l.getBoundingClientRect().height,
      })),
      board: !!el.querySelector('.dl4s-board--compact'),
      nb: !!document.getElementById(`${el.id}-nb`),
    })));
    ok(dom.length === SECTIONS.length && dom.every((d, i) => d.id === SECTIONS[i].id), `all ${SECTIONS.length} sections rendered, in order`, `${dom.length}`);
    const receiptBad = dom.filter((d, i) => d.receipt !== `${/[–,]/.test(SECTIONS[i].slides) ? 'slides' : 'slide'} ${SECTIONS[i].slides}`).map((d) => `${d.id}:${d.receipt}`);
    ok(receiptBad.length === 0, 'every section shows its slide receipt', receiptBad.join(', '));
    ok(dom.every((d) => d.read && d.nb), 'every section has its Read beat and its notebook page');
    const labBad = dom.filter((d, i) => d.labs.length !== (SECTIONS[i].play?.length ?? 0) || d.labs.some((l) => !l.title || !l.tryThis || l.size < 80)).map((d) => d.id);
    const labCount = dom.reduce((a, d) => a + d.labs.length, 0);
    ok(labBad.length === 0, `every lab mounted with a title and a "Try this" (${labCount} labs)`, labBad.join(', '));
    const boardBad = dom.filter((d, i) => !!SECTIONS[i].board !== d.board).map((d) => d.id);
    ok(boardBad.length === 0, 'the scoreboard strip appears exactly where board: true', boardBad.join(', '));
    const lines = await page.$$eval('.dl4s-nb__line', (els) => els.length);
    const want = SECTIONS.reduce((a, s) => a + s.notes.reduce((b, g) => b + g.lines.length, 0), 0);
    ok(lines === want, 'every notes line rendered as a tickable line', `${lines}/${want}`);
    const empty = await page.$$eval('.dl4s-nb__draw svg', (els) => els.filter((s) => s.getBoundingClientRect().height < 40 || s.childElementCount < 3).length);
    ok(empty === 0, 'every "Draw this" figure drew something');
    const tex = await page.$$eval('.katex-error', (els) => els.map((e) => e.textContent.slice(0, 60)));
    ok(tex.length === 0, 'no KaTeX parse errors', tex.slice(0, 3).join(' | '));
  }

  // ── clean ─────────────────────────────────────────────────────────────────
  if (want('clean')) {
    const dupIds = await page.evaluate(() => {
      const seen = new Map();
      document.querySelectorAll('[id]').forEach((el) => seen.set(el.id, (seen.get(el.id) || 0) + 1));
      return [...seen].filter(([, n]) => n > 1).map(([id]) => id);
    });
    ok(dupIds.length === 0, 'no duplicate DOM ids', dupIds.slice(0, 6).join(', '));
    const nested = await page.$$eval('button button, a button, button a', (els) => els.length);
    ok(nested === 0, 'no nested interactive elements', String(nested));
    const unlabelled = await page.$$eval('.dl4s svg[role="img"]', (els) => els.filter((s) => !(s.getAttribute('aria-label') || '').trim()).length);
    ok(unlabelled === 0, 'every role="img" SVG has an aria-label');
    const emoji = await page.$eval('.dl4s', (el) => (el.innerText.match(/\p{Extended_Pictographic}/gu) || []).filter((c) => !'⊗⊕↑↓→←'.includes(c)));
    ok(emoji.length === 0, 'no emoji in the page text', emoji.slice(0, 5).join(' '));
  }

  // ── focus mode ────────────────────────────────────────────────────────────
  if (want('focus')) {
    const fp = await open({ tag: 'focus' });
    await fp.click('.dl4s-hero__actions .dl4s-btn--primary');
    await sleep(1400);
    const st = await fp.evaluate(() => {
      const root = document.querySelector('.dl4s');
      return {
        focus: root.classList.contains('dl4s--focus'),
        real: document.fullscreenElement === root,
        pseudo: root.classList.contains('dl4s--pseudo'),
        overflow: getComputedStyle(root).overflowY,
        scrollable: root.scrollHeight > root.clientHeight + 100,
        bg: getComputedStyle(root).backgroundColor,
      };
    });
    ok(st.focus && (st.real || st.pseudo), 'focus mode enters (fullscreen or the overlay fallback)', st.real ? 'real fullscreen' : 'overlay');
    ok(st.overflow === 'auto' && st.scrollable, 'in focus mode the root is its own scroller', st.overflow);
    ok(st.bg && st.bg !== 'rgba(0, 0, 0, 0)', 'focus mode paints the theme ground behind the page', st.bg);
    const before = await currentNo(fp);
    await fp.evaluate(() => {
      const root = document.querySelector('.dl4s');
      const el = document.getElementById('dl4s-s08');
      root.scrollTo({ top: el.getBoundingClientRect().top - root.getBoundingClientRect().top + root.scrollTop - 120, behavior: 'instant' });
    });
    await sleep(600);
    const after = await currentNo(fp);
    const top = await fp.evaluate(() => document.querySelector('.dl4s').scrollTop);
    ok(top > 1000 && after === '§8' && before !== after, 'scrolling inside focus mode moves the page and the header follows', `${before} → ${after}, scrollTop ${Math.round(top)}`);
    // jump through the index rail
    await fp.evaluate(() => [...document.querySelectorAll('.dl4s-rail .dl4s-index__item')].find((b) => b.textContent.includes('GRU'))?.click());
    await sleep(900);
    ok((await currentNo(fp)) === '§14', 'the index rail jumps to a section inside focus mode', await currentNo(fp));
    await fp.keyboard.press('Escape');
    await sleep(700);
    let still = await fp.evaluate(() => document.querySelector('.dl4s').classList.contains('dl4s--focus'));
    if (still) {
      // real fullscreen in headless may ignore the key; the bar's toggle must work
      await fp.click('.dl4s-bar .dl4s-btn--primary');
      await sleep(900);
      still = await fp.evaluate(() => document.querySelector('.dl4s').classList.contains('dl4s--focus'));
    }
    ok(!still, 'focus mode exits (Esc, or the toggle)');
    ok((await currentNo(fp)) === '§14', 'leaving focus mode lands back on the section being read', await currentNo(fp));
    await fp.close();
  }

  // ── persistence ───────────────────────────────────────────────────────────
  if (want('persist')) {
    const pp = await open({ tag: 'persist', clear: true });
    const lines = await pp.$$('#dl4s-s02-nb .dl4s-nb__line');
    for (const i of [0, 2, 4]) await lines[i].click();
    await sleep(300);
    await pp.evaluate(() => {
      const el = document.getElementById('dl4s-s08');
      window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 160, behavior: 'instant' });
    });
    await sleep(700);
    // come back fresh (a reload would restore the scroll position, and the
    // shell rightly hides the offer when you are already there)
    await pp.goto(`${BASE}/portal`, { waitUntil: 'networkidle0' });
    await pp.goto(`${BASE}${ROUTE}`, { waitUntil: 'networkidle0' });
    await pp.waitForSelector('.dl4s-sec');
    await sleep(500);
    const pressed = await pp.$$eval('#dl4s-s02-nb .dl4s-nb__line', (els) => els.map((e) => e.getAttribute('aria-pressed') === 'true'));
    ok(pressed[0] && pressed[2] && pressed[4] && !pressed[1], 'ticked lines survive a reload', pressed.map((p) => (p ? 'x' : '.')).join(''));
    const resume = await pp.$eval('.dl4s-resume .dl4s-btn', (b) => b.textContent.trim()).catch(() => '');
    ok(/Resume at §8/.test(resume), '"Resume at §N" offers the last section', resume);
    if (resume) {
      await pp.click('.dl4s-resume .dl4s-btn');
      await sleep(900);
      ok((await currentNo(pp)) === '§8', 'Resume jumps to that section', await currentNo(pp));
    }
    const prog = await pp.$eval('.dl4s-bar__progtext', (el) => el.textContent.replace(/\s+/g, ' '));
    ok(/^3\//.test(prog), 'the header counts the ticked lines', prog);
    // put things back for the next runs
    await pp.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('dl4s:')).forEach((k) => localStorage.removeItem(k)));
    await pp.close();
  }

  // ── broken storage ────────────────────────────────────────────────────────
  if (want('storage')) {
    const bp = await open({ tag: 'storage', brokenStorage: true });
    const n = await bp.$$eval('.dl4s-sec', (els) => els.length);
    await bp.click('#dl4s-s01-nb .dl4s-nb__line');
    await sleep(200);
    const ticked = await bp.$eval('#dl4s-s01-nb .dl4s-nb__line', (e) => e.getAttribute('aria-pressed'));
    ok(n === SECTIONS.length && ticked === 'true', 'with localStorage throwing, the page renders and ticks still work', `${n} sections`);
    await bp.close();
  }

  // ── reduced motion ────────────────────────────────────────────────────────
  if (want('reduced')) {
    const rp = await open({ tag: 'reduced', reduced: true });
    const n = await rp.$$eval('.dl4s-lab', (els) => els.length);
    // a play button under reduced motion must finish without timers
    await rp.evaluate(() => document.querySelector('#dl4s-s11 .dl4s-stepper button[aria-label^="Play"]')?.click());
    await sleep(500);
    const t = await rp.$eval('#dl4s-s11 .dl4s-stepper__t', (el) => el.textContent).catch(() => '');
    ok(n > 20, 'reduced motion: every lab renders', `${n} labs`);
    ok(/round (1|14)/.test(t), 'reduced motion: the slide-34 loop still steps', t);
    await rp.close();
  }

  // ── Lecture 3 still fine ──────────────────────────────────────────────────
  if (want('lecture3')) {
    const lp = await open({ tag: 'lecture3', route: '/portal/dl-lecture-3-study', wait: '.dl3s-sec' });
    const n = await lp.$$eval('.dl3s-sec', (els) => els.length);
    const labs = await lp.$$eval('.dl3s-lab', (els) => els.length);
    ok(n >= 18 && labs >= 20, '/portal/dl-lecture-3-study still renders', `${n} sections, ${labs} labs`);
    await lp.close();
  }

  // ── screenshots ───────────────────────────────────────────────────────────
  if (want('shots')) {
    for (const theme of ['jade', 'coral', 'arcade']) {
      for (const width of [1440, 390]) {
        const sp = await open({ theme, width, tag: `${theme}-${width}` });
        const file = path.join(OUT, `page-${theme}-${width}.png`);
        await sp.screenshot({ path: file, fullPage: true });
        const overflow = await sp.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        ok(overflow <= 1, `${theme} @${width}: no horizontal page scroll`, `${overflow}px`);
        await sp.close();
      }
    }
  }
  await page.close();
} finally {
  await browser.close();
}

const noise = consoleMsgs.filter((m) => !/Download the React DevTools/.test(m));
ok(noise.length === 0, 'zero console errors or warnings across every run', noise.slice(0, 6).join(' || '));
console.log(`\n${fails.length ? `${fails.length} FAILED` : 'ALL PASS'}  (${OUT})`);
process.exit(fails.length ? 1 : 0);
