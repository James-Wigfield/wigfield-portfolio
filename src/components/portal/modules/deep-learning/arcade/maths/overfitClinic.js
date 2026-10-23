/* ============================================================================
   OVERFIT CLINIC — THE CASE GENERATORS (pure, seeded; no React, no DOM)
   ----------------------------------------------------------------------------
   makeItems(rand, level) → the round's items. Each patient (a CASES entry in
   content/overfit-clinic.js) gets a chart generated here from rand, then one
   item per step:
     level 1   dx                 diagnose (4 failure modes)
     level 2   dx → rx            + prescribe (the slides' fix; the wrong
                                    options are fixes the slides give for
                                    OTHER failure modes, see fixChoices)
     level 3   dx → rx → fu       + a follow-up read off the case (an epoch,
                                    a learning rate, an ordering, a set …)
   Every step of a case shares the same chart object (the stage keeps it on
   screen); `record` carries the Dx / Rx written on the case card so far.

   Charts (all this page's own illustrations of the named failure, except
   maeBars (the MAEs printed on L4 slides 26 and 29), rnn1Summary (L4 slide
   25's summary) and fewLabels (L2 slide 31's numbers), drawn from the slides):
     line   overfit · diverge · slow · spiky · forecast · stateGrowth ·
            oscillate · sweep;  panels  adagrad (loss + step size)
     bars   gradBars · deadBars · trace · maeBars · aeCopy · classHist
     heat   attnHeat · softmaxHeat · strips
     code   rnn1Summary · bigKernel · fewLabels;   encdec (a diagram)
   Each chart has `facts` (numbers the why text and the drawer quote); the
   check (tools/dl-arcade/check-overfit-clinic.mjs) recovers every diagnosis
   from the chart data on its own.
   ========================================================================== */
import { DIAGNOSES, FIXES, CASES, CHART, DRAWER, CODE, WORDS, PROMPTS } from '../content/overfit-clinic.js';
import { EQUATIONS as EQ2 } from '../content/lecture2.js';
import { EQUATIONS as EQ8 } from '../content/lecture8.js';
import { ANCHORS as A4 } from '../content/lecture4.js';
import { simpleRnnParams, conv2dParams } from './params.js';
import { softmax, causalMask } from '../../lecture8-study/attn.js';

export const ROUND = { 1: 8, 2: 5, 3: 3 }; // patients per round
export const PATIENCE = 10; // slide 52's EarlyStopping(patience=10)
export const ETA = 0.001; // slide 40's Adagrad(learning_rate=0.001)
export const RHO = 0.9; // slide 41's decay rate

/* ── small helpers ──────────────────────────────────────────────────────── */
export const fill = (tpl, vars = {}) => String(tpl ?? '').replace(/%(\w+)%/g, (m, k) => (vars[k] !== undefined ? String(vars[k]) : m));
const range = (n, f) => Array.from({ length: n }, (_, i) => f(i));
const uni = (rand, a, b) => a + (b - a) * rand.next();
const r3 = (x) => Math.round(x * 1000) / 1000;
const f2 = (x) => x.toFixed(2);
const pct = (x) => `${Math.round(x * 100)} %`;
const argmin = (a) => a.reduce((b, v, i) => (v < a[b] ? i : b), 0);
const SUP = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
/** 0.0000213 → "2.1 × 10⁻⁵"; ordinary numbers stay plain. */
export function sci(x) {
  if (x === 0) return '0';
  const e = Math.floor(Math.log10(Math.abs(x)));
  if (e >= -2 && e <= 4) return Math.abs(x) >= 100 ? Math.round(x).toLocaleString('en-AU') : String(Number(x.toPrecision(2)));
  const m = x / 10 ** e;
  return `${m.toFixed(1)} × 10${String(e).split('').map((c) => SUP[c]).join('')}`;
}
/** learning rates on the sweep: 0.001, 0.01, 0.1, 1, 10 */
export const fmtRate = (x) => (x >= 1 ? String(Math.round(x)) : String(Number(x.toPrecision(1))));
const vecText = (v) => `[${v.map(f2).join(', ')}]`;
export const sameOrder = (answer) => (g) => Array.isArray(g) && g.length === answer.length && g.every((v, i) => v === answer[i]);

/* ── the chart generators ───────────────────────────────────────────────── */
const lineSpec = (type, x, y, series, extra = {}) => ({ type, kind: 'line', x, y, series, ...extra });

function overfit(rand) {
  const E = rand.int(36, 56);
  const a = uni(rand, 0.9, 1.3);
  const tau = uni(rand, E / 7, E / 5);
  const f = uni(rand, 0.06, 0.12);
  const train = range(E, (i) => a * Math.exp(-(i + 1) / tau) + f + 0.006 * rand.normal());
  for (let i = 1; i < E; i++) train[i] = Math.min(train[i], train[i - 1] - 0.0005);
  const turn = rand.int(Math.round(0.3 * E), Math.round(0.48 * E));
  const gap = uni(rand, 0.05, 0.1);
  const rise = uni(rand, 0.3, 0.5);
  const valid = range(E, (i) => {
    const e = i + 1;
    const k = Math.max(0, e - turn) / (E - turn);
    return a * 1.05 * Math.exp(-e / tau) + f + gap + rise * k ** 1.3 + 0.007 * rand.normal();
  });
  const T = train.map(r3);
  const V = valid.map(r3);
  const best = argmin(V) + 1;
  const C = CHART.overfit;
  return lineSpec('overfit', { label: C.x, from: 1, to: E }, { label: C.y, min: 0, max: Math.max(T[0], V[0]) * 1.08 }, [
    { key: 'train', label: C.train, role: 'train', values: T },
    { key: 'valid', label: C.valid, role: 'valid', values: V },
  ], { facts: { E, best, vbest: f2(V[best - 1]), vend: f2(V[E - 1]), t0: f2(T[0]), tend: f2(T[E - 1]), stop: best + PATIENCE } });
}

function diverge(rand) {
  const E = rand.int(14, 22);
  const l0 = uni(rand, 1.8, 2.4);
  const d = rand.int(1, 3);
  const g = uni(rand, 0.35, 0.55);
  const L = range(E, (e) => r3(l0 * (1 - (0.12 * Math.min(e, d)) / d) * Math.exp(g * Math.max(0, e - d)) * (1 + 0.01 * rand.normal())));
  const emin = argmin(L) + 1;
  const C = CHART.diverge;
  return lineSpec('diverge', { label: C.x, from: 1, to: E }, { label: C.y, min: 0, max: r3(L[0] * 2.4) }, [
    { key: 'train', label: C.train, role: 'train', values: L },
  ], { clipTop: true, facts: { E, l0: f2(L[0]), lmin: f2(L[emin - 1]), emin, lend: sci(L[E - 1]), times: sci(L[E - 1] / L[0]) } });
}

function slow(rand) {
  const E = rand.int(40, 60);
  const l0 = uni(rand, 2.0, 2.5);
  const tau = E * uni(rand, 2.6, 3.6);
  const L = range(E, (i) => r3(l0 * Math.exp(-i / tau) + 0.004 * rand.normal()));
  const q = Math.floor(E / 4);
  const C = CHART.slow;
  return lineSpec('slow', { label: C.x, from: 1, to: E }, { label: C.y, min: 0, max: r3(L[0] * 1.15) }, [
    { key: 'train', label: C.train, role: 'train', values: L },
  ], { facts: { E, l0: f2(L[0]), lend: f2(L[E - 1]), d1: f2(L[0] - L[q]), d4: f2(L[E - 1 - q] - L[E - 1]) } });
}

function spiky(rand) {
  const N = 80;
  const q = N / 4;
  const l0 = uni(rand, 2.0, 2.4);
  const f = uni(rand, 0.25, 0.4);
  const tau = uni(rand, 14, 20);
  const big = rand.int(2, 8);
  const L = range(N, (i) => {
    let v = (l0 - f) * Math.exp(-i / tau) + f + 0.008 * rand.normal();
    const spike = i === big || (Math.abs(i - big) > 1 && rand.chance(0.45)); // the big one stands clear of its neighbours
    if (i < q && spike) v += l0 * uni(rand, i === big ? 0.55 : 0.2, i === big ? 0.75 : 0.6) * (1 - (0.5 * i) / q);
    return r3(v);
  });
  const jumps = L.slice(1).map((v, i) => Math.abs(v - L[i]));
  const early = Math.max(...jumps.slice(0, q - 1));
  const late = Math.max(...jumps.slice(N / 2));
  const C = CHART.spiky;
  return lineSpec('spiky', { label: C.x, from: 1, to: N }, { label: C.y, min: 0, max: r3(Math.max(...L) * 1.05) }, [
    { key: 'train', label: C.train, role: 'train', values: L },
  ], { facts: { N, l0: f2(L[0]), early: f2(early), late: f2(late) } });
}

function adagrad(rand) {
  const E = 40;
  const l0 = uni(rand, 2.0, 2.4);
  const opt = l0 * uni(rand, 0.1, 0.18);
  const plateau = opt + l0 * uni(rand, 0.32, 0.45);
  const tau = uni(rand, 2.2, 3.2);
  const loss = range(E, (e) => r3(plateau + (l0 - plateau) * Math.exp(-e / tau) + 0.003 * rand.normal()));
  // one weight's gradient: steep at first, then small but never zero
  const G = uni(rand, 20, 50);
  const kappa = uni(rand, 1.5, 3);
  const gmin = uni(rand, 0.2, 0.5);
  let s = 0;
  const steps = range(E, (e) => {
    const g = G * Math.exp(-e / kappa) + gmin;
    s += g * g; // slide 38: s ← s + ∇J ⊗ ∇J
    return (ETA * g) / Math.sqrt(s + 1e-10); // θ ← θ − η∇J ⊘ √(s + ε)
  });
  const rel = steps.map((v) => v / steps[0]);
  const third = Math.floor((2 * E) / 3);
  const C = CHART.adagrad;
  return {
    type: 'adagrad', kind: 'panels',
    panels: [
      lineSpec('adagrad', { label: C.x, from: 1, to: E }, { label: C.y, min: 0, max: r3(l0 * 1.08) }, [
        { key: 'train', label: C.train, role: 'train', values: loss },
      ], { guides: [{ y: r3(opt), label: C.optimum, role: 'guide' }] }),
      lineSpec('adagradStep', { label: C.x, from: 1, to: E }, { label: C.y2, log: true, min: 0.001, max: 1 }, [
        { key: 'step', label: C.step, role: 'aux', values: rel.map((v) => Number(v.toPrecision(3))) },
      ], { short: true }),
    ],
    facts: { E, pct: `${(rel[E - 1] * 100).toFixed(1)} %`, flat: f2(Math.abs(loss[third] - loss[E - 1])), gap: f2(loss[E - 1] - opt), opt: f2(opt) },
  };
}

function sweep(rand) {
  const up = rand.pick([0.01, 0.1, 1]);
  const lu = Math.log10(up);
  const n = 125; // one point per 4 of the 500 iterations
  const l0 = uni(rand, 2.0, 2.4);
  const lmin = uni(rand, 0.25, 0.4);
  const xs = range(n, (i) => 10 ** (-5 + (6 * i) / (n - 1)));
  const L = xs.map((x) => {
    const lx = Math.log10(x);
    let v;
    if (lx <= lu) {
      const t = Math.min(1, Math.max(0, (lx + 5) / (lu - 0.6 + 5)));
      v = lmin + (l0 - lmin) * (1 - t * t * (3 - 2 * t));
    } else v = lmin * (1 + 40 * (lx - lu) ** 1.4);
    return r3(v + 0.006 * rand.normal());
  });
  const C = CHART.sweep;
  return lineSpec('sweep', { label: C.x, from: 1e-5, to: 10, log: true }, { label: C.y, min: 0, max: r3(l0 * 1.5) }, [
    { key: 'train', label: C.train, role: 'train', values: L, xs: xs.map((x) => Number(x.toPrecision(4))) },
  ], { clipTop: true, facts: { up: fmtRate(up), ans: fmtRate(up / 10), lmin: f2(lmin), upValue: up } });
}

function gradBars(rand, dx) {
  const L = rand.int(6, 9);
  const top = uni(rand, 0.4, 1.2);
  const r = dx === 'vanishing' ? uni(rand, 0.12, 0.3) : uni(rand, 3.5, 7);
  const vals = range(L, (i) => Number((top * r ** (L - 1 - i) * (1 + 0.08 * rand.normal())).toPrecision(3)));
  const C = CHART.gradBars;
  const ratio = dx === 'vanishing' ? vals[L - 1] / vals[0] : vals[0] / vals[L - 1];
  return {
    type: 'gradBars', kind: 'bars', x: { label: C.x }, y: { label: C.y, log: true },
    bars: vals.map((v, i) => ({ label: String(i + 1), value: v })),
    facts: { L, first: sci(vals[0]), last: sci(vals[L - 1]), ratio: sci(ratio) },
  };
}

function deadBars(rand) {
  const n = 24;
  const dead = rand.int(9, 14);
  const set = new Set(rand.shuffle(range(n, (i) => i)).slice(0, dead));
  const C = CHART.deadBars;
  return {
    type: 'deadBars', kind: 'bars', x: { label: C.x }, y: { label: C.y, min: 0, max: 1 }, tickEvery: 4,
    bars: range(n, (i) => ({ label: String(i + 1), value: set.has(i) ? 0 : Math.round(uni(rand, 0.2, 0.88) * 100) / 100, flag: set.has(i) })),
    flagLabel: C.dead,
    facts: { n, dead },
  };
}

function forecast(rand) {
  const T = 28;
  const off = rand.int(0, 6);
  const peak = rand.int(0, T - 1 - 7);
  const truth = range(T, (i) => {
    const weekend = (i + off) % 7 >= 5;
    return Math.round((weekend ? uni(rand, 0.35, 0.6) : uni(rand, 1.12, 1.32)) * 100) / 100;
  });
  // one weekday reaches about 1.4 (slide 26: values from 0 to about 1.4)
  let k = peak;
  while ((k + off) % 7 >= 5) k++;
  truth[k] = Math.round(uni(rand, 1.36, 1.42) * 100) / 100;
  // SimpleRNN(1): one tanh unit, so every output lies strictly between −1 and +1
  const pred = truth.map((v) => Math.round(0.98 * Math.tanh(1.5 * v + 0.05 * rand.normal()) * 100) / 100);
  const C = CHART.forecast;
  return lineSpec('forecast', { label: C.x, from: 1, to: T }, { label: C.y, min: 0, max: 1.6 }, [
    { key: 'truth', label: C.truth, role: 'truth', values: truth },
    { key: 'pred', label: C.pred, role: 'pred', values: pred },
  ], {
    guides: [{ y: 1, label: '1.0', role: 'guide' }],
    facts: { min: f2(Math.min(...truth)), max: f2(Math.max(...truth)), pmin: f2(Math.min(...pred)), pmax: f2(Math.max(...pred)) },
  });
}

function stateGrowth(rand) {
  const T = rand.int(24, 34);
  const rho = uni(rand, 1.35, 1.6);
  const y0 = uni(rand, 0.5, 1.5);
  const v = range(T, (t) => Number((y0 * rho ** t * Math.exp(0.08 * rand.normal())).toPrecision(3)));
  const C = CHART.stateGrowth;
  return lineSpec('stateGrowth', { label: C.x, from: 1, to: T }, { label: C.y, log: true, min: 0.1, max: 10 ** Math.ceil(Math.log10(Math.max(...v))) }, [
    { key: 'size', label: C.series, role: 'aux', values: v },
  ], { facts: { T, first: sci(v[0]), last: sci(v[T - 1]), ratio: sci(v[T - 1] / v[0]) } });
}

function trace(rand) {
  const T = rand.int(20, 30);
  const rho = uni(rand, 0.55, 0.72);
  const vals = range(T, (t) => Number((rho ** (T - 1 - t)).toPrecision(3)));
  const C = CHART.trace;
  return {
    type: 'trace', kind: 'bars', x: { label: C.x }, y: { label: C.y, min: 0, max: 1 }, tickEvery: 5,
    bars: vals.map((v, i) => ({ label: String(i + 1), value: v })),
    facts: { T, first: sci(vals[0]), last: sci(vals[T - 1]) },
  };
}

const anchor4 = (id) => A4.find((a) => a.id === id).value;
function maeBars() {
  const C = CHART.maeBars;
  const shallow = anchor4('l4.mae.univar'); // slide 26
  const deep = anchor4('l4.mae.deep'); // slide 29
  return {
    type: 'maeBars', kind: 'bars', x: { label: C.x }, y: { label: C.y, min: 0, max: 32000 }, wide: true, fromSlides: true,
    bars: [
      { label: 'univar_model', sub: 'SimpleRNN(32) + Dense(1)', value: shallow },
      { label: 'deep_model', sub: '3 × SimpleRNN(32) + Dense(1)', value: deep },
    ],
    facts: { shallow: shallow.toLocaleString('en-AU'), deep: deep.toLocaleString('en-AU') },
  };
}

function aeCopy(rand) {
  const train = Number(uni(rand, 0.0004, 0.0015).toPrecision(2));
  const fresh = Number(uni(rand, 0.035, 0.07).toPrecision(2));
  const w = rand.pick([500, 1000, 2000]);
  const depth = rand.int(3, 4);
  const C = CHART.reconBars;
  const hidden = `${depth} × ${fill(CODE.aeCopy.dense, { w })}`;
  return {
    type: 'aeCopy', kind: 'bars', x: { label: C.x }, y: { label: C.y, min: 0, max: Number((fresh * 1.2).toPrecision(2)) }, wide: true,
    bars: [{ label: C.train, value: train }, { label: C.fresh, value: fresh }],
    code: { title: CODE.aeCopy.title, lines: [{ text: fill(CODE.aeCopy.encoder, { hidden }) }, { text: fill(CODE.aeCopy.decoder, { hidden }) }] },
    facts: { train: String(train), fresh: String(fresh), w, depth, coding: 1 },
  };
}

function classHist(rand) {
  const top = rand.int(82, 94);
  const c = rand.int(0, 9);
  const others = range(10, (i) => (i === c ? 0 : rand.next()));
  const sum = others.reduce((a, b) => a + b, 0);
  const counts = others.map((v) => Math.floor(((100 - top) * v) / sum));
  let left = 100 - top - counts.reduce((a, b) => a + b, 0);
  for (let i = 0; left > 0; i = (i + 1) % 10) if (i !== c) { counts[i]++; left--; }
  counts[c] = top;
  const C = CHART.classHist;
  return {
    type: 'classHist', kind: 'bars', x: { label: C.x }, y: { label: C.y, min: 0, max: 100 },
    bars: counts.map((v, i) => ({ label: WORDS.classes[i], value: v })),
    facts: { top, rest: 100 - top, cls: WORDS.classes[c] },
  };
}

function oscillate(rand) {
  const N = 120;
  const period = uni(rand, 18, 28);
  const w = (2 * Math.PI) / period;
  const A = uni(rand, 0.6, 1.0);
  const grow = uni(rand, 0, 0.4);
  const ph = uni(rand, 0, 2 * Math.PI);
  const g = range(N, (t) => r3(A * (1 + (grow * t) / N) * Math.sin(w * t + ph) + 0.02 * rand.normal()));
  const d = range(N, (t) => r3(0.8 * A * (1 + (grow * t) / N) * Math.sin(w * t + ph + Math.PI / 2) + 0.02 * rand.normal()));
  const amp = (a) => (Math.max(...a) - Math.min(...a)) / 2;
  let turns = 0;
  for (let t = 1; t < N; t++) if (Math.sign(g[t]) !== Math.sign(g[t - 1]) && g[t] !== 0) turns++;
  const C = CHART.oscillate;
  return lineSpec('oscillate', { label: C.x, from: 1, to: N }, { label: C.y, min: -1.6, max: 1.6 }, [
    { key: 'g', label: C.g, role: 'gen', values: g },
    { key: 'd', label: C.d, role: 'disc', values: d },
  ], { guides: [{ y: 0, label: '0', role: 'zero' }], facts: { turns, amp1: f2(amp(g.slice(0, N / 3))), amp3: f2(amp(g.slice((2 * N) / 3))) } });
}

function attnHeat(rand) {
  const tok = WORDS.decoderInput;
  const n = tok.length;
  const rows = range(n, (i) => {
    let w = softmax(range(n, () => 1.1 * rand.normal()));
    for (let tries = 0; i < n - 1 && w.slice(i + 1).reduce((a, b) => a + b, 0) < 0.3 && tries < 40; tries++) {
      w = softmax(range(n, (j) => 1.1 * rand.normal() + (j > i ? 0.8 : 0)));
    }
    return w.map((x) => Math.round(x * 100) / 100);
  });
  const qi = rand.int(1, 3);
  const later = rows.map((r, i) => r.slice(i + 1).reduce((a, b) => a + b, 0));
  const C = CHART.attnHeat;
  return {
    type: 'attnHeat', kind: 'heat', rows: tok, cols: tok, values: rows, rowsLabel: C.rows, colsLabel: C.cols,
    facts: { qi, q: tok[qi], pct: pct(later[qi]), rows: tok.slice(0, n - 1).map((t, i) => `${t} ${pct(later[i])}`).join(', ') },
  };
}

function softmaxHeat(rand) {
  const d = rand.pick([64, 128, 256, 512]);
  const nq = rand.int(3, 4);
  const nk = rand.int(5, 6);
  const K = range(nk, () => range(d, () => rand.normal()));
  const scoreRow = (q) => K.map((k) => k.reduce((s, x, i) => s + x * q[i], 0));
  const rows = range(nq, () => {
    let sc = scoreRow(range(d, () => rand.normal()));
    for (let t = 0; t < 60 && Math.max(...softmax(sc)) < 0.97; t++) sc = scoreRow(range(d, () => rand.normal()));
    return sc;
  });
  const sq = Math.sqrt(d);
  const W = rows.map((sc) => softmax(sc).map((x) => Math.round(x * 1000) / 1000));
  const S = rows.map((sc) => softmax(sc.map((x) => x / sq)));
  const maxes = W.map((r) => Math.max(...r));
  const smax = S.map((r) => Math.max(...r));
  const all = rows.flat();
  const C = CHART.softmaxHeat;
  return {
    type: 'softmaxHeat', kind: 'heat', rows: range(nq, (i) => fill(C.row, { i: i + 1 })), cols: range(nk, (j) => fill(C.col, { j: j + 1, i: j + 1 })),
    values: W, rowsLabel: C.rows, colsLabel: C.cols,
    facts: {
      d, nq, nk, sq: Number(sq.toPrecision(3)), lo: Math.min(...all).toFixed(1), hi: Math.max(...all).toFixed(1),
      min: pct(Math.min(...maxes)), maxes: maxes.map(pct).join(', '), scaledMaxes: smax.map(pct).join(', '),
      scaled: pct(smax.reduce((a, b) => a + b, 0) / smax.length),
      scaledMaxList: smax.map((x) => Math.round(x * 1000) / 1000),
    },
  };
}

function strips(rand) {
  const vec = range(8, () => Math.round(uni(rand, -1, 1) * 100) / 100);
  const C = CHART.strips;
  return {
    type: 'strips', kind: 'heat', signed: true, rows: WORDS.phrases, cols: range(8, (i) => String(i + 1)), values: WORDS.phrases.map(() => vec.slice()),
    rowsLabel: C.rows, colsLabel: C.cols, facts: { vec: vecText(vec) },
  };
}

function encdec() {
  const { encoderInput: src, decoderInput: din, decoderOutput: dout, trace: tr } = WORDS;
  const encAfter = src.length - 1 - tr.from;
  const decSteps = tr.to;
  return {
    type: 'encdec', kind: 'encdec', src, din, dout, from: tr.from, to: tr.to,
    facts: { encAfter, decSteps, path: encAfter + 1 + decSteps },
  };
}

function rnn1Summary() {
  const params = simpleRnnParams(1, 1);
  return { type: 'rnn1Summary', kind: 'code', fromSlides: true, title: CODE.rnn1Summary.title, lines: CODE.rnn1Summary.lines.map((t) => ({ text: fill(t, { params }) })), units: 1, params, facts: { params } };
}

function bigKernel(rand) {
  const h = rand.pick([64, 96, 128]);
  const f1 = rand.pick([32, 64]);
  const c = rand.pick([64, 128]);
  const K = CODE.bigKernel;
  const p1 = conv2dParams(5, 3, f1);
  const p3 = conv2dParams(3, f1, c);
  const p5 = conv2dParams(5, c, c);
  const layers = [
    { text: fill(K.input, { h }) },
    { text: fill(K.first, { f1 }), conv: { k: 5, strides: 2, cin: 3, filters: f1 }, params: p1, short: `Conv2D(${f1}, 5, strides=2)` },
    { text: K.pool, params: 0 },
    { text: fill(K.conv3, { c }), conv: { k: 3, strides: 1, cin: f1, filters: c }, params: p3, short: `Conv2D(${c}, 3)` },
    { text: fill(K.conv5, { c }), conv: { k: 5, strides: 1, cin: c, filters: c }, params: p5, short: `Conv2D(${c}, 5)` },
    { text: K.pool, params: 0 },
  ].map((l, i) => ({ ...l, n: i + 1, comment: l.params !== undefined ? fill(K.params, { n: l.params.toLocaleString('en-AU') }) : null }));
  const bad = layers.findIndex((l, i) => l.conv && l.conv.k >= 5 && i !== layers.findIndex((m) => m.conv));
  return {
    type: 'bigKernel', kind: 'code', title: K.title, close: K.close, lines: layers,
    facts: { line: layers[bad].n, c, one: p5.toLocaleString('en-AU'), two: (2 * conv2dParams(3, c, c)).toLocaleString('en-AU'), oneN: p5, twoN: 2 * conv2dParams(3, c, c) },
  };
}

function fewLabels() {
  return { type: 'fewLabels', kind: 'code', fromSlides: true, title: CODE.fewLabels.title, lines: CODE.fewLabels.lines.map((t) => ({ text: t })), labelled: 200, similarModel: true, facts: {} };
}

const GEN = {
  overfit, diverge, slow, spiky, adagrad, sweep, gradBars, deadBars, forecast, stateGrowth, trace, maeBars, aeCopy, classHist,
  oscillate, attnHeat, softmaxHeat, strips, encdec, rnn1Summary, bigKernel, fewLabels,
};
export const CHART_TYPES = Object.keys(GEN);
export function makeChart(rand, type, dx) {
  const c = GEN[type](rand, dx);
  return { ...c, drawer: (DRAWER[type] ?? []).map((t) => fill(t, c.facts)), tex: TEX[type] ?? [] };
}

/* the slide equations a chart's drawer shows (from the slide readers' files) */
const TEX = {
  adagrad: EQ2.adagrad.tex,
  gradBars: [EQ2.logistic.tex[0], EQ2.glorotNormal.tex[0]],
  deadBars: [EQ2.relu.tex[0], EQ2.leakyRelu.tex[0]],
  softmaxHeat: EQ8.sdpa.tex,
};

/* chart families (diagnosis distractors prefer the same family, so the chart has to be read) */
export const FAMILY = {
  overfit: 'line', diverge: 'line', slow: 'line', spiky: 'line', adagrad: 'line', forecast: 'line', stateGrowth: 'line', oscillate: 'line', sweep: 'line',
  gradBars: 'bars', deadBars: 'bars', trace: 'bars', maeBars: 'bars', aeCopy: 'bars', classHist: 'bars',
  attnHeat: 'heat', softmaxHeat: 'heat', strips: 'heat',
  rnn1Summary: 'code', bigKernel: 'code', fewLabels: 'code', encdec: 'code',
};

/* ── choices ────────────────────────────────────────────────────────────── */
/** the diagnoses never offered as a wrong answer for `dx` (symmetric) */
export function avoidSet(dx) {
  const out = new Set(DIAGNOSES[dx].avoid);
  Object.entries(DIAGNOSES).forEach(([k, d]) => { if (d.avoid.includes(dx)) out.add(k); });
  return out;
}
const DX_FAMILY = {};
const DX_LECTURES = {};
CASES.forEach((c) => {
  DX_FAMILY[c.dx] = FAMILY[c.chart];
  (DX_LECTURES[c.dx] ??= new Set()).add(c.lecture);
});

function top3(rand, keys, score) {
  return keys.map((k) => ({ k, s: score(k) + rand.next() })).sort((a, b) => b.s - a.s).slice(0, 3).map((x) => x.k);
}

export function dxChoices(rand, c) {
  const bad = avoidSet(c.dx);
  const cands = Object.keys(DIAGNOSES).filter((k) => k !== c.dx && !bad.has(k));
  const picks = top3(rand, cands, (k) => (DX_FAMILY[k] === FAMILY[c.chart] ? 2 : 0) + (DX_LECTURES[k]?.has(c.lecture) ? 1 : 0));
  return rand.shuffle([c.dx, ...picks]).map((k) => ({ value: k, label: DIAGNOSES[k].label }));
}

/** fixes that may be offered as WRONG options for a case whose failure is `dx` */
export function eligibleWrongFixes(dx, answer, own = []) {
  return Object.keys(FIXES).filter((k) => k !== answer && !own.includes(k) && !FIXES[k].treats.includes(dx) && !FIXES[k].avoid.includes(dx));
}

export function fixChoices(rand, c, dx, answer, { own = Object.keys(c.rx ?? {}), force = [] } = {}) {
  const cands = eligibleWrongFixes(dx, answer, own).filter((k) => !force.includes(k));
  const picks = [...force, ...top3(rand, cands, (k) => (FIXES[k].src.lecture === c.lecture ? 2 : 0))].slice(0, 3);
  return rand.shuffle([answer, ...picks]).map((k) => ({ value: k, label: FIXES[k].label }));
}

/* ── picking the patients ───────────────────────────────────────────────── */
const hasFu = (c) => !!(c.fu || c.fuBy);
export function pickCases(rand, level, n = ROUND[level]) {
  const pool = rand.shuffle(CASES.filter((c) => c.levels.includes(level) && (level < 3 || (c.rx && hasFu(c)))));
  const out = [];
  const dx = new Set();
  const groups = new Set();
  const lectures = new Set();
  for (const pass of [0, 1]) {
    for (const c of pool) {
      if (out.length >= n) break;
      if (out.includes(c) || dx.has(c.dx) || (c.group && groups.has(c.group))) continue;
      if (pass === 0 && lectures.has(c.lecture)) continue;
      out.push(c);
      dx.add(c.dx);
      if (c.group) groups.add(c.group);
      lectures.add(c.lecture);
    }
  }
  // the round ramps: easier patients first (stable: ties keep the shuffled order)
  return out.map((c, i) => ({ c, i })).sort((a, b) => a.c.hard - b.c.hard || a.i - b.i).map((x) => x.c);
}

/* ── follow-ups (level 3) ───────────────────────────────────────────────── */
function fuItem(rand, c, fu, chart, base) {
  const facts = chart.facts;
  const it = { ...base, concept: fu.concept, src: fu.src, why: fill(fu.why, facts) };
  const choice = (opts, answer, prompt = fu.prompt) => ({
    ...it, kind: 'choice', prompt: fill(prompt, facts), promptText: fill(prompt, facts),
    choices: rand.shuffle(opts), answer,
  });
  switch (fu.type) {
    case 'pick':
      return choice(fu.choices.map((o) => ({ value: o.key, label: o.label })), fu.answer);
    case 'stopEpoch': {
      const { best, stop, E } = facts;
      const opts = [...new Set([stop, best, best + 1, E])].map((e) => ({ value: `e${e}`, label: fill(fu.label, { n: e }) }));
      return choice(opts, `e${stop}`);
    }
    case 'sweep': {
      const chart2 = makeChart(rand, 'sweep');
      const up = chart2.facts.upValue;
      const opts = [up / 100, up / 10, up, up * 10].map((v, i) => ({ value: `r${i}`, label: fill(fu.label, { v: fmtRate(v) }) }));
      return { ...choice(opts, 'r1'), chart2, why: fill(fu.why, chart2.facts) };
    }
    case 'clip': {
      const n = rand.int(2, 3);
      const g = range(n, (i) => {
        const big = i === 0 ? true : i === 1 ? false : rand.chance(0.5);
        const v = big ? uni(rand, 1.5, 4.5) : uni(rand, 0.1, 0.9);
        return Math.round((rand.chance(0.5) ? -v : v) * 100) / 100;
      });
      const gs = rand.shuffle(g);
      const clipped = gs.map((v) => Math.max(-1, Math.min(1, v)));
      const norm = Math.sqrt(gs.reduce((s, v) => s + v * v, 0));
      const scaled = gs.map((v) => Math.round((v / norm) * 100) / 100);
      const signs = gs.map((v) => (v < 0 ? -1 : 1));
      const opts = [
        { value: 'clipped', label: vecText(clipped) },
        { value: 'scaled', label: vecText(scaled) },
        { value: 'signs', label: vecText(signs) },
        { value: 'same', label: vecText(gs) },
      ];
      const v = { g: gs.map(f2).join(', '), c: clipped.map(f2).join(', ') };
      return { ...choice(opts, 'clipped', fill(fu.prompt, v)), why: fill(fu.why, v), clip: { g: gs, clipped, scaled } };
    }
    case 'adagradS': {
      const g1 = rand.int(2, 6);
      let g2 = rand.int(2, 6);
      if (g2 === g1) g2 = g1 === 6 ? 2 : g1 + 1;
      const a = g1 * g1;
      const b = g2 * g2;
      const s = a + b;
      const r = (1 - RHO) * a * RHO + (1 - RHO) * b; // RMSProp: s₁ = 0.1a; s₂ = 0.9·s₁ + 0.1b
      const v = { g1, g2, a, b, s, r: Number(r.toFixed(2)) };
      const opts = [
        { value: 's', label: String(s) },
        { value: 'sum', label: String(g1 + g2) },
        { value: 'rms', label: String(Number(r.toFixed(2))) },
        { value: 'root', label: f2(Math.sqrt(s)) },
      ];
      return { ...choice(opts, 's', fill(fu.prompt, v)), why: fill(fu.why, v), adagradS: v };
    }
    case 'order': {
      const answer = fu.cards.map((k) => k.id);
      let cards = rand.shuffle(fu.cards);
      for (let t = 0; t < 6 && cards.every((k, i) => k.id === answer[i]); t++) cards = rand.shuffle(fu.cards);
      if (cards.every((k, i) => k.id === answer[i])) cards = [...cards.slice(1), cards[0]];
      const text = Object.fromEntries(fu.cards.map((k) => [k.id, k.text]));
      return {
        ...it, kind: 'custom', input: 'order', prompt: fu.prompt, promptText: fu.prompt,
        cards: cards.map((k) => ({ id: k.id, text: k.text })), answer, check: sameOrder(answer),
        format: (val) => (Array.isArray(val) ? val.map((id) => text[id] ?? id).join(' → ') : '—'),
      };
    }
    case 'slots': {
      const answer = fu.answer.slice();
      let cards = rand.shuffle(fu.cards);
      if (cards.every((k, i) => k.id === answer[i])) cards = [...cards.slice(1), cards[0]];
      const text = Object.fromEntries(fu.cards.map((k) => [k.id, k.text]));
      return {
        ...it, kind: 'custom', input: 'slots', prompt: fu.prompt, promptText: fu.prompt, slots: fu.slots,
        cards: cards.map((k) => ({ id: k.id, text: k.text })), answer, check: sameOrder(answer),
        format: (val) => (Array.isArray(val) ? val.map((id, i) => `${fu.slots[i]}: ${text[id] ?? id}`).join(' · ') : '—'),
      };
    }
    case 'keepLayer': {
      const convs = chart.lines.filter((l) => l.conv);
      const opts = convs.map((l) => ({ value: `line${l.n}`, label: fill(fu.label, { line: l.n, code: l.short }) }));
      return choice(opts, `line${convs[0].n}`);
    }
    case 'rx2': {
      const chart2 = makeChart(rand, fu.chart);
      const choices = fixChoices(rand, c, fu.dx, fu.fix, { own: [], force: ['denseOut'] });
      return { ...it, kind: 'choice', prompt: fu.prompt, promptText: fu.prompt, choices, answer: fu.fix, chart2, fuDx: fu.dx };
    }
    case 'maskSet': {
      const tok = WORDS.decoderInput;
      const qi = facts.qi;
      const allowed = causalMask(tok.length)[qi].map((ok, j) => (ok ? j : -1)).filter((j) => j >= 0);
      const sets = {
        allowed,
        self: [qi],
        after: range(tok.length - qi, (k) => qi + k),
        all: range(tok.length, (j) => j),
      };
      const label = (s) => s.map((j) => tok[j]).join(', ');
      const opts = Object.entries(sets).map(([k, s]) => ({ value: k, label: label(s) }));
      const v = { ...facts, set: label(allowed) };
      return { ...choice(opts, 'allowed', fill(fu.prompt, v)), why: fill(fu.why, v), maskSet: sets };
    }
    case 'shape': {
      const { nq, nk, d } = facts;
      const shapes = { qk: [nq, nk], kq: [nk, nq], qd: [nq, d], kd: [nk, d] };
      const opts = Object.entries(shapes).map(([k, s]) => ({ value: k, label: `[${s.join(', ')}]` }));
      return { ...choice(opts, 'qk'), shapes };
    }
    default:
      throw new Error(`unknown follow-up type ${fu.type}`);
  }
}

/* ── the round ──────────────────────────────────────────────────────────── */
export function makeItems(rand, level = 1) {
  const L = [1, 2, 3].includes(Number(level)) ? Number(level) : 1;
  const cases = pickCases(rand, L);
  const items = [];
  cases.forEach((c, n) => {
    const chart = makeChart(rand, c.chart, c.dx);
    const facts = chart.facts;
    const steps = L === 1 || !c.rx ? ['dx'] : L === 2 ? ['dx', 'rx'] : ['dx', 'rx', 'fu'];
    const rxKeys = c.rx ? Object.keys(c.rx) : [];
    const rxPool = L === 3 && c.fuRx ? c.fuRx : rxKeys;
    const rxKey = rxPool.length ? rand.pick(rxPool) : null;
    const complaint = fill(c.complaint, facts);
    const caseKey = `oc${L}-${n + 1}-${c.id}`;
    const base = {
      caseKey, caseId: c.id, caseN: n + 1, caseTotal: cases.length, lecture: c.lecture, steps, chart, complaint,
    };
    const dxLabel = DIAGNOSES[c.dx].label;
    const rxLabel = rxKey ? FIXES[rxKey].label : null;
    steps.forEach((step, si) => {
      const head = { ...base, id: `${caseKey}-${step}`, step, stepIndex: si, record: { dx: si > 0 ? dxLabel : null, rx: si > 1 ? rxLabel : null } };
      if (step === 'dx') {
        items.push({
          ...head, kind: 'choice', concept: c.dxConcept ?? DIAGNOSES[c.dx].concept, src: c.dxSrc,
          prompt: PROMPTS.dx, promptText: `${PROMPTS.dx} ${complaint}`,
          choices: dxChoices(rand, c), answer: c.dx, why: fill(c.dxWhy, facts), dx: c.dx,
        });
      } else if (step === 'rx') {
        items.push({
          ...head, kind: 'choice', concept: FIXES[rxKey].concept, src: c.rx[rxKey].src,
          prompt: PROMPTS.rx, promptText: `${PROMPTS.rx} (${dxLabel})`,
          choices: fixChoices(rand, c, c.dx, rxKey), answer: rxKey, why: fill(c.rx[rxKey].why, facts), dx: c.dx,
        });
      } else {
        const fu = c.fuBy ? c.fuBy[rxKey] : c.fu;
        items.push({ ...fuItem(rand, c, fu, chart, head), fuType: fu.type, dx: c.dx });
      }
    });
  });
  return items;
}
