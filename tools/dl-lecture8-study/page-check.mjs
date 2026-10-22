/* ============================================================================
   DL LECTURE 8 STUDY — headless check of /portal/dl-lecture-8-study
   (puppeteer-core + local Edge, seeded through the portal gate; adapted from
   tools/dl-lecture5-study/page-check.mjs)
   ----------------------------------------------------------------------------
     node tools/dl-lecture8-study/page-check.mjs [outDir]      (dev server on 5173)
     SITE_URL=http://localhost:5173 ONLY=export,pdf node tools/dl-lecture8-study/page-check.mjs out

   window.print is stubbed before the page loads in EVERY run, so a print
   dialog can never hang an unattended check.

   Checks
     coverage   slides 1–51 covered once each, in order; notebook budget
                (≤ 10 units a page, under 100 in all)
     render     every section with its slide receipt and Read beat, every lab
                mounted with a title and a "Try this", every notebook page
                with all its tickable units; the lazy data arrives; no KaTeX
                errors; §16 flagged "not examined"
     clean      no duplicate ids, no nested buttons, labelled figures, no emoji
     pens       notebook pages: no handwriting font; blue headings, black body,
                red markers, green highlights; every pen ≥ 4.5:1 (3 themes)
     focus      focus mode enters, scrolls by itself with the header following,
                the rail jumps, and it exits
     persist    ticks survive a reload; "Resume at §N" offers and jumps
     storage    with localStorage throwing, the page renders and ticks
     reduced    prefers-reduced-motion: every lab renders, opens on its last
                beat, and story transitions are off
     keyboard   §6 (choose a decoder step, move a score handle) and §11 (step
                the story, choose a query row, the d_keys scrubber) by keys
     export     Export PDF calls the stubbed print once, in print mode, labs
                on their last beat, maths drawers open; afterprint restores
     pdf        print mode → page.pdf → pdftotext: every section heading in
                order, no notebook text, the attention and positional-encoding
                maths as readable text, §16 flagged
     nlm        the NotebookLM dropdown: three prompts, each < 1,000
                characters, Copy copies or selects
     others     Lectures 3, 4, 5 and 6–7 still render
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
const MOD = path.join(REPO, 'src/components/portal/modules/deep-learning/lecture8-study');
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const BASE = process.env.SITE_URL || 'http://localhost:5173';
const ROUTE = '/portal/dl-lecture-8-study';
const OUT = path.resolve(process.argv[2] || path.join(HERE, 'out'));
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
const want = (k) => !ONLY.length || ONLY.includes(k);
fs.mkdirSync(OUT, { recursive: true });

const { SECTIONS } = await import(pathToFileURL(path.join(MOD, 'sections.js')).href);
const { SHEETS, sheetKeys } = await import(pathToFileURL(path.join(MOD, 'sheets/index.js')).href);
const { NLM_PROMPT, NLM_PARTS } = await import(pathToFileURL(path.join(MOD, 'exportPrompt.js')).href);

const fails = [];
const ok = (cond, label, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${extra !== '' ? `  — ${extra}` : ''}`);
  if (!cond) fails.push(label);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const SEED = () => {
  sessionStorage.setItem('portal_auth', JSON.stringify({ token: 'mock-session-token', key: 'wiggy1', issued_at: new Date().toISOString() }));
  // a real print dialog would hang an unattended run
  window.print = () => { window.__printCalls = (window.__printCalls || 0) + 1; };
};

const browser = await puppeteer.launch({ executablePath: EDGE, headless: 'new', args: ['--hide-scrollbars'] });
const consoleMsgs = [];

async function open({ theme = 'jade', width = 1440, height = 900, reduced = false, brokenStorage = false, clear = false, route = ROUTE, wait = '.dl8s-sec', tag = '' } = {}) {
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
      if (wipe && !sessionStorage.getItem('dl8s-check-wiped')) {
        Object.keys(localStorage).filter((k) => k.startsWith('dl8s:')).forEach((k) => localStorage.removeItem(k));
        sessionStorage.setItem('dl8s-check-wiped', '1');
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

// the lazy data (bus/rail runs, the toy transformer) has arrived
const dataReady = (page) => page.waitForFunction(() => !/Loading this page/.test(document.querySelector('.dl8s')?.innerText ?? ''), { timeout: 20000 }).catch(() => {});
const currentNo = (page) => page.$eval('.dl8s-bar__nowno', (el) => el.textContent.trim());
const sheetSize = (id) => sheetKeys(SHEETS[id]).length;
const withPages = SECTIONS.filter((s) => sheetSize(s.id) > 0);
const focusEl = (page, sel, i = 0) => page.$$eval(sel, (els, k) => els[k]?.focus(), i);

try {
  // ── coverage (from the data) ──────────────────────────────────────────────
  if (want('coverage')) {
    const seen = [];
    SECTIONS.forEach((s) => String(s.slides).split(',').forEach((part) => {
      const [a, b] = part.trim().split(/[–-]/).map(Number);
      for (let n = a; n <= (b || a); n++) seen.push(n);
    }));
    ok(JSON.stringify(seen) === JSON.stringify(Array.from({ length: 51 }, (_, i) => i + 1)), 'slides 1–51 each covered exactly once, in order', `${seen.length} slides, ${SECTIONS.length} sections`);
    const sizes = SECTIONS.map((s) => [s.id, sheetSize(s.id)]);
    const total = sizes.reduce((a, [, n]) => a + n, 0);
    const big = sizes.filter(([, n]) => n > 10).map(([id, n]) => `${id}:${n}`);
    ok(big.length === 0 && total < 100, 'notebook budget: at most 10 units a page, under 100 in all', `${total} units · ${sizes.filter(([, n]) => n).map(([id, n]) => `${id} ${n}`).join(', ')}`);
  }

  const page = await open({ tag: 'main', clear: true });

  // ── render ────────────────────────────────────────────────────────────────
  if (want('render')) {
    await dataReady(page);
    await sleep(400);
    const dom = await page.$$eval('.dl8s-sec', (els) => els.map((el) => ({
      id: el.id.replace('dl8s-', ''),
      receipt: el.querySelector('.dl8s-receipt')?.textContent.trim(),
      flag: el.querySelector('.dl8s-flag')?.textContent.trim() ?? '',
      read: !!el.querySelector('.dl8s-beat--read .dl8s-read'),
      labs: [...el.querySelectorAll('.dl8s-beat--play .dl8s-stage')].map((l) => ({
        title: l.querySelector('.dl8s-stage__title')?.textContent.trim(),
        tryThis: !!l.querySelector('.dl8s-stage__try'),
        size: l.getBoundingClientRect().height,
      })),
      units: el.querySelectorAll('.dl8s-sh .dl8s-sh__u, .dl8s-sh .dl8s-sh__tr:not(.dl8s-sh__tr--head), .dl8s-sh .dl8s-sh__figu').length,
      nb: !!document.getElementById(`${el.id}-nb`),
    })));
    ok(dom.length === SECTIONS.length && dom.every((d, i) => d.id === SECTIONS[i].id), `all ${SECTIONS.length} sections rendered, in order`);
    const receiptBad = dom.filter((d, i) => d.receipt !== `${/[–,]/.test(SECTIONS[i].slides) ? 'slides' : 'slide'} ${SECTIONS[i].slides}`).map((d) => `${d.id}:${d.receipt}`);
    ok(receiptBad.length === 0, 'every section shows its slide receipt', receiptBad.join(', '));
    ok(dom.every((d) => d.read), 'every section has its Read beat');
    const labBad = dom.filter((d, i) => d.labs.length !== (SECTIONS[i].play?.length ?? 0) || d.labs.some((l) => !l.title || !l.tryThis || l.size < 80)).map((d) => `${d.id}:${d.labs.map((l) => `${l.title}${l.tryThis ? '' : ' (no try)'}`).join('/')}`);
    ok(labBad.length === 0, `every lab mounted with a title and a "Try this" (${dom.reduce((a, d) => a + d.labs.length, 0)} labs)`, labBad.join(', '));
    const nbBad = dom.filter((d) => (sheetSize(d.id) > 0) !== d.nb || d.units !== sheetSize(d.id)).map((d) => `${d.id}:${d.units}/${sheetSize(d.id)}`);
    ok(nbBad.length === 0, `every notebook page rendered with all its tickable units (${withPages.length} pages; §0, §16 and §17 have none)`, nbBad.join(', '));
    ok(dom.find((d) => d.id === 's16')?.flag.includes('not examined') && dom.filter((d) => d.flag).length === 1, '§16 alone is flagged "not examined"');
    const tex = await page.$$eval('.katex-error', (els) => els.map((e) => e.textContent.slice(0, 60)));
    ok(tex.length === 0, 'no KaTeX parse errors', tex.slice(0, 3).join(' | '));
    const loading = await page.$eval('.dl8s', (el) => /Loading this page|could not be loaded/.test(el.innerText));
    ok(!loading, 'the lazy data (bus/rail runs, toy transformer) arrives');
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
    const unlabelled = await page.$$eval('.dl8s svg[role="img"], .dl8s canvas[role="img"]', (els) => els.filter((s) => !(s.getAttribute('aria-label') || '').trim()).length);
    ok(unlabelled === 0, 'every role="img" figure has an aria-label');
    const emoji = await page.$eval('.dl8s', (el) => (el.innerText.match(/\p{Extended_Pictographic}/gu) || []).filter((c) => !'↑↓→←▶▾✓'.includes(c)));
    ok(emoji.length === 0, 'no emoji in the page text', emoji.slice(0, 5).join(' '));
  }

  // ── pens ──────────────────────────────────────────────────────────────────
  if (want('pens')) {
    for (const theme of ['jade', 'coral', 'arcade']) {
      const tp = await open({ theme, tag: `pens-${theme}` });
      const r = await tp.evaluate(() => {
        const sh = document.querySelector('#dl8s-s02-nb');
        const cs = (el) => getComputedStyle(el);
        const v = (n) => cs(sh).getPropertyValue(n).trim();
        const toRgb = (c) => {
          const d = document.createElement('i');
          d.style.color = c;
          document.body.appendChild(d);
          const out = getComputedStyle(d).color;
          d.remove();
          return out;
        };
        // any CSS colour (color-mix, color(srgb …)) → its sRGB pixel
        const px = (c) => {
          const cv = document.createElement('canvas');
          cv.width = 1;
          cv.height = 1;
          const g = cv.getContext('2d');
          g.fillStyle = c;
          g.fillRect(0, 0, 1, 1);
          return `rgb(${[...g.getImageData(0, 0, 1, 1).data].slice(0, 3).join(',')})`;
        };
        const lum = (rgb0) => {
          const rgb = px(rgb0);
          const [r, g, b] = rgb.match(/[\d.]+/g).slice(0, 3).map(Number).map((x) => {
            const s = x / 255;
            return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
          });
          return 0.2126 * r + 0.7152 * g + 0.0722 * b;
        };
        const ratio = (a, b) => {
          const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
          return (x + 0.05) / (y + 0.05);
        };
        const fonts = [...sh.querySelectorAll('.dl8s-sh__title, .dl8s-sh__h, .dl8s-sh__t, .dl8s-sh__slides')].map((el) => cs(el).fontFamily);
        const paper = cs(sh).backgroundColor;
        return {
          hand: fonts.some((f) => /Patrick Hand|Segoe Print|Comic/i.test(f)),
          title: cs(sh.querySelector('.dl8s-sh__title')).color === toRgb(v('--pen-blue')),
          head: cs(sh.querySelector('.dl8s-sh__h')).color === toRgb(v('--pen-blue')),
          body: cs(sh.querySelector('.dl8s-sh__t')).color === toRgb(v('--pen-black')),
          mark: cs(sh.querySelector('.dl8s-sh__u--bullet .dl8s-sh__mark')).color === toRgb(v('--pen-red')),
          green: cs(sh.querySelector('.dl8s-sh__g')).color === toRgb(v('--pen-green')),
          contrast: ['--pen-black', '--pen-blue', '--pen-red', '--pen-green'].map((p) => ratio(toRgb(v(p)), paper)),
        };
      });
      ok(!r.hand, `${theme}: notebook pages use the page's own typefaces (no handwriting font)`);
      ok(r.title && r.head && r.body && r.mark && r.green, `${theme}: blue headings, black body, red markers, green highlights`, JSON.stringify({ title: r.title, head: r.head, body: r.body, mark: r.mark, green: r.green }));
      ok(r.contrast.every((c) => c >= 4.5), `${theme}: every pen ≥ 4.5:1 on the paper`, r.contrast.map((c) => c.toFixed(1)).join(' / '));
      await tp.close();
    }
  }

  // ── focus mode ────────────────────────────────────────────────────────────
  if (want('focus')) {
    const fp = await open({ tag: 'focus' });
    await fp.click('.dl8s-hero__actions .dl8s-btn--primary');
    await sleep(1400);
    const st = await fp.evaluate(() => {
      const root = document.querySelector('.dl8s');
      return {
        focus: root.classList.contains('dl8s--focus'),
        real: document.fullscreenElement === root,
        pseudo: root.classList.contains('dl8s--pseudo'),
        overflow: getComputedStyle(root).overflowY,
        scrollable: root.scrollHeight > root.clientHeight + 100,
      };
    });
    ok(st.focus && (st.real || st.pseudo), 'focus mode enters (fullscreen or the overlay fallback)', st.real ? 'real fullscreen' : 'overlay');
    ok(st.overflow === 'auto' && st.scrollable, 'in focus mode the root is its own scroller', st.overflow);
    await fp.evaluate(() => {
      const root = document.querySelector('.dl8s');
      const el = document.getElementById('dl8s-s07');
      root.scrollTo({ top: el.getBoundingClientRect().top - root.getBoundingClientRect().top + root.scrollTop - 120, behavior: 'instant' });
    });
    await sleep(600);
    ok((await currentNo(fp)) === '§7', 'scrolling inside focus mode moves the page and the header follows', await currentNo(fp));
    await fp.evaluate(() => [...document.querySelectorAll('.dl8s-rail .dl8s-index__item')].find((b) => b.textContent.includes('Positional encodings'))?.click());
    await sleep(900);
    ok((await currentNo(fp)) === '§10', 'the index rail jumps to a section inside focus mode', await currentNo(fp));
    await fp.keyboard.press('Escape');
    await sleep(700);
    let still = await fp.evaluate(() => document.querySelector('.dl8s').classList.contains('dl8s--focus'));
    if (still) {
      await fp.click('.dl8s-bar .dl8s-btn--primary');
      await sleep(900);
      still = await fp.evaluate(() => document.querySelector('.dl8s').classList.contains('dl8s--focus'));
    }
    ok(!still, 'focus mode exits (Esc, or the toggle)');
    ok((await currentNo(fp)) === '§10', 'leaving focus mode lands back on the section being read', await currentNo(fp));
    await fp.close();
  }

  // ── persistence ───────────────────────────────────────────────────────────
  if (want('persist')) {
    const pp = await open({ tag: 'persist', clear: true });
    const units = await pp.$$('#dl8s-s02-nb .dl8s-sh__u');
    for (const i of [0, 2, 4]) await units[i].click();
    await sleep(300);
    await pp.evaluate(() => {
      const el = document.getElementById('dl8s-s07');
      window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 160, behavior: 'instant' });
    });
    await sleep(700);
    await pp.goto(`${BASE}/portal`, { waitUntil: 'networkidle0' });
    await pp.goto(`${BASE}${ROUTE}`, { waitUntil: 'networkidle0' });
    await pp.waitForSelector('.dl8s-sec');
    await sleep(600);
    const pressed = await pp.$$eval('#dl8s-s02-nb .dl8s-sh__u', (els) => els.map((e) => e.getAttribute('aria-pressed') === 'true'));
    ok(pressed[0] && pressed[2] && pressed[4] && !pressed[1], 'ticked lines survive a reload', pressed.map((p) => (p ? 'x' : '.')).join(''));
    const resume = await pp.$eval('.dl8s-resume .dl8s-btn', (b) => b.textContent.trim()).catch(() => '');
    ok(/Resume at §7/.test(resume), '"Resume at §N" offers the last section', resume);
    if (resume) {
      await pp.click('.dl8s-resume .dl8s-btn');
      await sleep(900);
      ok((await currentNo(pp)) === '§7', 'Resume jumps to that section', await currentNo(pp));
    }
    const prog = await pp.$eval('.dl8s-bar__progtext', (el) => el.textContent.replace(/\s+/g, ' '));
    ok(/copied/.test(prog) && !/^0%/.test(prog), 'the header counts the ticked lines', prog);
    await pp.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('dl8s:')).forEach((k) => localStorage.removeItem(k)));
    await pp.close();
  }

  // ── broken storage ────────────────────────────────────────────────────────
  if (want('storage')) {
    const bp = await open({ tag: 'storage', brokenStorage: true });
    const n = await bp.$$eval('.dl8s-sec', (els) => els.length);
    await bp.click('#dl8s-s01-nb .dl8s-sh__u');
    await sleep(200);
    const ticked = await bp.$eval('#dl8s-s01-nb .dl8s-sh__u', (e) => e.getAttribute('aria-pressed'));
    ok(n === SECTIONS.length && ticked === 'true', 'with localStorage throwing, the page renders and ticks still work', `${n} sections`);
    await bp.close();
  }

  // ── reduced motion ────────────────────────────────────────────────────────
  if (want('reduced')) {
    const rp = await open({ tag: 'reduced', reduced: true });
    await dataReady(rp);
    const n = await rp.$$eval('.dl8s-stage', (els) => els.length);
    const labs = SECTIONS.reduce((a, s) => a + (s.play?.length ?? 0), 0);
    ok(n === labs, 'reduced motion: every lab renders', `${n}/${labs} labs`);
    const stories = await rp.$$eval('.dl8s-story', (els) => els.map((s) => {
      const beats = [...s.querySelectorAll('.dl8s-story__beat')];
      return beats.length ? beats[beats.length - 1].getAttribute('aria-current') === 'step' : true;
    }));
    ok(stories.length > 0 && stories.every(Boolean), `reduced motion: every story lab opens on its last beat (${stories.length} story labs)`);
    const tr = await rp.evaluate(() => ['.dl8s-cone', '.dl8s-cell', '.dl8s-fade', '.dl8s-knob__dot'].map((sel) => {
      const el = document.querySelector(sel);
      return el ? getComputedStyle(el).transitionDuration.split(',').every((d) => parseFloat(d) === 0) : true;
    }));
    ok(tr.every(Boolean), 'reduced motion: story transitions are off (beats jump to their end state)', tr.join(','));
    await rp.click('#dl8s-s06 .dl8s-story__play');
    await sleep(150);
    const b0 = await rp.$eval('#dl8s-s06 .dl8s-story__beat[aria-current="step"]', (el) => el.textContent.trim()).catch(() => '');
    ok(/score/.test(b0), 'reduced motion: ▶ starts straight on beat 1 (no blank stage)', b0);
    await rp.close();
  }

  // ── keyboard ──────────────────────────────────────────────────────────────
  if (want('keyboard')) {
    const kp = await open({ tag: 'keyboard' });
    // §6: choose "me" with Enter, then raise a score handle with ArrowUp
    await focusEl(kp, '#dl8s-s06 .dl8s-tok--btn', 0);
    await kp.keyboard.press('Enter');
    await sleep(200);
    const me = await kp.$$eval('#dl8s-s06 .dl8s-tok--btn', (els) => els[0].getAttribute('aria-pressed'));
    ok(me === 'true', '§6: Enter on a decoder word makes it the step');
    const v0 = await kp.$$eval('#dl8s-s06 .dl8s-knob', (els) => Number(els[2].getAttribute('aria-valuenow')));
    await focusEl(kp, '#dl8s-s06 .dl8s-knob', 2);
    await kp.keyboard.press('ArrowUp');
    await kp.keyboard.press('ArrowUp');
    await sleep(200);
    const v1 = await kp.$$eval('#dl8s-s06 .dl8s-knob', (els) => Number(els[2].getAttribute('aria-valuenow')));
    ok(v1 > v0, '§6: arrow keys move a score handle', `${v0} → ${v1}`);
    // §11: the story by arrow keys, a query row by Enter, d_keys by End
    await focusEl(kp, '#dl8s-s11 .dl8s-story__beat', 0);
    await kp.keyboard.press('Enter');
    await kp.keyboard.press('ArrowRight');
    await sleep(200);
    const beat = await kp.$eval('#dl8s-s11 .dl8s-story__beat[aria-current="step"]', (el) => el.textContent.trim()).catch(() => '');
    ok(/√d_keys/.test(beat), '§11: ← → step through the story', beat);
    await focusEl(kp, '#dl8s-s11 .dl8s-tok--btn', 2);
    await kp.keyboard.press(' ');
    await sleep(150);
    const el = await kp.$$eval('#dl8s-s11 .dl8s-tok--btn', (els) => els[2].getAttribute('aria-pressed'));
    ok(el === 'true', '§11: Space on a query word traces its row');
    await focusEl(kp, '#dl8s-s11 .dl8s-scrub', 0);
    await kp.keyboard.press('End');
    await sleep(200);
    const d = await kp.$eval('#dl8s-s11 .dl8s-scrub', (e) => e.getAttribute('aria-valuenow'));
    const sat = await kp.$$eval('#dl8s-s11 .dl8s-chal', (els) => els.some((c) => c.classList.contains('dl8s-chal--done')));
    ok(d === '512' && sat, '§11: End takes d_keys to 512 and the unscaled softmax saturates (challenge met)', `d_keys ${d}`);
    await kp.close();
  }

  // ── export ────────────────────────────────────────────────────────────────
  let pdfFile = '';
  if (want('export') || want('pdf')) {
    const ep = await open({ tag: 'export' });
    await dataReady(ep);
    // move a lab off its last beat first: printing must still show the last
    await ep.$$eval('#dl8s-s06 .dl8s-story__beat', (els) => els[0].click());
    const title0 = await ep.title();
    await ep.evaluate(() => [...document.querySelectorAll('.dl8s-export button')].find((b) => /Export PDF/.test(b.textContent))?.click());
    await ep.waitForFunction(() => window.__printCalls >= 1, { timeout: 20000 }).catch(() => {});
    const during = await ep.evaluate(() => ({
      calls: window.__printCalls || 0,
      cls: document.documentElement.classList.contains('dl8s-printing'),
      title: document.title,
      lastBeat: [...document.querySelectorAll('#dl8s-s06 .dl8s-story__beat')].pop()?.getAttribute('aria-current'),
      drawers: document.querySelectorAll('.dl8s-maths').length,
      open: document.querySelectorAll('.dl8s-maths__body').length,
    }));
    ok(during.calls === 1, 'Export PDF calls window.print exactly once', String(during.calls));
    ok(during.cls && /CITS5017 L8/.test(during.title), 'it prints in print mode, with the PDF title', `${during.title}`);
    ok(during.lastBeat === 'step', 'in print mode a story lab shows its last beat');
    ok(during.drawers > 10 && during.open === during.drawers, 'in print mode every "Show the maths" drawer is open', `${during.open}/${during.drawers}`);
    if (want('pdf')) {
      await ep.emulateMediaType('print');
      await sleep(600);
      pdfFile = path.join(OUT, 'lecture8.pdf');
      await ep.pdf({ path: pdfFile, format: 'A4', printBackground: true, preferCSSPageSize: true });
      await ep.emulateMediaType('screen');
    }
    await ep.evaluate(() => window.dispatchEvent(new Event('afterprint')));
    await sleep(300);
    const after = await ep.evaluate(() => ({ cls: document.documentElement.classList.contains('dl8s-printing'), title: document.title }));
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
      const m = new RegExp(`§${s.no}\\s+${words}\\s+(?:not examined · slide 47\\s+)?SLIDES?\\s+${esc(s.slides)}`).exec(text);
      return m ? m.index : -1;
    });
    ok(positions.every((p, i) => p >= 0 && (i === 0 || p > positions[i - 1])), 'the PDF has every section heading (title + slide range), in order', positions.join(', '));
    const sheetOnly = ['Only the last encoder state is passed to the decoder', 'Run two recurrent layers on the same inputs, one left to right', 'Precompute P in the constructor', 'Not in these notes', 'tick every line'];
    const leaked = sheetOnly.filter((s) => text.includes(s));
    ok(leaked.length === 0, 'no notebook (Write) text in the PDF', leaked.join(' | '));
    ok(text.includes('Attention(Q, K, V) = softmax(QKᵀ/√d_keys)V'), 'scaled dot-product attention reads as text');
    ok(text.includes('P_p,i = sin(p/1000^(i/d)) if i is even; cos(p/1000^((i−1)/d)) if i is odd'), 'the positional-encoding formula reads as text');
    // pdftotext puts a space after the combining tilde of h̃
    ok(/h̃\s?₍ₜ₎ = Σᵢ α_\(t,i\) y₍ᵢ₎/.test(text) && text.includes('α_(t,i) = (exp(e_(t,i)))/(Σ_i′ exp(e_(t,i′)))'), 'Luong’s weighted sum and softmax read as text');
    ok(text.includes('pos_emb[0, :, ::2] = np.sin(p / 10_000 ** (i / embed_size)).T'), 'code comes out as normal text');
    ok(/not examined · slide 47/.test(text), '§16 is flagged in the PDF');
    ok(/this page’s own/i.test(text), 'page-own numbers are labelled in the PDF');
    console.log(`      PDF: ${pages} pages · ${(fs.statSync(pdfFile).size / 1024).toFixed(0)} KB · ${pdfFile}`);
  }

  // ── NotebookLM dropdown ───────────────────────────────────────────────────
  if (want('nlm')) {
    const np = await open({ tag: 'nlm' });
    const toggle = '.dl8s-export__toggle';
    const before = await np.$eval(toggle, (b) => b.getAttribute('aria-expanded'));
    await np.click(toggle);
    await sleep(200);
    const opened = await np.evaluate(() => ({
      exp: document.querySelector('.dl8s-export__toggle').getAttribute('aria-expanded'),
      texts: [...document.querySelectorAll('.dl8s-nlm__text')].map((p) => p.textContent),
      steps: document.querySelectorAll('.dl8s-nlm__steps li').length,
    }));
    const all = [NLM_PROMPT, ...NLM_PARTS.map((p) => p.text)];
    ok(before === 'false' && opened.exp === 'true' && JSON.stringify(opened.texts) === JSON.stringify(all) && opened.steps >= 3, 'the NotebookLM dropdown opens with the single prompt, the two-part variant and the steps');
    ok(all.every((t) => t.length < 1000), 'every prompt stays under 1,000 characters (no published limit)', all.map((t) => t.length).join(' / '));
    ok(all.every((t) => /§16|not examined/.test(t) || /§0 to §8/.test(t)), 'the prompts skip §16 (part 1 never reaches it)');
    const copies = await np.$$('.dl8s-nlm__copy');
    await copies[1].click();
    await sleep(400);
    const fb = await np.evaluate(() => ({ label: document.querySelectorAll('.dl8s-nlm__copy')[1].textContent, sel: String(window.getSelection()) }));
    ok(/Copied/.test(fb.label) || (/Selected/.test(fb.label) && fb.sel.length > 100), 'Copy copies, or falls back to selecting the prompt', fb.label.trim());
    await np.close();
  }

  // ── the other study modules still fine ────────────────────────────────────
  if (want('others')) {
    for (const [route, sel, min] of [
      ['/portal/dl-lecture-3-study', '.dl3s-sec', 18],
      ['/portal/dl-lecture-4-study', '.dl4s-sec', 18],
      ['/portal/dl-lecture-5-study', '.dl5s-sec', 11],
      ['/portal/dl-lecture-6-7-study', '.dl67s-sec', 13],
    ]) {
      const lp = await open({ tag: route.split('/').pop(), route, wait: sel });
      const n = await lp.$$eval(sel, (els) => els.length);
      ok(n >= min, `${route} still renders`, `${n} sections`);
      await lp.close();
    }
  }

  // ── screenshots ───────────────────────────────────────────────────────────
  if (want('shots')) {
    for (const theme of ['jade', 'coral', 'arcade']) {
      for (const width of [1440, 390]) {
        const sp = await open({ theme, width, tag: `${theme}-${width}` });
        await dataReady(sp);
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
