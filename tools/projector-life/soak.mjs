/* ============================================================================
   PROJECTOR LIFE — soak: the default preset for ~5 min, then every preset
   for ~20 s each, sampled every 10 s
   ----------------------------------------------------------------------------
     node tools/projector-life/soak.mjs [outDir]          (dev server on 5191)
     SOAK_MIN=5 CYCLE_S=20 SAMPLE_S=10 UNCAPPED=1 node tools/projector-life/soak.mjs
   outDir defaults to Documents/projector-life/screenshots/soak:
     soak.csv     one row per sample (phase, preset, t, fps, frameMs, simMs, tickMs,
                  ticks/s, geometries, textures, programs, heapMB, creatures, particles)
     soak.json    the samples + the summary
   Flags (exit 1 on any): monotonic growth of geometries / textures / programs
   over the default-preset run, JS heap growth > 2 MB/min (least squares, after
   a forced GC each sample), fps decay > 15 % (first vs last minute), any
   sample < 45 fps on the default preset or < 20 fps on any preset, console
   errors / warnings, NaN in the life stats.
   ========================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import { REPO, PRESETS, launch, openPage, applyPreset, waitCamera, memSample, splitNoise, sleep, fmt } from './qa-kit.mjs';

const OUT = path.resolve(process.argv[2] || path.join(REPO, 'Documents/projector-life/screenshots/soak'));
const SOAK_MIN = Number(process.env.SOAK_MIN || 5);
const CYCLE_S = Number(process.env.CYCLE_S || 20);
const SAMPLE_S = Number(process.env.SAMPLE_S || 10);
fs.mkdirSync(OUT, { recursive: true });

const LOG = [];
const samples = [];
const browser = await launch();
const t0 = Date.now();

/** fps over the last window from the page's own rAF counter, plus the Stage + life numbers. */
async function sample(page, phase, preset) {
  const s = await page.evaluate(() => {
    const fc = window.__pjlFrames;
    const st = window.__pjlStage;
    const now = performance.now();
    const prev = window.__soakPrev || { n: fc.n, t: now, tick: 0 };
    const life = st.life.stats();
    const out = {
      fps: ((fc.n - prev.n) * 1000) / Math.max(1, now - prev.t),
      ticksPerSec: ((life.tick - prev.tick) * 1000) / Math.max(1, now - prev.t),
      stageFps: st.fps,
      frameMs: st.frameMs,
      simMs: life.simMs,
      tickMs: life.tickMs,
      creatures: life.creatures.alive,
      particles: (life.particles?.floor || 0) + (life.particles?.wall || 0) + (life.particles?.ceiling || 0),
      nan: [life.simMs, life.tickMs, life.creatures.alive].some((v) => typeof v === 'number' && Number.isNaN(v)),
    };
    window.__soakPrev = { n: fc.n, t: now, tick: life.tick };
    return out;
  });
  const m = await memSample(page);
  // memSample's GC takes a few ms; restart the fps window after it so the GC isn't counted
  await page.evaluate(() => {
    const st = window.__pjlStage;
    window.__soakPrev = { n: window.__pjlFrames.n, t: performance.now(), tick: st.life.stats().tick };
  });
  const row = { phase, preset, t: Math.round((Date.now() - t0) / 1000), ...s, ...m };
  samples.push(row);
  console.log(`${String(row.t).padStart(4)} s  ${phase.padEnd(7)} ${preset.padEnd(16)} ${fmt(row.fps).padStart(6)} fps  frame ${fmt(row.frameMs, 2)} ms  sim ${fmt(row.simMs, 2)} ms  tick ${fmt(row.tickMs, 2)} ms  geo ${row.geometries} tex ${row.textures} prog ${row.programs}  heap ${fmt(row.heapMB)} MB  cr ${row.creatures} pts ${row.particles}`);
  return row;
}

/** least-squares slope of y over x */
function slope(xs, ys) {
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    den += (xs[i] - mx) ** 2;
  }
  return den ? num / den : 0;
}
const monotonicUp = (ys) => ys.length > 2 && ys[ys.length - 1] > ys[0] && ys.every((v, i) => i === 0 || v >= ys[i - 1]);

let summary;
try {
  const { page } = await openPage(browser, { theme: 'arcade', width: 1440, height: 900, tag: 'soak', sink: LOG });
  await sleep(2000);
  await page.evaluate(() => {
    delete window.__soakPrev;
  });
  await sample(page, 'warmup', PRESETS[0].id);
  // ── default preset, SOAK_MIN minutes ─────────────────────────────────────
  const end = Date.now() + SOAK_MIN * 60000;
  while (Date.now() < end) {
    await sleep(SAMPLE_S * 1000);
    await sample(page, 'default', PRESETS[0].id);
  }
  // ── every preset, CYCLE_S each ───────────────────────────────────────────
  for (const p of PRESETS) {
    await applyPreset(page, p);
    await waitCamera(page);
    await page.evaluate(() => {
      delete window.__soakPrev;
    });
    await sample(page, 'switch', p.id); // resets the window; this row's fps spans the switch
    const pe = Date.now() + CYCLE_S * 1000;
    while (Date.now() < pe) {
      await sleep(SAMPLE_S * 1000);
      await sample(page, 'cycle', p.id);
    }
  }
  // back to the default: renderer.info should be where it was
  await applyPreset(page, PRESETS[0]);
  await waitCamera(page);
  await sleep(SAMPLE_S * 1000);
  await sample(page, 'return', PRESETS[0].id);
  await page.close();
} finally {
  await browser.close();
}

// ── summary ─────────────────────────────────────────────────────────────────
const def = samples.filter((s) => s.phase === 'default');
const mins = def.map((s) => s.t / 60);
const firstMin = def.filter((s) => s.t - def[0].t < 60);
const lastMin = def.filter((s) => def[def.length - 1].t - s.t < 60);
const avg = (a, k) => a.reduce((x, s) => x + s[k], 0) / Math.max(1, a.length);
const flags = [];
for (const k of ['geometries', 'textures', 'programs']) {
  const ys = def.map((s) => s[k]);
  if (monotonicUp(ys)) flags.push(`${k} grow monotonically on the default preset: ${ys[0]} → ${ys[ys.length - 1]}`);
}
const heapSlope = slope(mins, def.map((s) => s.heapMB));
if (heapSlope > 2) flags.push(`JS heap grows ${heapSlope.toFixed(2)} MB/min on the default preset`);
const fpsDecay = 1 - avg(lastMin, 'fps') / avg(firstMin, 'fps');
if (fpsDecay > 0.15) flags.push(`fps decays ${(fpsDecay * 100).toFixed(0)} % (first vs last minute)`);
const simSlope = slope(mins, def.map((s) => s.simMs));
const lowDef = def.filter((s) => s.fps < 45);
if (lowDef.length) flags.push(`${lowDef.length} default-preset samples < 45 fps (min ${fmt(Math.min(...lowDef.map((s) => s.fps)))})`);
const cyc = samples.filter((s) => s.phase === 'cycle');
const lowCyc = cyc.filter((s) => s.fps < 20);
if (lowCyc.length) flags.push(`${lowCyc.length} preset samples < 20 fps`);
if (samples.some((s) => s.nan)) flags.push('NaN in the life stats');
const first = samples.find((s) => s.phase === 'warmup');
const ret = samples.find((s) => s.phase === 'return');
if (ret && first && (ret.geometries > first.geometries || ret.textures > first.textures)) flags.push(`after a full preset cycle the default preset holds more GPU objects: geo ${first.geometries} → ${ret.geometries}, tex ${first.textures} → ${ret.textures}`);
const { kept, excluded } = splitNoise(LOG);
if (kept.length) flags.push(`${kept.length} console errors / warnings: ${kept.slice(0, 3).map((m) => m.text.slice(0, 120)).join(' || ')}`);

const perPreset = PRESETS.map((p) => {
  const rs = cyc.filter((s) => s.preset === p.id);
  return { id: p.id, fps: avg(rs, 'fps'), minFps: Math.min(...rs.map((s) => s.fps)), frameMs: avg(rs, 'frameMs'), simMs: avg(rs, 'simMs'), tickMs: avg(rs, 'tickMs'), geometries: rs.at(-1)?.geometries, textures: rs.at(-1)?.textures, programs: rs.at(-1)?.programs };
});
summary = {
  when: new Date().toISOString(),
  config: { SOAK_MIN, CYCLE_S, SAMPLE_S, uncapped: process.env.UNCAPPED === '1' },
  default: {
    samples: def.length,
    minutes: def.length ? (def[def.length - 1].t - def[0].t) / 60 : 0,
    fps: { mean: avg(def, 'fps'), min: Math.min(...def.map((s) => s.fps)), firstMin: avg(firstMin, 'fps'), lastMin: avg(lastMin, 'fps'), decayPct: fpsDecay * 100 },
    frameMs: avg(def, 'frameMs'),
    simMs: { mean: avg(def, 'simMs'), slopePerMin: simSlope },
    tickMs: avg(def, 'tickMs'),
    heapMB: { first: def[0]?.heapMB, last: def.at(-1)?.heapMB, slopePerMin: heapSlope },
    renderer: { geometries: [def[0]?.geometries, def.at(-1)?.geometries], textures: [def[0]?.textures, def.at(-1)?.textures], programs: [def[0]?.programs, def.at(-1)?.programs] },
    creatures: [def[0]?.creatures, def.at(-1)?.creatures],
    particles: [def[0]?.particles, def.at(-1)?.particles],
  },
  perPreset,
  returnToDefault: ret && first ? { geometries: [first.geometries, ret.geometries], textures: [first.textures, ret.textures], programs: [first.programs, ret.programs], heapMB: [first.heapMB, ret.heapMB] } : null,
  console: { kept: kept.length, excluded: excluded.length },
  flags,
};

const cols = ['phase', 'preset', 't', 'fps', 'stageFps', 'frameMs', 'simMs', 'tickMs', 'ticksPerSec', 'geometries', 'textures', 'programs', 'heapMB', 'creatures', 'particles'];
const csv = [cols.join(','), ...samples.map((s) => cols.map((c) => (typeof s[c] === 'number' ? +s[c].toFixed(3) : s[c])).join(','))].join('\n');
fs.writeFileSync(path.join(OUT, 'soak.csv'), csv);
fs.writeFileSync(path.join(OUT, 'soak.json'), JSON.stringify({ summary, samples }, null, 2));

const d = summary.default;
console.log(`\nSOAK  default ${d.minutes.toFixed(1)} min: fps mean ${fmt(d.fps.mean)} (min ${fmt(d.fps.min)}; first min ${fmt(d.fps.firstMin)} → last ${fmt(d.fps.lastMin)}, decay ${fmt(d.fps.decayPct)} %), frame ${fmt(d.frameMs, 2)} ms, sim ${fmt(d.simMs.mean, 2)} ms (${d.simMs.slopePerMin >= 0 ? '+' : ''}${fmt(d.simMs.slopePerMin, 3)} ms/min), heap ${fmt(d.heapMB.first)} → ${fmt(d.heapMB.last)} MB (${fmt(d.heapMB.slopePerMin, 2)} MB/min), geo ${d.renderer.geometries.join('→')} tex ${d.renderer.textures.join('→')} prog ${d.renderer.programs.join('→')}`);
for (const p of perPreset) console.log(`      ${p.id.padEnd(16)} ${fmt(p.fps).padStart(6)} fps (min ${fmt(p.minFps)})  frame ${fmt(p.frameMs, 2)} ms  sim ${fmt(p.simMs, 2)} ms  tick ${fmt(p.tickMs, 2)} ms  geo ${p.geometries} tex ${p.textures} prog ${p.programs}`);
console.log(flags.length ? `\nFLAGS (${flags.length}):\n  ${flags.join('\n  ')}` : '\nno flags');
console.log(`(${OUT})`);
process.exit(flags.length ? 1 : 0);
