/* ============================================================================
   DL LECTURES 6–7 STUDY — assertions for gen.js, the slide facts and the data
   ----------------------------------------------------------------------------
     node tools/dl-lecture6-7-study/check-gen.mjs

   Checks
     counts     conv_decoder = 13,873 and conv_ae = 54,479 (slide 6), as
                gen.js computes them and as slideData.js quotes them; the
                decoder's rows match slide 6's summary() column by column
     shapes     every shape comment in slide 5's listing equals the output
                shape gen.js works out for that layer
     keras      every model's per-layer output shapes and parameter counts
                equal Keras's own (keras-counts.json, written by pipeline.py)
     upsample   the transposed-convolution stamper gives 3 → 7 ("valid") and
                7 → 14 ("same"), as the size rule and Keras do
     latent     the σ and γ forms of slide 12's latent loss agree; each term
                is 0 at μ = 0, σ = 1 and positive everywhere else on a grid;
                the Sampling line equals μ + σ·ε
     interp     np.linspace-style interpolation: 10 codings, both endpoints
                included, evenly spaced
     toygan     phase 1 changes only the discriminator's weights, phase 2 only
                the generator's; the presets do what the page says they do
     figures    the figParts.js keys equal the <P k> marks in diagrams.jsx
     code       every NAMED_CODE listing appears verbatim in the transcript
     coverage   sections cover slides 1–32 exactly once, in order
     text       texText renders both latent-loss formulas as readable text
     data       the exported runs: parameter gates, shapes, and the JS
                decoder reproducing Keras's decoder within its quantisation
   ========================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const MOD = path.join(REPO, 'src/components/portal/modules/deep-learning/lecture6-7-study');
const imp = (f) => import(pathToFileURL(path.join(MOD, f)).href);

const g = await imp('gen.js');
const { PARAMS, SUMMARY_ROWS, MODELS, NAMED_CODE } = await imp('slideData.js');
const { SECTIONS } = await imp('sections.js');
const { texText } = await imp('texText.js');
const { FIG_PARTS } = await imp('sheets/figParts.js');

const fails = [];
const ok = (cond, label, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${extra !== '' ? `  — ${extra}` : ''}`);
  if (!cond) fails.push(label);
};
const near = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol;

// ── counts ──────────────────────────────────────────────────────────────────
const enc = g.flow(MODELS.conv_encoder);
const dec = g.flow(MODELS.conv_decoder);
ok(dec.total === 13873 && PARAMS.convDecoder.value === 13873, 'conv_decoder has 13,873 parameters (slide 6)', dec.rows.map((r) => r.params).join(' + '));
ok(enc.total + dec.total === 54479 && PARAMS.convAe.value === 54479, 'conv_ae has 54,479 parameters (slide 6)', `${enc.total} + ${dec.total}`);
ok(enc.rows.map((r) => r.params).join() === '0,160,0,4640,0,18496,0,17310,0' && enc.total === 40606, 'conv_encoder: 160 + 4,640 + 18,496 + 17,310 = 40,606 (this page’s working)');
ok(JSON.stringify(dec.rows.map((r) => r.params)) === JSON.stringify(SUMMARY_ROWS.map((r) => r.params)), 'conv_decoder per layer = slide 6’s Param # column (4464, 0, 4640, 4624, 145, 0)');
ok(JSON.stringify(dec.rows.map((r) => `(None, ${r.out.join(', ')})`)) === JSON.stringify(SUMMARY_ROWS.map((r) => r.shape)), 'conv_decoder output shapes = slide 6’s Output Shape column');

// ── slide 5's shape comments ───────────────────────────────────────────────
const commented = [...enc.rows, ...dec.rows].filter((r) => r.comment);
const badShapes = commented.filter((r) => !(r.comment === g.shapeText(r.out) || r.comment === `${r.out[0]} neurons`));
ok(commented.length === 10 && badShapes.length === 0, 'every shape comment in slide 5 matches the computed output shape', commented.map((r) => `${r.comment}`).join(' · '));
ok(NAMED_CODE.CONV_AE.split('\n').filter((l) => /# (output|144)/.test(l)).length === 10, 'slide 5’s listing has 10 shape comments, all checked');

// ── Keras's own counts ─────────────────────────────────────────────────────
const kerasFile = path.join(HERE, 'keras-counts.json');
if (fs.existsSync(kerasFile)) {
  const K = JSON.parse(fs.readFileSync(kerasFile, 'utf8')).models;
  const pairs = {
    conv_encoder: 'conv_encoder', conv_decoder: 'conv_decoder', dropout_encoder: 'dropout_encoder', dropout_decoder: 'dropout_decoder',
    variational_encoder: 'variational_encoder', variational_decoder: 'variational_decoder', generator: 'generator', discriminator: 'discriminator',
    dcgan_generator: 'dcgan_generator', dcgan_discriminator: 'dcgan_discriminator',
  };
  Object.entries(pairs).forEach(([mine, theirs]) => {
    const f = g.flow(MODELS[mine]);
    const kl = (K[theirs]?.layers ?? []).filter((l) => l.class !== 'InputLayer');
    const shapesOk = kl.length === f.rows.length && kl.every((l, i) => JSON.stringify(l.outputShape.slice(1)) === JSON.stringify(f.rows[i].out));
    const paramsOk = kl.every((l, i) => l.params === f.rows[i].params);
    ok(shapesOk && paramsOk, `${mine}: every layer's output shape and parameters equal Keras's`, `${f.total} total`);
  });
} else {
  ok(false, 'keras-counts.json exists (run pipeline.py --counts)');
}

// ── transposed convolution ─────────────────────────────────────────────────
const ones = [[1, 1, 1], [1, 1, 1], [1, 1, 1]];
const in3 = Array.from({ length: 3 }, () => [1, 1, 1]);
const in7 = Array.from({ length: 7 }, () => new Array(7).fill(1));
const t1 = g.convTranspose2d(in3, ones, 2, 'valid');
const t2 = g.convTranspose2d(in7, ones, 2, 'same');
ok(t1.outN === 7 && g.convTransposeOut(3, 3, 2, 'valid') === 7 && t1.out.length === 7, 'Conv2DTranspose(…, 3, strides=2): 3 → 7 with "valid" padding');
ok(t2.outN === 14 && g.convTransposeOut(7, 3, 2, 'same') === 14 && t2.full === 15, 'Conv2DTranspose(…, 3, strides=2, padding="same"): 7 → 14 (the full grid is 15)');
ok(g.convTransposeOut(14, 3, 2, 'same') === 28 && g.convTransposeOut(7, 5, 2, 'same') === 14, 'the last decoder layer gives 28, and the DCGAN’s 5 × 5 layers 7 → 14 → 28');
const hits = t1.hits.flat();
ok(Math.min(...hits) === 1 && Math.max(...hits) === 4 && t1.out[2][2] === 4, 'stamps overlap: 1 to 4 per output pixel when the stride (2) is smaller than the kernel (3)');

// ── latent loss ────────────────────────────────────────────────────────────
let worst = 0;
for (let k = 0; k < 400; k++) {
  const mu = -3 + (k % 20) * 0.31;
  const s = 0.05 + Math.floor(k / 20) * 0.15;
  worst = Math.max(worst, Math.abs(g.latentTermSigma(mu, s) - g.latentTermGamma(mu, g.gammaOfSigma(s))));
}
ok(worst < 1e-12, 'slide 12’s σ form and γ form give the same term', `largest difference ${worst.toExponential(1)}`);
ok(near(g.latentTermSigma(0, 1), 0) && near(g.latentTermGamma(0, 0), 0), 'each term is exactly 0 at μ = 0, σ = 1 (γ = 0)');
let minVal = Infinity;
let minAt = null;
for (let a = -300; a <= 300; a += 5) {
  for (let b = 5; b <= 300; b += 5) {
    const v = g.latentTermSigma(a / 100, b / 100);
    if (v < minVal) { minVal = v; minAt = [a / 100, b / 100]; }
  }
}
ok(near(minVal, 0) && minAt[0] === 0 && minAt[1] === 1, 'on a grid of μ ∈ [−3, 3], σ ∈ (0, 3] the term is smallest at μ = 0, σ = 1', `min ${minVal} at (${minAt})`);
const lossSum = g.latentLossGamma([0.5, -1, 0], [0, -0.7, 0.3]);
ok(near(lossSum, g.latentTermGamma(0.5, 0) + g.latentTermGamma(-1, -0.7) + g.latentTermGamma(0, 0.3)), 'the latent loss sums the terms over the coding dimensions (axis=-1)');
const z = g.sampleCoding([0.2, -1], [Math.log(0.25), 0], [1.5, -2]);
ok(near(z[0], 0.2 + 0.5 * 1.5) && near(z[1], -1 - 2), 'Sampling: normal × exp(logvar / 2) + mean = μ + σ·ε');

// ── interpolation ──────────────────────────────────────────────────────────
const A = [1, -2, 0.5];
const B = [-3, 4, 0.5];
const L = g.linspace(A, B, 10);
ok(L.length === 10 && JSON.stringify(L[0]) === JSON.stringify(A) && L[9].every((v, i) => near(v, B[i])), 'linspace(a, b, 10): 10 codings, the first is a and the last is b');
ok(L.slice(1).every((p, k) => p.every((v, i) => near(v - L[k][i], (B[i] - A[i]) / 9))), 'linspace steps are even: (b − a) / 9');

// ── toy GAN ────────────────────────────────────────────────────────────────
const gan = new g.ToyGan(g.GAN_PRESETS.one);
const s0 = gan.snapshot();
gan.phase1();
const s1 = gan.snapshot();
ok(g.maxChange(s0.G, s1.G) === 0 && g.maxChange(s0.D, s1.D) > 0, 'phase 1 updates the discriminator only (generator unchanged, exactly)');
gan.phase2();
const s2 = gan.snapshot();
ok(g.maxChange(s1.D, s2.D) === 0 && g.maxChange(s1.G, s2.G) > 0, 'phase 2 updates the generator only (discriminator frozen, exactly)');
const p1 = new g.ToyGan(g.GAN_PRESETS.one).phase1();
ok(p1.labels.length === 64 && p1.labels.slice(0, 32).every((v) => v === 0) && p1.labels.slice(32).every((v) => v === 1), 'phase 1’s batch: 32 fake labelled 0, then 32 real labelled 1 (as y1)');
const p2 = new g.ToyGan(g.GAN_PRESETS.one).phase2();
ok(p2.labels.length === 32 && p2.labels.every((v) => v === 1), 'phase 2’s batch: 32 fake, all labelled 1 (as y2)');

const runPreset = (key) => {
  const cfg = g.GAN_PRESETS[key];
  const m = new g.ToyGan(cfg);
  const covers = [];
  while (m.step < cfg.iters) {
    m.iterate();
    if (m.step % 25 === 0) covers.push({ step: m.step, c: g.modeCover(m.target, m.samples(300)) });
  }
  return { m, covers, xs: m.samples(300) };
};
const one = runPreset('one');
const mean = one.xs.reduce((a, v) => a + v, 0) / one.xs.length;
ok(Math.abs(mean - 1.5) < 0.2, 'the one-bump toy GAN learns the bump (generated mean near 1.5 after 1,500 iterations)', mean.toFixed(3));
const bal = runPreset('balanced');
const lastBal = bal.covers[bal.covers.length - 1].c;
ok(lastBal.every((v) => v > 0.3), 'the balanced two-bump run ends with both bumps covered', lastBal.map((v) => v.toFixed(2)).join(' / '));
const weak = runPreset('weak');
let best = 0;
let cur = 0;
let side = null;
weak.covers.forEach(({ c }) => {
  const s = c[0] >= 0.9 && c[1] <= 0.05 ? 'L' : c[1] >= 0.9 && c[0] <= 0.05 ? 'R' : null;
  cur = s && s === side ? cur + 1 : s ? 1 : 0;
  side = s;
  best = Math.max(best, cur);
});
ok(best * 25 >= 500, 'the weaker generator (seed 4) collapses onto one bump for at least 500 iterations', `${best * 25} iterations`);

// ── figures ────────────────────────────────────────────────────────────────
const diagSrc = fs.readFileSync(path.join(MOD, 'diagrams.jsx'), 'utf8');
const figOk = Object.entries(FIG_PARTS).every(([, keys]) => keys.every((k) => diagSrc.includes(`k="${k}"`) || diagSrc.includes(`'${k}'`)));
ok(figOk, 'every figParts.js key is a <P k> mark in diagrams.jsx');
const sheetDir = path.join(MOD, 'sheets');
const usedHl = fs.readdirSync(sheetDir).filter((f) => /^s\d+\.js$/.test(f)).flatMap((f) => {
  const src = fs.readFileSync(path.join(sheetDir, f), 'utf8');
  return [...src.matchAll(/key: '(\w+)', hl: \[([^\]]*)\]/g)].map((m) => [m[1], m[2].split(',').map((x) => x.trim().replace(/'/g, '')).filter(Boolean)]);
});
ok(usedHl.every(([fig, hl]) => FIG_PARTS[fig] && hl.every((h) => FIG_PARTS[fig].includes(h))), 'every notebook diagram highlights only parts its figure has', usedHl.map(([f, h]) => `${f}:${h.join('+')}`).join(' '));

// ── code verbatim ──────────────────────────────────────────────────────────
const transcript = fs.readFileSync(path.join(REPO, 'Documents/cits5017/markdown-lecs/lecture-6-7.md'), 'utf8').replace(/\r\n/g, '\n');
const missing = Object.entries(NAMED_CODE).filter(([, src]) => !transcript.includes(src)).map(([k]) => k);
ok(missing.length === 0, `every one of the ${Object.keys(NAMED_CODE).length} code listings appears verbatim in the transcript`, missing.join(', '));

// ── coverage ───────────────────────────────────────────────────────────────
const seen = [];
SECTIONS.forEach((s) => String(s.slides).split(',').forEach((part) => {
  const [a, b] = part.trim().split(/[–-]/).map(Number);
  for (let n = a; n <= (b || a); n++) seen.push(n);
}));
ok(JSON.stringify(seen) === JSON.stringify(Array.from({ length: 32 }, (_, i) => i + 1)), 'slides 1–32 each covered exactly once, in order', `${SECTIONS.length} sections`);

// ── text ───────────────────────────────────────────────────────────────────
const eqs = SECTIONS.flatMap((s) => s.read.filter((b) => b.eq).map((b) => texText(b.eq.tex)));
ok(eqs.includes('ℒ = −1/2 Σᵢ₌₁ⁿ [1 + log(σᵢ²) − σᵢ² − μᵢ²]') && eqs.includes('ℒ = −1/2 Σᵢ₌₁ⁿ [1 + γᵢ − exp(γᵢ) − μᵢ²]'), 'both latent-loss formulas print as readable text', eqs.join(' | '));

// ── data ───────────────────────────────────────────────────────────────────
const dataDir = path.join(MOD, 'data');
if (!fs.existsSync(path.join(dataDir, 'vae.js'))) {
  ok(false, 'the exported runs exist (data/*.js)');
} else {
  const { CONV } = await imp('data/conv.js');
  const { DENOISE } = await imp('data/denoise.js');
  const { VAE } = await imp('data/vae.js');
  const { GAN } = await imp('data/gan.js');
  const { DCGAN } = await imp('data/dcgan.js');
  ok(CONV.params.conv_decoder === 13873 && CONV.params.conv_ae === 54479 && CONV.params.conv_encoder === 40606, 'conv.js: the run passed the slide-6 gates (13,873 / 54,479) and the encoder has 40,606');
  ok(DENOISE.params.dropout_ae === 163814, 'denoise.js: dropout_ae has 163,814 parameters', String(DENOISE.params.dropout_ae));
  const vEnc = g.flow(MODELS.variational_encoder).total;
  const vDec = g.flow(MODELS.variational_decoder).total;
  ok(VAE.codingsSize === 10 && VAE.params.variational_encoder === vEnc && VAE.params.variational_decoder === vDec, 'vae.js: 10 codings; encoder and decoder counts equal this page’s working', `${vEnc} / ${vDec}`);
  ok(GAN.params.generator === g.flow(MODELS.generator).total && GAN.params.discriminator === g.flow(MODELS.discriminator).total, 'gan.js: generator and discriminator counts equal this page’s working');
  ok(DCGAN.params.generator === g.flow(MODELS.dcgan_generator).total && DCGAN.params.discriminator === g.flow(MODELS.dcgan_discriminator).total, 'dcgan.js: generator and discriminator counts equal this page’s working');
  const images = [CONV, DENOISE].flatMap((d) => d.items).flatMap((it) => [it.original, it.recon, it.noisy].filter(Boolean));
  ok(images.every((b) => Buffer.from(b, 'base64').length === 784), 'every exported image is 784 bytes', `${images.length} images`);
  const D = g.makeDecoder(VAE);
  const errs = VAE.check.codings.map((zc, k) => {
    const mine = g.toBytes(g.decode(D, zc));
    const theirs = Buffer.from(VAE.check.kerasOut[k], 'base64');
    let m = 0;
    for (let i = 0; i < 784; i++) m = Math.max(m, Math.abs(mine[i] - theirs[i]) / 255);
    return m;
  });
  ok(Math.max(...errs) <= VAE.check.quantMaxAbsErr + 2 / 255, 'the JS decoder (int8 weights) reproduces Keras’s decoder within its quantisation error', `${errs.map((e) => e.toFixed(3)).join(', ')} (allowed ${VAE.check.quantMaxAbsErr})`);
  const sizes = fs.readdirSync(dataDir).map((f) => fs.statSync(path.join(dataDir, f)).size);
  console.log(`      data: ${(sizes.reduce((a, b) => a + b, 0) / 1024).toFixed(0)} KB in ${sizes.length} files`);
}

console.log(`\n${fails.length ? `${fails.length} FAILED` : 'ALL PASS'}`);
process.exit(fails.length ? 1 : 0);
