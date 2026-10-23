/* ============================================================================
   WAVE STAMP — QUESTION GENERATOR (pure, seeded; Lecture 8)
   ----------------------------------------------------------------------------
   makeItems(rand, level) → the round's items.

   Every positional-encoding number comes from lecture8-study/attn.js
   posEncoding(maxLen, d, variant): variant 'slide' is slide 32's typeset
   base 1000, 'code' is slide 35's 10_000. Angles use the same PE_BASE table
   (check-wave-stamp.mjs asserts sin/cos(angle) equals posEncoding's value).
   ViT counts come from vitPatches(H, W) (slide 46; image sizes are this
   page's own, so those items are `beyond`).

     level 1  barcodes: match a stamp to its position (rack face up, then
              face down), P[0, i], sine vs cosine with the exponent, the
              angle inside P[p, i] (clean powers of 1000), P[p, 0 or 1]
     level 2  the base quirk (1000 vs 10_000), the code's index trick, the
              angle the code computes, pos_emb / call() shapes, slide 36
     level 3  ViT: 768, the pipeline, the patch count (page's own image
              sizes), data hunger, visual attention, slide 47's exam note
   ========================================================================== */
import { posEncoding, PE_BASE, vitPatches } from '../../lecture8-study/attn.js';
import { CHOICE, ORDER, VIT_SIZES, NOT_EXAMINED, NOTES } from '../content/wave-stamp.js';

const L8 = (slides) => ({ lecture: 8, slides });
let counter = 0;
const nextId = (p) => `${p}-${counter++}`;

/* ── the maths ───────────────────────────────────────────────────────── */
// slide 32: even i uses i/d, odd i uses (i − 1)/d (the code's i = 2·arange)
export const expIndex = (i) => (i % 2 === 0 ? i : i - 1);
export const peValue = (p, i, d, variant) => posEncoding(p + 1, d, variant)[p][i];
export const peAngle = (p, i, d, variant) => p / PE_BASE[variant] ** (expIndex(i) / d);
export const divisor = (i, d, variant) => PE_BASE[variant] ** (expIndex(i) / d);
// strip floating dust (1000 ** (2 / 6) = 9.999999999999998)
export const tidy = (x, dp = 6) => Math.round(x * 10 ** dp) / 10 ** dp || 0;
export const rack = (n, d, variant) => posEncoding(n, d, variant).map((r) => r.map((v) => tidy(v, 4)));
const f2 = (x) => (Math.abs(x) < 0.005 ? '0.00' : x.toFixed(2)).replace('-', '−');
const t2 = (x) => (Math.abs(x) < 0.005 ? '0.00' : x.toFixed(2)); // inside $…$ (ASCII minus for KaTeX)
const fnOf = (i) => (i % 2 === 0 ? 'sin' : 'cos');
const BASE_TEX = { slide: '1000', code: '10000' };
const BASE_TXT = { slide: '1000', code: '10_000' };
const linf = (a, b) => Math.max(...a.map((x, k) => Math.abs(x - b[k])));

const choiceFormat = (choices) => (v) => {
  const c = choices.find((x) => x.value === v);
  return c ? (c.plain ?? c.label) : String(v);
};

/* ── level 1: barcodes ───────────────────────────────────────────────── */
const MATCH_D = 8;
const MATCH_N = 8; // positions 0 … 7

function pickPositions(rand, rows, answer) {
  const others = rand.shuffle(rows.map((_, p) => p).filter((p) => p !== answer));
  const picked = [answer];
  for (const p of others) {
    if (picked.length === 4) break;
    if (picked.every((q) => linf(rows[p], rows[q]) >= 0.4)) picked.push(p);
  }
  return picked.sort((a, b) => a - b);
}

function matchItem(rand, faceUp) {
  const R = rack(MATCH_N, MATCH_D, 'slide');
  const p = rand.int(faceUp ? 0 : 1, MATCH_N - 1);
  const positions = pickPositions(rand, R, p);
  const choices = positions.map((q) => ({ value: q, label: `p = ${q}` }));
  const s = peValue(p, 0, MATCH_D, 'slide');
  const c = peValue(p, 1, MATCH_D, 'slide');
  return {
    id: nextId(faceUp ? 'match-up' : 'match-down'), kind: 'choice',
    concept: faceUp ? 'posenc.why' : 'posenc.formula', src: faceUp ? L8([32, 33]) : L8([32]),
    question: faceUp
      ? 'Which position p stamped this barcode? Find its row in the rack.'
      : 'The rack is face down. Which position p stamped this barcode?',
    promptText: `Match the barcode to its position (d = ${MATCH_D}, base 1000)`,
    choices, answer: p, format: choiceFormat(choices),
    stage: { type: 'match', d: MATCH_D, variant: 'slide', p, row: R[p], rack: R, faceUp, candidates: positions },
    maths: {
      eq: 'posenc',
      lines: [`For $i = 0$ and $i = 1$ the exponent is 0, so $\\mathbf{P}_{p,0} = \\sin p$ and $\\mathbf{P}_{p,1} = \\cos p$ (radians); the stamp’s numbers are listed below.`],
    },
    why: `This stamp is position ${p} with d = ${MATCH_D} and slide 32’s base 1000: its first pair is $(\\sin ${p}, \\cos ${p}) = (${t2(s)}, ${t2(c)})$. ${NOTES.unique}${faceUp ? ' Exactly one row of the rack matches it.' : ''}`,
  };
}

function p0Item(rand) {
  const d = rand.pick([4, 6, 8, 16]);
  const i = rand.int(1, d - 1);
  const v = tidy(peValue(0, i, d, 'slide'));
  return {
    id: nextId('p0'), kind: 'number', tol: 0,
    concept: 'posenc.formula', src: L8([32]),
    question: `Slide 32 with d = ${d}: what is $\\mathbf{P}_{0,${i}}$?`,
    promptText: `P at p = 0, i = ${i}, d = ${d}`,
    answer: v,
    stage: { type: 'stamp', d, variant: 'slide', p: 0, row: rack(1, d, 'slide')[0], target: i, inked: false },
    maths: { eq: 'posenc', lines: ['$p = 0$ makes the angle $0 / 1000^{\\dots} = 0$.'] },
    why: `p = 0 makes the angle 0 whatever i and d. i = ${i} is ${i % 2 ? 'odd' : 'even'}, so $\\mathbf{P}_{0,${i}} = \\${fnOf(i)}(0) = ${v}$. The whole barcode for position 0 reads 0, 1, 0, 1, … (slide 32).`,
  };
}

function parityItem(rand) {
  const d = rand.pick([8, 10, 12, 16]);
  const i = rand.int(2, d - 1);
  const odd = i % 2 === 1;
  const e = expIndex(i);
  const other = odd ? i : i - 1; // the tempting wrong exponent
  const lab = (fn, ex) => ({ label: `$\\${fn}\\left(p/1000^{${ex}/${d}}\\right)$`, plain: `${fn}(p / 1000^(${ex}/${d}))` });
  const right = odd ? 'cos' : 'sin';
  const wrong = odd ? 'sin' : 'cos';
  const choices = rand.shuffle([
    { value: 'ok', ...lab(right, e) },
    { value: 'fn', ...lab(wrong, e) },
    { value: 'exp', ...lab(right, other) },
    { value: 'both', ...lab(wrong, other) },
  ]);
  return {
    id: nextId('parity'), kind: 'choice',
    concept: 'posenc.formula', src: L8([32]),
    question: `Slide 32 with d = ${d}: which one is $\\mathbf{P}_{p,${i}}$?`,
    promptText: `Sine or cosine: P(p, ${i}) with d = ${d}`,
    choices, answer: 'ok', format: choiceFormat(choices),
    stage: { type: 'stamp', d, variant: 'slide', p: null, row: null, target: i, inked: false },
    maths: null,
    why: `Slide 32: even i → $\\sin(p/1000^{i/d})$, odd i → $\\cos(p/1000^{(i-1)/d})$. i = ${i} is ${odd ? 'odd' : 'even'}, so $\\mathbf{P}_{p,${i}} = \\${right}(p/1000^{${e}/${d}})$${odd ? `: it shares its frequency with component ${i - 1}` : ''}.`,
  };
}

// d = 6 → 1000^(2/6) = 10, 1000^(4/6) = 100; d = 12 → 1000^(4/12) = 10, 1000^(8/12) = 100
const ANGLE_CFG = [
  { d: 6, e: 2, ps: [5, 12, 15, 20, 25, 30, 45, 50] },
  { d: 6, e: 4, ps: [10, 25, 50, 75, 120, 150, 200, 300] },
  { d: 12, e: 4, ps: [5, 12, 15, 20, 25, 30, 45, 50] },
  { d: 12, e: 8, ps: [10, 25, 50, 75, 120, 150, 200, 300] },
];

function angleItem(rand, odd, avoid = null) {
  const cfg = rand.pick(ANGLE_CFG.filter((_, k) => k !== avoid));
  const { d, e, ps } = cfg;
  const i = odd ? e + 1 : e;
  const p = rand.pick(ps);
  const div = tidy(divisor(i, d, 'slide'));
  const answer = tidy(peAngle(p, i, d, 'slide'));
  const v = peValue(p, i, d, 'slide');
  return {
    id: nextId('angle'), kind: 'number', decimal: true, tol: 0.001,
    concept: 'posenc.formula', src: L8([32]),
    question: `Slide 32 with d = ${d}: $\\mathbf{P}_{${p},${i}}$ is a sine or a cosine of an angle. What is the angle?`,
    promptText: `The angle inside P(${p}, ${i}), d = ${d}, base 1000`,
    answer, cfg: ANGLE_CFG.indexOf(cfg),
    stage: { type: 'stamp', d, variant: 'slide', p, row: rack(p + 1, d, 'slide')[p], target: i, inked: false },
    maths: { eq: 'posenc', lines: [`$1000^{1/3} = 10$ and $1000^{2/3} = 100$.`] },
    why: `i = ${i} is ${odd ? 'odd, so the exponent is (i − 1)/d' : 'even, so the exponent is i/d'} = ${e}/${d} and $1000^{${e}/${d}} = ${div}$: $\\mathbf{P}_{${p},${i}} = \\${fnOf(i)}(${p}/${div}) = \\${fnOf(i)}(${answer})$ = ${f2(v)} (slide 32).${odd ? ` Using i/d = ${i}/${d} for an odd i is the slip to avoid.` : ''}`,
  };
}

function firstPairItem(rand) {
  const i = rand.int(0, 1);
  const p = rand.int(1, 6);
  const d = MATCH_D;
  const v = peValue(p, i, d, 'slide');
  const answer = Math.round(v * 100) / 100;
  return {
    id: nextId('pair'), kind: 'number', decimal: true, negative: true, tol: 0.011,
    concept: 'posenc.formula', src: L8([32]),
    question: `Slide 32 with d = ${d}: what is $\\mathbf{P}_{${p},${i}}$? (2 d.p.)`,
    promptText: `P(${p}, ${i}) with d = ${d}`,
    answer,
    stage: { type: 'stamp', d, variant: 'slide', p, row: rack(p + 1, d, 'slide')[p], target: i, inked: false },
    maths: { eq: 'posenc', lines: [`${NOTES.radians}`] },
    why: `i = ${i}: the exponent is ${i === 0 ? 'i/d' : '(i − 1)/d'} = 0, so the divisor is $1000^{0} = 1$ and $\\mathbf{P}_{${p},${i}} = \\${fnOf(i)}(${p}) = ${t2(v)}$ (slide 32). ${NOTES.radians}`,
  };
}

/* ── level 2: the base quirk and the code ──────────────────────────────── */
function codeBaseItem(rand) {
  const which = rand.pick(['code', 'slide']);
  const choices = rand.shuffle([
    { value: 'code', label: '10_000' },
    { value: 'slide', label: '1000' },
    { value: '100', label: '100' },
    { value: '10', label: '10' },
  ]);
  return {
    id: nextId('base'), kind: 'choice',
    concept: which === 'code' ? 'posenc.code' : 'posenc.formula', src: L8([32, 35]),
    question: which === 'code'
      ? 'Slide 35’s PositionalEncoding code divides p by ▢ ** (i / embed_size). Which base is ▢?'
      : 'Slide 32’s typeset formula divides p by ▢ raised to i/d. Which base is ▢?',
    promptText: which === 'code' ? 'The base in slide 35’s code' : 'The base in slide 32’s formula',
    choices, answer: which, format: choiceFormat(choices),
    stage: which === 'code'
      ? { type: 'code', code: { id: 'l8.posenc.class', lines: [7, 8] }, mask: '10_000' }
      : { type: 'formula', mask: true },
    maths: null,
    why: `${which === 'code' ? 'Slide 35: pos_emb[0, :, ::2] = np.sin(p / 10_000 ** (i / embed_size)).' : 'Slide 32: $\\mathbf{P}_{p,i} = \\sin(p/1000^{i/d})$ for even i, $\\cos(p/1000^{(i-1)/d})$ for odd i.'} ${NOTES.base}`,
  };
}

function twinRackItem(rand) {
  const n = 16;
  const d = 8;
  const codeIs = rand.pick(['A', 'B']);
  const ask = rand.pick(['code', 'slide']);
  const answer = ask === 'code' ? codeIs : codeIs === 'A' ? 'B' : 'A';
  const racks = { code: rack(n, d, 'code'), slide: rack(n, d, 'slide') };
  const A = codeIs === 'A' ? 'code' : 'slide';
  const B = A === 'code' ? 'slide' : 'code';
  const choices = [{ value: 'A', label: 'Rack A' }, { value: 'B', label: 'Rack B' }];
  return {
    id: nextId('twin'), kind: 'choice',
    concept: 'posenc.formula', src: L8([32, 35]),
    question: ask === 'code'
      ? `Two racks of P for p = 0 … ${n - 1}, d = ${d}. Which one did slide 35’s code (base 10_000) stamp?`
      : `Two racks of P for p = 0 … ${n - 1}, d = ${d}. Which one follows slide 32’s base 1000?`,
    promptText: `Which rack uses base ${ask === 'code' ? '10_000 (slide 35)' : '1000 (slide 32)'}`,
    choices, answer, format: choiceFormat(choices),
    stage: { type: 'twin', d, n, A: { variant: A, rack: racks[A] }, B: { variant: B, rack: racks[B] } },
    maths: { eq: 'posenc', lines: ['The code computes the same formula with base 10_000 in place of 1000.'] },
    why: `Rack ${answer} is ${ask === 'code' ? 'the code’s (base 10_000)' : 'slide 32’s (base 1000)'}. Same p and i, but from i = 2 on the code divides p by $10000^{i/d}$ (odd i: $(i-1)/d$), more than slide 32’s $1000^{i/d}$, so its waves are slower: broader bands down the rack. Components 0 and 1 are identical in both. ${NOTES.base}`,
  };
}

function compareItem(rand) {
  const d = 8;
  const p = rand.pick([10, 20, 50, 100]);
  const i = rand.chance(0.25) ? rand.int(0, 1) : rand.int(2, d - 1);
  const e = expIndex(i);
  const a1 = tidy(peAngle(p, i, d, 'slide'), 2);
  const a2 = tidy(peAngle(p, i, d, 'code'), 2);
  const v1 = peValue(p, i, d, 'slide');
  const v2 = peValue(p, i, d, 'code');
  const answer = e === 0 ? 'same' : 'slide';
  const choices = rand.shuffle([
    { value: 'slide', label: 'Larger under slide 32’s base 1000' },
    { value: 'code', label: 'Larger under slide 35’s base 10_000' },
    { value: 'same', label: 'The same under both' },
    { value: 'parity', label: 'It depends on whether p is even' },
  ]);
  return {
    id: nextId('compare'), kind: 'choice',
    concept: 'posenc.formula', src: L8([32, 35]),
    question: `Same p = ${p}, i = ${i}, d = ${d}. Is the angle inside $\\mathbf{P}_{${p},${i}}$ larger under slide 32’s base 1000 or slide 35’s 10_000?`,
    promptText: `The angle inside P(${p}, ${i}), d = ${d}, under both bases`,
    choices, answer, format: choiceFormat(choices),
    stage: { type: 'pair', d, p, target: i, slide: rack(p + 1, d, 'slide')[p], code: rack(p + 1, d, 'code')[p] },
    maths: { eq: 'posenc', lines: ['A bigger base, raised to the same exponent, divides p by more.'] },
    why: e === 0
      ? `For i = ${i} the exponent is 0, so both divide p by 1: the angle is ${p} under both and $\\mathbf{P}_{${p},${i}} = \\${fnOf(i)}(${p}) = ${t2(v1)}$. ${NOTES.base}`
      : `Slide 32: $${p}/1000^{${e}/${d}} = ${a1}$; slide 35’s code: $${p}/10000^{${e}/${d}} = ${a2}$. The bigger base divides by more, so the angle is larger under base 1000; $\\mathbf{P}_{${p},${i}}$ is ${f2(v1)} under slide 32 and ${f2(v2)} under the code. ${NOTES.base}`,
  };
}

function codeIndexItem(rand) {
  const E = rand.pick([6, 8, 10, 12, 16]);
  const kind = rand.pick(['column', 'column', 'count', 'largest']);
  const is = Array.from({ length: E / 2 }, (_, k) => 2 * k);
  let answer;
  let question;
  let promptText;
  let why;
  if (kind === 'column') {
    const c = rand.int(1, E - 1);
    answer = expIndex(c);
    question = `Slide 35’s code with embed_size = ${E}: which value of i fills column ${c} of pos_emb?`;
    promptText = `The code’s i for column ${c} (embed_size = ${E})`;
    why = `i = 2 * np.arange(${E} // 2) = [${is.join(', ')}]. The sines fill the even columns (pos_emb[0, :, ::2]) and the cosines the odd ones (pos_emb[0, :, 1::2]), both in step with those i values, so columns 2k and 2k + 1 share i = 2k: column ${c} → i = ${answer}. ${NOTES.codeIndex}`;
  } else if (kind === 'count') {
    answer = E / 2;
    question = `Slide 35’s code with embed_size = ${E}: how many values does i = 2 * np.arange(embed_size // 2) take?`;
    promptText = `How many values of i for embed_size = ${E}`;
    why = `embed_size // 2 = ${E / 2}, so i = 2 * np.arange(${E / 2}) = [${is.join(', ')}]: ${E / 2} values, one per sine/cosine pair. ${NOTES.codeIndex}`;
  } else {
    answer = E - 2;
    question = `Slide 35’s code with embed_size = ${E}: what is the largest value of i = 2 * np.arange(embed_size // 2)?`;
    promptText = `The largest i for embed_size = ${E}`;
    why = `i = 2 * np.arange(${E} // 2) = [${is.join(', ')}], so the largest is ${E - 2}. It serves both the last sine column (${E - 2}) and the last cosine column (${E - 1}). ${NOTES.codeIndex}`;
  }
  return {
    id: nextId(`index-${kind}`), kind: 'number', tol: 0,
    concept: 'posenc.code', src: L8([35, 32]),
    question, promptText, answer,
    stage: { type: 'code', code: { id: 'l8.posenc.class', lines: [4, 5, 6, 7, 8] } },
    maths: { eq: 'posencCode', lines: [] },
    why,
  };
}

// embed_size = 8: 10000^(2/8) = 10, 10000^(4/8) = 100, 10000^(6/8) = 1000
const CODE_CFG = [
  { e: 2, ps: [5, 15, 25, 30, 45] },
  { e: 4, ps: [20, 50, 75, 120, 250] },
  { e: 6, ps: [100, 250, 500] },
];

function codeAngleItem(rand) {
  const E = 8;
  const { e, ps } = rand.pick(CODE_CFG);
  const c = rand.chance(0.5) ? e : e + 1;
  const p = rand.pick(ps);
  const div = tidy(divisor(c, E, 'code'));
  const answer = tidy(peAngle(p, c, E, 'code'));
  const v = peValue(p, c, E, 'code');
  return {
    id: nextId('code-angle'), kind: 'number', decimal: true, tol: 0.001,
    concept: 'posenc.code', src: L8([35]),
    question: `Slide 35’s code with embed_size = ${E}: what angle goes into the sine or cosine for pos_emb[0, ${p}, ${c}]?`,
    promptText: `The code’s angle for position ${p}, column ${c} (embed_size = ${E})`,
    answer,
    stage: { type: 'code', code: { id: 'l8.posenc.class', lines: [4, 5, 7, 8] }, stamp: { d: E, variant: 'code', p, row: rack(p + 1, E, 'code')[p], target: c } },
    maths: { eq: 'posencCode', lines: ['$10000^{2/8} = 10$, $10000^{4/8} = 100$, $10000^{6/8} = 1000$.'] },
    why: `Column ${c} is ${c % 2 ? 'odd (1::2), a cosine' : 'even (::2), a sine'} computed with i = ${e} from i = 2 * np.arange(8 // 2) = [0, 2, 4, 6]: p / 10_000 ** (${e} / 8) = ${p} / ${div} = ${answer}, and the value is ${fnOf(c)}(${answer}) = ${f2(v)}. For an odd column the code’s i is the column minus 1: slide 32’s (i − 1)/d.`,
  };
}

function shapeItem(rand) {
  const M = rand.pick([50, 100, 128, 200, 500]);
  const E = rand.pick([8, 16, 64, 128, 512]);
  if (rand.chance(0.5)) {
    return {
      id: nextId('shape-posemb'), kind: 'shape', tol: 0,
      concept: 'posenc.code', src: L8([35]),
      question: `PositionalEncoding(max_length=${M}, embed_size=${E}): what is the shape of pos_emb?`,
      promptText: `pos_emb shape for max_length=${M}, embed_size=${E}`,
      answer: [1, M, E],
      format: (v) => (Array.isArray(v) ? `(${v.join(', ')})` : String(v)),
      stage: { type: 'code', code: { id: 'l8.posenc.class', lines: [1, 6] } },
      maths: null,
      why: `Slide 35: pos_emb = np.empty((1, max_length, embed_size)) = (1, ${M}, ${E}); self.pos_encodings holds the same matrix as a tf.constant.`,
    };
  }
  const L = rand.pick([10, 12, 20, 25, 30, 40].filter((x) => x < M));
  const B = rand.pick([16, 32, 64]);
  return {
    id: nextId('shape-call'), kind: 'shape', tol: 0,
    concept: 'posenc.code', src: L8([34, 35]),
    question: `PositionalEncoding(max_length=${M}, embed_size=${E}) is called on inputs of shape (${B}, ${L}, ${E}). What is the shape of self.pos_encodings[:, :batch_max_length]?`,
    promptText: `The slice call() adds: max_length=${M}, inputs (${B}, ${L}, ${E})`,
    answer: [1, L, E],
    format: (v) => (Array.isArray(v) ? `(${v.join(', ')})` : String(v)),
    stage: { type: 'code', code: { id: 'l8.posenc.class', lines: [6, 12, 13, 14] } },
    maths: null,
    why: `Slide 35: batch_max_length = tf.shape(inputs)[1] = ${L}, and call() returns inputs + self.pos_encodings[:, :batch_max_length]: the precomputed (1, ${M}, ${E}) matrix truncated to (1, ${L}, ${E}). Slide 34: call() truncates the matrix to the maximum length of the input sequences and adds it to the inputs.`,
  };
}

/* ── level 3: ViT (slide 46) ──────────────────────────────────────────── */
function dimItem(after) {
  const { dim } = vitPatches(16, 16);
  return {
    id: nextId(after ? 'vit-linear' : 'vit-768'), kind: 'number', tol: 0,
    concept: 'vit.patches', src: L8([46]),
    question: after
      ? 'The flattened squares go through ViT’s linear layer. How many dimensions does each vector have after it?'
      : 'Slide 46: a 16 × 16 square of an RGB image is flattened. How many numbers are in the vector?',
    promptText: after ? 'Dimension after ViT’s linear layer' : 'A flattened 16 × 16 × 3 patch',
    answer: dim,
    stage: { type: 'patches', H: 64, W: 96, own: true, focus: after ? 'linear' : 'flatten' },
    maths: { eq: 'vitPatch', lines: [] },
    why: after
      ? `Slide 46: the linear layer transforms the vectors but retains their dimensionality, so each is still 16 × 16 × 3 = ${dim}.`
      : `Slide 46: the squares are first flattened into 16 × 16 × 3 = ${dim}-dimensional vectors; the value 3 is for the RGB colour channels.`,
  };
}

function countItem(rand, exclude = null) {
  const pool = VIT_SIZES.sizes.filter((s) => !exclude || s.join('x') !== exclude);
  const [H, W] = rand.pick(pool);
  const { rows, cols, count } = vitPatches(H, W);
  return {
    id: nextId('vit-count'), kind: 'number', tol: 0,
    concept: 'vit.patches', src: VIT_SIZES.src, beyond: true, note: VIT_SIZES.note,
    question: `This page’s example: an image ${H} pixels high and ${W} pixels wide. Into how many 16 × 16 squares does ViT chop it?`,
    promptText: `16 × 16 patches in a ${H} × ${W} image (this page’s example)`,
    answer: count, sizeKey: `${H}x${W}`,
    stage: { type: 'patches', H, W, own: true, focus: 'count' },
    maths: { eq: 'vitPatch', lines: ['Patches = (height ÷ 16) × (width ÷ 16).'] },
    why: `${H} ÷ 16 = ${rows} rows and ${W} ÷ 16 = ${cols} columns of 16 × 16 squares: ${rows} × ${cols} = ${count} patches, a sequence of ${count} vectors of 768 numbers each (slide 46). The image size is this page’s own example: slide 46 gives none.`,
  };
}

function orderItem(rand) {
  const steps = ORDER.steps;
  const answer = steps.map((_, i) => i);
  let start = rand.shuffle(answer);
  if (start.every((v, i) => v === i)) start = [start[1], start[0], ...start.slice(2)];
  return {
    id: nextId('vit-order'), kind: 'custom',
    concept: ORDER.concept, src: ORDER.src,
    order: { steps, start },
    answer,
    check: (given) => Array.isArray(given) && given.length === steps.length && given.every((v, i) => v === answer[i]),
    format: (v) => (Array.isArray(v) ? v.map((k) => steps[k]).join(' → ') : String(v)),
    question: ORDER.prompt, promptText: ORDER.promptText,
    stage: { type: 'patches', H: 64, W: 96, own: true, focus: 'chop' },
    maths: { eq: 'vitPatch', lines: [] },
    why: ORDER.why,
  };
}

/* ── content choices ───────────────────────────────────────────────────── */
function choiceItem(rand, c) {
  const choices = rand.shuffle(c.choices.map((x) => ({ ...x })));
  return {
    id: nextId(c.id), kind: 'choice',
    concept: c.concept, src: c.src,
    question: c.prompt, promptText: c.promptText ?? c.prompt,
    choices, answer: c.answer, format: choiceFormat(choices),
    stage: c.stage === 'code' ? { type: 'code', code: c.code } : c.stage === 'wall' ? { type: 'wall', d: 16, n: 24, variant: 'slide', rack: rack(24, 16, 'slide') } : c.stage === 'twin' ? { type: 'pair', d: 8, p: 20, target: null, slide: rack(21, 8, 'slide')[20], code: rack(21, 8, 'code')[20] } : { type: 'patches', H: 64, W: 96, own: true, focus: c.focus ?? 'chop' },
    maths: c.stage === 'code' ? null : c.stage === 'patches' ? null : { eq: 'posenc', lines: [] },
    why: c.why,
    ...(c.notExamined ? { notExamined: true } : {}),
  };
}

const byId = (id) => CHOICE.find((c) => c.id === id);

/* ── the rounds (difficulty ramps within each) ─────────────────────────── */
export function makeItems(rand, level = 1) {
  counter = 0;
  const pickFrom = (ids, n) => rand.shuffle(ids).slice(0, n).map((id) => choiceItem(rand, byId(id)));
  if (level <= 1) {
    const why = pickFrom(['ws.l1.unique', 'ws.l1.fixed', 'ws.l1.added', 'ws.l1.easiest', 'ws.l1.fast', 'ws.l1.d'], 2);
    const first = angleItem(rand, false);
    return [
      matchItem(rand, true),
      why[0],
      p0Item(rand),
      parityItem(rand),
      matchItem(rand, false),
      why[1],
      first,
      angleItem(rand, true, first.cfg),
      firstPairItem(rand),
    ];
  }
  if (level === 2) {
    const extra = pickFrom(['ws.l2.even', 'ws.l2.masking', 'ws.l2.precompute', 'ws.l2.args', 'ws.l2.agree'], 2);
    return [
      codeBaseItem(rand),
      choiceItem(rand, byId('ws.l2.added')),
      twinRackItem(rand),
      extra[0],
      compareItem(rand),
      codeIndexItem(rand),
      extra[1],
      codeAngleItem(rand),
      shapeItem(rand),
    ];
  }
  const first = pickFrom(['ws.l3.chop', 'ws.l3.channels'], 1);
  const next = pickFrom(['ws.l3.linear', 'ws.l3.sequence'], 1);
  const data = pickFrom(['ws.l3.data', 'ws.l3.bias'], 1);
  const cap = pickFrom(['ws.l3.caption', 'ws.l3.frisbee'], 1);
  const count = countItem(rand);
  return [
    dimItem(false),
    first[0],
    next[0],
    count,
    orderItem(rand),
    data[0],
    cap[0],
    rand.chance(0.5) ? dimItem(true) : countItem(rand, count.sizeKey),
    choiceItem(rand, NOT_EXAMINED),
  ];
}
