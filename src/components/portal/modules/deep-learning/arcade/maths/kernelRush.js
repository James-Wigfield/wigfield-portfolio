/* ============================================================================
   KERNEL RUSH — GENERATOR (pure, seeded; no React, no DOM)
   ----------------------------------------------------------------------------
   A "drop" is one input block plus one layer (or a stack of 2–3 layers).
   Each drop gives the round one or two items:
     phase 'shape'   size the output block (ShapePad: None × H × W × C)
     phase 'params'  the bonus after it lands: the Param # (Keypad)
     phase 'rf'      a receptive-field pair: first × last input row (or
                     column) a neuron sees (slide 9's i·s_h … i·s_h + f_h − 1)
   makeItems(rand, level):
     level 1  valid vs same at stride 1, then stride 2 (3-channel / 1-channel)
     level 2  multi-channel filters (each spans all input channels, slide 15)
              and pooling (no parameters, strides = pool size, depth kept)
     level 3  stacks of 2–3 layers (size the final block), a slide-table stack
              (LeNet-5 / AlexNet, printed sizes) and receptive fields
   Shapes come from maths/shapes.js and counts from maths/params.js (both
   checked against real Keras by tools/dl-arcade/check-maths.mjs). The
   generator only draws sizes that the slides' examples explain exactly:
   at a stride s, the number of window positions (n − f + 1 for "valid",
   n for "same") is a multiple of s, so "keeps every s-th one" is exact and
   no ⌈n/s⌉ rounding is ever needed (isClean). Why texts come from
   content/kernel-rush.js. Checked by tools/dl-arcade/check-kernel-rush.mjs.
   ========================================================================== */
import { convOut, layerShape, modelShapes } from './shapes.js';
import { conv2dParams, layerParams } from './params.js';
import { EQUATIONS } from '../content/lecture3.js';
import { RULES, STEP_RULE, TABLE_STACKS, SLIDE18, PROMPTS, MATHS } from '../content/kernel-rush.js';

const pair = (v) => (Array.isArray(v) ? v : [v, v]);
const fmt = (n) => Math.round(n).toLocaleString('en-AU');
const ord = (n) => (n === 2 ? '2nd' : n === 3 ? '3rd' : `${n}th`);
const fill = (text, vars) => text.replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined ? String(vars[k]) : m));
const union = (...srcs) => ({ lecture: 3, slides: [...new Set(srcs.flatMap((s) => s.slides))].sort((a, b) => a - b) });
export const dims = (s) => s.join(' × ');
export const fmtBlock = (s) => `(None, ${s.join(', ')})`;

/* ── a spec as the slides' Keras code ────────────────────────────────── */
export function specLine(spec) {
  const k = (v) => (Array.isArray(v) ? `(${v[0]}, ${v[1]})` : v);
  switch (spec.type) {
    case 'Conv2D': {
      const st = spec.strides && spec.strides !== 1 ? `, strides=${k(spec.strides)}` : '';
      const pad = spec.padding === 'same' ? ', padding="same"' : spec.explicitPad ? ', padding="valid"' : '';
      return `Conv2D(filters=${spec.filters}, kernel_size=${k(spec.kernel)}${st}${pad})`;
    }
    case 'MaxPool2D':
    case 'AvgPool2D': {
      const st = spec.strides != null ? `, strides=${k(spec.strides)}` : '';
      const pad = spec.padding === 'same' ? ', padding="same"' : '';
      return `${spec.type}(pool_size=${k(spec.pool)}${st}${pad})`;
    }
    case 'GlobalAvgPool2D':
      return 'GlobalAvgPool2D()';
    default:
      throw new Error(`kernelRush.specLine: unsupported layer "${spec.type}"`);
  }
}

/* ── which slide rule sizes this layer's height and width ────────────── */
export function ruleKey(spec) {
  if (spec.type === 'GlobalAvgPool2D') return 'gap';
  if (spec.type === 'MaxPool2D' || spec.type === 'AvgPool2D') {
    const s = spec.strides ?? spec.pool;
    if (spec.padding === 'same' && s === 1) return 'poolSame';
    if (spec.strides == null && (spec.padding ?? 'valid') === 'valid') return 'pool';
    return 'poolOther'; // only the slide tables use this (AlexNet's 3 × 3, stride 2)
  }
  const [sh, sw] = pair(spec.strides ?? 1);
  const s = Math.max(sh, sw);
  if (spec.padding === 'same') return s === 1 ? 'same1' : 'same2';
  return s === 1 ? 'valid1' : 'valid2';
}

/* One axis: how many window positions at stride 1, and the output length. */
export function axis(n, f, s, padding = 'valid') {
  const positions = padding === 'same' ? n : n - f + 1;
  return { n, f, s, positions, out: convOut(n, f, s, padding), clean: positions >= 1 && positions % s === 0 };
}

/* The slides explain a layer's size exactly when every axis is "clean". */
export function isClean(spec, inShape) {
  if (spec.type === 'GlobalAvgPool2D') return true;
  const p = spec.padding ?? 'valid';
  if (spec.type !== 'Conv2D') {
    // pooling: "same" at stride 1 keeps the size; default strides (= pool size)
    // tile the map exactly when the pool size divides it (slide 26's halving)
    const [ph, pw] = pair(spec.pool);
    if (p === 'same' && (spec.strides ?? spec.pool) === 1) return true;
    if (spec.strides == null && p === 'valid') return inShape[0] % ph === 0 && inShape[1] % pw === 0;
    return false;
  }
  const [fh, fw] = pair(spec.kernel);
  const [sh, sw] = pair(spec.strides ?? 1);
  return axis(inShape[0], fh, sh, p).clean && axis(inShape[1], fw, sw, p).clean;
}

/* ── the spec builder: input + layers → every intermediate shape ─────── */
export function buildDrop(input, specs) {
  const rows = modelShapes(specs, input).map((r) => ({
    ...r,
    line: specLine(r.spec),
    rule: ruleKey(r.spec),
    params: layerParams(r.spec).total,
    clean: isClean(r.spec, r.in),
  }));
  return {
    input,
    rows,
    lines: rows.map((r) => r.line),
    out: rows[rows.length - 1].out,
    params: rows.reduce((a, r) => a + r.params, 0),
    clean: rows.every((r) => r.clean),
  };
}

/* Kernel tensor and bias shapes (slide 16 / slide 19's get_weights()). */
export function weightShapes(spec, cin) {
  const [fh, fw] = pair(spec.kernel);
  return { kernels: [fh, fw, cin, spec.filters], biases: [spec.filters] };
}

/* ── why texts, filled from content ──────────────────────────────────── */
function sizeCalc(rule, row) {
  const [h, w] = row.in;
  const [oh, ow] = row.out;
  const sq = h === w && oh === ow;
  const spec = row.spec;
  const isPool = spec.type !== 'Conv2D';
  const [fh, fw] = pair(isPool ? spec.pool : spec.kernel);
  const [sh, sw] = pair(spec.strides ?? (isPool ? spec.pool : 1));
  switch (rule) {
    case 'valid1':
      return sq && fh === fw ? `${h} − ${fh} + 1 = ${oh} both ways` : `${h} − ${fh} + 1 = ${oh} and ${w} − ${fw} + 1 = ${ow}`;
    case 'same1':
    case 'poolSame':
      return `${h} × ${w} stays ${oh} × ${ow}`;
    case 'same2':
      return sq ? `${h} → ${oh} both ways` : `${h} → ${oh} down, ${w} → ${ow} across`;
    case 'valid2': {
      const ah = axis(h, fh, sh, 'valid');
      const aw = axis(w, fw, sw, 'valid');
      return sq && fh === fw
        ? `${h} − ${fh} + 1 = ${ah.positions} positions → ${oh} both ways`
        : `${h} − ${fh} + 1 = ${ah.positions} → ${oh} down, ${w} − ${fw} + 1 = ${aw.positions} → ${ow} across`;
    }
    case 'pool':
      return `${h} × ${w} → ${oh} × ${ow}`;
    default:
      return `${h} × ${w} → ${oh} × ${ow}`;
  }
}

function layerWhy(row, { multi = false } = {}) {
  const rule = row.rule;
  const spec = row.spec;
  const [, , c] = row.in;
  if (rule === 'gap') return { text: fill(RULES.gap.text, { h: row.in[0], w: row.in[1], c }), src: RULES.gap.src, concept: RULES.gap.concept };
  if (spec.type !== 'Conv2D') {
    const R = RULES[rule === 'poolSame' ? 'poolSame' : 'pool'];
    return { text: fill(R.text, { layer: row.line, p: spec.pool, c, calc: sizeCalc(rule, row) }), src: R.src, concept: R.concept };
  }
  const R = RULES[rule];
  const [fh, fw] = pair(spec.kernel);
  const [sh] = pair(spec.strides ?? 1);
  const size = fill(R.text, {
    how: spec.explicitPad ? '' : ' (the default, slide 20)',
    f: `${fh} × ${fw}`,
    s: Array.isArray(spec.strides) ? `(${spec.strides[0]}, ${spec.strides[1]})` : sh,
    sth: ord(sh),
    calc: sizeCalc(rule, row),
  });
  const D = multi ? RULES.multiChannel : RULES.depth;
  const depth = fill(D.text, { k: spec.filters, c });
  return { text: `${size} ${depth}`, src: union(R.src, D.src), concept: multi ? D.concept : R.concept };
}

function paramsWhy(row) {
  const spec = row.spec;
  if (spec.type !== 'Conv2D') {
    // GlobalAvgPool2D: slide 31 names the layer ("Similar to AveragePooling2D")
    const src = spec.type === 'GlobalAvgPool2D' ? union(RULES.poolParams.src, RULES.gap.src) : RULES.poolParams.src;
    return { text: RULES.poolParams.text, src, concept: RULES.poolParams.concept };
  }
  const [fh, fw] = pair(spec.kernel);
  const c = row.in[2];
  return {
    text: fill(RULES.convParams.text, { fh, fw, c, k: spec.filters, total: fmt(conv2dParams(spec.kernel, c, spec.filters)).replace(/,/g, "{,}") }),
    src: RULES.convParams.src,
    concept: RULES.convParams.concept,
  };
}

/* ── the maths drawer lines for an item (no answers, only the givens) ─ */
function shapeMaths(drop, multi) {
  const lines = [];
  const rules = new Set(drop.rows.map((r) => r.rule));
  const hasConv = drop.rows.some((r) => r.spec.type === 'Conv2D');
  // poolOther (AlexNet's 3 × 3, stride 2 pool) is sized by n − f + 1 positions, every s-th kept
  if (rules.has('valid1') || rules.has('valid2') || rules.has('poolOther')) lines.push({ text: MATHS.valid });
  if (rules.has('same1') || rules.has('same2')) lines.push({ text: MATHS.same });
  if (rules.has('same2') || rules.has('valid2') || rules.has('poolOther')) lines.push({ text: MATHS.stride });
  if (hasConv) lines.push({ text: MATHS.depth });
  if (multi) {
    lines.push({ text: MATHS.filterSize });
    lines.push({ tex: EQUATIONS.convOutputChannel.tex[0] });
  }
  if (rules.has('pool') || rules.has('poolSame') || rules.has('poolOther')) lines.push({ text: MATHS.pool });
  if (rules.has('gap')) lines.push({ text: MATHS.gap });
  const r0 = drop.rows[0];
  lines.push({ text: `Here: input $${drop.input.join(' \\times ')}$, then ${drop.lines.join(', then ')}.` });
  if (multi && r0.spec.type === 'Conv2D') {
    const [fh, fw] = pair(r0.spec.kernel);
    lines.push({ text: `Each of the ${r0.spec.filters} filters is $${fh} \\times ${fw} \\times ${r0.in[2]}$.` });
  }
  return lines;
}

function paramsMaths(drop) {
  const lines = [];
  const convs = drop.rows.filter((r) => r.spec.type === 'Conv2D');
  if (convs.length) {
    lines.push({ text: MATHS.params });
    lines.push({ tex: `${EQUATIONS.kerasWeightShapes.tex[0]} \\quad ${EQUATIONS.kerasWeightShapes.tex[1]}` });
    lines.push({ tex: EQUATIONS.convParamsExample.tex[0] });
    convs.forEach((r) => {
      const [fh, fw] = pair(r.spec.kernel);
      lines.push({ text: `${r.line} on ${r.in[2]} channels: $f_h = ${fh}$, $f_w = ${fw}$, $f_c = ${r.in[2]}$, $f_n = ${r.spec.filters}$.` });
    });
  }
  if (drop.rows.some((r) => r.spec.type !== 'Conv2D')) lines.push({ text: MATHS.poolParams });
  return lines;
}

/* ── items ───────────────────────────────────────────────────────────── */
let counter = 0;
const nextId = (level, phase) => `kr${level}-${++counter}-${phase}`;

function shapeItem(level, dropId, drop, { multi = false, title = null, table = null, weight = 2 } = {}) {
  const single = drop.rows.length === 1;
  let why;
  let src;
  let concept;
  if (table) {
    why = table.why;
    src = table.src;
    concept = 'shape.conv2d';
  } else if (single) {
    ({ text: why, src, concept } = layerWhy(drop.rows[0], { multi }));
  } else {
    const steps = drop.rows.map((r) => `${r.line} → ${dims(r.out)}: ${STEP_RULE[r.rule]}`).join('; ');
    why = fill(RULES.stack.text, { steps });
    src = union(RULES.stack.src, ...drop.rows.map((r) => (RULES[r.rule] ?? RULES.stack).src));
    concept = RULES.stack.concept;
  }
  const isGap = drop.rows[drop.rows.length - 1].rule === 'gap';
  const question = table
    ? fill(PROMPTS.table, { title: table.title })
    : single
      ? isGap ? PROMPTS.gap : PROMPTS.shape
      : fill(PROMPTS.stack, { n: drop.rows.length });
  return {
    id: nextId(level, 'shape'),
    drop: dropId,
    phase: 'shape',
    kind: 'shape',
    concept,
    src,
    answer: drop.out.slice(),
    why,
    question,
    promptText: `${dims(drop.input)} → ${drop.lines.join(' → ')}: output shape`,
    stage: stageOf(drop, title ?? table?.title ?? null),
    maths: shapeMaths(drop, multi),
    weight,
    format: fmtBlock,
  };
}

function paramsItem(level, dropId, drop, { weight = 1.4, extraSrc = null } = {}) {
  const single = drop.rows.length === 1;
  let why;
  let src;
  let concept;
  if (single) ({ text: why, src, concept } = paramsWhy(drop.rows[0]));
  else {
    const parts = drop.rows.map((r) => {
      if (r.spec.type !== 'Conv2D') return '0';
      const [fh, fw] = pair(r.spec.kernel);
      return `(${fh} × ${fw} × ${r.in[2]} + 1) × ${r.spec.filters}`;
    }).join(' + ');
    why = fill(RULES.stackParams.text, { parts, total: fmt(drop.params) });
    src = RULES.stackParams.src;
    concept = drop.rows.some((r) => r.spec.type === 'Conv2D') ? RULES.stackParams.concept : RULES.poolParams.concept;
  }
  if (extraSrc) src = union(src, extraSrc);
  return {
    id: nextId(level, 'params'),
    drop: dropId,
    phase: 'params',
    kind: 'number',
    concept,
    src,
    answer: drop.params,
    why,
    question: single ? PROMPTS.params : PROMPTS.stackParams,
    promptText: `${dims(drop.input)} → ${drop.lines.join(' → ')}: Param #`,
    stage: stageOf(drop, null),
    maths: paramsMaths(drop),
    weight,
  };
}

/* What the stage draws (plain data). */
function stageOf(drop, title) {
  const r0 = drop.rows[0];
  const s0 = r0.spec;
  const isConv = s0.type === 'Conv2D';
  const [kh, kw] = s0.type === 'GlobalAvgPool2D' ? [r0.in[0], r0.in[1]] : pair(isConv ? s0.kernel : s0.pool);
  return {
    view: 'block',
    title,
    input: drop.input,
    out: drop.out,
    lines: drop.lines,
    specs: drop.rows.map((r) => r.spec), // plain data (each with its inputShape), for the check script
    outs: drop.rows.map((r) => r.out),
    kind: isConv ? 'conv' : s0.type === 'GlobalAvgPool2D' ? 'gap' : 'pool',
    kernel: [kh, kw, isConv ? r0.in[2] : 1],
    layer: drop.rows.length > 1 ? `${drop.rows.length} layers` : s0.type,
  };
}

function rfItem(level, dropId, rand, { pairs = false } = {}) {
  const fs = [2, 3, 4, 5];
  let fh, fw, sh, sw, mh, mw, nh, nw;
  for (let tries = 0; tries < 50; tries++) {
    fh = rand.pick(fs);
    fw = pairs ? rand.pick(fs.filter((f) => f !== fh)) : fh;
    sh = rand.pick([1, 2, 3]);
    sw = pairs ? rand.pick([1, 2, 3].filter((s) => s !== sh)) : sh;
    mh = rand.int(3, 5);
    mw = pairs ? rand.int(3, 5) : mh;
    nh = (mh - 1) * sh + fh;
    nw = (mw - 1) * sw + fw;
    if (nh <= 15 && nw <= 15 && nh >= 5 && nw >= 5) break;
  }
  if (!(nh <= 15 && nw <= 15 && nh >= 5 && nw >= 5)) {
    // fallback that always fits (never reached in practice)
    [fh, fw, sh, sw, mh, mw] = [3, pairs ? 5 : 3, 2, pairs ? 1 : 2, 4, 4];
    nh = (mh - 1) * sh + fh;
    nw = (mw - 1) * sw + fw;
  }
  const spec = { type: 'Conv2D', filters: rand.pick([4, 8, 16]), kernel: pairs ? [fh, fw] : fh, strides: pairs ? [sh, sw] : sh };
  if (rand.chance(0.35)) spec.explicitPad = true;
  const input = [nh, nw, rand.pick([1, 3])];
  const out = layerShape(spec, input);
  const i = rand.int(1, out[0] - 1);
  const j = rand.int(1, out[1] - 1);
  // ask about the axis with the larger stride more often (pairs mode)
  const rowsFirst = pairs ? (sh > sw ? rand.chance(0.7) : rand.chance(0.3)) : rand.chance(0.5);
  const ax = rowsFirst ? 'rows' : 'columns';
  const isRows = ax === 'rows';
  const s = isRows ? sh : sw;
  const f = isRows ? fh : fw;
  const idx = isRows ? i : j;
  const first = idx * s;
  const last = first + f - 1;
  const sym = isRows ? ['i', 's_h', 'f_h'] : ['j', 's_w', 'f_w'];
  const calc = `$${sym[0]} = ${idx}$, $${sym[1]} = ${s}$, $${sym[2]} = ${f}$: ${ax} $${idx} \\times ${s} = ${first}$ to $${first} + ${f} - 1 = ${last}$`;
  const line = specLine(spec);
  return {
    id: nextId(level, 'rf'),
    drop: dropId,
    phase: 'rf',
    kind: 'shape',
    concept: RULES.rf.concept,
    src: RULES.rf.src,
    answer: [first, last],
    why: fill(RULES.rf.text, { calc }),
    question: fill(PROMPTS.rf, { i, j, axis: ax }),
    sub: PROMPTS.rfSub,
    promptText: `${dims(input)} → ${line}: neuron (${i}, ${j}), input ${ax}`,
    stage: {
      view: 'grid',
      input,
      out,
      lines: [line],
      neuron: [i, j],
      axis: isRows ? 'rows' : 'cols',
      kernel: [fh, fw],
      strides: [sh, sw],
      field: [i * sh, j * sw],
    },
    maths: [
      { text: MATHS.rf },
      { tex: `${EQUATIONS.receptiveFieldIndices.tex[0]} \\qquad ${EQUATIONS.receptiveFieldIndices.tex[1]}` },
      { text: `Here: ${line}, so $f_h = ${fh}$, $f_w = ${fw}$, $s_h = ${sh}$, $s_w = ${sw}$; the neuron is at $i = ${i}$, $j = ${j}$.` },
    ],
    weight: 1.6,
    format: (v) => (Array.isArray(v) ? `${ax} ${v[0]} to ${v[1]}` : String(v)),
  };
}

/* ── random clean layers ─────────────────────────────────────────────── */
const SIZES1 = [28, 32, 48, 56, 64, 70, 96, 100, 120, 128, 150];
const SIZES2 = [14, 16, 28, 32, 56, 64];
const SIZES3 = [9, 12, 15, 18, 21, 24, 27, 30, 36, 48];

function hw(rand, sizes, { even = false, square = 0.6 } = {}) {
  const pool = even ? sizes.filter((n) => n % 2 === 0) : sizes;
  const h = rand.pick(pool);
  const w = rand.chance(square) ? h : rand.pick(pool);
  return [h, w];
}

/* A Conv2D with the given padding and stride that stays clean on input. */
function convSpec(rand, input, { padding, stride, filters, kernels = [3, 5, 7] }) {
  for (let tries = 0; tries < 60; tries++) {
    const k = rand.pick(kernels);
    const spec = { type: 'Conv2D', filters: rand.pick(filters), kernel: k };
    if (stride !== 1) spec.strides = stride;
    if (padding === 'same') spec.padding = 'same';
    else if (rand.chance(0.4)) spec.explicitPad = true;
    if (input[0] - k + 1 >= 2 && input[1] - k + 1 >= 2 && isClean(spec, input)) return spec;
  }
  return null;
}

function convDrop(rand, level, dropId, { padding, stride, multi = false }) {
  for (let tries = 0; tries < 60; tries++) {
    const [h, w] = multi ? hw(rand, SIZES2, { even: stride > 1 }) : hw(rand, SIZES1, { even: stride > 1 });
    const c = multi ? rand.pick([16, 32, 64]) : rand.pick([1, 3]);
    const spec = convSpec(rand, [h, w, c], {
      padding,
      stride,
      filters: multi ? [32, 64, 128] : [8, 16, 32, 64],
      kernels: multi ? [1, 3, 5] : [3, 5, 7],
    });
    if (!spec) continue;
    const drop = buildDrop([h, w, c], [spec]);
    if (drop.clean) return [shapeItem(level, dropId, drop, { multi }), paramsItem(level, dropId, drop)];
  }
  throw new Error('kernelRush: no clean conv drop');
}

function poolDrop(rand, level, dropId, variant) {
  const c = rand.pick([16, 32, 64, 96]);
  let input;
  let spec;
  if (variant === 'pool2') {
    input = [...hw(rand, SIZES2, { even: true }), c];
    spec = { type: rand.pick(['MaxPool2D', 'AvgPool2D']), pool: 2 };
  } else if (variant === 'pool3') {
    input = [...hw(rand, SIZES3), c];
    spec = { type: 'MaxPool2D', pool: 3 };
  } else if (variant === 'poolSame') {
    input = [...hw(rand, SIZES2), c];
    spec = { type: 'MaxPool2D', pool: 3, strides: 1, padding: 'same' };
  } else {
    input = [...hw(rand, SIZES2), c];
    spec = { type: 'GlobalAvgPool2D' };
  }
  const drop = buildDrop(input, [spec]);
  return [shapeItem(level, dropId, drop), paramsItem(level, dropId, drop, { weight: 0.8 })];
}

/* A generated stack (level 3): conv layers deepen as the map shrinks (slide 33). */
const PATTERNS = { 2: [['conv', 'pool'], ['conv', 'conv']], 3: [['conv', 'conv', 'pool'], ['conv', 'pool', 'conv'], ['conv', 'pool', 'pool']] };
function stackDrop(rand, level, dropId, n) {
  for (let tries = 0; tries < 80; tries++) {
    const size = rand.pick([16, 28, 32, 56, 64]);
    const input = [size, size, rand.pick([1, 3])];
    const pattern = rand.pick(PATTERNS[n]);
    const filters = [rand.pick([8, 16]), rand.pick([32]), rand.pick([64])];
    let shape = input;
    let fi = 0;
    const specs = [];
    let ok = true;
    for (const kind of pattern) {
      let spec = null;
      if (kind === 'pool') {
        if (shape[0] % 2 === 0 && shape[1] % 2 === 0 && shape[0] >= 4) spec = { type: rand.pick(['MaxPool2D', 'AvgPool2D']), pool: 2 };
      } else {
        const options = rand.shuffle([
          { padding: 'same', stride: 1 },
          { padding: 'valid', stride: 1 },
          { padding: 'same', stride: 2 },
          { padding: 'valid', stride: 2 },
        ]);
        for (const o of options) {
          spec = convSpec(rand, shape, { ...o, filters: [filters[Math.min(fi, 2)]], kernels: [3, 5] });
          if (spec) break;
        }
        fi += 1;
      }
      if (!spec) { ok = false; break; }
      specs.push(spec);
      shape = layerShape(spec, shape);
      if (shape[0] < 2 || shape[1] < 2) { ok = false; break; }
    }
    if (!ok) continue;
    const drop = buildDrop(input, specs);
    if (!drop.clean) continue;
    return [shapeItem(level, dropId, drop, { weight: 3 }), paramsItem(level, dropId, drop, { weight: 2 })];
  }
  throw new Error('kernelRush: no clean stack');
}

function tableDrop(rand, level, dropId) {
  const t = rand.pick(TABLE_STACKS);
  const drop = buildDrop(t.input, t.specs);
  return [shapeItem(level, dropId, drop, { table: t, weight: 3 })];
}

/* ── the round ───────────────────────────────────────────────────────── */
export function makeItems(rand, level = 1) {
  counter = 0;
  let d = 0;
  const did = () => `d${++d}`;
  const items = [];
  if (level <= 1) {
    // valid vs same at stride 1 (the slide-18 layer sometimes opens), then stride 2
    if (rand.chance(0.35)) {
      const drop = buildDrop(SLIDE18.input, [SLIDE18.spec]);
      const id = did();
      items.push(shapeItem(1, id, drop), paramsItem(1, id, drop, { extraSrc: SLIDE18.paramsSrc }));
    } else items.push(...convDrop(rand, 1, did(), { padding: 'valid', stride: 1 }));
    items.push(...convDrop(rand, 1, did(), { padding: 'same', stride: 1 }));
    items.push(...convDrop(rand, 1, did(), { padding: rand.pick(['valid', 'same']), stride: 1 }));
    const s2 = rand.shuffle(['same', 'valid']);
    items.push(...convDrop(rand, 1, did(), { padding: s2[0], stride: 2 }));
    items.push(...convDrop(rand, 1, did(), { padding: s2[1], stride: 2 }));
    return items;
  }
  if (level === 2) {
    const pads = rand.shuffle(['valid', 'same']);
    items.push(...convDrop(rand, 2, did(), { padding: pads[0], stride: 1, multi: true }));
    items.push(...poolDrop(rand, 2, did(), 'pool2'));
    items.push(...convDrop(rand, 2, did(), { padding: pads[1], stride: 1, multi: true }));
    items.push(...poolDrop(rand, 2, did(), rand.pick(['pool3', 'poolSame', 'gap'])));
    items.push(...convDrop(rand, 2, did(), { padding: rand.pick(['valid', 'same']), stride: 2, multi: true }));
    return items;
  }
  // level 3: stacks, receptive fields, a slide-table stack; hardest last
  items.push(...stackDrop(rand, 3, did(), 2));
  items.push(rfItem(3, did(), rand));
  items.push(...tableDrop(rand, 3, did()));
  items.push(...stackDrop(rand, 3, did(), 3));
  items.push(rfItem(3, did(), rand, { pairs: true }));
  return items;
}

export { RULES, TABLE_STACKS };
