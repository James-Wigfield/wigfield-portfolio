/* ============================================================================
   DL LECTURE 3 STUDY — headless check of /portal/dl-lecture-3-study
   (puppeteer-core + local Edge, seeded through the portal gate like the
   Lecture 4 and Project 2 checks)
   ----------------------------------------------------------------------------
     node tools/dl-lecture3-study/page-check.mjs [outDir]       (dev server on 5173)
     SITE_URL=http://localhost:5174 ONLY=export,nlm node tools/dl-lecture3-study/page-check.mjs out

   window.print is stubbed in every page before it loads, so no run can open a
   real print dialog.

   Checks
     data       core sections cover slides 1–53 once each, in order; the §12
                summary sits before §12.1 and its notebook page stays light
     render     every section with its Read / Play / Write beats; §12's table,
                labs and notebook page; the index: §12 then 12.1–12.3, each
                marked optional, no "§12 … §12" group heading
     clean      no duplicate ids, no nested buttons, no KaTeX errors
     progress   the header counts core sections only: a §12.1 tick leaves it
                alone, a §12 tick moves it
     persist    ticks saved before this change (dl3s:ticks) still show, and a
                §12 tick survives a reload
     export     Export PDF calls print once in print mode with the PDF title;
                afterprint restores title and class; the A4 PDF's text holds
                every core section title in order, no deep dive, no notebook
                text, readable maths; --deep adds §12.1–12.3; arcade prints
                light; Ctrl+P (beforeprint) gets the same print mode
     focus      Export PDF from focus mode leaves it for printing and comes
                back to it after
     nlm        the NotebookLM disclosure opens, shows the steps and three
                prompts under 1,000 characters; Copy copies, and falls back
                to selecting the text when the clipboard refuses
     lecture4   /portal/dl-lecture-4-study still renders
     shots      jade / coral / arcade at 1440 and 390: full page, §12, the
                hero; no horizontal page scroll
     console    zero console errors / warnings across every run
   ========================================================================== */
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL, fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const MOD = path.join(REPO, 'src/components/portal/modules/deep-learning/lecture3-study');
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const POPPLER = (exe) => (fs.existsSync(`C:/Program Files/Git/mingw64/bin/${exe}.exe`) ? `C:/Program Files/Git/mingw64/bin/${exe}.exe` : exe);
const BASE = process.env.SITE_URL || 'http://localhost:5173';
const ROUTE = '/portal/dl-lecture-3-study';
const OUT = path.resolve(process.argv[2] || path.join(HERE, 'out'));
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
const want = (k) => !ONLY.length || ONLY.includes(k);
fs.mkdirSync(OUT, { recursive: true });

const { SECTIONS } = await import(pathToFileURL(path.join(MOD, 'sections.js')).href);
const { NLM_PROMPT, NLM_PARTS, PDF_TITLE } = await import(pathToFileURL(path.join(MOD, 'exportPrompt.js')).href);
const CORE = SECTIONS.filter((s) => !s.optional);
const OPT = SECTIONS.filter((s) => s.optional);
const lines = (s) => s.notes.reduce((a, g) => a + g.lines.length, 0);
const TOTAL = CORE.reduce((a, s) => a + lines(s), 0);
const S12 = SECTIONS.find((s) => s.id === 's12');

const fails = [];
const ok = (cond, label, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${extra !== '' ? `  — ${extra}` : ''}`);
  if (!cond) fails.push(label);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// markup → the plain words a reader sees (for matching PDF text)
const plain = (t) => String(t).replace(/\$[^$]+\$/g, ' ').replace(/\[\^\d+\]/g, '').replace(/\[([^\]]+)\]\(#[a-z0-9]+\)/g, '$1').replace(/[*`]/g, '');
const squash = (t) => t.replace(/\s+/g, ' ').trim();

const browser = await puppeteer.launch({ executablePath: EDGE, headless: 'new', args: ['--hide-scrollbars'] });
const consoleMsgs = [];

async function open({ theme = 'jade', width = 1440, height = 900, ticks = null, clear = false, clipboard = 'native', route = ROUTE, wait = '.dl3s-sec', tag = '' } = {}) {
  const page = await browser.newPage();
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warn') consoleMsgs.push(`[${tag || theme}] ${m.type()}: ${m.text()}`);
  });
  page.on('pageerror', (e) => consoleMsgs.push(`[${tag || theme}] pageerror: ${e}`));
  await page.setViewport({ width, height, deviceScaleFactor: 1 });
  await page.evaluateOnNewDocument((t, wipe, seed, clip) => {
    sessionStorage.setItem('portal_auth', JSON.stringify({ token: 'mock-session-token', key: 'wiggy1', issued_at: new Date().toISOString() }));
    // never a real print dialog in an unattended run
    window.print = () => { window.__printCalls = (window.__printCalls || 0) + 1; window.__printTitle = document.title; window.__printClass = document.documentElement.className; };
    try {
      if (wipe && !sessionStorage.getItem('dl3s-check-wiped')) {
        Object.keys(localStorage).filter((k) => k.startsWith('dl3s:')).forEach((k) => localStorage.removeItem(k));
        if (seed) localStorage.setItem('dl3s:ticks', seed);
        sessionStorage.setItem('dl3s-check-wiped', '1');
      }
      localStorage.setItem('portal:theme', t);
    } catch { /* ignore */ }
    if (clip !== 'native') {
      const writeText = clip === 'ok' ? (s) => { window.__copied = s; return Promise.resolve(); } : () => Promise.reject(new DOMException('denied', 'NotAllowedError'));
      Object.defineProperty(navigator, 'clipboard', { configurable: true, get: () => ({ writeText }) });
      if (clip === 'deny') document.execCommand = () => false;
    }
  }, theme, clear, ticks ? JSON.stringify(ticks) : null, clipboard);
  await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle0' });
  await page.waitForSelector(wait, { timeout: 30000 });
  await sleep(400);
  return page;
}

// Click Export PDF, render the print-media A4 PDF, extract its text.
async function exportPdf(page, file, { deep = false } = {}) {
  if (deep) await page.click('.dl3s-export__opt input');
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.click('.dl3s-export__row .dl3s-btn');
  await page.waitForFunction(() => window.__printCalls === 1, { timeout: 10000 }).catch(() => {});
  const st = await page.evaluate(() => ({ calls: window.__printCalls || 0, title: window.__printTitle, cls: window.__printClass || '' }));
  await page.emulateMediaType('print');
  const probe = await page.evaluate(() => {
    const p = document.querySelector('#dl3s-s01 .dl3s-p');
    return { bg: getComputedStyle(document.querySelector('.dl3s')).backgroundColor, ink: p ? getComputedStyle(p).color : '' };
  });
  await page.pdf({ path: file, format: 'A4', printBackground: true, preferCSSPageSize: true, tagged: true });
  await page.emulateMediaType(null);
  const txtFile = file.replace(/\.pdf$/, '.txt');
  execFileSync(POPPLER('pdftotext'), ['-enc', 'UTF-8', '-layout', file, txtFile]);
  const pages = Number(/Pages:\s+(\d+)/.exec(execFileSync(POPPLER('pdfinfo'), [file]).toString())?.[1] || 0);
  return { st, probe, text: fs.readFileSync(txtFile, 'utf8'), pages, kb: Math.round(fs.statSync(file).size / 1024) };
}

const afterprint = (page) => page.evaluate(() => {
  window.dispatchEvent(new Event('afterprint'));
  return new Promise((r) => requestAnimationFrame(() => r({ cls: document.documentElement.className, title: document.title })));
});

try {
  // ── data ──────────────────────────────────────────────────────────────────
  if (want('data')) {
    const seen = [];
    CORE.forEach((s) => String(s.slides).split(/[,·]/).forEach((part) => {
      const [a, b] = part.trim().split(/[–-]/).map(Number);
      for (let n = a; n <= (b || a); n++) seen.push(n);
    }));
    ok(JSON.stringify(seen) === JSON.stringify(Array.from({ length: 53 }, (_, i) => i + 1)), 'core sections cover slides 1–53 once each, in order', `${seen.length} slides`);
    const ids = SECTIONS.map((s) => s.id);
    ok(new Set(ids).size === ids.length && ids.indexOf('s12') === ids.indexOf('s12a') - 1, 'the §12 summary has its own id and sits directly before §12.1');
    ok(OPT.map((s) => s.id).join() === 's12a,s12b,s12c' && OPT.every((s) => s.parent === 's12'), '§12.1–12.3 are the only optional sections, all under §12');
    const n = lines(S12);
    ok(S12.notes.length >= 2 && S12.notes.length <= 3 && n >= 6 && n <= 10, '§12 notebook page: 2–3 sub-headings, 6–10 lines', `${S12.notes.length} headings, ${n} lines`);
    ok((S12.draw?.length ?? 0) <= 1 && !S12.formulas && !S12.worked && S12.check.length >= 3 && S12.check.length <= 4, '§12: at most one drawing, no formulas or worked number, 3–4 checks');
    const lastRead = S12.read[S12.read.length - 1];
    ok(/\(#s13\)/.test(typeof lastRead === 'string' ? lastRead : lastRead.dd || ''), '§12 Read ends with a jump link to §13');
    ok(NLM_PROMPT.length < 1000 && NLM_PARTS.every((p) => p.text.length < 1000), 'every NotebookLM prompt is under 1,000 characters', [NLM_PROMPT.length, ...NLM_PARTS.map((p) => p.text.length)].join(', '));
  }

  const page = await open({ tag: 'main', clear: true });

  // ── render ────────────────────────────────────────────────────────────────
  if (want('render')) {
    const dom = await page.$$eval('.dl3s-sec', (els) => els.map((el) => ({
      id: el.id.replace('dl3s-', ''),
      read: !!el.querySelector('.dl3s-beat--read .dl3s-read'),
      labs: el.querySelectorAll('.dl3s-beat--play .dl3s-lab').length,
      nb: !!document.getElementById(`${el.id}-nb`),
      opt: !!el.querySelector('.dl3s-sec__opt'),
    })));
    ok(dom.length === SECTIONS.length && dom.every((d, i) => d.id === SECTIONS[i].id), `all ${SECTIONS.length} sections rendered, in order`);
    ok(dom.every((d, i) => d.read && d.nb && d.labs === (SECTIONS[i].play?.length ?? 0)), 'every section has its Read beat, every lab and its notebook page');
    ok(dom.every((d, i) => d.opt === !!SECTIONS[i].optional), 'exactly §12.1–12.3 carry the "optional deep dive" label');
    const s12 = await page.evaluate(() => {
      const el = document.getElementById('dl3s-s12');
      return {
        rows: [...el.querySelectorAll('.dl3s-arch__table tbody tr th b')].map((b) => b.textContent),
        labs: [...el.querySelectorAll('.dl3s-lab__name')].map((n) => n.textContent),
        nbLines: el.querySelectorAll('.dl3s-nb__line').length,
        draws: el.querySelectorAll('.dl3s-nb__draw svg').length,
        qs: el.querySelectorAll('.dl3s-nb__q').length,
        link: [...el.querySelectorAll('.dl3s-read .dl3s-link')].map((b) => b.textContent).pop(),
      };
    });
    ok(s12.rows.join() === 'LeNet-5,AlexNet,GoogLeNet,VGGNet,ResNet', '§12 table: LeNet-5, AlexNet, GoogLeNet, VGGNet, ResNet', s12.rows.join(', '));
    ok(s12.labs.length === 2 && /ILSVRC/.test(s12.labs[0]) && /residual/i.test(s12.labs[1]), '§12 Play: the timeline and residual labs', s12.labs.join(' | '));
    ok(s12.nbLines === lines(S12) && s12.draws === 1 && s12.qs === S12.check.length, '§12 notebook page renders its lines, one drawing and its checks', `${s12.nbLines} lines`);
    ok(/§13/.test(s12.link || ''), '§12 Read ends with the §13 link', s12.link);
    const idx = await page.$$eval('.dl3s-rail .dl3s-index__item', (els) => els.map((b) => ({ no: b.querySelector('.dl3s-index__no').textContent, opt: !!b.querySelector('.dl3s-index__opt'), sub: b.classList.contains('dl3s-index__item--sub') })));
    const at = idx.findIndex((r) => r.no === '12');
    ok(at > 0 && idx.slice(at, at + 4).map((r) => r.no).join() === '12,12.1,12.2,12.3', 'the index lists §12 then 12.1, 12.2, 12.3', idx.slice(at, at + 4).map((r) => r.no).join(' '));
    ok(idx.filter((r) => r.opt).map((r) => r.no).join() === '12.1,12.2,12.3' && idx.filter((r) => r.sub).length === 3, 'the index marks 12.1–12.3 optional (and indents them), nothing else');
    const groupHeads = await page.$$eval('.dl3s-rail .dl3s-index__list', (els) => (els[0]?.innerText.match(/§12/g) || []).length);
    ok(groupHeads === 0, 'no "§12 …" group heading in the index', String(groupHeads));
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
    const tex = await page.$$eval('.katex-error', (els) => els.map((e) => e.textContent.slice(0, 60)));
    ok(tex.length === 0, 'no KaTeX parse errors', tex.slice(0, 3).join(' | '));
  }

  // ── progress counts core sections only ───────────────────────────────────
  if (want('progress')) {
    const pp = await open({ tag: 'progress', clear: true });
    const prog = () => pp.$eval('.dl3s-bar__progtext', (el) => el.textContent.replace(/\s+/g, ' ').trim());
    const start = await prog();
    ok(start.startsWith(`0/${TOTAL} lines`) && start.includes(`/${CORE.length} pages`), 'header totals cover the core sections only', start);
    await pp.click('#dl3s-s12a-nb .dl3s-nb__line');
    await sleep(200);
    const afterOpt = await prog();
    const optPressed = await pp.$eval('#dl3s-s12a-nb .dl3s-nb__line', (b) => b.getAttribute('aria-pressed'));
    ok(optPressed === 'true' && afterOpt === start, 'ticking a §12.1 line works but leaves the overall progress alone', afterOpt);
    await pp.click('#dl3s-s12-nb .dl3s-nb__line');
    await sleep(200);
    ok((await prog()).startsWith('1/'), 'ticking a §12 summary line counts', await prog());
    await pp.close();
  }

  // ── persistence ───────────────────────────────────────────────────────────
  if (want('persist')) {
    const legacy = { s02: [0, 2], s12a: [1], s15: [0] };
    const pp = await open({ tag: 'persist', clear: true, ticks: legacy });
    const pressed = (id) => pp.$$eval(`#dl3s-${id}-nb .dl3s-nb__line`, (els) => els.map((e) => e.getAttribute('aria-pressed') === 'true'));
    const a = await pressed('s02');
    const b = await pressed('s12a');
    const c = await pressed('s15');
    ok(a[0] && !a[1] && a[2] && b[1] && !b[0] && c[0], 'ticks saved before the summary existed still show (dl3s:ticks)', `${a.map(Number).join('')} · ${b.map(Number).join('')} · ${c.map(Number).join('')}`);
    await pp.click('#dl3s-s12-nb .dl3s-nb__line');
    await sleep(300);
    await pp.goto(`${BASE}${ROUTE}`, { waitUntil: 'networkidle0' });
    await pp.waitForSelector('.dl3s-sec');
    await sleep(400);
    const d = await pressed('s12');
    const stored = await pp.evaluate(() => JSON.parse(localStorage.getItem('dl3s:ticks') || '{}'));
    ok(d[0] && stored.s12?.[0] === 0 && stored.s02?.join() === '0,2', 'a §12 tick survives a reload, beside the old ones', JSON.stringify(stored));
    await pp.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('dl3s:')).forEach((k) => localStorage.removeItem(k)));
    await pp.close();
  }

  // ── export ────────────────────────────────────────────────────────────────
  if (want('export')) {
    const ep = await open({ tag: 'export' });
    const before = await ep.evaluate(() => document.title);
    const r = await exportPdf(ep, path.join(OUT, 'lecture3-read-play.pdf'));
    ok(r.st.calls === 1, 'Export PDF calls window.print once', String(r.st.calls));
    ok(/\bdl3s-printing\b/.test(r.st.cls) && !/dl3s-print-dd/.test(r.st.cls) && r.st.title === PDF_TITLE, 'print runs in print mode, deep dives off, with the PDF filename as title', `${r.st.cls} · ${r.st.title}`);
    const back = await afterprint(ep);
    ok(!/dl3s-print/.test(back.cls) && back.title === before, 'afterprint restores the class and the title', `${back.cls} · ${back.title}`);
    const text = squash(r.text);
    let pos = -1;
    const order = [];
    CORE.forEach((s) => {
      const at = text.indexOf(`§${s.no} ${s.title}`, pos + 1);
      if (at <= pos) order.push(s.no);
      else pos = at;
    });
    ok(order.length === 0, `every core section title is in the PDF, in order (${CORE.length})`, order.join(', '));
    const deep = OPT.filter((s) => text.includes(`§${s.no} ${s.title}`)).map((s) => s.no);
    ok(deep.length === 0 && !text.includes('deep dives that follow') && !text.includes('read it in §12'), 'the §12.1–12.3 deep dives, and every pointer to them, are left out by default', deep.join(', '));
    ok(!/GOT IT|Got it|\d+\/7 ticked|pick a shift to test|SLIDE-24 FIXES|PAINT ON ME|paint on me|PAINT VALUE/.test(text), 'lab-only furniture stays off paper (tick column, unused shift test, fix buttons, paint label)');
    ok(text.includes('n03877845 · palace · 54.69%') && text.includes('n04522168 · vase · 32.66%'), '§13 prints slide 49’s decoded top 3 for both images');
    ok(text.includes('i·s_h + f_h − 1'), 'a thin-spaced product prints as i·s_h');
    const nbWords = ['Notebook page', 'lines copied', 'Check yourself', 'tick every line', 'Show answer', 'Draw this', 'Formulas to copy', 'Worked number'].filter((w) => text.includes(w));
    ok(nbWords.length === 0, 'no notebook furniture in the PDF', nbWords.join(', '));
    const readText = (s) => squash(plain(JSON.stringify(s.read)));
    const leaks = [];
    CORE.forEach((s) => s.notes.forEach((g) => g.lines.forEach((l) => {
      const p = squash(plain(l));
      if (p.length > 40 && text.includes(p) && !readText(s).includes(p)) leaks.push(`${s.id}: ${p.slice(0, 50)}`);
    })));
    CORE.forEach((s) => (s.check || []).forEach((c) => { const q = squash(plain(c.q)); if (text.includes(q)) leaks.push(`${s.id} check: ${q.slice(0, 40)}`); }));
    ok(leaks.length === 0, 'no notebook lines or check questions in the PDF', leaks.slice(0, 4).join(' | '));
    ok(text.includes('Over the years, variants of the basic architecture') === false && text.includes('A good measure of progress is the error rate in competitions such as the ILSVRC ImageNet Challenge'), 'Read text extracts as sentences (§12) and §12.1’s prose is absent');
    const mathOk = ['I′(x, y) = ∑_(i=−1)^1 ∑_(j=−1)^1 I(x + i, y + j) f(i, j)', 'z_k = b_k + ∑_(c=0)^(N_channels−1) x_c * f_(c,k)', 'f(x) = h(x) − x', 'rows i·s_h to i·s_h + f_h − 1', '[−1 0 1; −2 0 2; −1 0 1]'].filter((m) => !text.includes(m));
    ok(mathOk.length === 0, 'equations extract once, as readable text', mathOk.join(' | '));
    const mathItalic = (r.text.match(/[\u{1D400}-\u{1D7FF}]/gu) || []).length;
    ok(mathItalic === 0, 'no math-alphanumeric code points (KaTeX/MathML duplicates) in the text', String(mathItalic));
    ok(/\[6\]/.test(text) && text.includes('ILSVRC stands for ImageNet Large Scale Visual Recognition Competition'), 'footnote markers and their references print');
    ok(text.includes('Slide check'), '"Slide check" notes print');
    ok(text.includes('Read + Play edition') && text.includes('left out of this PDF'), 'the print cover says what the PDF holds');
    const chrome = ['Enter focus mode', 'Export PDF', 'NotebookLM video prompt', 'pages done', 'Resume at'].filter((w) => text.includes(w));
    ok(chrome.length === 0, 'no page chrome (focus, export, index, resume) in the PDF', chrome.join(', '));
    ok(r.pages >= 20 && r.pages <= 60, `PDF size is sane: ${r.pages} pages, ${r.kb} KB`);
    console.log(`      PDF: ${r.pages} pages · ${r.kb} KB · ${path.join(OUT, 'lecture3-read-play.pdf')}`);
    execFileSync(POPPLER('pdftoppm'), ['-png', '-r', '70', '-f', '1', '-l', '1', path.join(OUT, 'lecture3-read-play.pdf'), path.join(OUT, 'pdf-p')]);
    const s12page = (r.text.split('\f').findIndex((p) => p.includes('§12 Classic architectures in brief')) + 1) || 1;
    execFileSync(POPPLER('pdftoppm'), ['-png', '-r', '70', '-f', String(s12page), '-l', String(s12page), path.join(OUT, 'lecture3-read-play.pdf'), path.join(OUT, 'pdf-p')]);
    await ep.close();

    // deep dives in, arcade theme: still a light document
    const dp = await open({ tag: 'export-deep', theme: 'arcade' });
    const rd = await exportPdf(dp, path.join(OUT, 'lecture3-read-play-deep-arcade.pdf'), { deep: true });
    const dtext = squash(rd.text);
    ok(/dl3s-print-dd/.test(rd.st.cls) && OPT.every((s) => dtext.includes(`§${s.no} ${s.title}`)), 'with the box ticked the deep dives print', `${rd.pages} pages`);
    ok(rd.probe.bg === 'rgb(255, 255, 255)' && /^rgb\((\d+), (\d+), (\d+)\)$/.test(rd.probe.ink) && rd.probe.ink.match(/\d+/g).every((v) => Number(v) < 120), 'arcade prints on a light paper palette', `${rd.probe.bg} · ink ${rd.probe.ink}`);
    await afterprint(dp);

    // Ctrl+P: beforeprint gives the same print mode
    const cp = await dp.evaluate(() => {
      window.dispatchEvent(new Event('beforeprint'));
      const on = document.documentElement.className;
      const t = document.title;
      window.dispatchEvent(new Event('afterprint'));
      return { on, t, off: document.documentElement.className };
    });
    ok(/dl3s-printing/.test(cp.on) && cp.t === PDF_TITLE && !/dl3s-print/.test(cp.off), 'Ctrl+P (beforeprint) enters the same print mode and leaves it after', `${cp.on} → ${cp.off}`);
    await dp.close();
  }

  // ── export from focus mode ────────────────────────────────────────────────
  if (want('focus')) {
    const fp = await open({ tag: 'focus' });
    await fp.click('.dl3s-hero__actions .dl3s-btn--primary');
    await sleep(1400);
    const inFocus = await fp.evaluate(() => document.querySelector('.dl3s').classList.contains('dl3s--focus'));
    ok(inFocus, 'focus mode enters');
    await fp.evaluate(() => document.querySelector('.dl3s').scrollTo({ top: 0, behavior: 'instant' }));
    await fp.click('.dl3s-export__row .dl3s-btn');
    await fp.waitForFunction(() => window.__printCalls === 1, { timeout: 10000 }).catch(() => {});
    const during = await fp.evaluate(() => ({ calls: window.__printCalls || 0, focus: /dl3s--focus/.test(document.querySelector('.dl3s').className), fs: !!document.fullscreenElement }));
    ok(during.calls === 1 && !during.focus && !during.fs, 'Export PDF leaves focus mode before printing', JSON.stringify(during));
    await afterprint(fp);
    await sleep(1400);
    const after = await fp.evaluate(() => ({ focus: /dl3s--focus/.test(document.querySelector('.dl3s').className), cls: document.documentElement.className }));
    ok(after.focus && !/dl3s-printing/.test(after.cls), 'after printing, focus mode comes back', JSON.stringify(after));
    await fp.keyboard.press('Escape');
    await fp.close();
  }

  // ── NotebookLM prompt ─────────────────────────────────────────────────────
  if (want('nlm')) {
    const np = await open({ tag: 'nlm', clipboard: 'ok' });
    const t0 = await np.$eval('.dl3s-export__nlm', (b) => b.getAttribute('aria-expanded'));
    await np.click('.dl3s-export__nlm');
    await sleep(200);
    const panel = await np.evaluate(() => {
      const p = document.getElementById('dl3s-nlm');
      return p && {
        expanded: document.querySelector('.dl3s-export__nlm').getAttribute('aria-expanded'),
        steps: p.querySelectorAll('.dl3s-nlm__steps li').length,
        blocks: [...p.querySelectorAll('.dl3s-nlm__text')].map((t) => t.textContent),
        format: /Explainer/.test(p.textContent),
      };
    });
    ok(t0 === 'false' && panel?.expanded === 'true', 'the NotebookLM disclosure toggles with aria-expanded', `${t0} → ${panel?.expanded}`);
    ok(panel?.steps === 3 && panel.blocks.length === 3 && panel.blocks[0] === NLM_PROMPT && panel.format, 'it shows three steps, the format, the prompt and the two-part variant');
    await np.click('.dl3s-nlm__copy');
    await sleep(200);
    const copied = await np.evaluate(() => ({ text: window.__copied, label: document.querySelector('.dl3s-nlm__copy').textContent }));
    ok(copied.text === NLM_PROMPT && copied.label === 'Copied', 'Copy puts the prompt on the clipboard and says "Copied"', copied.label);
    await np.close();

    const dp = await open({ tag: 'nlm-deny', clipboard: 'deny' });
    await dp.click('.dl3s-export__nlm');
    await sleep(200);
    await dp.click('.dl3s-nlm__copy');
    await sleep(200);
    const fb = await dp.evaluate(() => ({ sel: String(window.getSelection()), label: document.querySelector('.dl3s-nlm__copy').textContent }));
    ok(fb.sel === NLM_PROMPT && /Selected/.test(fb.label), 'when the clipboard refuses, the prompt is selected for Ctrl+C', fb.label);
    await dp.close();
  }

  // ── Lecture 4 still fine ──────────────────────────────────────────────────
  if (want('lecture4')) {
    const lp = await open({ tag: 'lecture4', route: '/portal/dl-lecture-4-study', wait: '.dl4s-sec' });
    const n = await lp.$$eval('.dl4s-sec', (els) => els.length);
    const labs = await lp.$$eval('.dl4s-lab', (els) => els.length);
    ok(n >= 18 && labs >= 20, '/portal/dl-lecture-4-study still renders', `${n} sections, ${labs} labs`);
    await lp.close();
  }

  // ── screenshots ───────────────────────────────────────────────────────────
  if (want('shots')) {
    for (const theme of ['jade', 'coral', 'arcade']) {
      for (const width of [1440, 390]) {
        const sp = await open({ theme, width, tag: `${theme}-${width}` });
        await sp.screenshot({ path: path.join(OUT, `page-${theme}-${width}.png`), fullPage: true });
        const overflow = await sp.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        ok(overflow <= 1, `${theme} @${width}: no horizontal page scroll`, `${overflow}px`);
        await sp.addStyleTag({ content: '.dl3s-bar, .portal__topbar, .dl3s-rail { position: static !important; }' });
        await sp.click('.dl3s-export__nlm');
        await sleep(250);
        const overflowNlm = await sp.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        ok(overflowNlm <= 1, `${theme} @${width}: no horizontal scroll with the prompt panel open`, `${overflowNlm}px`);
        await (await sp.$('.dl3s-hero')).screenshot({ path: path.join(OUT, `hero-${theme}-${width}.png`) });
        const sec = await sp.$('#dl3s-s12');
        await sec.scrollIntoView();
        await sleep(250);
        await sec.screenshot({ path: path.join(OUT, `s12-${theme}-${width}.png`) });
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
