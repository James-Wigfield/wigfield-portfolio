/* ============================================================================
   FORGER — THE ITEM GENERATOR (pure, seeded; no React, no DOM)
   ----------------------------------------------------------------------------
   makeItems(rand, level) → the round's items (kit/useRound.js shape), built
   from content/forger.js in ROUNDS order:

     which      a phase ran in the studio: phase 1 or phase 2?   (choice)
     recipe*    build phase 1's / phase 2's batch: batch · labels · who
                learns                                         (custom)
     order      tap slide 25's lines / steps into order          (custom)
     fact       the slides' words                                (choice)
     diagnose   read a live histogram: collapse / diverse / unstable
     pair       two runs side by side: which one collapsed?      (choice)
     gap        fill the gap in slide 25's loop                  (choice)
     build      pick each slot by the slide-28 guidelines        (custom)
     spot       tap the slide-29 line that departs / matches     (choice)
     number     rows, zeros, y2 labels, Dense units              (number)
     shape      noise = [batch_size, codings_size]               (shape)

   The studio items carry `studio: { key, t, demo? }`; the stage draws them
   with maths/forgerStudio.js (this page's toy GAN, computed lazily). The
   verdicts of the level-2 frames are content data, checked against the
   runs by tools/dl-arcade/check-forger.mjs.
   ========================================================================== */
import {
  ROUNDS, STUDIO, INGREDIENTS, PHASES, WHICH, ORDER_SETS, FACTS, LOOP, GAPS, DIAG,
  BUILD, DCGAN, SPOT, NUMBERS,
} from '../content/forger.js';

export const fill = (tpl, vars = {}) => String(tpl).replace(/%(\w+)%/g, (m, k) => (k in vars ? String(vars[k]) : m));
const plain = (s) => String(s).replace(/`/g, '');
const firstLine = (code) => String(code).split('\n')[0];

const choiceItem = (base, choices, answer) => ({
  ...base,
  kind: 'choice',
  answer,
  choices,
  format: (v) => plain(choices.find((c) => c.value === v)?.label ?? String(v)),
});

/* ── recipe ─────────────────────────────────────────────────────────────── */
export const ROW_KEYS = ['batch', 'labels', 'learns'];
const optText = (row, key) => INGREDIENTS[row].find((o) => o.key === key)?.text ?? '—';
export const recipeText = (v) => (v && typeof v === 'object' ? ROW_KEYS.map((r) => optText(r, v[r])).join(' · ') : '—');
export const recipeOk = (answer) => (g) => !!g && typeof g === 'object' && ROW_KEYS.every((r) => g[r] === answer[r]);

function recipe(rand, phase, n) {
  const P = PHASES[phase];
  const at = phase === 1 ? STUDIO.p1At : STUDIO.p2At;
  return {
    id: `recipe-${n}-${P.id}`,
    type: 'recipe',
    phase,
    concept: P.concept,
    src: P.src,
    kind: 'custom',
    prompt: P.prompt,
    promptText: P.prompt,
    title: P.title,
    answer: { ...P.answer },
    check: recipeOk(P.answer),
    format: recipeText,
    rows: ROW_KEYS.map((r) => ({ key: r, options: rand.shuffle(INGREDIENTS[r]).map((o) => ({ key: o.key, text: o.text })) })),
    code: P.code,
    studio: { key: STUDIO.preset, t: rand.pick(at), demo: phase },
    why: P.why,
  };
}

/* ── which phase ran ───────────────────────────────────────────────────── */
function which(rand, phase, n) {
  const key = phase === 1 ? 'p1' : 'p2';
  const at = phase === 1 ? STUDIO.p1At : STUDIO.p2At;
  const choices = WHICH.choices.map((c) => ({ value: c.key, label: c.text }));
  return choiceItem({
    id: `which-${n}-${key}`,
    type: 'which',
    concept: WHICH.concept[key],
    src: WHICH.src[key],
    prompt: WHICH.prompt,
    promptText: WHICH.prompt,
    studio: { key: STUDIO.preset, t: rand.pick(at), demo: phase },
    why: WHICH.why[key],
  }, choices, key);
}

/* ── order ─────────────────────────────────────────────────────────────── */
export const sameOrder = (answer) => (g) => Array.isArray(g) && g.length === answer.length && g.every((v, i) => v === answer[i]);

function order(rand, set, n) {
  const answer = set.cards.map((c) => c.id);
  let cards = rand.shuffle(set.cards);
  for (let tries = 0; tries < 5 && cards.every((c, i) => c.id === answer[i]); tries++) cards = rand.shuffle(set.cards);
  if (cards.every((c, i) => c.id === answer[i])) cards = [...cards.slice(1), cards[0]];
  const short = Object.fromEntries(set.cards.map((c) => [c.id, c.code ?? c.text]));
  return {
    id: `order-${n}-${set.id}`,
    type: 'order',
    concept: set.concept,
    src: set.src,
    kind: 'custom',
    prompt: set.prompt,
    promptText: set.prompt,
    cards: cards.map((c) => ({ id: c.id, code: c.code ?? null, text: c.text ?? null })),
    answer,
    check: sameOrder(answer),
    format: (v) => (Array.isArray(v) ? v.map((id) => short[id] ?? id).join(' → ') : '—'),
    why: set.why,
  };
}

/* ── facts ─────────────────────────────────────────────────────────────── */
function fact(rand, f, n) {
  const choices = rand.shuffle(f.choices).map((c) => ({ value: c.key, label: c.text }));
  return choiceItem({
    id: `fact-${n}-${f.id}`,
    type: 'fact',
    concept: f.concept,
    src: f.src,
    prompt: f.prompt,
    promptText: f.prompt,
    why: f.why,
  }, choices, f.choices[0].key);
}

/* ── level 2: diagnose, pair, gap ──────────────────────────────────────── */
function diagnose(rand, verdict, n) {
  const fr = DIAG.frames[verdict];
  const t = rand.pick(fr.at);
  const choices = rand.shuffle(DIAG.choices).map((c) => ({ value: c.key, label: c.text }));
  return choiceItem({
    id: `diagnose-${n}-${verdict}-${t}`,
    type: 'diagnose',
    concept: DIAG.concept[verdict],
    src: DIAG.src,
    prompt: DIAG.prompt,
    promptText: DIAG.prompt,
    studio: { key: fr.preset, t },
    history: true,
    why: DIAG.why[verdict],
  }, choices, verdict);
}

function pair(rand, n) {
  const t = rand.pick(DIAG.pairAt);
  const weakFirst = rand.chance(0.5);
  const w = weakFirst ? 'A' : 'B';
  const b = weakFirst ? 'B' : 'A';
  const runsAB = weakFirst ? ['weak', 'balanced'] : ['balanced', 'weak'];
  const choices = DIAG.pair.choices.map((c) => ({ value: c.key, label: c.text }));
  return choiceItem({
    id: `pair-${n}-${w}-${t}`,
    type: 'pair',
    concept: 'gan.modeCollapse',
    src: { lecture: 6, slides: [27] },
    prompt: DIAG.pair.prompt,
    promptText: DIAG.pair.prompt,
    pair: runsAB.map((key, i) => ({ key, t, label: i === 0 ? 'A' : 'B' })),
    why: fill(DIAG.pair.why, { w, b }),
  }, choices, w);
}

function gap(rand, g, n) {
  const choices = rand.shuffle(g.choices).map((c) => ({ value: c.key, label: `\`${c.code}\`` }));
  return choiceItem({
    id: `gap-${n}-${g.id}`,
    type: 'gap',
    concept: g.concept,
    src: g.src,
    prompt: LOOP.prompt,
    promptText: LOOP.prompt,
    line: g.line,
    why: g.why,
  }, choices, 'right');
}

/* ── level 3: build, spot, numbers ─────────────────────────────────────── */
export const buildOk = (answer) => (g) => !!g && typeof g === 'object' && Object.keys(answer).every((k) => g[k] === answer[k]);

function build(rand, net, n) {
  const N = BUILD.nets[net];
  const picked = rand.shuffle(N.slots).slice(0, 3);
  const slots = N.slots.filter((s) => picked.includes(s)); // keep the drawing's order
  const answer = Object.fromEntries(slots.map((s) => [s, BUILD.slots[s].answer]));
  const textOf = (s, k) => BUILD.slots[s].options.find((o) => o.key === k)?.text ?? '—';
  const prompt = fill(BUILD.prompt, { net: N.name });
  return {
    id: `build-${n}-${net}-${slots.join('+')}`,
    type: 'build',
    net,
    concept: BUILD.concept,
    src: BUILD.src,
    kind: 'custom',
    prompt,
    promptText: prompt,
    slots: slots.map((s) => ({
      id: s,
      label: BUILD.slots[s].label,
      at: BUILD.slots[s].at,
      guideline: BUILD.slots[s].guideline,
      options: rand.shuffle(BUILD.slots[s].options).map((o) => ({ key: o.key, text: o.text, tag: o.tag })),
    })),
    answer,
    check: buildOk(answer),
    format: (v) => (v && typeof v === 'object' ? slots.map((s) => `${BUILD.slots[s].label} ${textOf(s, v[s])}`).join(' · ') : '—'),
    why: `Slide 28 — ${slots.map((s) => BUILD.why[s]).join('; ')}.`,
  };
}

function spot(rand, s, n) {
  const lines = DCGAN[s.net].lines;
  const choices = s.candidates.map((id) => ({ value: id, label: `\`${firstLine(lines.find((l) => l.id === id).code)}\`` }));
  return choiceItem({
    id: `spot-${n}-${s.id}`,
    type: 'spot',
    concept: s.concept,
    src: s.src,
    prompt: s.prompt,
    promptText: s.prompt,
    net: s.net,
    candidates: s.candidates,
    why: s.why,
  }, choices, s.answer);
}

function number(rand, kind, n) {
  const spec = NUMBERS[kind];
  const b = rand.pick(NUMBERS.batches);
  const ans = kind === 'rows' ? 2 * b : kind === 'dense' ? 7 * 7 * 128 : b;
  const prompt = fill(spec.prompt, { b });
  return {
    id: `number-${n}-${kind}-${b}`,
    type: 'number',
    numberKind: kind,
    batch: kind === 'dense' ? null : b,
    concept: spec.concept,
    src: spec.src,
    kind: 'number',
    tol: 0,
    prompt,
    promptText: prompt,
    code: spec.code,
    answer: ans,
    why: fill(spec.why, { b, ans }),
  };
}

function shape(rand, n) {
  const spec = rand.pick(NUMBERS.noise);
  const b = rand.pick(NUMBERS.batches);
  const prompt = fill(spec.prompt, { b });
  return {
    id: `shape-${n}-${spec.id}-${b}`,
    type: 'shape',
    batch: b,
    codings: spec.codings,
    model: spec.model,
    concept: spec.concept,
    src: spec.src,
    kind: 'shape',
    prompt,
    promptText: prompt,
    code: [NUMBERS.noiseCode],
    answer: [b, spec.codings],
    format: (v) => (Array.isArray(v) ? `[${v.join(', ')}]` : '—'),
    why: fill(spec.why, { b }),
  };
}

/* ── the round ─────────────────────────────────────────────────────────── */
export function makeItems(rand, level = 1) {
  const L = [1, 2, 3].includes(level) ? level : 1;
  const plan = ROUNDS[L];
  const facts = rand.shuffle(FACTS.filter((f) => f.level === L));
  const orders = rand.shuffle(ORDER_SETS);
  const gaps = rand.shuffle(GAPS);
  const spots = rand.shuffle(SPOT);
  const verdicts = rand.shuffle(['collapse', 'covered', 'unstable']);
  const nums = rand.shuffle(['rows', 'zeros', 'y2', 'dense']);
  const nets = rand.chance(0.5) ? ['gen', 'disc', 'gen'] : ['disc', 'gen', 'disc'];
  const whichPhases = rand.chance(0.5) ? [1, 2] : [2, 1];
  const c = { fact: 0, order: 0, gap: 0, spot: 0, diag: 0, num: 0, build: 0, which: 0 };
  return plan.map((type, n) => {
    switch (type) {
      case 'which': return which(rand, whichPhases[c.which++ % 2], n);
      case 'recipe1': return recipe(rand, 1, n);
      case 'recipe2': return recipe(rand, 2, n);
      case 'recipe': return recipe(rand, rand.chance(0.5) ? 1 : 2, n);
      case 'order': return order(rand, orders[c.order++ % orders.length], n);
      case 'fact': return fact(rand, facts[c.fact++ % facts.length], n);
      case 'diagnose': return diagnose(rand, verdicts[c.diag++ % verdicts.length], n);
      case 'pair': return pair(rand, n);
      case 'gap': return gap(rand, gaps[c.gap++ % gaps.length], n);
      case 'build': return build(rand, nets[c.build++ % nets.length], n);
      case 'spot': return spot(rand, spots[c.spot++ % spots.length], n);
      case 'number': return number(rand, nums[c.num++ % nums.length], n);
      case 'shape': return shape(rand, n);
      default: throw new Error(`forger: unknown item type ${type}`);
    }
  });
}

/* ── small helpers the stages share (pure) ─────────────────────────────── */
export const fmt = (v, d = 3) => (Number.isFinite(v) ? v.toFixed(d) : '—');
export const fmtChange = (v) => (v === 0 ? '0' : v < 1e-4 ? v.toExponential(1) : v.toFixed(4));
export const loopLines = () => LOOP.lines;
export const dcganNet = (net) => DCGAN[net];
