/* ============================================================================
   DL PROJECT 2 — headless check of /portal/dl-project-2
   (puppeteer-core + Edge, seeded through the portal gate like dl-game-check)
   ----------------------------------------------------------------------------
     node tools/dl-project2/page-check.mjs [outDir]      (dev server on 5173)
     SITE_URL=http://localhost:5199 node tools/dl-project2/page-check.mjs out

   Checks
     fidelity   the .ipynb → data/notebook.js → DOM chain: every cell present,
                in order, verbatim code, the real execution counts, every
                output rendered, markdown words in order
     scenes     every scene plays to the end, replays to an identical end
                frame, seeks to 0.5 and 1 through window.__dlp2, and its end
                frame matches the reduced-motion static frame
     beats      at the end of every beat the live timeline matches that beat's
                static frame art(k) (dev-only off-screen copies) — catches a
                later fromTo flashing its start state early, and storyboard
                frames that drift from the animation
     reduced    prefers-reduced-motion: no timelines, finished frames
     clean      zero console errors/warnings, no duplicate ids, no nested
                buttons; with localStorage throwing the page still renders
     export     the button sets document.title and calls print(); afterprint
                restores it; NotebookLM dropdown opens and Copy copies
     pdf        print-media PDF (A4, backgrounds) + pdftotext: every code line
                and figure-free text present, no prompt text
     shots      full page in jade / coral / arcade at 1440 and 390
   ========================================================================== */
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL, fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const MOD = path.join(REPO, 'src/components/portal/modules/deep-learning/project2');
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const PDFTOTEXT = fs.existsSync('C:/Program Files/Git/mingw64/bin/pdftotext.exe') ? 'C:/Program Files/Git/mingw64/bin/pdftotext.exe' : 'pdftotext';
const BASE = process.env.SITE_URL || 'http://localhost:5173';
const OUT = path.resolve(process.argv[2] || path.join(HERE, 'out'));
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
// SCENES=id1,id2 (or a prefix ending in *) limits the scene checks to those scene ids
const SCENE_FILTER = (process.env.SCENES || '').split(',').filter(Boolean);
const sceneWanted = (id) => !SCENE_FILTER.length || SCENE_FILTER.some((f) => (f.endsWith('*') ? id.startsWith(f.slice(0, -1)) : id === f));
const want = (k) => !ONLY.length || ONLY.includes(k);
fs.mkdirSync(OUT, { recursive: true });

const { NB_META, CELLS } = await import(pathToFileURL(path.join(MOD, 'data/notebook.js')).href);
const { NLM_PROMPT, NLM_COMPACT } = await import(pathToFileURL(path.join(MOD, 'notebooklm.js')).href);
const NB_PATH = process.env.NB || 'C:/Users/james/Documents/university/cits5017/cits5017-project-two/Wigfield_James-proj2.ipynb';

const fails = [];
const ok = (cond, label, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${extra !== '' ? `  — ${extra}` : ''}`);
  if (!cond) fails.push(label);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const norm = (s) => s.replace(/\r\n?/g, '\n').replace(/\n+$/, '');
const words = (s) => (s.toLowerCase().match(/[a-z0-9]+/g) || []);

const SEED = () => {
  sessionStorage.setItem('portal_auth', JSON.stringify({ token: 'mock-session-token', key: 'wiggy1', issued_at: new Date().toISOString() }));
};

const browser = await puppeteer.launch({ executablePath: EDGE, headless: 'new', args: ['--hide-scrollbars'] });
const consoleMsgs = [];

async function open({ theme = 'jade', width = 1440, height = 900, reduced = false, brokenStorage = false, tag = '' } = {}) {
  const page = await browser.newPage();
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warn') consoleMsgs.push(`[${tag || theme}] ${m.type()}: ${m.text()}`);
  });
  page.on('pageerror', (e) => consoleMsgs.push(`[${tag || theme}] pageerror: ${e}`));
  await page.setViewport({ width, height, deviceScaleFactor: 1 });
  if (reduced) await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await page.evaluateOnNewDocument(SEED);
  await page.evaluateOnNewDocument((t) => {
    try { localStorage.setItem('portal:theme', t); } catch { /* broken storage run */ }
  }, theme);
  if (brokenStorage) {
    // localStorage only (the gate's session lives in sessionStorage): every
    // call throws, the way blocked site data or a full quota does
    await page.evaluateOnNewDocument(() => {
      const boom = () => { throw new DOMException('storage disabled', 'SecurityError'); };
      const dead = { getItem: boom, setItem: boom, removeItem: boom, clear: boom, key: boom, length: 0 };
      Object.defineProperty(window, 'localStorage', { configurable: true, get: () => dead });
    });
  }
  await page.goto(`${BASE}/portal/dl-project-2`, { waitUntil: 'networkidle0' });
  await page.waitForSelector('.dlp2-sheet', { timeout: 30000 });
  return page;
}

// a geometry + visibility signature of everything drawn in a stage
const SIG = (sel) => {
  const svg = document.querySelector(sel);
  if (!svg) return null;
  const base = svg.getBoundingClientRect();
  const out = [];
  svg.querySelectorAll('path, line, rect, circle, ellipse, text, polyline, polygon').forEach((el) => {
    if (el.closest('defs, pattern, clipPath, marker')) return;
    let op = 1;
    for (let n = el; n && n !== svg.parentNode; n = n.parentNode) {
      const cs = getComputedStyle(n);
      op *= Number(cs.opacity);
      if (cs.display === 'none' || cs.visibility === 'hidden') op = 0;
    }
    const b = el.getBoundingClientRect();
    const dash = getComputedStyle(el).strokeDashoffset;
    const off = parseFloat(dash) || 0;
    // snap to 0.1 px before halving: far down the page float32 layout gives 14.996 for 15
    const q = (v) => Math.round(Math.round(v * 10) / 20);
    out.push([el.tagName, q(b.x - base.x), q(b.y - base.y), q(b.width), q(b.height), op > 0.5 ? 1 : 0, off > 1 ? 'undrawn' : '', el.textContent?.slice(0, 20) || ''].join(':'));
  });
  return out;
};
// the same signature in viewBox-relative units (1000 = the svg's width), for
// comparing a live stage with an off-screen static frame of a different size
const SIGN = (sel) => {
  const svg = document.querySelector(sel);
  if (!svg) return null;
  const base = svg.getBoundingClientRect();
  if (!base.width) return null;
  const u = 1000 / base.width;
  const out = [];
  svg.querySelectorAll('path, line, rect, circle, ellipse, text, polyline, polygon, image').forEach((el) => {
    if (el.closest('defs, pattern, clipPath, marker, mask')) return;
    let op = 1;
    for (let n = el; n && n !== svg.parentNode; n = n.parentNode) {
      const cs = getComputedStyle(n);
      op *= Number(cs.opacity);
      if (cs.display === 'none' || cs.visibility === 'hidden') op = 0;
    }
    const b = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    const off = Math.abs(parseFloat(cs.strokeDashoffset) || 0);
    const dash = cs.strokeDasharray;
    const len = el.getTotalLength ? (() => { try { return el.getTotalLength(); } catch { return 0; } })() : 0;
    // a line-draw tween leaves dasharray L / offset 0 when drawn, offset ≥ L when undrawn
    const undrawn = dash && dash !== 'none' && len > 0 && off > 0.5 * len;
    // part-drawn by a dash tween: its bbox is the whole geometry, so compare visibility only
    const partial = dash && dash !== 'none' && len > 0 && off > 1 && off < 0.98 * len;
    const cls = `${el.getAttribute('class') || el.tagName.toLowerCase()} < ${el.parentNode.getAttribute?.('class') || ''}`;
    // an undrawn line (dash offset ≥ half its length) counts as not visible
    out.push({ tag: el.tagName, cls, x: (b.x - base.x) * u, y: (b.y - base.y) * u, w: b.width * u, h: b.height * u, vis: op > 0.5 && !undrawn ? 1 : 0, undrawn: false, partial, text: (el.tagName === 'text' ? el.textContent.slice(0, 24) : '') });
  });
  return out;
};
const fuzzyDiff = (a, b, tol0 = 4) => {
  if (!a || !b) return ['missing frame'];
  if (a.length !== b.length) return [`element count ${a.length} vs ${b.length}`];
  const d = [];
  for (let i = 0; i < a.length; i++) {
    const p = a[i];
    const q = b[i];
    const visible = p.vis || q.vis;
    const tol = Math.max(tol0, 0.005 * Math.max(p.w, q.w));
    const id = `${p.tag}#${i} [${p.cls}]`;
    if (p.vis !== q.vis) d.push(`${id} "${p.text || q.text}" visible ${p.vis} vs ${q.vis}`);
    else if (visible && p.undrawn !== q.undrawn) d.push(`${id} drawn ${!p.undrawn} vs ${!q.undrawn}`);
    else if (visible && (p.partial || q.partial)) continue;
    else if (visible && (Math.abs(p.x - q.x) > tol || Math.abs(p.y - q.y) > tol || Math.abs(p.w - q.w) > tol || Math.abs(p.h - q.h) > tol)) {
      d.push(`${id} "${p.text}" at ${p.x.toFixed(0)},${p.y.toFixed(0)} ${p.w.toFixed(0)}x${p.h.toFixed(0)} vs ${q.x.toFixed(0)},${q.y.toFixed(0)} ${q.w.toFixed(0)}x${q.h.toFixed(0)}`);
    } else if (visible && p.text !== q.text) d.push(`${id} text "${p.text}" vs "${q.text}"`);
  }
  return d;
};
const diffSig = (a, b) => {
  if (!a || !b) return ['missing'];
  const d = [];
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) if (a[i] !== b[i]) d.push(`${a[i]} ≠ ${b[i]}`);
  return d;
};

try {
  // ── data vs the .ipynb ────────────────────────────────────────────────────
  if (want('fidelity')) {
    let nb = null;
    try { nb = JSON.parse(fs.readFileSync(NB_PATH, 'utf8')); } catch (e) { ok(false, 'read the notebook', String(e)); }
    if (nb) {
      const raw = fs.readFileSync(NB_PATH);
      const crypto = await import('node:crypto');
      const sha = crypto.createHash('sha256').update(raw).digest('hex');
      ok(sha === NB_META.sha256, 'data/notebook.js was extracted from the current notebook', `${NB_META.sha12} vs ${sha.slice(0, 12)}`);
      ok(nb.cells.length === CELLS.length, 'same cell count as the .ipynb', `${CELLS.length} / ${nb.cells.length}`);
      const join = (s) => (Array.isArray(s) ? s.join('') : s || '');
      const bad = [];
      nb.cells.forEach((c, i) => {
        const d = CELLS[i];
        if (!d || d.type !== c.cell_type) bad.push(`${i}: type`);
        else if (d.src !== join(c.source)) bad.push(`${i}: source`);
        else if (c.cell_type === 'code' && (d.ec ?? null) !== (c.execution_count ?? null)) bad.push(`${i}: ec`);
        else if (c.cell_type === 'code' && d.outputs.length !== (c.outputs || []).length) bad.push(`${i}: outputs`);
      });
      ok(bad.length === 0, 'every cell verbatim with its execution count and output count', bad.slice(0, 8).join(', '));
    }
  }

  const page = await open({ tag: 'main' });

  // ── DOM vs data ───────────────────────────────────────────────────────────
  if (want('fidelity')) {
    const dom = await page.$$eval('.dlp2-flow [data-cell]', (els) => els.map((el) => {
      const code = el.querySelector('.dlp2-code');
      const prompt = el.querySelector('.dlp2-cell__row:not(.dlp2-cell__row--out) .dlp2-prompt');
      const outs = el.querySelector('.dlp2-outs');
      return {
        i: Number(el.dataset.cell),
        code: code ? code.textContent : null,
        prompt: prompt ? prompt.textContent.replace(/\u00a0/g, ' ') : null,
        md: el.classList.contains('dlp2-cell--md') ? el.querySelector('.dlp2-md').innerText : null,
        // a Keras summary's outputs sit in one .dlp2-summary group
        nOut: outs ? outs.querySelectorAll(':scope > :not(.dlp2-summary), :scope > .dlp2-summary > *').length : 0,
        imgs: outs ? [...outs.querySelectorAll('img')].map((im) => ({ ok: im.complete && im.naturalWidth > 0 })) : [],
      };
    }));
    ok(dom.length === CELLS.length && dom.every((d, k) => d.i === k), 'every cell rendered once, in notebook order', `${dom.length} cells`);
    const codeBad = [];
    const promptBad = [];
    const outBad = [];
    const mdBad = [];
    dom.forEach((d) => {
      const c = CELLS[d.i];
      if (!c) return;
      if (c.type === 'code') {
        if (norm(d.code ?? '') !== norm(c.src)) codeBad.push(d.i);
        const want = `In [${c.ec ?? ' '}]:`;
        if (d.prompt !== want) promptBad.push(`${d.i}:${d.prompt}`);
        if (d.nOut !== c.outputs.length) outBad.push(`${d.i}:${d.nOut}/${c.outputs.length}`);
        if (d.imgs.some((im) => !im.ok)) outBad.push(`${d.i}:img`);
      } else if (c.type === 'markdown') {
        // every word of the source appears in the rendered text, in order
        const src = words(c.src.replace(/\$[^$]*\$/g, ' ').replace(/\]\([^)]*\)/g, ']'));
        const got = words(d.md || '');
        let j = 0;
        for (const w of got) if (j < src.length && w === src[j]) j += 1;
        if (j < src.length) mdBad.push(`${d.i}@${src[j]}`);
      }
    });
    ok(codeBad.length === 0, 'code cells show their source verbatim', codeBad.join(', '));
    ok(promptBad.length === 0, 'In [n] prompts show the real execution counts', promptBad.slice(0, 6).join(', '));
    ok(outBad.length === 0, 'every output rendered (and every figure decoded)', outBad.slice(0, 6).join(', '));
    ok(mdBad.length === 0, 'markdown cells render every source word in order', mdBad.slice(0, 6).join(', '));
  }

  // ── structure ─────────────────────────────────────────────────────────────
  if (want('clean')) {
    const dupIds = await page.evaluate(() => {
      const seen = new Map();
      document.querySelectorAll('[id]').forEach((el) => seen.set(el.id, (seen.get(el.id) || 0) + 1));
      return [...seen].filter(([, n]) => n > 1).map(([id]) => id);
    });
    ok(dupIds.length === 0, 'no duplicate DOM ids', dupIds.slice(0, 6).join(', '));
    const nested = await page.$$eval('button button, a button, button a', (els) => els.length);
    ok(nested === 0, 'no nested interactive elements', String(nested));
    const svgs = await page.$$eval('.dlp2-scene__stage', (els) => els.map((s) => [s.getAttribute('role'), s.getAttribute('aria-label')]));
    ok(svgs.every(([r, l]) => r === 'img' && l && l.length > 10), 'every scene stage is role="img" with a real label', `${svgs.length} stages`);
  }

  // ── scenes ────────────────────────────────────────────────────────────────
  const ids = await page.evaluate(() => (window.__dlp2 ? window.__dlp2.ids() : null));
  ok(Array.isArray(ids), 'window.__dlp2 seek handle present (dev)', ids ? `${ids.length} scenes` : 'missing');
  const endSigs = {};
  if (want('scenes') && ids) {
    for (const id of ids.filter(sceneWanted)) {
      const sel = `#dlp2-scene-${id} .dlp2-scene__stage`;
      // a scene behind a phase toggle: press its toggle first
      await page.evaluate((sid) => {
        const fig = document.getElementById(`dlp2-scene-${sid}`);
        if (fig && !fig.offsetParent) document.querySelector(`[data-shows="${sid}"]`)?.click();
      }, id);
      await sleep(100);
      // real playback at 4x: scenes hold each beat long enough to read its caption
      await page.evaluate((sid) => { window.__dlp2.speed(sid, 4); }, id);
      await page.evaluate((s) => document.querySelector(s)?.closest('figure')?.scrollIntoView({ block: 'center' }), sel);
      // first run: plays by itself on entering view
      let st = null;
      const t0 = Date.now();
      for (;;) {
        st = await page.evaluate((sid) => window.__dlp2.state(sid), id);
        if (st.progress >= 1 || Date.now() - t0 > 60000) break;
        await sleep(250);
      }
      ok(st.started && st.progress >= 1, `scene ${id}: plays on entering view and reaches its end`, `${st.duration}s`);
      await sleep(150);
      const a = await page.evaluate(SIG, sel);
      // replay: same end frame
      await page.evaluate((sid) => { window.__dlp2.replay(sid); }, id);
      await sleep(400);
      const mid = await page.evaluate((sid) => window.__dlp2.state(sid), id);
      const t1 = Date.now();
      for (;;) {
        st = await page.evaluate((sid) => window.__dlp2.state(sid), id);
        if (st.progress >= 1 || Date.now() - t1 > 60000) break;
        await sleep(250);
      }
      await sleep(150);
      const b = await page.evaluate(SIG, sel);
      const d = diffSig(a, b);
      ok(mid.progress < 1 && mid.playing && d.length === 0, `scene ${id}: replay restarts and ends on the identical frame`, d.slice(0, 3).join(' | '));
      endSigs[id] = b;
      // seek through the handle
      const s5 = await page.evaluate((sid) => window.__dlp2.seek(sid, 0.5), id);
      const s1 = await page.evaluate((sid) => window.__dlp2.seek(sid, 1), id);
      ok(Math.abs(s5.progress - 0.5) < 0.01 && s1.progress === 1 && !s1.playing, `scene ${id}: seeks to 0.5 and 1`, `beat ${s5.beat + 1}/${s5.beats} at 0.5`);
      const c = await page.evaluate(SIG, sel);
      ok(diffSig(b, c).length === 0, `scene ${id}: seek(1) lands on the same end frame`);
      // step controls
      await page.evaluate((sid) => window.__dlp2.seek(sid, 0), id);
      await page.click(`#dlp2-scene-${id} .dlp2-ctl[aria-label="Next step"]`);
      await sleep(1500);
      const sn = await page.evaluate((sid) => window.__dlp2.state(sid), id);
      ok(sn.progress > 0 && !sn.playing, `scene ${id}: next-step advances one beat and stops`, `beat ${sn.beat + 1}`);
    }
  }
  // ── every beat's end matches its static frame art(k) ────────────────────
  if (want('beats') && ids) {
    for (const id of ids.filter(sceneWanted)) {
      await page.evaluate((sid) => {
        const fig = document.getElementById(`dlp2-scene-${sid}`);
        if (fig && !fig.offsetParent) document.querySelector(`[data-shows="${sid}"]`)?.click();
      }, id);
      await page.evaluate((sid) => document.getElementById(`dlp2-scene-${sid}`)?.scrollIntoView({ block: 'center' }), id);
      await sleep(120);
      const ends = await page.evaluate((sid) => window.__dlp2.beatEnds(sid), id);
      const bad = [];
      // walk the beats backwards from the end: backward seeks are where GSAP
      // reverts early sets, so this is the harder direction
      await page.evaluate((sid) => { window.__dlp2.seek(sid, 1); }, id);
      for (let k = ends.length - 1; k >= 0; k--) {
        await page.evaluate((sid, p) => { window.__dlp2.seek(sid, p); }, id, ends[k]);
        await sleep(60);
        const live = await page.evaluate(SIGN, `#dlp2-scene-${id} .dlp2-scene__stage`);
        const still = await page.evaluate(SIGN, `#dlp2-scene-${id} .dlp2-scene__devframes svg[data-step="${k}"]`);
        const d = fuzzyDiff(live, still);
        if (d.length) bad.push(`beat ${k + 1}: ${d.slice(0, 2).join(' | ')}${d.length > 2 ? ` (+${d.length - 2})` : ''}`);
      }
      ok(bad.length === 0, `scene ${id}: each beat's end matches its static frame (${ends.length} beats)`, bad.slice(0, 3).join(' || '));
    }
  }
  await page.close();

  // ── reduced motion ────────────────────────────────────────────────────────
  if (want('reduced')) {
    const rp = await open({ reduced: true, tag: 'reduced' });
    const rids = await rp.evaluate(() => (window.__dlp2 ? window.__dlp2.ids() : []));
    for (const id of rids.filter(sceneWanted)) {
      const st = await rp.evaluate((sid) => window.__dlp2.state(sid), id);
      const sel = `#dlp2-scene-${id} .dlp2-scene__stage`;
      await rp.evaluate((sid) => {
        const fig = document.getElementById(`dlp2-scene-${sid}`);
        if (fig && !fig.offsetParent) document.querySelector(`[data-shows="${sid}"]`)?.click();
      }, id);
      await sleep(100);
      await rp.evaluate((s) => document.querySelector(s)?.scrollIntoView({ block: 'center' }), sel);
      await sleep(100);
      const sig = await rp.evaluate(SIG, sel);
      const d = endSigs[id] ? diffSig(endSigs[id], sig) : [];
      const caption = await rp.$eval(`#dlp2-scene-${id} .dlp2-scene__capt`, (el) => el.textContent);
      ok(st.reduced && sig && !sig.some((x) => x.includes('undrawn')) && d.length === 0 && caption.length > 2,
        `scene ${id}: reduced motion shows the finished, labelled frame (no timeline)`, d.slice(0, 2).join(' | '));
    }
    await rp.close();
  }

  // ── broken storage ────────────────────────────────────────────────────────
  if (want('clean')) {
    const bp = await open({ brokenStorage: true, tag: 'no-storage' });
    const n = await bp.$$eval('.dlp2-flow [data-cell]', (els) => els.length);
    await bp.click('.dlp2-chrome .dlp2-seg button');
    await sleep(200);
    ok(n === CELLS.length, 'renders with localStorage throwing (and collapse-all still works)', `${n} cells`);
    await bp.close();
  }

  // ── export + NotebookLM ───────────────────────────────────────────────────
  if (want('export')) {
    const ep = await open({ tag: 'export' });
    await browser.defaultBrowserContext().overridePermissions(BASE, ['clipboard-read', 'clipboard-write', 'clipboard-sanitized-write']);
    await ep.evaluate(() => {
      window.__prints = [];
      window.print = () => window.__prints.push(document.title);
    });
    const before = await ep.title();
    await ep.click('.dlp2-head__actions .dlp2-btn--primary');
    const prints = await ep.evaluate(() => window.__prints);
    await ep.evaluate(() => window.dispatchEvent(new Event('afterprint')));
    const after = await ep.title();
    ok(prints.length === 1 && prints[0] === 'cits5017-project2-explainer' && after === before, 'Export PDF sets the title, calls print(), afterprint restores it', `${prints[0]} → ${after}`);
    const order = await ep.$$eval('.dlp2-head__actions > *', (els) => els.map((e) => e.textContent.trim()));
    ok(/Export PDF/.test(order[0]) && /NotebookLM/.test(order[1]), 'NotebookLM dropdown sits directly under Export PDF', order.join(' | '));
    await ep.click('.dlp2-head__actions [aria-controls="dlp2-nlm"]');
    const expanded = await ep.$eval('[aria-controls="dlp2-nlm"]', (b) => b.getAttribute('aria-expanded'));
    const shown = await ep.$eval('#dlp2-nlm', (el) => !el.hidden && el.getBoundingClientRect().height > 50);
    await ep.click('.dlp2-nlm__block .dlp2-btn');
    await sleep(200);
    const clip = await ep.evaluate(() => navigator.clipboard.readText().catch(() => ''));
    const label = await ep.$eval('.dlp2-nlm__block .dlp2-btn', (b) => b.textContent);
    // the Windows clipboard hands text back with CRLF line ends
    ok(expanded === 'true' && shown && clip.replace(/\r\n/g, '\n') === NLM_PROMPT && label === 'Copied', 'NotebookLM prompt opens; Copy copies it and says Copied', `${clip.length} chars`);
    await ep.close();
  }

  // ── PDF ───────────────────────────────────────────────────────────────────
  if (want('pdf')) {
    const pp = await open({ theme: 'arcade', tag: 'pdf' });
    await pp.evaluate(() => { document.title = 'cits5017-project2-explainer'; }); // what the Export button sets
    await pp.emulateMediaType('print');
    await sleep(500);
    const pdfPath = path.join(OUT, 'cits5017-project2-explainer.pdf');
    await pp.pdf({ path: pdfPath, format: 'A4', printBackground: true, preferCSSPageSize: true, outline: true, tagged: true });
    await pp.close();
    let text = '';
    try {
      // -layout for reading; -raw (content-stream order) for the checks, so a
      // wrapped line reads back joined instead of interleaved with its column
      fs.writeFileSync(path.join(OUT, 'pdf.txt'), execFileSync(PDFTOTEXT, ['-layout', '-enc', 'UTF-8', pdfPath, '-'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }));
      text = execFileSync(PDFTOTEXT, ['-raw', '-enc', 'UTF-8', pdfPath, '-'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
      fs.writeFileSync(path.join(OUT, 'pdf-raw.txt'), text);
    } catch (e) {
      ok(false, 'pdftotext ran', String(e).slice(0, 200));
    }
    if (text) {
      const flat = text.replace(/\s+/g, ' ');
      const flatNoSpace = text.replace(/\s+/g, '');
      const missing = [];
      CELLS.filter((c) => c.type === 'code').forEach((c) => {
        c.src.split('\n').map((l) => l.trim()).filter((l) => l.length > 3).forEach((l) => {
          if (!flatNoSpace.includes(l.replace(/\s+/g, ''))) missing.push(`${c.i}: ${l.slice(0, 40)}`);
        });
      });
      ok(missing.length === 0, 'every code line is in the PDF text', `${missing.length} missing ${missing.slice(0, 3).join(' | ')}`);
      const outMissing = [];
      CELLS.filter((c) => c.type === 'code').forEach((c) => c.outputs.forEach((o) => {
        if (o.kind === 'stream' && o.name === 'stdout') {
          o.text.split('\n').map((l) => l.trim()).filter((l) => l.length > 3).forEach((l) => {
            if (!flatNoSpace.includes(l.replace(/\s+/g, ''))) outMissing.push(`${c.i}: ${l.slice(0, 40)}`);
          });
        }
      }));
      ok(outMissing.length === 0, 'every printed stdout line is in the PDF text', `${outMissing.length} missing ${outMissing.slice(0, 3).join(' | ')}`);
      const promptLeak = [NLM_PROMPT, NLM_COMPACT].some((p) => p.length > 40 && flat.includes(p.slice(0, 60).replace(/\s+/g, ' ')));
      ok(!promptLeak && !/NotebookLM prompt/.test(flat), 'no NotebookLM prompt text in the PDF');
      ok(flat.includes(NB_META.sha256.slice(0, 20)), 'the cover carries the notebook snapshot hash');
      const pages = (text.match(/\f/g) || []).length;
      console.log(`      pdf: ${pages} pages, ${(fs.statSync(pdfPath).size / 1024).toFixed(0)} KB → ${pdfPath}`);
    }
  }

  // ── screenshots ───────────────────────────────────────────────────────────
  if (want('shots')) {
    for (const theme of ['jade', 'coral', 'arcade']) {
      for (const width of [1440, 390]) {
        const sp = await open({ theme, width, tag: `${theme}-${width}` });
        // let every scene reach its end frame before the full-page capture
        await sp.evaluate(() => { if (window.__dlp2) window.__dlp2.ids().forEach((id) => window.__dlp2.seek(id, 1)); });
        await sleep(400);
        const file = path.join(OUT, `page-${theme}-${width}.png`);
        await sp.screenshot({ path: file, fullPage: true });
        const overflow = await sp.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        ok(overflow <= 1, `${theme} @${width}: no horizontal page scroll`, `${overflow}px`);
        await sp.close();
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
