/* ============================================================================
   SIGNAL KEEPER — MATHS + ROUND GENERATOR (pure, seeded; Lecture 2 slides 5–29)
   ----------------------------------------------------------------------------
   The stack simulation lives in maths/signalKeeperSim.js (re-exported here).
   This file holds the hand-computable maths the items ask for and builds a
   round from content/signal-keeper.js:

     glorotVariance(fin, fout) = 1/fan_avg, glorotLimit = √(3/fan_avg)   slide 7
     heVariance(fin) = 2/fan_in, lecunVariance(fin) = 1/fan_in           slide 8
     leakyRelu(z, α) = max(αz, z)                                        slide 11
     eluFloor(α) = −α, seluFloor = −s·α                                  slides 15–16
     bnBatch(xs, γ, β, ε = 0) → { mu, var, xhat[], z[] }                 slide 24
     clipValue(g, t) (slide 29), clipNorm(g, t) (Keras's rescaling: beyond the slide)

     makeItems(rand, level)  10 items:
       level 1  Table 11-1 on a sick stack, slide 22's activation choice, the
                vanishing/exploding read-out, Glorot/He/LeCun by hand
       level 2  + SELU's constraints (exact set), SELU/ELU/leaky ReLU formulas,
                curves, α values, floors
       level 3  + BatchNorm by hand, its parameters and placement, BN healing a
                bad-init stack, clipvalue by hand (clipnorm by hand is beyond)
   Every item: { id, concept, src, kind, answer, why, promptText, prompt,
   scene, maths?, choices?, check?, tol?, format?, beyond?, note? }.
   ========================================================================== */
import { simulate, verdict, glorotLimit as limitOf, fanAvg, SELU_S, SELU_ALPHA, ACT_FNS } from './signalKeeperSim.js';
import {
  ACTS, INITS, TABLE, SIM, SCENES, TEXT, WHICH_ACT, FAN_PAIRS, SELU, CURVES, LEAKY, BN, CLIP, CHOICE_ITEMS, MATHS,
} from '../content/signal-keeper.js';

export { simulate, verdict, fanAvg };
export const ROUND_SIZE = 10;

/* ── number helpers ───────────────────────────────────────────────────── */
export const clean = (x, d = 10) => {
  const v = Math.round(x * 10 ** d) / 10 ** d;
  return Object.is(v, -0) ? 0 : v;
};
// plain text: Unicode minus, no float noise
export const fmt = (x) => {
  if (x === null || x === undefined || x === '' || Number.isNaN(Number(x))) return '—';
  const v = clean(Number(x), 8);
  const s = String(v);
  return s.startsWith('-') ? `−${s.slice(1)}` : s;
};
// inside $…$ (KaTeX takes an ASCII minus)
const tx = (x) => String(clean(Number(x), 8));
export const fmtVec = (v) => `(${v.map(fmt).join(', ')})`;
const txVec = (v) => `(${v.map(tx).join(', ')})`;
// a ratio for the why card: 2 significant figures, or a power of ten when far from 1
export function fmtRatio(r) {
  if (r >= 1000 || r < 0.01) {
    const e = Math.floor(Math.log10(r));
    const m = r / 10 ** e;
    return `$${m.toFixed(1)} \\times 10^{${e}}$`;
  }
  return Number(r.toPrecision(2)).toString();
}
export const fill = (tpl, vars) => String(tpl).replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined ? String(vars[k]) : m));

/* ── the slides' formulas ─────────────────────────────────────────────── */
export const glorotVariance = (fin, fout) => clean(1 / fanAvg(fin, fout));      // slide 7
export const glorotLimit = (fin, fout) => clean(limitOf(fin, fout));            // slide 7
export const heVariance = (fin) => clean(2 / fin);                               // slide 8
export const lecunVariance = (fin) => clean(1 / fin);                            // slide 8
export const tableInit = (act) => Object.keys(TABLE).find((k) => Array.isArray(TABLE[k]) && TABLE[k].includes(act)); // slide 8
export const leakyRelu = (z, alpha) => clean(Math.max(alpha * z, z));            // slide 11
export const eluFloor = (alpha) => -alpha;                                       // slide 15: α(exp(z) − 1) → −α
export const seluFloor = () => clean(-SELU_S * SELU_ALPHA, 6);                   // slide 16: s·ELU_α → −s·α

/* an activation's value for the curve pictures, with the slides' α where
   the function takes one (slide 11 leaky ReLU, slide 15 ELU); the rest are
   the simulation's own functions (SELU with slide 16's s and α) */
export function actValue(act, z, alpha = null) {
  if (act === 'leaky') return Math.max((alpha ?? 0.2) * z, z);
  if (act === 'elu') return z < 0 ? (alpha ?? 1) * (Math.exp(z) - 1) : z;
  return ACT_FNS[act].f(z);
}
export function curvePoints(act, alpha, z0 = -4, z1 = 4, n = 161) {
  return Array.from({ length: n }, (_, i) => {
    const z = z0 + ((z1 - z0) * i) / (n - 1);
    return [z, actValue(act, z, alpha)];
  });
}

// slide 24, one feature, ε = 0 unless given (the slide gives ε no value)
export function bnBatch(xs, gamma = 1, beta = 0, eps = 0) {
  const m = xs.length;
  const mu = xs.reduce((s, x) => s + x, 0) / m;
  const v = xs.reduce((s, x) => s + (x - mu) ** 2, 0) / m;
  const xhat = xs.map((x) => (x - mu) / Math.sqrt(v + eps));
  const z = xhat.map((h) => gamma * h + beta);
  return { m, mu: clean(mu), var: clean(v), xhat: xhat.map((h) => clean(h)), z: z.map((q) => clean(q)) };
}

// slide 29: clipvalue clips every component to [−t, t]
export const clipValue = (g, t = 1) => g.map((x) => clean(Math.max(-t, Math.min(t, x))));
// Keras's clipnorm (beyond the slide, which only says it keeps the orientation)
export const l2norm = (g) => Math.sqrt(g.reduce((s, x) => s + x * x, 0));
export function clipNorm(g, t = 1) {
  const n = l2norm(g);
  return n <= t ? g.map((x) => clean(x)) : g.map((x) => clean((x * t) / n));
}

/* ── item builders ────────────────────────────────────────────────────── */
const sortIds = (a) => a.slice().sort();
const sameSet = (given, answer) => Array.isArray(given) && given.length === answer.length && sortIds(given).every((v, i) => v === answer[i]);
const nearVec = (given, answer, tol) => Array.isArray(given) && given.length === answer.length && given.every((v, i) => v !== '' && v !== null && Number.isFinite(Number(v)) && Math.abs(Number(v) - answer[i]) <= tol + 1e-9);

const numberItem = (o) => ({ kind: 'number', tol: 1e-9, decimal: true, negative: false, format: (v) => fmt(v), ...o });
const choiceItem = (o) => ({ kind: 'choice', ...o });

function stackMaths(cfgs) {
  const lines = [];
  const seen = new Set();
  cfgs.filter(Boolean).forEach((c) => {
    const key = c.init === 'glorotUniform' ? 'glorot' : c.init;
    if (seen.has(key)) return;
    seen.add(key);
    if (key === 'glorot') lines.push({ k: 'Glorot, slide 7', tex: MATHS.glorot });
    else if (key === 'he') lines.push({ k: 'He, slide 8', tex: MATHS.he });
    else if (key === 'lecun') lines.push({ k: 'LeCun, slide 8', tex: MATHS.lecun });
    else if (key === 'n01') lines.push({ k: 'the old technique, slide 6', tex: ['\\mathcal{N}(0, 1):\\ \\sigma^2 = 1'] });
  });
  const own = [SIM.own];
  if (cfgs.some((c) => c && c.bn)) own.push(SIM.ownBn);
  return { lines, own };
}

function whichInit(R, n, cfg) {
  const ans = tableInit(cfg.act);
  const after = { act: cfg.act, init: ans };
  const actLabel = ACTS[cfg.act].label;
  const vars = { act: actLabel, initDesc: SCENES.initPrompt[cfg.init], init: INITS[ans].label, tex: INITS[ans].inline, more: TEXT.whichInit.more[ans] };
  return choiceItem({
    id: `whichInit-${n}`, tpl: 'whichInit', concept: 'init.which',
    src: { lecture: 2, slides: [...new Set([...TEXT.whichInit.src.slides, cfg.init === 'n01' ? 6 : 9])].sort((a, b) => a - b) },
    prompt: fill(TEXT.whichInit.prompt, vars),
    promptText: fill(TEXT.whichInit.prompt, vars),
    choices: ['glorot', 'he', 'lecun'].map((k) => ({ value: k, label: INITS[k].label, sub: INITS[k].sub })),
    answer: ans,
    why: fill(TEXT.whichInit.why, vars),
    scene: { type: 'stack', before: { ...cfg, bn: null }, after: { ...after, bn: null } },
    maths: stackMaths([cfg, after]),
  });
}

function whichInitRev(R, n, init) {
  const right = R.pick(TABLE[init]);
  const others = R.shuffle(Object.keys(TABLE).filter((k) => Array.isArray(TABLE[k]) && k !== init).flatMap((k) => TABLE[k])).slice(0, 3);
  const vars = { init: INITS[init].label, sub: INITS[init].sub };
  return choiceItem({
    id: `whichInitRev-${n}`, tpl: 'whichInitRev', concept: 'init.which', src: TEXT.whichInitRev.src,
    prompt: fill(TEXT.whichInitRev.prompt, vars), promptText: fill(TEXT.whichInitRev.prompt, vars),
    choices: R.shuffle([right, ...others]).map((a) => ({ value: a, label: ACTS[a].label })),
    answer: right,
    why: TEXT.whichInitRev.why,
    scene: { type: 'table', ask: init },
  });
}

function whichAct(R, n, cue) {
  const fix = WHICH_ACT.options[cue.answer].fix;
  return choiceItem({
    id: `whichAct-${n}`, tpl: 'whichAct', concept: 'act.which', src: WHICH_ACT.src,
    prompt: fill(TEXT.whichAct.prompt, { cue: cue.cue }), promptText: fill(TEXT.whichAct.prompt, { cue: cue.cue }),
    choices: R.shuffle([cue.answer, ...cue.others]).map((k) => ({ value: k, label: WHICH_ACT.options[k].label })),
    answer: cue.answer,
    why: cue.why,
    scene: { type: 'stack', before: { ...SCENES.oldStack, bn: null }, after: { ...fix, bn: null }, afterNote: fill(WHICH_ACT.after, { act: SIM.acts[fix.act], init: SIM.inits[fix.init] }) },
    maths: stackMaths([SCENES.oldStack, fix]),
  });
}

function diagnose(R, n, cfg) {
  const sim = simulate({ ...cfg, bn: null });
  const v = verdict(sim);
  const ratio = sim.layers[0].ratio;
  return choiceItem({
    id: `diagnose-${n}`, tpl: 'diagnose', concept: 'init.vanishing', src: TEXT.diagnose.src,
    prompt: TEXT.diagnose.prompt, promptText: TEXT.diagnose.prompt,
    choices: TEXT.diagnose.choices.map((c) => ({ ...c })),
    answer: v,
    why: fill(TEXT.diagnose.why[v], { ratio: fmtRatio(ratio), act: ACTS[cfg.act].label, init: SIM.inits[cfg.init] }),
    scene: { type: 'stack', before: { ...cfg, bn: null }, after: null, hideVerdict: true },
    maths: stackMaths([cfg]),
  });
}

function factItem(R, n, f, sceneOverride = null) {
  const scene = sceneOverride ?? (f.scene === 'culprit'
    ? { type: 'stack', before: { ...SCENES.culprit, bn: null }, after: null }
    : f.scene === 'code' ? { type: 'code', lines: f.code } : { type: f.scene });
  return choiceItem({
    id: `${f.id}-${n}`, tpl: f.id, concept: f.concept, src: f.src,
    prompt: f.prompt, promptText: f.prompt,
    choices: R.shuffle(f.choices).map((c) => ({ ...c })),
    answer: f.answer, why: f.why, scene,
    maths: scene.type === 'stack' ? stackMaths([scene.before, scene.after]) : null,
  });
}

/* the keypad items on one layer's initialisation */
function initCompute(R, n, kind) {
  let fin;
  let fout;
  if (kind === 'fanAvg' || kind === 'glorotVar') [fin, fout] = R.pick(FAN_PAIRS.glorotVar);
  else if (kind === 'glorotLimit') [fin, fout] = R.pick(FAN_PAIRS.glorotLimit);
  else {
    fin = R.pick(kind === 'heVar' ? FAN_PAIRS.heFanIn : FAN_PAIRS.lecunFanIn);
    fout = R.pick(FAN_PAIRS.fanOut.filter((f) => f !== fin));
  }
  if (R.chance(0.5) && (kind === 'fanAvg' || kind === 'glorotVar' || kind === 'glorotLimit')) [fin, fout] = [fout, fin];
  const favg = fanAvg(fin, fout);
  let answer;
  let concept = 'init.glorot';
  let init = 'glorot';
  let dist = 'normal';
  let act = null;
  if (kind === 'fanAvg') answer = favg;
  else if (kind === 'glorotVar') answer = glorotVariance(fin, fout);
  else if (kind === 'glorotLimit') { answer = glorotLimit(fin, fout); dist = 'uniform'; }
  else if (kind === 'heVar') { answer = heVariance(fin); concept = 'init.he'; init = 'he'; act = ACTS[R.pick(TABLE.he)].label; }
  else { answer = lecunVariance(fin); concept = 'init.lecun'; init = 'lecun'; }
  const vars = { fin, fout, favg, ans: tx(answer), act, r2: tx(clean(3 / favg)) };
  const T = TEXT[kind];
  const texs = init === 'glorot' ? MATHS.glorot : MATHS[init];
  return numberItem({
    id: `${kind}-${n}`, tpl: kind, concept, src: T.src,
    prompt: fill(T.prompt, vars), promptText: fill(T.prompt, vars),
    sub: kind === 'fanAvg' ? null : TEXT.decimalSub,
    decimal: kind !== 'fanAvg',
    answer,
    why: fill(T.why, vars),
    scene: { type: 'layer', fin, fout, init, dist, ask: kind },
    maths: { lines: [{ k: init === 'glorot' ? 'Glorot, slide 7' : `${INITS[init].label}, slide 8`, tex: texs }], own: [] },
  });
}

/* level 2 */
function seluConditions(R, n) {
  const opts = R.shuffle([...SELU.conditions, ...R.shuffle(SELU.distractors).slice(0, 3)]);
  const answer = sortIds(SELU.conditions.map((c) => c.id));
  const short = Object.fromEntries([...SELU.conditions, ...SELU.distractors].map((c) => [c.id, c.short]));
  return {
    id: `seluConditions-${n}`, tpl: 'seluConditions', concept: 'act.selu', src: SELU.src, kind: 'custom',
    prompt: SELU.prompt, promptText: SELU.promptText,
    options: opts.map((o) => ({ value: o.id, label: o.label })),
    answer,
    check: (given) => sameSet(given, answer),
    format: (v) => (Array.isArray(v) ? (v.length ? sortIds(v).map((id) => short[id] ?? id).join(' · ') : 'none picked') : '—'),
    why: SELU.why,
    scene: { type: 'checklist' },
  };
}

function seluConstants(R, n) {
  const C = SELU.constants;
  return choiceItem({
    id: `seluConstants-${n}`, tpl: 'seluConstants', concept: 'act.selu', src: { lecture: 2, slides: [16, 17] },
    prompt: C.prompt, promptText: C.promptText,
    choices: R.shuffle(C.choices).map((c) => ({ ...c })),
    answer: C.answer, why: C.why,
    scene: { type: 'curve', act: 'selu', also: { act: 'elu', alpha: 1 } },
  });
}

function curveName(R, n, plot) {
  return choiceItem({
    id: `curveName-${n}`, tpl: 'curveName', concept: plot.concept, src: plot.src,
    prompt: CURVES.namePrompt, promptText: `${CURVES.namePrompt} (${plot.label})`,
    choices: R.shuffle(CURVES.nameChoices).map((id) => ({ value: id, label: CURVES.plots.find((p) => p.id === id).label })),
    answer: plot.id, why: CURVES.nameWhy[plot.id],
    scene: { type: 'curve', act: plot.act, alpha: plot.alpha ?? null },
  });
}

function formulaName(R, n, f) {
  const trap = { selu: 'elu', elu: 'selu', leaky: 'relu' }[f.id];
  const pool = CURVES.formulas.filter((g) => g.id !== f.id && g.id !== trap);
  const others = [CURVES.formulas.find((g) => g.id === trap), ...R.shuffle(pool).slice(0, 2)];
  return choiceItem({
    id: `formulaName-${n}`, tpl: 'formulaName', concept: f.concept, src: f.src,
    prompt: CURVES.formulaPrompt, promptText: `${CURVES.formulaPrompt} (${f.label})`,
    choices: R.shuffle([f, ...others]).map((g) => ({ value: g.id, label: g.label })),
    answer: f.id, why: f.why,
    scene: { type: 'formula', tex: f.tex },
  });
}

function leakyAlpha(R, n, c) {
  return choiceItem({
    id: `leakyAlpha-${n}`, tpl: 'leakyAlpha', concept: 'act.leakyRelu', src: c.src,
    prompt: c.prompt, promptText: c.prompt,
    choices: LEAKY.alpha.choices.map((a) => ({ value: a, label: `α = ${a}` })),
    answer: c.answer, why: c.why,
    format: (v) => `α = ${v}`,
    scene: c.code ? { type: 'code', lines: c.code } : { type: 'formula', tex: ACTS.leaky.tex },
  });
}

function leakyValue(R, n) {
  const alpha = R.pick(LEAKY.value.alphas);
  const z = R.pick(LEAKY.value.zs);
  const ans = leakyRelu(z, alpha);
  const vars = { alpha, z: fmt(z), az: tx(clean(alpha * z)), ans: tx(ans) };
  const whyVars = { ...vars, z: tx(z) };
  return numberItem({
    id: `leakyValue-${n}`, tpl: 'leakyValue', concept: 'act.leakyRelu', src: LEAKY.value.src,
    prompt: fill(LEAKY.value.prompt, vars), promptText: fill(LEAKY.value.prompt, vars),
    negative: true, answer: ans,
    why: fill(LEAKY.value.why, whyVars),
    scene: { type: 'curve', act: 'leaky', alpha, mark: z },
  });
}

function eluFloorItem(R, n, c) {
  const prompt = fill(CURVES.floor.prompt, { name: c.name });
  return numberItem({
    id: `eluFloor-${n}`, tpl: 'eluFloor', concept: c.concept, src: c.src,
    prompt, promptText: prompt, negative: true, tol: c.tol,
    answer: c.act === 'selu' ? clean(seluFloor(), 3) : eluFloor(c.alpha),
    why: c.why,
    scene: { type: 'curve', act: c.act, alpha: c.alpha ?? null, floor: true },
  });
}

/* level 3 */
function bnItem(R, n, ask) {
  const dev = R.pick(BN.deviations);
  const mu = R.pick(BN.means);
  const xs = R.shuffle(dev.d.map((d) => mu + d));
  const gamma = R.pick(BN.gammas);
  const beta = R.pick(BN.betas);
  const b = bnBatch(xs, gamma, beta);
  // x̂ / z: ask about an instance away from the mean when there is one
  const idx = R.pick(xs.map((x, i) => i).filter((i) => xs[i] !== b.mu));
  const xi = xs[idx];
  const answer = ask === 'mu' ? b.mu : ask === 'var' ? b.var : ask === 'xhat' ? b.xhat[idx] : b.z[idx];
  const sum = xs.reduce((s, x) => s + x, 0);
  const sq = xs.reduce((s, x) => s + (x - b.mu) ** 2, 0);
  const vars = { m: xs.length, xs: fmtVec(xs).replace(/^\(/, '[').replace(/\)$/, ']'), xi: fmt(xi), gamma: fmt(gamma), beta: fmt(beta) };
  const whyVars = { m: xs.length, sum: tx(sum), sq: tx(sq), mu: tx(b.mu), var: tx(b.var), xi: tx(xi), xhat: tx(b.xhat[idx]), gamma: tx(gamma), beta: tx(beta), z: tx(b.z[idx]) };
  const prompt = fill(BN.prompts[ask], vars);
  return numberItem({
    id: `bn-${ask}-${n}`, tpl: `bn-${ask}`, concept: 'bn.algorithm', src: BN.src,
    prompt, promptText: prompt,
    sub: ask === 'xhat' || ask === 'z' ? BN.epsNote : null,
    negative: true,
    tol: ask === 'xhat' ? 0.005 : ask === 'z' ? 0.01 : 1e-9,
    answer,
    why: fill(BN.why[ask], whyVars),
    scene: { type: 'batch', xs, mu: b.mu, sd: Math.sqrt(b.var), xi: ask === 'xhat' || ask === 'z' ? xi : null, ask, gamma: ask === 'z' ? gamma : null, beta: ask === 'z' ? beta : null },
    maths: { lines: [{ k: 'Batch Normalization, slide 24', tex: MATHS.bn }], own: [MATHS.bnNote] },
  });
}

function bnCount(R, n, which) {
  const A = BN.count.asks[which];
  const nf = R.pick(BN.count.features);
  const ans = A.mult * nf;
  const prompt = fill(A.prompt, { n: nf.toLocaleString('en-AU') });
  return numberItem({
    id: `bnCount-${n}`, tpl: `bnCount-${which}`, concept: 'bn.params', src: BN.count.src,
    prompt, promptText: prompt, decimal: false, answer: ans,
    format: (v) => (v === '' || v === null || v === undefined ? '—' : Number(v).toLocaleString('en-AU')),
    why: fill(A.why, { n: nf.toLocaleString('en-AU'), ans: ans.toLocaleString('en-AU') }),
    scene: { type: 'params', n: nf, ask: which },
  });
}

function bnBenefit(R, n, b, cfg) {
  const after = { ...cfg, bn: 'before' };
  return choiceItem({
    id: `bnBenefit-${n}`, tpl: 'bnBenefit', concept: 'bn.benefits', src: BN.benefitSrc,
    prompt: b.prompt, promptText: b.prompt,
    choices: R.shuffle(b.choices).map((c) => ({ ...c })),
    answer: b.answer, why: b.why,
    scene: { type: 'stack', before: { ...cfg, bn: null }, after, afterNote: fill(BN.after, { bn: SIM.bn.before }) },
    maths: stackMaths([cfg, after]),
  });
}

function clipVector(R, n) {
  const k = R.pick([2, 3, 3]);
  const g = R.shuffle([R.pick(CLIP.inside), ...R.shuffle(CLIP.outside).slice(0, k - 1)]);
  const ans = clipValue(g, 1);
  const vars = { g: fmtVec(g) };
  return {
    id: `clipVector-${n}`, tpl: 'clipVector', concept: 'clip.gradient', src: CLIP.src, kind: 'custom',
    prompt: fill(CLIP.vectorPrompt, vars), promptText: CLIP.vectorPromptText,
    answer: ans, slots: ans.length,
    check: (given) => nearVec(given, ans, 1e-6),
    format: (v) => (Array.isArray(v) ? fmtVec(v.map(Number)) : '—'),
    why: fill(CLIP.vectorWhy, { g: `$${txVec(g)}$`, ans: `$${txVec(ans)}$` }),
    scene: { type: 'clip', g, clipped: ans, mode: 'value' },
  };
}

function clipNormItem(R, n) {
  const g = R.pick(CLIP.normVectors);
  const ans = clipNorm(g, 1);
  const norm = clean(l2norm(g));
  return {
    id: `clipNorm-${n}`, tpl: 'clipNorm', concept: 'clip.gradient', src: CLIP.src, kind: 'custom',
    beyond: true, note: CLIP.normNote,
    prompt: fill(CLIP.normPrompt, { g: fmtVec(g) }), promptText: CLIP.normPromptText,
    answer: ans, slots: ans.length,
    check: (given) => nearVec(given, ans, 1e-6),
    format: (v) => (Array.isArray(v) ? fmtVec(v.map(Number)) : '—'),
    why: fill(CLIP.normWhy, { norm: tx(norm), ans: `$${txVec(ans)}$` }),
    scene: { type: 'clip', g, clipped: ans, mode: 'norm' },
  };
}

function clipFact(R, n, f) {
  const g = [R.pick(CLIP.inside), R.pick(CLIP.outside)];
  const scene = f.id === 'problem' || f.id === 'rnn'
    ? { type: 'stack', before: { ...CLIP.stack, bn: null }, after: null }
    : { type: 'clip', g, clipped: clipValue(g, 1), mode: 'value', quiet: true };
  return factItem(R, n, { ...f, concept: 'clip.gradient', src: CLIP.src }, scene);
}

/* ── the round ────────────────────────────────────────────────────────── */
export function makeItems(R, level = 1) {
  const L = Math.max(1, Math.min(3, Number(level) || 1));
  let n = 0;
  const next = () => n++;
  const initScenes = R.shuffle(SCENES.whichInit);
  const diag = R.shuffle(SCENES.diagnose);
  const cues = R.shuffle(WHICH_ACT.cues);
  const inits = R.shuffle(['glorot', 'he', 'lecun']);
  const facts = Object.fromEntries(CHOICE_ITEMS.map((f) => [f.id, f]));
  const out = [];

  if (L === 1) {
    out.push(
      whichAct(R, next(), cues[0]),
      whichInit(R, next(), initScenes[0]),
      initCompute(R, next(), 'fanAvg'),
      whichInit(R, next(), initScenes[1]),
      factItem(R, next(), facts[R.pick(['culprit', 'saturate', 'kerasDefault'])]),
      initCompute(R, next(), 'glorotVar'),
      whichInitRev(R, next(), inits[0]),
      diagnose(R, next(), diag[0]),
      initCompute(R, next(), 'glorotLimit'),
      initCompute(R, next(), R.pick(['heVar', 'lecunVar'])),
    );
  } else if (L === 2) {
    const plots = R.shuffle(CURVES.plots.filter((p) => CURVES.nameAsk.includes(p.id)));
    const forms = R.shuffle(CURVES.formulaAsk);
    const floors = R.shuffle(CURVES.floor.cases);
    const alphas = R.shuffle(LEAKY.alpha.cases);
    const seluScene = SCENES.whichInit.find((s) => s.act === 'selu');
    out.push(
      whichInit(R, next(), R.chance(0.5) ? seluScene : initScenes.find((s) => s.act !== 'selu')),
      leakyAlpha(R, next(), alphas[0]),
      curveName(R, next(), plots[0]),
      seluConstants(R, next()),
      formulaName(R, next(), CURVES.formulas.find((f) => f.id === forms[0])),
      leakyValue(R, next()),
      seluConditions(R, next()),
      eluFloorItem(R, next(), floors[0]),
      curveName(R, next(), plots[1]),
      R.chance(0.5) ? initCompute(R, next(), R.pick(['heVar', 'lecunVar'])) : whichInitRev(R, next(), inits[0]),
    );
  } else {
    const bnFacts = R.shuffle(BN.choiceItems);
    const placement = bnFacts.find((f) => f.concept === 'bn.placement');
    const params = bnFacts.find((f) => f.concept === 'bn.params');
    const clips = R.shuffle(CLIP.facts);
    const heal = R.pick(SCENES.bnHeals);
    const early = R.chance(0.5) ? whichInit(R, next(), initScenes[0]) : diagnose(R, next(), diag[0]);
    out.push(
      early,
      bnBenefit(R, next(), R.pick(BN.benefit), heal),
      bnItem(R, next(), 'mu'),
      factItem(R, next(), params),
      bnItem(R, next(), 'var'),
      factItem(R, next(), placement),
      R.chance(0.2) ? clipNormItem(R, next()) : clipFact(R, next(), clips[0]),
      bnItem(R, next(), R.pick(['xhat', 'z'])),
      bnCount(R, next(), R.pick(['trainable', 'nonTrainable', 'total'])),
      clipVector(R, next()),
    );
  }
  return out.slice(0, ROUND_SIZE);
}
