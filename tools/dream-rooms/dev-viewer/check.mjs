/* Dream Rooms · the viewer's headless check (against the dev harness).

     npx vite --port 5197 --strictPort          (in another terminal)
     node tools/dream-rooms/dev-viewer/check.mjs [dream] [corridor] [mobile]

   dream     the sample dream on autopilot at 1440×900 and 390×844: woken, hall →
             corridor (laps) → pool, the teleport, the dissolve, ≥ 1 swap, 0 errors, fps
   corridor  the fixture rows: door order and night breaks, door states, only ajar doors
             enter, a real click on a rendered door's sign enters and (autopilot) wakes
             back at that door, the empty state, ?at=<id>
   mobile    the corridor at 390×844: a real tap on a sign enters

   Uses the baked GLBs when they exist (dream-rooms-work/sample/build/draft.glb,
   public/dreams/corridor-kit.glb), else the grey box. Screenshots go to
   tools/dream-rooms/out/viewer/. Prints ids, states and numbers only. */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { captureFrames, launch, watchErrors } from '../lib/frames.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const OUT = path.join(ROOT, 'tools/dream-rooms/out/viewer');
const BASE = process.env.DR_HARNESS || 'http://localhost:5197/tools/dream-rooms/dev-viewer/index.html';
const HAS_GLB = fs.existsSync(path.join(ROOT, 'dream-rooms-work/sample/build/draft.glb'));
const HAS_KIT = fs.existsSync(path.join(ROOT, 'public/dreams/corridor-kit.glb'));
const MODEL = HAS_GLB ? 'glb=/dream-rooms-work/sample/build/draft.glb' : 'greybox=1';
const KIT = HAS_KIT ? '' : '&kit=0';
const ROWS = 'rows=/tools/dream-rooms/samples/fixtures-nights.json';
const FIX = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools/dream-rooms/samples/fixtures-nights.json'), 'utf8')).dreams;
const want = new Set(process.argv.slice(2));
const all = !want.size;
const results = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function check(name, ok, detail = '') {
  results.push({ name, ok: !!ok, detail });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? `  (${detail})` : ''}`);
}

async function waitFor(page, fn, arg, timeout = 30000) {
  try {
    await page.waitForFunction(fn, { timeout, polling: 200 }, arg);
    return true;
  } catch {
    return false;
  }
}

/* ── the sample dream on autopilot ─────────────────────────────────────── */
async function dreamRun(label, width, height, mobile) {
  const url = `${BASE}?${MODEL}&autopilot=1`;
  const t0 = Date.now();
  const res = await captureFrames({ url, outDir: path.join(OUT, `dream-${label}`), width, height, mobile, timeoutS: 200 });
  const secs = Math.round((Date.now() - t0) / 1000);
  const ev = res.dream?.events || [];
  const mods = ev.filter((e) => e.type === 'module').map((e) => e.id);
  const order = ['hall', 'corridor', 'pool'].every((m, i, arr) => mods.indexOf(m) >= 0 && (i === 0 || mods.indexOf(m) > mods.indexOf(arr[i - 1])));
  check(`dream ${label}: woken`, res.dream?.state === 'woken', `${secs}s, ${res.dream?.greybox ? 'grey box' : 'glb'}`);
  check(`dream ${label}: hall → corridor → pool`, order, mods.join(' → '));
  check(`dream ${label}: teleport fired`, ev.some((e) => e.type === 'teleport' && e.from === 'd1' && e.to === 'd2'));
  check(`dream ${label}: laps in the corridor`, (res.dream?.lap || 0) >= 1, `lap ${res.dream?.lap}`);
  check(`dream ${label}: dissolve fired`, ev.some((e) => e.type === 'dissolve' && e.from === 'corridor' && e.to === 'pool'));
  const swaps = ev.filter((e) => e.type === 'swap');
  check(`dream ${label}: swaps fired`, swaps.length >= 1, `${swaps.length}: ${[...new Set(swaps.map((s) => `${s.target}/${s.action}`))].join(', ')}`);
  check(`dream ${label}: the pool lockers vanished`, swaps.some((s) => s.target === 'pool/lockers'));
  check(`dream ${label}: words painted`, ev.some((e) => e.type === 'word'), `${ev.filter((e) => e.type === 'word').length}`);
  check(`dream ${label}: under 3 minutes`, secs < 180, `${secs}s`);
  check(`dream ${label}: zero console errors`, res.errors.length === 0, res.errors.slice(0, 3).join(' | '));
  console.log(`     fps ${label}: ${res.fps}  grids: ${ev.filter((e) => e.type === 'grid').map((e) => `${e.module} ${e.ms}ms`).join(', ')}`);
  console.log(`     frames: ${res.frames.map((f) => path.relative(ROOT, f.file)).join(', ')}`);
  return res;
}

/* ── the corridor ─────────────────────────────────────────────────────── */
async function openCorridor(browser, query, { width = 1440, height = 900 } = {}) {
  const page = await browser.newPage();
  await page.setViewport({ width, height });
  const errors = watchErrors(page);
  await page.goto(`${BASE}?corridor=1${KIT}&${MODEL}&${query}`, { waitUntil: 'domcontentloaded' });
  const ok = await waitFor(page, () => window.__corridor?.state === 'corridor', null, 30000);
  return { page, errors, ok };
}

async function corridorChecks() {
  const browser = await launch({ width: 1440, height: 900 });
  const dir = path.join(OUT, 'corridor-1440');
  fs.mkdirSync(dir, { recursive: true });
  try {
    // order, breaks, states
    {
      const { page, errors, ok } = await openCorridor(browser, ROWS);
      check('corridor: reaches state corridor', ok);
      await sleep(2500);
      await page.screenshot({ path: path.join(dir, 'entrance.png') });
      const c = await page.evaluate(() => ({ doors: window.__corridor.doors, breaks: window.__corridor.breaks, fps: window.__corridor.fps, kit: window.__corridor.kit, streamed: window.__corridor.streamed }));
      const expect = [...FIX].sort((a, b) => (a.dreamt_on < b.dreamt_on ? 1 : a.dreamt_on > b.dreamt_on ? -1 : a.night_order - b.night_order));
      const sameOrder = expect.every((r, i) => c.doors[i]?.id === r.id);
      check('corridor: one door per row, in (dreamt_on desc, night_order) order', c.doors.length === FIX.length && sameOrder, `${c.doors.length} doors`);
      const mono = c.doors.every((d, i) => i === 0 || d.z < c.doors[i - 1].z);
      check('corridor: door z strictly deeper along that order', mono);
      const nights = [...new Set(expect.map((r) => r.dreamt_on))];
      const breaksOk =
        c.breaks.length === nights.length &&
        c.breaks.every((b, i) => {
          const night = nights[i];
          if (b.night !== night) return false;
          const first = c.doors.find((d) => d.dreamt_on === night);
          const prevNight = nights[i - 1];
          const prevLast = prevNight ? [...c.doors].reverse().find((d) => d.dreamt_on === prevNight) : null;
          return b.z > first.z && (!prevLast || b.z < prevLast.z);
        });
      check('corridor: a night break exactly where the date changes', breaksOk, `${c.breaks.length} breaks / ${nights.length} nights`);
      const stateOf = (s) => (s === 'rendered' ? 'ajar' : s === 'failed' ? 'shut-dark' : 'shut-lit');
      check('corridor: door states match status', c.doors.every((d) => d.state === stateOf(d.status)));
      check('corridor: streams a window of pieces', c.streamed > 0 && c.streamed <= 25, `${c.streamed} pieces, kit ${c.kit}`);
      console.log(`     fps corridor 1440: ${c.fps}`);
      // only ajar doors enter
      const shut = c.doors.find((d) => d.state !== 'ajar');
      const entered = await page.evaluate((id) => window.__corridor.enter(id), shut.id);
      await sleep(1500);
      const st = await page.evaluate(() => window.__corridor.state);
      check('corridor: a shut door does not open', entered === false && st === 'corridor', `${shut.status} → ${st}`);
      check('corridor: zero console errors (order page)', errors.length === 0, errors.slice(0, 3).join(' | '));
      await page.close();
    }
    // a real click on a rendered door's sign → enter → dream (autopilot) → wake → back at that door
    {
      const { page, errors } = await openCorridor(browser, `${ROWS}&autopilot=1`);
      await sleep(1800);
      const target = await page.evaluate(() => window.__corridor.doors.find((d) => d.state === 'ajar'));
      const p = await page.evaluate((id) => window.__corridor.signScreen(id), target.id);
      check('corridor: signScreen gives the first rendered door on screen', !!p, p ? `${Math.round(p.x)},${Math.round(p.y)}` : 'null');
      if (p) await page.mouse.click(p.x, p.y);
      const entering = await waitFor(page, () => window.__corridor.state === 'entering', null, 8000);
      check('corridor: the click enters', entering);
      await waitFor(page, () => window.__corridor.state === 'entering' && (window.__dream?.white ?? 0) >= 0 && document.querySelector('canvas'), null, 2000);
      await sleep(1400);
      await page.screenshot({ path: path.join(dir, 'entering.png') });
      const inDream = await waitFor(page, () => window.__corridor.state === 'dream' && window.__dream?.state === 'walking', null, 30000);
      check('corridor: the dream plays', inDream);
      await sleep(1500);
      await page.screenshot({ path: path.join(dir, 'in-dream.png') });
      const woke = await waitFor(page, () => window.__dream?.state === 'woken', null, 200000);
      check('corridor: autopilot reaches the wake', woke);
      const back = await waitFor(page, () => window.__corridor.state === 'corridor', null, 20000);
      const after = await page.evaluate(() => ({ at: window.__corridor.at, pos: window.__corridor.pos, href: location.search }));
      const door = await page.evaluate((id) => window.__corridor.doors.find((d) => d.id === id), target.id);
      check('corridor: back in the corridor at that door', back && after.at === target.id && Math.abs(after.pos[1] - door.z) < 0.3, `at ${after.at === target.id ? 'id ok' : after.at}, dz ${Math.abs(after.pos[1] - door.z).toFixed(2)}`);
      check('corridor: the address carries at=<id>', after.href.includes(`at=${target.id}`));
      await sleep(400);
      await page.screenshot({ path: path.join(dir, 'woke-at-door.png') });
      check('corridor: zero console errors (enter + wake)', errors.length === 0, errors.slice(0, 3).join(' | '));
      await page.close();
    }
    // the empty state
    {
      const { page, errors, ok } = await openCorridor(browser, 'rows=empty');
      await sleep(2500);
      const c = await page.evaluate(() => ({ doors: window.__corridor.doors.length, empty: window.__corridor.empty, breaks: window.__corridor.breaks.length }));
      check('corridor: empty state', ok && c.doors === 0 && c.empty && c.breaks === 0);
      await page.screenshot({ path: path.join(dir, 'empty.png') });
      check('corridor: zero console errors (empty)', errors.length === 0, errors.slice(0, 3).join(' | '));
      await page.close();
    }
    // ?at=<id>: start at that door, facing it (the oldest: deep in the fog)
    {
      const deep = [...FIX].sort((a, b) => (a.dreamt_on < b.dreamt_on ? -1 : 1))[0];
      const { page, errors, ok } = await openCorridor(browser, `${ROWS}&at=${deep.id}`);
      await sleep(2500);
      const c = await page.evaluate((id) => ({ at: window.__corridor.at, pos: window.__corridor.pos, door: window.__corridor.doors.find((d) => d.id === id) }), deep.id);
      check('corridor: ?at=<id> starts at that door', ok && c.at === deep.id && Math.abs(c.pos[1] - c.door.z) < 0.2, `z ${c.pos[1]} vs ${c.door.z}`);
      await page.screenshot({ path: path.join(dir, 'at-deep-door.png') });
      // turn to look back up the corridor (toward the entrance) for a "deep in the fog" frame
      await page.keyboard.down(c.door.side === 'l' ? 'ArrowLeft' : 'ArrowRight');
      await sleep(1250);
      await page.keyboard.up(c.door.side === 'l' ? 'ArrowLeft' : 'ArrowRight');
      await sleep(1200);
      await page.screenshot({ path: path.join(dir, 'deep-looking-back.png') });
      check('corridor: zero console errors (?at)', errors.length === 0, errors.slice(0, 3).join(' | '));
      await page.close();
    }
    // a night break: stand at the first door of the second night and look back into its bay
    {
      const nights = [...new Set([...FIX].map((r) => r.dreamt_on))].sort().reverse();
      const first = FIX.filter((r) => r.dreamt_on === nights[1]).sort((a, b) => a.night_order - b.night_order)[0];
      const { page } = await openCorridor(browser, `${ROWS}&at=${first.id}`);
      await sleep(1500);
      const side = await page.evaluate((id) => window.__corridor.doors.find((d) => d.id === id).side, first.id);
      await page.keyboard.down(side === 'l' ? 'ArrowLeft' : 'ArrowRight');
      await sleep(900);
      await page.keyboard.up(side === 'l' ? 'ArrowLeft' : 'ArrowRight');
      await sleep(400);
      await page.keyboard.down('ArrowDown');
      await sleep(1400);
      await page.keyboard.up('ArrowDown');
      await sleep(1500);
      await page.screenshot({ path: path.join(dir, 'night-break.png') });
      await page.close();
    }
  } finally {
    await browser.close();
  }
}

async function mobileChecks() {
  const browser = await launch({ width: 390, height: 844, mobile: true });
  const dir = path.join(OUT, 'corridor-390');
  fs.mkdirSync(dir, { recursive: true });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const errors = watchErrors(page);
    await page.goto(`${BASE}?corridor=1${KIT}&${MODEL}&${ROWS}`, { waitUntil: 'domcontentloaded' });
    await waitFor(page, () => window.__corridor?.state === 'corridor', null, 30000);
    await sleep(2500);
    await page.screenshot({ path: path.join(dir, 'entrance.png') });
    const fps = await page.evaluate(() => window.__corridor.fps);
    console.log(`     fps corridor 390: ${fps}`);
    const target = await page.evaluate(() => window.__corridor.doors.find((d) => d.state === 'ajar'));
    const p = await page.evaluate((id) => window.__corridor.signScreen(id), target.id);
    check('mobile: the first rendered sign is on screen', !!p);
    if (p) await page.touchscreen.tap(p.x, p.y);
    const entering = await waitFor(page, () => window.__corridor.state === 'entering', null, 8000);
    check('mobile: a tap on a sign enters', entering);
    const inDream = await waitFor(page, () => window.__corridor.state === 'dream' && window.__dream?.state === 'walking', null, 30000);
    check('mobile: the dream plays', inDream);
    await sleep(2500);
    await page.screenshot({ path: path.join(dir, 'in-dream.png') });
    check('mobile: zero console errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  } finally {
    await browser.close();
  }
}

fs.mkdirSync(OUT, { recursive: true });
console.log(`harness ${BASE}  model: ${HAS_GLB ? 'draft.glb' : 'grey box'}  kit: ${HAS_KIT ? 'corridor-kit.glb' : 'grey box'}`);
if (all || want.has('corridor')) await corridorChecks();
if (all || want.has('mobile')) await mobileChecks();
if (all || want.has('dream')) {
  await dreamRun('1440', 1440, 900, false);
  await dreamRun('390', 390, 844, true);
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
