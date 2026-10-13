/* ============================================================================
   PSMA APP GUIDE — frame capture and encode
   ----------------------------------------------------------------------------
   Drives /portal/psma-app-guide?stage=1 in local Chrome (puppeteer-core), seeks
   the GSAP timeline frame by frame through window.__psmaAppGuide, screenshots
   each frame losslessly and encodes the MP4 with the static ffmpeg from the
   motion venv (imageio-ffmpeg). Needs `npm run dev` running on --base.

     node tools/psma-app-guide/capture.mjs probe                 duration, chapters, renderer
     node tools/psma-app-guide/capture.mjs shots --at 1.6,67    single frames (+ state JSON)
     node tools/psma-app-guide/capture.mjs sheets               frames for the critics' contact sheets and
                                                                transition strips (960 x 540)
     node tools/psma-app-guide/capture.mjs video [--preview]    lossless master + H.264 MP4
     node tools/psma-app-guide/capture.mjs video --frames 0:4007 --tag p1
                                                                one part of the master, for parallel
                                                                workers (frames [a, b) at the final rate)
     node tools/psma-app-guide/capture.mjs join --parts p1,p2   the parts -> master.mkv, diffs.json, MP4
     node tools/psma-app-guide/capture.mjs encode --crf 20      the MP4 again from master.mkv

   Options: --base http://localhost:5179  --out <dir>  --fps 30  --script style|full
            --crf 18  --preview (960 x 540, every other frame of the final rate)
   Frames go straight into a lossless master (libx264rgb -qp 0) through a pipe,
   so no PNG sequence is left on disk. The portal gate is a client-side check for
   a session object in sessionStorage; capture seeds one. No credential is
   stored here.
   ========================================================================== */
import puppeteer from 'puppeteer-core';
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const FFMPEG = 'C:\\Users\\james\\.venvs\\motion\\Lib\\site-packages\\imageio_ffmpeg\\binaries\\ffmpeg-win-x86_64-v7.1.exe';
const PYTHON = 'python'; // Windows Python with Pillow + numpy (mix_frames.py)
const MIXER = path.join(path.dirname(fileURLToPath(import.meta.url)), 'mix_frames.py');

const argv = process.argv.slice(2);
const mode = argv[0] ?? 'probe';
const opt = (name, dflt) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : dflt;
};
const flag = (name) => argv.includes(`--${name}`);
const BASE = opt('base', 'http://localhost:5179');
const SCRIPT = opt('script', 'full');
const PREVIEW = flag('preview') || mode === 'sheets';
const FPS = Number(opt('fps', 30));
const STEP = PREVIEW && mode === 'video' ? 2 : 1; // preview: every other frame
const BLUR = !flag('no-blur');
const FRAMES = opt('frames', null); // 'a:b': render only output frames [a, b) (a part, see join)
const TAG = opt('tag', '');
const VIEW = PREVIEW ? { width: 960, height: 540 } : { width: 1920, height: 1080 };
const OUT = path.resolve(opt('out', path.join(os.tmpdir(), 'psma-app-guide-capture')));

function run(args) {
  const r = spawnSync(FFMPEG, ['-y', '-loglevel', 'error', ...args], { encoding: 'utf8', maxBuffer: 1 << 26 });
  if (r.status !== 0) throw new Error(`ffmpeg ${args.join(' ')}\n${r.stderr}`);
}

async function openStage() {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    protocolTimeout: 900000,
    args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--force-color-profile=srgb',
      '--disable-lcd-text', '--font-render-hinting=none', '--hide-scrollbars', '--mute-audio'],
    defaultViewport: { width: 1920, height: 1080, deviceScaleFactor: 1 },
  });
  const page = await browser.newPage();
  page.on('console', (m) => { if (['error', 'warn'].includes(m.type())) console.log(`[page ${m.type()}] ${m.text()}`); });
  page.on('pageerror', (e) => console.log(`[page error] ${e.message}`));
  await page.evaluateOnNewDocument(() => {
    sessionStorage.setItem('portal_auth', JSON.stringify({ token: 'frame-capture', issued_at: new Date().toISOString() }));
  });
  const url = `${BASE}/portal/psma-app-guide?stage=1${SCRIPT === 'style' ? '&script=style' : ''}`;
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction(() => (window.__psmaAppGuide && window.__psmaAppGuide.ready) || window.__psmaAppGuideStatus?.error,
    { timeout: 180000 });
  const err = await page.evaluate(() => window.__psmaAppGuideStatus?.error);
  if (err) throw new Error(`stage failed to load: ${err}`);
  await page.evaluate(() => window.__psmaAppGuide.ready);
  // the stage is drawn at 1920 x 1080; a preview view scales the whole page down
  if (PREVIEW) await page.setViewport({ ...VIEW, deviceScaleFactor: 1 });
  const info = await page.evaluate(() => {
    const h = window.__psmaAppGuide;
    const c = document.createElement('canvas').getContext('webgl2');
    const ext = c && c.getExtension('WEBGL_debug_renderer_info');
    return { renderer: ext ? c.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'unknown', script: h.script,
      duration: h.duration, chapters: h.chapters };
  });
  return { browser, page, info };
}

const seek = (page, t) => page.evaluate((tt) => window.__psmaAppGuide.seek(tt), t);
const grab = (page, file) => page.screenshot({ path: file, type: 'png', optimizeForSpeed: !file });

async function frameMeta(page) {
  // stringified in the page: the state can hold values JSON has no exact form for
  return JSON.parse(await page.evaluate(() => {
    const h = window.__psmaAppGuide;
    return JSON.stringify({ state: h.state(), camera: h.camera(), cursor: h.cursor(), files: h.files() });
  }));
}

/**
 * Every output frame goes to mix_frames.py as a group of screenshots: one for a still frame;
 * where the camera, the curtain, the cursor or a scroll moves, 2-8 sub-frame samples across a
 * 180-degree shutter, which the mixer averages (motion blur, critic C2). A cut or a step of a
 * captured frame sequence inside the shutter gets one sample: two captured app states are
 * never blended into one frame. The mixer writes the lossless master and the frame differences.
 */
async function captureMaster(page, duration, file, diffsFile) {
  const n = Math.round(duration * FPS) + 1;
  const outFps = FPS / STEP;
  const half = STEP / (4 * FPS); // half a 180-degree shutter at the output rate
  const mixer = spawn(PYTHON, ['-B', MIXER, '--ffmpeg', FFMPEG, '--out', file, '--fps', String(outFps),
    '--size', `${VIEW.width}x${VIEW.height}`, '--diffs', diffsFile],
  { stdio: ['pipe', 'inherit', 'inherit'], env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' } });
  const done = new Promise((res, rej) => mixer.on('close', (c) => (c === 0 ? res() : rej(new Error(`mixer exit ${c}`)))));
  const send = async (buf) => { if (!mixer.stdin.write(buf)) await new Promise((r) => mixer.stdin.once('drain', r)); };
  const u32 = (v) => { const b = Buffer.alloc(4); b.writeUInt32LE(v); return b; };
  const t0 = Date.now();
  let written = 0;
  let blurred = 0;
  const [k0, k1] = FRAMES ? FRAMES.split(':').map(Number) : [0, n];
  for (let k = k0; k < Math.min(k1, n); k += STEP) {
    const t = k / FPS;
    let samples = [t];
    let frozen = false;
    if (BLUR) {
      const m = await page.evaluate((a, b) => window.__psmaAppGuide.motion(a, b), Math.max(0, t - half), t + half);
      if (m.move > 1.5) {
        // about one sample per 4 stage px of travel within the shutter, up to 32 (C2)
        const s = Math.min(32, Math.max(2, Math.ceil(m.move / 4)));
        samples = Array.from({ length: s }, (_, i) => Math.max(0, t - half + ((i + 0.5) * 2 * half) / s));
        frozen = m.cut; // a cut or sequence step inside the shutter: hold the app's state at t
        blurred += 1;
      }
    }
    await send(u32(samples.length));
    for (const ts of samples) {
      if (frozen) await page.evaluate((a, b) => window.__psmaAppGuide.seekFrozen(a, b), ts, t);
      else await seek(page, ts);
      const buf = await grab(page, null);
      await send(u32(buf.length));
      await send(buf);
    }
    written += 1;
    if (written % 300 === 0) console.log(`  frame ${k}/${n}  ${((Date.now() - t0) / 1000).toFixed(0)} s  (${blurred} blurred)`);
  }
  await send(u32(0));
  mixer.stdin.end();
  await done;
  return { written, blurred };
}

function encode(master, out, crf, fps) {
  const conv = 'scale=trunc(iw/2)*2:trunc(ih/2)*2:out_color_matrix=bt709:out_range=tv,format=yuv420p';
  run(['-i', master, '-vf', conv, '-c:v', 'libx264', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-crf', String(crf),
    '-preset', 'slow', '-x264-params', 'colorprim=bt709:transfer=bt709:colormatrix=bt709:fullrange=off',
    '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
    '-r', String(fps), '-fps_mode', 'cfr', '-movflags', '+faststart', '-an', out]);
}

// one decoded frame (rgb24) from a lossless master
function rawFrames(args) {
  const r = spawnSync(FFMPEG, ['-loglevel', 'error', ...args, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { maxBuffer: 1 << 28 });
  if (r.status !== 0) throw new Error(`ffmpeg ${args.join(' ')}\n${r.stderr}`);
  return r.stdout;
}

/** The mixer's frame difference (mean |a - b| over every 4th row and column) across a part boundary. */
function boundaryDiff(a, b) {
  const { width: w, height: h } = VIEW;
  const size = w * h * 3;
  const tail = rawFrames(['-sseof', '-0.2', '-i', a]);
  const A = tail.subarray(tail.length - size);
  const B = rawFrames(['-i', b, '-frames:v', '1']).subarray(0, size);
  if (A.length !== size || B.length !== size) throw new Error('boundary frames missing');
  let sum = 0;
  let count = 0;
  for (let y = 0; y < h; y += 4) {
    for (let x = 0; x < w; x += 4) {
      const i = (y * w + x) * 3;
      for (let c = 0; c < 3; c++) { sum += Math.abs(A[i + c] - B[i + c]); count += 1; }
    }
  }
  return sum / count;
}

function countFrames(file) {
  const r = spawnSync(FFMPEG, ['-i', file, '-map', '0:v:0', '-c', 'copy', '-f', 'null', '-'], { encoding: 'utf8', maxBuffer: 1 << 26 });
  const m = [...(r.stderr || '').matchAll(/frame=\s*(\d+)/g)].pop();
  return m ? Number(m[1]) : -1;
}

function finish(master, info, tag) {
  const out = path.join(OUT, `how-to-use${tag}.mp4`);
  encode(master, out, Number(opt('crf', PREVIEW ? 23 : 18)), FPS / STEP);
  fs.writeFileSync(path.join(OUT, `chapters${tag}.json`), JSON.stringify({ fps: FPS / STEP, duration: info.duration,
    chapters: info.chapters }, null, 1));
  console.log(`${out}  ${(fs.statSync(out).size / 1e6).toFixed(2)} MB`);
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const { browser, page, info } = await openStage();
  console.log(JSON.stringify({ renderer: info.renderer, script: info.script, duration: info.duration, view: VIEW, fps: FPS }));
  try {
    if (mode === 'probe') {
      console.log(JSON.stringify(info.chapters, null, 1));
    } else if (mode === 'timeline') {
      // everything the gates check, from the timeline itself
      const tl = JSON.parse(await page.evaluate(() => {
        const h = window.__psmaAppGuide;
        return JSON.stringify({ duration: h.duration, chapters: h.chapters, cards: h.cards(), camMoves: h.camMoves(),
          clicks: h.clicks(), checks: h.checks(), captions: h.captions(), callouts: h.callouts(), layers: h.layers(),
          panels: h.panels() });
      }));
      const file = path.join(OUT, `timeline-${SCRIPT}.json`);
      fs.writeFileSync(file, JSON.stringify(tl, null, 1));
      console.log(file);
    } else if (mode === 'textboxes') {
      // every visible piece of stage text every 0.25 s (gates G4 and G5), and every image file shown (G1)
      const step = Number(opt('every', 0.25));
      const out = { every: step, boxes: [], files: [] };
      const files = new Set();
      for (let t = 0; t <= info.duration + 1e-6; t += step) {
        const tt = Math.round(t * 1000) / 1000;
        await seek(page, tt);
        const r = JSON.parse(await page.evaluate(() => JSON.stringify({
          boxes: window.__psmaAppGuide.textBoxes(), files: window.__psmaAppGuide.files() })));
        r.boxes.forEach((b) => out.boxes.push({ t: tt, ...b }));
        r.files.forEach((f) => files.add(f));
      }
      out.files = [...files].sort();
      const file = path.join(OUT, `textboxes-${SCRIPT}.json`);
      fs.writeFileSync(file, JSON.stringify(out));
      console.log(`${out.boxes.length} text boxes, ${out.files.length} image files -> ${file}`);
    } else if (mode === 'shots') {
      for (const item of opt('at', '0').split(',')) {
        const t = Number(item);
        const file = path.join(OUT, `${SCRIPT}-${t.toFixed(2)}.png`);
        await seek(page, t);
        await grab(page, file);
        fs.writeFileSync(file.replace(/\.png$/, '.json'), JSON.stringify(await frameMeta(page), null, 1));
        console.log(file);
      }
    } else if (mode === 'sheets') {
      // a frame every 0.5 s per chapter, and 8 consecutive frames across every chapter change
      const manifest = { script: info.script, fps: FPS, frames: [] };
      for (const c of info.chapters) {
        for (let t = c.start; t <= c.end + 1e-6; t += 0.5) {
          const tt = Math.min(c.end, Math.round(t * 1000) / 1000);
          const file = `sheet-${c.num}-${c.id}-${tt.toFixed(2)}.png`;
          await seek(page, tt);
          await grab(page, path.join(OUT, file));
          manifest.frames.push({ kind: 'sheet', chapter: c.id, num: c.num, t: tt, file });
        }
        for (let k = -2; k < 6; k++) {
          const tt = c.start + (k * 4) / FPS;
          if (tt < 0) continue;
          const file = `strip-${c.num}-${c.id}-${String(k + 2)}.png`;
          await seek(page, tt);
          await grab(page, path.join(OUT, file));
          manifest.frames.push({ kind: 'strip', chapter: c.id, num: c.num, t: tt, file, every: 4 });
        }
      }
      // and 8 frames across every big camera move (C2: the moves are where motion shows)
      const moves = JSON.parse(await page.evaluate(() => JSON.stringify(window.__psmaAppGuide.camMoves())));
      for (const mv of moves.filter((m) => m.dur >= 0.4)) {
        for (let k = 0; k < 8; k++) {
          const tt = Math.round((mv.at - 0.1 + ((mv.dur + 0.2) * k) / 7) * 1000) / 1000;
          const file = `move-${String(mv.k).padStart(2, '0')}-${k}.png`;
          await seek(page, tt);
          await grab(page, path.join(OUT, file));
          manifest.frames.push({ kind: 'move', move: mv.k, t: tt, file });
        }
      }
      fs.writeFileSync(path.join(OUT, 'frames.json'), JSON.stringify(manifest, null, 1));
      console.log(`${manifest.frames.length} frames in ${OUT}`);
    } else if (mode === 'video') {
      const tag = (PREVIEW ? '-preview' : '') + (TAG ? `-${TAG}` : '');
      const master = path.join(OUT, `master${tag}.mkv`);
      const t0 = Date.now();
      const { written, blurred } = await captureMaster(page, info.duration, master, path.join(OUT, `diffs${tag}.json`));
      console.log(`${written} frames (${blurred} with motion blur) in ${((Date.now() - t0) / 1000).toFixed(0)} s -> ${master}`);
      if (!FRAMES) finish(master, info, tag); // a part is encoded by `join`
    } else if (mode === 'join') {
      // parts rendered side by side (video --frames a:b --tag pN), in order: one lossless master
      // (stream copy, no re-encode), one diffs file (the boundary frames' difference recomputed
      // from the masters), then the MP4
      const tags = opt('parts', '').split(',').filter(Boolean);
      const masters = tags.map((t) => path.join(OUT, `master-${t}.mkv`));
      const list = path.join(OUT, 'parts.txt');
      fs.writeFileSync(list, masters.map((m) => `file '${m.replace(/\\/g, '/')}'`).join('\n') + '\n');
      const master = path.join(OUT, 'master.mkv');
      run(['-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', master]);
      const diffs = { fps: FPS, diff: [], samples: [] };
      tags.forEach((t, i) => {
        const d = JSON.parse(fs.readFileSync(path.join(OUT, `diffs-${t}.json`), 'utf8'));
        if (i > 0) {
          d.diff[0] = boundaryDiff(masters[i - 1], masters[i]);
          console.log(`  boundary ${tags[i - 1]} | ${t}: frame difference ${d.diff[0].toFixed(3)}`);
        }
        diffs.diff.push(...d.diff);
        diffs.samples.push(...d.samples);
      });
      const n = Math.round(info.duration * FPS) + 1;
      const frames = countFrames(master);
      if (diffs.diff.length !== n || frames !== n) throw new Error(`joined ${frames} frames (${diffs.diff.length} diffs), expected ${n}`);
      fs.writeFileSync(path.join(OUT, 'diffs.json'), JSON.stringify(diffs));
      console.log(`joined ${tags.length} parts: ${frames} frames -> ${master}`);
      finish(master, info, '');
    } else if (mode === 'encode') {
      finish(path.join(OUT, 'master.mkv'), info, '');
    } else {
      throw new Error(`unknown mode ${mode}`);
    }
  } finally {
    await browser.close();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
