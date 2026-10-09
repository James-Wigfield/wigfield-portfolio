/* ============================================================================
   PSMA MOTION — frame capture and encode
   ----------------------------------------------------------------------------
   Drives /portal/psma-motion?stage=1 in local Chrome (puppeteer-core), seeks the
   GSAP timeline frame by frame through window.__psmaMotion, screenshots each
   frame losslessly, and encodes H.264 MP4s with the static ffmpeg from the
   motion venv (imageio-ffmpeg). Needs `npm run dev` running on --base.

     node tools/psma-motion/capture.mjs probe                 renderer, beats, durations
     node tools/psma-motion/capture.mjs shots --at A:3.5,B:20 single frames (+ layout/marker JSON)
     node tools/psma-motion/capture.mjs holds                 every beat's hold frame + layout, markers
                                                              and on-stage numbers (gates G7, G8)
     node tools/psma-motion/capture.mjs sheets                frames for the critics' contact sheets
                                                              and transition strips (960 x 540)
     node tools/psma-motion/capture.mjs video [--preview]     per-beat + full MP4s and posters

   Options: --base http://localhost:5179  --out <dir>  --fps 60  --look clinical|dark
            --slots A,B  --preview (960 x 540 at 30 fps, for critic rounds)
   Frames go straight into a lossless master (libx264rgb -qp 0) through a pipe, so
   no PNG sequence is left on disk; the MP4s are cut from the master by frame
   number, so each beat clip's last frame is the next clip's first frame.
   The portal gate is a client-side check for a session object in sessionStorage;
   capture seeds one. No credential is stored here.
   ========================================================================== */
import puppeteer from 'puppeteer-core';
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const FFMPEG_PY = 'C:\\Users\\james\\.venvs\\motion\\Scripts\\python.exe';

const argv = process.argv.slice(2);
const mode = argv[0] ?? 'probe';
const opt = (name, dflt) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : dflt;
};
const flag = (name) => argv.includes(`--${name}`);
const BASE = opt('base', 'http://localhost:5179');
const LOOK = opt('look', '');
const PREVIEW = flag('preview') || mode === 'sheets';
const FPS = Number(opt('fps', PREVIEW ? 30 : 60));
const VIEW = PREVIEW ? { width: 960, height: 540 } : { width: 1920, height: 1080 };
const OUT = path.resolve(opt('out', path.join(os.tmpdir(), 'psma-motion-capture')));
const SLOTS = opt('slots', 'A,B').split(',');
const BEAT_STEM = { scan: '1-scan', model: '2-model', ensemble: '2b-ensemble', threshold: '2c-threshold',
  prediction: '3-prediction', truth: '4-ground-truth', accuracy: '5-accuracy' };
// file stem of a beat: the model beat is 2a when the case also stops on the ensemble (case A)
const stemOf = (b, beats) => (b.name === 'model' && beats.some((x) => x.name === 'ensemble') ? '2a-model' : BEAT_STEM[b.name]);

function ffmpegPath() {
  const r = spawnSync(FFMPEG_PY, ['-c', 'import imageio_ffmpeg as i; print(i.get_ffmpeg_exe())'], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`imageio-ffmpeg not found in the motion venv: ${r.stderr}`);
  return r.stdout.trim();
}

function run(ffmpeg, args) {
  const r = spawnSync(ffmpeg, ['-y', '-loglevel', 'error', ...args], { encoding: 'utf8', maxBuffer: 1 << 26 });
  if (r.status !== 0) throw new Error(`ffmpeg ${args.join(' ')}\n${r.stderr}`);
}

async function openStage() {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    protocolTimeout: 600000,
    args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--force-color-profile=srgb',
      '--disable-lcd-text', '--font-render-hinting=none', '--hide-scrollbars', '--mute-audio'],
    defaultViewport: { ...VIEW, deviceScaleFactor: 1 },
  });
  const page = await browser.newPage();
  page.on('console', (m) => { if (['error', 'warn'].includes(m.type())) console.log(`[page ${m.type()}] ${m.text()}`); });
  page.on('pageerror', (e) => console.log(`[page error] ${e.message}`));
  await page.evaluateOnNewDocument(() => {
    sessionStorage.setItem('portal_auth', JSON.stringify({ token: 'frame-capture', issued_at: new Date().toISOString() }));
  });
  const url = `${BASE}/portal/psma-motion?stage=1${LOOK ? `&look=${LOOK}` : ''}`;
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction(() => window.__psmaMotion && window.__psmaMotion.ready, { timeout: 120000 });
  await page.evaluate(() => window.__psmaMotion.ready);
  const info = await page.evaluate(() => {
    const h = window.__psmaMotion;
    const c = document.createElement('canvas').getContext('webgl2');
    const ext = c && c.getExtension('WEBGL_debug_renderer_info');
    return {
      renderer: ext ? c.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'unknown',
      look: h.look,
      caseIds: h.caseIds,
      cases: h.cases.map((s) => ({ slot: s, duration: h.duration(s), beats: h.beats(s), cues: h.cues(s) })),
    };
  });
  return { browser, page, info };
}

const seek = (page, slot, t) => page.evaluate((s, tt) => window.__psmaMotion.seek(s, tt), slot, t);
const grab = (page, file) => page.screenshot({ path: file, type: 'png', optimizeForSpeed: !file });

async function frameMeta(page, slot) {
  const json = await page.evaluate((s) => {
    // visible text with numbers, and the manifest key each number is bound to
    const stage = document.querySelector('.psm-stage');
    const visible = (el) => {
      let o = 1;
      for (let e = el; e && e !== stage.parentElement; e = e.parentElement) {
        o *= parseFloat(getComputedStyle(e).opacity || '1');
      }
      return o;
    };
    const texts = [];
    const walker = document.createTreeWalker(stage, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const txt = n.textContent;
      if (!/\d/.test(txt)) continue;
      const host = n.parentElement;
      // every number in the stage DOM, visible or not (all text is mounted for the whole
      // timeline and faded by opacity), with its manifest key and whether it shows now
      const o = visible(host);
      const keyed = host.closest('[data-k]');
      texts.push({ text: txt, key: keyed ? keyed.getAttribute('data-k') : null,
        opacity: Math.round(o * 1000) / 1000, visible: o >= 0.05 });
    }
    return JSON.stringify({ layout: window.__psmaMotion.layout(s), marks: window.__psmaMotion.marks(),
      state: window.__psmaMotion.state(s), colours: window.__psmaMotion.colours(), texts });
  }, slot);
  return JSON.parse(json);
}

async function captureMaster(page, ffmpeg, slot, duration, file) {
  const n = Math.round(duration * FPS) + 1;
  const ff = spawn(ffmpeg, ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png',
    '-i', '-', '-c:v', 'libx264rgb', '-qp', '0', '-preset', 'ultrafast', '-pix_fmt', 'rgb24', file],
  { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((res, rej) => ff.on('close', (c) => (c === 0 ? res() : rej(new Error(`ffmpeg exit ${c}`)))));
  const t0 = Date.now();
  for (let k = 0; k < n; k++) {
    await seek(page, slot, k / FPS);
    const buf = await grab(page, null);
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
    if (k % 300 === 0) console.log(`  ${slot} frame ${k}/${n}  ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  }
  ff.stdin.end();
  await done;
  return n;
}

function cutClips(ffmpeg, master, slot, beats, outDir, tag) {
  const enc = ['-c:v', 'libx264', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-crf', '14', '-preset', 'slow',
    '-x264-params', 'colorprim=bt709:transfer=bt709:colormatrix=bt709:fullrange=off',
    '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
    '-r', String(FPS), '-fps_mode', 'cfr', '-movflags', '+faststart', '-an'];
  const conv = 'scale=trunc(iw/2)*2:trunc(ih/2)*2:out_color_matrix=bt709:out_range=tv,format=yuv420p';
  const base = `case-${slot.toLowerCase()}`;
  const made = [];
  run(ffmpeg, ['-i', master, '-vf', conv, ...enc, path.join(outDir, `${base}-full${tag}.mp4`)]);
  made.push(`${base}-full${tag}.mp4`);
  for (const b of beats) {
    const s = Math.round(b.start * FPS);
    const e = Math.round(b.end * FPS);
    const name = `${base}-${stemOf(b, beats)}${tag}`;
    run(ffmpeg, ['-i', master, '-vf', `trim=start_frame=${s}:end_frame=${e + 1},setpts=PTS-STARTPTS,${conv}`,
      ...enc, path.join(outDir, `${name}.mp4`)]);
    run(ffmpeg, ['-i', master, '-vf', `trim=start_frame=${e}:end_frame=${e + 1}`, '-frames:v', '1',
      path.join(outDir, `${name}.png`)]);
    made.push(`${name}.mp4`, `${name}.png`);
  }
  return made;
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const { browser, page, info } = await openStage();
  console.log(JSON.stringify({ renderer: info.renderer, look: info.look, caseIds: info.caseIds, view: VIEW, fps: FPS }));
  const beatsOf = (slot) => info.cases.find((c) => c.slot === slot).beats;
  const durOf = (slot) => info.cases.find((c) => c.slot === slot).duration;
  try {
    if (mode === 'probe') {
      console.log(JSON.stringify(info.cases, null, 1));
    } else if (mode === 'shots') {
      for (const item of opt('at', 'A:0').split(',')) {
        const [slot, t] = item.split(':');
        const file = path.join(OUT, `${LOOK || info.look}-${slot}-${Number(t).toFixed(2)}.png`);
        await seek(page, slot, Number(t));
        await grab(page, file);
        fs.writeFileSync(file.replace(/\.png$/, '.json'), JSON.stringify(await frameMeta(page, slot), null, 1));
        console.log(file);
      }
    } else if (mode === 'holds') {
      const index = [];
      for (const slot of SLOTS) {
        for (const b of beatsOf(slot)) {
          const file = path.join(OUT, `hold-${slot}-${stemOf(b, beatsOf(slot))}.png`);
          await seek(page, slot, b.end);
          await grab(page, file);
          const meta = await frameMeta(page, slot);
          fs.writeFileSync(file.replace(/\.png$/, '.json'), JSON.stringify({ slot, caseId: info.caseIds[slot],
            beat: b.name, t: b.end, view: VIEW, ...meta }, null, 1));
          index.push({ slot, beat: b.name, t: b.end, png: path.basename(file) });
          console.log(file);
        }
      }
      fs.writeFileSync(path.join(OUT, 'holds.json'), JSON.stringify({ caseIds: info.caseIds, look: info.look, holds: index }, null, 1));
    } else if (mode === 'sheets') {
      // one frame every 0.5 s per beat, plus 8 consecutive frames across every beat
      // boundary and every major move (times from the timeline's own cues); composed into
      // sheets by make_sheets.py
      const cuesOf = (slot) => info.cases.find((c) => c.slot === slot).cues;
      const moves = Object.fromEntries(SLOTS.map((s) => [s, [['glide', cuesOf(s).glide], ['threshold', cuesOf(s).threshold],
        ['verdict', cuesOf(s).verdict - 0.1], ['card', cuesOf(s).card]]]));
      const manifest = { caseIds: info.caseIds, look: info.look, fps: FPS, frames: [] };
      for (const slot of SLOTS) {
        const beats = beatsOf(slot);
        for (const b of beats) {
          for (let t = b.start; t <= b.end + 1e-6; t += 0.5) {
            const tt = Math.min(b.end, Math.round(t * 1000) / 1000);
            const file = `sheet-${slot}-${stemOf(b, beats)}-${tt.toFixed(2)}.png`;
            await seek(page, slot, tt);
            await grab(page, path.join(OUT, file));
            manifest.frames.push({ kind: 'sheet', slot, beat: b.name, t: tt, file });
          }
          if (Math.abs(beats[beats.length - 1].end - b.end) > 1e-6) {
            for (let k = -4; k < 4; k++) {
              const tt = b.end + k / FPS;
              const file = `strip-${slot}-${stemOf(b, beats)}-end-${String(k + 4)}.png`;
              await seek(page, slot, tt);
              await grab(page, path.join(OUT, file));
              manifest.frames.push({ kind: 'strip', slot, at: `${b.name} -> next`, t: tt, file });
            }
          }
        }
        for (const [name, at] of moves[slot] ?? []) {
          for (let k = 0; k < 8; k++) {
            const tt = at + (k * 3) / FPS;
            const file = `strip-${slot}-move-${name}-${k}.png`;
            await seek(page, slot, tt);
            await grab(page, path.join(OUT, file));
            manifest.frames.push({ kind: 'strip', slot, at: `move ${name} (every 3rd frame)`, t: tt, file });
          }
        }
      }
      fs.writeFileSync(path.join(OUT, 'frames.json'), JSON.stringify(manifest, null, 1));
      console.log(`${manifest.frames.length} frames in ${OUT}`);
    } else if (mode === 'video') {
      const ffmpeg = ffmpegPath();
      const tag = PREVIEW ? '-preview' : '';
      const made = [];
      for (const slot of SLOTS) {
        const master = path.join(OUT, `master-${slot}${tag}.mkv`);
        const t0 = Date.now();
        const n = await captureMaster(page, ffmpeg, slot, durOf(slot), master);
        console.log(`${slot}: ${n} frames in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
        made.push(...cutClips(ffmpeg, master, slot, beatsOf(slot), OUT, tag));
      }
      fs.writeFileSync(path.join(OUT, `clips${tag}.json`), JSON.stringify({ caseIds: info.caseIds, look: info.look,
        fps: FPS, view: VIEW, beats: Object.fromEntries(SLOTS.map((s) => [s, beatsOf(s)])), files: made }, null, 1));
      console.log(made.join('\n'));
    } else {
      throw new Error(`unknown mode ${mode}`);
    }
  } finally {
    await browser.close();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
