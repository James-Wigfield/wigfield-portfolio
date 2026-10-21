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
     tabs       every notebook opens on Student notes (one tick per sheet
                unit, every diagram drawn); Legacy shows the old page (every
                notes line, every figure); arrow keys / Home / End move
                between the tabs; the jump-to-notebook link lands on it
     pens       on every sheet, text is one of the four pen inks (or grey
                furniture) and diagram line-work is black or green
     clean      no duplicate ids, no nested buttons, labelled SVG figures
     focus      focus mode enters (fullscreen or the overlay fallback), the
                root scrolls by itself and the header follows; it exits again
     persist    both pages' ticks survive a reload; "Resume at §N" offers the
                last section
     legacy     dl4s:ticks saved before the student-notes page existed still
                show on Legacy, and a page finished on either tab marks its
                section done (index rail + header)
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
const { SHEETS, sheetKeys } = await import(pathToFileURL(path.join(MOD, 'sheets/index.js')).href);
const SHEET_KEYS = Object.fromEntries(SECTIONS.map((s) => [s.id, sheetKeys(SHEETS[s.id])]));
const legacyLines = (s) => s.notes.reduce((a, g) => a + g.lines.length, 0);

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

async function open({ theme = 'jade', width = 1440, height = 900, reduced = false, brokenStorage = false, clear = false, seed = null, route = ROUTE, wait = '.dl4s-sec', tag = '', page: reuse } = {}) {
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
    if (seed) {
      // storage written by an earlier version of the page, set once before the first load
      await page.evaluateOnNewDocument((entries) => {
        try {
          if (sessionStorage.getItem('dl4s-check-seeded')) return;
          Object.entries(entries).forEach(([k, v]) => localStorage.setItem(k, JSON.stringify(v)));
          sessionStorage.setItem('dl4s-check-seeded', '1');
        } catch { /* ignore */ }
      }, seed);
    }
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
    const tex = await page.$$eval('.katex-error', (els) => els.map((e) => e.textContent.slice(0, 60)));
    ok(tex.length === 0, 'no KaTeX parse errors (student-notes pages)', tex.slice(0, 3).join(' | '));
  }

  // ── tabs: Student notes by default, Legacy one click away ─────────────────
  if (want('tabs')) {
    const tp = await open({ tag: 'tabs', clear: true });
    const nb = await tp.$$eval('.dl4s-nbt', (els) => els.map((el) => {
      const tabs = [...el.querySelectorAll('[role="tab"]')];
      const sel = tabs.find((t) => t.getAttribute('aria-selected') === 'true');
      const panel = sel && document.getElementById(sel.getAttribute('aria-controls'));
      return {
        id: el.closest('.dl4s-sec').id.replace('dl4s-', ''),
        labels: tabs.map((t) => t.textContent.trim()),
        selected: sel?.textContent.trim(),
        panelOk: !!panel && !panel.hidden && panel.getAttribute('aria-labelledby') === sel.id,
        sheet: !!el.querySelector('.dl4s-sh'),
        anchor: el.querySelector('[id$="-nb"]')?.className.split(' ')[0],
        // one tick control per sheet unit: line buttons, table rows, diagram ticks
        ticks: el.querySelectorAll('.dl4s-sh__u, button.dl4s-sh__tr, .dl4s-sh__figtick').length,
        figs: [...el.querySelectorAll('.dl4s-sh svg.dl4s-fig')].map((s) => s.getBoundingClientRect().height >= 40 && s.childElementCount >= 3),
      };
    }));
    ok(nb.length === SECTIONS.length && nb.every((n) => n.labels.join('|') === 'Student notes|Legacy'), 'every notebook has two tabs: Student notes, then Legacy', nb.filter((n) => n.labels.join('|') !== 'Student notes|Legacy').map((n) => n.id).join(', '));
    ok(nb.every((n) => n.selected === 'Student notes' && n.panelOk && n.sheet && n.anchor === 'dl4s-sh'), 'Student notes is selected by default, in its tabpanel, carrying the jump anchor');
    const tickBad = nb.filter((n) => n.ticks !== SHEET_KEYS[n.id].length).map((n) => `${n.id}:${n.ticks}/${SHEET_KEYS[n.id].length}`);
    ok(tickBad.length === 0, 'every sheet unit has exactly one tick control', tickBad.join(', '));
    ok(nb.every((n) => n.figs.every(Boolean)), 'every student-notes diagram drew something', `${nb.reduce((a, n) => a + n.figs.length, 0)} diagrams`);
    const qs = await tp.$$eval('.dl4s-sh__q', (els) => els.length);
    const wantQs = SECTIONS.reduce((a, s) => a + (s.check?.length ?? 0), 0);
    ok(qs >= wantQs, 'every check question sits in a sheet margin', `${qs} margin questions, ${wantQs} legacy`);
    // reveal works and doesn't tick anything
    const before = await tp.$$eval('#dl4s-s13a-nb [aria-pressed="true"]', (els) => els.length);
    await tp.click('#dl4s-s13a-nb .dl4s-sh__reveal');
    await sleep(150);
    const revealed = await tp.$eval('#dl4s-s13a-nb .dl4s-sh__q', (q) => !!q.querySelector('.dl4s-sh__a'));
    const after = await tp.$$eval('#dl4s-s13a-nb [aria-pressed="true"]', (els) => els.length);
    ok(revealed && before === after, 'a margin question reveals its answer without ticking anything');

    // keyboard: focus the selected tab, arrows / Home / End move and select
    await tp.focus('#dl4s-s06-nbt-sheet');
    const seq = [];
    for (const key of ['ArrowRight', 'ArrowRight', 'Home', 'End', 'ArrowLeft']) {
      await tp.keyboard.press(key);
      await sleep(80);
      seq.push(await tp.evaluate(() => `${document.activeElement?.textContent.trim()}:${document.activeElement?.getAttribute('aria-selected')}`));
    }
    ok(seq.join(',') === 'Legacy:true,Student notes:true,Student notes:true,Legacy:true,Student notes:true', 'arrow keys / Home / End move focus and selection along the tabs', seq.join(', '));

    // Legacy: the old page, whole
    await tp.evaluate(() => document.querySelectorAll('.dl4s-nbt__tab[id$="-legacy"]').forEach((b) => b.click()));
    await sleep(500);
    const lines = await tp.$$eval('.dl4s-nb__line', (els) => els.length);
    const wantLines = SECTIONS.reduce((a, s) => a + legacyLines(s), 0);
    ok(lines === wantLines, 'Legacy shows every legacy notes line as a tickable line', `${lines}/${wantLines}`);
    const empty = await tp.$$eval('.dl4s-nb__draw svg', (els) => els.filter((s) => s.getBoundingClientRect().height < 40 || s.childElementCount < 3).length);
    const draws = await tp.$$eval('.dl4s-nb__draw svg', (els) => els.length);
    ok(empty === 0 && draws === SECTIONS.reduce((a, s) => a + (s.draw?.length ?? 0), 0), 'Legacy draws every "Draw this" figure', `${draws} figures`);
    const legacyAnchors = await tp.$$eval('.dl4s-nbt [id$="-nb"]', (els) => els.every((e) => e.classList.contains('dl4s-nb')) && els.length);
    ok(legacyAnchors === SECTIONS.length, 'on Legacy the jump anchor is the legacy page', String(legacyAnchors));
    const tex = await tp.$$eval('.katex-error', (els) => els.length);
    ok(tex === 0, 'no KaTeX parse errors (legacy pages)');
    // the outcome's "notebook page" link lands on the notebook, tabs in view
    await tp.goto(`${BASE}${ROUTE}`, { waitUntil: 'networkidle0' });
    await tp.waitForSelector('.dl4s-sec');
    await sleep(400);
    await tp.evaluate(() => [...document.querySelectorAll('.dl4s-outcome__nb')].find((b) => b.closest('.dl4s-outcome__sec')?.textContent.includes('§14'))?.click());
    await sleep(900);
    const land = await tp.evaluate(() => {
      const nbt = document.querySelector('#dl4s-s14 .dl4s-nbt');
      const bar = document.querySelector('.dl4s-bar').getBoundingClientRect().bottom;
      const top = nbt.getBoundingClientRect().top;
      return { ok: top >= bar - 2 && top < bar + 80, top: Math.round(top), bar: Math.round(bar), focus: document.activeElement?.classList.contains('dl4s-sh__title') };
    });
    ok(land.ok && land.focus, 'the jump-to-notebook link lands on the tabbed notebook, its title focused', JSON.stringify(land));
    await tp.close();
  }

  // ── pens: only the four inks (+ grey furniture) on the sheets ─────────────
  if (want('pens')) {
    for (const theme of ['jade', 'coral', 'arcade']) {
      const pp = await open({ theme, tag: `pens-${theme}` });
      const res = await pp.evaluate(() => {
        const rgb = (c) => {
          const el = document.createElement('span');
          el.style.color = c;
          document.body.appendChild(el);
          const v = getComputedStyle(el).color;
          el.remove();
          return v;
        };
        const sheet = document.querySelector('.dl4s-sh');
        const cs = getComputedStyle(sheet);
        const pen = Object.fromEntries(['blue', 'black', 'red', 'green'].map((p) => [rgb(cs.getPropertyValue(`--pen-${p}`).trim()), p]));
        const furn = rgb(cs.getPropertyValue('--sh-furn').trim());
        // slide-check pointers aren't copied, so they are grey furniture too
        const roleOf = (el) => (el.closest('.dl4s-sh__count, .dl4s-sh__tool, .dl4s-sh__reveal, .dl4s-sh__box, .dl4s-sh__sc') ? 'furniture' : 'ink');
        const bad = [];
        const used = {};
        document.querySelectorAll('.dl4s-sh').forEach((sh) => {
          const walker = document.createTreeWalker(sh, NodeFilter.SHOW_TEXT);
          for (let n = walker.nextNode(); n; n = walker.nextNode()) {
            if (!n.textContent.trim()) continue;
            const el = n.parentElement;
            if (el.closest('svg')) continue;
            if (el.closest('.katex-mathml')) continue;
            const c = getComputedStyle(el).color;
            const role = roleOf(el);
            if (role === 'furniture' ? c !== furn : !pen[c]) bad.push(`${sh.id}: "${n.textContent.trim().slice(0, 24)}" ${c}`);
            if (role === 'ink') used[pen[c]] = (used[pen[c]] || 0) + 1;
          }
          sh.querySelectorAll('svg.dl4s-fig *').forEach((el) => {
            const st = getComputedStyle(el);
            const stroke = st.stroke !== 'none' ? st.stroke : null;
            const fill = el.tagName === 'text' ? st.fill : null;
            [stroke, fill].filter(Boolean).forEach((c) => { if (!['black', 'green'].includes(pen[c])) bad.push(`${sh.id} svg <${el.tagName}> ${c}`); });
          });
        });
        // every ink must reach 4.5:1 on the paper
        // computed colours come back as rgb(…) or, from color-mix, color(srgb r g b)
        const channels = (c) => (c.startsWith('color(srgb') ? c.match(/[\d.]+/g).slice(0, 3).map((v) => Number(v) * 255) : c.match(/[\d.]+/g).slice(0, 3).map(Number));
        const lum = (c) => {
          const [r, g, b] = channels(c).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
          return 0.2126 * r + 0.7152 * g + 0.0722 * b;
        };
        const paper = getComputedStyle(sheet).backgroundColor;
        const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
        const contrast = Object.fromEntries(Object.entries(pen).map(([c, p]) => [p, Math.round(ratio(c, paper) * 10) / 10]));
        return { bad, used, contrast, paper };
      });
      ok(res.bad.length === 0, `${theme}: sheet text is pen ink or grey furniture; diagrams black + green`, res.bad.slice(0, 4).join(' | '));
      ok(['blue', 'black', 'red', 'green'].every((p) => res.used[p] > 0) && !res.used.undefined, `${theme}: all four pens in use, and nothing else`, JSON.stringify(res.used));
      ok(Object.values(res.contrast).every((r) => r >= 4.5), `${theme}: every pen ≥ 4.5:1 on the paper`, JSON.stringify(res.contrast));
      await pp.close();
    }
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
    // student-notes page: tick three units of §2
    const units = await pp.$$('#dl4s-s02-nb .dl4s-sh__u');
    for (const i of [0, 2, 4]) await units[i].click();
    // legacy page: tick three lines of §3
    await pp.click('#dl4s-s03-nbt-legacy');
    await sleep(300);
    const lines = await pp.$$('#dl4s-s03-nb .dl4s-nb__line');
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
    const pressed = await pp.$$eval('#dl4s-s02-nb .dl4s-sh__u', (els) => els.map((e) => e.getAttribute('aria-pressed') === 'true'));
    ok(pressed[0] && pressed[2] && pressed[4] && !pressed[1], 'student-notes ticks survive a reload', pressed.map((p) => (p ? 'x' : '.')).join(''));
    const stored = await pp.evaluate(() => JSON.parse(localStorage.getItem('dl4s:sheetTicks') || '{}').s02 || []);
    ok(stored.length === 3 && stored.every((k) => /^[a-z0-9-]+:(\d+(\.\d+)?|fig|m\d+)$|^big$/.test(k)), 'they are stored by key under dl4s:sheetTicks', stored.join(' '));
    await pp.click('#dl4s-s03-nbt-legacy');
    await sleep(300);
    const lpressed = await pp.$$eval('#dl4s-s03-nb .dl4s-nb__line', (els) => els.map((e) => e.getAttribute('aria-pressed') === 'true'));
    ok(lpressed[0] && lpressed[2] && lpressed[4] && !lpressed[1], 'Legacy ticks survive a reload (dl4s:ticks)', lpressed.map((p) => (p ? 'x' : '.')).join(''));
    const sheetOpen = await pp.$eval('#dl4s-s04-nbt-sheet', (b) => b.getAttribute('aria-selected'));
    ok(sheetOpen === 'true', 'other notebooks still open on Student notes after a reload');
    const resume = await pp.$eval('.dl4s-resume .dl4s-btn', (b) => b.textContent.trim()).catch(() => '');
    ok(/Resume at §8/.test(resume), '"Resume at §N" offers the last section', resume);
    if (resume) {
      await pp.click('.dl4s-resume .dl4s-btn');
      await sleep(900);
      ok((await currentNo(pp)) === '§8', 'Resume jumps to that section', await currentNo(pp));
    }
    const prog = await pp.$eval('.dl4s-bar__progtext', (el) => el.textContent.replace(/\s+/g, ' '));
    ok(/^[1-9]\d?% copied · 0\//.test(prog), 'the header shows the copied share', prog);
    // put things back for the next runs
    await pp.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('dl4s:')).forEach((k) => localStorage.removeItem(k)));
    await pp.close();
  }

  // ── existing progress + either page finishes a section ────────────────────
  if (want('legacy')) {
    // dl4s:ticks as the previous version of the page saved it: §1 complete, §5 partly
    const s01 = SECTIONS.find((s) => s.id === 's01');
    const seed = { 'dl4s:ticks': { s01: Array.from({ length: legacyLines(s01) }, (_, i) => i), s05: [0, 1] } };
    const lp = await open({ tag: 'legacy-data', clear: true, seed });
    const rail = (no) => lp.evaluate((sno) => {
      const items = [...document.querySelectorAll('.dl4s-rail .dl4s-index__item')];
      const el = items.find((b) => b.querySelector('.dl4s-index__no')?.textContent.trim() === sno);
      return el ? { done: el.classList.contains('dl4s-index__item--done'), state: el.querySelector('.dl4s-index__state').getAttribute('aria-label') } : null;
    }, no);
    const r1 = await rail('1');
    const r5 = await rail('5');
    ok(r1?.done && /finished/.test(r1.state), 'a section finished on the old page is done in the index rail', JSON.stringify(r1));
    ok(r5 && !r5.done && /2 of \d+ lines on the Legacy page/.test(r5.state), 'partial old progress shows in the rail', JSON.stringify(r5));
    const pages = await lp.$eval('.dl4s-bar__progtext', (el) => el.textContent.replace(/\s+/g, ' '));
    ok(/· 1\/18 pages/.test(pages), 'the header counts it as a finished page', pages);
    await lp.click('#dl4s-s01-nbt-legacy');
    await sleep(300);
    const shown = await lp.$$eval('#dl4s-s01-nb .dl4s-nb__line', (els) => els.filter((e) => e.getAttribute('aria-pressed') === 'true').length);
    const count = await lp.$eval('#dl4s-s01-nb .dl4s-nb__count', (el) => el.textContent.trim());
    ok(shown === legacyLines(s01) && /page copied/.test(count), 'the old ticks show on the Legacy tab', `${shown} ticked · ${count}`);
    // finish §8 on the student-notes page with its own tool
    await lp.evaluate(() => document.querySelector('#dl4s-s08-nb .dl4s-sh__tool')?.click());
    await sleep(300);
    const r8 = await rail('8');
    const sheetCount = await lp.$eval('#dl4s-s08-nb .dl4s-sh__count', (el) => el.textContent.trim());
    ok(r8?.done && /page copied/.test(sheetCount), 'a section finished on the student-notes page is done too', `${JSON.stringify(r8)} · ${sheetCount}`);
    const pages2 = await lp.$eval('.dl4s-bar__progtext', (el) => el.textContent.replace(/\s+/g, ' '));
    ok(/· 2\/18 pages/.test(pages2), 'the header counts both', pages2);
    await lp.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('dl4s:')).forEach((k) => localStorage.removeItem(k)));
    await lp.close();
  }

  // ── broken storage ────────────────────────────────────────────────────────
  if (want('storage')) {
    const bp = await open({ tag: 'storage', brokenStorage: true });
    const n = await bp.$$eval('.dl4s-sec', (els) => els.length);
    await bp.click('#dl4s-s01-nb .dl4s-sh__u');
    await sleep(200);
    const ticked = await bp.$eval('#dl4s-s01-nb .dl4s-sh__u', (e) => e.getAttribute('aria-pressed'));
    await bp.click('#dl4s-s01-nbt-legacy');
    await sleep(200);
    await bp.click('#dl4s-s01-nb .dl4s-nb__line');
    await sleep(200);
    const lticked = await bp.$eval('#dl4s-s01-nb .dl4s-nb__line', (e) => e.getAttribute('aria-pressed'));
    ok(n === SECTIONS.length && ticked === 'true' && lticked === 'true', 'with localStorage throwing, the page renders and both pages still tick', `${n} sections`);
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
