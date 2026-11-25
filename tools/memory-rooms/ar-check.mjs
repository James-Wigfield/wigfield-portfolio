#!/usr/bin/env node
/* ar-check: "See it in your space" (src/memory-rooms/ar/) in headless Edge, and the USDZ files it makes.

     npm run build && npx wrangler dev --port 8788          (restart wrangler after every build)
     node tools/memory-rooms/seed-dev.mjs --examples-only
     node tools/memory-rooms/ar-check.mjs [--base http://127.0.0.1:8788] [--dark] [--python <python with usd-core 25.x>] [--swiftshader]

   Real AR can't run headless, so this checks everything around it, for every spot that has a model:
     iphone 390    iPhone Safari UA + touch: one rel="ar" Quick Look link per scale, each an <a> around one
                   <img>, #allowsContentScaling (tabletop 1, life 0); the USDZ bytes pulled out of the page
                   (its blob: urls) into memory-rooms-work/_ar-check/; cached per spot (an entry planted in
                   Cache Storage is what a reload serves); ?ar=1 opens the panel; the viewer draws the same
                   picture after the export; viewpoint 1 still flies
     android 390   Android Chrome UA + touch, navigator.xr mocked: the WebXR buttons; a session that fails to
                   start → error line, viewer untouched and still turns; a mocked session that starts →
                   the overlay over the camera (hint, scale, reset, exit: ≥ 44 px, bottom half), Exit puts the
                   viewer back exactly; no immersive-ar support → the "this phone can't" line, no QR code
     desktop 1440  a QR code (its own lazy chunk) for <origin>/memories/<id>?ar=1, read back module by module
                   from a screenshot; ?ar=1 opens the panel
     no model      the same spot served without its GLB (and without a scene), nothing written: no AR entry
     usdz          tools/memory-rooms/usdchecker.py (= usdchecker --arkit) on every file; textures inside,
                   referenced and decodable, ≤ 1024 px tabletop / 2048 px life; file size; materials = black
                   base + the bake as emission; scale against scene.json (tabletop 1:20, life 1:1, floor on 0,
                   footprint centred); tabletop has no ceiling, life size has it
     bundle        AR code (ArEntry, usdz + USDZExporter, xr, qr + qrcode-generator) only in its own chunks,
                   never imported statically; the map route (/memories?map=atlas, no Mapbox load) requests
                   none of them; usdz / xr / qr load only when needed; xr reuses viewer/dollhouse.js
     rules         tap targets ≥ 44 px at 390, no sideways scroll, every word from COPY.ar, colours from
                   tokens, no left-border callouts / filled pills, zero console errors
   Lines starting with "·" are notes (measured, not pass/fail). Screenshots → memory-rooms-work/_page-check/
   ar-*-<light|dark>.png. Exit 1 if anything fails.
   usd-core: python -m venv .usdvenv && .usdvenv/Scripts/python -m pip install usd-core==25.8 (or --python). */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import puppeteer from 'puppeteer-core';
import sharp from 'sharp';
import { unzipSync, strFromU8 } from 'fflate';
import qrcode from 'qrcode-generator';
import { client, config, REPO, WORK } from './lib/api.mjs';
import { COPY } from '../../src/memory-rooms/copy.js';
import { sceneBounds } from '../../src/memory-rooms/scene/geometry.js';

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const args = process.argv.slice(2);
const opt = (n, d) => (args.includes(n) ? args[args.indexOf(n) + 1] : d);
const base = opt('--base', 'http://127.0.0.1:8788').replace(/\/+$/, '');
const scheme = args.includes('--dark') ? 'dark' : 'light';
const other = scheme === 'dark' ? 'light' : 'dark';
const GPU = ['--use-gl=angle', '--use-angle=d3d11', '--ignore-gpu-blocklist'];
const SOFT = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
const OUT = path.join(WORK, '_page-check');
const USDZ_DIR = path.join(WORK, '_ar-check');
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(USDZ_DIR, { recursive: true });
const PY = [opt('--python', null), process.env.USD_PYTHON, path.join(REPO, '.usdvenv', 'Scripts', 'python.exe'), path.join(REPO, '.usdvenv', 'bin', 'python')].find((p) => p && fs.existsSync(p));

const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const ANDROID_UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36';
const DEVICES = {
  iphone: { width: 390, height: 844, dpr: 2, touch: true, ua: IPHONE_UA },
  android: { width: 390, height: 844, dpr: 2, touch: true, ua: ANDROID_UA },
  desktop: { width: 1440, height: 900, dpr: 1, touch: false, ua: null },
};
const TAP = 44; // px, the brief's minimum (the tokens' --mr-tap is 48)
const SCALE = { tabletop: 1 / 20, life: 1 };
const TEX_CAP = { tabletop: 1024, life: 2048 }; // ar/usdz.js
// bytes: the file is made ON the phone from the room it already loaded (nothing is downloaded), so these
// cap memory and the hand-off to Quick Look; the warehouse's tabletop is ~11.5 MB (its geometry as text)
const SIZE_CAP = { tabletop: 16e6, life: 25e6 };
const SIZE_MIN = 50e3;

const cfg = config();
cfg.base = base;
const api = client(cfg);

const results = [];
const notes = [];
const record = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? `  ${detail}` : ''}`);
};
const note = (text) => {
  notes.push(text);
  console.log(`· ${text}`);
};
const sel = (name) => `[data-mr="${name}"]`;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const mb = (n) => `${(n / 1e6).toFixed(2)} MB`;
const sha = (buf) => crypto.createHash('sha1').update(buf).digest('hex').slice(0, 12);
const slug = (s) =>
  s
    .replace(/\(.*?\)/g, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

// ── the spots ────────────────────────────────────────────────────────────────

const spots = await api.listSpots();
const roomModel = (s) => s.media.find((m) => m.type === 'model' && m.name === 'room') || s.media.find((m) => m.type === 'model' && m.name !== 'map') || null;
const stageOf = (s) => (roomModel(s) && (s.status === 'rendered' || !s.scene) ? 'model' : s.scene ? 'preview' : 'photos');
const MODELLED = spots.filter((s) => stageOf(s) === 'model');
const WITHOUT = spots.filter((s) => !roomModel(s));
if (!MODELLED.length) {
  console.error(`No spot with a model at ${base}: run \`node tools/memory-rooms/seed-dev.mjs --examples-only\` first.`);
  process.exit(1);
}
const tags = new Map(MODELLED.map((s) => [s.id, slug(s.title) || s.id.slice(0, 8)]));
console.log(`${MODELLED.length} spot(s) with a model: ${MODELLED.map((s) => `"${s.title}"`).join(', ')}; ${WITHOUT.length} without one. ${scheme}, ${base}\n`);

// ── bundle: where the AR code lives (dist/, the build wrangler serves) ──────────

const ASSETS = path.join(REPO, 'dist', 'assets');
const assetFiles = fs.existsSync(ASSETS) ? fs.readdirSync(ASSETS).filter((f) => /\.(js|css)$/.test(f)) : [];
const text = new Map(assetFiles.map((f) => [f, fs.readFileSync(path.join(ASSETS, f), 'utf8')]));
// Strings only that part of the AR code has (copy.js strings would be in every Memory Rooms chunk).
const MARKERS = {
  entry: ['allowsContentScaling', 'mr-ar__panel'], // ar/ArEntry.jsx + support.js + ar.css
  usdz: ['Three.js USDZExporter', 'mr-usdz-v1'], // ar/usdz.js + three's USDZExporter
  xr: ['ar__place', 'generic-touchscreen'], // ar/xr.js
  qr: ['code length overflow', 'getModuleCount'], // ar/qr.js + qrcode-generator
};
const arFiles = Object.fromEntries(Object.entries(MARKERS).map(([k, ms]) => [k, assetFiles.filter((f) => ms.some((m) => text.get(f).includes(m)))]));
const AR = new Set(Object.values(arFiles).flat());
const groupOf = (f) => Object.keys(arFiles).find((k) => arFiles[k].includes(f)) || null;
const staticImports = (f) => (f.endsWith('.js') ? [...text.get(f).matchAll(/(?:\bfrom|\bimport)\s*["'`]\.\/([^"'`]+\.js)["'`]/g)].map((m) => m[1]) : []);
const dynamicImports = (f) => (f.endsWith('.js') ? [...text.get(f).matchAll(/\bimport\(\s*["'`]\.\/([^"'`]+\.js)["'`]\s*\)/g)].map((m) => m[1]) : []);
const closure = (start) => {
  const seen = new Set();
  const todo = [...start].filter((f) => text.has(f));
  while (todo.length) {
    const f = todo.pop();
    if (seen.has(f)) continue;
    seen.add(f);
    for (const g of staticImports(f)) if (text.has(g) && !seen.has(g)) todo.push(g);
  }
  return seen;
};
{
  record('bundle: dist/ is built', assetFiles.length > 0, ASSETS);
  const listed = Object.entries(arFiles).map(([k, fs_]) => `${k}: ${fs_.join(' + ') || 'NOT FOUND'}`).join('; ');
  const eager = [...AR].filter((f) => /^(index|MemoryRoomsApp|SpotPage|MapPage)-/.test(f));
  const disjoint = ['usdz', 'xr', 'qr'].every((k) => arFiles[k].every((f) => !arFiles.entry.includes(f)));
  record('bundle: the AR code sits in its own chunks (entry / usdz / xr / qr apart)', Object.values(arFiles).every((l) => l.length > 0) && !eager.length && disjoint, listed + (eager.length ? `; in an eager chunk: ${eager.join(', ')}` : ''));
  const staticEdges = assetFiles.filter((f) => !AR.has(f)).flatMap((f) => staticImports(f).filter((g) => AR.has(g)).map((g) => `${f} → ${g}`));
  const dynamicFrom = (k) => assetFiles.filter((f) => dynamicImports(f).some((g) => arFiles[k].includes(g)));
  const entryFrom = dynamicFrom('entry');
  const lazyOk = ['usdz', 'xr', 'qr'].every((k) => dynamicFrom(k).every((f) => groupOf(f) === 'entry') && dynamicFrom(k).length > 0);
  const arStatic = [...AR].flatMap((f) => staticImports(f).filter((g) => AR.has(g) && groupOf(g) !== groupOf(f)).map((g) => `${f} → ${g}`));
  record(
    'bundle: nothing imports an AR chunk statically (ArEntry ← import() from SpotPage only; usdz/xr/qr ← import() from ArEntry only)',
    !staticEdges.length && !arStatic.length && entryFrom.length > 0 && entryFrom.every((f) => /^SpotPage-/.test(f)) && lazyOk,
    `ArEntry imported by ${entryFrom.join(', ') || 'nothing'}; usdz by ${dynamicFrom('usdz').join(', ')}; xr by ${dynamicFrom('xr').join(', ')}; qr by ${dynamicFrom('qr').join(', ')}${staticEdges.length || arStatic.length ? `; STATIC: ${[...staticEdges, ...arStatic].join(', ')}` : ''}`,
  );
  // xr.js reuses viewer/dollhouse.js: it imports the same chunk the viewer imports, and the source doesn't re-define it
  const xrJs = arFiles.xr.find((f) => f.endsWith('.js'));
  const dollChunk = xrJs ? staticImports(xrJs).find((g) => /^dollhouse-/.test(g)) : null;
  const viewerUsers = dollChunk ? assetFiles.filter((f) => !AR.has(f) && staticImports(f).includes(dollChunk)) : [];
  const arSrc = Object.fromEntries(fs.readdirSync(path.join(REPO, 'src/memory-rooms/ar')).map((f) => [f, fs.readFileSync(path.join(REPO, 'src/memory-rooms/ar', f), 'utf8')]));
  const copies = Object.entries(arSrc).flatMap(([f, src]) =>
    [...src.matchAll(/(?:function|const|let)\s+(applyDollhouse|stepFades|indexRoom|attachedWall|applyBakedMaterials|toBasic)\b/g)].map((m) => `${f}: ${m[1]}`),
  );
  const imports = /from '\.\.\/viewer\/dollhouse\.js'/.test(arSrc['xr.js'] || '');
  record(
    'bundle: ar/ reuses viewer/dollhouse.js (same chunk as the viewer, nothing re-defined; no copy of bakedMaterials.js)',
    Boolean(dollChunk) && viewerUsers.length > 0 && imports && !copies.length,
    `xr imports ${dollChunk || 'no dollhouse chunk'}, also imported by ${viewerUsers.join(', ') || 'nothing else'}${copies.length ? `; re-defined: ${copies.join(', ')}` : ''}`,
  );
  // colours: ar.css + ArEntry.jsx only through the .mr tokens
  const css = (arSrc['ar.css'] || '').replace(/\/\*[\s\S]*?\*\//g, '');
  const literal = /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?|oklch|lab|lch)\(|:\s*(?:white|black|red|blue|green|gray|grey)\b/;
  const cssHits = css.split('\n').filter((l) => literal.test(l));
  const jsxHits = (arSrc['ArEntry.jsx'] || '').split('\n').filter((l) => /(?:fill|stroke|color|background)\s*[:=]\s*["'{]?\s*(?:#|rgb|hsl)/.test(l));
  const tokenDefs = new Set([...fs.readFileSync(path.join(REPO, 'src/memory-rooms/memory-rooms.css'), 'utf8').matchAll(/(--mr-[a-z0-9-]+)\s*:/g)].map((m) => m[1]));
  const used = [...new Set([...css.matchAll(/var\((--mr-[a-z0-9-]+)/g)].map((m) => m[1]))];
  const undefinedTokens = used.filter((t) => !tokenDefs.has(t));
  record(
    'tokens: ar.css + ArEntry.jsx colour only through .mr tokens, every token defined in memory-rooms.css',
    !cssHits.length && !jsxHits.length && !undefinedTokens.length,
    `${used.length} tokens used${cssHits.length ? `; literals in ar.css: ${cssHits.map((l) => l.trim()).join(' | ')}` : ''}${jsxHits.length ? `; in ArEntry.jsx: ${jsxHits.map((l) => l.trim()).join(' | ')}` : ''}${undefinedTokens.length ? `; undefined: ${undefinedTokens.join(', ')}` : ''}`,
  );
  // the ONE dark token block, keyed on <html data-mr-theme="dark"> since the theme switch (DECISIONS 192)
  const darkBlock = fs.readFileSync(path.join(REPO, 'src/memory-rooms/memory-rooms.css'), 'utf8').match(/data-mr-theme='dark'\]\) \.mr,[\s\S]*?\n\}/)?.[0] || '';
  const qrDark = ['--mr-qr-ink', '--mr-qr-paper'].filter((t) => darkBlock.includes(`${t}:`));
  record('tokens: the QR code tokens have dark values too', qrDark.length === 2, qrDark.join(', ') || 'none in the dark block');
  const reticle = (arSrc['xr.js'] || '').split('\n').findIndex((l) => /color:\s*0x[0-9a-f]{6}/i.test(l));
  if (reticle >= 0) note(`xr.js:${reticle + 1} the AR reticle's colour is a literal (${(arSrc['xr.js'].split('\n')[reticle].match(/0x[0-9a-f]{6}/i) || [])[0]}) in a three.js material, not a token (--mr-ar-ink exists for "over the camera feed")`);
}

// ── browser ──────────────────────────────────────────────────────────────────

/* navigator.xr for the Android runs (serialised into the page, so self-contained).
   mode 'fail': immersive-ar supported, requestSession rejects (no ARCore / the user said no).
   mode 'ok': a session that starts and never sends a frame (no camera here), enough for three's
              WebXRManager (XRWebGLLayer + makeXRCompatible stubbed); end() fires 'end'.
   mode 'unsupported': isSessionSupported('immersive-ar') → false.
   window.__xrLog counts requests, ends and window.requestAnimationFrame calls. */
function XR_MOCK(mode) {
  const log = (window.__xrLog = { supported: [], requests: [], ended: 0, winRafs: 0, xrRafs: 0 });
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (cb) => {
    log.winRafs++;
    return raf(cb);
  };
  class FakeSession extends EventTarget {
    constructor() {
      super();
      this.renderState = {};
      this.inputSources = [];
      this.enabledFeatures = ['hit-test', 'dom-overlay'];
      this.domOverlayState = { type: 'screen' };
      this.environmentBlendMode = 'alpha-blend';
      this.visibilityState = 'visible';
      this.ended = false;
    }
    updateRenderState(s) {
      Object.assign(this.renderState, s);
    }
    async requestReferenceSpace(type) {
      return { type, getOffsetReferenceSpace() {
        return this;
      } };
    }
    async requestHitTestSource() {
      return { cancel() {} };
    }
    async requestHitTestSourceForTransientInput() {
      return { cancel() {} };
    }
    requestAnimationFrame() {
      log.xrRafs++;
      return log.xrRafs;
    }
    cancelAnimationFrame() {}
    async end() {
      if (this.ended) return;
      this.ended = true;
      log.ended++;
      await Promise.resolve();
      this.dispatchEvent(new Event('end'));
    }
  }
  const xr = {
    async isSessionSupported(m) {
      log.supported.push(m);
      return mode !== 'unsupported' && m === 'immersive-ar';
    },
    async requestSession(m, init = {}) {
      log.requests.push({ mode: m, required: init.requiredFeatures || [], optional: init.optionalFeatures || [], overlay: init.domOverlay?.root?.dataset?.mr || null });
      if (mode !== 'ok') throw new DOMException('The specified session configuration is not supported.', 'NotSupportedError');
      window.__xrSession = new FakeSession();
      return window.__xrSession;
    },
    addEventListener() {},
    removeEventListener() {},
  };
  Object.defineProperty(Navigator.prototype, 'xr', { get: () => xr, configurable: true });
  if (mode === 'ok') {
    window.XRWebGLLayer = class {
      constructor(session, gl) {
        this.framebuffer = null;
        this.framebufferWidth = gl.drawingBufferWidth;
        this.framebufferHeight = gl.drawingBufferHeight;
        this.ignoreDepthValues = true;
      }
      getViewport() {
        return { x: 0, y: 0, width: this.framebufferWidth, height: this.framebufferHeight };
      }
    };
    try {
      delete window.XRWebGLBinding; // three then uses an XRWebGLLayer (the stub above)
    } catch {
      /* ignore */
    }
    window.XRWebGLBinding = undefined;
    for (const C of [window.WebGLRenderingContext, window.WebGL2RenderingContext]) if (C) C.prototype.makeXRCompatible = () => Promise.resolve();
  }
}

const browser = await puppeteer.launch({ executablePath: EDGE, headless: true, args: args.includes('--swiftshader') ? SOFT : GPU });

/** A page on `device` in a fresh browser context (fresh storage, caches and service worker). */
async function open(device, { xr = null } = {}) {
  const d = DEVICES[device];
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  await page.emulate({ viewport: { width: d.width, height: d.height, deviceScaleFactor: d.dpr, isMobile: d.touch, hasTouch: d.touch }, userAgent: d.ua || (await browser.userAgent()) });
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: scheme }]);
  page.device = device;
  page.ctx = context;
  page.problems = [];
  page.assets = [];
  page.on('request', (r) => {
    const u = new URL(r.url());
    if (u.pathname.startsWith('/assets/')) page.assets.push(path.basename(u.pathname));
  });
  page.on('pageerror', (e) => page.problems.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') page.problems.push(`console.error: ${m.text()}`);
  });
  await page.evaluateOnNewDocument((token) => {
    try {
      localStorage.setItem('mr:token', token);
      localStorage.setItem('mr:who', 'james');
    } catch {
      /* ignore */
    }
    // WebGL draw calls, so a "same picture" comparison can prove the viewer really drew again
    window.__glDraws = 0;
    window.__glClears = 0;
    for (const C of [window.WebGLRenderingContext, window.WebGL2RenderingContext]) {
      const clear = C?.prototype.clear;
      if (clear) {
        C.prototype.clear = function (...a) {
          window.__glClears++;
          return clear.apply(this, a);
        };
      }
      for (const fn of ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced', 'drawRangeElements']) {
        const orig = C?.prototype[fn];
        if (!orig) continue;
        C.prototype[fn] = function (...a) {
          window.__glDraws++;
          return orig.apply(this, a);
        };
      }
    }
  }, cfg.token);
  if (xr) await page.evaluateOnNewDocument(XR_MOCK, xr);
  return page;
}
async function close(page) {
  await page.close().catch(() => {});
  await page.ctx.close().catch(() => {});
}
const shot = (page, name) => page.screenshot({ path: path.join(OUT, `${name}-${scheme}.png`) });
function noErrors(page, label) {
  record(`${label}: no console/page errors`, page.problems.length === 0, page.problems.slice(0, 3).join(' | '));
  page.problems.length = 0;
}
/** Which AR groups this page has requested so far. */
const loaded = (page) => Object.fromEntries(Object.keys(arFiles).map((k) => [k, page.assets.some((f) => arFiles[k].includes(f))]));
const loadedStr = (l) => Object.entries(l).map(([k, v]) => `${k} ${v ? 'yes' : 'no'}`).join(', ');

async function gotoSpot(page, spot, query = '') {
  await page.goto(`${base}/memories/${spot.id}${query}`, { waitUntil: 'networkidle2', timeout: 90000 });
  const ready = await page.waitForSelector(`${sel('viewer')}[data-state="ready"]`, { timeout: 90000 }).then(() => true).catch(() => false);
  // phones: the spot panel is a bottom sheet that peeks (title + Walk in); open it to reach "See it in your space"
  const handle = await page.$(`${sel('sheet-handle')}[aria-expanded="false"]`);
  if (handle) {
    await handle.tap();
    await wait(450);
  }
  return ready;
}
const entryKind = (page) => page.waitForSelector(sel('ar'), { timeout: 15000 }).then((el) => el.evaluate((e) => e.dataset.arKind)).catch(() => null);
async function press(page, target) {
  let el = typeof target === 'string' ? await page.$(target) : target;
  if (!el) return false;
  // phones: a button in the spot panel needs its bottom sheet open (a drag folds it)
  const inFoldedSheet = await el.evaluate((e) => Boolean(e.closest('[data-mr="spot-panel"]')) && Boolean(document.querySelector('[data-mr="sheet-handle"][aria-expanded="false"]')));
  if (inFoldedSheet) {
    await (await page.$(`${sel('sheet-handle')}[aria-expanded="false"]`)).tap();
    await wait(450);
    if (typeof target === 'string') el = await page.$(target);
  }
  if (DEVICES[page.device].touch) await el.tap();
  else await el.click();
  return true;
}

/** The viewer's picture (greyscale, 240 px wide), from the top of the page. */
async function grabViewer(page) {
  await foldSheet(page); // the same picture every time: never half under the phone's open sheet
  await page.evaluate(() => window.scrollTo(0, 0));
  await wait(150);
  const el = await page.$(sel('viewer'));
  const buf = await el.screenshot();
  const { data, info } = await sharp(buf).greyscale().resize(240).raw().toBuffer({ resolveWithObject: true });
  return { data, w: info.width, h: info.height };
}
const meanDiff = (a, b) => {
  if (!a || !b || a.data.length !== b.data.length) return Infinity;
  let s = 0;
  for (let i = 0; i < a.data.length; i++) s += Math.abs(a.data[i] - b.data[i]);
  return s / a.data.length;
};
/** One drag across the viewer (a finger on a phone): the room should turn. */
/** Phones: fold the spot panel's bottom sheet back down, so a drag lands on the room, not the sheet. */
async function foldSheet(page) {
  const open = await page.$(`${sel('sheet-handle')}[aria-expanded="true"]`);
  if (!open) return;
  await open.tap();
  await wait(400);
}

async function dragViewer(page) {
  await foldSheet(page);
  await page.evaluate(() => window.scrollTo(0, 0));
  const box = await (await page.$(sel('viewer'))).boundingBox();
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  if (DEVICES[page.device].touch) {
    await page.touchscreen.touchStart(cx, cy);
    for (let k = 1; k <= 12; k++) await page.touchscreen.touchMove(cx - k * 10, cy);
    await page.touchscreen.touchEnd();
  } else {
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    for (let k = 1; k <= 12; k++) await page.mouse.move(cx - k * 10, cy);
    await page.mouse.up();
  }
  await wait(1500);
}
async function viewerTurns(page) {
  const a = await grabViewer(page);
  await dragViewer(page);
  const b = await grabViewer(page);
  return meanDiff(a, b);
}
/** A theme flip and back: the viewer redraws (readTheme + render) with what it has now. → draw calls made. */
async function forceRedraw(page) {
  const d0 = await page.evaluate(() => window.__glDraws);
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: other }]);
  await wait(400);
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: scheme }]);
  await wait(800);
  return (await page.evaluate(() => window.__glDraws)) - d0;
}

/** Every visible a/button inside the scopes: { what, w, h }. */
const targets = (page, scopes) =>
  page.evaluate((scopes) => {
    const out = [];
    for (const root of scopes.flatMap((s) => [...document.querySelectorAll(s)])) {
      for (const el of root.querySelectorAll('a, button, [role="button"], input, select')) {
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        if (!r.width || !r.height || cs.visibility === 'hidden' || cs.display === 'none') continue;
        out.push({ what: el.dataset.mr ? `${el.dataset.mr}${el.dataset.scale ? `/${el.dataset.scale}` : ''}` : (el.className || el.tagName).split(' ').pop(), w: Math.round(r.width * 10) / 10, h: Math.round(r.height * 10) / 10 });
      }
    }
    return out;
  }, scopes);
async function tapRule(page, label, scopes) {
  const t = await targets(page, scopes);
  const small = t.filter((x) => x.w < TAP || x.h < TAP);
  record(`${label}: every tap target ≥ ${TAP} × ${TAP} px`, t.length > 0 && !small.length, t.map((x) => `${x.what} ${x.w}×${x.h}`).join(', '));
}
/** Words on screen (text nodes, aria-labels, alts) inside the scopes. */
const wordsIn = (page, scopes) =>
  page.evaluate((scopes) => {
    const out = [];
    for (const root of scopes.flatMap((s) => [...document.querySelectorAll(s)])) {
      const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      for (let n = walk.nextNode(); n; n = walk.nextNode()) {
        const t = n.textContent.trim();
        if (t && n.parentElement && getComputedStyle(n.parentElement).display !== 'none') out.push(t);
      }
      for (const el of [root, ...root.querySelectorAll('[aria-label], img[alt]')]) {
        if (el.getAttribute('aria-label')) out.push(el.getAttribute('aria-label'));
        if (el.tagName === 'IMG' && el.getAttribute('alt')) out.push(el.getAttribute('alt'));
      }
    }
    return out;
  }, scopes);
function allowedWords(spot) {
  const c = COPY.ar;
  const set = new Set(Object.values(c).filter((v) => typeof v === 'string'));
  for (const s of ['tabletop', 'life']) set.add(c.quickLookLabel(s, spot.title));
  set.add(c.qrLabel(spot.title));
  for (const m of ['tabletop', 'life']) set.add(c.reset(m));
  return (w) => set.has(w) || w === c.scale(1) || /^1:\d+$/.test(w);
}
async function copyRule(page, label, spot, scopes) {
  const ok = allowedWords(spot);
  const words = await wordsIn(page, scopes);
  const stray = words.filter((w) => !ok(w));
  record(`${label}: every word comes from COPY.ar`, words.length > 0 && !stray.length, stray.length ? `not in copy.js: ${stray.map((w) => `"${w}"`).join(', ')}` : `${words.length} strings`);
}
/** Design rule: no left-border callout boxes, no filled pills. */
async function designRule(page, label, scopes) {
  const bad = await page.evaluate((scopes) => {
    const parse = (c) => (c.match(/rgba?\(([^)]+)\)/)?.[1] || '').split(/[\s,/]+/).filter(Boolean).map(Number);
    const opaque = (c) => {
      const p = parse(c);
      return p.length >= 3 && (p[3] ?? 1) > 0.05;
    };
    const chroma = (c) => {
      const [r, g, b] = parse(c);
      return (Math.max(r, g, b) - Math.min(r, g, b)) / 255;
    };
    const out = [];
    for (const root of scopes.flatMap((s) => [...document.querySelectorAll(s)])) {
      for (const el of [root, ...root.querySelectorAll('*')]) {
        const cs = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height || cs.display === 'none' || cs.visibility === 'hidden') continue;
        const w = (side) => parseFloat(cs[`border${side}Width`]) || 0;
        const name = `${el.tagName.toLowerCase()}.${String(el.className.baseVal ?? el.className).split(' ').join('.')}`;
        if (w('Left') >= 2 && w('Left') > w('Top') && w('Left') > w('Right') && opaque(cs.borderLeftColor) && chroma(cs.borderLeftColor) > 0.15) out.push(`left-border callout ${name}`);
        const rad = parseFloat(cs.borderTopLeftRadius) || 0;
        if (rad >= r.height / 2 - 1 && r.width > r.height * 1.3 && opaque(cs.backgroundColor)) out.push(`filled pill ${name} (${cs.backgroundColor})`);
      }
    }
    return out;
  }, scopes);
  record(`${label}: no left-border callouts or filled pills`, !bad.length, bad.join(', '));
}
const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

// ── the map route: requests none of the AR files (atlas: no Mapbox load) ───────
for (const device of ['iphone', 'desktop']) {
  const label = `map route ${DEVICES[device].width}`;
  const page = await open(device);
  await page.goto(`${base}/memories?map=atlas`, { waitUntil: 'networkidle2', timeout: 90000 });
  const drawn = await page.waitForSelector(`${sel('map')} .mr-atlas-borders`, { timeout: 30000 }).then(() => true).catch(() => false);
  await wait(1500);
  const reqs = [...new Set(page.assets)];
  const js = reqs.filter((f) => f.endsWith('.js'));
  const graph = closure(js);
  const hit = reqs.filter((f) => AR.has(f));
  const inGraph = [...graph].filter((f) => AR.has(f));
  const mapLoads = await page.evaluate(() => window.__mrMapLoads || 0);
  record(
    `${label}: /memories?map=atlas requests none of the AR files, and none is in its static import graph`,
    drawn && reqs.length > 0 && !hit.length && !inGraph.length,
    `${drawn ? 'atlas drawn' : 'ATLAS NOT DRAWN'}, ${reqs.length} asset files requested (${js.length} JS, static graph ${graph.size}), AR among them: ${[...hit, ...inGraph].join(', ') || 'none'}; window.__mrMapLoads = ${mapLoads}`,
  );
  noErrors(page, label);
  await close(page);
}

// ── per spot ───────────────────────────────────────────────────────────────

const usdzFiles = []; // { spot, scale, file, bytes, sha }
const blobBytes = (page, href) =>
  page.evaluate(async (href) => {
    const res = await fetch(href.split('#')[0]);
    const buf = new Uint8Array(await res.arrayBuffer());
    let s = '';
    for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
    return btoa(s);
  }, href).then((b64) => Buffer.from(b64, 'base64'));
const quickLookLinks = (page) =>
  page.$$eval(sel('ar-quicklook'), (as) =>
    as.map((a) => ({
      scale: a.dataset.scale,
      rel: a.getAttribute('rel'),
      href: a.getAttribute('href') || '',
      download: a.getAttribute('download') || '',
      kids: [...a.children].map((c) => c.tagName),
      img: a.querySelector('img') ? { src: Boolean(a.querySelector('img').getAttribute('src')), w: a.querySelector('img').naturalWidth } : null,
      label: a.getAttribute('aria-label'),
    })),
  );
const linksReady = (page, ms = 180000) =>
  page
    .waitForFunction(
      () => {
        if (document.querySelector('[data-mr="ar-error"]')) return 'error';
        const as = [...document.querySelectorAll('[data-mr="ar-quicklook"]')];
        return as.length === 2 && as.every((a) => (a.getAttribute('href') || '').startsWith('blob:')) ? 'ok' : false;
      },
      { timeout: ms, polling: 250 },
    )
    .then((h) => h.jsonValue())
    .catch(() => 'timeout');

async function iphone(spot) {
  const tag = tags.get(spot.id);
  const label = `iphone 390 · ${spot.title}`;
  const page = await open('iphone');
  const ready = await gotoSpot(page, spot);
  const mode = await page.$eval(sel('viewer'), (el) => el.dataset.mode).catch(() => null);
  record(`${label}: the viewer loads the GLB`, ready && mode === 'model', `mode ${mode}`);
  if (!ready) return close(page);
  const kind = await entryKind(page);
  record(`${label}: the AR entry shows, as Quick Look (iPhone Safari UA)`, kind === 'quicklook', `data-ar-kind ${kind}`);
  if (kind !== 'quicklook') {
    noErrors(page, label);
    return close(page);
  }
  await wait(2500); // the reveal tween + wall fades settle
  const before = await grabViewer(page);
  const l0 = loaded(page);
  record(`${label}: before the panel opens only the AR entry chunk has loaded`, l0.entry && !l0.usdz && !l0.xr && !l0.qr, loadedStr(l0));
  const pos = await page.$eval(sel('ar-open'), (el) => Math.round(el.getBoundingClientRect().top + window.scrollY));
  note(`${label}: "${COPY.ar.open}" starts ${pos} px down the page (screen 844 px; the viewer is above it)`);

  const t0 = Date.now();
  await press(page, sel('ar-open'));
  const panel = await page.waitForSelector(sel('ar-panel'), { visible: true, timeout: 5000 }).then(() => true).catch(() => false);
  const expanded = await page.$eval(sel('ar-open'), (el) => el.getAttribute('aria-expanded'));
  const links0 = await quickLookLinks(page);
  record(
    `${label}: the panel opens with two rel="ar" links (tabletop, life), each an <a> around exactly one <img>`,
    panel && expanded === 'true' && links0.length === 2 && links0.map((l) => l.scale).join() === 'tabletop,life' && links0.every((l) => l.rel === 'ar' && l.kids.length === 1 && l.kids[0] === 'IMG'),
    links0.map((l) => `${l.scale}: rel=${l.rel} <${l.kids.join(',')}>`).join('; '),
  );
  const preparing = Boolean(await page.$(sel('ar-preparing')));
  const done = await linksReady(page);
  const secs = (Date.now() - t0) / 1000;
  const links = await quickLookLinks(page);
  const stillPreparing = Boolean(await page.$(sel('ar-preparing')));
  record(`${label}: both USDZ files are made in the browser (busy line while it works, gone after)`, done === 'ok' && preparing && !stillPreparing, `${done} in ${secs.toFixed(1)} s, "preparing" line shown ${preparing ? 'yes' : 'no'} → ${stillPreparing ? 'still there' : 'gone'}`);
  const want = { tabletop: '#allowsContentScaling=1', life: '#allowsContentScaling=0' };
  record(
    `${label}: links are blob: urls with #allowsContentScaling (tabletop 1, life 0), a <id>-<scale>.usdz download name, a loaded <img>`,
    done === 'ok' && links.every((l) => l.href.startsWith('blob:') && l.href.endsWith(want[l.scale]) && l.download === `${spot.id}-${l.scale}.usdz` && l.img?.src && l.img.w > 0),
    links.map((l) => `${l.scale}: …${l.href.slice(-24)} download=${l.download} img ${l.img?.w ?? 'none'}px`).join('; '),
  );
  const shas = {};
  if (done === 'ok') {
    for (const l of links) {
      const buf = await blobBytes(page, l.href);
      const file = path.join(USDZ_DIR, `${tag}-${l.scale}-${scheme}.usdz`);
      fs.writeFileSync(file, buf);
      shas[l.scale] = sha(buf);
      usdzFiles.push({ spot, scale: l.scale, file, bytes: buf.length, sha: shas[l.scale] });
    }
    note(`${label}: USDZ ${links.map((l) => `${l.scale} ${mb(usdzFiles.find((u) => u.spot === spot && u.scale === l.scale).bytes)}`).join(', ')}, both ready ${secs.toFixed(1)} s after the tap (desktop CPU/GPU; a phone will be slower)`);
  }
  const l1 = loaded(page);
  record(`${label}: opening loads the usdz chunk only (no xr, no qr)`, l1.usdz && !l1.xr && !l1.qr, loadedStr(l1));
  const keys = await page.evaluate(async () => {
    try {
      return (await (await caches.open('mr-usdz-v1')).keys()).map((r) => r.url);
    } catch (e) {
      return [`error ${e.message}`];
    }
  });
  record(`${label}: cached per spot (Cache Storage "mr-usdz-v1" holds tabletop + life for this spot)`, ['tabletop', 'life'].every((s) => keys.some((k) => k.includes(`/usdz/${spot.id}/${s}?`))), keys.map((k) => k.replace(/\?.*/, '')).join(', '));
  // close + reopen: the same files (memo), nothing made twice
  await press(page, sel('ar-open'));
  await press(page, sel('ar-open'));
  const again = await linksReady(page, 15000);
  const links2 = await quickLookLinks(page);
  record(`${label}: closing and reopening the panel reuses the same files`, again === 'ok' && links2.every((l, i) => l.href === links[i]?.href), `${again}`);

  await page.$eval(sel('ar'), (el) => el.scrollIntoView({ block: 'center' }));
  await wait(300);
  await shot(page, `ar-390-${tag}`);
  await tapRule(page, label, [sel('ar')]);
  record(`${label}: no sideways scroll`, (await overflow(page)) <= 1, `${await overflow(page)} px`);
  await copyRule(page, label, spot, [sel('ar')]);
  await designRule(page, label, [sel('ar')]);

  // the viewer draws the same room after the export (the clone shares geometry + textures)
  const draws = await forceRedraw(page);
  const after = await grabViewer(page);
  const d = meanDiff(before, after);
  record(`${label}: the viewer draws the same picture after the USDZ export`, draws > 0 && d < 1.5, `mean change ${d.toFixed(2)} grey levels, redrawn with ${draws} draw calls (a theme flip and back)`);
  const turn = await viewerTurns(page);
  record(`${label}: the viewer still turns under a finger`, turn > 2, `mean change ${turn.toFixed(1)} grey levels`);

  // Cache proof: plant an entry for tabletop, reload with ?ar=1: the page must serve the planted bytes.
  const PLANT = 'ar-check: planted cache entry';
  const planted = await page.evaluate(
    async (id, plant) => {
      const c = await caches.open('mr-usdz-v1');
      const k = (await c.keys()).find((r) => r.url.includes(`/usdz/${id}/tabletop?`));
      if (!k) return null;
      await c.put(k, new Response(new Blob([plant]), { headers: { 'content-type': 'model/vnd.usdz+zip' } }));
      return k.url;
    },
    spot.id,
    PLANT,
  );
  noErrors(page, label);
  page.assets.length = 0;
  const ready2 = await gotoSpot(page, spot, '?ar=1');
  const open2 = await page.waitForSelector(sel('ar-panel'), { visible: true, timeout: 15000 }).then(() => true).catch(() => false);
  const exp2 = await page.$eval(sel('ar-open'), (el) => el.getAttribute('aria-expanded')).catch(() => null);
  record(`${label}: ?ar=1 opens the panel straight away`, ready2 && open2 && exp2 === 'true', `aria-expanded ${exp2}`);
  const done2 = await linksReady(page);
  if (planted && done2 === 'ok') {
    const l3 = await quickLookLinks(page);
    const tb = await blobBytes(page, l3.find((l) => l.scale === 'tabletop').href);
    const lf = await blobBytes(page, l3.find((l) => l.scale === 'life').href);
    record(`${label}: after a reload the files come from Cache Storage (planted tabletop entry served; life identical)`, tb.toString() === PLANT && sha(lf) === shas.life, `tabletop ${tb.length} B ${tb.toString() === PLANT ? '= planted' : '≠ planted'}, life ${sha(lf)} ${sha(lf) === shas.life ? '=' : '≠'} ${shas.life}`);
  } else {
    record(`${label}: after a reload the files come from Cache Storage`, false, `planted ${Boolean(planted)}, links ${done2}`);
  }
  await page.evaluate(() => caches.delete('mr-usdz-v1'));
  noErrors(page, `${label} (?ar=1)`);
  await close(page);
}

async function androidFail(spot) {
  const tag = tags.get(spot.id);
  const label = `android 390 · ${spot.title}`;
  const page = await open('android', { xr: 'fail' });
  const ready = await gotoSpot(page, spot);
  if (!ready) {
    record(`${label}: the viewer loads the GLB`, false);
    return close(page);
  }
  const kind = await entryKind(page);
  record(`${label}: with navigator.xr mocked as supporting immersive-ar the entry is WebXR`, kind === 'webxr', `data-ar-kind ${kind}`);
  if (kind !== 'webxr') {
    noErrors(page, label);
    return close(page);
  }
  await press(page, sel('ar-open'));
  await page.waitForSelector(sel('ar-panel'), { visible: true, timeout: 5000 }).catch(() => {});
  const enabled = await page
    .waitForFunction(() => {
      const b = [...document.querySelectorAll('[data-mr="ar-start"]')];
      return b.length === 2 && b.every((x) => !x.disabled);
    }, { timeout: 30000 })
    .then(() => true)
    .catch(() => false);
  const scales = await page.$$eval(sel('ar-start'), (bs) => bs.map((b) => b.dataset.scale).join());
  record(`${label}: the WebXR buttons show (tabletop, life), enabled once the room has loaded`, enabled && scales === 'tabletop,life', scales);
  const l0 = loaded(page);
  // xr.js is fetched with the WebXR panel on purpose: requestSession must run inside the tap's user
  // activation, which a slow chunk download after the tap could outlast (DECISIONS 79)
  record(`${label}: with the panel open, the entry and xr chunks have loaded, never usdz or the QR code`, l0.entry && l0.xr && !l0.usdz && !l0.qr, loadedStr(l0));
  await page.$eval(sel('ar'), (el) => el.scrollIntoView({ block: 'center' }));
  await wait(300);
  await shot(page, `ar-xr-390-${tag}`);
  await tapRule(page, label, [sel('ar')]);
  await copyRule(page, label, spot, [sel('ar')]);
  await designRule(page, label, [sel('ar')]);
  record(`${label}: no sideways scroll`, (await overflow(page)) <= 1, `${await overflow(page)} px`);

  await wait(1500);
  const before = await grabViewer(page);
  await press(page, `${sel('ar-start')}[data-scale="tabletop"]`);
  const err = await page.waitForSelector(sel('ar-error'), { visible: true, timeout: 15000 }).then(() => true).catch(() => false);
  const errText = err ? await page.$eval(sel('ar-error'), (el) => el.textContent.trim()) : '';
  const state = await page.evaluate(() => {
    const v = document.querySelector('[data-mr="viewer"]');
    const o = document.querySelector('[data-mr="ar-overlay"]');
    return { state: v?.dataset.state, mode: v?.dataset.mode, xr: v?.dataset.xr || null, overlay: o ? getComputedStyle(o).display : 'missing', enabled: [...document.querySelectorAll('[data-mr="ar-start"]')].every((b) => !b.disabled), log: window.__xrLog };
  });
  const req = state.log.requests[0];
  record(
    `${label}: a session that fails to start shows the error line, overlay hidden, buttons back`,
    err && errText === COPY.ar.startFailed && state.overlay === 'none' && state.enabled && !state.xr,
    `"${errText}", overlay ${state.overlay}, buttons ${state.enabled ? 'enabled' : 'disabled'}, data-xr ${state.xr}`,
  );
  record(
    `${label}: requestSession('immersive-ar') asks for hit-test (required) and the dom-overlay on the AR overlay`,
    req?.mode === 'immersive-ar' && req.required.includes('hit-test') && req.optional.includes('dom-overlay') && req.overlay === 'ar-overlay',
    req ? `${req.mode}, required [${req.required}], optional [${req.optional}], overlay ${req.overlay}` : 'never called',
  );
  const draws = await forceRedraw(page);
  const after = await grabViewer(page);
  const d = meanDiff(before, after);
  const turn = await viewerTurns(page);
  record(`${label}: after the failed start the viewer is untouched and still turns`, state.state === 'ready' && state.mode === 'model' && draws > 0 && d < 1.5 && turn > 2, `state ${state.state}, picture change ${d.toFixed(2)} (redrawn, ${draws} draw calls), drag change ${turn.toFixed(1)} grey levels`);
  const l1 = loaded(page);
  record(`${label}: a start loads the xr chunk (still no usdz / qr)`, l1.xr && !l1.usdz && !l1.qr, loadedStr(l1));
  await page.$eval(sel('ar'), (el) => el.scrollIntoView({ block: 'center' }));
  await wait(300);
  await shot(page, `ar-xr-error-390-${tag}`);
  noErrors(page, label);
  await close(page);
}

async function androidSession(spot) {
  const tag = tags.get(spot.id);
  const label = `android 390 · ${spot.title} (mocked session)`;
  const page = await open('android', { xr: 'ok' });
  const ready = await gotoSpot(page, spot, '?ar=1');
  if (!ready) {
    record(`${label}: the viewer loads the GLB`, false);
    return close(page);
  }
  const open2 = await page.waitForSelector(sel('ar-panel'), { visible: true, timeout: 15000 }).then(() => true).catch(() => false);
  record(`${label}: ?ar=1 opens the panel straight away`, open2 && (await page.$eval(sel('ar-open'), (el) => el.getAttribute('aria-expanded')).catch(() => null)) === 'true');
  await page.waitForFunction(() => [...document.querySelectorAll('[data-mr="ar-start"]')].some((b) => !b.disabled), { timeout: 30000 }).catch(() => {});
  await wait(2500);
  const before = await grabViewer(page);
  const idle0 = await page.evaluate(() => window.__xrLog.winRafs);
  await wait(1000);
  const idleRafs = (await page.evaluate(() => window.__xrLog.winRafs)) - idle0;

  await press(page, `${sel('ar-start')}[data-scale="life"]`);
  const shown = await page
    .waitForFunction(() => {
      const o = document.querySelector('[data-mr="ar-overlay"]');
      const v = document.querySelector('[data-mr="viewer"]');
      return o && getComputedStyle(o).display !== 'none' && v?.dataset.xr === 'on' && o.querySelector('.mr-ar-overlay__hint')?.textContent.trim();
    }, { timeout: 15000 })
    .then(() => true)
    .catch(() => false);
  const inside = await page.evaluate(() => {
    const o = document.querySelector('[data-mr="ar-overlay"]');
    const bar = o?.querySelector('.mr-ar-overlay__bar');
    const r = bar?.getBoundingClientRect();
    return {
      hint: o?.querySelector('.mr-ar-overlay__hint')?.textContent.trim(),
      scale: o?.querySelector('.mr-ar-overlay__scale')?.textContent.trim(),
      buttons: [...(o?.querySelectorAll('button') || [])].map((b) => b.textContent.trim()),
      barTop: r ? Math.round(r.top) : null,
      barBottom: r ? Math.round(r.bottom) : null,
      vh: window.innerHeight,
      error: Boolean(document.querySelector('[data-mr="ar-error"]')),
    };
  });
  record(
    `${label}: a started session shows the overlay (finding hint, "Life size", reset + exit) and hands the viewer over (data-xr=on)`,
    shown && !inside.error && inside.hint === COPY.ar.finding && inside.scale === COPY.ar.scale(1) && inside.buttons.join('|') === `${COPY.ar.reset('life')}|${COPY.ar.exit}`,
    `hint "${inside.hint}", scale "${inside.scale}", buttons ${inside.buttons.map((b) => `"${b}"`).join(' ')}`,
  );
  record(`${label}: the overlay's controls sit in the bottom half (thumb reach)`, inside.barTop != null && inside.barTop >= inside.vh / 2 && inside.barBottom <= inside.vh, `bar ${inside.barTop}–${inside.barBottom} px of ${inside.vh}`);
  await tapRule(page, label, [sel('ar-overlay')]);
  await copyRule(page, label, spot, [sel('ar-overlay')]);
  await designRule(page, label, [sel('ar-overlay')]);
  await shot(page, `ar-xr-session-390-${tag}`);
  const s0 = await page.evaluate(() => [window.__xrLog.winRafs, window.__glDraws, window.__glClears, window.__xrLog.xrRafs]);
  await wait(1000);
  const s1 = await page.evaluate(() => [window.__xrLog.winRafs, window.__glDraws, window.__glClears, window.__xrLog.xrRafs]);
  note(
    `${label}: during the session the mock never delivers an XR frame, yet in 1 s the page made ${s1[0] - s0[0]} window.requestAnimationFrame calls, ${s1[2] - s0[2]} gl.clear and ${s1[1] - s0[1]} draw calls (idle before the session: ${idleRafs} rAF calls); session.requestAnimationFrame called ${s1[3]} time(s)`,
  );

  await press(page, `${sel('ar-overlay')} .mr-ar-overlay__bar button:not([data-mr])`); // reset
  await wait(200);
  const afterReset = await page.$eval(`${sel('ar-overlay')} .mr-ar-overlay__scale`, (el) => el.textContent.trim()).catch(() => null);
  await press(page, sel('ar-exit'));
  const gone = await page
    .waitForFunction(() => {
      const o = document.querySelector('[data-mr="ar-overlay"]');
      const v = document.querySelector('[data-mr="viewer"]');
      return o && getComputedStyle(o).display === 'none' && !v.dataset.xr && [...document.querySelectorAll('[data-mr="ar-start"]')].every((b) => !b.disabled);
    }, { timeout: 10000 })
    .then(() => true)
    .catch(() => false);
  const st = await page.evaluate(() => {
    const v = document.querySelector('[data-mr="viewer"]');
    const c = v.querySelector('canvas');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    return { ended: window.__xrLog.ended, state: v.dataset.state, canvas: [c.width, c.height], want: [Math.round(v.clientWidth * dpr), Math.round(v.clientHeight * dpr)] };
  });
  record(
    `${label}: Exit ends the session, hides the overlay, gives the viewer back (canvas at its own size)`,
    gone && st.ended === 1 && st.state === 'ready' && afterReset === COPY.ar.scale(1) && Math.abs(st.canvas[0] - st.want[0]) <= 2 && Math.abs(st.canvas[1] - st.want[1]) <= 2,
    `ended ${st.ended}, reset → "${afterReset}", canvas ${st.canvas.join('×')} (container ${st.want.join('×')})`,
  );
  await wait(1500);
  const draws = await forceRedraw(page);
  const after = await grabViewer(page);
  const d = meanDiff(before, after);
  const turn = await viewerTurns(page);
  record(`${label}: after Exit the room is back where the viewer had it, and still turns`, draws > 0 && d < 1.5 && turn > 2, `picture change ${d.toFixed(2)} vs before the session (redrawn, ${draws} draw calls), drag change ${turn.toFixed(1)} grey levels`);
  noErrors(page, label);
  await close(page);
}

async function androidNone(spot) {
  const label = `android 390 · ${spot.title} (no immersive-ar)`;
  const page = await open('android', { xr: 'unsupported' });
  const ready = await gotoSpot(page, spot);
  const kind = ready ? await entryKind(page) : null;
  if (kind) {
    await press(page, sel('ar-open'));
    await wait(800);
  }
  const line = await page.$eval(sel('ar-none'), (el) => el.textContent.trim()).catch(() => null);
  const qr = Boolean(await page.$(sel('ar-qr')));
  record(`${label}: a phone with neither gets the one line, no QR code, no qr chunk`, kind === 'none' && line === COPY.ar.noAr && !qr && !loaded(page).qr, `kind ${kind}, line "${line}", qr ${qr}`);
  noErrors(page, label);
  await close(page);
}

async function desktop(spot) {
  const tag = tags.get(spot.id);
  const label = `desktop 1440 · ${spot.title}`;
  const page = await open('desktop');
  const ready = await gotoSpot(page, spot);
  if (!ready) {
    record(`${label}: the viewer loads the GLB`, false);
    return close(page);
  }
  const kind = await entryKind(page);
  const l0 = loaded(page);
  record(`${label}: the AR entry shows (no AR here: kind none), qr chunk not loaded yet`, kind === 'none' && l0.entry && !l0.qr && !l0.usdz && !l0.xr, `kind ${kind}; ${loadedStr(l0)}`);
  await press(page, sel('ar-open'));
  const drawn = await page
    .waitForFunction(() => document.querySelector('.mr-ar__qrink')?.getAttribute('d')?.length > 100, { timeout: 15000 })
    .then(() => true)
    .catch(() => false);
  const qr = await page.evaluate(() => {
    const box = document.querySelector('[data-mr="ar-qr"]');
    const ink = box?.querySelector('.mr-ar__qrink');
    const paper = box?.querySelector('.mr-ar__qrpaper');
    return { url: box?.dataset.url, d: ink?.getAttribute('d'), ink: ink && getComputedStyle(ink).fill, paper: paper && getComputedStyle(paper).fill, line: box?.querySelector('.mr-ar__qrline')?.textContent.trim(), box: box && box.querySelector('svg').getBoundingClientRect().width };
  });
  const wantUrl = `${new URL(base).origin}/memories/${spot.id}?ar=1`;
  const q = qrcode(0, 'M');
  q.addData(wantUrl);
  q.make();
  const n = q.getModuleCount();
  let d = '';
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (!q.isDark(r, c)) continue;
      let run = 1;
      while (c + run < n && q.isDark(r, c + run)) run++;
      d += `M${c} ${r}h${run}v1h-${run}z`;
      c += run - 1;
    }
  }
  record(`${label}: the panel shows a QR code for this spot's ?ar=1 page`, drawn && qr.url === wantUrl && qr.d === d && qr.line === COPY.ar.qrLine, `${qr.url} (${n}×${n} modules, ECC M, ${qr.box}px)${qr.d === d ? '' : '; PATH DIFFERS from a fresh encode of that url'}`);
  // read it back from pixels: enlarge the code, screenshot it, sample every module
  if (drawn) {
    // ~7 px a module (the panel caps the width, so the code is drawn as a square centred in the box)
    await page.$eval('.mr-ar__qrcode', (el) => {
      el.style.width = '287px';
      el.style.height = '287px';
    });
    await wait(200);
    const png = await (await page.$('.mr-ar__qrcode')).screenshot();
    await page.$eval('.mr-ar__qrcode', (el) => {
      el.style.width = '';
      el.style.height = '';
    });
    const { data, info } = await sharp(png).greyscale().raw().toBuffer({ resolveWithObject: true });
    const side = Math.min(info.width, info.height);
    const unit = side / (n + 8); // a 4-module quiet zone each side
    const x0 = (info.width - side) / 2;
    const y0 = (info.height - side) / 2;
    const at = (x, y) => data[Math.min(info.height - 1, Math.floor(y0 + y)) * info.width + Math.min(info.width - 1, Math.floor(x0 + x))];
    let wrong = 0;
    let quiet = 0;
    for (let r = -4; r < n + 4; r++) {
      for (let c = -4; c < n + 4; c++) {
        const dark = at((c + 4.5) * unit, (r + 4.5) * unit) < 128;
        const inside = r >= 0 && c >= 0 && r < n && c < n;
        if (inside && dark !== q.isDark(r, c)) wrong++;
        if (!inside && dark) quiet++;
      }
    }
    const fill = (s) => (s?.match(/\d+(\.\d+)?/g) || []).slice(0, 3).map(Number);
    const lum = (rgb) => {
      const [r, g, b] = rgb.map((v) => {
        v /= 255;
        return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const L1 = lum(fill(qr.paper));
    const L2 = lum(fill(qr.ink));
    const contrast = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
    record(`${label}: the QR code reads back from its pixels, dark on light`, wrong === 0 && quiet === 0 && L1 > L2 && contrast >= 7, `${wrong} of ${n * n} modules wrong, ${quiet} dark in the 4-module quiet zone, ink ${qr.ink} on ${qr.paper} (contrast ${contrast.toFixed(1)}:1)`);
  }
  const l1 = loaded(page);
  record(`${label}: opening loads the qr chunk only (no usdz, no xr)`, l1.qr && !l1.usdz && !l1.xr, loadedStr(l1));
  await page.$eval(sel('ar'), (el) => el.scrollIntoView({ block: 'center' }));
  await wait(300);
  await shot(page, `ar-qr-1440-${tag}`);
  await copyRule(page, label, spot, [sel('ar')]);
  await designRule(page, label, [sel('ar')]);
  const t = await targets(page, [sel('ar')]);
  note(`${label}: targets ${t.map((x) => `${x.what} ${x.w}×${x.h}`).join(', ')}`);
  // the viewer's own controls still work with the panel open
  const vp = await page.$(`${sel('viewpoint')}[data-photo="1"]`);
  if (vp) {
    await vp.click();
    const slider = await page.waitForSelector(sel('blend-slider'), { timeout: 5000 }).then(() => true).catch(() => false);
    record(`${label}: with the panel open, photo viewpoint 1 still flies (blend slider shows)`, slider);
    await page.keyboard.press('Escape');
    await wait(900);
  }
  noErrors(page, label);
  page.assets.length = 0;
  await gotoSpot(page, spot, '?ar=1');
  const open2 = await page.waitForSelector(`${sel('ar-panel')} ${sel('ar-qr')}`, { visible: true, timeout: 15000 }).then(() => true).catch(() => false);
  record(`${label}: ?ar=1 opens the panel straight away (QR code shown)`, open2 && (await page.$eval(sel('ar-open'), (el) => el.getAttribute('aria-expanded')).catch(() => null)) === 'true');
  noErrors(page, `${label} (?ar=1)`);
  await close(page);
}

for (const spot of MODELLED) {
  console.log(`\n── ${spot.title} (${spot.kind}, ${spot.id}) ──`);
  await iphone(spot);
  await androidFail(spot);
  await androidSession(spot);
  await androidNone(spot);
  await desktop(spot);
}

// ── spots without a model: no AR entry ──────────────────────────────────────
console.log('\n── no model ──');
{
  const src = MODELLED[0];
  const variants = [
    ...WITHOUT.map((s) => ({ label: `"${s.title}" (${stageOf(s)})`, id: s.id, serve: null })),
    { label: `"${src.title}" served without its GLB (stage preview)`, id: src.id, serve: { ...src, media: src.media.filter((m) => m.type !== 'model') } },
    { label: `"${src.title}" served without its GLB or scene (stage photos)`, id: src.id, serve: { ...src, scene: null, media: src.media.filter((m) => m.type !== 'model') } },
  ];
  for (const v of variants) {
    for (const device of ['iphone', 'desktop']) {
      const label = `no model ${DEVICES[device].width} · ${v.label}`;
      const page = await open(device);
      if (v.serve) {
        await page.setRequestInterception(true);
        page.on('request', (r) => {
          if (new URL(r.url()).pathname === `/api/memories/spots/${v.id}` && r.method() === 'GET') r.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: v.serve }) });
          else r.continue();
        });
      }
      await page.goto(`${base}/memories/${v.id}?ar=1`, { waitUntil: 'networkidle2', timeout: 90000 });
      const title = await page.waitForSelector('.mr-spot__title', { timeout: 20000 }).then(() => true).catch(() => false);
      await wait(2500);
      const stage = await page.$eval('.mr-spot', (el) => el.dataset.stage).catch(() => null);
      const entry = Boolean(await page.$(sel('ar')));
      const l = loaded(page);
      record(`${label}: no AR entry (even with ?ar=1), no AR chunk loaded`, title && !entry && !Object.values(l).some(Boolean), `stage ${stage}, entry ${entry}; ${loadedStr(l)}`);
      noErrors(page, label);
      await close(page);
    }
  }
}
await browser.close();

// ── the USDZ files ───────────────────────────────────────────────────────────
console.log('\n── usdz ──');

/* Reads one USDZ with pxr: stage metadata, world bounds of the visible meshes, ceiling prims,
   each material's UsdPreviewSurface inputs, and the texture files the stage references. */
const INSPECT = String.raw`
import json, sys
from pxr import Usd, UsdGeom, UsdShade, Gf

def value(i):
    if not i:
        return None
    if i.HasConnectedSource():
        srcs = i.GetConnectedSources()[0]
        if not srcs:
            return {'connected': None}
        shader = UsdShade.Shader(srcs[0].source.GetPrim())
        f = shader.GetInput('file')
        asset = f.Get() if f else None
        return {'connected': str(srcs[0].source.GetPath()), 'file': asset.path if asset else None}
    v = i.Get()
    if v is None:
        return None
    try:
        return [float(x) for x in v]
    except TypeError:
        return float(v)

def under(prim, prefixes):
    p = prim
    while p and p.IsValid() and not p.IsPseudoRoot():
        if p.GetName().lower().startswith(prefixes):
            return True
        p = p.GetParent()
    return False

def under_ceiling(prim):
    return under(prim, ('ceiling',))

out = []
for path in sys.argv[1:]:
    stage = Usd.Stage.Open(path)
    xc = UsdGeom.XformCache()
    lo = [float('inf')] * 3
    hi = [float('-inf')] * 3
    meshes = 0
    ceilings = []
    ceiling_meshes = 0
    floor_top = float('-inf')   # top of the floor / ground plate meshes
    others_low = float('inf')   # lowest point of everything else
    for prim in stage.Traverse():
        name = prim.GetName()
        if name.lower().startswith('ceiling'):
            ceilings.append(str(prim.GetPath()))
        if not prim.IsA(UsdGeom.Mesh):
            continue
        if UsdGeom.Imageable(prim).ComputeVisibility() == UsdGeom.Tokens.invisible:
            continue
        meshes += 1
        if under_ceiling(prim):
            ceiling_meshes += 1
        pts = UsdGeom.Mesh(prim).GetPointsAttr().Get()
        if not pts:
            continue
        m = xc.GetLocalToWorldTransform(prim)
        base = under(prim, ('floor', 'ground'))
        for p in pts:
            w = m.Transform(Gf.Vec3d(p[0], p[1], p[2]))
            for k in range(3):
                if w[k] < lo[k]: lo[k] = w[k]
                if w[k] > hi[k]: hi[k] = w[k]
            if base:
                if w[1] > floor_top: floor_top = w[1]
            elif w[1] < others_low:
                others_low = w[1]
    mats = []
    files = set()
    for prim in stage.Traverse():
        if prim.IsA(UsdShade.Shader):
            sh = UsdShade.Shader(prim)
            if sh.GetIdAttr().Get() == 'UsdUVTexture':
                f = sh.GetInput('file')
                if f and f.Get():
                    files.add(f.Get().path)
        if not prim.IsA(UsdShade.Material):
            continue
        surf = UsdShade.Material(prim).ComputeSurfaceSource()[0]
        if not surf:
            mats.append({'name': prim.GetName(), 'surface': None})
            continue
        mats.append({'name': prim.GetName(), 'surface': surf.GetIdAttr().Get(),
                     'diffuse': value(surf.GetInput('diffuseColor')), 'emissive': value(surf.GetInput('emissiveColor')),
                     'roughness': value(surf.GetInput('roughness')), 'metallic': value(surf.GetInput('metallic')),
                     'opacity': value(surf.GetInput('opacity'))})
    out.append({'path': path, 'metersPerUnit': UsdGeom.GetStageMetersPerUnit(stage), 'upAxis': str(UsdGeom.GetStageUpAxis(stage)),
                'defaultPrim': stage.GetDefaultPrim().GetName() if stage.GetDefaultPrim() else None,
                'min': lo, 'max': hi, 'meshes': meshes, 'ceilings': ceilings, 'ceilingMeshes': ceiling_meshes,
                'floorTop': floor_top if floor_top != float('-inf') else None,
                'othersLow': others_low if others_low != float('inf') else None,
                'materials': mats, 'textureFiles': sorted(files)})
print(json.dumps(out))
`;

if (!usdzFiles.length) {
  record('usdz: files to check', false, 'no USDZ came out of the page');
} else if (!PY) {
  record('usdz: a Python with usd-core (for usdchecker --arkit)', false, 'pass --python <path> or set USD_PYTHON; see the header');
} else {
  const files = usdzFiles.map((u) => u.file);
  const chk = spawnSync(PY, ['-I', path.join(REPO, 'tools', 'memory-rooms', 'usdchecker.py'), ...files], { encoding: 'utf8', maxBuffer: 64 << 20 });
  // blocks: "PASS|FAIL <path>" then indented lines
  const blocks = new Map();
  let cur = null;
  for (const line of (chk.stdout || '').split(/\r?\n/)) {
    const m = line.match(/^(PASS|FAIL) (.+)$/);
    if (m) {
      cur = { verdict: m[1], lines: [] };
      blocks.set(path.resolve(m[2]), cur);
    } else if (cur && line.trim()) cur.lines.push(line.trim());
  }
  if (chk.status !== 0 && chk.status !== 1) note(`usdchecker.py exited ${chk.status}: ${(chk.stderr || '').trim().split('\n').slice(-3).join(' | ')}`);
  const insp = spawnSync(PY, ['-I', '-c', INSPECT, ...files], { encoding: 'utf8', maxBuffer: 64 << 20 });
  let inspected = [];
  try {
    inspected = JSON.parse(insp.stdout);
  } catch {
    record('usdz: pxr reads the files', false, (insp.stderr || insp.stdout || '').trim().split('\n').slice(-3).join(' | '));
  }
  const glbInfo = new Map();
  for (const spot of MODELLED) {
    const dest = path.join(USDZ_DIR, `${tags.get(spot.id)}-room.glb`);
    await api.download(roomModel(spot), dest);
    const b = fs.readFileSync(dest);
    const json = JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString());
    glbInfo.set(spot.id, { bytes: b.length, ceiling: (json.nodes || []).some((n) => /^ceiling/.test(n.name || '')), meshNodes: (json.nodes || []).filter((n) => n.mesh != null).length });
  }
  const bySpot = new Map();
  for (const u of usdzFiles) {
    const tag = `usdz · ${tags.get(u.spot.id)} ${u.scale}`;
    const b = blocks.get(path.resolve(u.file));
    const failed = (b?.lines || []).filter((l) => /^(failed|error):/.test(l));
    const warnings = (b?.lines || []).filter((l) => /^warning:/.test(l));
    record(`${tag}: usdchecker --arkit passes`, b?.verdict === 'PASS' && !failed.length, `${b ? b.verdict : 'no result'}${failed.length ? `: ${failed.join(' | ')}` : ''}${warnings.length ? `; ${warnings.length} warning(s): ${warnings.slice(0, 3).join(' | ')}` : ''}`);

    // the package itself (stored zip): entries, textures, sizes
    const buf = fs.readFileSync(u.file);
    let entries = {};
    try {
      entries = unzipSync(new Uint8Array(buf));
    } catch (e) {
      record(`${tag}: the package unzips`, false, e.message);
      continue;
    }
    const names = Object.keys(entries);
    const tex = names.filter((n) => n.startsWith('textures/'));
    const info = inspected.find((x) => path.resolve(x.path) === path.resolve(u.file));
    const refd = info?.textureFiles || [];
    const missing = refd.filter((f) => !names.includes(f.replace(/^\.\//, '')));
    const dims = [];
    for (const t of tex) {
      try {
        const m = await sharp(Buffer.from(entries[t])).metadata();
        dims.push({ t, format: m.format, w: m.width, h: m.height, bytes: entries[t].length });
      } catch (e) {
        dims.push({ t, error: e.message });
      }
    }
    const bad = dims.filter((x) => x.error || Math.max(x.w, x.h) > TEX_CAP[u.scale]);
    record(
      `${tag}: textures inside the package, all referenced ones present, decodable, ≤ ${TEX_CAP[u.scale]} px`,
      tex.length > 0 && refd.length > 0 && !missing.length && !bad.length,
      `${tex.length} texture(s): ${dims.map((x) => (x.error ? `${x.t} ERROR ${x.error}` : `${x.format} ${x.w}×${x.h} ${mb(x.bytes)}`)).join(', ')}; ${refd.length} referenced${missing.length ? `; MISSING ${missing.join(', ')}` : ''}`,
    );
    const first = names[0];
    const geom = names.filter((n) => n.endsWith('.usda') || n.endsWith('.usdc'));
    const geomBytes = geom.reduce((s, n) => s + entries[n].length, 0);
    const texBytes = tex.reduce((s, n) => s + entries[n].length, 0);
    const glb = glbInfo.get(u.spot.id);
    record(
      `${tag}: a sensible size (${mb(SIZE_MIN)}–${mb(SIZE_CAP[u.scale])})`,
      u.bytes >= SIZE_MIN && u.bytes <= SIZE_CAP[u.scale],
      `${mb(u.bytes)} (layers ${mb(geomBytes)} in ${geom.length} file(s), textures ${mb(texBytes)}; room.glb ${mb(glb.bytes)}; root layer ${first})`,
    );
    if (!info) continue;
    // materials: the bake as emission over a black, fully rough base
    const isBlack = (v) => Array.isArray(v) && v.every((x) => Math.abs(x) < 1e-6);
    const relit = info.materials.filter((m) => !m.surface || m.diffuse?.connected || !isBlack(m.diffuse) || (m.roughness ?? 0.5) < 0.999 || (m.metallic ?? 0) > 1e-6);
    const textured = info.materials.filter((m) => m.emissive?.connected);
    const dark = info.materials.filter((m) => !m.emissive || (Array.isArray(m.emissive) && isBlack(m.emissive)));
    record(
      `${tag}: every material = black base, roughness 1, metallic 0, the bake as emissive (Quick Look can't relight it)`,
      info.materials.length > 0 && !relit.length && textured.length > 0 && !dark.length,
      `${info.materials.length} materials, ${textured.length} with an emissive texture${relit.length ? `; RELIT: ${relit.map((m) => `${m.name} diffuse ${JSON.stringify(m.diffuse)} rough ${m.roughness} metal ${m.metallic}`).join(' | ')}` : ''}${dark.length ? `; no emission: ${dark.map((m) => m.name).join(', ')}` : ''}`,
    );
    record(`${tag}: stage in metres, y up`, info.metersPerUnit === 1 && info.upAxis === 'Y', `metersPerUnit ${info.metersPerUnit}, upAxis ${info.upAxis}, defaultPrim ${info.defaultPrim}`);
    (bySpot.get(u.spot.id) || bySpot.set(u.spot.id, {}).get(u.spot.id))[u.scale] = { info, u };
  }
  // scale, floor, centre, ceiling: per spot, tabletop against life and both against scene.json
  for (const spot of MODELLED) {
    const pair = bySpot.get(spot.id);
    const tag = `usdz · ${tags.get(spot.id)}`;
    if (!pair?.tabletop || !pair?.life) {
      record(`${tag}: both scales inspected`, false);
      continue;
    }
    const sb = sceneBounds(spot.scene);
    const want = [sb.max[0] - sb.min[0], sb.max[1] - sb.min[1], sb.max[2] - sb.min[2]];
    const ext = (i) => [0, 1, 2].map((k) => i.max[k] - i.min[k]);
    const L = ext(pair.life.info);
    const T = ext(pair.tabletop.info);
    const fmt = (v, s = 1) => v.map((x) => (x * s).toFixed(s === 1 ? 2 : 1)).join(' × ');
    const ratio = (a, b) => a / b;
    const lifeOk = [0, 2].every((k) => ratio(L[k], want[k]) >= 0.97 && ratio(L[k], want[k]) <= 1.15);
    record(
      `${tag} life: 1:1, its footprint matches scene.json`,
      lifeOk,
      `${fmt(L)} m (w × h × d) vs scene.json ${fmt(want)} m; footprint ratio ${[0, 2].map((k) => ratio(L[k], want[k]).toFixed(3)).join(' / ')}`,
    );
    const tt = [0, 2].map((k) => ratio(T[k], L[k]));
    const tw = [0, 2].map((k) => ratio(T[k] * 20, want[k]));
    record(
      // a roof's eaves (left out of the tabletop) can make life size a little wider, never narrower
      `${tag} tabletop: 1:20 (footprint ≈ life / 20, eaves aside, and ≈ scene.json / 20)`,
      tt.every((r) => r <= SCALE.tabletop * 1.01 && r >= SCALE.tabletop * 0.85) && tw.every((r) => r >= 0.97 && r <= 1.15),
      `${fmt(T, 100)} cm; tabletop / life ${tt.map((r) => `1:${(1 / r).toFixed(2)}`).join(' / ')}`,
    );
    for (const [scale, { info }] of Object.entries(pair)) {
      const e = ext(info);
      const s = SCALE[scale];
      const cx = (info.min[0] + info.max[0]) / 2;
      const cz = (info.min[2] + info.max[2]) / 2;
      // the floor (interior) / ground plate (exterior) surface on y = 0, nothing else below it
      const top = info.floorTop;
      const low = info.othersLow;
      record(
        `${tag} ${scale}: the floor / ground surface on y = 0 (nothing else below it), footprint centred on the origin`,
        top != null && Math.abs(top) <= 0.02 * s && (low == null || low >= -0.02 * s) && Math.abs(cx) <= 0.05 * e[0] && Math.abs(cz) <= 0.05 * e[2],
        `floor top ${top == null ? 'NO floor/ground mesh' : `${(top / s).toFixed(3)} m`}, lowest other point ${low == null ? '–' : `${(low / s).toFixed(3)} m`}, centre x ${(cx / s).toFixed(3)} z ${(cz / s).toFixed(3)} m (room scale)`,
      );
      if (info.min[1] < -0.02 * s) note(`${tag} ${scale}: the bounding box reaches ${(info.min[1] / s).toFixed(3)} m below the floor (the floor / ground plate's own thickness); whether Quick Look grounds the origin or the box bottom decides whether that sits under the surface`);
    }
    const glb = glbInfo.get(spot.id);
    const lc = pair.life.info.ceilings.length;
    const tc = pair.tabletop.info.ceilings.length;
    if (glb.ceiling) {
      record(
        `${tag}: tabletop has no ceiling, life size has it`,
        tc === 0 && lc > 0 && pair.tabletop.info.meshes === pair.life.info.meshes - pair.life.info.ceilingMeshes && pair.tabletop.info.meshes > 0,
        `ceiling prims: tabletop ${tc}, life ${lc} (${pair.life.info.ceilings.slice(0, 2).join(', ')}); meshes tabletop ${pair.tabletop.info.meshes}, life ${pair.life.info.meshes} (${pair.life.info.ceilingMeshes} in the ceiling)`,
      );
    } else {
      record(
        `${tag}: no ceiling in room.glb, so tabletop and life hold the same meshes`,
        tc === 0 && lc === 0 && pair.tabletop.info.meshes === pair.life.info.meshes,
        `meshes tabletop ${pair.tabletop.info.meshes}, life ${pair.life.info.meshes}`,
      );
    }
    record(`${tag}: life size holds every mesh node of room.glb`, pair.life.info.meshes >= glb.meshNodes, `${pair.life.info.meshes} meshes vs ${glb.meshNodes} mesh nodes in room.glb`);
  }
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed (${scheme}). ${notes.length} note(s). Screenshots: ${OUT}  USDZ: ${USDZ_DIR}`);
if (failed.length) console.log(`Failed:\n${failed.map((r) => `  ✗ ${r.name}`).join('\n')}`);
process.exit(failed.length ? 1 : 0);
