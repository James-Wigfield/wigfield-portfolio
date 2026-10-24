/* ============================================================================
   DL LECTURES 1–2 REFRESHER — headless check of /portal/dl-lectures-1-2-refresher
   (puppeteer-core + local Edge, seeded through the portal gate; adapted from
   tools/dl-lecture8-study/page-check.mjs)
   ----------------------------------------------------------------------------
     node tools/dl-lectures1-2-refresher/page-check.mjs [outDir]      (dev server on 5173)
     SITE_URL=http://localhost:5173 ONLY=budget,pdf node tools/dl-lectures1-2-refresher/page-check.mjs out

   window.print is stubbed before the page loads in EVERY run, so a print
   dialog can never hang an unattended check.

   Checks
     coverage   L1 slides 1–64 and L2 slides 1–68 each covered once, in order;
                exactly three notebook pages, after §1.8, §2.5 and §2.9
     render     both part heads; every section with its "L1 · slides …" /
                "L2 · slides …" receipt and Read beat; every lab with a title,
                an "L1/L2 · slide" receipt and a "Try this"; every notebook
                page with all its tickable units and "L1 · 18–23"-style block
                receipts; no KaTeX errors
     budget     each page ≤ 30 rules at the 760 px reference, measured here
                from the hidden copy's own rules and compared with the page's
                "fits one page" indicator
     clean      no duplicate ids, no nested buttons, labelled figures, no emoji
     pens       notebook pages: no handwriting font; blue headings and
                receipts, black body, red markers, green highlights; every pen
                ≥ 4.5:1 (3 themes)
     marks      the L1/L2 marks: outlined (not filled), ≥ 4.5:1 on the ground
                and the surface (3 themes)
     focus      focus mode enters, scrolls by itself with the header
                following, the rail jumps to a section and to a notebook page,
                and it exits back where you were
     persist    ticks survive a reload; "Resume at §N" offers and jumps
     storage    with localStorage throwing, the page renders and ticks
     reduced    prefers-reduced-motion: every lab renders, story labs open on
                their last beat, transitions are off, ▶ starts on beat 1
     keyboard   a perceptron point, the XOR line handle, the backprop story,
                a softmax logit and the optimizer picker, all by keys
     export     Export PDF calls the stubbed print once, in print mode, story
                labs on their last beat, maths drawers open; afterprint
                restores the page
     pdf        print mode → page.pdf → pdftotext: every section heading with
                its L1/L2 receipt, in order; no notebook text; key formulas
                read as text
     nlm        the NotebookLM dropdown: three prompts, each < 1,000
                characters, naming both lectures; Copy copies or selects
     others     every other Deep Learning module still renders
     shots      full page in jade / coral / arcade at 1440 and 390, no
                horizontal page scroll
     console    zero console errors / warnings across every run
   ========================================================================== */
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL, fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const MOD = path.join(REPO, 'src/components/portal/modules/deep-learning/lectures1-2-refresher');
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const BASE = process.env.SITE_URL || 'http://localhost:5173';
const ROUTE = '/portal/dl-lectures-1-2-refresher';
const OUT = path.resolve(process.argv[2] || path.join(HERE, 'out'));
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
const want = (k) => !ONLY.length || ONLY.includes(k);
fs.mkdirSync(OUT, { recursive: true });

const { SECTIONS, PAGES } = await import(pathToFileURL(path.join(MOD, 'sections.js')).href);
const { SHEETS, sheetKeys } = await import(pathToFileURL(path.join(MOD, 'sheets/index.js')).href);
const { NLM_PROMPT, NLM_PARTS } = await import(pathToFileURL(path.join(MOD, 'exportPrompt.js')).href);
const { RULE_BUDGET, REF_WIDTH } = await import(pathToFileURL(path.join(MOD, 'lec.js')).href);

const fails = [];
const ok = (cond, label, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${extra !== '' ? `  — ${extra}` : ''}`);
  if (!cond) fails.push(label);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const receipt = (s) => `${/[–,]/.test(String(s)) ? 'slides' : 'slide'} ${s}`;

const SEED = () => {
  sessionStorage.setItem('portal_auth', JSON.stringify({ token: 'mock-session-token', key: 'wiggy1', issued_at: new Date().toISOString() }));
  // a real print dialog would hang an unattended run
  window.print = () => { window.__printCalls = (window.__printCalls || 0) + 1; };
};

const browser = await puppeteer.launch({ executablePath: EDGE, headless: 'new', args: ['--hide-scrollbars'] });
const consoleMsgs = [];

async function open({ theme = 'jade', width = 1440, height = 900, reduced = false, brokenStorage = false, clear = false, route = ROUTE, wait = '.dl12r-sec', tag = '' } = {}) {
  const page = await browser.newPage();
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warn') consoleMsgs.push(`[${tag || theme}] ${m.type()}: ${m.text()}`);
  });
  page.on('pageerror', (e) => consoleMsgs.push(`[${tag || theme}] pageerror: ${e}`));
  await page.setViewport({ width, height, deviceScaleFactor: 1 });
  if (reduced) await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await page.evaluateOnNewDocument(SEED);
  await page.evaluateOnNewDocument((t, wipe) => {
    try {
      if (wipe && !sessionStorage.getItem('dl12r-check-wiped')) {
        Object.keys(localStorage).filter((k) => k.startsWith('dl12r:')).forEach((k) => localStorage.removeItem(k));
        sessionStorage.setItem('dl12r-check-wiped', '1');
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
  await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle0' });
  await page.waitForSelector(wait, { timeout: 30000 });
  await sleep(500);
  return page;
}

const currentNo = (page) => page.$eval('.dl12r-bar__nowno', (el) => el.textContent.trim());
const focusEl = (page, sel, i = 0) => page.$$eval(sel, (els, k) => els[k]?.focus(), i);
const LABS = SECTIONS.reduce((a, s) => a + (s.play?.length ?? 0), 0);

try {
  // ── coverage (from the data) ──────────────────────────────────────────────
  if (want('coverage')) {
    for (const [lec, total] of [[1, 64], [2, 68]]) {
      const seen = [];
      SECTIONS.filter((s) => s.lec === lec).forEach((s) => String(s.slides).split(',').forEach((part) => {
        const [a, b] = part.trim().split(/[–-]/).map(Number);
        for (let n = a; n <= (b || a); n++) seen.push(n);
      }));
      ok(JSON.stringify(seen) === JSON.stringify(Array.from({ length: total }, (_, i) => i + 1)), `L${lec} slides 1–${total} each covered exactly once, in order`, `${seen.length} slides in ${SECTIONS.filter((s) => s.lec === lec).length} sections`);
    }
    ok(SECTIONS.every((s, i) => i === 0 || s.lec >= SECTIONS[i - 1].lec), 'Part 1 (L1) comes before Part 2 (L2)');
    ok(PAGES.length === 3 && PAGES.map((p) => p.after).join(',') === 's18,s25,s29', 'exactly three notebook pages, after §1.8, §2.5 and §2.9');
    const badAt = PAGES.flatMap((p) => SHEETS[p.id].blocks.filter((b) => !new RegExp(`^L${p.lec} · \\d+(–\\d+)?$`).test(b.at ?? '')).map((b) => `${p.id}.${b.id}:${b.at}`));
    ok(badAt.length === 0, 'every notebook block carries an "L1 · 18–23"-style receipt of its own lecture', badAt.join(', '));
  }

  const page = await open({ tag: 'main', clear: true });

  // ── render ────────────────────────────────────────────────────────────────
  if (want('render')) {
    await sleep(400);
    const parts = await page.$$eval('.dl12r-part', (els) => els.map((e) => e.textContent.replace(/\s+/g, ' ').trim()));
    ok(parts.length === 2 && /Lecture 1 · Introduction to Artificial Neural Networks/.test(parts[0]) && /Lecture 2 · Training Deep Neural Networks/.test(parts[1]), 'both part heads, Lecture 1 then Lecture 2', parts.join(' | '));
    const dom = await page.$$eval('.dl12r-sec', (els) => els.map((el) => ({
      id: el.id.replace('dl12r-', ''),
      receipt: el.querySelector('.dl12r-receipt')?.textContent.replace(/\s+/g, ' ').trim(),
      read: !!el.querySelector('.dl12r-beat--read .dl12r-read'),
      gist: !!el.querySelector('.dl12r-gist'),
      labs: [...el.querySelectorAll('.dl12r-beat--play .dl12r-stage')].map((l) => ({
        title: l.querySelector('.dl12r-stage__title')?.textContent.trim(),
        slides: l.querySelector('.dl12r-stage__slides')?.textContent.trim() ?? '',
        tryThis: !!l.querySelector('.dl12r-stage__try'),
        size: l.getBoundingClientRect().height,
      })),
    })));
    ok(dom.length === SECTIONS.length && dom.every((d, i) => d.id === SECTIONS[i].id), `all ${SECTIONS.length} sections rendered, in order`);
    const receiptBad = dom.filter((d, i) => d.receipt !== `Lecture ${SECTIONS[i].lec}L${SECTIONS[i].lec} · ${receipt(SECTIONS[i].slides)}`).map((d) => `${d.id}:${d.receipt}`);
    ok(receiptBad.length === 0, 'every section shows its "L1 · slides …" / "L2 · slides …" receipt', receiptBad.join(', '));
    ok(dom.every((d) => d.read && d.gist), 'every section has its Read beat, opening with a gist');
    const labBad = dom.filter((d, i) => d.labs.length !== (SECTIONS[i].play?.length ?? 0) || d.labs.some((l) => !l.title || !l.tryThis || l.size < 80 || !l.slides.startsWith(`L${SECTIONS[i].lec} · `))).map((d) => `${d.id}:${d.labs.map((l) => `${l.title} [${l.slides}]${l.tryThis ? '' : ' (no try)'}`).join('/')}`);
    ok(labBad.length === 0, `every lab mounted with a title, its own lecture's receipt and a "Try this" (${dom.reduce((a, d) => a + d.labs.length, 0)} labs)`, labBad.join(', '));
    const nb = await page.$$eval('.dl12r-nbsec', (els) => els.map((el) => ({
      id: el.id.replace('dl12r-', ''),
      prev: el.previousElementSibling?.id?.replace('dl12r-', ''),
      units: el.querySelectorAll('.dl12r-sh:not(.dl12r-sh--measure) :is(.dl12r-sh__u, .dl12r-sh__tr:not(.dl12r-sh__tr--head), .dl12r-sh__figu)').length,
      at: [...el.querySelectorAll('.dl12r-sh:not(.dl12r-sh--measure) .dl12r-sh__at')].map((a) => a.textContent.trim()),
      sheets: el.querySelectorAll('.dl12r-sh').length,
    })));
    const nbBad = nb.filter((n, i) => n.id !== PAGES[i].id || n.prev !== PAGES[i].after || n.units !== sheetKeys(SHEETS[n.id]).length || n.sheets !== 2).map((n) => `${n.id}:${n.units}/${sheetKeys(SHEETS[n.id]).length} after ${n.prev}`);
    ok(nb.length === 3 && nbBad.length === 0, 'exactly three notebook pages, each after its group, with all its tickable units (and one hidden measuring copy)', `${nb.map((n) => `${n.id} ${n.units}`).join(', ')} ${nbBad.join(', ')}`);
    ok(nb.every((n, i) => n.at.every((a) => a.startsWith(`L${PAGES[i].lec} · `))), 'block receipts on the pages read "L1 · …" / "L2 · …"');
    const tex = await page.$$eval('.katex-error', (els) => els.map((e) => e.textContent.slice(0, 60)));
    ok(tex.length === 0, 'no KaTeX parse errors', tex.slice(0, 3).join(' | '));
    const deeper = await page.$$eval('.dl12r-deeper a', (els) => els.map((a) => a.getAttribute('href')));
    ok(deeper.length >= 15 && deeper.every((h) => h === '/portal/dl-lecture-1' || h === '/portal/dl-lecture-2'), 'quiet "Go deeper" links point at the full Lecture 1 and 2 modules', `${deeper.length} links`);
  }

  // ── budget: one real notebook page each ──────────────────────────────────
  if (want('budget')) {
    await sleep(600);
    const m = await page.$$eval('.dl12r-nbsec', (els, ref) => els.map((el) => {
      const sh = el.querySelector('.dl12r-sh--measure');
      const probe = sh.querySelector('.dl12r-sh__probe').getBoundingClientRect().height;
      const tools = sh.querySelector('.dl12r-sh__tools');
      const pad = parseFloat(getComputedStyle(sh).paddingTop);
      const gap = parseFloat(getComputedStyle(tools).marginTop);
      const rules = (tools.offsetTop - pad - gap) / probe;
      return {
        id: el.id.replace('dl12r-', ''),
        width: Math.round(el.querySelector('.dl12r-measure__box').getBoundingClientRect().width),
        sheetW: Math.round(sh.getBoundingClientRect().width),
        rules: Math.round(rules * 100) / 100,
        shown: Number(el.querySelector('.dl12r-fit')?.dataset.rules),
        label: el.querySelector('.dl12r-fit')?.textContent.trim(),
        ref,
      };
    }), REF_WIDTH);
    ok(m.every((p) => p.width === REF_WIDTH && p.sheetW === REF_WIDTH), `each page is measured on a sheet ${REF_WIDTH} px wide`, m.map((p) => `${p.id} ${p.sheetW}px`).join(', '));
    ok(m.every((p) => Math.abs(p.rules - Math.round(p.rules)) < 0.05), 'every line of the measuring copy sits on a rule', m.map((p) => `${p.id} ${p.rules}`).join(', '));
    ok(m.every((p) => Math.ceil(p.rules - 0.05) === p.shown), 'the "fits one page" indicator agrees with this measurement', m.map((p) => `${p.id} shows ${p.shown}`).join(', '));
    ok(m.every((p) => Math.ceil(p.rules - 0.05) <= RULE_BUDGET && /fits one page/.test(p.label)), `every notebook page ≤ ${RULE_BUDGET} rules (one real page)`, m.map((p) => `${p.id}: ${Math.ceil(p.rules - 0.05)} rules`).join(' · '));
  }

  // ── clean ─────────────────────────────────────────────────────────────────
  if (want('clean')) {
    const dupIds = await page.evaluate(() => {
      const seen = new Map();
      document.querySelectorAll('[id]').forEach((el) => seen.set(el.id, (seen.get(el.id) || 0) + 1));
      return [...seen].filter(([, n]) => n > 1).map(([id]) => id);
    });
    ok(dupIds.length === 0, 'no duplicate DOM ids (the measuring copies carry none)', dupIds.slice(0, 6).join(', '));
    const nested = await page.$$eval('button button, a button, button a', (els) => els.length);
    ok(nested === 0, 'no nested interactive elements', String(nested));
    const unlabelled = await page.$$eval('.dl12r svg[role="img"], .dl12r svg[role="group"]', (els) => els.filter((s) => !(s.getAttribute('aria-label') || '').trim()).length);
    ok(unlabelled === 0, 'every figure (role img/group) has an aria-label');
    const inertOk = await page.$$eval('.dl12r-measure', (els) => els.every((e) => e.hasAttribute('inert') && e.getAttribute('aria-hidden') === 'true'));
    ok(inertOk, 'the measuring copies are inert and hidden from assistive tech');
    const emoji = await page.$eval('.dl12r', (el) => (el.innerText.match(/\p{Extended_Pictographic}/gu) || []).filter((c) => !'↑↓→←▶▾✓©'.includes(c)));
    ok(emoji.length === 0, 'no emoji in the page text', emoji.slice(0, 5).join(' '));
  }

  // ── colour helpers run in the page ───────────────────────────────────────
  const COLOR_FNS = () => {
    window.__px = (c) => {
      const cv = document.createElement('canvas');
      cv.width = 1;
      cv.height = 1;
      const g = cv.getContext('2d');
      g.fillStyle = c;
      g.fillRect(0, 0, 1, 1);
      return [...g.getImageData(0, 0, 1, 1).data].slice(0, 3);
    };
    window.__lum = (c) => {
      const [r, g, b] = window.__px(c).map((x) => {
        const s = x / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    window.__ratio = (a, b) => {
      const [x, y] = [window.__lum(a), window.__lum(b)].sort((p, q) => q - p);
      return (x + 0.05) / (y + 0.05);
    };
  };

  // ── pens + marks ──────────────────────────────────────────────────────────
  if (want('pens') || want('marks')) {
    for (const theme of ['jade', 'coral', 'arcade']) {
      const tp = await open({ theme, tag: `pens-${theme}` });
      await tp.evaluate(COLOR_FNS);
      const r = await tp.evaluate(() => {
        const sh = document.querySelector('#dl12r-p1-nb');
        const cs = (el) => getComputedStyle(el);
        const v = (n) => cs(sh).getPropertyValue(n).trim();
        const same = (el, pen) => JSON.stringify(window.__px(cs(el).color)) === JSON.stringify(window.__px(v(pen)));
        const fonts = [...sh.querySelectorAll('.dl12r-sh__title, .dl12r-sh__h, .dl12r-sh__t, .dl12r-sh__slides')].map((el) => cs(el).fontFamily);
        const paper = cs(sh).backgroundColor;
        const root = document.querySelector('.dl12r');
        const ground = getComputedStyle(root).getPropertyValue('--ground').trim();
        const surface = getComputedStyle(root).getPropertyValue('--surface').trim();
        const marks = ['.dl12r-lec--1', '.dl12r-lec--2'].map((sel) => {
          const el = document.querySelector(`.dl12r-sec ${sel}`);
          const c = cs(el).color;
          const bg = cs(el).backgroundColor;
          return { ground: window.__ratio(c, ground), surface: window.__ratio(c, surface), outlined: parseFloat(cs(el).borderTopWidth) > 0 && (bg === 'rgba(0, 0, 0, 0)' || bg === 'transparent') };
        });
        return {
          hand: fonts.some((f) => /Patrick Hand|Segoe Print|Comic/i.test(f)),
          title: same(sh.querySelector('.dl12r-sh__title'), '--pen-blue'),
          head: same(sh.querySelector('.dl12r-sh__h'), '--pen-blue'),
          at: same(sh.querySelector('.dl12r-sh__at'), '--pen-blue') && same(sh.querySelector('.dl12r-sh__slides'), '--pen-blue'),
          body: same(sh.querySelector('.dl12r-sh__t'), '--pen-black'),
          mark: same(sh.querySelector('.dl12r-sh__u--bullet .dl12r-sh__mark'), '--pen-red'),
          green: same(sh.querySelector('.dl12r-sh__g'), '--pen-green'),
          contrast: ['--pen-black', '--pen-blue', '--pen-red', '--pen-green'].map((p) => window.__ratio(v(p), paper)),
          marks,
        };
      });
      if (want('pens')) {
        ok(!r.hand, `${theme}: notebook pages use the page's own typefaces (no handwriting font)`);
        ok(r.title && r.head && r.at && r.body && r.mark && r.green, `${theme}: blue headings and receipts, black body, red markers, green highlights`, JSON.stringify({ title: r.title, head: r.head, at: r.at, body: r.body, mark: r.mark, green: r.green }));
        ok(r.contrast.every((c) => c >= 4.5), `${theme}: every pen ≥ 4.5:1 on the paper`, r.contrast.map((c) => c.toFixed(1)).join(' / '));
      }
      if (want('marks')) {
        ok(r.marks.every((x) => x.outlined), `${theme}: the L1/L2 marks are outlined, not filled`);
        ok(r.marks.every((x) => x.ground >= 4.5 && x.surface >= 4.5), `${theme}: L1/L2 marks ≥ 4.5:1 on the ground and the surface`, r.marks.map((x, i) => `L${i + 1} ${x.ground.toFixed(1)}/${x.surface.toFixed(1)}`).join(' · '));
      }
      await tp.close();
    }
  }

  // ── focus mode ────────────────────────────────────────────────────────────
  if (want('focus')) {
    const fp = await open({ tag: 'focus' });
    await fp.click('.dl12r-hero__actions .dl12r-btn--primary');
    await sleep(1400);
    const st = await fp.evaluate(() => {
      const root = document.querySelector('.dl12r');
      return {
        focus: root.classList.contains('dl12r--focus'),
        real: document.fullscreenElement === root,
        pseudo: root.classList.contains('dl12r--pseudo'),
        overflow: getComputedStyle(root).overflowY,
        scrollable: root.scrollHeight > root.clientHeight + 100,
      };
    });
    ok(st.focus && (st.real || st.pseudo), 'focus mode enters (fullscreen or the overlay fallback)', st.real ? 'real fullscreen' : 'overlay');
    ok(st.overflow === 'auto' && st.scrollable, 'in focus mode the root is its own scroller', st.overflow);
    await fp.evaluate(() => {
      const root = document.querySelector('.dl12r');
      const el = document.getElementById('dl12r-s16');
      root.scrollTo({ top: el.getBoundingClientRect().top - root.getBoundingClientRect().top + root.scrollTop - 120, behavior: 'instant' });
    });
    await sleep(600);
    ok((await currentNo(fp)) === '§1.6', 'scrolling inside focus mode moves the page and the header follows', await currentNo(fp));
    await fp.evaluate(() => [...document.querySelectorAll('.dl12r-rail .dl12r-index__item')].find((b) => b.textContent.includes('Batch normalization'))?.click());
    await sleep(900);
    ok((await currentNo(fp)) === '§2.3', 'the rail jumps to a section inside focus mode', await currentNo(fp));
    await fp.evaluate(() => [...document.querySelectorAll('.dl12r-rail .dl12r-index__item--page')].find((b) => b.textContent.includes('Notebook page 2'))?.click());
    await sleep(900);
    ok((await currentNo(fp)) === 'P2', 'the rail jumps straight to a notebook page', await currentNo(fp));
    const lecNow = await fp.$eval('.dl12r-bar__now .dl12r-lec', (el) => el.textContent.trim());
    ok(lecNow.endsWith('L2'), 'the sticky header names the current lecture', lecNow);
    await fp.keyboard.press('Escape');
    await sleep(700);
    let still = await fp.evaluate(() => document.querySelector('.dl12r').classList.contains('dl12r--focus'));
    if (still) {
      await fp.click('.dl12r-bar .dl12r-btn--primary');
      await sleep(900);
      still = await fp.evaluate(() => document.querySelector('.dl12r').classList.contains('dl12r--focus'));
    }
    ok(!still, 'focus mode exits (Esc, or the toggle)');
    ok((await currentNo(fp)) === 'P2', 'leaving focus mode lands back where you were reading', await currentNo(fp));
    await fp.close();
  }

  // ── persistence ───────────────────────────────────────────────────────────
  if (want('persist')) {
    const pp = await open({ tag: 'persist', clear: true });
    const units = await pp.$$('#dl12r-p1-nb .dl12r-sh__u');
    for (const i of [0, 2, 4]) await units[i].click();
    await sleep(300);
    await pp.evaluate(() => {
      const el = document.getElementById('dl12r-s24');
      window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 160, behavior: 'instant' });
    });
    await sleep(700);
    await pp.goto(`${BASE}/portal`, { waitUntil: 'networkidle0' });
    await pp.goto(`${BASE}${ROUTE}`, { waitUntil: 'networkidle0' });
    await pp.waitForSelector('.dl12r-sec');
    await sleep(600);
    const pressed = await pp.$$eval('#dl12r-p1-nb .dl12r-sh__u', (els) => els.map((e) => e.getAttribute('aria-pressed') === 'true'));
    ok(pressed[0] && pressed[2] && pressed[4] && !pressed[1], 'ticked lines survive a reload', pressed.map((p) => (p ? 'x' : '.')).join(''));
    const railCount = await pp.$$eval('.dl12r-rail .dl12r-index__item--page .dl12r-index__state', (els) => els.map((e) => e.textContent.trim()));
    ok(/^3\//.test(railCount[0]) && /^0\//.test(railCount[1]), 'the rail counts each notebook page once', railCount.join(' · '));
    const resume = await pp.$eval('.dl12r-resume .dl12r-btn', (b) => b.textContent.trim()).catch(() => '');
    ok(/Resume at §2\.4/.test(resume), '"Resume at §N" offers the last section', resume);
    if (resume) {
      await pp.click('.dl12r-resume .dl12r-btn');
      await sleep(900);
      ok((await currentNo(pp)) === '§2.4', 'Resume jumps to that section', await currentNo(pp));
    }
    const prog = await pp.$eval('.dl12r-bar__progtext', (el) => el.textContent.replace(/\s+/g, ' '));
    ok(/copied/.test(prog) && !/^0%/.test(prog) && /0\/3 pages/.test(prog), 'the header counts ticked lines and pages (0/3 until a page is complete)', prog);
    await pp.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('dl12r:')).forEach((k) => localStorage.removeItem(k)));
    await pp.close();
  }

  // ── broken storage ────────────────────────────────────────────────────────
  if (want('storage')) {
    const bp = await open({ tag: 'storage', brokenStorage: true });
    const n = await bp.$$eval('.dl12r-sec', (els) => els.length);
    await bp.click('#dl12r-p2-nb .dl12r-sh__u');
    await sleep(200);
    const ticked = await bp.$eval('#dl12r-p2-nb .dl12r-sh__u', (e) => e.getAttribute('aria-pressed'));
    ok(n === SECTIONS.length && ticked === 'true', 'with localStorage throwing, the page renders and ticks still work', `${n} sections`);
    await bp.close();
  }

  // ── reduced motion ────────────────────────────────────────────────────────
  if (want('reduced')) {
    const rp = await open({ tag: 'reduced', reduced: true });
    const n = await rp.$$eval('.dl12r-stage', (els) => els.length);
    ok(n === LABS, 'reduced motion: every lab renders', `${n}/${LABS} labs`);
    // backprop (§1.3) and batch norm (§2.3) open on a chosen middle beat; the rest on their last
    const stories = await rp.$$eval('.dl12r-story', (els) => els.map((s) => {
      const beats = [...s.querySelectorAll('.dl12r-story__beat')];
      const sec = s.closest('.dl12r-sec')?.id;
      const on = beats.findIndex((b) => b.getAttribute('aria-current') === 'step');
      if (sec === 'dl12r-s13' || sec === 'dl12r-s23') return on === 2;
      return beats.length ? on === beats.length - 1 : true;
    }));
    ok(stories.length > 0 && stories.every(Boolean), `reduced motion: every story lab opens on its finished (or chosen) beat (${stories.length} story labs)`);
    const tr = await rp.evaluate(() => ['.dl12r-dline', '.dl12r-bp__edge', '.dl12r-fade', '.dl12r-curve', '.dl12r-gf__bar'].map((sel) => {
      const el = document.querySelector(sel);
      return el ? getComputedStyle(el).transitionDuration.split(',').every((d) => parseFloat(d) === 0) : true;
    }));
    ok(tr.every(Boolean), 'reduced motion: transitions are off (beats jump to their end state)', tr.join(','));
    await rp.click('#dl12r-s13 .dl12r-story__play');
    await sleep(150);
    const b0 = await rp.$eval('#dl12r-s13 .dl12r-story__beat[aria-current="step"]', (el) => el.textContent.trim()).catch(() => '');
    ok(/forward pass/.test(b0), 'reduced motion: ▶ starts straight on beat 1 (no blank stage)', b0);
    await rp.close();
  }

  // ── keyboard ──────────────────────────────────────────────────────────────
  if (want('keyboard')) {
    const kp = await open({ tag: 'keyboard' });
    // §1.2: move a perceptron point with an arrow key
    const lab0 = await kp.$$eval('#dl12r-s12 .dl12r-drag', (els) => els[0].getAttribute('aria-label'));
    await focusEl(kp, '#dl12r-s12 .dl12r-drag', 0);
    await kp.keyboard.press('ArrowRight');
    await sleep(200);
    const lab1 = await kp.$$eval('#dl12r-s12 .dl12r-drag', (els) => els[0].getAttribute('aria-label'));
    ok(lab0 !== lab1, '§1.2: arrow keys move a perceptron point', `${lab0} → ${lab1}`);
    // §1.2 XOR: switch to one TLU, nudge a line handle
    await kp.evaluate(() => [...document.querySelectorAll('#dl12r-s12 .dl12r-switch__opt')].find((b) => b.textContent.trim() === 'one TLU')?.click());
    await sleep(200);
    const h0 = await kp.$eval('#dl12r-s12 .dl12r-handle', (e) => e.getAttribute('aria-valuetext'));
    await focusEl(kp, '#dl12r-s12 .dl12r-handle', 0);
    await kp.keyboard.press('ArrowUp');
    await sleep(150);
    const h1 = await kp.$eval('#dl12r-s12 .dl12r-handle', (e) => e.getAttribute('aria-valuetext'));
    ok(h0 !== h1, '§1.2: the XOR line handle moves by keys', `${h0} → ${h1}`);
    // §1.3: step the backprop story with ← →
    await focusEl(kp, '#dl12r-s13 .dl12r-story__beat', 0);
    await kp.keyboard.press('Enter');
    await kp.keyboard.press('ArrowRight');
    await sleep(200);
    const beat = await kp.$eval('#dl12r-s13 .dl12r-story__beat[aria-current="step"]', (el) => el.textContent.trim()).catch(() => '');
    ok(/error/.test(beat), '§1.3: ← → step through the backprop story', beat);
    // §1.4: classification, raise a logit by keys
    await kp.evaluate(() => [...document.querySelectorAll('#dl12r-s14 .dl12r-switch__opt')].find((b) => b.textContent.trim() === 'classification')?.click());
    await sleep(200);
    const v0 = await kp.$$eval('#dl12r-s14 .dl12r-knob', (els) => Number(els[0].getAttribute('aria-valuenow')));
    await focusEl(kp, '#dl12r-s14 .dl12r-knob', 0);
    await kp.keyboard.press('ArrowUp');
    await kp.keyboard.press('ArrowUp');
    await sleep(200);
    const v1 = await kp.$$eval('#dl12r-s14 .dl12r-knob', (els) => Number(els[0].getAttribute('aria-valuenow')));
    ok(v1 > v0, '§1.4: arrow keys raise a logit', `${v0} → ${v1}`);
    // §2.6: hide an optimizer with the keyboard
    await focusEl(kp, '#dl12r-s26 .dl12r-pickbtn', 0);
    await kp.keyboard.press('Enter');
    await sleep(200);
    const shown = await kp.$$eval('#dl12r-s26 .dl12r-race__run', (els) => els.length);
    ok(shown === 2, '§2.6: Enter on a name hides that optimizer (3 shown by default → 2)', `${shown} paths`);
    await kp.close();
  }

  // ── export ────────────────────────────────────────────────────────────────
  let pdfFile = '';
  if (want('export') || want('pdf')) {
    const ep = await open({ tag: 'export' });
    // move story labs off their last beat first: printing must still show it
    await ep.$$eval('#dl12r-s13 .dl12r-story__beat', (els) => els[0].click());
    await ep.$$eval('#dl12r-s23 .dl12r-story__beat', (els) => els[0].click());
    await ep.$$eval('#dl12r-s26 .dl12r-story__beat', (els) => els[0].click());
    const title0 = await ep.title();
    await ep.evaluate(() => [...document.querySelectorAll('.dl12r-export button')].find((b) => /Export PDF/.test(b.textContent))?.click());
    await ep.waitForFunction(() => window.__printCalls >= 1, { timeout: 20000 }).catch(() => {});
    const during = await ep.evaluate(() => ({
      calls: window.__printCalls || 0,
      cls: document.documentElement.classList.contains('dl12r-printing'),
      title: document.title,
      lastBeats: ['#dl12r-s13', '#dl12r-s23', '#dl12r-s26'].map((s) => [...document.querySelectorAll(`${s} .dl12r-story__beat`)].pop()?.getAttribute('aria-current')),
      drawers: document.querySelectorAll('.dl12r-maths').length,
      open: document.querySelectorAll('.dl12r-maths__body').length,
    }));
    ok(during.calls === 1, 'Export PDF calls window.print exactly once', String(during.calls));
    ok(during.cls && /CITS5017 L1–L2/.test(during.title), 'it prints in print mode, with the PDF title', `${during.title}`);
    ok(during.lastBeats.every((b) => b === 'step'), 'in print mode story labs show their last beat');
    ok(during.drawers >= 12 && during.open === during.drawers, 'in print mode every "Show the maths" drawer is open', `${during.open}/${during.drawers}`);
    if (want('pdf')) {
      await ep.emulateMediaType('print');
      await sleep(700);
      pdfFile = path.join(OUT, 'refresher.pdf');
      await ep.pdf({ path: pdfFile, format: 'A4', printBackground: true, preferCSSPageSize: true });
      await ep.emulateMediaType('screen');
    }
    await ep.evaluate(() => window.dispatchEvent(new Event('afterprint')));
    await sleep(300);
    const after = await ep.evaluate(() => ({ cls: document.documentElement.classList.contains('dl12r-printing'), title: document.title }));
    ok(!after.cls && after.title === title0, 'afterprint restores the page (class and title)', `${after.title}`);
    await ep.close();
  }

  // ── the PDF's text ────────────────────────────────────────────────────────
  if (want('pdf') && pdfFile) {
    const txtFile = pdfFile.replace(/\.pdf$/, '.txt');
    execFileSync('pdftotext', ['-enc', 'UTF-8', pdfFile, txtFile]);
    const text = fs.readFileSync(txtFile, 'utf8').replace(/\s+/g, ' ');
    const pages = Number(/Pages:\s+(\d+)/.exec(execFileSync('pdfinfo', [pdfFile]).toString())?.[1] ?? 0);
    const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const positions = SECTIONS.map((s) => {
      const words = s.title.split(/\s+/).map(esc).join('\\s+');
      const m = new RegExp(`§${esc(s.no)}\\s+${words}\\s+L${s.lec}\\s*·\\s*${esc(receipt(s.slides))}`).exec(text);
      return m ? m.index : -1;
    });
    ok(positions.every((p, i) => p >= 0 && (i === 0 || p > positions[i - 1])), 'the PDF has every section heading with its L1/L2 receipt, in order', positions.map((p, i) => (p < 0 ? SECTIONS[i].no : '')).filter(Boolean).join(', ') || 'all found');
    ok(/Part 1 · 64 slides/.test(text) && /Part 2 · 68 slides/.test(text), 'both part heads print');
    const sheetOnly = ['All of Lecture 1 on one page', 'Converges only if', 'Gradients shrink or grow on the way down', 'Start high, then reduce: faster', 'Not in these notes', 'NOT IN THESE NOTES', 'tick every line', 'fits one page'];
    const leaked = sheetOnly.filter((s) => text.includes(s));
    ok(leaked.length === 0, 'no notebook (Write) text in the PDF', leaked.join(' | '));
    const formulas = [
      ['the perceptron rule', /w_i,j\^\(next step\) = w_i,j \+ η\(y/],
      ['the BN normalization', /\(x⁽ⁱ⁾ − μ_B\)\/√\(σ_B² \+ [εϵ]\)/],
      ['Adam’s bias correction', /m̂ ?← m\/\(1 − β₁ᵗ\)/],
      ['cross-entropy', /J\(θ\) = −\(1\/m\) Σᵢ₌₁\^m Σₖ₌₁\^K yₖ⁽ⁱ⁾ log/],
      ['AdaGrad', /s ← s \+ ∇_θ J\(θ\) ⊗ ∇_θ J\(θ\)/],
      ['the power schedule', /η\(t\) = η₀\/\(1 \+ rt\/s\)\^c/],
      ['Glorot’s variance', /σ² = 1\/fan_avg|1\/fan_avg/],
      ['Huber', /Huber_δ\(z\)/],
    ];
    const badF = formulas.filter(([, re]) => !re.test(text)).map(([n]) => n);
    ok(badF.length === 0, 'key formulas read as plain text in the PDF', badF.join(', '));
    // case-sensitive on purpose: with /i, σ and Σ match each other
    ok(/σ²\s*\((?:normal|NORMAL)\)/.test(text) && !/Σ²\s*\((?:normal|NORMAL)\)/.test(text), 'uppercase table heads leave maths alone (σ² stays σ², not Σ²)');
    ok(/this page’s own/i.test(text), 'page-own numbers are labelled in the PDF');
    ok(/Slide check/i.test(text), 'Slide checks print');
    const leak = /\\(?:frac|mathbf|boldsymbol|theta|eta)|\b(?:boldsymbol|mathbf|tfrac|mathcal|widehat|leftarrow)\b/.exec(text);
    ok(!leak, 'no raw TeX (or TeX command names) leak into the PDF text', leak ? text.slice(Math.max(0, leak.index - 40), leak.index + 40) : '');
    const size = fs.statSync(pdfFile).size;
    console.log(`      PDF: ${pages} pages · ${(size / 1024).toFixed(0)} KB · ${pdfFile}`);
  }

  // ── NotebookLM dropdown ───────────────────────────────────────────────────
  if (want('nlm')) {
    const np = await open({ tag: 'nlm' });
    const toggle = '.dl12r-export__toggle';
    const before = await np.$eval(toggle, (b) => b.getAttribute('aria-expanded'));
    await np.click(toggle);
    await sleep(200);
    const opened = await np.evaluate(() => ({
      exp: document.querySelector('.dl12r-export__toggle').getAttribute('aria-expanded'),
      texts: [...document.querySelectorAll('.dl12r-nlm__text')].map((p) => p.textContent),
      steps: document.querySelectorAll('.dl12r-nlm__steps li').length,
    }));
    const all = [NLM_PROMPT, ...NLM_PARTS.map((p) => p.text)];
    ok(before === 'false' && opened.exp === 'true' && JSON.stringify(opened.texts) === JSON.stringify(all) && opened.steps >= 3, 'the NotebookLM dropdown opens with the refresher prompt, the two-part variant and the steps');
    ok(all.every((t) => t.length < 1000), 'every prompt stays under 1,000 characters (no published limit)', all.map((t) => t.length).join(' / '));
    ok(/Lecture 1/.test(NLM_PROMPT) && /Lecture 2/.test(NLM_PROMPT) && /L1 or L2/.test(NLM_PROMPT) && /Lecture 1/.test(NLM_PARTS[0].text) && /Lecture 2/.test(NLM_PARTS[1].text), 'the prompts name the lecture of each part');
    ok(all.every((t) => /self-test/.test(t)), 'every prompt ends with self-test questions');
    const copies = await np.$$('.dl12r-nlm__copy');
    await copies[1].click();
    await sleep(400);
    const fb = await np.evaluate(() => ({ label: document.querySelectorAll('.dl12r-nlm__copy')[1].textContent, sel: String(window.getSelection()) }));
    ok(/Copied/.test(fb.label) || (/Selected/.test(fb.label) && fb.sel.length > 100), 'Copy copies, or falls back to selecting the prompt', fb.label.trim());
    await np.close();
  }

  // ── every other Deep Learning module still renders ────────────────────────
  if (want('others')) {
    const routes = [
      ['/portal/dl-lecture-1', '.dl'],
      ['/portal/dl-lecture-2', '.dl'],
      ['/portal/dl-lecture-3', '.dl'],
      ['/portal/dl-lecture-3-study', '.dl3s-sec'],
      ['/portal/dl-lecture-4-study', '.dl4s-sec'],
      ['/portal/dl-lecture-5-study', '.dl5s-sec'],
      ['/portal/dl-lecture-6-7-study', '.dl67s-sec'],
      ['/portal/dl-lecture-8-study', '.dl8s-sec'],
      ['/portal/dl-lecture-9-study', '.portal__content *'],
      ['/portal/dl-arcade', '.portal__content *'],
      ['/portal/dl-code-lab', '.portal__content *'],
      ['/portal/dl-project-2', '.portal__content *'],
      ['/portal/dl-game', '.portal__content *'],
    ];
    for (const [route, sel] of routes) {
      const before = consoleMsgs.length;
      let n = 0;
      try {
        const lp = await open({ tag: route.split('/').pop(), route, wait: sel });
        await sleep(400);
        n = await lp.$eval('.portal__content', (el) => el.innerText.length).catch(() => 0);
        await lp.close();
      } catch (e) {
        n = -1;
        consoleMsgs.push(`[${route}] ${e.message}`);
      }
      const errs = consoleMsgs.slice(before).filter((m) => /pageerror/.test(m));
      ok(n > 50 && errs.length === 0, `${route} still renders`, `${n} chars of text${errs.length ? ` · ${errs[0]}` : ''}`);
    }
  }

  // ── screenshots ───────────────────────────────────────────────────────────
  if (want('shots')) {
    for (const theme of ['jade', 'coral', 'arcade']) {
      for (const width of [1440, 390]) {
        const sp = await open({ theme, width, tag: `${theme}-${width}` });
        await sleep(300);
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
