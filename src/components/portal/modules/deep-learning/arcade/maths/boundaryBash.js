/* ============================================================================
   BOUNDARY BASH — MATHS + QUESTION GENERATOR (pure, seeded; Lecture 1)
   ----------------------------------------------------------------------------
   One TLU on a 2D plane, in the slides' notation:
     z = w₁x₁ + w₂x₂ + b = wᵀx + b                 slide 4
     ŷ = heaviside(z)  (0 if z < 0, 1 if z ≥ 0)    slide 5 (sign also, slide 5)
     w_i ← w_i + η(y − ŷ)x_i                       slide 10 (j fixed: one TLU)
       = w_i − η(ŷ − y)x_i                         slide 11 (the same rule)
   The decision boundary is the line wᵀx + b = 0 (linear: slide 12). The
   rule updates the weights only (slide 10 gives no bias update), so b is
   fixed for a round.
   The XOR network is Figure 10-6b (slide 17): mlpForward() runs it.

   makeItems(rand, level) → the round (an array of kit items):
     level 1  a stream of points; for each: which way does w move (toward x,
              away from x, stays), which formula is the rule (slide 10 or
              slide 11's form vs a wrong-sign and a wrong-factor variant,
              each drawn as a dashed candidate boundary), what a TLU
              outputs (slide 4), heaviside / sign of a probe's z (slide 5)
     level 2  the update by hand on the keypad (η ∈ {1, 0.5, 2}, integer
              points, so every answer is exact), z and ŷ at a probe, and
              slides 9 / 12–15 checks; later points hide ŷ
     level 3  XOR: why one boundary fails (slide 16), Figure 10-6b's
              blanks (exactly one candidate makes it output XOR), its
              forward pass by hand, slides 12 / 16–17 checks
   Text comes from content/boundary-bash.js; equations from lecture1.js.
   ========================================================================== */
import { EQUATIONS } from '../content/lecture1.js';
import * as C from '../content/boundary-bash.js';

/* ── numbers and text ─────────────────────────────────────────────────── */
const clean = (v) => (Object.is(v, -0) ? 0 : v);
// plain text (Unicode minus)
export const fmt = (v) => String(clean(v)).replace('-', '−');
export const vec = (w) => `(${w.map(fmt).join(', ')})`;
// TeX: number, factor (negatives bracketed), vector
const tx = (v) => String(clean(v));
const tp = (v) => (v < 0 ? `(${tx(v)})` : tx(v));
const vt = (w) => `(${w.map(tx).join(', ')})`;
const signed = (v) => (v < 0 ? `- ${tx(-v)}` : `+ ${tx(v)}`);

export function fill(tpl, vars) {
  return String(tpl).replace(/%(\w+)%/g, (m, k) => (vars[k] !== undefined ? String(vars[k]) : m));
}

/* ── the TLU (slides 4–5) ─────────────────────────────────────────────── */
export const heaviside = (z) => (z < 0 ? 0 : 1);                  // slide 5
export const sign = (z) => (z < 0 ? -1 : z === 0 ? 0 : 1);        // slide 5
export const STEP_FNS = { heaviside, sign };
export const tluZ = (w, b, x) => clean(w[0] * x[0] + w[1] * x[1] + b);   // slide 4: wᵀx + b
export const predict = (w, b, x) => heaviside(tluZ(w, b, x));

/* ── the Perceptron learning rule (slides 10–11) ──────────────────────── */
// slide 10: w_{i,j}^(next step) = w_{i,j} + η(y_j − ŷ_j)x_i
export const ruleNext = (w, x, y, yhat, eta) => w.map((wi, i) => clean(wi + eta * (y - yhat) * x[i]));
// slide 11 (handwritten): w_{i,j}^(next step) = w_{i,j} − η(ŷ_j − y_j)x_i
export const ruleNext11 = (w, x, y, yhat, eta) => w.map((wi, i) => clean(wi - eta * (yhat - y) * x[i]));

// the update each formula on the choice buttons computes (content RULE.forms[*].delta)
export const DELTAS = {
  errX: (w, x, y, yhat, eta) => ruleNext(w, x, y, yhat, eta),
  negErrX: (w, x, y, yhat, eta) => w.map((wi, i) => clean(wi - eta * (y - yhat) * x[i])),
  err: (w, x, y, yhat, eta) => w.map((wi) => clean(wi + eta * (y - yhat))),
  errYhat: (w, x, y, yhat, eta) => w.map((wi) => clean(wi + eta * (y - yhat) * yhat)),
  yX: (w, x, y, yhat, eta) => w.map((wi, i) => clean(wi + eta * y * x[i])),
};
export const applyForm = (formKey, w, x, y, yhat, eta) => DELTAS[C.RULE.forms[formKey].delta](w, x, y, yhat, eta);

export const misCount = (w, b, pts) => pts.filter((p) => predict(w, b, p.x) !== p.y).length;

/* ── the XOR MLP (Figure 10-6b, slide 17) ─────────────────────────────── */
export const XOR_NET = C.XOR.net;
export const XOR_TABLE = C.XOR.points.map((p) => [p.x[0], p.x[1], p.y]);

// net = { W: [[w₁₁, w₁₂], [w₂₁, w₂₂]] (input i → hidden j), b: [b₁, b₂], v: [v₁, v₂], c }
export function mlpForward(net, x) {
  const z = [0, 1].map((j) => clean(x[0] * net.W[0][j] + x[1] * net.W[1][j] + net.b[j]));
  const h = z.map(heaviside);
  const zo = clean(net.v[0] * h[0] + net.v[1] * h[1] + net.c);
  return { z, h, zo, out: heaviside(zo) };
}
export const solvesXor = (net) => XOR_TABLE.every(([a, b, y]) => mlpForward(net, [a, b]).out === y);
export const withSet = (net, set) => ({ ...net, ...set });

/* ── a world: a fixed bias, a hidden separator, a pool of labelled points ─ */
const GRID = [];
for (let a = -3; a <= 3; a++) for (let c = -3; c <= 3; c++) if (a || c) GRID.push([a, c]);
export const PLANE_GRID = GRID;
const key = (x) => `${x[0]},${x[1]}`;
const nonzero = (w) => w[0] !== 0 || w[1] !== 0;
const inRange = (w) => Math.abs(w[0]) <= 12 && Math.abs(w[1]) <= 12;

// the points are labelled by a separator ws·x + beta with beta of b's sign, so a w with this b
// separates them (w = ws/|beta| · |b|): the stream can always be learned
function makePool(rand, b, w) {
  for (let t = 0; t < 400; t++) {
    const ws = [rand.int(-3, 3), rand.int(-3, 3)];
    if (!nonzero(ws)) continue;
    const beta = b * rand.int(1, 4);
    const pool = GRID.filter((x) => ws[0] * x[0] + ws[1] * x[1] + beta !== 0)
      .map((x) => ({ x, y: heaviside(ws[0] * x[0] + ws[1] * x[1] + beta) }));
    const n1 = pool.filter((p) => p.y === 1).length;
    if (n1 < 10 || pool.length - n1 < 10) continue;
    if (w && misCount(w, b, pool) < 7) continue;
    return { pool, target: { w: ws, b: beta } };
  }
  return null;
}

function newWorld(rand, eta) {
  for (;;) {
    const b = rand.pick([-1, 1]);
    const w = [rand.int(-2, 2), rand.int(-2, 2)];
    if (!nonzero(w)) continue;
    const made = makePool(rand, b, w);
    if (made) return { b, eta, w, pool: made.pool, target: made.target, used: new Set(), hist: [], batch: 0, fresh: false };
  }
}

// a fresh batch once the current one is separated (keeps w: the boundary carries on)
function newBatch(rand, st) {
  const made = makePool(rand, st.b, st.w);
  if (made) {
    st.pool = made.pool;
    st.target = made.target;
  } else {
    Object.assign(st, newWorld(rand, st.eta), { batch: st.batch });
  }
  st.used = new Set();
  st.hist = [];
  st.batch += 1;
  st.fresh = true;
}

function candidates(st, want, filter) {
  return st.pool
    .filter((p) => !st.used.has(key(p.x)))
    .map((p) => {
      const z = tluZ(st.w, st.b, p.x);
      return { x: p.x, y: p.y, z, yhat: heaviside(z) };
    })
    .filter((p) => p.z !== 0)
    .filter((p) => (want === 'mis' ? p.yhat !== p.y : p.yhat === p.y))
    .filter((p) => want !== 'mis' || (nonzero(ruleNext(st.w, p.x, p.y, p.yhat, st.eta)) && inRange(ruleNext(st.w, p.x, p.y, p.yhat, st.eta))))
    .filter((p) => !filter || filter(p));
}

// the next point of the stream: misclassified ('mis') or already right ('ok')
function takePoint(rand, st, want, filter = null, depth = 0) {
  let c = candidates(st, want, filter);
  if (!c.length && want === 'mis') {
    newBatch(rand, st);
    c = candidates(st, 'mis', filter);
  }
  if (!c.length && want === 'ok') return takePoint(rand, st, 'mis', filter, depth + 1);
  if (!c.length) {
    // pathological: start over in a fresh world (and drop the filter if it keeps failing)
    Object.assign(st, newWorld(rand, st.eta), { batch: st.batch + 1, fresh: true });
    return takePoint(rand, st, want, depth > 20 ? null : filter, depth + 1);
  }
  return rand.pick(c);
}

function advance(st, p, next) {
  st.used.add(key(p.x));
  st.hist.push({ x: p.x, y: p.y });
  st.w = next;
  st.fresh = false;
}

// a probe point (no label) for the TLU / step / z / ŷ items; onLine → z = 0 when possible
function takeProbe(rand, st, onLine = false) {
  const free = GRID.filter((x) => !st.used.has(key(x)));
  const on = free.filter((x) => tluZ(st.w, st.b, x) === 0);
  if (onLine && on.length) return rand.pick(on);
  const off = free.filter((x) => { const z = tluZ(st.w, st.b, x); return z !== 0 && Math.abs(z) <= 20; });
  return rand.pick(off.length ? off : free);
}

const planeScene = (st, extra = {}) => ({
  type: 'plane', w: st.w.slice(), b: st.b, eta: st.eta, pts: st.hist.slice(-8).map((p) => ({ x: p.x.slice(), y: p.y })),
  batch: st.batch, fresh: st.fresh, cur: null, probe: null, ghosts: [], after: null, ...extra,
});

const ruleMaths = (st, s11 = false) => [
  { text: C.MATHS.rule },
  { tex: EQUATIONS.perceptronRule.tex[0] },
  ...(s11 ? [{ text: C.MATHS.rule11 }, { tex: EQUATIONS.perceptronRuleSigned.tex[0] }] : []),
  { text: fill(C.MATHS.where, { eta: tx(st.eta), b: tx(st.b) }) },
];
const tluMaths = () => [{ text: C.MATHS.tlu }, ...EQUATIONS.tluSum.tex.map((t) => ({ tex: t }))];
const stepMaths = () => [{ text: C.MATHS.step }, { tex: EQUATIONS.heaviside.tex[0] }, { tex: EQUATIONS.sign.tex[0] }];
const xorMaths = () => [{ text: C.MATHS.xor }, ...C.MATHS.xorTex.map((t) => ({ tex: t }))];

const plainOf = (choices) => (v) => choices.find((c) => c.value === v)?.plain ?? choices.find((c) => c.value === v)?.label ?? String(v);
const exprZ = (w, b, x) => `${tp(w[0])} \\cdot ${tp(x[0])} + ${tp(w[1])} \\cdot ${tp(x[1])} ${signed(b)}`;

/* ── level 1 + 2 item builders ────────────────────────────────────────── */
function dirItem(rand, st, id, stay) {
  const p = takePoint(rand, st, stay ? 'ok' : 'mis');
  const next = ruleNext(st.w, p.x, p.y, p.yhat, st.eta);
  const err = p.y - p.yhat;
  const answer = err > 0 ? 'toward' : err < 0 ? 'away' : 'stay';
  const vars = { x: vec(p.x), y: p.y, yhat: p.yhat, eta: tx(st.eta), w: vec(st.w), next: vec(next) };
  const choices = C.DIR.choices.map((c) => ({ ...c }));
  const item = {
    id, concept: 'perceptron.rule', src: C.DIR.src, kind: 'choice', answer, choices,
    prompt: C.DIR.prompt, promptText: fill(C.DIR.promptText, vars), sub: fill(C.DIR.sub, vars),
    why: fill(C.DIR.why[answer], vars), format: plainOf(choices),
    scene: planeScene(st, { cur: { x: p.x, y: p.y, yhat: p.yhat, z: p.z, showYhat: true }, after: next }),
    maths: ruleMaths(st),
  };
  advance(st, p, next);
  return item;
}

// which sign and factor variants are usable for this point (distinct, drawable boundaries)
function ruleOptions(st, p, form) {
  const right = applyForm(form, st.w, p.x, p.y, p.yhat, st.eta);
  const seen = [key(right), key(st.w)];
  const ok = (k) => {
    const w = applyForm(k, st.w, p.x, p.y, p.yhat, st.eta);
    return nonzero(w) && inRange(w) && !seen.includes(key(w));
  };
  const signs = C.RULE.signs.filter(ok);
  const factors = C.RULE.factors.filter(ok).filter((k) => {
    // the factor's line must also differ from every sign variant's
    const wf = key(applyForm(k, st.w, p.x, p.y, p.yhat, st.eta));
    return signs.every((s) => key(applyForm(s, st.w, p.x, p.y, p.yhat, st.eta)) !== wf);
  });
  return signs.length && factors.length ? { signs, factors } : null;
}

function ruleItem(rand, st, id, form) {
  const p = takePoint(rand, st, 'mis', (q) => ruleOptions(st, q, form) !== null);
  const { signs, factors } = ruleOptions(st, p, form);
  const keys = rand.shuffle([form, rand.pick(signs), rand.pick(factors)]);
  const next = ruleNext(st.w, p.x, p.y, p.yhat, st.eta);
  const choices = keys.map((k) => {
    const f = C.RULE.forms[k];
    const w = applyForm(k, st.w, p.x, p.y, p.yhat, st.eta);
    return { value: k, label: f.tex, plain: f.plain, sub: fill(C.RULE.choiceSub, { w: vec(w) }), w };
  });
  const vars = { x: vec(p.x), y: p.y, yhat: p.yhat, w: vec(st.w), next: vec(next) };
  const item = {
    id, concept: 'perceptron.rule', src: form === 's11' ? C.RULE.src : C.RULE.forms[form].src,
    kind: 'choice', answer: form, choices: choices.map((c) => ({ value: c.value, label: c.label, plain: c.plain, sub: c.sub })),
    prompt: C.RULE.prompt, promptText: fill(C.RULE.promptText, vars), sub: C.RULE.sub,
    why: fill(C.RULE.why[form], vars), format: plainOf(choices),
    scene: planeScene(st, { cur: { x: p.x, y: p.y, yhat: p.yhat, z: p.z, showYhat: true }, ghosts: choices.map((c, i) => ({ n: i + 1, w: c.w, value: c.value })), after: next }),
    maths: ruleMaths(st, form === 's11'),
  };
  advance(st, p, next);
  return item;
}

function tluItem(rand, st, id) {
  const choices = rand.shuffle(C.TLU.choices.map((c) => ({ ...c })));
  return {
    id, concept: 'perceptron.tlu', src: C.TLU.src, kind: 'choice', answer: C.TLU.answer, choices,
    prompt: C.TLU.prompt, promptText: C.TLU.promptText, why: C.TLU.why, format: plainOf(choices),
    scene: planeScene(st), maths: tluMaths(),
  };
}

function stepItem(rand, st, id, fn) {
  const x = takeProbe(rand, st, rand.chance(0.4));
  const z = tluZ(st.w, st.b, x);
  const a = STEP_FNS[fn](z);
  const vars = { z: fmt(z), fn, a: fmt(a), where: C.STEP.where[z === 0 ? 'on' : 'off'] };
  return {
    id, concept: 'perceptron.step', src: C.STEP.src, kind: 'number', answer: a,
    prompt: fill(C.STEP.prompt, { ...vars, z: tx(z) }), promptText: fill(C.STEP.promptText, vars), sub: fill(C.STEP.sub, vars),
    why: fill(C.STEP.why[fn], vars) + (z === 0 ? C.STEP.zeroNote : ''),
    pad: { decimal: false, negative: true },
    scene: planeScene(st, { probe: { x, z } }), maths: stepMaths(),
  };
}

function zItem(rand, st, id) {
  const x = takeProbe(rand, st, false);
  const z = tluZ(st.w, st.b, x);
  const vars = { x: vec(x), wt: vt(st.w), b: tx(st.b), xt: vt(x), expr: exprZ(st.w, st.b, x), z: tx(z) };
  return {
    id, concept: 'perceptron.tlu', src: C.ZQ.src, kind: 'number', answer: z,
    prompt: C.ZQ.prompt, promptText: fill(C.ZQ.promptText, vars), sub: fill(C.ZQ.sub, vars), why: fill(C.ZQ.why, vars),
    pad: { decimal: true, negative: true },
    scene: planeScene(st, { probe: { x, z } }), maths: tluMaths(),
  };
}

function yhatItem(rand, st, id) {
  const x = takeProbe(rand, st, rand.chance(0.35));
  const z = tluZ(st.w, st.b, x);
  const a = heaviside(z);
  const vars = { x: vec(x), wt: vt(st.w), b: tx(st.b), xt: vt(x), expr: exprZ(st.w, st.b, x), z: tx(z), a, cmp: z < 0 ? '<' : '\\ge', zero: z === 0 ? C.YHAT.zeroNote : '' };
  return {
    id, concept: 'perceptron.step', src: C.YHAT.src, kind: 'number', answer: a,
    prompt: C.YHAT.prompt, promptText: fill(C.YHAT.promptText, vars), sub: fill(C.YHAT.sub, vars), why: fill(C.YHAT.why, vars),
    pad: { decimal: false, negative: false },
    scene: planeScene(st, { probe: { x, z } }), maths: [...tluMaths(), ...stepMaths().slice(0, 2)],
  };
}

function updItem(rand, st, id, show, trap) {
  const p = takePoint(rand, st, trap ? 'ok' : 'mis');
  const next = ruleNext(st.w, p.x, p.y, p.yhat, st.eta);
  // ask about a weight whose input is nonzero, most of the time
  const nz = [0, 1].filter((i) => p.x[i] !== 0);
  const i = nz.length && rand.chance(0.85) ? rand.pick(nz) : rand.int(0, 1);
  const vars = {
    i: i + 1, isub: i === 0 ? '₁' : '₂', w: vec(st.w), b: fmt(st.b), x: vec(p.x), y: p.y, yhat: p.yhat, eta: tx(st.eta),
    etat: tx(st.eta), wi: tx(st.w[i]), xit: tp(p.x[i]), ans: tx(next[i]), expr: exprZ(st.w, st.b, p.x), z: tx(p.z),
  };
  const mode = show ? 'shown' : 'hidden';
  const item = {
    id, concept: 'perceptron.rule', src: C.UPD.src, kind: 'number', answer: next[i],
    prompt: fill(C.UPD.prompt[mode], vars), promptText: fill(C.UPD.promptText, { ...vars, eta: fmt(st.eta) }), sub: fill(C.UPD.sub[mode], vars),
    why: fill(C.UPD.why, vars) + (show ? '' : fill(C.UPD.whyHidden, vars)) + (p.y === p.yhat ? C.UPD.whyStay : ''),
    pad: { decimal: true, negative: true }, ask: i,
    scene: planeScene(st, { cur: { x: p.x, y: p.y, yhat: p.yhat, z: p.z, showYhat: show }, after: next, ask: i }),
    maths: ruleMaths(st),
  };
  if (!show) item.src = { lecture: 1, slides: [4, 5, 10] };
  advance(st, p, next);
  return item;
}

function conceptItem(rand, q, id, scene) {
  const choices = q.choices ? rand.shuffle(q.choices.map((c) => ({ ...c, plain: c.label }))) : undefined;
  return {
    id, concept: q.concept, src: q.src, kind: q.kind, answer: q.answer, choices,
    prompt: q.prompt, promptText: q.prompt, why: q.why, format: choices ? plainOf(choices) : undefined,
    pad: q.kind === 'number' ? { decimal: false, negative: false } : undefined,
    scene, maths: [],
  };
}

function planeItems(rand, L) {
  const eta = L === 1 ? 1 : rand.pick([1, 0.5, 2]);
  const st = newWorld(rand, eta);
  const items = [];
  if (L === 1) {
    const stayAt = rand.pick([3, 6]);
    const fns = rand.shuffle(['heaviside', 'sign']);
    const plan = ['dir', 'dir', 'tlu', 'dir', 'rule10', 'step0', 'dir', 'rule10', 'step1', 'rule11'];
    plan.forEach((t, k) => {
      const id = `bb1-${k + 1}-${t}`;
      if (t === 'dir') items.push(dirItem(rand, st, id, k === stayAt));
      else if (t === 'tlu') items.push(tluItem(rand, st, id));
      else if (t === 'rule10') items.push(ruleItem(rand, st, id, 's10'));
      else if (t === 'rule11') items.push(ruleItem(rand, st, id, 's11'));
      else if (t === 'step0') items.push(stepItem(rand, st, id, fns[0]));
      else if (t === 'step1') items.push(stepItem(rand, st, id, fns[1]));
    });
    return items;
  }
  const qa = rand.pick(C.CONCEPT_L2.a);
  const qb = rand.pick(C.CONCEPT_L2.b);
  const plan = ['z', 'upd+', 'upd+', 'qa', 'upd-', 'upd-', 'qb', 'yhat', 'upd?', 'upd-'];
  plan.forEach((t, k) => {
    const id = `bb2-${k + 1}-${t.replace(/[+?-]/g, (m) => ({ '+': 'shown', '-': 'hidden', '?': 'trap' })[m])}`;
    if (t === 'z') items.push(zItem(rand, st, id));
    else if (t === 'yhat') items.push(yhatItem(rand, st, id));
    else if (t === 'upd+') items.push(updItem(rand, st, id, true, false));
    else if (t === 'upd-') items.push(updItem(rand, st, id, false, false));
    else if (t === 'upd?') items.push(updItem(rand, st, id, false, rand.chance(0.4)));
    else if (t === 'qa') items.push(conceptItem(rand, qa, `${id}-${qa.id}`, planeScene(st)));
    else if (t === 'qb') items.push(conceptItem(rand, qb, `${id}-${qb.id}`, planeScene(st)));
  });
  return items;
}

/* ── level 3: XOR ─────────────────────────────────────────────────────── */
const xorScene = (extra = {}) => ({ type: 'xor', phase: 'mlp', input: null, focus: null, blank: null, tries: [], ...extra });

function xorFix(rand) {
  const q = C.XOR_FIX;
  const choices = rand.shuffle(q.choices.map((c) => ({ ...c, plain: c.label })));
  const tries = C.XOR.tries.map((t) => ({ w: t.w.slice(), b: t.b, wrong: misCount(t.w, t.b, C.XOR.points) }));
  return {
    id: 'bb3-1-fix', concept: q.concept, src: q.src, kind: 'choice', answer: q.answer, choices,
    prompt: q.prompt, promptText: q.promptText, sub: q.sub, why: q.why, format: plainOf(choices),
    scene: xorScene({ phase: 'flat', tries }), maths: [],
  };
}

function xorBlank(rand, id, k) {
  const q = C.XOR_BLANKS[k];
  const choices = rand.shuffle(q.candidates.map((c) => ({ value: c.value, label: c.label, plain: c.label })));
  return {
    id, concept: 'mlp.xor', src: q.src, kind: 'choice', answer: q.answer, choices,
    prompt: q.prompt, promptText: q.promptText, sub: C.XOR_FIX.sub, why: q.why, format: plainOf(choices),
    scene: xorScene({ blank: k }), maths: xorMaths(),
  };
}

function xorFwd(rand, id, what, input) {
  const f = mlpForward(XOR_NET, input);
  const j = rand.int(0, 1);
  const T = C.XOR_FWD[what];
  const vars = {
    x1: input[0], x2: input[1], side: C.XOR_FWD.sides[j], k: j + 1, bt: C.XOR.showTex.b[j],
    bsigned: C.XOR.showTex.b[j].startsWith('-') ? `- ${C.XOR.showTex.b[j].slice(1)}` : `+ ${C.XOR.showTex.b[j]}`,
    z: tx(f.z[j]), h: f.h[j], z1: tx(f.z[0]), z2: tx(f.z[1]), h1: f.h[0], h2: f.h[1], out: f.out,
  };
  const answer = what === 'z' ? f.z[j] : what === 'h' ? f.h[j] : f.out;
  return {
    id, concept: 'mlp.xor', src: C.XOR_FWD.src, kind: 'number', answer,
    prompt: fill(T.prompt, vars), promptText: fill(T.promptText, vars), sub: T.sub, why: fill(T.why, vars),
    pad: what === 'z' ? { decimal: true, negative: true } : { decimal: false, negative: false },
    scene: xorScene({ input: input.slice(), focus: what === 'out' ? 'out' : `h${j + 1}`, show: what, values: f }),
    maths: xorMaths(),
  };
}

function xorItems(rand) {
  const inputs = rand.shuffle(C.XOR.points.map((p) => p.x));
  const qa = rand.pick(C.CONCEPT_L3.a);
  const qb = rand.pick(C.CONCEPT_L3.b);
  return [
    xorFix(rand),
    xorFwd(rand, 'bb3-2-fwdz', 'z', inputs[0]),
    xorBlank(rand, 'bb3-3-blank-ov', 'ov'),
    xorFwd(rand, 'bb3-4-fwdh', 'h', inputs[1]),
    conceptItem(rand, qa, `bb3-5-${qa.id}`, xorScene()),
    xorBlank(rand, 'bb3-6-blank-hb', 'hb'),
    xorFwd(rand, 'bb3-7-fwdout', 'out', inputs[2]),
    conceptItem(rand, qb, `bb3-8-${qb.id}`, xorScene()),
    xorBlank(rand, 'bb3-9-blank-oc', 'oc'),
  ];
}

export function makeItems(rand, level = 1) {
  const L = Math.max(1, Math.min(3, Number(level) || 1));
  return L === 3 ? xorItems(rand) : planeItems(rand, L);
}
