#!/usr/bin/env node
/* check-chain-reaction.mjs — fidelity + generator check for Chain Reaction (Lecture 1).

   1. Hand-worked examples from the slide equations (arithmetic in the comments,
      with slide numbers): a forward pass, σ′, the gradient step, slide 23's
      collapse, slide 21's tanh, and the Lecture 1 content anchors.
   2. Finite differences: backward() against a central difference of
      ℒ = ½(ŷ − y)² for every parameter, pre-activation and ŷ, on the hand net
      and 300 seeded nets of each activation; and every gradient a generated
      item asks for, against the finite difference on that item's own net.
   3. 30 seeded rounds per level: id (unique), concept in the catalogue, src,
      why, no unfilled %placeholder%, a gradable answer (the answer grades
      right, a mutated one wrong), the answer recomputed independently from
      the numbers the item shows, and the beyond rule: every item that uses
      a derivative other than σ′ (slide 20) or slide 11's (ŷ − y)·x carries
      `beyond: true`, a note, and "beyond the slides" on its prompt. Every
      tanh reverse step (those rounds plus 2,000 more level-3 rounds) grades
      against two keys at ±0.01 each (exact z, and the 2-decimal h on show):
      both pass, σ′ in place of tanh′ fails, and z is never within 0.5 of 0.
   4. Task cards against slides 27 and 31's tables (encoded here
      independently from the rendered slides).

   Run:  node tools/dl-arcade/check-chain-reaction.mjs     (exit 1 on any failure) */

import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const arcade = path.resolve(here, '..', '..', 'src', 'components', 'portal', 'modules', 'deep-learning', 'arcade');
const load = (rel) => import(pathToFileURL(path.join(arcade, rel)).href);

const M = await load('maths/chainReaction.js');
const { rng } = await load('core/rng.js');
const { CONCEPTS } = await load('core/concepts.js');
const L1 = await load('content/lecture1.js');
const C = await load('content/chain-reaction.js');

const failures = [];
let checks = 0;
const ok = (cond, msg) => { checks += 1; if (!cond) failures.push(msg); };
const near = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol;
// an independent 2-decimal rounding (half away from zero)
const round2 = (v) => { const r = Math.sign(v) * Math.round(Math.abs(v) * 100 + 1e-7) / 100; return r === 0 ? 0 : r; };

// ── 1. hand-worked examples ─────────────────────────────────────────────────
// The hand net: x = (2, −1); W = [[0.5, 1], [1, 2]] (w₁,₁ = 0.5, w₁,₂ = 1, w₂,₁ = 1, w₂,₂ = 2);
// b = (0, 0.5); v = (2, −1); c = 0.5; φ = σ; target y = 0.
const net = M.HAND_NET;
ok(JSON.stringify(net) === JSON.stringify({ act: 'sigmoid', x: [2, -1], W: [[0.5, 1], [1, 2]], b: [0, 0.5], v: [2, -1], c: 0.5 }), 'HAND_NET changed: update the hand-worked numbers');
const f = M.forward(net);
// slide 4: z = wᵀx + b
//   z₁ = 2·0.5 + (−1)·1 + 0   = 0
//   z₂ = 2·1   + (−1)·2 + 0.5 = 0.5
ok(near(f.z[0], 0) && near(f.z[1], 0.5), `slide 4 z: got ${f.z}`);
// slide 20: σ(z) = 1/(1 + exp(−z))
//   h₁ = σ(0)   = 1/(1 + 1)          = 0.5        (anchor l1.sigmoid.at0)
//   h₂ = σ(0.5) = 1/(1 + 0.6065307)  = 0.6224593
ok(near(f.h[0], 0.5) && near(f.h[1], 0.6224593, 1e-7), `slide 20 σ: got ${f.h}`);
// slide 24: a regression output needs no activation, so ŷ = v₁h₁ + v₂h₂ + c
//   ŷ = 2·0.5 + (−1)·0.6224593 + 0.5 = 0.8775407
ok(near(f.yhat, 0.8775407, 1e-7), `ŷ: got ${f.yhat}`);
const bk = M.backward(net, 0);
// slide 11: ℒ = ½(ŷ − y)², and ∂ℒ/∂w = (ŷ − y)·(input) for a linear output
//   ŷ − y      = 0.8775407
//   ∂ℒ/∂v₁     = (ŷ − y)·h₁ = 0.8775407·0.5 = 0.4387704
ok(near(bk.e, 0.8775407, 1e-7) && near(bk.dv[0], 0.4387704, 1e-7), `slide 11 gradient: got e=${bk.e}, dv1=${bk.dv[0]}`);
// slide 20: σ′(z) = σ(z)(1 − σ(z));  σ′(0) = 0.5·0.5 = 0.25   (anchor l1.sigmoid.deriv.peak)
ok(near(M.dSigmoid(0), 0.25), 'σ′(0) ≠ 0.25');
// slide 20's first form: σ′(z) = exp(−z)/(1 + exp(−z))²  — the same function
for (const z of [-3, -1.5, -0.5, 0, 0.7, 2, 4]) ok(near(M.dSigmoid(z), Math.exp(-z) / (1 + Math.exp(-z)) ** 2, 1e-12), `σ′ forms disagree at z=${z}`);
// beyond the slides (chain rule): ∂ℒ/∂z₁ = (ŷ − y)·v₁·σ′(z₁) = 0.8775407·2·0.25 = 0.4387704
//                                 ∂ℒ/∂w₁,₁ = ∂ℒ/∂z₁·x₁     = 0.4387704·2      = 0.8775407
ok(near(bk.dz[0], 0.4387704, 1e-7) && near(bk.dW[0][0], 0.8775407, 1e-7), `chain rule: got dz1=${bk.dz[0]}, dW11=${bk.dW[0][0]}`);
// slide 11: w ← w − η ∂ℒ/∂w;  v₁ with η = 0.1: 2 − 0.1·0.4387704 = 1.956123
ok(near(net.v[0] - 0.1 * bk.dv[0], 1.956123, 1e-6), 'slide 11 update');
// slide 21: tanh(z) = 2σ(2z) − 1 is the hyperbolic tangent; tanh(0) = 0 (anchor l1.tanh.at0)
for (const z of [-2, -0.5, 0, 0.3, 1, 2.5]) ok(near(M.tanh(z), Math.tanh(z), 1e-12), `slide 21 tanh ≠ Math.tanh at ${z}`);
// slide 21: ReLU(z) = max(0, z)
ok(M.relu(-1.25) === 0 && M.relu(0.75) === 0.75, 'ReLU');
// slide 23: f(z) = 2z + 3, g(z) = 5z − 1 → f(g(z)) = 2(5z − 1) + 3 = 10z + 1   (anchor l1.linear.collapse)
const slide23 = M.compose(C.COLLAPSE.slideExample);
ok(slide23.a === 10 && slide23.b === 1, `slide 23 collapse: got ${slide23.a}z + ${slide23.b}`);
// three layers: k(z) = 3z − 2, g = −2z + 2, f = 2z − 2 → 2(−2(3z − 2) + 2) − 2 = −12z + 10
const three = M.compose([{ a: 3, b: -2 }, { a: -2, b: 2 }, { a: 2, b: -2 }]);
ok(three.a === -12 && three.b === 10, `3-layer collapse: got ${three.a}z + ${three.b}`);
// slide 22 (Figure 10-8): σ′ peaks at 0.25, tanh′ at 1.0, ReLU′ is 0 then 1, Heaviside′ is 0
ok(near(Math.max(...M.curve('sigmoid', 'deriv').segments[0].map((p) => p[1])), 0.25, 1e-9), 'σ′ peak');
ok(near(Math.max(...M.curve('tanh', 'deriv').segments[0].map((p) => p[1])), 1, 1e-9), 'tanh′ peak');
ok(M.dRelu(-1) === 0 && M.dRelu(1) === 1 && M.dHeaviside(2) === 0, 'ReLU′ / Heaviside′');
// the left panel has no markers (only Heaviside's jump line); the right panel marks ReLU′'s and Heaviside′'s jump
ok(M.curve('heaviside', 'act').markers.length === 0 && M.curve('heaviside', 'act').jump, 'left-panel Heaviside: jump line, no marker');
ok(M.curve('relu', 'deriv').markers.length === 1 && M.curve('heaviside', 'deriv').markers.length === 1, 'right-panel ReLU′ / Heaviside′ markers');
// the makeNet fallback never puts a ReLU net at z = 0 (ReLU′ undefined there)
const stuck = { pick: (a) => a[0], int: (lo) => lo, chance: () => false };
ok(M.forward(M.makeNet(stuck, 'relu')).z.every((z) => z !== 0), 'ReLU fallback net has a z = 0');
ok(JSON.stringify(M.makeNet(stuck, 'sigmoid')) === JSON.stringify(net), 'sigmoid fallback is HAND_NET');
// the Lecture 1 content anchors this game can reproduce
const anchor = (id) => L1.ANCHORS.find((a) => a.id === id);
ok(anchor('l1.sigmoid.at0').value === M.sigmoid(0), 'anchor l1.sigmoid.at0');
ok(anchor('l1.sigmoid.deriv.peak').value === M.dSigmoid(0), 'anchor l1.sigmoid.deriv.peak');
ok(anchor('l1.tanh.at0').value === M.tanh(0), 'anchor l1.tanh.at0');
ok(anchor('l1.tanh.deriv.peak').value === M.dTanh(0), 'anchor l1.tanh.deriv.peak');
ok(anchor('l1.linear.collapse').value === `${slide23.a}z + ${slide23.b}`, 'anchor l1.linear.collapse');
ok(near(anchor('l1.softplus.at0').value, M.softplus(0), 1e-3), 'anchor l1.softplus.at0');
// the equations the drawer shows are the slides'
ok(L1.EQUATIONS.gradientStep.src.slides.includes(11) && L1.EQUATIONS.sigmoidDerivative.src.slides.includes(20) && L1.EQUATIONS.linearCollapse.src.slides.includes(23), 'equation sources');

// ── 2. finite differences ───────────────────────────────────────────────────
const PARAMS = ['v0', 'v1', 'c', 'W00', 'W01', 'W10', 'W11', 'b0', 'b1'];
const analytic = (b, key) => {
  if (key === 'yhat') return b.e;
  if (key === 'c') return b.dc;
  if (key[0] === 'v') return b.dv[Number(key[1])];
  if (key[0] === 'b') return b.db[Number(key[1])];
  if (key[0] === 'z') return b.dz[Number(key[1])];
  return b.dW[Number(key[1])][Number(key[2])];
};
let fdMax = 0;
const fdNet = (n, y, label) => {
  const b = M.backward(n, y);
  for (const key of [...PARAMS, 'z0', 'z1', 'yhat']) {
    const num = M.numGrad(n, y, key);
    const err = Math.abs(num - analytic(b, key));
    fdMax = Math.max(fdMax, err);
    ok(err < 1e-6, `finite difference ${label} ∂ℒ/∂${key}: analytic ${analytic(b, key)} vs numeric ${num}`);
  }
};
fdNet(net, 0, 'hand net');
for (const act of ['sigmoid', 'tanh', 'relu']) {
  const r = rng(4242);
  for (let t = 0; t < 300; t++) {
    const n = M.makeNet(r, act);
    fdNet(n, r.int(-4, 4) / 2, `${act} net ${t}`);
  }
}

// ── 3. seeded rounds ────────────────────────────────────────────────────────
// a copy of kit/useRound.js grade() (Node cannot import the React hook file)
function grade(item, given) {
  if (typeof item.check === 'function') return !!item.check(given);
  switch (item.kind) {
    case 'number': return given !== '' && given !== null && given !== undefined && Math.abs(Number(given) - Number(item.answer)) <= (item.tol ?? 0) + 1e-9;
    case 'choice': return given === item.answer;
    default: return JSON.stringify(given) === JSON.stringify(item.answer);
  }
}
function mutate(item) {
  if (item.kind === 'number') return item.answer + Math.max(1, (item.tol ?? 0) * 10);
  if (item.kind === 'choice') return item.choices.find((c) => c.value !== item.answer)?.value;
  if (item.input === 'order') return item.answer.slice().reverse();
  if (item.input === 'head') return { ...item.answer, loss: item.answer.loss === 'mse' ? 'xent' : 'mse' };
  return null;
}
// which uses-tags a slide prints, and where
const ON_SLIDES = { dloss: 11, dsigmoid: 20, gdstep: 11, figure: 22 };
const BEYOND_TAGS = ['chain', 'dtanh', 'drelu', 'dheaviside', 'dbias'];
// derivative formulas the slides never print (tanh′, ReLU′ as formulas, the chain rule)
const BEYOND_TEXT = [/\\tanh'/, /tanh′/, /\\mathrm\{ReLU\}'/, /ReLU′/, /1 - \\tanh\^2/, /chain rule/i, /chain-rule/i];

const textOf = (it) => [it.prompt, it.promptText, it.why, it.sub, ...(it.maths ?? []).map((m) => m.tex ?? m.text ?? '')].join(' \n ');
const seen = { tasks: new Set(), curves: { act: new Set(), deriv: new Set() }, slideCollapse: 0, beyond: new Map(), fdItems: 0, fdDrift: 0, kinds: new Set(), tanhSteps: 0 };

function recompute(it) {
  // the answer from the numbers the item shows (independent of the generator's arithmetic)
  const st = it.stage;
  const t = st?.target;
  if (st?.type === 'collapse') {
    const comp = st.layers.reduce((acc, L) => ({ a: L.a * acc.a, b: L.a * acc.b + L.b }), { a: 1, b: 0 });
    return st.ask === 'slope' ? comp.a : comp.b;
  }
  if (st?.type !== 'graph' || !t) return undefined;
  const { net: n, vals } = st;
  const phi = { sigmoid: (z) => 1 / (1 + Math.exp(-z)), tanh: (z) => Math.tanh(z), relu: (z) => Math.max(0, z) }[n.act];
  if (t === 'z0' || t === 'z1') { const j = Number(t[1]); return round2(n.x[0] * n.W[0][j] + n.x[1] * n.W[1][j] + n.b[j]); }
  if (t === 'h0' || t === 'h1') return round2(phi(vals.z[Number(t[1])]));
  if (t === 'yhat') return round2(n.v[0] * vals.h[0] + n.v[1] * vals.h[1] + n.c);
  if (t === 'e') return round2(vals.yhat - vals.y);
  const led = Object.fromEntries((st.ledger ?? []).map((l) => [l.key, l.value]));
  if (/^dv\d$/.test(t)) return round2(vals.e * vals.h[Number(t[2])]);
  if (/^ds\d$/.test(t)) { const h = vals.h[Number(t[2])]; return round2(h * (1 - h)); }
  if (/^dz\d$/.test(t)) {
    const k = Number(t[2]);
    if (n.act === 'sigmoid') return round2(vals.e * n.v[k] * led[`ds${k}`]);
    if (n.act === 'tanh') {
      // two keys at ±0.01 each: the exact z on show, and the 2-decimal h on show (re-audit row 60)
      const exact = round2(vals.e * n.v[k] * (1 - Math.tanh(vals.z[k]) ** 2));
      const fromH = round2(vals.e * n.v[k] * (1 - vals.h[k] ** 2));
      ok(it.tol === 0.01 && typeof it.check === 'function', `${it.id}: tanh step is not a two-key ±0.01 check (tol ${it.tol})`);
      ok(Array.isArray(it.keys) && it.keys.length === 2 && near(it.keys[0], exact, 1e-9) && near(it.keys[1], fromH, 1e-9), `${it.id}: keys ${JSON.stringify(it.keys)} vs exact ${exact}, shown-h ${fromH}`);
      for (const key of [exact, fromH]) for (const dv of [-0.01, 0, 0.01]) {
        const g = round2(key + dv);
        ok(grade(it, g) === true, `${it.id}: ${g} (key ${key} ${dv >= 0 ? '+' : ''}${dv}) grades wrong`);
      }
      // outside ±0.01 of both keys grades wrong
      const lo = Math.min(exact, fromH) - 0.02;
      const hi = Math.max(exact, fromH) + 0.02;
      ok(grade(it, round2(lo)) === false && grade(it, round2(hi)) === false, `${it.id}: ${round2(lo)} or ${round2(hi)} grades right (keys ${exact}, ${fromH})`);
      // σ′(z) in place of tanh′(z) is a wrong working and must grade wrong
      const s = 1 / (1 + Math.exp(-vals.z[k]));
      const slip = round2(vals.e * n.v[k] * s * (1 - s));
      ok(grade(it, slip) === false, `${it.id}: σ′ in place of tanh′ (${slip}) grades right against ${exact} / ${fromH}`);
      // never at z = 0, where tanh′ = 1 and skipping the derivative gives the exact key (row 61)
      ok(Math.abs(vals.z[k]) >= 0.5, `${it.id}: tanh step asked at z = ${vals.z[k]}`);
      seen.tanhSteps += 1;
      return exact;
    }
    return round2(vals.e * n.v[k] * (vals.z[k] > 0 ? 1 : 0));
  }
  if (/^dw\d\d$/.test(t)) return round2(led[`dz${t[3]}`] * n.x[Number(t[2])]);
  if (t === 'update') {
    const u = st.update;
    const g = u.key[0] === 'v' ? led[`dv${u.key[1]}`] : led[`dw${u.key.slice(1)}`];
    ok(near(g, u.grad), `${it.id}: the update's gradient ${u.grad} is not the ledger's ${g}`);
    const cur = u.key[0] === 'v' ? n.v[Number(u.key[1])] : n.W[Number(u.key[1])][Number(u.key[2])];
    ok(near(cur, u.from), `${it.id}: the update starts from ${u.from}, the net has ${cur}`);
    return round2(u.from - u.eta * u.grad);
  }
  return undefined;
}

function fdItem(it) {
  // the gradient an item asks for, against a finite difference on its own (unrounded) net
  const st = it.stage;
  const t = st?.target;
  if (!t || st.type !== 'graph' || st.vals.y === null) return;
  let key = null;
  if (t === 'e') key = 'yhat';
  else if (/^dv\d$/.test(t)) key = `v${t[2]}`;
  else if (/^dz\d$/.test(t)) key = `z${t[2]}`;
  else if (/^dw\d\d$/.test(t)) key = `W${t[2]}${t[3]}`;
  if (!key) return;
  const n = st.net;
  const num = M.numGrad(n, st.vals.y, key);
  const exact = analytic(M.backward(n, st.vals.y), key);
  ok(Math.abs(num - exact) < 1e-6, `${it.id}: finite difference ${num} vs chain rule ${exact}`);
  // the asked answer (from the 2-decimal numbers on show) stays close to the exact gradient
  const drift = Math.abs(it.answer - num);
  seen.fdDrift = Math.max(seen.fdDrift, drift);
  ok(drift <= 0.06, `${it.id}: answer ${it.answer} drifts ${drift.toFixed(4)} from the exact gradient ${num.toFixed(4)}`);
  seen.fdItems += 1;
}

const SIZES = { 1: 7, 2: 8, 3: 8 };
for (const level of [1, 2, 3]) {
  for (let seed = 1; seed <= 30; seed++) {
    const items = M.makeItems(rng(seed * 7919 + level), level);
    const tag = `L${level} seed ${seed}`;
    ok(items.length === SIZES[level], `${tag}: ${items.length} items`);
    const ids = new Set();
    for (const it of items) {
      const w = `${tag} ${it.id ?? '?'}`;
      seen.kinds.add(it.kind);
      ok(typeof it.id === 'string' && it.id.length > 0 && !ids.has(it.id), `${w}: id missing or repeated`);
      ids.add(it.id);
      ok(!!CONCEPTS[it.concept], `${w}: concept ${it.concept} not in the catalogue`);
      ok(it.src && it.src.lecture === 1 && Array.isArray(it.src.slides) && it.src.slides.length > 0 && it.src.slides.every((s) => Number.isInteger(s) && s >= 1 && s <= 64), `${w}: bad src ${JSON.stringify(it.src)}`);
      ok(typeof it.why === 'string' && it.why.length > 20, `${w}: why missing`);
      ok(typeof it.promptText === 'string' && it.promptText.length > 5 && typeof it.prompt === 'string', `${w}: prompt missing`);
      ok(!/%\w+%/.test(textOf(it)), `${w}: unfilled placeholder in ${textOf(it).match(/%\w+%/)?.[0]}`);
      ok(['number', 'choice', 'custom'].includes(it.kind), `${w}: kind ${it.kind}`);
      ok(JSON.stringify(JSON.parse(JSON.stringify(it.answer))) === JSON.stringify(it.answer) && it.answer !== undefined, `${w}: answer not JSON-serialisable`);
      ok(grade(it, it.answer) === true, `${w}: its own answer grades wrong`);
      ok(grade(it, JSON.parse(JSON.stringify(it.answer))) === true, `${w}: the JSON answer (the bot's) grades wrong`);
      ok(grade(it, mutate(it)) === false, `${w}: a mutated answer grades right`);
      ok(grade(it, null) === false, `${w}: null grades right`);
      if (it.kind === 'number') {
        ok(typeof it.tol === 'number' && it.tol >= 0 && it.tol <= 0.05, `${w}: tolerance ${it.tol}`);
        ok(Number.isFinite(it.answer) && round2(it.answer) === it.answer, `${w}: answer ${it.answer} is not to 2 decimals`);
        ok(/exact|±/.test(it.sub ?? ''), `${w}: the prompt does not state the tolerance`);
      }
      if (it.kind === 'choice') ok(it.choices.some((c) => c.value === it.answer) && new Set(it.choices.map((c) => c.value)).size === it.choices.length, `${w}: choices`);
      if (level === 2) ok(it.fuse === true, `${w}: level 2 item without a fuse`);
      // the beyond rule
      const uses = it.uses ?? [];
      const needsBeyond = uses.some((u) => BEYOND_TAGS.includes(u)) || BEYOND_TEXT.some((re) => re.test(textOf(it)));
      if (needsBeyond) {
        ok(it.beyond === true && typeof it.note === 'string' && it.note.length > 20, `${w}: uses a derivative the slides do not print but is not beyond (${uses.join(', ')})`);
        ok(/beyond the slides/i.test(it.sub ?? '') && /^Beyond the slides/.test(it.why), `${w}: beyond item must say so on its prompt and why card`);
      } else ok(!it.beyond, `${w}: marked beyond but uses nothing beyond the slides`);
      for (const u of uses) if (ON_SLIDES[u]) ok(it.src.slides.includes(ON_SLIDES[u]) || it.beyond, `${w}: uses ${u} but does not cite slide ${ON_SLIDES[u]}`);
      if (it.beyond) seen.beyond.set(it.id.replace(/\d+$/, ''), (seen.beyond.get(it.id.replace(/\d+$/, '')) ?? 0) + 1);
      // the answer, recomputed from the numbers on show
      const rc = recompute(it);
      if (rc !== undefined) ok(near(rc, it.answer, 1e-9), `${w}: recomputed ${rc} ≠ answer ${it.answer}`);
      else ok(it.kind !== 'number', `${w}: a number item the check cannot recompute`);
      fdItem(it);
      if (it.stage?.type === 'card') seen.tasks.add(it.stage.task);
      if (it.stage?.type === 'curve') seen.curves[it.stage.panel].add(it.stage.fn);
      if (it.stage?.type === 'collapse' && it.stage.slide) seen.slideCollapse += 1;
    }
  }
}
// the tanh reverse step over 2,000 more level-3 rounds: both keys pass, the σ′ slip fails, |z| ≥ 0.5
for (let seed = 1; seed <= 2000; seed++) {
  const it = M.makeItems(rng(seed * 104729 + 3), 3).find((x) => x.id === 'cr3-dz');
  if (it?.stage?.net?.act !== 'tanh') continue;
  const rc = recompute(it);
  ok(near(rc, it.answer, 1e-9), `tanh sweep seed ${seed}: recomputed ${rc} ≠ answer ${it.answer}`);
}
ok(seen.tanhSteps > 500, `only ${seen.tanhSteps} tanh reverse steps checked`);
ok(seen.tasks.size === C.TASKS.length, `only ${seen.tasks.size}/${C.TASKS.length} task cards appear in 30 rounds`);
ok(seen.curves.act.size === 4 && seen.curves.deriv.size === 4, 'not every Figure 10-8 curve appears');
ok(seen.slideCollapse > 0, "slide 23's own example never appears");

// ── 4. task cards vs slides 27 and 31 ──────────────────────────────────────
// slide 31: binary 1 · Sigmoid · X-entropy; multilabel 1 per binary label · Sigmoid · X-entropy;
//           multiclass 1 per class · Softmax · X-entropy
// slide 27: 1 output neuron per prediction dimension; output activation None, or ReLU/softplus (positive)
//           or sigmoid/tanh (bounded); loss MSE, or Huber if outliers.  (slide 24 says the same in words)
const TABLE = {
  'reg.one': { n: 1, act: ['none'], loss: ['mse'] },
  'reg.multi': { n: 'k', act: ['none'], loss: ['mse'] },
  'reg.positive': { n: 1, act: ['relu', 'softplus'], loss: ['mse'] },
  'reg.bounded': { n: 1, act: ['sigmoid', 'tanh'], loss: ['mse'] },
  'reg.outliers': { n: 1, act: ['none'], loss: ['huber'] },
  'cls.binary': { n: 1, act: ['sigmoid'], loss: ['xent'] },
  'cls.multilabel': { n: 'k', act: ['sigmoid'], loss: ['xent'] },
  'cls.multiclass': { n: 'k', act: ['softmax'], loss: ['xent'] },
};
for (const t of C.TASKS) {
  const row = TABLE[t.id];
  ok(!!row, `task ${t.id} not in the table`);
  if (!row) continue;
  ok(t.neurons === row.n && JSON.stringify(t.act) === JSON.stringify(row.act) && JSON.stringify(t.loss) === JSON.stringify(row.loss), `task ${t.id} disagrees with slides 27/31`);
  ok(t.src.slides.some((s) => (t.type === 'regression' ? [24, 27] : [29, 31]).includes(s)), `task ${t.id} cites the wrong slides`);
  if (t.neurons === 'k') ok(t.ks.every((k) => C.HEAD.neurons.includes(k)), `task ${t.id}: a k the neuron row cannot offer`);
}
ok(C.TASKS.find((t) => t.id === 'cls.multiclass').ks.includes(10), 'MNIST’s K = 10 (slide 29) missing');

// every content entry carries a source
const srcOk = (s) => s && s.lecture === 1 && s.slides.length && s.slides.every((n) => n >= 1 && n <= 64);
Object.entries(C.ACTIVATIONS).forEach(([k, a]) => ok(srcOk(a.src) && srcOk(a.figSrc), `ACTIVATIONS.${k} src`));
// (T.h takes its src from ACTIVATIONS[act], checked above)
Object.entries(C.T).filter(([k]) => k !== 'h').forEach(([k, v]) => ok(srcOk(v.src) && (!v.beyond || (v.tanh?.note && v.relu?.note) || v.note), `T.${k} src / note`));
ok(srcOk(C.STEPS.src) && srcOk(C.COLLAPSE.src) && srcOk(C.CURVE_ID.src) && srcOk(C.NOTATION.src), 'STEPS / COLLAPSE / CURVE_ID / NOTATION src');
ok(C.STEPS.list.map((s) => s.id).join() === 'forward,error,reverse,gd', "slide 19's order");

// ── report ─────────────────────────────────────────────────────────────────
console.log(`Chain Reaction check: ${checks} assertions`);
console.log(`  finite differences: max |analytic − numeric| = ${fdMax.toExponential(2)} over ${3 * 300 + 1} nets; ${seen.fdItems} asked gradients checked, max drift from the 2-decimal display ${seen.fdDrift.toFixed(4)}`);
console.log(`  item kinds: ${[...seen.kinds].join(', ')}; task cards seen: ${seen.tasks.size}/${C.TASKS.length}; slide 23's own example ${seen.slideCollapse}×`);
console.log(`  tanh reverse steps: ${seen.tanhSteps} checked (both keys ±0.01 pass, σ′ in place of tanh′ fails, |z| ≥ 0.5)`);
console.log(`  beyond items per round type: ${[...seen.beyond].map(([k, n]) => `${k} ×${n}`).join(', ')}`);
if (failures.length) {
  console.log(`\n${failures.length} FAILURE(S):`);
  failures.slice(0, 40).forEach((m) => console.log(`  ✗ ${m}`));
  process.exit(1);
}
console.log('All checks passed.');
