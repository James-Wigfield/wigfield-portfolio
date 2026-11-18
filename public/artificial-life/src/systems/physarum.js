// PHYSARUM — the transport-network model of Jones (2010). Each agent samples
// the trail map ahead, ahead-left and ahead-right, steers towards the
// strongest of the three, steps forward and deposits. The map is blurred and
// decayed every frame; the network is entirely an artefact of that feedback.
import { makeRng } from '../lib/rng.js';
import { ramp } from '../lib/palette.js';
import { Surface } from '../lib/surface.js';

const DEG = Math.PI / 180;
const TAU = Math.PI * 2;

// Six trig calls per agent per frame is 1.5M calls: it dominated the frame
// until it became six array reads. 4096 entries is 0.088 degrees of angular
// resolution, well under the smallest turn any preset makes.
const NA = 4096;
const AMASK = NA - 1;
const ASCALE = NA / TAU;
const SIN = new Float32Array(NA);
const COS = new Float32Array(NA);
for (let i = 0; i < NA; i++) {
  SIN[i] = Math.sin((i * TAU) / NA);
  COS[i] = Math.cos((i * TAU) / NA);
}

// The trail map is kept near this many cells whatever the viewport shape:
// the blur is the expensive half of the frame and it scales with area.
const TARGET_CELLS = 620000;

// Jones' lattice holds at most one agent per site, which bounds how strong a
// trail can get. Without that bound the strongest veins win everything and the
// network coarsens into three or four trunks; a saturation ceiling restores
// the fine reticulum. Expressed as a multiple of the deposit.
const SATURATION = 20;

export const meta = {
  id: 'physarum',
  name: 'Slime Mould',
  latin: 'Physarum reticulatum',
  accession: 'AL·0229',
  plate: 'III',
  described: 2010,
  accent: '#ddc169',
  note: 'The foraging sheet resolves into veins within about twenty seconds, then prunes itself: redundant links starve while load-bearing ones thicken.',
  source: 'Jones, J. (2010) Characteristics of Pattern Formation and Evolution in Approximations of Physarum Transport Networks. Artificial Life 16(2).',
};

export function create({ cells = TARGET_CELLS } = {}) {
  const params = [
    { key: 'agents', label: 'population', min: 50000, max: 400000, step: 10000, value: 260000, unit: '', integer: true },
    { key: 'sa', label: 'sensor angle', min: 5, max: 90, step: 0.5, value: 22.5, unit: '°' },
    { key: 'sd', label: 'sensor distance', min: 1, max: 40, step: 0.5, value: 9, unit: 'px' },
    { key: 'ra', label: 'turn angle', min: 5, max: 90, step: 0.5, value: 45, unit: '°' },
    { key: 'ss', label: 'step size', min: 0.25, max: 4, step: 0.05, value: 1, unit: 'px' },
    { key: 'deposit', label: 'deposit', min: 0.5, max: 20, step: 0.5, value: 5 },
    { key: 'decay', label: 'decay', min: 0.005, max: 0.4, step: 0.005, value: 0.1 },
    { key: 'turnover', label: 'turnover', min: 0, max: 0.004, step: 0.0001, value: 0.001, digits: 4 },
  ];
  const p = {};
  for (const d of params) p[d.key] = d.value;

  let W = 1024, H = 606;
  let trail = null, next = null, tmp = null;
  let ax = null, ay = null;
  let ah = null; // heading as an index into SIN/COS, not radians
  let count = 0;
  let surf = null;
  let rng = makeRng();
  let rs = (rng() * 0xffffffff) | 0 || 12345;
  let energy = 0;   // mean trail: fixed by deposit/decay, so not the readout
  let coverage = 0; // fraction of the map carrying a vein
  let ref = 40;     // trail-weighted mean trail, used as an auto-exposure
  let spawnMode = 'uniform';
  let cursor = 0;

  const lut = ramp([
    [0.0, '#090806'],
    [0.08, '#191207'],
    [0.28, '#54390f'],
    [0.5, '#966c1d'],
    [0.72, '#d3ab45'],
    [0.88, '#eed992'],
    [1.0, '#fbf3dd'],
  ]);

  // xorshift32 inline in the agent loop; the closure PRNG is too slow at
  // 260k calls a frame.
  function rnd() {
    rs ^= rs << 13; rs ^= rs >>> 17; rs ^= rs << 5;
    return (rs >>> 0) / 4294967296;
  }

  function allocGrid(w, h) {
    W = w; H = h;
    trail = new Float32Array(W * H);
    next = new Float32Array(W * H);
    tmp = new Float32Array(W * H);
    if (surf) surf.dispose();
    surf = new Surface(W, H);
  }

  function allocAgents(n) {
    const old = count;
    count = n;
    ax = new Float32Array(n); ay = new Float32Array(n); ah = new Int32Array(n);
    spawn(spawnMode);
    return old;
  }

  const angle = (rad) => ((rad * ASCALE) | 0) & AMASK;

  function spawn(mode) {
    spawnMode = mode;
    const cx = W / 2, cy = H / 2;
    const r0 = Math.min(W, H) * 0.16;
    for (let i = 0; i < count; i++) {
      if (mode === 'disc') {
        const a = rng() * TAU, r = Math.sqrt(rng()) * r0;
        ax[i] = cx + Math.cos(a) * r; ay[i] = cy + Math.sin(a) * r;
        ah[i] = angle(a + (rng() - 0.5) * 0.6);
      } else if (mode === 'ring') {
        const a = rng() * TAU, r = Math.min(W, H) * 0.36 + (rng() - 0.5) * 6;
        ax[i] = cx + Math.cos(a) * r; ay[i] = cy + Math.sin(a) * r;
        ah[i] = angle(a + Math.PI / 2 + (rng() - 0.5) * 0.25);
      } else {
        ax[i] = rng() * W; ay[i] = rng() * H; ah[i] = (rng() * NA) & AMASK;
      }
    }
  }

  function clearTrail() {
    trail.fill(0); next.fill(0); tmp.fill(0);
  }

  function setParam(key, val) {
    if (!(key in p)) return;
    if (key === 'agents') {
      const n = Math.max(1000, Math.round(val));
      p.agents = n;
      const d = params.find((q) => q.key === 'agents');
      if (d) d.value = n;
      allocAgents(n);
      return;
    }
    p[key] = val;
    const d = params.find((q) => q.key === key);
    if (d) d.value = val;
  }

  const DEFAULTS = { sa: 22.5, sd: 9, ra: 45, ss: 1, deposit: 5, decay: 0.1, turnover: 0.001 };

  const presets = [
    {
      name: 'reticulum',
      note: 'default sensor geometry, agents seeded everywhere',
      values: DEFAULTS,
      seed() { clearTrail(); spawn('uniform'); },
    },
    {
      name: 'inoculum',
      note: 'one central colony, foraging outwards',
      values: DEFAULTS,
      seed() { clearTrail(); spawn('disc'); },
    },
    {
      name: 'annulus',
      note: 'a ring given a tangential push — it buckles, then knits',
      values: DEFAULTS,
      seed() { clearTrail(); spawn('ring'); },
    },
    {
      name: 'long veins',
      note: 'narrow sensors reaching further: fewer, straighter trunks',
      values: { sa: 12, sd: 22, ra: 18, ss: 1.4, deposit: 5, decay: 0.06, turnover: 0.0005 },
      seed() { clearTrail(); spawn('uniform'); },
    },
  ];

  let current = 0;

  function applyPreset(i) {
    const pr = presets[Math.max(0, Math.min(presets.length - 1, i))];
    for (const k in pr.values) setParam(k, pr.values[k]);
    pr.seed();
    current = presets.indexOf(pr);
  }

  const S = {
    ...meta,
    params,
    presets,

    init(cw, ch) {
      const aspect = (cw || 16) / (ch || 9);
      const h = Math.max(240, Math.round(Math.sqrt(cells / aspect)));
      const w = Math.max(240, Math.round(h * aspect));
      allocGrid(w, h);
      allocAgents(p.agents);
      applyPreset(0);
    },

    step() {
      const sa = (p.sa * DEG * ASCALE) | 0;
      const ra = (p.ra * DEG * ASCALE) | 0;
      const sd = p.sd, ss = p.ss, dep = p.deposit;
      const cap = dep * SATURATION;
      const w = W, h = H;

      // --- sensory + motor stage. Heading is carried as a LUT index so the
      // three sensor probes and the step are all table lookups.
      for (let i = 0; i < count; i++) {
        const x = ax[i], y = ay[i];
        const a = ah[i];
        const ai = a & AMASK;
        const al = (a - sa) & AMASK;
        const ar = (a + sa) & AMASK;

        let fx = x + COS[ai] * sd; if (fx < 0) fx += w; else if (fx >= w) fx -= w;
        let fy = y + SIN[ai] * sd; if (fy < 0) fy += h; else if (fy >= h) fy -= h;
        let lx = x + COS[al] * sd; if (lx < 0) lx += w; else if (lx >= w) lx -= w;
        let ly = y + SIN[al] * sd; if (ly < 0) ly += h; else if (ly >= h) ly -= h;
        let rx = x + COS[ar] * sd; if (rx < 0) rx += w; else if (rx >= w) rx -= w;
        let ry = y + SIN[ar] * sd; if (ry < 0) ry += h; else if (ry >= h) ry -= h;

        const f = trail[(fy | 0) * w + (fx | 0)];
        const l = trail[(ly | 0) * w + (lx | 0)];
        const r = trail[(ry | 0) * w + (rx | 0)];

        let na = a;
        if (f > l && f > r) {
          // straight on
        } else if (f < l && f < r) {
          rs ^= rs << 13; rs ^= rs >>> 17; rs ^= rs << 5;
          na = (rs & 1) ? a - ra : a + ra;
        } else if (l > r) {
          na = a - ra;
        } else if (r > l) {
          na = a + ra;
        }
        na &= AMASK;

        let nx = x + COS[na] * ss; if (nx < 0) nx += w; else if (nx >= w) nx -= w;
        let ny = y + SIN[na] * ss; if (ny < 0) ny += h; else if (ny >= h) ny -= h;
        ax[i] = nx; ay[i] = ny; ah[i] = na;
        const ti = (ny | 0) * w + (nx | 0);
        const tv = trail[ti] + dep;
        trail[ti] = tv > cap ? cap : tv;
      }

      // --- turnover: without it the network ripens forever, small cells
      // collapsing into large ones until three or four trunks are left.
      // Resampling a sliver of the population each frame keeps new foragers
      // arriving, which is what holds the reticulum at a stable grain.
      const fresh = Math.round(count * p.turnover);
      for (let j = 0; j < fresh; j++) {
        if (++cursor >= count) cursor = 0;
        rs ^= rs << 13; rs ^= rs >>> 17; rs ^= rs << 5;
        ax[cursor] = ((rs >>> 0) / 4294967296) * W;
        rs ^= rs << 13; rs ^= rs >>> 17; rs ^= rs << 5;
        ay[cursor] = ((rs >>> 0) / 4294967296) * H;
        rs ^= rs << 13; rs ^= rs >>> 17; rs ^= rs << 5;
        ah[cursor] = (rs >>> 0) & AMASK;
      }

      // --- diffuse (separable 3-tap box) and decay
      const keep = 1 - p.decay;
      const third = 1 / 3;
      for (let y = 0; y < h; y++) {
        const row = y * w;
        tmp[row] = (trail[row + w - 1] + trail[row] + trail[row + 1]) * third;
        for (let x = 1; x < w - 1; x++) {
          tmp[row + x] = (trail[row + x - 1] + trail[row + x] + trail[row + x + 1]) * third;
        }
        tmp[row + w - 1] = (trail[row + w - 2] + trail[row + w - 1] + trail[row]) * third;
      }
      let sum = 0, sum2 = 0, cov = 0;
      for (let y = 0; y < h; y++) {
        const row = y * w;
        const rowN = (y === 0 ? h - 1 : y - 1) * w;
        const rowS = (y === h - 1 ? 0 : y + 1) * w;
        for (let x = 0; x < w; x++) {
          const v = (tmp[rowN + x] + tmp[row + x] + tmp[rowS + x]) * third * keep;
          next[row + x] = v;
          sum += v;
          sum2 += v * v;
          if (v > 8) cov++;
        }
      }
      const t = trail; trail = next; next = t; // ping-pong
      const n = w * h;
      energy = sum / n;
      coverage = cov / n;
      // Trail is unbounded (veins run into the thousands while the foraging
      // haze is single digits), so expose against the trail-weighted mean
      // rather than a constant, smoothed so the image does not pump.
      const want = sum > 0 ? sum2 / sum : 40;
      ref += (want - ref) * 0.05;
    },

    paintInto(out) {
      // Reinhard rolloff around the auto-exposure point.
      const n = W * H;
      const k = Math.max(6, ref * 0.3);
      for (let i = 0; i < n; i++) {
        const v = trail[i];
        const t = v / (v + k);
        out[i] = lut[(t * 255) | 0];
      }
    },

    render(ctx) {
      S.paintInto(surf.u32);
      // Smoothing on: the trail map is below viewport resolution and the
      // network reads better soft than blocky.
      surf.blit(ctx, { smooth: true, mode: 'stretch' });
    },

    mapPointer(px, py, cw, ch) { return surf.toLocal(px, py, cw, ch, 'stretch'); },

    seed(nx, ny, strength) {
      // A chemoattractant blob: agents within sensor range will steer in.
      const cx = nx * W, cy = ny * H;
      const rad = Math.max(6, Math.round(Math.min(W, H) * 0.02));
      const r2 = rad * rad;
      for (let dy = -rad; dy <= rad; dy++) {
        for (let dx = -rad; dx <= rad; dx++) {
          const d2 = dx * dx + dy * dy;
          if (d2 > r2) continue;
          const x = (((cx + dx) | 0) % W + W) % W;
          const y = (((cy + dy) | 0) % H + H) % H;
          trail[y * W + x] += strength * 60 * (1 - d2 / r2);
        }
      }
    },

    reset() {
      rng = makeRng();
      rs = (rng() * 0xffffffff) | 0 || 12345;
      presets[current].seed();
    },

    metric() {
      // Mean trail is pinned by deposit/decay; what actually changes as the
      // sheet prunes itself is how much of the map still carries a vein.
      return { label: 'network', value: coverage, text: (coverage * 100).toFixed(1) + '%' };
    },

    // Read-only accessors, used for measurement outside a browser.
    field() { return { data: trail, w: W, h: H }; },
    stats() { return { energy, coverage, ref }; },
    applyPreset,
    get preset() { return current; },
    setParam,

    resize(cw, ch) {
      const aspect = cw / ch;
      const h = Math.max(240, Math.round(Math.sqrt(cells / aspect)));
      const w = Math.max(240, Math.round(h * aspect));
      if (w === W && h === H) return;
      const sx = w / W, sy = h / H;
      const oldX = ax, oldY = ay, oldH = ah, n = count;
      allocGrid(w, h);
      ax = new Float32Array(n); ay = new Float32Array(n); ah = new Int32Array(n);
      for (let i = 0; i < n; i++) { ax[i] = oldX[i] * sx; ay[i] = oldY[i] * sy; ah[i] = oldH[i]; }
    },

    dispose() {
      if (surf) surf.dispose();
      surf = null;
      trail = next = tmp = ax = ay = ah = null;
    },
  };
  return S;
}
