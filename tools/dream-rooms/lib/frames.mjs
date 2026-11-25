/* Dream Rooms · autopilot frames (build.mjs --draft and the review step use these).

     import { captureFrames } from './lib/frames.mjs'
     const { frames, errors, fps } = await captureFrames({ url, outDir, timeoutS, width, height, token })

     node tools/dream-rooms/lib/frames.mjs <url> <outDir>

   Opens `url` (a dream page or the dev harness with ?autopilot=1) in headless Edge,
   collects console errors and page errors, and polls window.__dream:
     · `<k>-<module>.png` about 2.5 s after each new module (later if the frame is
       still black or white then, so the picture shows the place);
     · `dissolve.png` as the dissolve's white comes in (at 0.6: the peak itself is pure white);
     · `wake.png` once his line is on the white.
   Resolves at `woken` or the timeout. When a token is given (default: DREAMS_PASSWORD,
   then PORTAL_PASSWORD, from the repo's .dev.vars) it first opens the origin and sets
   localStorage['dr:token']. Prints ids, file names and numbers only (decision 14). */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import puppeteer from 'puppeteer-core';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
export const EDGE = process.env.EDGE || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
export const EDGE_ARGS = ['--use-angle=d3d11', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required', '--no-first-run', '--hide-scrollbars'];

/** DREAMS_PASSWORD, then PORTAL_PASSWORD, from .dev.vars (or null). */
export function devToken() {
  try {
    const text = fs.readFileSync(path.join(ROOT, '.dev.vars'), 'utf8');
    const vars = {};
    for (const line of text.split(/\r?\n/)) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
      if (m) vars[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
    return vars.DREAMS_PASSWORD || vars.PORTAL_PASSWORD || null;
  } catch {
    return null;
  }
}

export async function launch({ width = 1280, height = 800, mobile = false } = {}) {
  const browser = await puppeteer.launch({
    executablePath: EDGE,
    headless: true,
    args: [...EDGE_ARGS, `--window-size=${width},${height}`],
    defaultViewport: { width, height, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile },
  });
  return browser;
}

export function watchErrors(page) {
  const errors = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text().slice(0, 240));
  });
  page.on('pageerror', (e) => errors.push(String(e?.message || e).slice(0, 240)));
  return errors;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function captureFrames({ url, outDir, timeoutS = 240, width = 1280, height = 800, token, mobile = false, onPoll = null }) {
  fs.mkdirSync(outDir, { recursive: true });
  const tok = token === undefined ? devToken() : token;
  const browser = await launch({ width, height, mobile });
  const frames = [];
  let errors = [];
  const fpsSamples = [];
  let last = null;
  try {
    const page = await browser.newPage();
    errors = watchErrors(page);
    if (tok) {
      await page.goto(new URL(url).origin + '/', { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.evaluate((t) => localStorage.setItem('dr:token', t), tok);
    }
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    const t0 = Date.now();
    const shoot = async (name) => {
      const file = path.join(outDir, name);
      await page.screenshot({ path: file });
      frames.push({ name: name.replace(/\.png$/, ''), file });
    };
    let k = 0;
    let lastModule = null;
    let pending = null; // { name, at, until }
    let dissolveShot = false;
    let wakeShot = false;
    while (Date.now() - t0 < timeoutS * 1000) {
      const d = await page.evaluate(() => {
        const x = window.__dream;
        if (!x) return null;
        return { state: x.state, module: x.module, fps: x.fps, white: x.white ?? 0, black: x.black ?? 0, line: !!x.line, lap: x.lap, swaps: x.swaps };
      });
      if (d) {
        last = d;
        onPoll?.(d);
        if (['walking', 'dissolving', 'teleporting', 'fading-in'].includes(d.state) && d.fps) fpsSamples.push(d.fps);
        if (d.module && d.module !== lastModule && d.state !== 'loading') {
          lastModule = d.module;
          k += 1;
          pending = { name: `${k}-${d.module}.png`, at: Date.now() + 2500, until: Date.now() + 9000 };
        }
        if (pending && Date.now() >= pending.at && ((d.white < 0.15 && d.black < 0.15) || Date.now() > pending.until)) {
          await shoot(pending.name);
          pending = null;
        }
        if (!dissolveShot && d.state === 'dissolving' && d.white >= 0.6) {
          dissolveShot = true;
          await shoot('dissolve.png');
        }
        if (!wakeShot && (d.state === 'waking' || d.state === 'woken') && d.line) {
          await sleep(1200);
          wakeShot = true;
          await shoot('wake.png');
        }
        if (d.state === 'woken' && wakeShot) break;
        if (d.state === 'error') break;
      }
      await sleep(200);
    }
    if (!wakeShot && last?.state === 'woken') await shoot('wake.png');
    last = await page.evaluate(() => {
      const x = window.__dream;
      return x ? { state: x.state, module: x.module, lap: x.lap, swaps: x.swaps, events: x.events, greybox: x.greybox } : null;
    });
  } finally {
    await browser.close();
  }
  const fps = fpsSamples.length ? Math.round(fpsSamples.reduce((a, b) => a + b, 0) / fpsSamples.length) : 0;
  return { frames, errors, fps, dream: last };
}

// CLI
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const [url, outDir] = process.argv.slice(2);
  if (!url || !outDir) {
    console.error('usage: node tools/dream-rooms/lib/frames.mjs <url> <outDir>');
    process.exit(2);
  }
  const res = await captureFrames({ url, outDir: path.resolve(outDir) });
  const summary = {
    state: res.dream?.state || null,
    frames: res.frames.map((f) => path.basename(f.file)),
    errors: res.errors.length,
    fps: res.fps,
    swaps: res.dream?.swaps ?? 0,
    lap: res.dream?.lap ?? 0,
  };
  console.log(JSON.stringify(summary, null, 2));
  if (res.errors.length) console.log(res.errors.slice(0, 5).join('\n'));
  process.exit(res.dream?.state === 'woken' && !res.errors.length ? 0 : 1);
}
