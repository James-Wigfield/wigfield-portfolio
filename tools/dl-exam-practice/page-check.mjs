/* ============================================================================
   DL EXAM PRACTICE — headless check of /portal/dl-exam-practice
   (puppeteer-core + local Edge, seeded through the portal gate; adapted from
   tools/dl-lecture8-study/page-check.mjs)
   ----------------------------------------------------------------------------
     node tools/dl-exam-practice/page-check.mjs [outDir]       (dev server on 5181)
     SITE_URL=http://localhost:5173 ONLY=export,pdf node tools/dl-exam-practice/page-check.mjs out

   window.print is stubbed before the page loads in EVERY run, so a print
   dialog can never hang an unattended check.

   Checks
     render     three tabs; each paper opens on its cover; the stepper has
                Cover + one step per question; every question's sheets render
                with the running head, "Page N of M" and its topic line, and
                every margin label stays on its sheet
     reveal     every part's Reveal writes its answer onto the paper (and Hide
                takes it off); "Reveal all parts" / "Hide answers" per question
     hand       the answers use Patrick Hand (body) and Caveat (headings and
                red ticks); every pen ≥ 4.5:1 on the paper, in all three themes
     tone       no coloured left-border callouts; topic labels, chips and
                margin labels are never filled pills
     persist    reveals and self-marks survive a reload; Reset clears them
     filter     "L9" dims every part off L9 and the counts match the data
     storage    with localStorage throwing, the page renders and reveals work
     reduced    prefers-reduced-motion: answers appear with no animation
     keyboard   reveal, mark and the stepper work from the keyboard
     export     Export PDF calls the stubbed print once, mounts the print
                book in print mode; afterprint restores the page
     pdf        print mode → page.pdf → pdftotext: every paper, question and
                part label in order; every model answer; every NotebookLM pick
                named verbatim; formulas as readable text; no UI text
     nlm        the NotebookLM disclosure opens directly under Export PDF;
                Copy copies (or selects) and the character count shows
     shots      3 themes × 1440/390, no horizontal page scroll
     others     every other Deep Learning module still renders
     console    zero console errors / warnings across every run
   ========================================================================== */
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL, fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const MOD = path.join(REPO, 'src/components/portal/modules/deep-learning/exam-practice');
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const BASE = process.env.SITE_URL || 'http://localhost:5181';
const ROUTE = '/portal/dl-exam-practice';
const OUT = path.resolve(process.argv[2] || path.join(HERE, 'out'));
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
const want = (k) => !ONLY.length || ONLY.includes(k);
fs.mkdirSync(OUT, { recursive: true });

const imp = (p) => import(pathToFileURL(path.join(MOD, p)).href);
const { PAPERS, paperLeaves, leavesOf, leafLabel, leafLectures } = await imp('papers/index.js');
const { NLM_PICKS, NLM_PROMPT } = await imp('exportPrompt.js');
const { texText } = await imp('texText.js');

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

async function open({ theme = 'jade', width = 1440, height = 900, reduced = false, brokenStorage = false, clear = true, route = ROUTE, wait = '.dlxp-sheet', tag = '', paper = 'sample', at = 0 } = {}) {
  const page = await browser.newPage();
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warn') consoleMsgs.push(`[${tag || theme}] ${m.type()}: ${m.text()}`);
  });
  page.on('pageerror', (e) => consoleMsgs.push(`[${tag || theme}] pageerror: ${e}`));
  await page.setViewport({ width, height, deviceScaleFactor: 1 });
  if (reduced) await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await page.evaluateOnNewDocument(SEED);
  await page.evaluateOnNewDocument((t, wipe, p, n) => {
    try {
      if (wipe && !sessionStorage.getItem('dlxp-check-wiped')) {
        Object.keys(localStorage).filter((k) => k.startsWith('dlxp:')).forEach((k) => localStorage.removeItem(k));
        localStorage.setItem('dlxp:paper', JSON.stringify(p));
        localStorage.setItem('dlxp:at', JSON.stringify({ [p]: n }));
        sessionStorage.setItem('dlxp-check-wiped', '1');
      }
      localStorage.setItem('portal:theme', t);
    } catch { /* broken-storage run */ }
  }, theme, clear, paper, at);
  if (brokenStorage) {
    await page.evaluateOnNewDocument(() => {
      const boom = () => { throw new DOMException('storage disabled', 'SecurityError'); };
      const dead = { getItem: boom, setItem: boom, removeItem: boom, clear: boom, key: boom, length: 0 };
      Object.defineProperty(window, 'localStorage', { configurable: true, get: () => dead });
    });
  }
  await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle0' });
  await page.waitForSelector(wait, { timeout: 30000 });
  await page.evaluate(() => document.fonts?.ready);
  await sleep(400);
  return page;
}

const clickText = (page, sel, re) => page.evaluate((s, src) => {
  const b = [...document.querySelectorAll(s)].find((el) => new RegExp(src).test(el.textContent));
  if (b) b.click();
  return !!b;
}, sel, re.source);
const goPaper = async (page, id) => {
  await page.click(`#dlxp-tab-${id}`);
  await sleep(250);
};
const goStep = async (page, n) => {
  await page.click(`#dlxp-step-${n}`);
  await sleep(350);
};

try {
  const page = await open({ tag: 'main' });

  // ── render ────────────────────────────────────────────────────────────────
  if (want('render')) {
    const tabs = await page.$$eval('.dlxp-tab', (els) => els.map((e) => e.querySelector('.dlxp-tab__name').textContent));
    ok(tabs.join('|') === PAPERS.map((p) => p.tab).join('|'), 'three tabs, one per paper', tabs.join(' · '));
    const offSheet = [];
    for (const paper of PAPERS) {
      await goPaper(page, paper.id);
      await goStep(page, 0);
      const cover = await page.evaluate(() => ({
        cover: !!document.querySelector('.dlxp-sheet--cover'),
        text: document.querySelector('.dlxp-sheet--cover')?.innerText ?? '',
        steps: [...document.querySelectorAll('.dlxp-step__label')].map((e) => e.textContent),
      }));
      ok(cover.cover && /INSTRUCTIONS:/.test(cover.text) && /calculator/.test(cover.text), `${paper.name}: opens on its cover page with the instructions`);
      ok(cover.steps.join(',') === ['Cover', ...paper.questions.map((q) => `Q${q.n}`)].join(','), `${paper.name}: stepper Cover + Q1…Q${paper.questions.length}`, cover.steps.join(' '));
      for (const q of paper.questions) {
        await goStep(page, q.n);
        const r = await page.evaluate(() => ({
          sheets: document.querySelectorAll('.dlxp-turn > .dlxp-sheet').length,
          heads: [...document.querySelectorAll('.dlxp-runhead__l')].map((e) => e.textContent),
          feet: [...document.querySelectorAll('.dlxp-foot')].map((e) => e.textContent),
          qhead: document.querySelector('.dlxp-qhead')?.textContent ?? '',
          topics: document.querySelectorAll('.dlxp-topics__t').length,
          parts: [...document.querySelectorAll('.dlxp-part')].map((e) => e.dataset.part),
          katexErr: document.querySelectorAll('.dlxp-sheet .katex-error').length,
          offSheet: [...document.querySelectorAll('.dlxp-mlabel__t')]
            .filter((e) => e.getBoundingClientRect().right > e.closest('.dlxp-sheet').getBoundingClientRect().right - 4)
            .map((e) => e.textContent),
        }));
        offSheet.push(...r.offSheet.map((t) => `${paper.id} Q${q.n}: ${t}`));
        const pages = [...new Set(q.parts.map((p) => p.page))];
        ok(r.sheets === pages.length && r.heads.every((h) => h === paper.head) && r.feet.join('|') === pages.map((n) => `Page ${n} of ${paper.pages}`).join('|'), `${paper.name} Q${q.n}: ${pages.length} sheets with running head and "Page N of ${paper.pages}"`, r.feet.join(', '));
        ok(r.qhead === `Question ${q.n}. (20 marks)` && r.topics > 0, `${paper.name} Q${q.n}: heading + topic line`, `${r.qhead} · ${r.topics} lecture groups`);
        ok(r.parts.join(',') === q.parts.map((p) => p.id).join(','), `${paper.name} Q${q.n}: parts in order`, r.parts.join(' '));
        ok(r.katexErr === 0, `${paper.name} Q${q.n}: no KaTeX errors`);
      }
    }
    ok(offSheet.length === 0, 'every margin label (lecture · slides) stays on its sheet', offSheet.join(' | '));
  }

  // ── reveal ────────────────────────────────────────────────────────────────
  if (want('reveal')) {
    let all = 0;
    let good = 0;
    for (const paper of PAPERS) {
      await goPaper(page, paper.id);
      for (const q of paper.questions) {
        await goStep(page, q.n);
        for (const l of leavesOf(q)) {
          all += 1;
          await page.click(`[data-leaf="${l.id}"]`);
          await sleep(60);
          const on = await page.evaluate((id) => {
            const btn = document.querySelector(`[data-leaf="${id}"]`);
            const part = btn.closest('.dlxp-part');
            return { pressed: btn.getAttribute('aria-pressed'), ink: part.querySelectorAll('.dlxp-ink').length };
          }, l.id);
          await page.click(`[data-leaf="${l.id}"]`);
          await sleep(60);
          const off = await page.evaluate((id) => document.querySelector(`[data-leaf="${id}"]`).getAttribute('aria-pressed'), l.id);
          if (on.pressed === 'true' && on.ink >= 1 && off === 'false') good += 1;
          else console.log(`   reveal failed for ${l.id}`, on, off);
        }
        await clickText(page, '.dlxp-qbar button', /Reveal all parts/);
        await sleep(150);
        const nAll = await page.$$eval('.dlxp-ink', (els) => els.length);
        await clickText(page, '.dlxp-qbar button', /Hide answers/);
        await sleep(150);
        const nNone = await page.$$eval('.dlxp-ink', (els) => els.length);
        ok(nAll === leavesOf(q).length && nNone === 0, `${paper.name} Q${q.n}: Reveal all parts / Hide answers`, `${nAll} → ${nNone}`);
      }
    }
    ok(good === all, 'every part\'s Reveal writes its answer onto the paper, and Hide takes it off', `${good}/${all} parts`);
  }

  // ── handwriting + contrast + tone (3 themes) ─────────────────────────────
  if (want('hand') || want('tone')) {
    for (const theme of ['jade', 'coral', 'arcade']) {
      const tp = await open({ theme, tag: `hand-${theme}`, paper: 'sample', at: 1 });
      await clickText(tp, '.dlxp-qbar button', /Reveal all parts/);
      await sleep(1500);
      const r = await tp.evaluate(() => {
        const cs = (el) => getComputedStyle(el);
        const px = (c) => {
          const cv = document.createElement('canvas');
          cv.width = 1;
          cv.height = 1;
          const g = cv.getContext('2d');
          g.fillStyle = c;
          g.fillRect(0, 0, 1, 1);
          return [...g.getImageData(0, 0, 1, 1).data].slice(0, 3);
        };
        const lum = (c) => {
          const [r, g, b] = px(c).map((x) => {
            const s = x / 255;
            return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
          });
          return 0.2126 * r + 0.7152 * g + 0.0722 * b;
        };
        const ratio = (a, b) => {
          const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
          return (x + 0.05) / (y + 0.05);
        };
        const root = document.querySelector('.dlxp');
        const v = (n) => cs(root).getPropertyValue(n).trim();
        const paper = v('--paper');
        const body = document.querySelector('.dlxp-ink__w');
        const head = document.querySelector('.dlxp-ink__h');
        const tick = document.querySelector('.dlxp-tick');
        const prompt = document.querySelector('.dlxp-prompt__p');
        // tone: any element with a coloured left border and no other border (a callout)
        const callouts = [...document.querySelectorAll('.dlxp *')].filter((el) => {
          const s = cs(el);
          return parseFloat(s.borderLeftWidth) >= 2 && s.borderLeftStyle !== 'none' && parseFloat(s.borderRightWidth) === 0 && parseFloat(s.borderTopWidth) === 0;
        }).map((el) => el.className);
        const filled = [...document.querySelectorAll('.dlxp-chip, .dlxp-mlabel__t, .dlxp-topics__t, .dlxp-pick, .dlxp-step')].filter((el) => {
          const bg = cs(el).backgroundColor;
          return !(bg === 'rgba(0, 0, 0, 0)' || bg === 'transparent');
        }).map((el) => el.className);
        return {
          bodyFont: cs(body).fontFamily,
          headFont: cs(head).fontFamily,
          tickFont: cs(tick).fontFamily,
          tickColor: cs(tick).color,
          promptColor: cs(prompt).color,
          sheetBg: cs(document.querySelector('.dlxp-sheet')).backgroundImage,
          pens: Object.fromEntries(['--pen-ink', '--pen-blue', '--pen-red', '--pen-green', '--pen-grey', '--type'].map((p) => [p, ratio(v(p), paper)])),
          prompt: ratio(cs(prompt).color, paper),
          inkColor: ratio(cs(body).color, paper),
          callouts,
          filled,
        };
      });
      if (want('hand')) {
        ok(/Patrick Hand/.test(r.bodyFont) && /Caveat/.test(r.headFont) && /Caveat/.test(r.tickFont), `${theme}: answers in Patrick Hand, headings and ticks in Caveat`, `${r.bodyFont.split(',')[0]} / ${r.headFont.split(',')[0]} / ${r.tickFont.split(',')[0]}`);
        const all = Object.values(r.pens).concat(r.prompt, r.inkColor);
        ok(all.every((c) => c >= 4.5), `${theme}: every pen and the printed type ≥ 4.5:1 on the paper`, Object.entries(r.pens).map(([k, c]) => `${k.slice(2)} ${c.toFixed(1)}`).join(' · ') + ` · prompt ${r.prompt.toFixed(1)}`);
      }
      if (want('tone')) {
        ok(r.callouts.length === 0, `${theme}: no left-border callouts`, r.callouts.slice(0, 4).join(' | '));
        ok(r.filled.length === 0, `${theme}: topic labels, chips and steps are not filled pills`, r.filled.slice(0, 4).join(' | '));
      }
      await tp.close();
    }
  }

  // ── persistence + reset ───────────────────────────────────────────────────
  if (want('persist')) {
    const pp = await open({ tag: 'persist', paper: 'A', at: 2 });
    const leaf = paperLeaves(PAPERS.find((p) => p.id === 'A')).find((l) => l.question.n === 2);
    await pp.click(`[data-leaf="${leaf.id}"]`);
    await sleep(200);
    await pp.evaluate(() => document.querySelectorAll('.dlxp-mark .dlxp-mark__n')[1]?.click());
    await sleep(200);
    await pp.reload({ waitUntil: 'networkidle0' });
    await pp.waitForSelector('.dlxp-sheet');
    await sleep(500);
    const after = await pp.evaluate((id) => ({
      tab: document.querySelector('.dlxp-tab--on .dlxp-tab__name')?.textContent,
      pressed: document.querySelector(`[data-leaf="${id}"]`)?.getAttribute('aria-pressed'),
      mark: document.querySelector('.dlxp-mark__n--on')?.textContent,
      ring: !!document.querySelector('.dlxp-mark__n--on .dlxp-ring'),
      score: document.querySelector('.dlxp-bar__score b')?.textContent,
      status: document.querySelector('#dlxp-step-2 .dlxp-step__st')?.textContent ?? '',
    }), leaf.id);
    ok(after.tab === 'Practice paper A' && after.pressed === 'true' && after.mark === '1' && after.ring, 'reveals, self-marks, tab and page survive a reload; the chosen mark gets an ink ring', JSON.stringify(after));
    ok(/^1 \/ 80$/.test(after.score) && /revealed/.test(after.status), 'paper total and the question\'s status follow the marks', `${after.score} · ${after.status}`);
    await clickText(pp, '.dlxp-bar__right button', /Reset/);
    await sleep(150);
    await clickText(pp, '.dlxp-reset button', /^Reset$/);
    await sleep(300);
    const reset = await pp.evaluate(() => ({ ink: document.querySelectorAll('.dlxp-ink').length, score: document.querySelector('.dlxp-bar__score b')?.textContent, stored: localStorage.getItem('dlxp:marks') }));
    ok(reset.ink === 0 && /^0 \/ 80$/.test(reset.score) && !/a-q/.test(reset.stored ?? ''), 'Reset (after its confirm step) hides the paper\'s answers and clears its marks', JSON.stringify(reset));
    await pp.close();
  }

  // ── lecture filter ────────────────────────────────────────────────────────
  if (want('filter')) {
    const fp = await open({ tag: 'filter', paper: 'B', at: 4 });
    const B = PAPERS.find((p) => p.id === 'B');
    await clickText(fp, '.dlxp-chip', /^L9/);
    await sleep(300);
    const r = await fp.evaluate(() => ({
      chip: document.querySelector('.dlxp-chip--on')?.textContent,
      parts: [...document.querySelectorAll('.dlxp-part')].map((e) => [e.dataset.part, e.classList.contains('dlxp-part--dim')]),
      matches: [...document.querySelectorAll('.dlxp-step__match')].map((e) => e.textContent),
    }));
    const q4 = B.questions[3];
    const expectDim = q4.parts.map((p) => [p.id, !(p.subs ?? [p]).some((l) => leafLectures(l).includes('L9'))]);
    const count = paperLeaves(B).filter((l) => leafLectures(l).includes('L9')).length;
    ok(JSON.stringify(r.parts) === JSON.stringify(expectDim), 'the L9 filter dims exactly the parts off L9', r.parts.map(([id, d]) => `${id}${d ? ' dim' : ''}`).join(', '));
    ok(r.chip?.replace(/\s+/g, ' ').trim() === `L9 ${count}`, 'the L9 chip shows the paper\'s count of L9 parts', r.chip);
    ok(r.matches.length === 4, 'each question step shows how many of its parts are on L9', r.matches.join(' '));
    await fp.close();
  }

  // ── broken storage ────────────────────────────────────────────────────────
  if (want('storage')) {
    const sp = await open({ tag: 'storage', brokenStorage: true, clear: false });
    await goStep(sp, 1);
    const id = paperLeaves(PAPERS[0])[0].id;
    await sp.click(`[data-leaf="${id}"]`);
    await sleep(200);
    const ink = await sp.$$eval('.dlxp-ink', (els) => els.length);
    ok(ink === 1, 'with localStorage throwing, the page renders and reveals still work');
    await sp.close();
  }

  // ── reduced motion ────────────────────────────────────────────────────────
  if (want('reduced')) {
    const rp = await open({ tag: 'reduced', reduced: true, at: 1 });
    await clickText(rp, '.dlxp-qbar button', /Reveal all parts/);
    await sleep(80);
    const r = await rp.evaluate(() => {
      const el = document.querySelector('.dlxp-ink--write > *');
      const s = el && getComputedStyle(el);
      const turn = getComputedStyle(document.querySelector('.dlxp-turn'));
      return { anim: s?.animationName, clip: s?.clipPath, turn: turn.animationName };
    });
    ok(r.anim === 'none' && (r.clip === 'none' || !r.clip) && r.turn === 'none', 'reduced motion: answers and page turns appear with no animation', JSON.stringify(r));
    await rp.close();
  }

  // ── keyboard ──────────────────────────────────────────────────────────────
  if (want('keyboard')) {
    const kp = await open({ tag: 'keyboard', at: 1 });
    const id = paperLeaves(PAPERS[0])[0].id;
    await kp.focus(`[data-leaf="${id}"]`);
    await kp.keyboard.press('Enter');
    await sleep(200);
    const revealed = await kp.$eval(`[data-leaf="${id}"]`, (b) => b.getAttribute('aria-pressed'));
    await kp.keyboard.press('Tab');
    await kp.keyboard.press('Tab');
    await kp.keyboard.press('Tab');
    await kp.keyboard.press('Enter');
    await sleep(200);
    const marked = await kp.evaluate(() => document.querySelector('.dlxp-mark__n--on')?.textContent);
    await kp.focus('#dlxp-step-1');
    await kp.keyboard.press('ArrowRight');
    await sleep(400);
    const step = await kp.evaluate(() => ({ cur: document.querySelector('.dlxp-step--on .dlxp-step__label')?.textContent, focus: document.activeElement?.id }));
    ok(revealed === 'true', 'keyboard: Enter on Reveal answer writes the answer');
    ok(marked === '2', 'keyboard: Tab to a mark numeral, Enter sets it', `marked ${marked}`);
    ok(step.cur === 'Q2' && step.focus === 'dlxp-step-2', 'keyboard: → on the stepper turns to the next question and keeps focus', JSON.stringify(step));
    await kp.close();
  }

  // ── NotebookLM dropdown ───────────────────────────────────────────────────
  if (want('nlm')) {
    const np = await open({ tag: 'nlm' });
    await np.click('.dlxp-export__toggle');
    await sleep(250);
    const r = await np.evaluate(() => {
      const box = (s) => document.querySelector(s)?.getBoundingClientRect();
      const btn = box('.dlxp-export .dlxp-btn');
      const tog = box('.dlxp-export__toggle');
      const nlm = box('.dlxp-nlm');
      return {
        under: !!(btn && tog && nlm) && tog.top >= btn.bottom - 1 && nlm.top >= tog.bottom - 1 && Math.abs(nlm.left - btn.left) < 4 && Math.abs(tog.left - btn.left) < 4,
        steps: document.querySelectorAll('.dlxp-nlm__steps li').length,
        k: document.querySelector('.dlxp-nlm__k')?.textContent ?? '',
        text: document.querySelector('.dlxp-nlm__text')?.textContent ?? '',
      };
    });
    ok(r.under, 'the NotebookLM disclosure sits directly under Export PDF');
    ok(r.steps >= 3 && r.text === NLM_PROMPT && r.k.includes(`${NLM_PROMPT.length} characters`), 'numbered steps, the prompt, and its character count', r.k);
    await np.click('.dlxp-nlm__copy');
    await sleep(400);
    const fb = await np.evaluate(() => ({ label: document.querySelector('.dlxp-nlm__copy').textContent, sel: String(window.getSelection()) }));
    ok(/Copied/.test(fb.label) || (/Selected/.test(fb.label) && fb.sel.length > 100), 'Copy copies, or falls back to selecting the prompt', fb.label.trim());
    await np.close();
  }

  // ── export + PDF text ─────────────────────────────────────────────────────
  if (want('export') || want('pdf')) {
    const ep = await open({ tag: 'export' });
    const title0 = await ep.title();
    await clickText(ep, '.dlxp-export button', /Export PDF/);
    await ep.waitForFunction(() => window.__printCalls === 1, { timeout: 30000 });
    const during = await ep.evaluate(() => ({ cls: document.documentElement.classList.contains('dlxp-printing'), book: !!document.querySelector('.dlxp-book'), answers: document.querySelectorAll('.dlxp-book__ans').length }));
    const leaves = PAPERS.flatMap(paperLeaves);
    ok(during.cls && during.book && during.answers === leaves.length, 'Export PDF calls print once, in print mode, with the book mounted (every model answer in it)', JSON.stringify(during));
    let txt = '';
    if (want('pdf')) {
      await ep.emulateMediaType('print');
      await sleep(800);
      const file = path.join(OUT, 'exam-practice.pdf');
      await ep.pdf({ path: file, format: 'A4', printBackground: true, preferCSSPageSize: true });
      await ep.emulateMediaType('screen');
      execFileSync('pdftotext', ['-enc', 'UTF-8', '-layout', file, path.join(OUT, 'exam-practice.txt')]);
      txt = fs.readFileSync(path.join(OUT, 'exam-practice.txt'), 'utf8');
      const info = execFileSync('pdfinfo', [file]).toString();
      const pages = Number(/Pages:\s+(\d+)/.exec(info)?.[1] ?? 0);
      console.log(`      PDF: ${pages} pages, ${(fs.statSync(file).size / 1024).toFixed(0)} KB`);
      const flat = txt.replace(/\s+/g, ' ');
      // every paper heading, question and part label, in order
      const order = [];
      for (const p of PAPERS) {
        order.push(p.name.toUpperCase());
        for (const q of p.questions) order.push(`${p.name} · Question ${q.n}. (20 marks)`);
        order.push(`Model answers · ${p.name}`);
        for (const l of paperLeaves(p)) order.push(leafLabel(p, l.question, l));
      }
      let at = 0;
      const missing = [];
      for (const s of order) {
        const i = flat.indexOf(s, at);
        if (i === -1) missing.push(s);
        else at = i + s.length;
      }
      ok(missing.length === 0, 'PDF: every paper, question heading and model-answer label, in order', missing.slice(0, 4).join(' | '));
      // part labels inside each question
      const partLabels = PAPERS.every((p) => p.questions.every((q) => q.parts.every((pt) => flat.includes(`${pt.label} `))));
      ok(partLabels, 'PDF: every part label is printed');
      ok(NLM_PICKS.every((pick) => {
        const p = PAPERS.find((x) => paperLeaves(x).some((l) => l.id === pick.id));
        const l = p && paperLeaves(p).find((x) => x.id === pick.id);
        return l && flat.includes(leafLabel(p, l.question, l));
      }), 'PDF: every part the NotebookLM prompt names appears verbatim');
      const twins = ['θ ← θ − η ∇_θ J(θ)', texText(String.raw`\mathbf{z}_{(t)} = \mathbf{g}_{(t)} \otimes \mathbf{h}_{(t)}`), 'softmax'];
      ok(twins.every((t) => flat.includes(t)), 'PDF: formulas read as plain text', twins.filter((t) => !flat.includes(t)).join(' | '));
      const ui = ['Reveal', 'Your mark', 'Hide answer', 'Practice paper A', 'Sample paper ', 'Reset', 'NotebookLM video', 'in the NotebookLM'];
      const leaks = ui.filter((u) => flat.includes(u));
      ok(leaks.length === 0, 'PDF: no UI text (reveal buttons, self-marks, tabs, export UI)', leaks.join(', '));
      ok(!/\\[a-z]+\{/.test(flat), 'PDF: no raw TeX commands in the text layer');
    }
    await ep.evaluate(() => window.dispatchEvent(new Event('afterprint')));
    await sleep(300);
    const after = await ep.evaluate(() => ({ cls: document.documentElement.classList.contains('dlxp-printing'), book: !!document.querySelector('.dlxp-book') }));
    ok(!after.cls && !after.book && (await ep.title()) === title0, 'afterprint restores the page (class, book, title)');
    await ep.close();
  }

  // ── screenshots ───────────────────────────────────────────────────────────
  if (want('shots')) {
    for (const theme of ['jade', 'coral', 'arcade']) {
      for (const width of [1440, 390]) {
        const sp = await open({ theme, width, tag: `${theme}-${width}`, paper: 'A', at: 1 });
        await clickText(sp, '.dlxp-qbar button', /Reveal all parts/);
        await sleep(1800);
        const file = path.join(OUT, `page-${theme}-${width}.png`);
        await sp.screenshot({ path: file, fullPage: true });
        const overflow = await sp.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        ok(overflow <= 1, `${theme} @${width}: no horizontal page scroll`, `${overflow}px`);
        await sp.close();
      }
    }
  }

  // ── the other Deep Learning modules still render ─────────────────────────
  if (want('others')) {
    // every other Deep Learning module in the registry, so new ones are covered too
    const registry = fs.readFileSync(path.join(REPO, 'src/components/portal/registry.js'), 'utf8');
    const others = [...registry.matchAll(/id: '(dl-[a-z0-9-]+)'/g)].map((m) => m[1]).filter((id) => id !== 'dl-exam-practice');
    ok(others.length >= 12, 'the registry lists the other Deep Learning modules', others.length);
    for (const id of others) {
      const before = consoleMsgs.length;
      const lp = await open({ tag: id, route: `/portal/${id}`, wait: '.portal__content', clear: false });
      await sleep(600);
      const r = await lp.evaluate(() => ({ text: (document.querySelector('.portal__content')?.innerText ?? '').length, nodes: document.querySelectorAll('.portal__content *').length }));
      const errs = consoleMsgs.slice(before).filter((m) => /pageerror|error:/.test(m));
      ok(r.nodes > 20 && errs.length === 0, `/portal/${id} still renders`, `${r.nodes} nodes${errs.length ? ` · ${errs[0]}` : ''}`);
      await lp.close();
    }
  }
  await page.close();
} finally {
  await browser.close();
}

const noise = consoleMsgs.filter((m) => !/Download the React DevTools|GPU stall|WebGL|THREE\./.test(m));
ok(noise.length === 0, 'zero console errors or warnings across every run', noise.slice(0, 6).join(' || '));
console.log(`\n${fails.length ? `${fails.length} FAILED` : 'ALL PASS'}  (${OUT})`);
process.exit(fails.length ? 1 : 0);
