/* ============================================================================
   DL LECTURE 5 STUDY — assertions for ae.js, the slide facts and the data
   ----------------------------------------------------------------------------
     node tools/dl-lecture5-study/check-ae.mjs

   Checks
     counts     stacked_ae = 163,814 and tied_ae = 82,414 (slides 12, 21), as
                computed by ae.js and as quoted in slideData.js; Figure 17-1's
                3 → 2 → 3 shapes (W 3×2 + b 2, W 2×3 + b 3)
     pca        the covariance eigenvectors satisfy C v = λ v, sorted by λ
     gradient   one full-batch SGD step equals −lr × a finite-difference
                gradient of the MSE (the trainer's maths is right)
     subspace   trained with slide 9's settings on this page's data, the
                autoencoder's plane matches PCA's (principal angles < 1°) and
                its loss reaches PCA's error, while its code axes are not
                PCA's (they meet well away from 90°)
     code       every NAMED_CODE listing appears verbatim in the transcript
     coverage   sections cover slides 1–27 exactly once, in order
     data       the Fashion MNIST run's parameter counts pass the same gates
     text       texText renders the module's maths as readable text
   ========================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const MOD = path.join(REPO, 'src/components/portal/modules/deep-learning/lecture5-study');
const imp = (f) => import(pathToFileURL(path.join(MOD, f)).href);

const ae = await imp('ae.js');
const { PARAMS, NAMED_CODE } = await imp('slideData.js');
const { SECTIONS } = await imp('sections.js');
const { texText } = await imp('texText.js');
const { RECON, TRAINING } = await imp('data/recon.js');
const { TSNE } = await imp('data/tsne.js');

const fails = [];
const ok = (cond, label, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${extra !== '' ? `  — ${extra}` : ''}`);
  if (!cond) fails.push(label);
};

// ── counts ──────────────────────────────────────────────────────────────────
const SAND = [784, 100, 30, 100, 784];
const stacked = ae.stackParams(SAND);
const tied = ae.tiedParams(SAND);
ok(stacked.total === 163814 && PARAMS.stacked.value === 163814, 'stacked_ae has 163,814 parameters (slide 12)', stacked.layers.map((l) => l.total).join(' + '));
ok(tied.total === 82414 && PARAMS.tied.value === 82414, 'tied_ae has 82,414 parameters (slide 21)', tied.layers.map((l) => l.total).join(' + '));
ok(stacked.layers.map((l) => l.total).join() === '78500,3030,3100,79184', 'stacked_ae per layer: 78,500 · 3,030 · 3,100 · 79,184');
ok(tied.layers.map((l) => l.biases).slice(2).join() === '100,784' && tied.layers[2].tiedTo === 2 && tied.layers[3].tiedTo === 1, 'tied layers 3 and 4 reuse W₂ᵀ and W₁ᵀ and keep 100 and 784 biases (N = 4)');
const wFull = stacked.layers.reduce((s, l) => s + l.weights, 0);
const wTied = tied.layers.reduce((s, l) => s + l.weights, 0);
ok(wFull === 162800 && wTied === 81400, 'tying exactly halves the weights (162,800 → 81,400)');
const f171 = ae.stackParams([3, 2, 3]);
const init = ae.initAE();
ok(f171.total === 17 && init.W1.length === 3 && init.W1[0].length === 2 && init.W2.length === 2 && init.W2[0].length === 3 && init.b1.length === 2 && init.b2.length === 3,
  'Figure 17-1: encoder W 3×2 + b 2, decoder W 2×3 + b 3 (17 parameters)');

// ── PCA ─────────────────────────────────────────────────────────────────────
const X = ae.make3D();
const P = ae.pca(X);
const resid = P.comps.map((v, k) => {
  const Cv = P.cov.map((row) => ae.dot(row, v));
  return Math.max(...Cv.map((x, i) => Math.abs(x - P.vars[k] * v[i])));
});
ok(X.length === 60 && resid.every((r) => r < 1e-9) && P.vars[0] >= P.vars[1] && P.vars[1] >= P.vars[2], 'PCA: C·v = λ·v for all three components, sorted', resid.map((r) => r.toExponential(1)).join(', '));

// ── gradient ────────────────────────────────────────────────────────────────
{
  const m0 = ae.initAE(3);
  const lr = 1e-3;
  const m1 = ae.trainEpoch(m0, X, { lr, batch: X.length });
  const keys = [['W1', 2, 1], ['b1', 0], ['W2', 1, 2], ['b2', 2]];
  const errs = keys.map(([k, i, j]) => {
    const get = (m) => (j === undefined ? m[k][i] : m[k][i][j]);
    const step = (get(m0) - get(m1)) / lr;
    const h = 1e-6;
    const bump = (d) => {
      const m = JSON.parse(JSON.stringify(m0));
      if (j === undefined) m[k][i] += d;
      else m[k][i][j] += d;
      return ae.aeLoss(m, X);
    };
    const num = (bump(h) - bump(-h)) / (2 * h);
    return Math.abs(step - num) / Math.max(1e-8, Math.abs(num));
  });
  ok(errs.every((e) => e < 1e-4), 'one SGD step = −lr × the finite-difference MSE gradient', errs.map((e) => e.toExponential(1)).join(', '));
}

// ── subspace ────────────────────────────────────────────────────────────────
{
  const run = ae.trainAE(X);
  const plane = ae.decoderPlane(run.ae);
  const angles = ae.principalAngles(plane.basis, [P.comps[0], P.comps[1]]);
  const final = run.history[run.history.length - 1];
  const axes = ae.codeAxes(run.ae);
  ok(Math.max(...angles) < 1, 'trained (SGD, lr 0.5, 500 epochs): the learned plane matches PCA’s', `principal angles ${angles.map((a) => a.toFixed(3)).join('°, ')}°`);
  ok(final < P.mse * 1.05 && final >= P.mse * 0.999, 'its loss reaches PCA’s error (the floor for a 2D linear code)', `${final.toFixed(5)} vs ${P.mse.toFixed(5)}`);
  ok(Math.abs(axes.angle - 90) > 10, 'but its code axes are not PCA’s axes (same subspace, not the same axes)', `${axes.angle.toFixed(1)}°, lengths ${axes.lengths.map((v) => v.toFixed(2)).join(' / ')}`);
  ok(run.history[0] > final * 10, 'the loss falls by more than 10×', `${run.history[0].toFixed(3)} → ${final.toFixed(5)}`);
}

// ── code listings verbatim ──────────────────────────────────────────────────
{
  const md = fs.readFileSync(path.join(REPO, 'Documents/cits5017/markdown-lecs/lecture-5.md'), 'utf8').replace(/\r\n/g, '\n');
  const blocks = [...md.matchAll(/```python\n([\s\S]*?)```/g)].map((m) => m[1].replace(/\n$/, ''));
  const missing = Object.entries(NAMED_CODE).filter(([, code]) => !blocks.includes(code)).map(([k]) => k);
  ok(missing.length === 0, `all ${Object.keys(NAMED_CODE).length} code listings match the transcript verbatim`, missing.join(', '));
}

// ── coverage ────────────────────────────────────────────────────────────────
{
  const seen = [];
  SECTIONS.forEach((s) => String(s.slides).split(',').forEach((part) => {
    const [a, b] = part.trim().split(/[–-]/).map(Number);
    for (let n = a; n <= (b || a); n++) seen.push(n);
  }));
  ok(JSON.stringify(seen) === JSON.stringify(Array.from({ length: 27 }, (_, i) => i + 1)), 'slides 1–27 each covered exactly once, in order', `${SECTIONS.length} sections`);
}

// ── the Fashion MNIST run ───────────────────────────────────────────────────
ok(TRAINING.stacked.params === 163814 && TRAINING.tied.params === 82414 && TRAINING.oneByOne.params === 163814, 'the Fashion MNIST run passed the parameter gates (163,814 / 82,414 / 163,814)');
ok(TRAINING.stacked.loss.length === 20 && TRAINING.tied.loss.length === 10 && TRAINING.oneByOne.loss.length === 5, 'trained for the slides’ epochs (20, 10, then 5 fine-tuning)');
ok(RECON.items.slice(0, 5).map((i) => i.label).join() === '0,8,0,6,5', 'the first five validation images are Figure 17-4’s five (top, bag, T-shirt, shirt, sandal)');
ok(TSNE.count === 5000 && TSNE.x.length === 5000 && TSNE.labels.length === 5000, 't-SNE covers all 5,000 validation images (slide 14 runs it on X_valid)');

// ── diagram parts: every highlighted part exists in the drawing ─────────────
{
  const { FIG_PARTS } = await imp('sheets/figParts.js');
  const { SHEETS } = await imp('sheets/index.js');
  const src = fs.readFileSync(path.join(MOD, 'diagrams.jsx'), 'utf8');
  const missingInSvg = Object.entries(FIG_PARTS).flatMap(([fig, parts]) => parts.filter((p) => !new RegExp(`k="${p}"|'${p}'`).test(src)).map((p) => `${fig}.${p}`));
  ok(missingInSvg.length === 0, 'every listed figure part is marked in diagrams.jsx', missingInSvg.join(', '));
  const used = Object.entries(SHEETS).flatMap(([id, sh]) => sh.blocks.flatMap((b) => [b.fig, ...b.items.filter((it) => it && it.fig)].filter(Boolean).map((f) => [id, f.key ?? f.fig, f.hl ?? []])));
  const bad = used.flatMap(([id, fig, hl]) => (FIG_PARTS[fig] ? hl.filter((p) => !FIG_PARTS[fig].includes(p)).map((p) => `${id}:${fig}.${p}`) : [`${id}:${fig}?`]));
  ok(bad.length === 0, `every notebook diagram highlights only parts its figure has (${used.length} diagrams)`, bad.join(', '));
}

// ── maths as text ───────────────────────────────────────────────────────────
{
  const cases = [
    ['\\mathbf{W}_{N-\\ell+1} = \\mathbf{W}_{\\ell}^{\\top}', 'W_(N−ℓ+1) = W_ℓᵀ'],
    ['\\mathbf{X}_{(1)}', 'X₍₁₎'],
    ["x'_1, x'_2, x'_3", 'x′₁, x′₂, x′₃'],
    ['\\ell = 1, 2, \\cdots, N/2', 'ℓ = 1, 2, …, N/2'],
    ['\\ell^{\\text{th}}', 'ℓth'],
  ];
  const bad = cases.filter(([src, want]) => texText(src) !== want).map(([src]) => `${src} → ${texText(src)}`);
  ok(bad.length === 0, 'texText writes the module’s maths as readable text', bad.join(' | '));
  const all = JSON.stringify(SECTIONS);
  const leaks = [...all.matchAll(/\$([^$]+)\$/g)].map((m) => texText(m[1].replace(/\\\\/g, '\\'))).filter((t) => /\\/.test(t));
  ok(leaks.length === 0, 'no inline maths in sections.js leaks a backslash into its text twin', leaks.slice(0, 3).join(' | '));
}

console.log(`\n${fails.length ? `${fails.length} FAILED` : 'ALL PASS'}`);
process.exit(fails.length ? 1 : 0);
