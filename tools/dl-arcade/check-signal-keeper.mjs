#!/usr/bin/env node
/* check-signal-keeper.mjs — Signal Keeper (Lecture 2, slides 5–29) fidelity and round checks.

   1. FIDELITY against hand-worked examples from the slide equations (arithmetic
      in the comments, with the slide): Glorot / He / LeCun variances and the
      Glorot uniform limit (slides 7–8, Table 11-1), the activations as the
      slides define them (slides 6, 10, 11, 15, 16, 18–20), a BN batch by hand
      (slide 24), clipvalue / clipnorm (slide 29).
   2. SIMULATION: the backward pass matches finite differences (with and
      without BN); He + ReLU keeps the layer std near 1 better than Glorot +
      ReLU over 10 layers; sigmoid on N(0, 1) saturates; SELU on LeCun normal
      self-normalises; every stack the game shows as sick is sick and every
      fix it shows heals it; the diagnose read-outs clear their thresholds by
      a margin.
   3. ROUNDS: 30 seeded rounds per level. Every item has a unique id, a
      concept in the catalogue (Lecture 2), a src inside slides 5–29, a why
      and a prompt; its answer is JSON-serialisable and grades true, a
      mutated answer and a skip grade false; numeric answers are re-derived
      here from the item's own data with independent formulas; `beyond`
      items are rare and carry a note; every TeX string renders (KaTeX
      strict).

   Run:  node tools/dl-arcade/check-signal-keeper.mjs        (exit 1 on any failure) */

import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..');
const arcade = path.join(root, 'src', 'components', 'portal', 'modules', 'deep-learning', 'arcade');
const imp = (rel) => import(pathToFileURL(path.join(arcade, rel)).href);

const S = await imp('maths/signalKeeperSim.js');
const G = await imp('maths/signalKeeper.js');
const C = await imp('content/signal-keeper.js');
const L2 = await imp('content/lecture2.js');
const { rng } = await imp('core/rng.js');
const { CONCEPTS } = await imp('core/concepts.js');
const { grade } = await imp('kit/grade.js');
const katex = (await import(pathToFileURL(path.join(root, 'node_modules', 'katex', 'dist', 'katex.mjs')).href)).default;

const failures = [];
let passed = 0;
const fail = (msg) => failures.push(msg);
const near = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol;
function expect(name, ok, detail = '') {
  if (ok) passed++;
  else fail(`${name}${detail ? `: ${detail}` : ''}`);
}
function expectNear(name, got, want, tol = 1e-9) {
  expect(name, near(got, want, tol), `got ${got}, want ${want}`);
}
function texOk(tex, where) {
  try {
    katex.renderToString(tex, { throwOnError: true, strict: 'error' });
    passed++;
  } catch (e) {
    fail(`${where}: KaTeX "${tex}" → ${e.message.split('\n')[0]}`);
  }
}
const mathIn = (text) => (String(text ?? '').match(/\$[^$]+\$/g) ?? []).map((m) => m.slice(1, -1));

/* ── 1. fidelity ──────────────────────────────────────────────────────── */
{
  // Slide 7: fan_avg = (fan_in + fan_out)/2; Glorot normal σ² = 1/fan_avg.
  //   fan_in = 300, fan_out = 100 → fan_avg = 400/2 = 200 → σ² = 1/200 = 0.005
  expectNear('slide 7 fan_avg(300, 100)', S.fanAvg(300, 100), 200);
  expectNear('slide 7 Glorot σ²(300, 100)', G.glorotVariance(300, 100), 0.005);
  // Slide 7: uniform over [−r, +r], r = √(3/fan_avg).
  //   fan_in = 256, fan_out = 128 → fan_avg = 192 → r = √(3/192) = √(1/64) = 0.125
  expectNear('slide 7 Glorot r(256, 128)', G.glorotLimit(256, 128), 0.125);
  //   fan_in = 400, fan_out = 200 → fan_avg = 300 → r = √(3/300) = √0.01 = 0.1
  expectNear('slide 7 Glorot r(400, 200)', G.glorotLimit(400, 200), 0.1);
  //   fan_in = 300, fan_out = 100 → r = √(3/200) = √0.015 ≈ 0.122474
  expectNear('slide 7 Glorot r(300, 100)', G.glorotLimit(300, 100), 0.1224744871, 1e-9);
  // Uniform on [−r, r] has variance r²/3 = (3/fan_avg)/3 = 1/fan_avg: the two Glorot forms agree
  expectNear('slide 7 uniform variance r²/3 = 1/fan_avg', S.glorotLimit(300, 100) ** 2 / 3, 1 / S.fanAvg(300, 100), 1e-12);
  // Slide 8, Table 11-1: He σ² = 2/fan_in; LeCun σ² = 1/fan_in (fan_out does not enter).
  //   fan_in = 400 → He 2/400 = 0.005, LeCun 1/400 = 0.0025
  expectNear('slide 8 He σ²(400)', G.heVariance(400), 0.005);
  expectNear('slide 8 LeCun σ²(400)', G.lecunVariance(400), 0.0025);
  //   the simulation's 50 → 50 layers: Glorot 1/50 = 0.02 = LeCun 1/50; He 2/50 = 0.04; N(0, 1): 1 (slide 6)
  expectNear('sim Glorot σ²(50, 50)', S.initSigma2('glorot', 50, 50), 0.02);
  expectNear('sim LeCun σ²(50, 50)', S.initSigma2('lecun', 50, 50), 0.02);
  expectNear('sim He σ²(50, 50)', S.initSigma2('he', 50, 50), 0.04);
  expectNear('slide 6 N(0, 1) σ²', S.initSigma2('n01', 50, 50), 1);
  // Table 11-1 pairings (slide 8)
  const table = { none: 'glorot', tanh: 'glorot', sigmoid: 'glorot', softmax: 'glorot', relu: 'he', leaky: 'he', elu: 'he', gelu: 'he', silu: 'he', mish: 'he', selu: 'lecun' };
  Object.entries(table).forEach(([a, i]) => expect(`Table 11-1: ${a} → ${i}`, G.tableInit(a) === i, G.tableInit(a)));
  // the content's Table matches lecture2.js FACTS l2.init.table.*
  const facts = Object.fromEntries(L2.FACTS.map((f) => [f.id, f.text]));
  expect('Table 11-1 Glorot row matches lecture2 FACTS', /None, tanh, sigmoid and softmax/.test(facts['l2.init.table.glorot']));
  expect('Table 11-1 He row matches lecture2 FACTS', /ReLU, Leaky ReLU, ELU, GELU, Swish and Mish/.test(facts['l2.init.table.he']));
  expect('Table 11-1 LeCun row matches lecture2 FACTS', /SELU/.test(facts['l2.init.table.lecun']));
}

{
  const A = S.ACT_FNS;
  // slide 6: σ(z) = 1/(1 + e^−z): σ(0) = 0.5 (mean 0.5), saturates at 0 / 1
  expectNear('slide 6 sigmoid(0)', A.sigmoid.f(0), 0.5);
  expect('slide 6 sigmoid saturates', A.sigmoid.f(-12) < 1e-5 && A.sigmoid.f(12) > 1 - 1e-5 && A.sigmoid.d(12) < 1e-5);
  // slide 10: ReLU(z) = max(0, z)
  expectNear('slide 10 ReLU(−2)', A.relu.f(-2), 0);
  expectNear('slide 10 ReLU(3)', A.relu.f(3), 3);
  // slide 11: LeakyReLU_α(z) = max(αz, z): α = 0.2, z = −5 → max(−1, −5) = −1; z = 2 → 2
  expectNear('slide 11 LeakyReLU_0.2(−5)', G.leakyRelu(-5, 0.2), -1);
  expectNear('slide 11 LeakyReLU_0.2(2)', G.leakyRelu(2, 0.2), 2);
  //   α = 0.01, z = −20 → max(−0.2, −20) = −0.2; α = 0.3, z = −4 → −1.2
  expectNear('slide 11 LeakyReLU_0.01(−20)', G.leakyRelu(-20, 0.01), -0.2);
  expectNear('slide 11 LeakyReLU_0.3(−4)', G.leakyRelu(-4, 0.3), -1.2);
  expectNear('sim leaky uses α = 0.2 (slide 12 code)', A.leaky.f(-5), -1);
  // slide 15: ELU_α(z) = α(exp(z) − 1) if z < 0, z if z ≥ 0; floor −α (dotted lines at −1, −2)
  expectNear('slide 15 ELU_1(−1)', A.elu.f(-1), Math.exp(-1) - 1, 1e-12);
  expectNear('slide 15 ELU_1(2)', A.elu.f(2), 2);
  const eluAnchor = L2.ANCHORS.find((a) => a.id === 'l2.elu.asymptote').value;
  expect('slide 15 ELU floors −1, −2 (lecture2 ANCHOR)', G.eluFloor(1) === eluAnchor[0] && G.eluFloor(2) === eluAnchor[1]);
  // slide 16: SELU(z) = s·ELU_1.6733(z), s = 1.0507: SELU(1) = 1.0507; SELU(−∞) = −1.0507 × 1.6733 = −1.75813…
  expectNear('slide 16 SELU(1)', A.selu.f(1), 1.0507, 1e-12);
  expectNear('slide 16 SELU(−1)', A.selu.f(-1), 1.0507 * 1.6733 * (Math.exp(-1) - 1), 1e-12);
  expectNear('slide 16 SELU floor ≈ −1.758 (lecture2 ANCHOR)', G.seluFloor(), L2.ANCHORS.find((a) => a.id === 'l2.selu.asymptote').value, 0.001);
  expectNear('slide 16 SELU(−30) → floor', A.selu.f(-30), -1.0507 * 1.6733, 1e-9);
  // slide 18: GELU(z) = zΦ(z) ≈ zσ(1.702z); Φ(1) = 0.841345 (standard normal CDF)
  expectNear('slide 18 GELU(1) = Φ(1)', A.gelu.f(1), 0.8413447, 1e-6);
  [-3, -1, -0.5, 0.5, 1, 2].forEach((z) => expectNear(`slide 18 GELU(${z}) ≈ zσ(1.702z)`, A.gelu.f(z), z * A.sigmoid.f(1.702 * z), 0.03));
  // slide 19: SiLU(z) = zσ(z); slide 20: Mish(z) = z·tanh(softplus(z)), softplus = log(1 + exp(z))
  expectNear('slide 19 SiLU(2)', A.silu.f(2), 2 / (1 + Math.exp(-2)), 1e-12);
  expectNear('slide 20 Mish(1)', A.mish.f(1), Math.tanh(Math.log(1 + Math.exp(1))), 1e-12);
  // every derivative the backward pass uses matches a central difference
  Object.entries(A).forEach(([k, F]) => {
    [-2.3, -0.7, 0.4, 1.9].forEach((z) => {
      const h = 1e-6;
      const fd = (F.f(z + h) - F.f(z - h)) / (2 * h);
      expectNear(`f′ of ${k} at ${z}`, F.d(z), fd, 1e-5);
    });
  });
}

{
  // Slide 24, one feature, m_B = 4: x = (2, 4, 6, 8)
  //   μ_B = (2 + 4 + 6 + 8)/4 = 20/4 = 5
  //   σ²_B = ((−3)² + (−1)² + 1² + 3²)/4 = (9 + 1 + 1 + 9)/4 = 20/4 = 5   (1/m_B, not 1/(m_B − 1))
  //   x̂ for x = 8: (8 − 5)/√(5 + ε) = 3/√5 = 1.341641 (ε = 0)
  //   z = γ ⊗ x̂ + β with γ = 2, β = 1: 2 × 1.341641 + 1 = 3.683282
  const b = G.bnBatch([2, 4, 6, 8], 2, 1);
  expectNear('slide 24 μ_B', b.mu, 5);
  expectNear('slide 24 σ²_B', b.var, 5);
  expectNear('slide 24 x̂ for 8', b.xhat[3], 3 / Math.sqrt(5), 1e-9);
  expectNear('slide 24 z for 8', b.z[3], 2 * (3 / Math.sqrt(5)) + 1, 1e-9);
  //   with ε = 0.001: x̂ = 3/√5.001 = 1.341507
  expectNear('slide 24 x̂ with ε = 0.001', G.bnBatch([2, 4, 6, 8], 1, 0, 0.001).xhat[3], 3 / Math.sqrt(5.001), 1e-9);
  // A batch the game uses: deviations (−7, −1, 1, 7) around μ = 3 → x = (−4, 2, 4, 10)
  //   μ_B = 12/4 = 3; σ²_B = (49 + 1 + 1 + 49)/4 = 25; x̂ for 10 = 7/5 = 1.4; z (γ = 0.5, β = −1) = 0.7 − 1 = −0.3
  const c = G.bnBatch([-4, 2, 4, 10], 0.5, -1);
  expect('slide 24 game batch μ_B = 3, σ²_B = 25', c.mu === 3 && c.var === 25, JSON.stringify(c));
  expectNear('slide 24 game batch x̂ = 1.4', c.xhat[3], 1.4);
  expectNear('slide 24 game batch z = −0.3', c.z[3], -0.3);
  // every BN deviation template sums to 0 and has the whole-number σ it claims
  C.BN.deviations.forEach(({ d, sd }) => {
    expect(`BN template ${d} sums to 0`, d.reduce((s, x) => s + x, 0) === 0);
    expectNear(`BN template ${d} σ_B = ${sd}`, Math.sqrt(d.reduce((s, x) => s + x * x, 0) / d.length), sd);
  });
  // Slide 27 anchors: BN on 784, 300, 100 features → 3,136, 1,200, 400 params; non-trainable 2 × (784 + 300 + 100) = 2,368
  const bnRow = (id) => L2.ANCHORS.find((a) => a.id === id).value;
  expect('slide 27 BN(784) = 4 × 784', C.BN.count.asks.total.mult * 784 === bnRow('l2.bn.bn784'));
  expect('slide 27 BN(300) = 4 × 300', C.BN.count.asks.total.mult * 300 === bnRow('l2.bn.bn300'));
  expect('slide 27 BN(100) = 4 × 100', C.BN.count.asks.total.mult * 100 === bnRow('l2.bn.bn100'));
  expect('slide 27 non-trainable 2,368', C.BN.count.asks.nonTrainable.mult * (784 + 300 + 100) === bnRow('l2.bn.nonTrainable'));
}

{
  // Slide 29: SGD(clipvalue=1.0) clips every component to [−1.0, 1.0]
  //   g = (0.4, −3.0, 2.5) → (0.4, −1.0, 1.0); the direction changes:
  //   cos∠ = (0.16 + 3 + 2.5)/(‖g‖ ‖g′‖) = 5.66/(3.9256 × 1.4697) = 0.9810 < 1
  const g = [0.4, -3, 2.5];
  const cv = G.clipValue(g, 1);
  expect('slide 29 clipvalue (0.4, −3, 2.5) → (0.4, −1, 1)', JSON.stringify(cv) === JSON.stringify([0.4, -1, 1]), JSON.stringify(cv));
  const cos = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0) / (G.l2norm(a) * G.l2norm(b));
  expectNear('slide 29 clipvalue changes the orientation (cos ≈ 0.981)', cos(g, cv), 5.66 / (Math.sqrt(15.41) * Math.sqrt(2.16)), 1e-9);
  expect('slide 29 clipvalue orientation changed', cos(g, cv) < 0.999);
  // clipnorm=1.0 "retains the gradient vector orientation" (slide 29). The rescaling rule is Keras's (beyond):
  //   g = (3, 4), ‖g‖ = 5 → g × 1/5 = (0.6, 0.8): same direction (cos = 1), norm 1
  const cn = G.clipNorm([3, 4], 1);
  expect('clipnorm (3, 4) → (0.6, 0.8)', near(cn[0], 0.6) && near(cn[1], 0.8), JSON.stringify(cn));
  expectNear('slide 29 clipnorm keeps the orientation', cos([3, 4], cn), 1, 1e-12);
  expect('clipnorm leaves (0.3, 0.4) alone (norm 0.5 ≤ 1)', JSON.stringify(G.clipNorm([0.3, 0.4], 1)) === JSON.stringify([0.3, 0.4]));
  C.CLIP.normVectors.forEach((v) => {
    const out = G.clipNorm(v, 1);
    expect(`clipnorm ${v}: a clean answer (≤ 4 decimals)`, out.every((x) => near(x, Math.round(x * 1e4) / 1e4, 1e-12)), JSON.stringify(out));
  });
}

/* ── 2. simulation ────────────────────────────────────────────────────── */
{
  // the backward pass against central differences of L = Σ T ⊙ a_top, on small stacks
  const configs = [
    { act: 'tanh', init: 'glorot', bn: null },
    { act: 'elu', init: 'he', bn: null },
    { act: 'selu', init: 'lecun', bn: null },
    { act: 'gelu', init: 'he', bn: null },
    { act: 'mish', init: 'he', bn: null },
    { act: 'sigmoid', init: 'n01', bn: 'before' },
    { act: 'tanh', init: 'glorotUniform', bn: 'after' },
  ];
  configs.forEach((cfg) => {
    const c = { ...cfg, layers: 3, units: 6, batch: 5, seed: 11 };
    const base = S.run(c);
    const R = rng(3);
    for (let t = 0; t < 6; t++) {
      const k = R.int(0, base.X.length - 1);
      const h = 1e-5;
      const xp = Float64Array.from(base.X);
      const xm = Float64Array.from(base.X);
      xp[k] += h;
      xm[k] -= h;
      const fd = (S.run(c, xp).loss - S.run(c, xm).loss) / (2 * h);
      expectNear(`backward = finite difference (${cfg.act}, ${cfg.init}, bn ${cfg.bn}) at x[${k}]`, base.gradIn[k], fd, 1e-5 * Math.max(1, Math.abs(fd)));
    }
  });
}

{
  const sim = (act, init, bn = null) => S.simulate({ act, init, bn });
  const logDev = (s) => s.layers.map((r) => Math.abs(Math.log10(r.zStd)));
  const maxDev = (s) => Math.max(...logDev(s));
  // He + ReLU keeps σ(z) near 1 over 10 layers; Glorot + ReLU lets it shrink (ReLU zeroes half the units)
  const heRelu = sim('relu', 'he');
  const gloRelu = sim('relu', 'glorot');
  const gloUniRelu = sim('relu', 'glorotUniform');
  expect('He + ReLU: every layer’s σ(z) within ×3 of 1', maxDev(heRelu) < Math.log10(3), heRelu.layers.map((r) => r.zStd.toFixed(2)).join(' '));
  expect('He + ReLU stays nearer 1 than Glorot + ReLU (worst layer)', maxDev(heRelu) < maxDev(gloRelu));
  expect('He + ReLU stays nearer 1 than Glorot + ReLU (layer 10)', Math.abs(Math.log10(heRelu.layers[9].zStd)) < Math.abs(Math.log10(gloRelu.layers[9].zStd)));
  expect('Glorot + ReLU: layer 10 σ(z) has collapsed below 0.15', gloRelu.layers[9].zStd < 0.15, gloRelu.layers[9].zStd);
  expect('Glorot uniform + ReLU: layer 10 σ(z) below 0.15', gloUniRelu.layers[9].zStd < 0.15, gloUniRelu.layers[9].zStd);
  expect('He + ReLU: 10 / 10 healthy', heRelu.healthy === 10);
  // sigmoid on the old N(0, 1) init saturates (slide 6); Glorot does not
  const sigOld = sim('sigmoid', 'n01');
  const sigGlo = sim('sigmoid', 'glorot');
  expect('sigmoid + N(0, 1): every layer ≥ 30% saturated', sigOld.layers.every((r) => r.sat >= 0.3), sigOld.layers.map((r) => r.sat.toFixed(2)).join(' '));
  expect('sigmoid + N(0, 1): σ(z) ≥ 4 in every layer (outputs’ variance ≫ inputs’, slide 6)', sigOld.layers.every((r) => r.zStd >= 4));
  expect('sigmoid + Glorot: no layer saturated', sigGlo.layers.every((r) => r.sat < 0.05));
  expect('sigmoid + N(0, 1) status saturated', sigOld.layers.every((r) => r.status === 'saturated'));
  // tanh + N(0, 1) saturates; with BN before each activation it does not (slide 25)
  expect('tanh + N(0, 1) saturated', sim('tanh', 'n01').layers.every((r) => r.status === 'saturated'));
  expect('tanh + N(0, 1) + BN: 10 / 10 healthy', sim('tanh', 'n01', 'before').healthy === 10);
  // SELU on LeCun normal with standardized inputs self-normalises (slide 16)
  const selu = sim('selu', 'lecun');
  expect('SELU + LeCun: σ(z) within 0.9–1.15 in every layer', selu.layers.every((r) => r.zStd > 0.9 && r.zStd < 1.15), selu.layers.map((r) => r.zStd.toFixed(2)).join(' '));
  expect('SELU + LeCun: |mean a| < 0.15 in every layer', selu.layers.every((r) => Math.abs(r.mean) < 0.15), selu.layers.map((r) => r.mean.toFixed(2)).join(' '));
  expect('SELU + N(0, 1) explodes', S.verdict(sim('selu', 'n01')) === 'exploding');
  // BN in training mode normalises what f sees: σ(z) ≈ 1 in every layer
  expect('BN before: σ(z) ≈ 1', sim('relu', 'n01', 'before').layers.every((r) => near(r.zStd, 1, 0.01)));

  // every scene the game shows: sick before, healed after
  C.SCENES.whichInit.forEach((c) => {
    const before = sim(c.act, c.init);
    const after = sim(c.act, G.tableInit(c.act));
    expect(`whichInit ${c.act} on ${c.init} is sick`, S.verdict(before) !== 'healthy' && before.healthy <= 5, `${S.verdict(before)} ${before.healthy}`);
    expect(`whichInit ${c.act} on ${G.tableInit(c.act)} heals`, S.verdict(after) === 'healthy' && after.healthy === 10, `${S.verdict(after)} ${after.healthy}`);
  });
  C.WHICH_ACT.cues.forEach((q) => {
    const fix = C.WHICH_ACT.options[q.answer].fix;
    expect(`whichAct ${q.id}: the fix (${fix.act} + ${fix.init}) is the Table 11-1 pair`, G.tableInit(fix.act) === fix.init);
    expect(`whichAct ${q.id}: the fix heals`, sim(fix.act, fix.init).healthy === 10);
  });
  expect('the old stack (sigmoid + N(0, 1)) is sick', S.verdict(sim(C.SCENES.oldStack.act, C.SCENES.oldStack.init)) !== 'healthy');
  C.SCENES.bnHeals.forEach((c) => {
    expect(`bnHeals ${c.act} on ${c.init}: sick`, S.verdict(sim(c.act, c.init)) !== 'healthy');
    expect(`bnHeals ${c.act} on ${c.init} + BN before: 10 / 10 healthy`, sim(c.act, c.init, 'before').healthy === 10);
  });
  expect('clip stack (ReLU + N(0, 1)) shows exploding gradients', S.verdict(sim(C.CLIP.stack.act, C.CLIP.stack.init)) === 'exploding');
  expect('SELU checklist stack: N(0, 1) sick, LeCun healthy', S.verdict(sim('selu', 'n01')) !== 'healthy' && sim('selu', 'lecun').healthy === 10);
  // the diagnose read-outs clear their thresholds by a margin (×2 past 0.1 / 10, healthy within ×3 of 1)
  C.SCENES.diagnose.forEach((c) => {
    const s = sim(c.act, c.init);
    const r = s.layers[0].ratio;
    const v = S.verdict(s);
    const ok = (v === 'vanishing' && r < S.GRAD_LOW / 2) || (v === 'exploding' && r > S.GRAD_HIGH * 2) || (v === 'healthy' && r > 1 / 3 && r < 3);
    expect(`diagnose ${c.act} on ${c.init}: ${v} by a margin`, ok, `ratio ${r}`);
    expect(`diagnose ${c.act} on ${c.init}: not saturated (one clear reading)`, s.layers.every((x) => x.status !== 'saturated'));
  });
}

/* ── 3. rounds ────────────────────────────────────────────────────────── */
const SLIDES = { lo: 5, hi: 29 };
const counts = {};
let beyond = 0;
let total = 0;
const mutate = (it) => {
  if (it.kind === 'choice') return it.choices.find((c) => c.value !== it.answer).value;
  if (it.kind === 'number') return it.answer + 1;
  if (Array.isArray(it.answer)) return it.answer.length > 1 && typeof it.answer[0] === 'string' ? it.answer.slice(1) : it.answer.map((v, i) => (i === 0 ? v + 0.5 : v));
  return null;
};
for (const level of [1, 2, 3]) {
  for (let seed = 1; seed <= 30; seed++) {
    const items = G.makeItems(rng(seed * 7919 + level), level);
    const where0 = `L${level} seed ${seed}`;
    expect(`${where0} has ${G.ROUND_SIZE} items`, items.length === G.ROUND_SIZE, items.length);
    const ids = new Set();
    items.forEach((it, i) => {
      const where = `${where0} #${i} ${it.tpl}`;
      total++;
      counts[it.tpl] = (counts[it.tpl] ?? 0) + 1;
      expect(`${where} unique id`, it.id && !ids.has(it.id), it.id);
      ids.add(it.id);
      expect(`${where} concept in the catalogue`, !!CONCEPTS[it.concept], it.concept);
      expect(`${where} concept is Lecture 2`, CONCEPTS[it.concept]?.lecture === 2);
      expect(`${where} src is Lecture 2, slides 5–29`, it.src?.lecture === 2 && it.src.slides.length > 0 && it.src.slides.every((s) => s >= SLIDES.lo && s <= SLIDES.hi), JSON.stringify(it.src));
      expect(`${where} why`, typeof it.why === 'string' && it.why.length > 20);
      expect(`${where} prompt + promptText`, typeof it.prompt === 'string' && it.prompt.length > 8 && typeof it.promptText === 'string' && !it.promptText.includes('$'));
      expect(`${where} answer JSON-serialisable`, JSON.stringify(JSON.parse(JSON.stringify(it.answer))) === JSON.stringify(it.answer));
      expect(`${where} grades its own answer true`, grade(it, it.answer) === true);
      expect(`${where} grades a mutated answer false`, grade(it, mutate(it)) === false, JSON.stringify(mutate(it)));
      expect(`${where} grades a skip (null) false`, grade(it, null) === false);
      if (it.kind === 'choice') {
        const vals = it.choices.map((c) => c.value);
        expect(`${where} answer among the choices`, vals.includes(it.answer));
        expect(`${where} choice values unique`, new Set(vals.map(String)).size === vals.length);
        expect(`${where} choice labels plain text`, it.choices.every((c) => typeof c.label === 'string' && !c.label.includes('$')));
      }
      if (it.kind === 'number') {
        expect(`${where} numeric answer finite, ≤ 4 decimals`, Number.isFinite(it.answer) && near(it.answer, Math.round(it.answer * 1e4) / 1e4, 1e-9), it.answer);
        expect(`${where} the keypad can type it`, (it.decimal || Number.isInteger(it.answer)) && (it.negative || it.answer >= 0));
        expect(`${where} typed as a string grades true`, grade(it, Number(String(G.clean(it.answer, 6)))) === true);
      }
      if (it.beyond) { beyond++; expect(`${where} beyond has a note`, typeof it.note === 'string' && it.note.length > 10); }
      // every TeX the item shows
      [it.prompt, it.why].forEach((t) => mathIn(t).forEach((m) => texOk(m, `${where} text`)));
      if (it.scene?.type === 'formula') texOk(it.scene.tex, `${where} scene`);
      (it.maths?.lines ?? []).forEach((l) => l.tex.forEach((t) => texOk(t, `${where} maths`)));

      // independent re-derivations from the item's own data
      const sc = it.scene ?? {};
      const fa = (sc.fin + sc.fout) / 2;
      if (it.tpl === 'fanAvg') expectNear(`${where} fan_avg`, it.answer, fa);
      if (it.tpl === 'glorotVar') expectNear(`${where} Glorot σ² = 2/(fin + fout)`, it.answer, 2 / (sc.fin + sc.fout), 1e-12);
      if (it.tpl === 'glorotLimit') expectNear(`${where} Glorot r = √(6/(fin + fout))`, it.answer, Math.sqrt(6 / (sc.fin + sc.fout)), 1e-9);
      if (it.tpl === 'heVar') expectNear(`${where} He σ²`, it.answer, 2 / sc.fin, 1e-12);
      if (it.tpl === 'lecunVar') expectNear(`${where} LeCun σ²`, it.answer, 1 / sc.fin, 1e-12);
      if (it.tpl === 'whichInit') expect(`${where} Table 11-1 answer`, it.answer === { none: 'glorot', tanh: 'glorot', relu: 'he', leaky: 'he', elu: 'he', gelu: 'he', silu: 'he', mish: 'he', selu: 'lecun' }[sc.before.act]);
      if (it.tpl === 'leakyValue') expectNear(`${where} max(αz, z)`, it.answer, Math.max(sc.alpha * sc.mark, sc.mark), 1e-9);
      if (it.tpl?.startsWith('bn-')) {
        const m = sc.xs.length;
        const mu = sc.xs.reduce((s, x) => s + x, 0) / m;
        const v = sc.xs.reduce((s, x) => s + (x - mu) ** 2, 0) / m;
        const want = { 'bn-mu': mu, 'bn-var': v, 'bn-xhat': (sc.xi - mu) / Math.sqrt(v), 'bn-z': sc.gamma * ((sc.xi - mu) / Math.sqrt(v)) + sc.beta }[it.tpl];
        expectNear(`${where} slide 24 by hand`, it.answer, want, 1e-9);
        // negatives inside the arithmetic are bracketed: (6 - (-1)), 3 \times (-1) + 2
        expect(`${where} why brackets negatives`, !/[-+] -\d|\\times -\d/.test(it.why), it.why);
      }
      if (it.tpl === 'heVar') expect(`${where} article agrees ("an ELU")`, !/\ba [AEIOU]/.test(it.prompt), it.prompt);
      if (it.tpl === 'seluConditions') expect(`${where} SELU prompt says "if" (slide 16), not "only if"`, !/only if/.test(it.prompt));
      if (it.tpl === 'bnBenefit' && it.answer === 'saturating') {
        expect(`${where} "saturating" benefit shows a stack whose ∂L/∂z vanishes`, S.simulate(sc.before).layers[0].ratio < S.GRAD_LOW, JSON.stringify(sc.before));
      }
      if (it.tpl === 'clipVector') expect(`${where} clipvalue by hand`, it.answer.every((v, k) => near(v, Math.max(-1, Math.min(1, sc.g[k])))));
      if (it.tpl === 'clipNorm') {
        const nrm = Math.hypot(...sc.g);
        expect(`${where} clipnorm by hand`, it.answer.every((v, k) => near(v, nrm > 1 ? sc.g[k] / nrm : sc.g[k], 1e-9)));
        expect(`${where} clipnorm why: "left unchanged" exactly when ‖g‖ ≤ 1`, /left unchanged \(its norm is already ≤ 1\)/.test(it.why) === (nrm <= 1), it.why);
      }
      if (it.tpl === 'diagnose') expect(`${where} diagnose answer from the simulation`, it.answer === S.verdict(S.simulate({ ...sc.before })));
      if (it.tpl === 'seluConditions') {
        expect(`${where} SELU options: 3 constraints + 3 distractors`, it.options.length === 6 && C.SELU.conditions.every((c) => it.options.some((o) => o.value === c.id)));
        expect(`${where} SELU partial set grades false`, it.check(it.answer.slice(0, 2)) === false && it.check([...it.answer, it.options.find((o) => !it.answer.includes(o.value)).value]) === false);
      }
      if (sc.type === 'stack') {
        expect(`${where} stack before is sick`, S.verdict(S.simulate(sc.before)) !== 'healthy' || it.tpl === 'diagnose');
        if (sc.after) expect(`${where} stack after heals`, S.simulate(sc.after).healthy === 10);
        // the sim vanishes for sigmoid on Glorot, which Table 11-1 pairs: never picture it
        expect(`${where} no sigmoid-on-Glorot stack`, ![sc.before, sc.after].some((c) => c?.act === 'sigmoid' && /^glorot/.test(c.init)));
      }
    });
  }
}
// a within-norm clipnorm item (g = (0.3, 0.4), ‖g‖ = 0.5) says g is left unchanged, not "g × 1.0/0.5"
{
  let kept = null;
  for (let seed = 1; seed <= 2000 && !kept; seed++) {
    kept = G.makeItems(rng(seed * 7919 + 3), 3).find((it) => it.tpl === 'clipNorm' && Math.hypot(...it.scene.g) <= 1) ?? null;
  }
  expect('a within-norm clipnorm item turns up (L3 seeds ≤ 2000)', !!kept);
  if (kept) {
    expect('within-norm clipnorm: answer = g', kept.answer.every((v, k) => near(v, kept.scene.g[k])));
    expect('within-norm clipnorm why says g is left unchanged', /left unchanged \(its norm is already ≤ 1\)/.test(kept.why) && !/1\.0\/0\.5/.test(kept.why), kept.why);
  }
}
expect('beyond items are rare (< 4% of all items)', beyond / total < 0.04, `${beyond} / ${total}`);
expect('beyond items appear (clipnorm by hand)', beyond > 0);

// content TeX and the slide-16 constraints as lecture2.js states them
Object.values(C.ACTS).forEach((a) => a.tex && texOk(a.tex, 'ACTS'));
Object.values(C.INITS).forEach((a) => texOk(a.tex, 'INITS'));
Object.values(C.MATHS).forEach((v) => Array.isArray(v) && v.forEach((t) => texOk(t, 'MATHS')));
C.CURVES.formulas.forEach((f) => { texOk(f.tex, `formula ${f.id}`); mathIn(f.why).forEach((m) => texOk(m, `formula why ${f.id}`)); });
mathIn(C.SELU.constants.prompt).forEach((m) => texOk(m, 'SELU constants prompt'));
const factText = Object.fromEntries(L2.FACTS.map((f) => [f.id, f.text]));
expect('SELU constraint 1 matches lecture2 FACTS', /standardized/.test(factText['l2.selu.cond1']) && /standardized/.test(C.SELU.conditions[0].label));
expect('SELU constraint 2 matches lecture2 FACTS', /LeCun normal/.test(factText['l2.selu.cond2']) && /LeCun normal/.test(C.SELU.conditions[1].label));
expect('SELU constraint 3 matches lecture2 FACTS', /max-norm, batch-norm, or dropout/.test(factText['l2.selu.cond3']) && /max-norm, batch-norm, or dropout/.test(C.SELU.conditions[2].label));
expect('SELU s, α match lecture2 EQUATIONS', L2.EQUATIONS.selu.vars.s.value === S.SELU_S && L2.EQUATIONS.selu.vars.alpha.value === S.SELU_ALPHA);
expect('leaky α values match slides 11–12 (0.01, 0.2, 0.3)', JSON.stringify(C.LEAKY.alpha.cases.map((c) => c.answer)) === JSON.stringify([0.01, 0.2, 0.3]));

console.log(`Signal Keeper check: ${passed} assertions passed, ${failures.length} failed.`);
console.log(`  items by template: ${JSON.stringify(counts)}; beyond ${beyond} / ${total}`);
if (failures.length) {
  console.log(failures.slice(0, 40).map((f) => `  FAIL ${f}`).join('\n'));
  process.exit(1);
}
