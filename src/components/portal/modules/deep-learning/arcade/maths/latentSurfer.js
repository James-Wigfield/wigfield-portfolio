/* ============================================================================
   LATENT SURFER — THE MATHS AND THE QUESTION GENERATOR (pure, seeded)
   ----------------------------------------------------------------------------
   Built on lecture6-7-study/gen.js (imported, never edited):
     sampleCoding    slide 14's Sampling: μ + exp(γ/2) · ε
     latentLossGamma slide 12's γ-form latent loss, −½ Σ [1 + γᵢ − exp(γᵢ) − μᵢ²]
     lerp, linspace  slide 18's np.linspace (both ends included)
     makeDecoder,    this page's trained VAE decoder (lecture6-7-study/data/
     decode          vae.js: int8 Dense 10 → 100 → 150 → 784)

   makeModel(VAE)              → { VAE, dec } (the data module + its decoder)
   makeItems(rand, level, m)   → the round's items (ROUNDS in content)
   Item types (item.type):
     find     2 of the 10 coding dimensions steered, the other 8 held at the
              target's μ; kind 'custom', answer [μa, μb] on the slider grid,
              check = pixel MSE to the target's decode ≤ τ
     sample   kind 'number': μ + exp(γ/2)·ε for one dimension
     mid      kind 'choice': the decoded midpoint coding vs the overlay
     slot     kind 'choice': images[k] of np.linspace(…, 10)
     interpT  kind 'choice': t of images[k]
     loss     kind 'number': the γ-form latent loss for n = 1 or 2
     fact     kind 'choice': content FACTS
   `rand` is arcade/core/rng.js's rng(seed). No React, no DOM.
   ========================================================================== */
import { makeDecoder, decode, sampleCoding, latentLossGamma, latentTermGamma, lerp, linspace, mse } from '../../lecture6-7-study/gen.js';
import { FIND, SAMPLING, INTERP, LOSS, FACTS, ROUNDS, UI } from '../content/latent-surfer.js';
import { EQUATIONS } from '../content/lecture67.js';

/* ── small helpers ─────────────────────────────────────────────────────── */
// '%name%' templates (content) → text
export const fill = (tpl, vars = {}) => String(tpl).replace(/%(\w+)%/g, (m, k) => (vars[k] === undefined ? m : String(vars[k])));
const round = (x, d = 3) => Math.round(x * 10 ** d) / 10 ** d;
// a number for plain text: up to d decimals, trailing zeros dropped, unicode minus
export const fmt = (x, d = 3) => {
  const v = round(x, d);
  const s = Object.is(v, -0) ? '0' : String(v);
  return s.replace('-', '−');
};
// the same for KaTeX (ASCII minus)
export const tex = (x, d = 3) => {
  const v = round(x, d);
  return Object.is(v, -0) ? '0' : String(v);
};
const texPar = (x, d = 3) => (x < 0 ? `(${tex(x, d)})` : tex(x, d));
const fmtVar = (v) => String(v);
// 6 → '₆' (slide 12 writes the components as μᵢ)
export const subDigits = (n) => String(n).replace(/\d/g, (d) => '₀₁₂₃₄₅₆₇₈₉'[d]);

/* ── the model ─────────────────────────────────────────────────────────── */
export const makeModel = (VAE) => ({ VAE, dec: makeDecoder(VAE) });

// one coding (10 numbers) → 784 displayed pixel values, clipped to [0, 1]
export function decodePx(model, z) {
  const raw = decode(model.dec, z);
  const out = new Float32Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw[i] < 0 ? 0 : raw[i] > 1 ? 1 : raw[i];
  return out;
}
// interpolating at the pixel level (slide 17: "as if the two images were overlaid")
export function overlayPx(a, b, t) {
  const out = new Float32Array(a.length);
  for (let i = 0; i < a.length; i++) out[i] = a[i] * (1 - t) + b[i] * t;
  return out;
}
export const pixelMse = (a, b) => mse(Array.from(a), Array.from(b));

/* ── slide 14's sampling, slide 12's latent loss ──────────────────────── */
export const sigmaOf = (gamma) => Math.exp(gamma / 2); // exp(γ/2) = σ
export const sampleOne = (mu, gamma, eps) => sampleCoding([mu], [gamma], [eps])[0];
export const latentLoss = (mus, gammas) => latentLossGamma(mus, gammas);
export const latentTerm = (mu, gamma) => latentTermGamma(mu, gamma);

/* ── 1. find: the 2D slice ─────────────────────────────────────────────── */
export const snap = (v) => {
  const [lo, hi] = FIND.range;
  const s = Math.round(Math.min(hi, Math.max(lo, v)) / FIND.step) * FIND.step;
  return round(s, 2);
};
// the coding for slider values (a, b): the target's μ with dims da, db replaced
export function sliceCoding(item, a, b) {
  const z = item.base.slice();
  z[item.dims[0]] = a;
  z[item.dims[1]] = b;
  return z;
}
export function findMse(model, item, given, targetPx = null) {
  const t = targetPx ?? decodePx(model, item.base);
  return pixelMse(decodePx(model, sliceCoding(item, given[0], given[1])), t);
}
// tiles × tiles decodes over the slider range: rows top (b = max) to bottom
export function mapTiles(model, item, tiles) {
  if (!tiles) return [];
  const [lo, hi] = FIND.range;
  const vals = Array.from({ length: tiles }, (_, i) => lo + ((hi - lo) * i) / (tiles - 1));
  const out = [];
  for (let r = 0; r < tiles; r++) {
    for (let c = 0; c < tiles; c++) out.push(decodePx(model, sliceCoding(item, vals[c], vals[tiles - 1 - r])));
  }
  return out;
}
// ℒ of the steered μ with the target's γ (this page's run), for the heat meter
export const findLoss = (item, a, b) => latentLoss(sliceCoding(item, a, b), item.gamma);

function findItem(rand, level, model, i) {
  const { VAE } = model;
  const tau = FIND.tau[level];
  const pool = FIND.targets[level];
  for (let attempt = 0; attempt < 40; attempt++) {
    const idx = rand.pick(pool);
    const tgt = VAE.items[idx];
    const starts = FIND.starts.filter((s) => VAE.items[s].label !== tgt.label);
    const sIdx = rand.pick(starts);
    const st = VAE.items[sIdx];
    const tPx = decodePx(model, tgt.mean);
    // the two dimensions where swapping in the start item's values changes the decode most
    let best = null;
    for (let a = 0; a < tgt.mean.length; a++) {
      for (let b = a + 1; b < tgt.mean.length; b++) {
        const z = tgt.mean.slice();
        z[a] = st.mean[a];
        z[b] = st.mean[b];
        const m = pixelMse(decodePx(model, z), tPx);
        if (!best || m > best.m) best = { a, b, m };
      }
    }
    const start = [snap(st.mean[best.a]), snap(st.mean[best.b])];
    const answer = [snap(tgt.mean[best.a]), snap(tgt.mean[best.b])];
    const item = { base: tgt.mean.slice(), dims: [best.a, best.b] };
    const startMse = findMse(model, item, start, tPx);
    if (startMse < FIND.minStartMse || findMse(model, item, answer, tPx) > tau / 4) continue;
    const cls = VAE.classNames[tgt.label];
    const A = best.a + 1;
    const B = best.b + 1; // slide 12 numbers the components i = 1 … n
    const sa = subDigits(A);
    const sb = subDigits(B);
    const what = FIND.article[cls] ?? cls;
    return {
      id: `find-${i}`,
      type: 'find',
      kind: 'custom',
      concept: FIND.concept,
      src: FIND.src,
      base: item.base,
      dims: item.dims,
      gamma: tgt.logVar.slice(),
      idx,
      cls,
      start,
      answer,
      tau,
      tiles: FIND.tiles[level],
      dimNames: [A, B],
      prompt: fill(FIND.prompt, { what }),
      promptText: fill(FIND.prompt, { what }),
      dimSubs: [sa, sb],
      held: fill(FIND.held, { a: sa, b: sb }),
      why: fill(FIND.why, { tau, idx, cls, a: A, b: B, ta: tex(tgt.mean[best.a], 2), tb: tex(tgt.mean[best.b], 2) }),
      check: (given) => Array.isArray(given) && given.length === 2 && given.every(Number.isFinite) && findMse(model, item, given, tPx) <= tau,
      format: (v) => (Array.isArray(v) ? fill(FIND.answerText, { a: sa, b: sb, va: fmt(v[0], 2), vb: fmt(v[1], 2) }) : '—'),
    };
  }
  return null;
}

/* ── 2. sampling ───────────────────────────────────────────────────────── */
export function samplingValues(mu, variance, eps) {
  const gamma = Math.log(variance);
  const sigma = sigmaOf(gamma);
  return {
    mu, variance, eps, gamma, sigma,
    z: sampleOne(mu, gamma, eps),
    traps: {
      variance: mu + Math.exp(gamma) * eps,
      noMu: sigma * eps,
      halfGamma: mu + (gamma / 2) * eps,
    },
  };
}
const gText = (variance) => (variance === 1 ? '0' : fmt(Math.log(variance), 3));

function sampleItem(rand, level, i) {
  const L = SAMPLING.levels[level];
  for (let attempt = 0; attempt < 60; attempt++) {
    const v = samplingValues(rand.pick(L.mu), rand.pick(L.variance), rand.pick(L.eps));
    const answer = round(v.z, 4);
    // every trap must sit well away from the answer, or the trap teaches nothing
    const traps = Object.entries(v.traps).filter(([k, x]) => !(k === 'noMu' && v.mu === 0) && Math.abs(x - answer) <= 3 * SAMPLING.tol);
    if (traps.length) continue;
    const g = gText(v.variance);
    const vars = { mu: fmt(v.mu), var: fmtVar(v.variance), g, eps: fmt(v.eps) };
    return {
      id: `sample-${i}`,
      type: 'sample',
      kind: 'number',
      concept: SAMPLING.concept,
      src: SAMPLING.src,
      values: { mu: v.mu, variance: v.variance, eps: v.eps, gamma: v.gamma, sigma: v.sigma },
      traps: v.traps,
      answer,
      tol: SAMPLING.tol,
      prompt: fill(SAMPLING.prompt, vars),
      promptText: fill(SAMPLING.prompt, vars),
      why: fill(SAMPLING.why, { mu: tex(v.mu), g: v.variance === 1 ? '0' : tex(v.gamma, 3), eps: tex(v.eps), sig: tex(v.sigma, 3), z: tex(v.z, 3), var: fmtVar(v.variance) }),
      format: (x) => fmt(Number(x), 3),
    };
  }
  return null;
}
// which wrong turn a given answer matches (or null)
export function samplingTrap(item, given) {
  const g = Number(given);
  if (!Number.isFinite(g) || Math.abs(g - item.answer) <= item.tol) return null;
  for (const k of ['variance', 'noMu', 'halfGamma']) {
    if (k === 'noMu' && item.values.mu === 0) continue;
    if (Math.abs(g - item.traps[k]) <= item.tol + 0.005) return k;
  }
  return null;
}

/* ── 3. semantic interpolation ─────────────────────────────────────────── */
function pairCodings(model, pair) {
  const { VAE } = model;
  if (pair.from === 'slide18') {
    return { c0: VAE.samples.slide18[0].slice(), c1: VAE.samples.slide18[1].slice(), text: INTERP.pairText.slide18 };
  }
  const A = VAE.items[pair.a];
  const B = VAE.items[pair.b];
  return {
    c0: A.mean.slice(),
    c1: B.mean.slice(),
    text: fill(INTERP.pairText.items, { a: pair.a, b: pair.b, ca: VAE.classNames[A.label], cb: VAE.classNames[B.label] }),
  };
}
const N = INTERP.n;
const tFrac = (k, n) => `${k}/${n}`;
// the pixels a choice shows
export function choicePx(model, item, c) {
  if (c.how === 'overlay') return overlayPx(decodePx(model, item.c0), decodePx(model, item.c1), c.t);
  return decodePx(model, lerp(item.c0, item.c1, c.t));
}
// the full np.linspace strip (revealed after the pick)
export const stripPx = (model, item) => linspace(item.c0, item.c1, N).map((z) => decodePx(model, z));

function interpItem(rand, level, model, i, type) {
  const letters = ['A', 'B', 'C', 'D'];
  for (let attempt = 0; attempt < 60; attempt++) {
    const pair = rand.pick(INTERP.pairs);
    const { c0, c1, text } = pairCodings(model, pair);
    const base = { c0, c1, pairText: text };
    if (type === 'interpT') {
      const k = rand.pick(INTERP.slots[level] ?? INTERP.slots[2]);
      const opts = [
        { key: 'right', label: `$t = \\tfrac{${k}}{9}$`, text: `t = ${tFrac(k, 9)}` },
        { key: 'tenth', label: `$t = \\tfrac{${k}}{10}$`, text: `t = ${tFrac(k, 10)}` },
        { key: 'next10', label: `$t = \\tfrac{${k + 1}}{10}$`, text: `t = ${tFrac(k + 1, 10)}` },
        { key: 'next9', label: `$t = \\tfrac{${k + 1}}{9}$`, text: `t = ${tFrac(k + 1, 9)}` },
      ];
      const choices = rand.shuffle(opts).map((o, j) => ({ value: letters[j], label: o.label, text: o.text, key: o.key }));
      const answer = choices.find((c) => c.key === 'right').value;
      const prompt = fill(INTERP.promptT, { k });
      return {
        id: `interpT-${i}`, type: 'interpT', kind: 'choice', concept: INTERP.concept, src: INTERP.src,
        ...base, k, slot: k, choices, answer, prompt, promptText: prompt,
        why: fill(INTERP.whyT, { k }),
        format: (v) => choices.find((c) => c.value === v)?.text ?? '—',
      };
    }
    const mid = type === 'mid';
    const k = mid ? null : rand.pick(INTERP.slots[level] ?? INTERP.slots[2]);
    const t = mid ? 0.5 : k / (N - 1);
    const right = { key: 'right', how: 'decode', t, text: fill(INTERP.kinds.decode, { t: mid ? '1/2' : tFrac(k, N - 1) }) };
    const cands = mid
      ? [
        { key: 'overlay', how: 'overlay', t, text: INTERP.kinds.overlay },
        { key: 'near0', how: 'decode', t: 1 / (N - 1), text: fill(INTERP.kinds.near, { t: tFrac(1, N - 1) }) },
        { key: 'near1', how: 'decode', t: (N - 2) / (N - 1), text: fill(INTERP.kinds.near, { t: tFrac(N - 2, N - 1) }) },
      ]
      : [
        { key: 'overlay', how: 'overlay', t, text: INTERP.kinds.overlay },
        { key: 'reversed', how: 'decode', t: 1 - t, text: fill(INTERP.kinds.reversed, { t: tFrac(N - 1 - k, N - 1) }) },
        { key: 'half', how: 'decode', t: 0.5, text: fill(INTERP.kinds.near, { t: '1/2' }) },
      ];
    // keep only choices that look different from the answer and from each other
    const kept = [right];
    const pxOf = (c) => choicePx(model, base, c);
    const pxs = [pxOf(right)];
    for (const c of cands) {
      const p = pxOf(c);
      if (pxs.every((q) => pixelMse(p, q) >= INTERP.minApart)) {
        kept.push(c);
        pxs.push(p);
      }
    }
    // the overlay trap is the point of the question: it must survive
    if (!kept.some((c) => c.key === 'overlay') || kept.length < 3) continue;
    const choices = rand.shuffle(kept).map((c, j) => ({ value: letters[j], how: c.how, t: c.t, text: c.text, key: c.key }));
    const answer = choices.find((c) => c.key === 'right').value;
    const prompt = mid ? INTERP.promptMid : fill(INTERP.promptSlot, { k });
    return {
      id: `${type}-${i}`, type, kind: 'choice', concept: INTERP.concept, src: INTERP.src,
      ...base, k, slot: mid ? null : k, choices, answer, prompt, promptText: prompt,
      why: mid ? INTERP.whyMid : fill(INTERP.whySlot, { k }),
      format: (v) => {
        const c = choices.find((x) => x.value === v);
        return c ? `image ${c.value}: ${c.text}` : '—';
      },
    };
  }
  return null;
}

/* ── 4. latent loss ────────────────────────────────────────────────────── */
export function lossValues(dims) {
  const mus = dims.map((d) => d.mu);
  const gammas = dims.map((d) => Math.log(d.variance));
  const L = latentLoss(mus, gammas);
  const S = mus.reduce((s, m) => s + m * m, 0);
  return { mus, gammas, L, traps: { noHalf: -2 * L, sign: -L, muSign: L - S } };
}
// the substituted bracket for the why card / drawer (KaTeX)
// each dimension's bracket [1 + γᵢ − exp(γᵢ) − μᵢ²] with exp(γᵢ) = σᵢ² written out
export function lossSub(dims, withResult = false) {
  const parts = dims.map((d) => {
    const g = d.variance === 1 ? '0' : texPar(Math.log(d.variance), 3);
    return `\\left[1 + ${g} - ${d.variance} - ${texPar(d.mu)}^2\\right]`;
  });
  const body = `-\\tfrac{1}{2}${parts.length > 1 ? `\\left(${parts.join(' + ')}\\right)` : parts[0]}`;
  return withResult ? `$${body} = ${tex(latentLoss(dims.map((d) => d.mu), dims.map((d) => Math.log(d.variance))), 3)}$` : `$${body}$`;
}

function lossItem(rand, level, i) {
  const L = LOSS.levels[level];
  const tol = LOSS.tol[level];
  for (let attempt = 0; attempt < 60; attempt++) {
    const dims = Array.from({ length: L.n }, () => ({ mu: rand.pick(L.mu), variance: rand.pick(L.variance) }));
    const v = lossValues(dims);
    if (v.L < 0.1) continue; // a zero loss leaves every trap on top of the answer
    const answer = round(v.L, 3);
    const clash = Object.entries(v.traps).some(([k, x]) => !(k === 'muSign' && dims.every((d) => d.mu === 0)) && Math.abs(x - answer) <= 3 * tol);
    if (clash) continue;
    const vars = {};
    dims.forEach((d, j) => {
      vars[`mu${j + 1}`] = fmt(d.mu);
      vars[`var${j + 1}`] = fmtVar(d.variance);
      vars[`g${j + 1}`] = gText(d.variance);
    });
    // log 1 is exactly 0, so no "≈" there
    const prompt = fill(L.n === 1 ? LOSS.prompt1 : LOSS.prompt2, vars).replace(/log 1 ≈ 0/g, 'log 1 = 0');
    const usesGamma = dims.some((d) => d.variance !== 1);
    return {
      id: `loss-${i}`, type: 'loss', kind: 'number',
      concept: usesGamma ? LOSS.conceptGamma : LOSS.concept,
      src: LOSS.src,
      dims, traps: v.traps, answer, tol,
      prompt,
      promptText: prompt,
      why: fill(LOSS.why, { sub: lossSub(dims), L: tex(v.L, 3) }),
      format: (x) => fmt(Number(x), 3),
    };
  }
  return null;
}
export function lossTrap(item, given) {
  const g = Number(given);
  if (!Number.isFinite(g) || Math.abs(g - item.answer) <= item.tol) return null;
  for (const k of ['noHalf', 'sign', 'muSign']) {
    if (k === 'muSign' && item.dims.every((d) => d.mu === 0)) continue;
    if (Math.abs(g - item.traps[k]) <= item.tol + 0.005) return k;
  }
  return null;
}

/* ── 5. facts ──────────────────────────────────────────────────────────── */
function factItem(rand, level, i, used) {
  const pool = FACTS.filter((f) => f.level <= level && !used.has(f.id));
  const fresh = pool.filter((f) => f.level === level);
  const f = rand.pick(fresh.length && rand.chance(0.7) ? fresh : pool.length ? pool : FACTS);
  used.add(f.id);
  const letters = ['A', 'B', 'C', 'D'];
  const choices = rand.shuffle(f.choices.map((c, j) => ({ ...c, right: j === 0 }))).map((c, j) => ({ value: letters[j], label: c.label, text: c.text, aria: c.aria ?? c.text, right: c.right }));
  const answer = choices.find((c) => c.right).value;
  return {
    id: `fact-${i}`, type: 'fact', kind: 'choice', concept: f.concept, src: f.src, factId: f.id,
    tex: f.eq ? EQUATIONS[f.eq]?.tex ?? null : null,
    choices: choices.map((c) => ({ value: c.value, label: c.label, text: c.text, aria: c.aria })),
    answer,
    prompt: f.prompt, promptText: f.prompt, why: f.why,
    format: (v) => choices.find((c) => c.value === v)?.text ?? '—',
  };
}

/* ── the round ─────────────────────────────────────────────────────────── */
export function makeItems(rand, level, model) {
  const L = [1, 2, 3].includes(level) ? level : 1;
  const used = new Set();
  const out = [];
  ROUNDS[L].forEach((type, i) => {
    let it = null;
    if (type === 'find') it = findItem(rand, L, model, i);
    else if (type === 'sample') it = sampleItem(rand, L, i);
    else if (type === 'mid' || type === 'slot' || type === 'interpT') it = interpItem(rand, L, model, i, type);
    else if (type === 'loss') it = lossItem(rand, L, i);
    else it = factItem(rand, L, i, used);
    // a generator that found nothing falls back to a formula question
    out.push(it ?? factItem(rand, L, i, used));
  });
  return out;
}

/* ── the maths drawer lines (KaTeX in $…$) ─────────────────────────────── */
export const EQ = {
  sigma: EQUATIONS.vaeLatentLossSigma.tex[0],
  gamma: EQUATIONS.vaeLatentLossGamma.tex[0],
  gammaDef: EQUATIONS.vaeGammaDef.tex[0],
  sampling: EQUATIONS.vaeSampling.tex,
  code: EQUATIONS.vaeLatentLossCode.tex,
};
export function samplingLine(item, reveal) {
  const v = item.values;
  const g = v.variance === 1 ? '0' : tex(v.gamma, 3);
  const head = `$z = ${tex(v.mu)} + \\exp(${g}/2)\\cdot ${texPar(v.eps)}`;
  return reveal ? `${head} = ${tex(v.mu)} + ${tex(v.sigma, 3)}\\cdot ${texPar(v.eps)} = ${tex(v.z, 3)}$` : `${head}$`;
}
export function findLines(item, a, b, mseNow) {
  const [A, B] = item.dimNames;
  return [
    `Your μ: $\\mu_{${A}} = ${tex(a, 2)}$, $\\mu_{${B}} = ${tex(b, 2)}$; the other 8 at the target’s μ (${UI.own}).`,
    `MSE to the target’s decode $= ${mseNow.toFixed(4)}$ (right at $\\le ${item.tau}$).`,
    `$\\mathscr{L}$ of this μ with the target’s γ (${UI.own}) $= ${findLoss(item, a, b).toFixed(2)}$, summed over all $n = 10$ dimensions.`,
  ];
}
