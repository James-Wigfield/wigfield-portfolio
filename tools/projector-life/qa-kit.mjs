/* ============================================================================
   PROJECTOR LIFE — shared QA kit for page-check.mjs, shots.mjs and soak.mjs
   ----------------------------------------------------------------------------
   puppeteer-core + the local Edge, headless on the real GPU (ANGLE d3d11),
   seeded through the portal gate. Every page gets:
     · a console / pageerror sink (errors + warnings, tagged)
     · a WebGL-context counter (getContext wrapped before any script runs;
       each webgl/webgl2 context is recorded once, with a webglcontextlost
       listener) → window.__pjlGL
     · a frame counter (rAF) that is independent of the Stage's own fps
   The UI is the source of truth for presets: applyPreset() CLICKS the
   button in the side panel's "Scenes" list.
   ========================================================================== */
import puppeteer from 'puppeteer-core';
import sharp from 'sharp';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const HERE = path.dirname(fileURLToPath(import.meta.url));
export const REPO = path.resolve(HERE, '..', '..');
export const MOD = path.join(REPO, 'src/components/portal/modules/projector-life');
export const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
export const BASE = process.env.SITE_URL || 'http://localhost:5191';
export const ROUTE = '/portal/projector-life';

export const { PRESETS } = await import(pathToFileURL(path.join(MOD, 'presets.js')).href);
export const { defaults, coerce } = await import(pathToFileURL(path.join(MOD, 'params.js')).href);

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const slug = (p) => p.id;

/** Real-GPU headless Edge. uncapped: no vsync / frame-rate limit (headroom, not what a screen shows). */
export function launch({ gc = true, uncapped = process.env.UNCAPPED === '1' } = {}) {
  const args = [
    '--use-gl=angle',
    '--use-angle=d3d11',
    '--ignore-gpu-blocklist',
    '--enable-gpu-rasterization',
    '--hide-scrollbars',
    '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding',
    '--disable-backgrounding-occluded-windows',
    '--enable-precise-memory-info',
  ];
  if (gc) args.push('--js-flags=--expose-gc');
  if (uncapped) args.push('--disable-gpu-vsync', '--disable-frame-rate-limit');
  return puppeteer.launch({ executablePath: EDGE, headless: 'new', args, protocolTimeout: 600000 });
}

// ── injected before any page script ─────────────────────────────────────────
function INJECT(theme, brokenStorage) {
  sessionStorage.setItem('portal_auth', JSON.stringify({ token: 'mock-session-token', key: 'wiggy1', issued_at: new Date().toISOString() }));
  try {
    localStorage.setItem('portal:theme', theme);
  } catch {
    /* broken-storage run */
  }
  if (brokenStorage) {
    const boom = () => {
      throw new DOMException('storage disabled', 'SecurityError');
    };
    Object.defineProperty(window, 'localStorage', { configurable: true, get: boom });
  }
  // WebGL context ledger
  const reg = { created: 0, lost: 0, list: [] };
  window.__pjlGL = reg;
  const orig = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function getContext(type, ...rest) {
    const ctx = orig.call(this, type, ...rest);
    if (ctx && /^(webgl2?|experimental-webgl)$/.test(String(type)) && !this.__pjlGLSeen) {
      this.__pjlGLSeen = true;
      const entry = { type, lost: false, ref: new WeakRef(this), t: performance.now() };
      reg.created++;
      reg.list.push(entry);
      this.addEventListener('webglcontextlost', () => {
        if (!entry.lost) {
          entry.lost = true;
          reg.lost++;
        }
      });
    }
    return ctx;
  };
  window.__pjlGLReport = () => ({
    created: reg.created,
    lost: reg.lost,
    // a canvas collected before its (async) webglcontextlost event fired took its context with it
    collected: reg.list.filter((e) => !e.lost && !e.ref.deref()).length,
    live: reg.list.filter((e) => !e.lost && e.ref.deref()).length,
    // lost contexts whose canvas is still reachable (meaningful right after a forced GC):
    // a retained canvas means its renderer / Stage is still referenced somewhere
    retained: reg.list.filter((e) => e.lost && e.ref.deref()).length,
    liveList: reg.list
      .filter((e) => !e.lost && e.ref.deref())
      .map((e) => {
        const c = e.ref.deref();
        return { type: e.type, cls: c ? c.className : '(collected)', connected: c ? c.isConnected : false };
      }),
  });
  // independent frame counter
  const fc = { n: 0, times: [] };
  window.__pjlFrames = fc;
  const tick = (t) => {
    fc.n++;
    fc.last = t;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

/**
 * Open the page. Returns { page, log } — log collects console errors/warnings.
 * opts: theme, width, height, reduced, brokenStorage, tag, sink (shared array), route, wait
 */
export async function openPage(browser, { theme = 'arcade', width = 1440, height = 900, dpr = 1, reduced = false, brokenStorage = false, tag = '', sink = null, route = ROUTE, wait = true } = {}) {
  const page = await browser.newPage();
  const log = sink || [];
  const label = tag || `${theme}-${width}`;
  page.on('console', (m) => {
    const t = m.type();
    if (t === 'error' || t === 'warn' || t === 'assert') {
      const loc = m.location();
      log.push({ tag: label, type: t, text: m.text(), url: loc?.url || '' });
    }
  });
  page.on('pageerror', (e) => log.push({ tag: label, type: 'pageerror', text: String(e?.stack || e), url: '' }));
  page.on('requestfailed', (r) => {
    const f = r.failure()?.errorText || '';
    if (!/ERR_ABORTED/.test(f)) log.push({ tag: label, type: 'requestfailed', text: `${r.url()} ${f}`, url: r.url() });
  });
  await page.setViewport({ width, height, deviceScaleFactor: dpr });
  if (reduced) await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await page.evaluateOnNewDocument(INJECT, theme, brokenStorage);
  const t0 = Date.now();
  await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded' });
  if (wait) await waitLive(page);
  return { page, log, openMs: Date.now() - t0 };
}

/** Stage ready, life ticking, something alive. Resolves to the in-page time (ms since navigation start). */
export async function waitLive(page, timeout = 30000) {
  await page.waitForFunction(
    () => {
      const s = window.__pjlStage;
      if (!s || !s.room || !s.life) return false;
      const st = s.life.stats();
      const pop = st.populations.floor + st.populations.wall + st.populations.ceiling;
      const par = (st.particles?.floor || 0) + (st.particles?.wall || 0) + (st.particles?.ceiling || 0);
      return st.tick > 0 && pop + par > 0;
    },
    { timeout, polling: 50 },
  );
  return page.evaluate(() => performance.now());
}

/** Fraction of non-black pixels in the stage canvas, measured on a real screenshot (composited). */
export async function canvasLight(page, sel = 'canvas.pjl-canvas') {
  // the visible part of the canvas, in DOCUMENT coordinates (what screenshot's clip expects
  // with captureBeyondViewport: false); boundingBox() would be viewport-relative
  const r = await page.evaluate((s) => {
    const el = document.querySelector(s);
    if (!el) return null;
    const b = el.getBoundingClientRect();
    const top = Math.max(0, b.top);
    const left = Math.max(0, b.left);
    const bottom = Math.min(innerHeight, b.bottom);
    const right = Math.min(innerWidth, b.right);
    return { x: left + scrollX, y: top + scrollY, width: right - left, height: bottom - top, visible: (bottom - top) / Math.max(1, b.height) };
  }, sel);
  if (!r || r.width < 2 || r.height < 2) return { frac: 0, mean: 0, w: 0, h: 0, visible: r ? r.visible : 0 };
  const buf = await page.screenshot({ type: 'png', clip: { x: r.x, y: r.y, width: r.width, height: r.height }, captureBeyondViewport: false });
  return { ...(await pixelStats(buf)), visible: r.visible };
}

export async function pixelStats(buf) {
  const { data, info } = await sharp(buf).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  let lit = 0;
  let sum = 0;
  const n = info.width * info.height;
  for (let i = 0; i < data.length; i += 3) {
    const m = Math.max(data[i], data[i + 1], data[i + 2]);
    if (m > 24) lit++;
    sum += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
  }
  return { frac: lit / n, mean: sum / n, w: info.width, h: info.height };
}

/** Make sure the "Scenes" group is open, then CLICK the preset's button. */
export async function applyPreset(page, preset) {
  const res = await page.evaluate((name) => {
    let btns = [...document.querySelectorAll('.pjl-scenes__btn')];
    if (!btns.length) {
      const head = document.querySelector('#pjl-g-scenes .pjl-group__btn');
      if (head) head.click();
      return 'opened';
    }
    const b = btns.find((x) => x.querySelector('.pjl-scenes__name')?.textContent.trim() === name);
    if (!b) return 'missing';
    b.click();
    return 'clicked';
  }, preset.name);
  if (res === 'opened') {
    await sleep(150);
    return applyPreset(page, preset);
  }
  if (res === 'missing') {
    // the drawer may be shut at phone width: open it and retry once
    const opened = await page.evaluate(() => {
      const f = document.querySelector('.pjl-panel__fold, .pjl-panel__rail');
      if (f && f.getAttribute('aria-expanded') === 'false') {
        f.click();
        return true;
      }
      return false;
    });
    if (opened) {
      await sleep(200);
      return applyPreset(page, preset);
    }
    throw new Error(`preset button not found: ${preset.name}`);
  }
  return res;
}

/** Wait for the camera tween to finish (or 2.5 s). */
export async function waitCamera(page) {
  await page.waitForFunction(() => !window.__pjlStage?.tween, { timeout: 4000, polling: 50 }).catch(() => {});
}

/** In-page rAF count over ms → fps, plus the Stage's own numbers. */
export async function measureFps(page, ms = 5000) {
  return page.evaluate(async (dur) => {
    const fc = window.__pjlFrames;
    const s = window.__pjlStage;
    const n0 = fc.n;
    const t0 = performance.now();
    const frameSamples = [];
    const simSamples = [];
    const tickSamples = [];
    const tick0 = s?.life ? s.life.stats().tick : 0;
    // sample the Stage's numbers along the way
    const iv = setInterval(() => {
      if (!s?.life) return;
      const ls = s.life.stats();
      frameSamples.push(s.frameMs);
      simSamples.push(ls.simMs);
      if (Number.isFinite(ls.tickMs)) tickSamples.push(ls.tickMs);
    }, 250);
    // frame intervals (jank): a frame that carries a 30 Hz sim tick is longer than the rest
    const gaps = [];
    let prev = performance.now();
    let on = true;
    const loop = (t) => {
      if (!on) return;
      gaps.push(t - prev);
      prev = t;
      requestAnimationFrame(loop);
    };
    requestAnimationFrame((t) => {
      prev = t;
      requestAnimationFrame(loop);
    });
    await new Promise((r) => setTimeout(r, dur));
    on = false;
    clearInterval(iv);
    gaps.sort((a, b) => a - b);
    const pct = (p) => (gaps.length ? gaps[Math.min(gaps.length - 1, Math.floor(p * gaps.length))] : NaN);
    const n1 = fc.n;
    const t1 = performance.now();
    const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
    return {
      fps: ((n1 - n0) * 1000) / (t1 - t0),
      stageFps: s?.fps ?? NaN,
      frameMs: avg(frameSamples),
      simMs: avg(simSamples),
      tickMs: avg(tickSamples),
      ticksPerSec: s?.life ? ((s.life.stats().tick - tick0) * 1000) / (t1 - t0) : NaN,
      gapP50: pct(0.5),
      gapP95: pct(0.95),
      gapP99: pct(0.99),
      gapMax: gaps.length ? gaps[gaps.length - 1] : NaN,
      over20: gaps.filter((g) => g > 20).length,
      secs: (t1 - t0) / 1000,
    };
  }, ms);
}

/** Force a GC (if exposed) and read the heap + renderer counters. */
export async function memSample(page) {
  return page.evaluate(async () => {
    if (window.gc) {
      window.gc();
      await new Promise((r) => setTimeout(r, 50));
      window.gc();
    }
    const s = window.__pjlStage;
    const info = s?.renderer?.info;
    return {
      heapMB: performance.memory ? performance.memory.usedJSHeapSize / 1048576 : NaN,
      geometries: info ? info.memory.geometries : NaN,
      textures: info ? info.memory.textures : NaN,
      programs: info?.programs ? info.programs.length : NaN,
      calls: info ? info.render.calls : NaN,
      triangles: info ? info.render.triangles : NaN,
    };
  });
}

/** Click a top tab by its label. */
export async function clickTab(page, label) {
  await page.evaluate((l) => {
    const b = [...document.querySelectorAll('.pjl-tabs__tab')].find((x) => x.textContent.includes(l));
    b?.click();
  }, label);
}

/** Click a portal sidebar item by its label. */
export async function clickNav(page, label) {
  return page.evaluate((l) => {
    const b = [...document.querySelectorAll('.portal__nav-item')].find((x) => x.querySelector('.portal__nav-label')?.textContent.trim() === l);
    if (!b) return false;
    b.click();
    return true;
  }, label);
}

/** Console entries that belong to the page (not dev tooling). Returns { kept, excluded }. */
export const NOISE = [
  { re: /Download the React DevTools/i, why: 'React dev-mode banner (dev server only, info-level advice)' },
  { re: /\[vite\]/i, why: 'Vite HMR client chatter (dev server only)' },
];
export function splitNoise(log) {
  const kept = [];
  const excluded = [];
  for (const m of log) {
    const hit = NOISE.find((n) => n.re.test(m.text));
    if (hit) excluded.push({ ...m, why: hit.why });
    else kept.push(m);
  }
  return { kept, excluded };
}

export const fmt = (v, d = 1) => (Number.isFinite(v) ? v.toFixed(d) : '—');
