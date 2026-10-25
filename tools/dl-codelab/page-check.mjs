/* ============================================================================
   DL CODE LAB — headless check of /portal/dl-code-lab
   (puppeteer-core + local Edge, seeded through the portal gate)
   ----------------------------------------------------------------------------
     node tools/dl-codelab/page-check.mjs [outDir]            (dev server on 5182)
     SITE_URL=http://localhost:5173 ONLY=search,export node tools/dl-codelab/page-check.mjs out

   window.print is stubbed before every page loads, so a print dialog can't
   hang an unattended run. Checks:
     render     the page renders; every tab opens its cards and its deep link
                /portal/dl-code-lab/<tab>; a deep link opens its tab directly
     search     "/" focuses the search from anywhere, results come from
                every tab with <mark> highlights and each shows its tab, Esc
                clears, every term must match
     core       Core only hides the useful cards and comes back on reload
     persist    the open tab and Core only survive a reload (dlc: storage)
     storage    with localStorage throwing, the page renders and tabs work
     reduced    with reduced motion, the page renders
     keyboard   arrow keys move along the tab bar; Enter on a tab opens it
     copy       a card's copy button copies its code
     export     Export PDF calls print with every tab and one print image
                per code panel; afterprint puts the page back
     nlm        the NotebookLM dropdown opens directly under Export PDF, its
                two variants switch, Copy copies and shows the character count
     xref       a cross-link jumps to the other card's tab
     others     every other Deep Learning module in the registry still renders
     shots      3 themes × 1440 / 390, with no page-level horizontal scroll
   Exits 1 on any failure; zero console errors or warnings are required.
   ========================================================================== */
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const BASE = process.env.SITE_URL || 'http://localhost:5182';
const ROUTE = '/portal/dl-code-lab';
const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '../..');
const MOD = path.join(REPO, 'src/components/portal/modules/deep-learning/codelab');
const OUT = path.resolve(process.argv[2] || 'codelab-check');
fs.mkdirSync(OUT, { recursive: true });
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
const want = (k) => !ONLY.length || ONLY.includes(k);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const imp = (f) => import(pathToFileURL(path.join(MOD, f)).href);
const { CARDS } = await imp('cards/index.js');
const { SECTIONS } = await imp('sections.js');
const { NLM_PROMPT, NLM_PARTS } = await imp('exportPrompt.js');

const fails = [];
const consoleMsgs = [];
const ok = (cond, label, detail = '') => {
  console.log(`${cond ? 'ok  ' : 'FAIL'} ${label}${detail ? ` · ${detail}` : ''}`);
  if (!cond) fails.push(label);
};

const browser = await puppeteer.launch({ executablePath: EDGE, headless: 'new', args: ['--hide-scrollbars'] });
const ctx = browser.defaultBrowserContext();
await ctx.overridePermissions(BASE, ['clipboard-read', 'clipboard-write', 'clipboard-sanitized-write']);

async function open({ theme = 'jade', width = 1440, height = 900, reduced = false, brokenStorage = false, clear = true, route = ROUTE, wait = '.dlc-sec', tag = '' } = {}) {
  const page = await browser.newPage();
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warn') consoleMsgs.push(`[${tag || theme}] ${m.type()}: ${m.text()}`);
  });
  page.on('pageerror', (e) => consoleMsgs.push(`[${tag || theme}] pageerror: ${e}`));
  await page.setViewport({ width, height, deviceScaleFactor: 1 });
  if (reduced) await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await page.evaluateOnNewDocument((t, wipe) => {
    sessionStorage.setItem('portal_auth', JSON.stringify({ token: 'mock-session-token', key: 'wiggy1', issued_at: new Date().toISOString() }));
    window.print = () => { window.__printCalls = (window.__printCalls || 0) + 1; };
    try {
      if (wipe && !sessionStorage.getItem('dlc-check-wiped')) {
        Object.keys(localStorage).filter((k) => k.startsWith('dlc:')).forEach((k) => localStorage.removeItem(k));
        sessionStorage.setItem('dlc-check-wiped', '1');
      }
      localStorage.setItem('portal:theme', t);
    } catch { /* the broken-storage run */ }
  }, theme, clear);
  if (brokenStorage) {
    await page.evaluateOnNewDocument(() => {
      const boom = () => { throw new DOMException('storage disabled', 'SecurityError'); };
      const dead = { getItem: boom, setItem: boom, removeItem: boom, clear: boom, key: boom, length: 0 };
      Object.defineProperty(window, 'localStorage', { configurable: true, get: () => dead });
    });
  }
  await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle0' });
  await page.waitForSelector(wait, { timeout: 30000 });
  await sleep(300);
  return page;
}

const cardIds = (page) => page.$$eval('.dlc-card', (els) => els.map((e) => e.dataset.card));

try {
  // ── render: every tab ──────────────────────────────────────────────────────
  if (want('render')) {
    const page = await open({ tag: 'render' });
    const tabs = await page.$$eval('[data-dlc-tab]', (els) => els.map((e) => e.dataset.dlcTab));
    ok(JSON.stringify(tabs) === JSON.stringify(SECTIONS.map((s) => s.id)), `the tab bar lists the ${SECTIONS.length} tabs in order`, tabs.join(' '));
    for (const s of SECTIONS) {
      await page.click(`[data-dlc-tab="${s.id}"]`);
      await sleep(250);
      const st = await page.evaluate(() => ({
        path: location.pathname,
        sel: document.querySelector('[role="tab"][aria-selected="true"]')?.dataset.dlcTab,
        sec: document.querySelector('.dlc-sec')?.dataset.sec,
        panels: document.querySelectorAll('.dlc-code').length,
      }));
      const ids = await cardIds(page);
      const expect = CARDS.filter((c) => c.section === s.id).map((c) => c.id);
      ok(st.path === `${ROUTE}/${s.id}` && st.sel === s.id && st.sec === s.id && JSON.stringify(ids) === JSON.stringify(expect) && st.panels === expect.length,
        `tab ${s.n} (${s.id}) opens its ${expect.length} cards at ${ROUTE}/${s.id}`, `${ids.length} cards, ${st.panels} panels`);
    }
    const labs = await open({ tag: 'deeplink', route: `${ROUTE}/labs` });
    const lp = await labs.$$eval('.dlc-lp', (els) => els.map((e) => e.dataset.lp));
    ok(lp.join() === 'lp-lab2,lp-lab3,lp-lab4,lp-p1,lp-p2', 'Labs & Projects shows the five panels', lp.join(' '));
    await labs.close();
    const deep = await open({ tag: 'deeplink', route: `${ROUTE}/rnn` });
    ok(await deep.evaluate(() => document.querySelector('.dlc-sec')?.dataset.sec === 'rnn'), 'a deep link /portal/dl-code-lab/rnn opens the RNN tab');
    const hero = await deep.evaluate(() => document.querySelector('.dlc-hero__stats')?.textContent);
    ok(new RegExp(`${CARDS.length}\\s*cards`).test(hero) && new RegExp(`${SECTIONS.length}\\s*tabs`).test(hero), 'the hero states the card and tab counts', hero);
    await deep.close();
    await page.close();
  }

  // ── search ─────────────────────────────────────────────────────────────────
  if (want('search')) {
    const page = await open({ tag: 'search' });
    await page.click('.dlc-hero__title');
    await page.keyboard.press('/');
    ok(await page.evaluate(() => document.activeElement?.classList.contains('dlc-search__input')), '"/" focuses the search from anywhere');
    await page.keyboard.type('return_sequences');
    await sleep(300);
    const r = await page.evaluate(() => ({
      ids: [...document.querySelectorAll('.dlc-results .dlc-card')].map((e) => e.dataset.card),
      tabs: [...document.querySelectorAll('.dlc-results .dlc-card__tab')].map((e) => e.textContent),
      marks: document.querySelectorAll('.dlc-results mark.dlc-hi').length,
    }));
    const secs = new Set(r.ids.map((id) => CARDS.find((c) => c.id === id)?.section));
    ok(r.ids.length >= 3 && secs.size >= 2 && r.marks > 0 && r.tabs.length === r.ids.length, 'search finds cards in several tabs, highlights matches and shows each card’s tab', `${r.ids.length} cards in ${[...secs].join(', ')}, ${r.marks} highlights`);
    // every tab is searchable: each card's own title finds it
    let missing = 0;
    for (const s of SECTIONS) {
      const c = CARDS.find((x) => x.section === s.id);
      await page.$eval('.dlc-search__input', (el) => { el.focus(); el.select(); });
      await page.keyboard.type(c.title.split(/\s+/).slice(0, 3).join(' '));
      await sleep(200);
      const found = await page.$$eval('.dlc-results .dlc-card', (els, id) => els.some((e) => e.dataset.card === id), c.id);
      if (!found) missing += 1;
    }
    ok(missing === 0, 'every tab’s cards are reachable from the search', `${missing} missing`);
    await page.$eval('.dlc-search__input', (el) => { el.focus(); el.select(); });
    await page.keyboard.type('gru zzzqqq');
    await sleep(200);
    ok(await page.$$eval('.dlc-results .dlc-card', (e) => e.length) === 0, 'every term must match (a nonsense term empties the results)');
    await page.keyboard.press('Escape');
    await sleep(200);
    const after = await page.evaluate(() => ({ q: document.querySelector('.dlc-search__input').value, results: !!document.querySelector('.dlc-results'), sec: !!document.querySelector('.dlc-sec[data-sec]') }));
    ok(after.q === '' && !after.results && after.sec, 'Esc clears the search and the tab comes back');
    await page.close();
  }

  // ── Core only + persistence ────────────────────────────────────────────────
  if (want('core') || want('persist')) {
    const page = await open({ tag: 'core', route: `${ROUTE}/labs` });
    const before = (await cardIds(page)).length;
    await page.click('.dlc-core');
    await sleep(250);
    const ids = await cardIds(page);
    const useful = CARDS.filter((c) => c.section === 'labs' && c.rating === 'useful').length;
    ok(ids.length === before - useful && ids.every((id) => CARDS.find((c) => c.id === id).rating === 'core'), 'Core only hides the useful cards', `${before} → ${ids.length}`);
    await page.click('[data-dlc-tab="ae"]');
    await sleep(200);
    await page.goto(`${BASE}${ROUTE}`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('.dlc-sec');
    await sleep(300);
    const st = await page.evaluate(() => ({ sec: document.querySelector('.dlc-sec')?.dataset.sec, core: document.querySelector('.dlc-core input')?.checked, ls: localStorage.getItem('dlc:tab') }));
    ok(st.sec === 'ae' && st.core === true && st.ls === '"ae"', 'the open tab and Core only survive a reload (dlc:tab, dlc:coreOnly)', JSON.stringify(st));
    await page.click('.dlc-core');
    await page.close();
  }

  // ── broken storage, reduced motion ─────────────────────────────────────────
  if (want('storage')) {
    const page = await open({ tag: 'broken-storage', brokenStorage: true, clear: false });
    await page.click('[data-dlc-tab="gen"]');
    await sleep(250);
    await page.click('.dlc-core');
    await sleep(150);
    ok(await page.evaluate(() => document.querySelector('.dlc-sec')?.dataset.sec === 'gen' && document.querySelectorAll('.dlc-card').length > 0), 'with localStorage throwing, the page renders and its tabs and toggle work');
    await page.close();
  }
  if (want('reduced')) {
    const page = await open({ tag: 'reduced', reduced: true });
    const anim = await page.evaluate(() => getComputedStyle(document.querySelector('.dlc-sec')).animationName);
    ok(anim === 'none', 'with reduced motion the page renders without its fade', anim);
    await page.close();
  }

  // ── keyboard ───────────────────────────────────────────────────────────────
  if (want('keyboard')) {
    const page = await open({ tag: 'keyboard', route: `${ROUTE}/keras` });
    await page.focus('[data-dlc-tab="keras"]');
    await page.keyboard.press('ArrowRight');
    await sleep(250);
    const a = await page.evaluate(() => ({ focus: document.activeElement?.dataset.dlcTab, sec: document.querySelector('.dlc-sec')?.dataset.sec }));
    await page.keyboard.press('End');
    await sleep(250);
    const b = await page.evaluate(() => ({ focus: document.activeElement?.dataset.dlcTab, sec: document.querySelector('.dlc-sec')?.dataset.sec }));
    await page.keyboard.press('Home');
    await sleep(250);
    const c = await page.evaluate(() => document.querySelector('.dlc-sec')?.dataset.sec);
    ok(a.focus === 'training' && a.sec === 'training' && b.focus === 'rl' && b.sec === 'rl' && c === 'labs', 'arrow keys, Home and End move along the tab bar and open the tab');
    await page.keyboard.press('Tab');
    ok(await page.evaluate(() => !!document.activeElement && document.activeElement !== document.body), 'Tab moves focus on from the tab bar');
    await page.close();
  }

  // ── copy ───────────────────────────────────────────────────────────────────
  if (want('copy')) {
    const page = await open({ tag: 'copy', route: `${ROUTE}/rnn` });
    const first = CARDS.find((c) => c.section === 'rnn');
    await page.click(`#dlc-${first.id} .dlc-copy`);
    await sleep(300);
    const label = await page.$eval(`#dlc-${first.id} .dlc-copy`, (e) => e.textContent);
    const clip = await page.evaluate(() => navigator.clipboard.readText().catch(() => ''));
    ok(/copied/.test(label) && clip.split(String.fromCharCode(13)).join('') === first.code, 'a card’s copy button copies its code', `${label} · ${clip.length}/${first.code.length} chars`);
    const n = await page.$$eval('.dlc-copy', (e) => e.length);
    ok(n === CARDS.filter((c) => c.section === 'rnn').length, 'every card has a copy button', n);
    await page.close();
  }

  // ── cross-links ────────────────────────────────────────────────────────────
  if (want('xref')) {
    const page = await open({ tag: 'xref', route: `${ROUTE}/rnn` });
    const target = await page.$eval('.dlc-xref .dlc-link', (b) => b.textContent);
    await page.click('.dlc-xref .dlc-link');
    await sleep(500);
    const sec = await page.evaluate(() => document.querySelector('.dlc-sec')?.dataset.sec);
    ok(sec === 'labs', 'a cross-link opens the other card’s tab', `${target} → ${sec}`);
    await page.close();
  }

  // ── export ─────────────────────────────────────────────────────────────────
  if (want('export')) {
    const page = await open({ tag: 'export', route: `${ROUTE}/cnn` });
    await page.evaluate(() => [...document.querySelectorAll('.dlc-export button')].find((b) => /Export PDF/.test(b.textContent)).click());
    await page.waitForFunction(() => window.__printCalls === 1, { timeout: 30000 });
    const st = await page.evaluate(() => ({
      cls: document.documentElement.classList.contains('dlc-printing'),
      secs: [...document.querySelectorAll('.dlc-sec')].map((s) => s.dataset.sec),
      cards: document.querySelectorAll('.dlc-card').length,
      imgs: [...document.querySelectorAll('.dlc-pimg__img')].filter((i) => i.naturalWidth > 1000).length,
      cover: document.querySelectorAll('.dlc-cover__cards span').length,
      title: document.title,
    }));
    ok(st.cls && st.secs.join() === SECTIONS.map((s) => s.id).join() && st.cards === CARDS.length && st.imgs === CARDS.length && st.cover === CARDS.length,
      'Export PDF prints every tab and card, a ≥ 2× image per code panel and the cover’s contents', `${st.secs.length} tabs, ${st.cards} cards, ${st.imgs} images, ${st.cover} contents lines`);
    await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
    await sleep(400);
    const after = await page.evaluate(() => ({ cls: document.documentElement.className, secs: document.querySelectorAll('.dlc-sec').length, title: document.title, imgs: document.querySelectorAll('.dlc-pimg__img').length }));
    ok(!/dlc-printing/.test(after.cls) && after.secs === 1 && after.imgs === 0 && after.title !== st.title, 'afterprint puts the page back', JSON.stringify(after));
    await page.close();
  }

  // ── the NotebookLM dropdown ────────────────────────────────────────────────
  if (want('nlm')) {
    const page = await open({ tag: 'nlm' });
    const closed = await page.$eval('.dlc-export__toggle', (b) => b.getAttribute('aria-expanded'));
    await page.click('.dlc-export__toggle');
    await sleep(250);
    const geo = await page.evaluate(() => {
      const btn = [...document.querySelectorAll('.dlc-export button')].find((b) => /Export PDF/.test(b.textContent)).getBoundingClientRect();
      const tog = document.querySelector('.dlc-export__toggle').getBoundingClientRect();
      const drop = document.querySelector('.dlc-nlm').getBoundingClientRect();
      return { btnBottom: btn.bottom, togTop: tog.top, togBottom: tog.bottom, dropTop: drop.top, steps: document.querySelectorAll('.dlc-nlm__steps li').length, text: [...document.querySelectorAll('.dlc-nlm__text')].map((p) => p.textContent), k: document.querySelector('.dlc-nlm__k').textContent };
    });
    ok(closed === 'false' && geo.togTop >= geo.btnBottom - 1 && geo.togTop - geo.btnBottom < 12 && geo.dropTop >= geo.togBottom - 1 && geo.dropTop - geo.togBottom < 14, 'the dropdown opens directly under Export PDF', JSON.stringify(geo).slice(0, 120));
    ok(geo.text.length === 1 && geo.text[0] === NLM_PROMPT && geo.steps >= 3 && new RegExp(`${NLM_PROMPT.length} characters`).test(geo.k), 'it shows the one-video prompt with its character count and the steps', geo.k);
    await page.click('.dlc-nlm__opt:nth-child(2)');
    await sleep(200);
    const parts = await page.$$eval('.dlc-nlm__text', (els) => els.map((p) => p.textContent));
    ok(JSON.stringify(parts) === JSON.stringify(NLM_PARTS.map((p) => p.text)), 'the Two parts variant shows both prompts');
    await page.click('.dlc-nlm__copy');
    await sleep(300);
    const lbl = await page.$eval('.dlc-nlm__copy', (b) => b.textContent);
    const clip = await page.evaluate(() => navigator.clipboard.readText().catch(() => ''));
    ok(/Copied/.test(lbl) && clip === NLM_PARTS[0].text, 'Copy copies the prompt', lbl);
    await page.keyboard.press('Escape');
    await sleep(150);
    ok(await page.$('.dlc-nlm') === null, 'Esc closes the dropdown');
    await page.close();
  }

  // ── every other Deep Learning module ───────────────────────────────────────
  if (want('others')) {
    const registry = fs.readFileSync(path.join(REPO, 'src/components/portal/registry.js'), 'utf8');
    const others = [...registry.matchAll(/id: '(dl-[a-z0-9-]+)'/g)].map((m) => m[1]).filter((id) => id !== 'dl-code-lab');
    ok(others.length >= 12, 'the registry lists the other Deep Learning modules', others.length);
    for (const id of others) {
      const before = consoleMsgs.length;
      let n = 0;
      try {
        const p = await open({ tag: id, route: `/portal/${id}`, wait: '.portal__content *' });
        await sleep(500);
        n = await p.$eval('.portal__content', (el) => el.innerText.length).catch(() => 0);
        await p.close();
      } catch (e) {
        n = -1;
        consoleMsgs.push(`[${id}] ${e.message}`);
      }
      const errs = consoleMsgs.slice(before).filter((m) => /pageerror/.test(m));
      ok(n > 50 && errs.length === 0, `/portal/${id} still renders`, `${n} chars${errs.length ? ` · ${errs[0]}` : ''}`);
    }
  }

  // ── screenshots: 3 themes × 2 widths ───────────────────────────────────────
  if (want('shots')) {
    for (const theme of ['jade', 'coral', 'arcade']) {
      for (const width of [1440, 390]) {
        const p = await open({ theme, width, tag: `${theme}-${width}`, route: `${ROUTE}/keras` });
        await p.screenshot({ path: path.join(OUT, `page-${theme}-${width}.png`), fullPage: true });
        const overflow = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        ok(overflow <= 1, `${theme} @${width}: no page-level horizontal scroll`, `${overflow}px`);
        if (width === 390) {
          const sel = await p.evaluate(() => getComputedStyle(document.querySelector('.dlc-tabsel')).display !== 'none' && getComputedStyle(document.querySelector('.dlc-tabs')).display === 'none');
          ok(sel, `${theme} @390: the tab bar becomes a select`);
        }
        await p.close();
      }
    }
  }
} finally {
  await browser.close();
}

const noise = consoleMsgs.filter((m) => !/Download the React DevTools/.test(m));
ok(noise.length === 0, 'zero console errors or warnings across every run', noise.slice(0, 6).join(' || '));
console.log(`\n${fails.length ? `${fails.length} FAILED` : 'ALL PASS'}  (${OUT})`);
process.exit(fails.length ? 1 : 0);
