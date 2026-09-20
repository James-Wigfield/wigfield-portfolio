/* ============================================================================
   dl-game-check — look at the 3D game headlessly
   ----------------------------------------------------------------------------
   node tools/dl-game-check.mjs [--url http://localhost:5199] [--out <dir>]
                                [--scenario tour|window|eyes|door|all] [--headful]

   Drives the local Edge/Chrome with puppeteer-core through the portal gate,
   opens the Scrolls · 3D tab, presses Begin, then walks a scenario: takes
   screenshots, counts console errors and WebGL warnings, samples the frame
   rate and reports the GLB payload. Prints one JSON summary at the end.
   The window.__dlg handle (Scene.jsx) lets a scenario teleport the player.
   ========================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const args = Object.fromEntries(
  process.argv.slice(2).map((a, i, arr) => (a.startsWith('--') ? [a.slice(2), arr[i + 1]?.startsWith('--') || arr[i + 1] === undefined ? true : arr[i + 1]] : null)).filter(Boolean),
);
const URL = args.url || 'http://localhost:5199';
const OUT = args.out || path.join(process.cwd(), 'temp', 'dl-game-shots');
const SCENARIO = args.scenario || 'tour';
const HEADFUL = !!args.headful;
fs.mkdirSync(OUT, { recursive: true });

const BROWSERS = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
];
const exe = BROWSERS.find((p) => fs.existsSync(p));
if (!exe) throw new Error('No Edge or Chrome found');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const report = { scenario: SCENARIO, errors: [], warnings: [], webgl: null, fps: {}, glb: [], shots: [] };

const browser = await puppeteer.launch({
  executablePath: exe,
  headless: HEADFUL ? false : 'new',
  defaultViewport: { width: 1920, height: 1080 },
  args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required', '--window-size=1920,1080'],
});
const page = await browser.newPage();
page.on('console', (m) => {
  const t = m.type();
  const text = m.text();
  if (t === 'error') report.errors.push(text);
  else if (t === 'warn' || t === 'warning') report.warnings.push(text);
});
page.on('pageerror', (e) => report.errors.push(`pageerror: ${e.message}`));
page.on('response', (res) => {
  const u = res.url();
  if (u.endsWith('.glb')) {
    const len = Number(res.headers()['content-length'] || 0);
    report.glb.push({ file: u.split('/').pop(), status: res.status(), bytes: len });
  }
});

async function shot(name) {
  const file = path.join(OUT, `${SCENARIO}-${name}.png`);
  await page.screenshot({ path: file });
  report.shots.push(file);
}

async function measureFps(label, ms = 2500) {
  const fps = await page.evaluate(
    (dur) =>
      new Promise((resolve) => {
        let n = 0;
        const t0 = performance.now();
        const tick = () => {
          n += 1;
          if (performance.now() - t0 < dur) requestAnimationFrame(tick);
          else resolve(Math.round((n * 1000) / (performance.now() - t0)));
        };
        requestAnimationFrame(tick);
      }),
    ms,
  );
  report.fps[label] = fps;
}

async function keys(list, holdMs) {
  for (const k of list) await page.keyboard.down(k);
  await sleep(holdMs);
  for (const k of list) await page.keyboard.up(k);
}

/* Teleport the philosopher and face the camera along a heading. */
async function teleport(x, z, yaw, opts = {}) {
  await page.evaluate(
    ({ x, z, yaw, opts }) => {
      const d = window.__dlg;
      if (!d) return;
      d.world.player.pos.set(x, 0, z);
      d.world.player.heading = yaw;
      d.world.camera.yaw = yaw;
      if (opts.pitch !== undefined) d.world.camera.pitch = opts.pitch;
      if (opts.dist !== undefined) d.world.camera.dist = opts.dist;
      if (opts.hint === false) d.hud.set({ hint: false });
    },
    { x, z, yaw, opts },
  );
  await sleep(900);
}

/* ── in ───────────────────────────────────────────────────────────────── */
try {
await page.goto(`${URL}/`, { waitUntil: 'domcontentloaded' });
await page.evaluate(() => {
  sessionStorage.setItem('portal_auth', JSON.stringify({ token: 'mock-session-token', key: 'wiggy1', issued_at: new Date().toISOString() }));
  try { localStorage.removeItem('dlg:CITS5017:lecture3:v1'); } catch { /* fine */ }
});
await page.goto(`${URL}/portal`, { waitUntil: 'networkidle0' });
const nav = await page.$$('button.portal__nav-item');
let clicked = false;
for (const b of nav) {
  const txt = await b.evaluate((el) => el.textContent);
  if (txt.includes('Scrolls')) { await b.click(); clicked = true; break; }
}
if (!clicked) {
  // the section may be collapsed — open Deep Learning first
  const heads = await page.$$('button.portal__nav-group-head');
  for (const h of heads) {
    const txt = await h.evaluate((el) => el.textContent);
    if (txt.includes('Deep Learning')) { await h.click(); break; }
  }
  await sleep(300);
  for (const b of await page.$$('button.portal__nav-item')) {
    const txt = await b.evaluate((el) => el.textContent);
    if (txt.includes('Scrolls')) { await b.click(); clicked = true; break; }
  }
}
if (!clicked) throw new Error('Scrolls tab not found');
await sleep(500);
await shot('00-cover');

const begin = await page.$('.dlg-cover .dlg-btn--primary');
if (!begin) throw new Error('Begin button not found');
await begin.click();
await page.waitForSelector('.dlg-scene canvas', { timeout: 30000 });
await sleep(2500);
report.webgl = await page.evaluate(() => {
  const c = document.querySelector('.dlg-scene canvas');
  const gl = c.getContext('webgl2') || c.getContext('webgl');
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'unknown';
});
await page.focus('.dlg-scene');
await shot('01-spawn');
await measureFps('spawn');

/* ── scenarios ────────────────────────────────────────────────────────── */
const run = async (name) => {
  if (name === 'tour') {
    await keys(['w'], 1600);
    await shot('02-walk-north');
    await page.mouse.move(960, 540);
    await page.mouse.down();
    await page.mouse.move(700, 520, { steps: 12 });
    await page.mouse.up();
    await sleep(500);
    await shot('03-turned');
    await teleport(-6, 0, Math.PI * 1.5, { pitch: 0.3, dist: 7, hint: false });
    await shot('04-house-window-outside');
    await teleport(0, -8, Math.PI, { pitch: 0.3, dist: 7 });
    await shot('05-house-eyes-outside');
    await teleport(4, -3, Math.PI * 0.5, { pitch: 0.3, dist: 7 });
    await shot('06-house-door-outside');
    await teleport(-12, -21, Math.PI, { pitch: 0.35, dist: 8 });
    await shot('07-stair-terrace');
    await teleport(11, -33, 2.2, { pitch: 0.22, dist: 9 });
    await shot('08-colonnade');
    await teleport(0, 4, 0, { pitch: 0.25, dist: 8 });
    await shot('09-sea');
    await measureFps('village');
  }
  if (name === 'window') {
    await teleport(-9.6, 0, Math.PI * 1.5, { pitch: 0.5, dist: 4.5, hint: false });
    await shot('10-doorway');
    await keys(['w'], 1500);
    await sleep(500);
    await shot('11-inside');
    // walk to the kernel scroll and read it
    await teleport(-13.2, 3.0, Math.PI * 1.5, { pitch: 0.55, dist: 4.5 });
    await page.keyboard.press('e');
    await sleep(900);
    await shot('12-kernel-scroll');
    // stand on the image: kernel frame + wall
    await teleport(-16.5, 0.5, Math.PI * 1.5, { pitch: 0.62, dist: 5 });
    await keys(['w'], 700);
    await sleep(400);
    await shot('13-frame');
    await keys(['a'], 1200);
    await keys(['w'], 700);
    await sleep(400);
    await shot('14-frame-moved');
    // the filter scrolls
    await teleport(-20.4, 3.6, Math.PI * 1.5, { pitch: 0.5, dist: 4 });
    await page.keyboard.press('e');
    await sleep(700);
    await teleport(-12.4, -3.6, Math.PI * 1.5, { pitch: 0.5, dist: 4 });
    await page.keyboard.press('e');
    await sleep(700);
    await teleport(-17.5, 0.5, Math.PI * 1.5, { pitch: 0.5, dist: 5 });
    await keys(['w'], 1400);
    await sleep(400);
    await shot('15-horizontal-wall');
    // the door
    await teleport(-16.5, -3.8, Math.PI, { pitch: 0.45, dist: 4 });
    await page.keyboard.press('e');
    await sleep(700);
    await shot('16-door-question');
    await page.keyboard.press('2');
    await sleep(1200);
    await shot('17-after-answer');
    await measureFps('window');
  }
  if (name === 'eyes') {
    await teleport(0, -12.5, Math.PI, { pitch: 0.45, dist: 4.5, hint: false });
    await keys(['w'], 1500);
    await sleep(600);
    await shot('20-inside');
    await page.keyboard.press('e');
    await sleep(700);
    await shot('21-after-e');
    await measureFps('eyes');
  }
  if (name === 'door') {
    await teleport(8.2, -3, Math.PI * 0.5, { pitch: 0.45, dist: 4.5, hint: false });
    await keys(['w'], 1500);
    await sleep(600);
    await shot('30-inside');
    await page.keyboard.press('e');
    await sleep(700);
    await shot('31-after-e');
    await measureFps('door');
  }
};
if (SCENARIO === 'all') for (const s of ['tour', 'window', 'eyes', 'door']) await run(s);
else await run(SCENARIO);

/* the HUD's own state, for the record */
report.hud = await page.evaluate(() => {
  const d = window.__dlg;
  if (!d) return null;
  const s = d.hud.get();
  return { prompt: s.prompt, room: s.room, line: s.line?.text ?? null, speech: s.speech?.text ?? null, choice: s.choice?.title ?? null,
    player: { x: +d.world.player.pos.x.toFixed(2), y: +d.world.player.pos.y.toFixed(2), z: +d.world.player.pos.z.toFixed(2), house: d.world.player.house } };
});
} catch (e) {
  report.failed = String(e.message || e);
  try { await shot('99-failed'); } catch { /* fine */ }
}
report.errors = [...new Set(report.errors)];
report.warnings = [...new Set(report.warnings)].filter((w) => !/React DevTools|Download the React/.test(w));
await browser.close();
console.log(JSON.stringify(report, null, 2));
