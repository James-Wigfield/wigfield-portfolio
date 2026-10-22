/* ============================================================================
   DL LECTURES 6–7 STUDY — headless check of /portal/dl-lecture-6-7-study
   (puppeteer-core + local Edge, seeded through the portal gate; adapted from
   tools/dl-lecture5-study/page-check.mjs)
   ----------------------------------------------------------------------------
     node tools/dl-lecture6-7-study/page-check.mjs [outDir]      (dev server on 5173)
     SITE_URL=http://localhost:5173 ONLY=export,pdf node tools/dl-lecture6-7-study/page-check.mjs out

   Checks
     coverage   slides 1–32 covered once each, in order; notebook budget
                (≤ 8 units a page, under 70 in all)
     render     every section with its slide receipt and Read beat, every lab
                mounted with a "Try this", every notebook page with all its
                tickable units; no KaTeX errors
     clean      no duplicate ids, no nested buttons, labelled SVG figures, no
                emoji
     pens       notebook pages: no handwriting font; headings in --pen-blue,
                body in --pen-black, markers in --pen-red, highlights in
                --pen-green; body text ≥ 4.5:1 on the paper in all 3 themes
     focus      focus mode enters (fullscreen or the overlay), scrolls by
                itself with the header following, and exits
     persist    ticks survive a reload; "Resume at §N" offers and jumps
     storage    with localStorage throwing, the page renders and ticks
     reduced    prefers-reduced-motion: renders; the §9 toy GAN jumps to the end
     export     Export PDF calls the stubbed window.print once, in print
                mode with the PDF title; afterprint restores everything
     pdf        the same print mode → page.pdf (A4) → pdftotext: every section
                title in order, no notebook text, maths as readable text
     nlm        the NotebookLM dropdown opens (aria-expanded) and Copy copies
                or falls back to selecting the prompt
     others     /portal/dl-lecture-3-study, -4-study and -5-study still render
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
const MOD = path.join(REPO, 'src/components/portal/modules/deep-learning/lecture6-7-study');
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const BASE = process.env.SITE_URL || 'http://localhost:5173';
const ROUTE = '/portal/dl-lecture-6-7-study';
const OUT = path.resolve(process.argv[2] || path.join(HERE, 'out'));
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
const want = (k) => !ONLY.length || ONLY.includes(k);
fs.mkdirSync(OUT, { recursive: true });

const { SECTIONS } = await import(pathToFileURL(path.join(MOD, 'sections.js')).href);
const { SHEETS, sheetKeys } = await import(pathToFileURL(path.join(MOD, 'sheets/index.js')).href);
const { NLM_PROMPT } = await import(pathToFileURL(path.join(MOD, 'exportPrompt.js')).href);

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

async function open({ theme = 'jade', width = 1440, height = 900, reduced = false, brokenStorage = false, clear = false, route = ROUTE, wait = '.dl67s-sec', tag = '' } = {}) {
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
      if (wipe && !sessionStorage.getItem('dl67s-check-wiped')) {
        Object.keys(localStorage).filter((k) => k.startsWith('dl67s:')).forEach((k) => localStorage.removeItem(k));
        sessionStorage.setItem('dl67s-check-wiped', '1');
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

const currentNo = (page) => page.$eval('.dl67s-bar__nowno', (el) => el.textContent.trim());
const sheetSize = (id) => sheetKeys(SHEETS[id]).length;
const withPages = SECTIONS.filter((s) => sheetSize(s.id) > 0);
const plain = (s) => s.replace(/\{g\|/g, '').replace(/[`*$]/g, '').replace(/[{}]/g, '');

try {
  // ── coverage (from the data) ──────────────────────────────────────────────
  if (want('coverage')) {
    const seen = [];
    SECTIONS.forEach((s) => String(s.slides).split(',').forEach((part) => {
      const [a, b] = part.trim().split(/[–-]/).map(Number);
      for (let n = a; n <= (b || a); n++) seen.push(n);
    }));
    ok(JSON.stringify(seen) === JSON.stringify(Array.from({ length: 32 }, (_, i) => i + 1)), 'slides 1–32 each covered exactly once, in order', `${seen.length} slides, ${SECTIONS.length} sections`);
    const sizes = SECTIONS.map((s) => [s.id, sheetSize(s.id)]);
    const total = sizes.reduce((a, [, n]) => a + n, 0);
    const big = sizes.filter(([, n]) => n > 8).map(([id, n]) => `${id}:${n}`);
    ok(big.length === 0 && total < 70, 'notebook budget: at most 8 units a page, under 70 in all', `${total} units · ${sizes.map(([id, n]) => `${id} ${n}`).join(', ')}`);
  }

  const page = await open({ tag: 'main', clear: true });

  // ── render ────────────────────────────────────────────────────────────────
  if (want('render')) {
    const dom = await page.$$eval('.dl67s-sec', (els) => els.map((el) => ({
      id: el.id.replace('dl67s-', ''),
      receipt: el.querySelector('.dl67s-receipt')?.textContent.trim(),
      read: !!el.querySelector('.dl67s-beat--read .dl67s-read'),
      labs: [...el.querySelectorAll('.dl67s-beat--play .dl67s-lab')].map((l) => ({
        title: l.querySelector('.dl67s-lab__name')?.textContent.trim(),
        tryThis: !!l.querySelector('.dl67s-try'),
        size: l.getBoundingClientRect().height,
      })),
      units: el.querySelectorAll('.dl67s-sh .dl67s-sh__u, .dl67s-sh .dl67s-sh__tr:not(.dl67s-sh__tr--head), .dl67s-sh .dl67s-sh__figu').length,
      nb: !!document.getElementById(`${el.id}-nb`),
    })));
    ok(dom.length === SECTIONS.length && dom.every((d, i) => d.id === SECTIONS[i].id), `all ${SECTIONS.length} sections rendered, in order`);
    const receiptBad = dom.filter((d, i) => d.receipt !== `${/[–,]/.test(SECTIONS[i].slides) ? 'slides' : 'slide'} ${SECTIONS[i].slides}`).map((d) => `${d.id}:${d.receipt}`);
    ok(receiptBad.length === 0, 'every section shows its slide receipt', receiptBad.join(', '));
    ok(dom.every((d) => d.read), 'every section has its Read beat');
    const labBad = dom.filter((d, i) => d.labs.length !== (SECTIONS[i].play?.length ?? 0) || d.labs.some((l) => !l.title || !l.tryThis || l.size < 80)).map((d) => d.id);
    ok(labBad.length === 0, `every lab mounted with a title and a "Try this" (${dom.reduce((a, d) => a + d.labs.length, 0)} labs)`, labBad.join(', '));
    const nbBad = dom.filter((d) => (sheetSize(d.id) > 0) !== d.nb || d.units !== sheetSize(d.id)).map((d) => `${d.id}:${d.units}/${sheetSize(d.id)}`);
    ok(nbBad.length === 0, `every notebook page rendered with all its tickable units (${withPages.length} pages; §0 and §12 have none)`, nbBad.join(', '));
    const tex = await page.$$eval('.katex-error', (els) => els.map((e) => e.textContent.slice(0, 60)));
    ok(tex.length === 0, 'no KaTeX parse errors', tex.slice(0, 3).join(' | '));
    // the lazy Fashion MNIST runs arrive and the VAE decodes in the browser
    await page.waitForSelector('#dl67s-s03 .dl67s-vl canvas', { timeout: 20000 }).catch(() => {});
    await page.waitForSelector('#dl67s-s06 .dl67s-gen__grid canvas', { timeout: 20000 }).catch(() => {});
    await sleep(500);
    const canv = await page.evaluate(() => ['s01', 's02', 's03', 's06', 's10', 's11'].map((id) => document.querySelectorAll(`#dl67s-${id} canvas`).length));
    ok(canv.every((n) => n > 0), 'the Fashion MNIST runs load (images drawn in §1, §2, §3, §6, §10, §11)', canv.join(' / '));
    const inked = await page.$$eval('#dl67s-s06 .dl67s-gen__grid canvas', (els) => els.filter((c) => {
      const d = c.getContext('2d').getImageData(0, 0, 28, 28).data;
      let dark = 0;
      for (let i = 0; i < d.length; i += 4) if (d[i] < 200) dark += 1;
      return dark > 20;
    }).length);
    ok(inked >= 18, 'the VAE decoder generates 21 images in the browser, nearly all with ink', `${inked} of 21`);
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
    const unlabelled = await page.$$eval('.dl67s svg[role="img"], .dl67s canvas[role="img"]', (els) => els.filter((s) => !(s.getAttribute('aria-label') || '').trim()).length);
    ok(unlabelled === 0, 'every role="img" figure has an aria-label');
    const emoji = await page.$eval('.dl67s', (el) => (el.innerText.match(/\p{Extended_Pictographic}/gu) || []).filter((c) => !'↑↓→←'.includes(c)));
    ok(emoji.length === 0, 'no emoji in the page text', emoji.slice(0, 5).join(' '));
  }

  // ── pens ──────────────────────────────────────────────────────────────────
  if (want('pens')) {
    for (const theme of ['jade', 'coral', 'arcade']) {
      const tp = await open({ theme, tag: `pens-${theme}` });
      const r = await tp.evaluate(() => {
        const sh = document.querySelector('#dl67s-s02-nb');
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
        const fonts = [...sh.querySelectorAll('.dl67s-sh__title, .dl67s-sh__h, .dl67s-sh__t, .dl67s-sh__slides')].map((el) => cs(el).fontFamily);
        const paper = cs(sh).backgroundColor;
        return {
          hand: fonts.some((f) => /Patrick Hand|Segoe Print|Comic/i.test(f)),
          title: cs(sh.querySelector('.dl67s-sh__title')).color === toRgb(v('--pen-blue')),
          head: cs(sh.querySelector('.dl67s-sh__h')).color === toRgb(v('--pen-blue')),
          body: cs(sh.querySelector('.dl67s-sh__t')).color === toRgb(v('--pen-black')),
          mark: cs(sh.querySelector('.dl67s-sh__u--bullet .dl67s-sh__mark')).color === toRgb(v('--pen-red')),
          green: cs(sh.querySelector('.dl67s-sh__g')).color === toRgb(v('--pen-green')),
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
    await fp.click('.dl67s-hero__actions .dl67s-btn--primary');
    await sleep(1400);
    const st = await fp.evaluate(() => {
      const root = document.querySelector('.dl67s');
      return {
        focus: root.classList.contains('dl67s--focus'),
        real: document.fullscreenElement === root,
        pseudo: root.classList.contains('dl67s--pseudo'),
        overflow: getComputedStyle(root).overflowY,
        scrollable: root.scrollHeight > root.clientHeight + 100,
      };
    });
    ok(st.focus && (st.real || st.pseudo), 'focus mode enters (fullscreen or the overlay fallback)', st.real ? 'real fullscreen' : 'overlay');
    ok(st.overflow === 'auto' && st.scrollable, 'in focus mode the root is its own scroller', st.overflow);
    await fp.evaluate(() => {
      const root = document.querySelector('.dl67s');
      const el = document.getElementById('dl67s-s07');
      root.scrollTo({ top: el.getBoundingClientRect().top - root.getBoundingClientRect().top + root.scrollTop - 120, behavior: 'instant' });
    });
    await sleep(600);
    ok((await currentNo(fp)) === '§7', 'scrolling inside focus mode moves the page and the header follows', await currentNo(fp));
    await fp.evaluate(() => [...document.querySelectorAll('.dl67s-rail .dl67s-index__item')].find((b) => b.textContent.includes('Two training phases'))?.click());
    await sleep(900);
    ok((await currentNo(fp)) === '§8', 'the index rail jumps to a section inside focus mode', await currentNo(fp));
    await fp.keyboard.press('Escape');
    await sleep(700);
    let still = await fp.evaluate(() => document.querySelector('.dl67s').classList.contains('dl67s--focus'));
    if (still) {
      await fp.click('.dl67s-bar .dl67s-btn--primary');
      await sleep(900);
      still = await fp.evaluate(() => document.querySelector('.dl67s').classList.contains('dl67s--focus'));
    }
    ok(!still, 'focus mode exits (Esc, or the toggle)');
    ok((await currentNo(fp)) === '§8', 'leaving focus mode lands back on the section being read', await currentNo(fp));
    await fp.close();
  }

  // ── persistence ───────────────────────────────────────────────────────────
  if (want('persist')) {
    const pp = await open({ tag: 'persist', clear: true });
    const units = await pp.$$('#dl67s-s02-nb .dl67s-sh__u');
    for (const i of [0, 2, 4]) await units[i].click();
    await sleep(300);
    await pp.evaluate(() => {
      const el = document.getElementById('dl67s-s07');
      window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 160, behavior: 'instant' });
    });
    await sleep(700);
    await pp.goto(`${BASE}/portal`, { waitUntil: 'networkidle0' });
    await pp.goto(`${BASE}${ROUTE}`, { waitUntil: 'networkidle0' });
    await pp.waitForSelector('.dl67s-sec');
    await sleep(600);
    const pressed = await pp.$$eval('#dl67s-s02-nb .dl67s-sh__u', (els) => els.map((e) => e.getAttribute('aria-pressed') === 'true'));
    ok(pressed[0] && pressed[2] && pressed[4] && !pressed[1], 'ticked lines survive a reload', pressed.map((p) => (p ? 'x' : '.')).join(''));
    const resume = await pp.$eval('.dl67s-resume .dl67s-btn', (b) => b.textContent.trim()).catch(() => '');
    ok(/Resume at §7/.test(resume), '"Resume at §N" offers the last section', resume);
    if (resume) {
      await pp.click('.dl67s-resume .dl67s-btn');
      await sleep(900);
      ok((await currentNo(pp)) === '§7', 'Resume jumps to that section', await currentNo(pp));
    }
    const prog = await pp.$eval('.dl67s-bar__progtext', (el) => el.textContent.replace(/\s+/g, ' '));
    ok(/copied/.test(prog) && !/^0%/.test(prog), 'the header counts the ticked lines', prog);
    await pp.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('dl67s:')).forEach((k) => localStorage.removeItem(k)));
    await pp.close();
  }

  // ── broken storage ────────────────────────────────────────────────────────
  if (want('storage')) {
    const bp = await open({ tag: 'storage', brokenStorage: true });
    const n = await bp.$$eval('.dl67s-sec', (els) => els.length);
    await bp.click('#dl67s-s01-nb .dl67s-sh__u');
    await sleep(200);
    const ticked = await bp.$eval('#dl67s-s01-nb .dl67s-sh__u', (e) => e.getAttribute('aria-pressed'));
    ok(n === SECTIONS.length && ticked === 'true', 'with localStorage throwing, the page renders and ticks still work', `${n} sections`);
    await bp.close();
  }

  // ── reduced motion ────────────────────────────────────────────────────────
  if (want('reduced')) {
    const rp = await open({ tag: 'reduced', reduced: true });
    const n = await rp.$$eval('.dl67s-lab', (els) => els.length);
    await rp.evaluate(() => [...document.querySelectorAll('#dl67s-s09 .dl67s-stepper button')].find((b) => /Train to the end/.test(b.textContent))?.click());
    await sleep(900);
    const it = await rp.$eval('#dl67s-s09 .dl67s-stepper__t', (el) => el.textContent).catch(() => '');
    ok(n >= 19, 'reduced motion: every lab renders', `${n} labs`);
    ok(/1,500 of 1,500/.test(it), 'reduced motion: the §9 toy GAN jumps straight to the end', it);
    await rp.close();
  }

  // ── export ────────────────────────────────────────────────────────────────
  let pdfFile = '';
  if (want('export') || want('pdf')) {
    const ep = await open({ tag: 'export' });
    const title0 = await ep.title();
    await ep.evaluate(() => [...document.querySelectorAll('.dl67s-export button')].find((b) => /Export PDF/.test(b.textContent))?.click());
    await ep.waitForFunction(() => window.__printCalls >= 1, { timeout: 20000 }).catch(() => {});
    const during = await ep.evaluate(() => ({ calls: window.__printCalls || 0, cls: document.documentElement.classList.contains('dl67s-printing'), title: document.title }));
    ok(during.calls === 1, 'Export PDF calls window.print exactly once', String(during.calls));
    ok(during.cls && /CITS5017 L6–7 AEs and GANs/.test(during.title), 'it prints in print mode, with the PDF title', `${during.title}`);
    await ep.waitForFunction(() => /2,400 of 2,400/.test(document.querySelector('#dl67s-s10 .dl67s-stepper__t')?.textContent ?? ''), { timeout: 15000 }).catch(() => {});
    const trained = await ep.$$eval('.dl67s-stepper__t', (els) => els.map((e) => e.textContent).filter((t) => /iteration/.test(t)).join(' | '));
    ok(/1,500 of 1,500/.test(trained) && /2,400 of 2,400/.test(trained), 'in print mode the toy GANs show their trained runs, not iteration 0', trained);
    if (want('pdf')) {
      await ep.emulateMediaType('print');
      await sleep(500);
      pdfFile = path.join(OUT, 'lecture6-7.pdf');
      await ep.pdf({ path: pdfFile, format: 'A4', printBackground: true, preferCSSPageSize: true });
      await ep.emulateMediaType('screen');
    }
    await ep.evaluate(() => window.dispatchEvent(new Event('afterprint')));
    await sleep(300);
    const after = await ep.evaluate(() => ({ cls: document.documentElement.classList.contains('dl67s-printing'), title: document.title }));
    ok(!after.cls && after.title === title0, 'afterprint restores the page (class and title)', `${after.title}`);
    await ep.close();
  }

  // ── the PDF's text ────────────────────────────────────────────────────────
  if (want('pdf') && pdfFile) {
    const txtFile = pdfFile.replace(/\.pdf$/, '.txt');
    execFileSync('pdftotext', ['-enc', 'UTF-8', pdfFile, txtFile]);
    const text = fs.readFileSync(txtFile, 'utf8').replace(/\s+/g, ' ');
    const pages = Number(/Pages:\s+(\d+)/.exec(execFileSync('pdfinfo', [pdfFile]).toString())?.[1] ?? 0);
    // a section heading is "§N <title> SLIDE(S) <range>" (the receipt sets it
    // apart from the roadmap's section chips)
    const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const positions = SECTIONS.map((s) => {
      const words = s.title.split(/\s+/).map(esc).join('\\s+');
      const m = new RegExp(`§${s.no}\\s+${words}\\s+SLIDES?\\s+${esc(s.slides)}`).exec(text);
      return m ? m.index : -1;
    });
    ok(positions.every((p, i) => p >= 0 && (i === 0 || p > positions[i - 1])), 'the PDF has every section heading (title + slide range), in order', positions.join(', '));
    const sheetOnly = ['For images, build a', 'Interpolate two images at the codings level, not the pixel level', 'Each phase is one step with the binary cross-entropy loss', 'Not in these notes', 'tick every line'];
    const leaked = sheetOnly.filter((s) => text.includes(s));
    ok(leaked.length === 0, 'no notebook (Write) text in the PDF', leaked.join(' | '));
    ok(text.includes('history = conv_ae.fit(X_train, X_train, epochs=10,') && text.includes('If you are dealing with images, the autoencoders seen so far will not work well'), 'Read text and code come out as normal text');
    ok(text.includes('ℒ = −1/2 Σᵢ₌₁ⁿ [1 + log(σᵢ²) − σᵢ² − μᵢ²]') && text.includes('ℒ = −1/2 Σᵢ₌₁ⁿ [1 + γᵢ − exp(γᵢ) − μᵢ²]'), 'both latent-loss formulas come out as readable text');
    ok(text.includes('this page’s own run') || text.includes("THIS PAGE’S OWN RUN"), 'page-own numbers are labelled in the PDF');
    console.log(`      PDF: ${pages} pages · ${(fs.statSync(pdfFile).size / 1024).toFixed(0)} KB · ${pdfFile}`);
  }

  // ── NotebookLM dropdown ───────────────────────────────────────────────────
  if (want('nlm')) {
    const np = await open({ tag: 'nlm' });
    const toggle = '.dl67s-export__toggle';
    const before = await np.$eval(toggle, (b) => b.getAttribute('aria-expanded'));
    await np.click(toggle);
    await sleep(200);
    const opened = await np.evaluate(() => ({
      exp: document.querySelector('.dl67s-export__toggle').getAttribute('aria-expanded'),
      text: document.querySelector('.dl67s-nlm__text')?.textContent ?? '',
      steps: document.querySelectorAll('.dl67s-nlm__steps li').length,
    }));
    ok(before === 'false' && opened.exp === 'true' && opened.text === NLM_PROMPT && opened.steps >= 2, 'the NotebookLM dropdown opens with the prompt and its steps', `${NLM_PROMPT.length} characters`);
    ok(NLM_PROMPT.length < 1000, 'the prompt stays under 1,000 characters (no published limit)', String(NLM_PROMPT.length));
    await np.click('.dl67s-nlm__copy');
    await sleep(400);
    const fb = await np.evaluate(() => ({ label: document.querySelector('.dl67s-nlm__copy').textContent, sel: String(window.getSelection()) }));
    ok(/Copied/.test(fb.label) || (/Selected/.test(fb.label) && fb.sel.length > 100), 'Copy copies, or falls back to selecting the prompt', fb.label.trim());
    await np.close();
  }

  // ── the other study modules still fine ────────────────────────────────────
  if (want('others')) {
    const l3 = await open({ tag: 'lecture3', route: '/portal/dl-lecture-3-study', wait: '.dl3s-sec' });
    const n3 = await l3.$$eval('.dl3s-sec', (els) => els.length);
    ok(n3 >= 18, '/portal/dl-lecture-3-study still renders', `${n3} sections`);
    await l3.close();
    const l4 = await open({ tag: 'lecture4', route: '/portal/dl-lecture-4-study', wait: '.dl4s-sec' });
    const n4 = await l4.$$eval('.dl4s-sec', (els) => els.length);
    ok(n4 >= 18, '/portal/dl-lecture-4-study still renders', `${n4} sections`);
    await l4.close();
    const l5 = await open({ tag: 'lecture5', route: '/portal/dl-lecture-5-study', wait: '.dl5s-sec' });
    const n5 = await l5.$$eval('.dl5s-sec', (els) => els.length);
    ok(n5 >= 11, '/portal/dl-lecture-5-study still renders', `${n5} sections`);
    await l5.close();
  }

  // ── screenshots ───────────────────────────────────────────────────────────
  if (want('shots')) {
    for (const theme of ['jade', 'coral', 'arcade']) {
      for (const width of [1440, 390]) {
        const sp = await open({ theme, width, tag: `${theme}-${width}` });
        await sp.waitForSelector('#dl67s-s06 .dl67s-gen__grid canvas', { timeout: 20000 }).catch(() => {});
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
