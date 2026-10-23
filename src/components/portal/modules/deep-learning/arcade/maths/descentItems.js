/* ============================================================================
   DESCENT — THE ROUND GENERATOR (pure, seeded)
   ----------------------------------------------------------------------------
   makeItems(rand, level) → 10 items, easiest first:
     hole   a landscape and a bag of clubs; the answer is the club that makes
            par. Par is COMPUTED: every club in the bag swings from the tee
            with the slides' update rules (maths/descent.js) at the hole's η
            and defaults, and par = the fewest steps until the ball stays in
            the cup (radius r) — see holedAt(). A hole is kept only when the
            template's club wins by a clear margin (≤ 80% of the runner-up's
            steps, or the runner-up never holes) AND the losers fail the way
            the why card says (SGD settles in the dimple, AdaGrad stalls short
            of the flag, momentum swings past the flag in the narrow valley).
     dial   SGD's trail at a too-high or too-low η; turn the dial (slide 48)
     clip   the cliff: clipvalue vs clipnorm (slide 29)
     sched  learning-rate schedule power-ups (slides 50–59)
     eq     the update equations and defaults themselves (KaTeX)
   level 1  GD, momentum, AdaGrad holes (bags of 2, then 3), the dial, GD and
            momentum equations
   level 2  NAG and RMSProp holes (and AdaGrad beating RMSProp on a simple
            bowl), NAG / AdaGrad / RMSProp equations
   level 3  Adam holes and the six-club bowl, the cliff, schedules, Adam and
            its variants
   Every item: { id, type, kind: 'choice', concept, src, answer, choices,
   promptText, why } and JSON-serialisable data for its stage.
   ========================================================================== */
import { run, holedAt, clipValue, clipNorm, CLUB_IDS, powerSched, expSched, piecewiseSched, performanceSched, oneCycleSched } from './descent.js';
import { buildHole } from './descentHoles.js';
import { CLUBS, HOLES, WINS, DIAL, EQ, CLIP, SCHED } from '../content/descent.js';

export const ROUND_SIZE = 10;
export const MARGIN = 0.8;

const U = (R, a, b) => a + (b - a) * R.next();
const sgn = (R) => (R.next() < 0.5 ? -1 : 1);
const r2 = (v) => Math.round(v * 100) / 100;

/* ── the hole samplers (course θ₁ ∈ [−5, 5], θ₂ ∈ [−3, 3]) ─────────────── */
export const SAMPLERS = {
  bowl(R) {
    const eta = R.pick([1.5, 2]);
    const b = U(R, 1.3, 1.7) / eta; // ηb in [1.3, 1.7]: stable but brisk across
    const a = b / U(R, 15, 30); // 15–30× flatter along
    return { kind: 'bowl', p: { a, b }, start: [U(R, -4.6, -3.8), sgn(R) * U(R, 1.8, 2.5)], flag: [U(R, 0.8, 2.2), U(R, -0.3, 0.3)], r: 0.3, eta, nMax: 120 };
  },
  flats(R) {
    const eta = R.pick([0.1, 0.15]);
    const k = U(R, 0.012, 0.025) / eta; // ηk tiny: the local gradient is tiny
    return { kind: 'flats', p: { k, q: U(R, 1, 1.6) }, start: [U(R, -4.5, -3.5), sgn(R) * U(R, 1, 2)], flag: [U(R, 1.5, 3), U(R, -0.5, 0.5)], r: 0.3, eta, nMax: 160 };
  },
  dimple(R) {
    const start = [U(R, -4.5, -3.8), sgn(R) * U(R, 0.6, 1.6)];
    const flag = [U(R, 2, 3.2), U(R, -0.6, 0.6)];
    const f = U(R, 0.25, 0.35);
    const d = [start[0] + f * (flag[0] - start[0]), start[1] + f * (flag[1] - start[1]) + U(R, -0.25, 0.25)];
    return { kind: 'dimple', p: { k: U(R, 0.1, 0.13), A: U(R, 1, 1.5), sigma: U(R, 0.5, 0.7), d }, start, flag, r: 0.3, eta: r2(U(R, 0.4, 0.6)), nMax: 160 };
  },
  narrow(R) {
    const eta = 1;
    const b = U(R, 1.0, 1.25) / eta;
    const a = b / U(R, 20, 35);
    const phi = sgn(R) * U(R, 0.15, 0.4);
    const flag = [U(R, 1.2, 2.4), U(R, -0.4, 0.4)];
    const L = U(R, 5, 5.8); // tee up the valley's long axis, off the floor
    const off = sgn(R) * U(R, 0.8, 1.4);
    const c = Math.cos(phi);
    const s = Math.sin(phi);
    const start = [flag[0] - L * c - off * s, flag[1] - L * s + off * c];
    return { kind: 'narrow', p: { a, b, phi }, start, flag, r: 0.3, eta, nMax: 120 };
  },
  valley(R) {
    return { kind: 'valley', p: { k: U(R, 0.3, 0.5), w: U(R, 0.8, 1.2), b: U(R, 0.8, 1.2) }, start: [U(R, -4.6, -4), sgn(R) * U(R, 1, 1.6)], flag: [U(R, 3, 4), U(R, -0.3, 0.3)], r: 0.3, eta: r2(U(R, 0.2, 0.3)), nMax: 160 };
  },
};

/* ── swinging a club and reading the outcome ───────────────────────────── */
export function swing(spec, club, nMax = spec.nMax) {
  const { grad } = buildHole(spec);
  return run(club, grad, spec.start, { eta: spec.eta }, nMax, 50);
}

/* the scorecard word for a swing: holed (with steps), diverged, stuck (in
   the dimple's local optimum), stalled (crawling, short of the flag) or
   moving (not in the cup to stay) */
export function outcome(spec, path, diverged) {
  const steps = holedAt(path, spec.flag, spec.r, diverged);
  if (steps !== null) return { steps, status: 'holed' };
  if (diverged) return { steps: null, status: 'diverged' };
  const n = path.length;
  const last = path[n - 1];
  const back = path[Math.max(0, n - 21)];
  const drift = Math.hypot(last[0] - back[0], last[1] - back[1]) / Math.min(20, n - 1);
  const dist = Math.hypot(last[0] - spec.flag[0], last[1] - spec.flag[1]);
  if (spec.kind === 'dimple') {
    const dd = Math.hypot(last[0] - spec.p.d[0], last[1] - spec.p.d[1]);
    if (dd < 0.8) return { steps: null, status: 'stuck' };
  }
  if (dist > 2 * spec.r && drift < 0.05 && (spec.kind === 'valley' || spec.kind === 'flats')) {
    // still short of the flag along the course and barely moving
    if (last[0] < spec.flag[0] - spec.r) return { steps: null, status: 'stalled' };
  }
  return { steps: null, status: 'moving' };
}

export function scoreHole(spec, bag) {
  const results = {};
  for (const c of bag) {
    const { path, diverged } = swing(spec, c);
    results[c] = { ...outcome(spec, path, diverged), overshoot: overshoot(spec, path) };
  }
  return results;
}

// how far past the flag a path ever went along the narrow valley's long axis
function overshoot(spec, path) {
  if (spec.kind !== 'narrow') return 0;
  const c = Math.cos(spec.p.phi);
  const s = Math.sin(spec.p.phi);
  let best = -Infinity;
  for (const [x, y] of path) best = Math.max(best, c * (x - spec.flag[0]) + s * (y - spec.flag[1]));
  return r2(best);
}

/* the winner by steps, if it is clear by MARGIN */
export function parOf(results, bag) {
  const ranked = bag.map((c) => [c, results[c].steps ?? Infinity]).sort((x, y) => x[1] - y[1]);
  const [club, steps] = ranked[0];
  const next = ranked[1]?.[1] ?? Infinity;
  if (!Number.isFinite(steps) || !(steps <= MARGIN * next)) return null;
  return { club, steps, runnerUp: Number.isFinite(next) ? next : null };
}

/* the hole templates: kind, bag, the club the slides' story says wins, the
   why key, and what the losers must show for that story to be true */
export const TEMPLATES = {
  L1: [
    { kind: 'bowl', bag: ['sgd', 'adagrad'], win: 'adagrad', tier: 1 },
    { kind: 'flats', bag: ['sgd', 'momentum'], win: 'momentum', tier: 1 },
    { kind: 'dimple', bag: ['sgd', 'momentum'], win: 'momentum', tier: 1, need: { sgd: 'stuck' } },
    { kind: 'bowl', bag: ['sgd', 'momentum', 'adagrad'], win: 'adagrad', tier: 2 },
    { kind: 'flats', bag: ['sgd', 'momentum', 'adagrad'], win: 'momentum', tier: 2 },
    { kind: 'dimple', bag: ['sgd', 'momentum', 'adagrad'], win: 'momentum', tier: 2, need: { sgd: 'stuck' } },
  ],
  L2: [
    { kind: 'narrow', bag: ['momentum', 'nag'], win: 'nag', tier: 1, overshoot: 'momentum' },
    { kind: 'valley', bag: ['adagrad', 'rmsprop'], win: 'rmsprop', tier: 1, need: { adagrad: 'stalled' } },
    { kind: 'valley', bag: ['sgd', 'adagrad'], win: 'sgd', tier: 1, need: { adagrad: 'stalled' }, concept: 'optim.adagrad' }, // the lesson is AdaGrad stopping too early
    { kind: 'bowl', bag: ['adagrad', 'rmsprop'], win: 'adagrad', tier: 1, whyKey: 'bowl.adagrad.vsRms' },
    { kind: 'narrow', bag: ['sgd', 'momentum', 'nag'], win: 'nag', tier: 2, overshoot: 'momentum' },
    { kind: 'valley', bag: ['sgd', 'adagrad', 'rmsprop'], win: 'rmsprop', tier: 2, need: { adagrad: 'stalled' } },
    { kind: 'bowl', bag: ['sgd', 'momentum', 'adagrad', 'rmsprop'], win: 'adagrad', tier: 2 },
  ],
  L3: [
    { kind: 'dimple', bag: ['sgd', 'adagrad', 'rmsprop', 'adam'], win: 'adam', tier: 1 },
    { kind: 'flats', bag: ['sgd', 'adagrad', 'adam'], win: 'adam', tier: 1, need: { adagrad: 'stalled' } },
    { kind: 'narrow', bag: ['sgd', 'momentum', 'nag'], win: 'nag', tier: 1, overshoot: 'momentum' },
    { kind: 'valley', bag: ['sgd', 'adagrad', 'rmsprop'], win: 'rmsprop', tier: 1, need: { adagrad: 'stalled' } },
    { kind: 'bowl', bag: CLUB_IDS, win: 'adagrad', tier: 2 },
  ],
};

export function makeHole(R, tpl, n) {
  for (let tries = 0; tries < 60; tries++) {
    const spec = SAMPLERS[tpl.kind](R);
    const results = scoreHole(spec, tpl.bag);
    const par = parOf(results, tpl.bag);
    if (!par || par.club !== tpl.win) continue;
    if (par.steps > 0.8 * spec.nMax) continue; // the winner must stay in the cup for a good stretch
    if (tpl.need && Object.entries(tpl.need).some(([c, st]) => results[c].status !== st)) continue;
    // the narrow-valley story: momentum swings past the flag, and further than NAG
    if (tpl.overshoot && !(results[tpl.overshoot].overshoot > spec.r && results[tpl.win].overshoot < results[tpl.overshoot].overshoot)) continue;
    const win = WINS[tpl.whyKey ?? `${tpl.kind}.${tpl.win}`];
    const H = HOLES[tpl.kind];
    const club = CLUBS[tpl.win];
    return {
      id: `hole-${n}-${tpl.kind}-${tpl.bag.join('.')}`,
      type: 'hole',
      kind: 'choice',
      concept: tpl.concept ?? club.concept,
      src: win.src,
      answer: tpl.win,
      choices: R.shuffle(tpl.bag).map((c) => ({ value: c, label: CLUBS[c].label })),
      promptText: `${H.name}: which club makes par?`,
      why: win.why,
      hole: spec,
      results,
      par: { club: par.club, steps: par.steps },
    };
  }
  throw new Error(`descent: no clear hole for ${tpl.kind}/${tpl.win}`);
}

/* ── the learning-rate dial (slide 48) ─────────────────────────────────── */
export function makeDial(R, n) {
  const dir = R.pick(['down', 'up']);
  const k = U(R, 0.8, 1.2);
  // too high: ηk just over 2, so SGD zig-zags across the flag further out every step
  const eta = dir === 'down' ? r2(U(R, 2.08, 2.22) / k) : Math.round((U(R, 0.006, 0.012) / k) * 1000) / 1000;
  const spec = { kind: 'round', p: { k }, start: [U(R, -3.6, -2.6), sgn(R) * U(R, 0.8, 1.6)], flag: [U(R, 0.5, 1.5), U(R, -0.4, 0.4)], r: 0.3, eta, nMax: dir === 'down' ? 24 : 60 };
  const { path, diverged } = swing(spec, 'sgd');
  const res = outcome(spec, path, diverged);
  // the trail must show the story: flying off (down) or crawling (up)
  const ok = dir === 'down' ? res.status === 'diverged' || Math.hypot(path[path.length - 1][0] - spec.flag[0], path[path.length - 1][1] - spec.flag[1]) > 5 : res.status !== 'holed';
  if (!ok) throw new Error('descent: dial trail does not show its story');
  return {
    id: `dial-${n}-${dir}`,
    type: 'dial',
    kind: 'choice',
    concept: DIAL.concept,
    src: DIAL.src,
    answer: dir,
    choices: DIAL.choices.map((c) => ({ ...c })),
    promptText: DIAL.prompt,
    why: DIAL.why[dir],
    hole: spec,
    eta,
  };
}

/* ── the cliff: gradient clipping (slide 29) ───────────────────────────── */
const fmt1 = (v) => (Math.round(v * 10) / 10).toFixed(1).replace('-', '−');
export const fmtVec = (g) => `(${g.map(fmt1).join(', ')})`;

/* a cliff surface whose gradient at the ball is exactly g: a gentle bowl
   around the flag plus a steep wall (softplus) rising to the left, solved so
   that k(θ − f) + G·(−1, tilt) = g at the ball, with the ball 2δ up the wall */
export function cliffSpec(g, ball, flag = [3, 0], k = 0.12, delta = 0.35) {
  const G = k * (ball[0] - flag[0]) - g[0];
  const tilt = (g[1] - k * (ball[1] - flag[1])) / G;
  const zBall = 2;
  const sig = 1 / (1 + Math.exp(-zBall));
  const H = (G * delta) / sig;
  const wx = ball[0] - tilt * ball[1] + zBall * delta;
  return { kind: 'cliff', p: { k, H, wx, delta, tilt }, start: ball, flag, r: 0.3, eta: 1, nMax: 1 };
}

export function makeClip(R, n, variant) {
  // the wall rises to the left; on it the gradient is huge
  const gx = -U(R, 8, 16);
  const small = R.chance(0.35);
  let gy = sgn(R) * (small ? U(R, 0.3, 0.9) : U(R, 1.5, 4));
  const shown = variant === 'which' ? R.pick(['clipvalue', 'clipnorm']) : null;
  // "which": keep clipvalue visibly different from clipnorm (a real change of direction)
  if (shown === 'clipvalue' && small) gy = sgn(R) * 2.6;
  const g = [Math.round(gx * 10) / 10, Math.round(gy * 10) / 10];
  const spec = cliffSpec(g, [U(R, -3.4, -2.8), U(R, -1, 1)]);
  const cv = clipValue(g, 1);
  const cn = clipNorm(g, 1);
  const base = { id: `clip-${n}-${variant}`, type: 'clip', kind: 'choice', concept: CLIP.concept, src: CLIP.src, variant, g, clipped: { value: cv, norm: cn }, hole: spec };
  if (variant === 'orient') {
    return { ...base, answer: CLIP.orient.answer, choices: R.shuffle(CLIP.orient.choices), promptText: CLIP.orient.prompt, why: CLIP.orient.why };
  }
  if (variant === 'which') {
    return { ...base, shown, answer: shown, choices: CLIP.which.choices.map((c) => ({ ...c })), promptText: CLIP.which.prompt, why: CLIP.which.why[shown] };
  }
  if (variant === 'value') {
    const right = fmtVec(cv);
    const opts = [right, fmtVec(g), fmtVec(cv.map(Math.abs)), fmtVec([cv[0], g[1]]), fmtVec([g[0], cv[1]])];
    const uniq = [...new Set(opts)].slice(0, 4);
    return {
      ...base,
      answer: right,
      choices: R.shuffle(uniq).map((v) => ({ value: v, label: v })),
      promptText: `${CLIP.value.prompt} ∇θJ(θ) = ${fmtVec(g)}`,
      why: CLIP.value.why,
    };
  }
  return { ...base, answer: CLIP.rnn.answer, choices: R.shuffle(CLIP.rnn.choices), promptText: CLIP.rnn.prompt, why: CLIP.rnn.why };
}

/* ── schedules: the power-ups (slides 50–59) ───────────────────────────── */
// a learning rate as the slides write them: 0.005, 0.00333, 0.0125
export const fmtEta = (v) => {
  if (v === 0) return '0';
  const s = Number(v.toPrecision(3));
  return s >= 0.0001 ? String(s) : s.toExponential(2);
};
const distinct = (vals, n) => {
  const out = [];
  for (const v of vals) if (!out.some((o) => Math.abs(o - v) <= 1e-12 + Math.abs(v) * 1e-6) && out.length < n) out.push(v);
  return out;
};

export function makeSched(R, n, variant) {
  const S = SCHED;
  const base = (name) => ({ id: `sched-${n}-${variant}`, type: 'sched', kind: 'choice', variant, concept: S.names[name].concept, src: S.names[name].src });
  if (variant === 'power') {
    const eta0 = R.pick([0.01, 0.1]);
    const s = R.pick([10, 20]);
    const k = R.pick([1, 2, 3]);
    const p = { eta0, r: 1, s, c: 1 };
    const t = k * s;
    const ans = powerSched(t, p);
    const vals = distinct([ans, eta0 / (2 + k), eta0 / (1 + k) ** 2, k > 1 ? eta0 / k : eta0 / (4 + k), eta0 * 0.5 ** k], 4);
    return {
      ...base('power'),
      params: p, t, curve: 'power',
      answer: fmtEta(ans),
      choices: R.shuffle(vals).map((v) => ({ value: fmtEta(v), label: fmtEta(v) })),
      promptText: `${S.power.prompt} η₀ = ${eta0}, r = 1, s = ${s}, c = 1, t = ${t}`,
      why: S.power.why,
    };
  }
  if (variant === 'exponential') {
    const eta0 = R.pick([0.1, 0.01]);
    const r = R.pick([0.1, 0.5, 0.2]);
    const s = R.pick([10, 15, 20]);
    const k = r === 0.5 ? R.pick([1, 2, 3]) : R.pick([1, 2]);
    const p = { eta0, r, s };
    const t = k * s;
    const ans = expSched(t, p);
    const vals = distinct([ans, eta0 * r ** (k + 1), k > 1 ? eta0 * r ** (k - 1) : eta0 * r ** (k + 2), eta0 / (1 + r * k), eta0 * r * k], 4);
    return {
      ...base('exponential'),
      params: p, t, curve: 'exponential',
      answer: fmtEta(ans),
      choices: R.shuffle(vals).map((v) => ({ value: fmtEta(v), label: fmtEta(v) })),
      promptText: `${S.exponential.prompt} η₀ = ${eta0}, r = ${r}, s = ${s}, t = ${t}`,
      why: S.exponential.why,
    };
  }
  if (variant === 'piecewise') {
    const t = R.pick([30000, 45000, 60000, 75000, 85000, 95000]);
    const ans = piecewiseSched(t, S.piecewise);
    return {
      ...base('piecewise'),
      params: { boundaries: S.piecewise.boundaries, values: S.piecewise.values }, t, curve: 'piecewise',
      answer: String(ans),
      choices: S.piecewise.values.map((v) => ({ value: String(v), label: String(v) })),
      promptText: `${S.piecewise.prompt} t = ${t.toLocaleString('en-AU')}`,
      why: S.piecewise.why,
    };
  }
  if (variant === 'performance') {
    return { ...base('performance'), curve: 'performance', answer: S.performance.answer, choices: R.shuffle(S.performance.choices), promptText: S.performance.prompt, why: S.performance.why };
  }
  if (variant === 'shape') {
    const which = R.pick(['piecewise', 'performance', 'onecycle']);
    const names = ['power', 'exponential', 'piecewise', 'performance', 'onecycle'];
    return {
      ...base(which),
      id: `sched-${n}-shape-${which}`,
      curve: which,
      answer: which,
      choices: names.map((v) => ({ value: v, label: S.names[v].label })),
      promptText: S.shape.prompt,
      why: S.shape.why[which],
    };
  }
  // a fact item
  const f = S.facts.find((x) => x.id === variant);
  if (!f) throw new Error(`descent: unknown schedule item ${variant}`);
  const curve = { 'sched.onecycle.up': 'onecycle', 'sched.performance.when': 'performance' }[f.id] ?? null;
  return { id: `sched-${n}-${f.id}`, type: 'sched', kind: 'choice', variant: 'fact', curve, concept: f.concept, src: f.src, answer: f.answer, choices: R.shuffle(f.choices), promptText: f.prompt, why: f.why };
}

/* the curve a schedule item draws: [{ t, eta }] and, for performance, the
   validation loss it reacts to (schematic, shaped like slide 58's run) */
export function schedCurve(item) {
  const pts = [];
  if (item.curve === 'power' || item.curve === 'exponential') {
    const T = Math.max(item.t * 1.6, item.params.s * 4);
    const f = item.curve === 'power' ? powerSched : expSched;
    for (let i = 0; i <= 80; i++) {
      const t = (T * i) / 80;
      pts.push({ t, eta: f(t, item.params) });
    }
    return { pts, T, mark: item.t };
  }
  if (item.curve === 'piecewise') {
    const T = 100000;
    for (let i = 0; i <= 200; i++) {
      const t = (T * i) / 200;
      pts.push({ t, eta: piecewiseSched(t, SCHED.piecewise) });
    }
    return { pts, T, mark: item.t ?? null };
  }
  if (item.curve === 'performance') {
    const loss = [];
    for (let e = 0; e <= 24; e++) loss.push(e <= 11 ? 0.48 - 0.1 * (1 - Math.exp(-e / 3)) : e <= 16 ? 0.377 + 0.0016 * (e - 11) : 0.356 + 0.001 * Math.sin(e));
    const etas = performanceSched(loss, { eta0: 0.01, factor: 0.5, patience: 5 });
    etas.forEach((eta, t) => pts.push({ t, eta }));
    return { pts, T: 24, loss, mark: null };
  }
  // onecycle (shape only)
  for (let i = 0; i <= 100; i++) pts.push({ t: i, eta: oneCycleSched(i, { eta0: 0.01, eta1: 0.1, total: 100, tail: 12 }) });
  return { pts, T: 100, mark: null };
}

/* ── equation items ────────────────────────────────────────────────────── */
export function makeEq(R, n, e) {
  return {
    id: `eq-${n}-${e.id}`,
    type: 'eq',
    kind: 'choice',
    concept: e.concept,
    src: e.src,
    answer: e.answer,
    choices: R.shuffle(e.choices).map((c) => ({ ...c })),
    prompt: e.prompt,
    promptText: e.plain ?? e.prompt,
    why: e.why,
  };
}

/* ── the round ─────────────────────────────────────────────────────────── */
export function makeItems(R, level = 1) {
  const L = Math.max(1, Math.min(3, Number(level) || 1));
  const tpls = TEMPLATES[`L${L}`];
  const tier1 = R.shuffle(tpls.filter((t) => t.tier === 1));
  const tier2 = R.shuffle(tpls.filter((t) => t.tier === 2));
  const eqs = R.shuffle(EQ.filter((e) => e.level === L));
  let n = 0;
  const hole = (t) => makeHole(R, t, n++);
  const eq = () => makeEq(R, n++, eqs.shift());
  const out = [];
  if (L === 1) {
    out.push(hole(tier1[0]), hole(tier1[1]), eq(), hole(tier1[2]), makeDial(R, n++), hole(tier2[0]), eq(), hole(tier2[1]), hole(tier2[2]), eq());
  } else if (L === 2) {
    out.push(hole(tier1[0]), hole(tier1[1]), eq(), hole(tier1[2]), hole(tier1[3]), eq(), hole(tier2[0]), hole(tier2[1]), eq(), hole(tier2[2]));
  } else {
    const clips = R.shuffle(['orient', 'which', 'value', 'rnn']);
    const scheds = R.shuffle(['power', 'exponential', 'piecewise', 'performance', 'shape', 'shape', 'sched.onecycle.up', 'sched.performance.when', 'sched.why.startHigh']);
    const sched2 = [scheds[0], scheds.slice(1).find((v) => v !== scheds[0])];
    out.push(
      hole(tier1[0]), makeClip(R, n++, clips[0]), hole(tier1[1]), makeSched(R, n++, sched2[0]), eq(),
      hole(tier1[2]), makeClip(R, n++, clips[1]), makeSched(R, n++, sched2[1]), eq(), hole(tier2[0]),
    );
  }
  return out.slice(0, ROUND_SIZE);
}
