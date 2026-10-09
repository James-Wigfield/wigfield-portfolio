/* ============================================================================
   PSMA MOTION — DATA LOADING
   ----------------------------------------------------------------------------
   Everything comes from /__psma-motion-data/, which only the dev server serves
   (vite.config.js, apply: 'serve'). Frames are decoded with no colour-space
   conversion or premultiplication, then handed to the WebGL stage and closed,
   so decoded bitmaps never pile up in memory.
   ========================================================================== */

export const DATA_ROOT = '/__psma-motion-data';

async function getJson(path) {
  const r = await fetch(`${DATA_ROOT}/${path}`, { cache: 'no-store' });
  if (!r.ok) throw new Error(`${path}: HTTP ${r.status}`);
  return r.json();
}

async function getBitmap(path) {
  const r = await fetch(`${DATA_ROOT}/${path}`, { cache: 'no-store' });
  if (!r.ok) throw new Error(`${path}: HTTP ${r.status}`);
  const blob = await r.blob();
  return createImageBitmap(blob, { colorSpaceConversion: 'none', premultiplyAlpha: 'none' });
}

/* A small anterior thumbnail for the depth inset, made from the packed angle-0 frame
   before its bitmap is released: white uptake on a faint body silhouette, transparent
   elsewhere, so it sits on either look's panel colour. */
function makeThumb(bm) {
  const w = Math.round(bm.width / 3);
  const h = Math.round(bm.height / 3);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(bm, 0, 0, w, h);
  const im = g.getImageData(0, 0, w, h);
  const d = im.data;
  for (let i = 0; i < d.length; i += 4) {
    const pet = Math.min(1, (d[i] / 255) * 1.6);
    const body = d[i + 1] > 0 ? 0.22 : 0;
    d[i] = 238;
    d[i + 1] = 241;
    d[i + 2] = 246;
    d[i + 3] = Math.round(255 * Math.max(body, pet));
  }
  g.putImageData(im, 0, 0);
  return c;
}

// Run async jobs with a fixed number in flight.
async function pool(jobs, limit, onDone) {
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, jobs.length) }, async () => {
    while (next < jobs.length) {
      const i = next++;
      await jobs[i]();
      onDone?.();
    }
  });
  await Promise.all(workers);
}

export async function loadIndex() {
  return getJson('index.json');
}

/* Load one case into the stage. `slot` is 'A' or 'B'. Returns the JSON data and
   the five fold cards + mean as ImageBitmaps (small; kept for canvas 2D). */
export async function loadCase(caseId, slot, gl, onProgress) {
  const [manifest, components, windows] = await Promise.all([
    getJson(`${caseId}/manifest.json`),
    getJson(`${caseId}/components.json`),
    getJson(`${caseId}/windows.json`),
  ]);
  const { width: W, height: H } = manifest.layer;
  const N = manifest.rotation.n_angles;
  // fold 0's replayed accumulator (tools/psma-motion/replay_accumulator.py), only if it
  // reproduced the saved fold-0 map; otherwise the sweep falls back to the gated reveal
  let accum = null;
  try {
    const r = await fetch(`${DATA_ROOT}/${caseId}/accum/report.json`, { cache: 'no-store' });
    if (r.ok) {
      const rep = await r.json();
      if (rep.accepted) accum = rep;
    }
  } catch {
    accum = null;
  }
  // one snapshot per window (current replay) or, from an older replay, per batch
  if (accum) accum.perWindow = Boolean(accum.snapshots);
  const nAcc = accum ? (accum.snapshots ?? accum.batches) : 0;
  gl.allocCase(slot, W, H, N, nAcc);

  const pad = (i) => String(i).padStart(3, '0');
  const total = 2 * N + 6 + nAcc;
  let done = 0;
  const tick = () => onProgress?.(++done, total);

  const jobs = [];
  let thumb = null;
  let mask0 = null;   // kept: the beat 4-5 marker cut-out is built from the angle-0 layer
  for (let i = 0; i < N; i++) {
    jobs.push(async () => {
      const bm = await getBitmap(`${caseId}/frames/rgb_${pad(i)}.png`);
      gl.upload(slot, 'rgb', i, bm);
      if (i === 0) thumb = makeThumb(bm);
      bm.close();
    });
    jobs.push(async () => {
      const bm = await getBitmap(`${caseId}/frames/mask_${pad(i)}.png`);
      gl.upload(slot, 'mask', i, bm);
      if (i === 0) mask0 = bm;
      else bm.close();
    });
  }
  const anterior = { folds: [], mean: null };
  for (let k = 0; k < 5; k++) {
    jobs.push(async () => {
      const bm = await getBitmap(`${caseId}/anterior/prob_fold${k}.png`);
      gl.upload(slot, 'ant', k, bm);
      anterior.folds[k] = bm;
    });
  }
  jobs.push(async () => {
    const bm = await getBitmap(`${caseId}/anterior/prob_mean.png`);
    gl.upload(slot, 'ant', 5, bm);
    anterior.mean = bm;
  });
  for (let k = 0; k < nAcc; k++) {
    jobs.push(async () => {
      const bm = await getBitmap(`${caseId}/accum/acc_${pad(k)}.png`);
      gl.upload(slot, 'acc', k, bm);
      bm.close();
    });
  }
  await pool(jobs, 12, tick);
  return { caseId, slot, manifest, components, windows, anterior, accum, thumb, mask0 };
}
