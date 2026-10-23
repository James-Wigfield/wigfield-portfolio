/* ============================================================================
   BOTTLENECK — GENERATOR AND MATHS (pure, seeded; no React, no DOM)
   ----------------------------------------------------------------------------
   makeItems(rand, level) → the round's items (content/bottleneck.js LEVELS):
     plane   stage 1 (slides 8–9): this page's own 60-point 3D cloud
             (lecture5-study/ae.js make3D) turned by a seeded rotation; the
             player sets the plane's two tilts; graded by the angle
             between their plane and the PCA plane (ae.js pca, planeAngle)
             with a stated tolerance
     build   stage 2 (slides 10–12): the biggest symmetric sandwich within a
             parameter budget (ae.js stackParams); any sandwich on offer with
             the best total ≤ budget passes
     tie     stage 2 (slides 18–21): parameters left / saved once the decoder
             kernels are tied (ae.js tiedParams); the slide anchor 163,814 →
             82,414 for 784–100–30–100–784
     index   stage 2 (slide 19): W_{N−ℓ+1} = W_ℓᵀ, the coding layer N/2,
             what is learned
     order   stage 3 (slides 16–17, 23–25): tap-to-order cards; answer =
             the card ids in order (decoys left out)
     drop    stage 4 (slides 14–15): a Fashion MNIST validation image onto
             the page's own t-SNE map; graded by class
   Every item: { id, stage, tag, concept, src, kind, prompt, sub, promptText,
   answer, check?, format?, why, wrong } — `wrong` is a JSON value that
   grades false (for the headless bot).
   ========================================================================== */
import { make3D, pca, mse, planeAngle, dot, cross, stackParams, tiedParams } from '../../lecture5-study/ae.js';
import { LEVELS, STAGES, PLANE, SANDWICH, BUILD, TIE, INDEX, ORDERS, MAP } from '../content/bottleneck.js';

export const fmtInt = (n) => Math.round(n).toLocaleString('en-AU');
export const fmtSig = (v, d = 3) => (Number.isFinite(v) ? Number(v).toPrecision(d) : '—');
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
// fill {name} placeholders that `vars` defines; anything else (KaTeX braces) stays as written
export const fill = (tpl, vars = {}) => String(tpl).replace(/\{(\w+)\}/g, (m, k) => (Object.prototype.hasOwnProperty.call(vars, k) ? String(vars[k]) : m));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/* ── stage 1 · the plane ─────────────────────────────────────────────── */
const D2R = Math.PI / 180;
const unit = (a) => {
  const n = Math.sqrt(dot(a, a)) || 1;
  return a.map((v) => v / n);
};

// The sliders are the plane's two tilts: through the mean μ it is
//   x3 − μ3 = tan(a)·(x1 − μ1) + tan(b)·(x2 − μ2)
// so its unit normal is ∝ (−tan a, −tan b, 1). One smooth chart for every
// non-vertical plane: no pole and no wrap-around, so the MSE has a single
// valley inside the sliders' range (checked per item by greedyPlane).
export function normalFrom([a, b]) {
  return unit([-Math.tan(Number(a) * D2R), -Math.tan(Number(b) * D2R), 1]);
}

// slider angles (degrees) for a normal; ±n are the same plane, so x3 > 0
export function anglesFrom(n) {
  const v = n[2] < 0 ? n.map((x) => -x) : n.slice();
  const z = Math.max(1e-9, v[2]);
  return [Math.atan(-v[0] / z) / D2R, Math.atan(-v[1] / z) / D2R];
}

// an orthonormal frame for drawing the plane: n, the in-plane direction u
// above the x1 axis, and v = n × u
export function planeFrame(angles) {
  const n = normalFrom(angles);
  const u = unit([1, 0, Math.tan(Number(angles[0]) * D2R)]);
  return { n, u, v: cross(n, u) };
}

// the reconstructions x′ = x − ((x − μ)·n) n (each point projected onto the
// plane through the mean μ), the signed distance of each point, and the MSE
export function planeFit(X, mean, angles) {
  const n = normalFrom(angles);
  const dist = X.map((x) => dot(x.map((v, j) => v - mean[j]), n));
  const recon = X.map((x, i) => x.map((v, j) => v - dist[i] * n[j]));
  return { n, dist, recon, mse: mse(X, recon) };
}

export const planeError = (given, normal) => planeAngle(normalFrom(given), normal);

export function gradePlane(given, normal, tol) {
  if (!Array.isArray(given) || given.length !== 2 || !given.every((v) => Number.isFinite(Number(v)))) return false;
  return planeError(given, normal) <= tol + 1e-9;
}

// the meter: 0 at the PCA plane, 1 at the worst plane; the square root keeps
// it close to linear in the angle near the target
export const meterFrac = (m, floor, top) => Math.min(1, Math.sqrt(Math.max(0, m - floor) / Math.max(1e-12, top - floor)));

// A player who only follows the MSE readout: 1° slider steps, always the
// step that lowers the MSE most, until none does. Returns where they stop.
export function greedyPlane(X, mean, start, range = PLANE.range) {
  let a = start.slice();
  let m = planeFit(X, mean, a).mse;
  for (let k = 0; k < 600; k++) {
    let best = null;
    for (const [da, db] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const b = [clamp(a[0] + da, range[0], range[1]), clamp(a[1] + db, range[0], range[1])];
      const mb = planeFit(X, mean, b).mse;
      if (mb < m - 1e-12 && (!best || mb < best.m)) best = { m: mb, b };
    }
    if (!best) break;
    a = best.b;
    m = best.m;
  }
  return a;
}

function rotation(a, b, c) {
  const [ca, sa, cb, sb, cc, sc] = [Math.cos(a), Math.sin(a), Math.cos(b), Math.sin(b), Math.cos(c), Math.sin(c)];
  // Rz(a) · Ry(b) · Rx(c)
  return [
    [ca * cb, ca * sb * sc - sa * cc, ca * sb * cc + sa * sc],
    [sa * cb, sa * sb * sc + ca * cc, sa * sb * cc - ca * sc],
    [-sb, cb * sc, cb * cc],
  ];
}
const r3 = (v) => Math.round(v * 1000) / 1000;

// this page's own cloud (ae.js make3D), turned by a seeded rotation so every
// item has a different best plane; the PCA plane's normal is the third
// principal component, and both of its tilts stay within PLANE.target
export function makeCloud(rand) {
  for (let tries = 0; tries < 200; tries++) {
    const X0 = make3D(rand.int(1, 999999));
    const m0 = [0, 1, 2].map((j) => X0.reduce((s, p) => s + p[j], 0) / X0.length);
    const R = rotation(rand.next() * 2 * Math.PI, (rand.next() - 0.5) * 0.8 * Math.PI, (rand.next() - 0.5) * 0.8 * Math.PI);
    const X = X0.map((p) => {
      const d = p.map((v, j) => v - m0[j]);
      return R.map((row, j) => r3(dot(row, d) + m0[j]));
    });
    const P = pca(X);
    const normal = P.comps[2][2] < 0 ? P.comps[2].map((v) => -v) : P.comps[2];
    const ang = anglesFrom(normal);
    if (ang.some((v) => Math.abs(v) > PLANE.target)) continue;
    return { X, mean: P.mean, normal, answer: ang.map((v) => Math.round(v)), floor: P.mse, top: P.vars[0] / 3, vars: P.vars };
  }
  throw new Error('makeCloud: no cloud with a usable plane');
}

// a start 35–75° from the target from which following the MSE does reach it
function startAngles(rand, c) {
  const lim = PLANE.target + 5;
  for (let tries = 0; tries < 300; tries++) {
    const a = [rand.int(-lim, lim), rand.int(-lim, lim)];
    const e = planeError(a, c.normal);
    if (e < 35 || e > 75) continue;
    if (planeError(greedyPlane(c.X, c.mean, a), c.normal) <= 2) return a;
  }
  throw new Error('startAngles: no start that leads to the plane');
}

// a plane exactly `deg` degrees from the target (the target's normal turned
// about a horizontal axis), in slider angles: the headless bot's wrong answer
export function planeOff(normal, deg) {
  const axis = unit(cross(normal, [0, 0, 1]).every((v) => Math.abs(v) < 1e-9) ? [1, 0, 0] : cross(normal, [0, 0, 1]));
  const t = deg * D2R;
  // Rodrigues: n cos t + (k × n) sin t (k ⟂ n)
  const kn = cross(axis, normal);
  const turned = normal.map((v, j) => v * Math.cos(t) + kn[j] * Math.sin(t));
  return anglesFrom(turned);
}

// 3D → screen: turn about x3 by `yaw`, tip towards the viewer by `pitch`
// (orthographic); returns [x, y, nearness] with y pointing down
export function project(p, yaw = -38, pitch = 24) {
  const a = yaw * D2R;
  const b = pitch * D2R;
  const x = p[0] * Math.cos(a) - p[1] * Math.sin(a);
  const y = p[0] * Math.sin(a) + p[1] * Math.cos(a);
  const z = p[2];
  return [x, -(z * Math.cos(b) - y * Math.sin(b)), y * Math.cos(b) + z * Math.sin(b)];
}

const fmtDeg = (v) => `${Math.round(v)}°`.replace('-', '−');

function planeItem(rand, level, i) {
  const c = makeCloud(rand);
  const tol = PLANE.tol[level - 1];
  const start = startAngles(rand, c);
  const answer = c.answer;
  const wrong = planeOff(c.normal, 30).map((v) => Math.round(v * 1000) / 1000);
  const fmtA = (v) => (Array.isArray(v) && v.length === 2
    ? `${PLANE.controls.a} ${fmtDeg(v[0])} · ${PLANE.controls.b} ${fmtDeg(v[1])} (${Math.round(planeError(v, c.normal))}° ${PLANE.meter.off})`
    : '—');
  return {
    id: `bn${level}-${i}-plane`,
    stage: 'plane',
    tag: STAGES.plane.tag,
    concept: PLANE.concept,
    src: PLANE.src,
    kind: 'custom',
    prompt: PLANE.prompt,
    sub: PLANE.sub,
    promptText: PLANE.promptText,
    cloud: { X: c.X, mean: c.mean, floor: c.floor, top: c.top },
    normal: c.normal,
    range: PLANE.range,
    start,
    tol,
    showFloor: PLANE.showFloor[level - 1],
    answer,
    wrong,
    check: (g) => gradePlane(g, c.normal, tol),
    format: fmtA,
    why: fill(PLANE.why, { tol }),
  };
}


/* ── stage 2 · the sandwich ──────────────────────────────────────────── */
// the encoder's widths [h1, …, codings] → the full symmetric stack
export const sandwich = (enc) => [SANDWICH.inputUnits, ...enc, ...enc.slice(0, -1).reverse(), SANDWICH.inputUnits];
export const fmtSizes = (sizes) => sizes.join('–');

export function buildCombos(N) {
  const lists = BUILD.lists[N];
  let out = [[]];
  lists.forEach((l) => {
    out = out.flatMap((pre) => l.options.map((o) => [...pre, o]));
  });
  return out.map((enc) => {
    const sizes = sandwich(enc);
    return { enc, sizes, total: stackParams(sizes).total };
  }).sort((a, b) => a.total - b.total);
}

// is `sizes` one of the sandwiches on offer for N layers?
export function isOffered(sizes, N) {
  const lists = BUILD.lists[N];
  if (!Array.isArray(sizes) || sizes.length !== N + 1) return false;
  if (sizes[0] !== SANDWICH.inputUnits || sizes[N] !== SANDWICH.inputUnits) return false;
  for (let i = 0; i <= N; i++) if (sizes[i] !== sizes[N - i]) return false;
  return lists.every((l, k) => l.options.includes(sizes[k + 1]));
}

export function niceBudget(total, next) {
  for (const s of BUILD.budgetSteps) {
    const b = Math.ceil(total / s) * s;
    if (b < next) return b;
  }
  return total;
}

export const layerTerms = (sizes) => stackParams(sizes).layers.map((l) => `(${l.inputs} × ${l.units} + ${l.units})`).join(' + ');

export function gradeBuild(given, N, budget, best) {
  if (!isOffered(given, N)) return false;
  const t = stackParams(given).total;
  return t <= budget && t === best;
}

function buildItem(rand, level, i, N) {
  const all = buildCombos(N);
  // never the biggest (the budget must bind) and rarely the smallest
  const lo = Math.max(1, Math.floor(all.length * 0.15));
  const idx = rand.int(lo, all.length - 2);
  const target = all[idx];
  const next = all.find((c) => c.total > target.total);
  const budget = niceBudget(target.total, next.total);
  const best = target.total;
  const fits = all.filter((c) => c.total <= budget);
  const top = fits[fits.length - 1];
  return {
    id: `bn${level}-${i}-build`,
    stage: 'build',
    tag: STAGES.build.tag,
    concept: BUILD.concept,
    src: BUILD.src,
    kind: 'custom',
    N,
    lists: BUILD.lists[N],
    budget,
    best,
    prompt: fill(BUILD.prompt, { budget: fmtInt(budget) }),
    sub: BUILD.sub,
    promptText: fill(BUILD.promptText, { budget: fmtInt(budget) }),
    answer: top.sizes,
    wrong: all[all.length - 1].sizes,
    check: (g) => gradeBuild(g, N, budget, best),
    format: (v) => (Array.isArray(v) ? `${fmtSizes(v)} · ${fmtInt(stackParams(v).total)} params` : '—'),
    why: fill(BUILD.why, {
      sizes: fmtSizes(top.sizes),
      terms: layerTerms(top.sizes),
      total: fmtInt(top.total),
      budget: fmtInt(budget),
      nextSizes: fmtSizes(next.sizes),
      nextTotal: fmtInt(next.total),
    }) + (same(top.sizes, TIE.anchor.sizes) ? '' : BUILD.whySlide),
  };
}

/* ── stage 2 · tie the weights ───────────────────────────────────────── */
// untied, tied, saved and their parts for a symmetric stack
export function tieCounts(sizes) {
  const untied = stackParams(sizes);
  const tied = tiedParams(sizes);
  const half = tied.N / 2;
  const encKernels = tied.layers.filter((l) => l.l <= half).reduce((s, l) => s + l.weights, 0);
  const biases = tied.layers.reduce((s, l) => s + l.biases, 0);
  const savedTerms = tied.layers.filter((l) => l.l > half).map((l) => `${l.inputs} × ${l.units}`).join(' + ');
  return { untied: untied.total, tied: tied.total, saved: untied.total - tied.total, encKernels, biases, savedTerms, N: tied.N, layers: tied.layers };
}

function tieChoiceItem(rand, level, i) {
  const C = TIE.choice;
  return {
    id: `bn${level}-${i}-tie`,
    stage: 'tie',
    tag: STAGES.tie.tag,
    concept: TIE.concept,
    src: { lecture: 5, slides: [12, 19, 20, 21] },
    kind: 'choice',
    sizes: TIE.anchor.sizes,
    prompt: C.prompt,
    promptText: C.promptText,
    choices: rand.shuffle(C.choices),
    answer: TIE.anchor.tied,
    wrong: TIE.anchor.untied,
    why: C.why,
  };
}

function tieKeypadItem(rand, level, i, sizes) {
  const t = tieCounts(sizes);
  const mode = rand.chance(0.5) ? 'remaining' : 'saved';
  const K = TIE.keypad[mode];
  const answer = mode === 'remaining' ? t.tied : t.saved;
  return {
    id: `bn${level}-${i}-tie`,
    stage: 'tie',
    tag: STAGES.tie.tag,
    concept: TIE.concept,
    src: TIE.src,
    kind: 'number',
    mode,
    sizes,
    untied: t.untied,
    prompt: K.prompt,
    sub: fill(TIE.keypad.sub, { untied: fmtInt(t.untied), sizes: fmtSizes(sizes) }),
    promptText: fill(K.promptText, { sizes: fmtSizes(sizes) }),
    unit: TIE.keypad.unit,
    answer,
    wrong: answer + 1,
    why: fill(K.why, { kernels: fmtInt(t.encKernels), biases: fmtInt(t.biases), tied: fmtInt(t.tied), terms: t.savedTerms, saved: fmtInt(t.saved) }),
  };
}

/* ── stage 2 · which W? (slide 19) ───────────────────────────────────── */
export const tiedSource = (N, L) => N - L + 1; // layer L > N/2 uses W_{N−L+1}ᵀ
const wTex = (k, t) => `$\\mathbf{W}_{${k}}${t ? '^{\\top}' : ''}$`;
const SUB = '₀₁₂₃₄₅₆₇₈₉';
// plain text for the feedback line and the why card: W₂ᵀ
export const wPlain = (k, t) => `W${String(k).split('').map((d) => SUB[Number(d)]).join('')}${t ? 'ᵀ' : ''}`;
const wFromValue = (v) => (typeof v === 'string' && /^[TW]\d$/.test(v) ? wPlain(Number(v.slice(1)), v[0] === 'T') : '—');

function indexItem(rand, level, i, N) {
  const kinds = N === 4 ? ['pair', 'coding', 'learn'] : ['pair', 'coding'];
  const kind = rand.pick(kinds);
  const base = { id: `bn${level}-${i}-index`, stage: 'index', tag: STAGES.index.tag, concept: INDEX.concept, src: INDEX.src, kind: 'choice', N, ask: kind };
  if (kind === 'pair') {
    const L = rand.int(N / 2 + 1, N);
    const l = tiedSource(N, L);
    const others = Array.from({ length: N / 2 }, (_, k) => k + 1).filter((k) => k !== l);
    const choices = [
      { value: `T${l}`, label: wTex(l, true) },
      { value: `T${rand.pick(others)}`, label: '' },
      { value: `W${L}`, label: wTex(L, false) },
      { value: `T${L}`, label: wTex(L, true) },
    ];
    choices[1].label = wTex(Number(choices[1].value.slice(1)), true);
    return {
      ...base,
      layer: L,
      prompt: fill(INDEX.pair.prompt, { N, L }),
      promptText: fill(INDEX.pair.promptText, { N, L }),
      choices: rand.shuffle(choices),
      answer: `T${l}`,
      wrong: `W${L}`,
      format: wFromValue,
      why: fill(INDEX.pair.why, { N, L, l }),
    };
  }
  if (kind === 'coding') {
    const c = N / 2;
    const opts = N === 4 ? [1, 2, 3, 4] : [c - 1, c, c + 1, N];
    return {
      ...base,
      layer: c,
      prompt: fill(INDEX.coding.prompt, { N }),
      promptText: fill(INDEX.coding.promptText, { N }),
      choices: rand.shuffle(opts.map((v) => ({ value: v, label: fill(INDEX.layerWord, { n: v }) }))),
      answer: c,
      wrong: N,
      format: (v) => (Number.isInteger(v) ? fill(INDEX.layerWord, { n: v }) : '—'),
      why: fill(INDEX.coding.why, { N, c }),
    };
  }
  return {
    ...base,
    prompt: INDEX.learn.prompt,
    promptText: INDEX.learn.promptText,
    choices: rand.shuffle(INDEX.learn.choices),
    answer: INDEX.learn.answer,
    wrong: 'w12',
    format: (v) => INDEX.learn.choices.find((c) => c.value === v)?.plain ?? '—',
    why: INDEX.learn.why,
  };
}

/* ── stage 3 · tap-to-order ──────────────────────────────────────────── */
export function gradeOrder(given, answer) {
  return Array.isArray(given) && same(given, answer);
}

function orderItem(rand, level, i, setKey) {
  const S = ORDERS[setKey];
  let cards = rand.shuffle(S.cards);
  for (let k = 0; k < 10 && same(cards.filter((c) => !c.decoy).map((c) => c.id), S.answer); k++) cards = rand.shuffle(S.cards);
  const short = Object.fromEntries(S.cards.map((c) => [c.id, c.short]));
  const answer = S.answer.slice();
  return {
    id: `bn${level}-${i}-order`,
    stage: 'order',
    tag: STAGES.order.tag,
    concept: S.concept,
    src: S.src,
    kind: 'custom',
    set: setKey,
    cards,
    hasDecoy: S.cards.some((c) => c.decoy),
    prompt: S.prompt,
    promptText: S.promptText,
    answer,
    wrong: answer.slice().reverse(),
    check: (g) => gradeOrder(g, answer),
    format: (v) => (Array.isArray(v) && v.length ? v.map((id) => short[id] ?? id).join(' → ') : '—'),
    why: S.why,
  };
}

/* ── stage 4 · the t-SNE map ─────────────────────────────────────────── */
const TIERS = { easy: ['easy'], medium: ['medium', 'easy'], hard: ['hard', 'medium'] };

export function dropWhy(it) {
  const cls = MAP.classNames[it.label];
  const near = it.near.map((k) => MAP.classNames[k]).join(' and ');
  const tail = same(it.near, [it.label]) ? '' : MAP.tailMixed;
  return fill(MAP.why, { cls, near, tail });
}

function dropItem(rand, level, i, tier, used) {
  let pool = [];
  for (const t of TIERS[tier] ?? ['easy']) {
    pool = MAP.items.filter((it) => it.tier === t && !used.has(it.index));
    if (pool.length) break;
  }
  if (!pool.length) pool = MAP.items.filter((it) => !used.has(it.index));
  const it = rand.pick(pool);
  used.add(it.index);
  return {
    id: `bn${level}-${i}-drop`,
    stage: 'drop',
    tag: STAGES.drop.tag,
    concept: MAP.concept,
    src: MAP.src,
    kind: 'custom',
    image: it.index,
    label: it.label,
    near: it.near,
    prompt: MAP.prompt,
    sub: MAP.sub,
    promptText: fill(MAP.promptText, { n: it.index + 1 }),
    answer: it.label,
    wrong: (it.label + 1) % MAP.classNames.length,
    check: (g) => g === it.label,
    format: (v) => (Number.isInteger(v) ? MAP.classNames[v] ?? String(v) : '—'),
    why: dropWhy(it),
  };
}

// t-SNE helpers for the component and the check (T = lecture5-study/data/tsne.js TSNE)
const median = (a) => {
  const s = [...a].sort((x, y) => x - y);
  return s[Math.floor(s.length / 2)];
};
export function classHomes(T) {
  return T.classNames.map((_, k) => {
    const xs = [];
    const ys = [];
    T.labels.forEach((l, j) => { if (l === k) { xs.push(T.x[j]); ys.push(T.y[j]); } });
    return { k, x: median(xs), y: median(ys) };
  });
}
export function nearestHome(homes, x, y) {
  let best = 0;
  let bd = Infinity;
  homes.forEach((h, k) => {
    const d = (h.x - x) ** 2 + (h.y - y) ** 2;
    if (d < bd) { bd = d; best = k; }
  });
  return best;
}
// the classes holding at least `min` of the `k` map points nearest point i
export function nearClasses(T, i, k = MAP.near.k, min = MAP.near.min) {
  const d = [];
  for (let j = 0; j < T.labels.length; j++) if (j !== i) d.push([(T.x[j] - T.x[i]) ** 2 + (T.y[j] - T.y[i]) ** 2, j]);
  d.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const counts = new Array(T.classNames.length).fill(0);
  d.slice(0, k).forEach(([, j]) => { counts[T.labels[j]] += 1; });
  return counts.map((c, cls) => [c, cls]).filter(([c]) => c >= min).sort((a, b) => b[0] - a[0] || a[1] - b[1]).map(([, cls]) => cls);
}
export const familyOf = (cls) => MAP.families.findIndex((f) => f.classes.includes(cls));

/* ── the round ───────────────────────────────────────────────────────── */
export function makeItems(rand, level = 1) {
  const L = LEVELS[Math.max(0, Math.min(LEVELS.length - 1, level - 1))];
  const used = new Set();
  let lastBuild = null;
  return L.plan.map((step, i) => {
    const [kind, arg = ''] = step.split(':');
    switch (kind) {
      case 'plane': return planeItem(rand, L.level, i);
      case 'build': {
        const it = buildItem(rand, L.level, i, Number(arg));
        lastBuild = it.answer;
        return it;
      }
      case 'tie': return arg === 'choice' ? tieChoiceItem(rand, L.level, i) : tieKeypadItem(rand, L.level, i, lastBuild ?? TIE.anchor.sizes);
      case 'index': return indexItem(rand, L.level, i, Number(arg));
      case 'order': return orderItem(rand, L.level, i, rand.pick(arg.split('|')));
      case 'drop': return dropItem(rand, L.level, i, arg, used);
      default: throw new Error(`bottleneck: unknown step ${step}`);
    }
  });
}
