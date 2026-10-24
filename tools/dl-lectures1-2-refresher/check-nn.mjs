/* ============================================================================
   DL LECTURES 1–2 REFRESHER — maths check (node, no browser)
   ----------------------------------------------------------------------------
     node tools/dl-lectures1-2-refresher/check-nn.mjs

   Checks nn.js against hand-worked values, finite differences and the
   numbers the slides print: the step functions, the perceptron rule (L1
   slide 10) and Figure 10-6b's XOR net, the activations and derivatives
   (L1 20–22, L2 11–21), backprop on the 2-2-1 net, softmax and
   cross-entropy, Huber, Dense parameter counts (L1 36, 45; L2 27), the BN
   transform (L2 24), clipping (L2 29), every optimizer step (L2 34–43), the
   schedules (L2 50–59), the penalties and dropout mask (L2 60–63), the
   gradient-flow regimes, the learning-rate sweep (L1 60), the plain-text
   maths twins, and the slide coverage of sections.js.
   ========================================================================== */
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '../../src/components/portal/modules/deep-learning/lectures1-2-refresher');
const imp = (f) => import(pathToFileURL(path.join(ROOT, f)).href);
const nn = await imp('nn.js');
const { texText } = await imp('texText.js');
const { SECTIONS, PAGES } = await imp('sections.js');

let pass = 0;
const fails = [];
const ok = (cond, name) => { if (cond) pass += 1; else fails.push(name); };
const near = (a, b, tol, name) => ok(Math.abs(a - b) <= tol, `${name}: got ${a}, want ${b} ± ${tol}`);
const vnear = (a, b, tol, name) => a.forEach((v, i) => near(v, b[i], tol, `${name}[${i}]`));

/* ── L1 · step functions and the TLU (slides 4–5) ───────────────────────── */
ok(nn.heaviside(-1e-9) === 0 && nn.heaviside(0) === 1 && nn.heaviside(3) === 1, 'heaviside: 0 if z < 0, 1 if z ≥ 0');
ok(nn.sign(-2) === -1 && nn.sign(0) === 0 && nn.sign(5) === 1, 'sign(z) ∈ {−1, 0, +1}');
near(nn.tluZ([2, -1], 0.5, [1, 3]), -0.5, 1e-12, 'z = wᵀx + b');

/* ── L1 · the perceptron rule (slide 10), worked by hand ────────────────── */
{
  const r = nn.perceptronStep([1, -1], 0, [1, 3], 1, 0.5); // z = −2 → ŷ = 0, y − ŷ = +1
  ok(r.yhat === 0 && r.err === 1, 'perceptron: prediction and error');
  vnear(r.w, [1.5, 0.5], 1e-12, 'perceptron: w + η(y − ŷ)x');
  near(r.b, 0.5, 1e-12, 'perceptron: bias as a weight on a constant 1');
  const noop = nn.perceptronStep([1, 1], 0, [1, 1], 1, 0.5);
  ok(noop.err === 0 && noop.w[0] === 1 && noop.b === 0, 'perceptron: no update when right');
  const data = [
    { x: [1.0, 3.0], y: 1 }, { x: [2.0, 3.5], y: 1 }, { x: [1.5, 2.0], y: 1 },
    { x: [3.0, 1.0], y: 0 }, { x: [3.5, 2.5], y: 0 }, { x: [2.5, 0.5], y: 0 },
  ];
  for (const eta of [0.25, 0.5, 1]) {
    const t = nn.trainPerceptron(data, { w: [1, -1], b: 0, eta, maxEpochs: 12 });
    ok(t.converged && nn.accuracy(data, t.final.w, t.final.b) === 6, `perceptron converges on separable data (η = ${eta})`);
  }
  const t = nn.trainPerceptron(nn.XOR_DATA, { maxEpochs: 30 });
  ok(!t.converged, 'perceptron never converges on XOR');
}
ok(nn.XOR_DATA.every((p) => nn.xorMlp(p.x).y === p.y), 'Figure 10-6b solves XOR (slide 17)');
ok(nn.XOR_DATA.map((p) => nn.xorMlp(p.x).h.join('')).join(' ') === '00 01 01 11', 'Figure 10-6b hidden units: AND and OR');

/* ── activations and derivatives ───────────────────────────────────────── */
near(nn.dSigmoid(0), 0.25, 1e-12, 'σ′(0) = 0.25 (Figure 10-8)');
near(nn.dTanh(0), 1, 1e-12, 'tanh′(0) = 1 (Figure 10-8)');
for (const z of [-2, -0.3, 0.7, 2.5]) {
  near(nn.dSigmoid(z), nn.sigmoid(z) * (1 - nn.sigmoid(z)), 1e-12, `σ′ = σ(1 − σ) at ${z} (slide 20)`);
  near(nn.tanh(z), 2 * nn.sigmoid(2 * z) - 1, 1e-12, `tanh = 2σ(2z) − 1 at ${z} (slide 21)`);
}
near(nn.softplus(0), Math.log(2), 1e-12, 'softplus(0) = log 2 (slide 25)');
ok(nn.relu(-3) === 0 && nn.relu(2) === 2, 'ReLU = max(0, z)');
near(nn.leakyRelu(-2, 0.2), -0.4, 1e-12, 'leaky ReLU = max(αz, z)');
near(nn.elu(-50, 1), -1, 1e-9, 'ELU_1 → −1');
near(nn.elu(-50, 2), -2, 1e-9, 'ELU_2 → −2 (slide 15)');
near(nn.selu(-60), -1.0507 * 1.6733, 1e-6, 'SELU → −1.0507 × 1.6733 ≈ −1.758 (slide 17: ≈ −1.76)');
near(nn.dSelu(-1e-9), 1.0507 * 1.6733, 1e-6, 'SELU slope just left of 0 ≈ 1.758');
near(nn.dSelu(1e-9), 1.0507, 1e-12, 'SELU slope right of 0 = 1.0507');
for (const z of [-3, -1, 0.5, 2]) near(nn.gelu(z), z * nn.sigmoid(1.702 * z), 0.03, `GELU ≈ zσ(1.702z) at ${z} (slide 18)`);
near(nn.Phi(0), 0.5, 1e-9, 'Φ(0) = 0.5');
near(nn.Phi(1.96), 0.975, 2e-4, 'Φ(1.96) ≈ 0.975');
near(nn.swish(1.3, 1), 1.3 * nn.sigmoid(1.3), 1e-12, 'SiLU = zσ(z) (slide 19)');
near(nn.mish(1), Math.tanh(Math.log(1 + Math.E)), 1e-12, 'Mish(1) = tanh(softplus(1)) (slide 20)');
// every derivative against a central difference (away from kinks)
for (const [k, a] of Object.entries(nn.ACT)) {
  if (k === 'heaviside') continue;
  for (const z of [-2.3, -0.7, 0.4, 1.9]) {
    const h = 1e-5;
    near(a.d(z), (a.f(z + h) - a.f(z - h)) / (2 * h), 1e-4, `${k}′ vs finite difference at ${z}`);
  }
}

/* ── backprop on the 2-2-1 net, against finite differences ──────────────── */
{
  const net = { W: [[0.5, -0.4], [0.3, 0.8]], b: [0.1, -0.2], v: [0.7, -0.6], c: 0.05 };
  const x = [1, 0];
  const y = 1;
  const g = nn.mlpBackward(net, x, y);
  const L = (n) => 0.5 * (nn.mlpForward(n, x).yhat - y) ** 2;
  const h = 1e-6;
  const fd = (mut) => {
    const p = structuredClone(net);
    const m = structuredClone(net);
    mut(p, h);
    mut(m, -h);
    return (L(p) - L(m)) / (2 * h);
  };
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) near(g.gW[i][j], fd((n, d) => { n.W[i][j] += d; }), 1e-7, `∂L/∂w_${i + 1},${j + 1}`);
  for (let j = 0; j < 2; j++) near(g.gv[j], fd((n, d) => { n.v[j] += d; }), 1e-7, `∂L/∂v_${j + 1}`);
  near(g.gc, fd((n, d) => { n.c += d; }), 1e-7, '∂L/∂c');
  const after = nn.mlpUpdate(net, g, 0.5);
  ok(L(after) < g.loss, 'one gradient step lowers the loss');
}

/* ── output layers and losses (L1 slides 27–29) ─────────────────────────── */
{
  const p = nn.softmax([0.5, 2, -1]);
  near(p.reduce((a, v) => a + v, 0), 1, 1e-12, 'softmax sums to 1');
  near(nn.crossEntropy([0.2, 0.7, 0.1], 1), -Math.log(0.7), 1e-12, 'cross-entropy = −log p̂ of the true class');
  near(nn.huber(0.8, 1), 0.32, 1e-12, 'Huber: ½z² inside δ');
  near(nn.huber(3, 1), 2.5, 1e-12, 'Huber: δ(|z| − ½δ) outside δ');
  near(nn.huber(1, 1), nn.huber(1 + 1e-9, 1), 1e-8, 'Huber is continuous at δ');
  near((nn.huber(4, 2) - nn.huber(3, 2)), 2, 1e-12, 'Huber slope beyond δ is δ');
  near(nn.sqErr(3.2), 10.24, 1e-12, 'slide 28: sq. error z² reaches 10 near |z| = 3.2');
}

/* ── parameter counts the slides print ──────────────────────────────────── */
ok(nn.denseParams(784, 300) === 235500, 'Dense(300) on 784: 235,500 (L1 slide 36, L2 slide 27)');
ok(nn.denseParams(300, 100) === 30100, 'Dense(100): 30,100');
ok(nn.denseParams(100, 10) === 1010, 'Dense(10): 1,010');
ok(nn.denseParams(784, 300) + nn.denseParams(300, 100) + nn.denseParams(100, 10) === 266610, 'total 266,610 (L1 slide 36)');
ok(4 * 784 === 3136 && 4 * 300 === 1200 && 4 * 100 === 400, 'BN: 4 parameters per feature (L2 slide 27)');
ok(266610 + 3136 + 1200 + 400 === 271346 && 2 * (784 + 300 + 100) === 2368 && 271346 - 2368 === 268978, 'BN model: 271,346 total, 2,368 non-trainable, 268,978 trainable (L2 slide 27)');
ok(17 + nn.denseParams(8, 30) + nn.denseParams(30, 30) + nn.denseParams(38, 1) === 1256, 'Wide & Deep summary: 1,256 (L1 slide 45)');

/* ── batch norm (L2 slide 24) ───────────────────────────────────────────── */
{
  const xs = [4, 6, 8, 9, 3];
  const bn = nn.batchNorm(xs, 2, 0.5, 1e-3);
  near(bn.mu, 6, 1e-12, 'μ_B');
  near(bn.var, 5.2, 1e-12, 'σ_B² (population variance, 1/m_B)');
  near(bn.xhat.reduce((a, v) => a + v, 0), 0, 1e-12, 'x̂ has mean 0');
  near(bn.xhat.reduce((a, v) => a + v * v, 0) / xs.length, 5.2 / 5.201, 1e-9, 'x̂ has variance σ²/(σ² + ε)');
  vnear(bn.z, bn.xhat.map((v) => 2 * v + 0.5), 1e-12, 'z = γ ⊗ x̂ + β');
}

/* ── clipping (L2 slide 29) ─────────────────────────────────────────────── */
{
  vnear(nn.clipValue([0.9, 100], 1), [0.9, 1], 1e-12, 'clipvalue clips each component');
  vnear(nn.clipNorm([0.9, 100], 1), [0.9 / Math.hypot(0.9, 100), 100 / Math.hypot(0.9, 100)], 1e-12, 'clipnorm rescales to length 1');
  near(nn.angleDeg(nn.clipNorm([0.9, 3])), nn.angleDeg([0.9, 3]), 1e-9, 'clipnorm keeps the direction');
  ok(Math.abs(nn.angleDeg(nn.clipValue([0.9, 3])) - nn.angleDeg([0.9, 3])) > 10, 'clipvalue can change the direction');
  vnear(nn.clipNorm([0.3, 0.4], 1), [0.3, 0.4], 1e-12, 'clipnorm leaves short vectors alone');
}

/* ── optimizers on a known gradient (L2 slides 34–43) ──────────────────── */
{
  const G = () => [2, -4]; // a constant gradient
  const s1 = nn.optStep('sgd', [1, 1], {}, G, { eta: 0.1 });
  vnear(s1.theta, [0.8, 1.4], 1e-12, 'GD: θ − η∇J');
  let m = nn.optStep('momentum', [1, 1], {}, G, { eta: 0.1, beta: 0.9 });
  vnear(m.state.m, [-0.2, 0.4], 1e-12, 'momentum step 1: m = −η∇J');
  m = nn.optStep('momentum', m.theta, m.state, G, { eta: 0.1, beta: 0.9 });
  vnear(m.state.m, [-0.38, 0.76], 1e-12, 'momentum step 2: m = βm − η∇J');
  vnear(m.theta, [0.42, 2.16], 1e-12, 'momentum: θ + m');
  // NAG looks ahead: gradient of J = ½θ² at θ + βm
  const gq = (t) => t;
  const nag = nn.optStep('nag', [1], { m: [0.5] }, gq, { eta: 0.1, beta: 0.9 });
  near(nag.state.m[0], 0.9 * 0.5 - 0.1 * (1 + 0.45), 1e-12, 'NAG: ∇J at θ + βm');
  const ada = nn.optStep('adagrad', [0, 0], {}, G, { eta: 0.1, eps: 1e-10 });
  vnear(ada.state.s, [4, 16], 1e-12, 'AdaGrad: s + ∇J ⊗ ∇J');
  vnear(ada.theta, [-0.1, 0.1], 1e-9, 'AdaGrad: θ − η∇J ⊘ √(s + ε)');
  const rms = nn.optStep('rmsprop', [0, 0], {}, G, { eta: 0.1, rho: 0.9, eps: 1e-10 });
  vnear(rms.state.s, [0.4, 1.6], 1e-12, 'RMSProp: ρs + (1 − ρ)∇J ⊗ ∇J');
  vnear(rms.theta, [-0.1 * 2 / Math.sqrt(0.4), 0.1 * 4 / Math.sqrt(1.6)], 1e-9, 'RMSProp step');
  const adam = nn.optStep('adam', [0, 0], {}, G, { eta: 0.1, beta1: 0.9, beta2: 0.999, eps: 1e-10 });
  vnear(adam.state.m, [0.2, -0.4], 1e-12, 'Adam step 1: m');
  vnear(adam.state.s, [0.004, 0.016], 1e-12, 'Adam step 2: s');
  vnear(adam.theta, [-0.1, 0.1], 1e-7, 'Adam steps 3–5: bias correction makes the first step ≈ η·sign(∇J)');
  const bowl = ([a, b]) => [0.1 * a, 2 * b];
  for (const k of nn.OPTIMISERS) {
    const hp = { sgd: { eta: 0.85 }, momentum: { eta: 0.05 }, nag: { eta: 0.05 }, adagrad: { eta: 1.2 }, rmsprop: { eta: 0.12 }, adam: { eta: 0.3 } }[k];
    const p = nn.optPath(k, [-9, 2.4], bowl, 120, hp);
    const J = ([a, b]) => 0.5 * (0.1 * a * a + 2 * b * b);
    ok(J(p[120]) < 0.01 * J(p[0]), `${k} gets close to the minimum of the race's bowl`);
  }
}

/* ── schedules (L2 slides 50–59) ────────────────────────────────────────── */
near(nn.powerLR(10, { eta0: 0.01, r: 1, s: 10, c: 1 }), 0.005, 1e-12, 'power: η₀/(1 + r) after s steps');
near(nn.powerLR(20, { eta0: 0.01, r: 1, s: 10, c: 1 }), 0.01 / 3, 1e-12, 'power: η₀/(1 + 2r) after 2s');
near(nn.expLR(15, { eta0: 1, r: 0.1, s: 15 }), 0.1, 1e-12, 'exponential: η(15) = 0.1η₀ (slide 52)');
near(nn.expLR(30, { eta0: 1, r: 0.1, s: 15 }), 0.01, 1e-12, 'exponential: η(30) = 0.01η₀');
ok(nn.piecewiseLR(0) === 0.1 && nn.piecewiseLR(5) === 0.04 && nn.piecewiseLR(25) === 0.02 && nn.piecewiseLR(40) === 0.01, 'piecewise: slide 55 chart steps');
ok(nn.piecewiseLR(60000, { boundaries: [50000, 80000], values: [0.01, 0.005, 0.001] }) === 0.005, 'PiecewiseConstantDecay(boundaries=[50_000, 80_000], …) (slide 56)');
{
  const o = { T: 50, eta0: 0.01, eta1: 0.1, tail: 0.1, floor: 0.0001 };
  near(nn.oneCycleLR(0, o), 0.01, 1e-12, '1cycle starts at η₀');
  near(nn.oneCycleLR(22.5, o), 0.1, 1e-12, '1cycle peaks at η₁ halfway');
  near(nn.oneCycleLR(45, o), 0.01, 1e-12, '1cycle back to η₀');
  near(nn.oneCycleLR(50, o), 0.0001, 1e-12, '1cycle ends orders of magnitude lower');
  const lr = nn.performanceLR([1, 0.9, 0.8, 0.8, 0.81, 0.82, 0.83, 0.84, 0.7], { eta0: 0.01, factor: 0.5, patience: 5 });
  ok(lr[7] === 0.01 && lr[8] === 0.005, 'performance: × factor after `patience` epochs without improvement');
}

/* ── penalties and dropout (L2 slides 60–63) ────────────────────────────── */
near(nn.l1Penalty([1, -2, 0.5], 0.01), 0.035, 1e-12, 'ℓ1 = λΣ|w|');
near(nn.l2Penalty([1, -2, 0.5], 0.01), 0.0525, 1e-12, 'ℓ2 = λΣw²');
vnear(nn.penaltyStep([1, -2], 'l2', 0.5, 0.1), [0.9, -1.8], 1e-12, 'ℓ2 step: w(1 − 2ηλ)');
vnear(nn.penaltyStep([0.03, -0.5], 'l1', 0.5, 0.1), [0, -0.45], 1e-12, 'ℓ1 step: −ηλ sign(w), parked at 0');
{
  const R = nn.rng(3);
  const mask = nn.dropoutMask(20000, 0.2, R);
  near(mask.filter(Boolean).length / 20000, 0.8, 0.01, 'dropout keeps ≈ 1 − p');
}

/* ── gradient-flow regimes (the §2.1 lab) ───────────────────────────────── */
{
  const g = (act, init) => nn.gradientFlow({ act, init, layers: 10, width: 40, batch: 32, seed: 7 }).gradW;
  const sg = g('sigmoid', 'glorot');
  ok(sg[0] / sg[9] < 1e-2, 'sigmoid + Glorot: gradients vanish towards the input');
  const rn = g('relu', 'normal');
  ok(Math.max(...rn) > 100, 'ReLU + N(0, 1): gradients explode');
  const rh = g('relu', 'he');
  ok(rh[0] / rh[9] > 0.1 && rh[0] / rh[9] < 10 && Math.max(...rh) < 1, 'ReLU + He: stable');
  const tg = g('tanh', 'glorot');
  ok(tg[0] / tg[9] > 0.1 && tg[0] / tg[9] < 10, 'tanh + Glorot: stable');
}

/* ── the learning-rate sweep (L1 slide 60) ──────────────────────────────── */
{
  const s = nn.lrSweep();
  ok(Math.abs(s[0].lr - 1e-5) < 1e-12, 'sweep starts at 10⁻⁵');
  const k = s[1].lr / s[0].lr;
  near(k, 10 ** (6 / 499), 1e-9, 'sweep: ×10^(6/499) per iteration (10⁻⁵ → 10 in 500)');
  const u = nn.shootUp(s);
  ok(u.upAt.lr > 0.3 && u.upAt.lr < 3 && u.minAt.lr < u.upAt.lr, 'sweep: the loss shoots up after its minimum');
  const near10 = s.find((p) => p.lr >= u.upAt.lr / 10);
  ok(near10.smooth < 2 * u.minAt.smooth, 'sweep: 10× below the shoot-up is in the low-loss zone');
}

/* ── plain-text twins of the module's formulas ──────────────────────────── */
{
  const twins = {
    rule: ['w_{i,j}^{(\\text{next step})} = w_{i,j} + \\eta\\left(y_j - \\hat{y}_j\\right)x_i', ')xᵢ'],
    bn: ['\\hat{\\mathbf{x}}^{(i)} = \\frac{\\mathbf{x}^{(i)} - \\boldsymbol{\\mu}_B}{\\sqrt{\\boldsymbol{\\sigma}_B^2 + \\epsilon}}', 'μ_B'],
    adam: ['\\boldsymbol{\\theta} \\leftarrow \\boldsymbol{\\theta} - \\eta\\,\\widehat{\\mathbf{m}} \\oslash \\sqrt{\\widehat{\\mathbf{s}} + \\epsilon}', '⊘'],
    rms: ['\\mathbf{s} \\leftarrow \\rho\\mathbf{s} + (1 - \\rho)\\nabla_{\\boldsymbol{\\theta}} J(\\boldsymbol{\\theta}) \\otimes \\nabla_{\\boldsymbol{\\theta}} J(\\boldsymbol{\\theta})', 'ρs'],
    glorot: ['r = \\sqrt{3/\\text{fan}_{\\text{avg}}}', 'fan_avg'],
    exp: ['\\eta(t) = \\eta_0 r^{t/s}', 'η(t)'],
  };
  for (const [k, [tex, want]] of Object.entries(twins)) {
    const t = texText(tex);
    ok(!t.includes('\\') && t.includes(want), `texText(${k}) → "${t}"`);
  }
  // every $…$ and eq in the Read prose prints without a backslash
  const all = JSON.stringify(SECTIONS);
  const inline = [...all.matchAll(/\$([^$]+)\$/g)].map((m) => JSON.parse(`"${m[1]}"`));
  const bad = inline.map((t) => texText(t)).filter((t) => t.includes('\\'));
  ok(bad.length === 0, `inline maths twins are clean (${bad.slice(0, 3).join(' | ')})`);
}

/* ── coverage: every slide of both decks in exactly one section ─────────── */
for (const [lec, total] of [[1, 64], [2, 68]]) {
  const seen = new Array(total + 1).fill(0);
  SECTIONS.filter((s) => s.lec === lec).forEach((s) => {
    String(s.slides).split(',').forEach((part) => {
      const [a, b] = part.trim().split('–').map(Number);
      for (let n = a; n <= (b || a); n++) seen[n] += 1;
    });
  });
  const missing = seen.map((c, n) => (n && c !== 1 ? `${n}×${c}` : null)).filter(Boolean);
  ok(missing.length === 0, `L${lec} slides 1–${total} each covered once (${missing.join(', ')})`);
}
ok(PAGES.length === 3, 'exactly three notebook pages');

console.log(`check-nn: ${pass} passed, ${fails.length} failed`);
if (fails.length) {
  fails.forEach((f) => console.log(`  ✗ ${f}`));
  process.exitCode = 1;
}
