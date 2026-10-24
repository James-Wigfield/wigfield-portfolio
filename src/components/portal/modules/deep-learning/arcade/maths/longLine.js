/* ============================================================================
   THE LONG SHORT-TERM LINE — MATHS + ROUND GENERATOR (pure, seeded)
   ----------------------------------------------------------------------------
   The cell maths is lecture4-study/rnn.js (imported, never edited): rnnStep
   (slide 9), lstmStep (slide 47), gruStep (slide 49), all in the slides'
   row-vector notation. This file wires the game's toy cell into them:

     one unit, one input; a lever drives its gate controller through the
     bias (open = +6, closed = −6) with that controller's weights at 0, so
     a gate is σ(±6) = 0.998 / 0.002; the main layer g reads the platform
     crate x(t) (content/long-line.js TOY).

     lstmStation(prev, x, levers) / gruStation / rnnStation   one time step
     stationOut(model, prev, x, levers)    → { c, h } (GRU: c = h, one state)
     sensitivity / caredGates              which gates change the outcome
                                           at this station (the others are
                                           "any": the equations ignore them)
     gradeGates(item, given)               every gate that matters matches
     makeItems(rand, level)                the round:
        level 1  SimpleRNN: the slides' statements + one step of slide 9,
                 over an unrolled run whose first crate fades
        level 2  LSTM stations (set f, i, o) + signal-stop questions
        level 3  GRU stations (set z, r) + signal-stop questions
     lstmMaths / gruMaths / fadeMaths      the drawer's lines (KaTeX)
   ========================================================================== */
import { rnnStep, lstmStep, gruStep, sigmoid, tanh } from '../../lecture4-study/rnn.js';
import { TOY, CARDS, QUESTIONS, CHOICE_SETS, STEP, GATES } from '../content/long-line.js';

export const GATE_KEYS = { lstm: ['f', 'i', 'o'], gru: ['z', 'r'] };
// a gate "matters" at a station when flipping it alone moves c(t) or h(t)
// by more than CARE; the generator keeps every gate either well under
// FLAT or well over CLEAR, so the line between them is never close
export const CARE = 0.05;
export const FLAT = 0.01;
export const CLEAR = 0.15;

const M1 = (v) => [[v]];
export const leverBias = (on) => (on ? TOY.lever : -TOY.lever);
export const gateValue = (on) => sigmoid(leverBias(on));
export const zeroLevers = (model) => Object.fromEntries(GATE_KEYS[model].map((k) => [k, 0]));

/* ── one station = one time step ─────────────────────────────────────── */
export function lstmWeights(lv) {
  return {
    Wxi: M1(0), Whi: M1(0), bi: [leverBias(lv.i)],
    Wxf: M1(0), Whf: M1(0), bf: [leverBias(lv.f)],
    Wxo: M1(0), Who: M1(0), bo: [leverBias(lv.o)],
    Wxg: M1(TOY.lstm.Wxg), Whg: M1(TOY.lstm.Whg), bg: [TOY.lstm.bg],
  };
}

// slide 47 through lstmStep: prev = { c, h } (the long- and short-term states)
export function lstmStation(prev, x, lv) {
  const s = lstmStep([x], [prev.h], [prev.c], lstmWeights(lv));
  return {
    f: s.f[0], i: s.i[0], o: s.o[0], g: s.g[0],
    keep: s.keep[0], add: s.add[0], c: s.c[0], tc: s.tc[0], h: s.h[0],
    pre: { f: s.pre.f[0], i: s.pre.i[0], o: s.pre.o[0], g: s.pre.g[0] },
  };
}

export function gruWeights(lv) {
  return {
    Wxz: M1(0), Whz: M1(0), bz: [leverBias(lv.z)],
    Wxr: M1(0), Whr: M1(0), br: [leverBias(lv.r)],
    Wxg: M1(TOY.gru.Wxg), Whg: M1(TOY.gru.Whg), bg: [TOY.gru.bg],
  };
}

// slide 49 through gruStep: prev = { h } (one merged state)
export function gruStation(prev, x, lv) {
  const s = gruStep([x], [prev.h], gruWeights(lv));
  return {
    z: s.z[0], r: s.r[0], rh: s.rh[0], g: s.g[0], keep: s.keep[0], add: s.add[0], h: s.h[0],
    pre: { z: s.pre.z[0], r: s.pre.r[0], g: s.pre.g[0] },
  };
}

// slide 9 through rnnStep: h(t) = φ_h(h(t−1) W_h + x(t) W_x + b_h)
export function rnnStation(hPrev, x, p = TOY.rnn) {
  const s = rnnStep([hPrev], [x], { Wh: M1(p.Wh), Wx: M1(p.Wx), bh: [p.bh], phi: p.phi ?? 'tanh' });
  return { a: s.a[0], h: s.h[0] };
}

export function stationOut(model, prev, x, lv) {
  if (model === 'lstm') {
    const s = lstmStation(prev, x, lv);
    return { c: s.c, h: s.h };
  }
  const s = gruStation(prev, x, lv);
  return { c: s.h, h: s.h };
}

const dist = (a, b) => Math.max(Math.abs(a.c - b.c), Math.abs(a.h - b.h));

// how far flipping each gate alone (the rest as in `answer`) moves the outcome
export function sensitivity(model, prev, x, answer) {
  const base = stationOut(model, prev, x, answer);
  return Object.fromEntries(GATE_KEYS[model].map((k) => [k, dist(stationOut(model, prev, x, { ...answer, [k]: answer[k] ? 0 : 1 }), base)]));
}

export function caredGates(model, prev, x, answer) {
  const s = sensitivity(model, prev, x, answer);
  return GATE_KEYS[model].filter((k) => s[k] > CARE);
}

// every gate that matters at this station must match the card's setting
export function gradeGates(item, given) {
  if (!given || typeof given !== 'object') return false;
  return item.care.every((k) => Number(given[k]) === item.answer[k]);
}

/* ── formatting ──────────────────────────────────────────────────────── */
export const f2 = (v) => `${v < 0 ? '−' : ''}${Math.abs(v).toFixed(2)}`;
export const f3 = (v) => `${v < 0 ? '−' : ''}${Math.abs(v).toFixed(3)}`;
const t3 = (v) => `${v < 0 ? '-' : ''}${Math.abs(v).toFixed(3)}`; // inside KaTeX
const t2 = (v) => `${v < 0 ? '-' : ''}${Math.abs(v).toFixed(2)}`;
const tn = (v) => `${v < 0 ? '-' : ''}${Number(Math.abs(v).toFixed(3))}`; // short constants: 0.5, 1, 1.5
const bias = (on) => (on ? `+${TOY.lever}` : `-${TOY.lever}`);

export function fmtGates(model, v, care = null) {
  if (!v || typeof v !== 'object') return '—';
  return GATE_KEYS[model].map((k) => `${k} = ${care && !care.includes(k) ? 'any' : Number(v[k]) ? 1 : 0}`).join(' · ');
}

/* ── the drawer's lines (KaTeX), for the current levers ──────────────── */
// one aligned block: each line's first "=" becomes the alignment point
export const aligned = (lines) => `\\begin{aligned}${lines.map((l) => l.replace('=', '&=')).join(' \\\\ ')}\\end{aligned}`;

export function lstmMaths(prev, x, lv) {
  const s = lstmStation(prev, x, lv);
  const gate = (k) => `\\mathbf{${k}}_{(t)} = \\sigma\\left(${tn(x)} \\cdot 0 + ${t3(prev.h)} \\cdot 0 ${bias(lv[k])}\\right) = ${t3(s[k])}`;
  return [
    gate('i'),
    gate('f'),
    gate('o'),
    `\\mathbf{g}_{(t)} = \\tanh\\left(${tn(x)} \\cdot ${tn(TOY.lstm.Wxg)} + ${t3(prev.h)} \\cdot ${tn(TOY.lstm.Whg)} + ${tn(TOY.lstm.bg)}\\right) = ${t3(s.g)}`,
    `\\mathbf{c}_{(t)} = ${t3(s.f)} \\otimes ${t3(prev.c)} + ${t3(s.i)} \\otimes ${t3(s.g)} = ${t3(s.c)}`,
    `\\mathbf{y}_{(t)} = \\mathbf{h}_{(t)} = ${t3(s.o)} \\otimes \\tanh(${t3(s.c)}) = ${t3(s.h)}`,
  ];
}

export function gruMaths(prev, x, lv) {
  const s = gruStation(prev, x, lv);
  const gate = (k) => `\\mathbf{${k}}_{(t)} = \\sigma\\left(${tn(x)} \\cdot 0 + ${t3(prev.h)} \\cdot 0 ${bias(lv[k])}\\right) = ${t3(s[k])}`;
  return [
    gate('z'),
    gate('r'),
    `\\mathbf{g}_{(t)} = \\tanh\\left(${tn(x)} \\cdot ${tn(TOY.gru.Wxg)} + ${t3(s.r)} \\cdot ${tn(TOY.gru.Whg)} \\otimes ${t3(prev.h)} + ${tn(TOY.gru.bg)}\\right) = ${t3(s.g)}`,
    `\\mathbf{h}_{(t)} = ${t3(s.z)} \\otimes ${t3(prev.h)} + (1 - ${t3(s.z)}) \\otimes ${t3(s.g)} = ${t3(s.h)}`,
  ];
}

export function fadeMaths(run) {
  const p = TOY.rnn;
  return run.xs.map((x, k) => {
    const hp = k === 0 ? 0 : run.h[k - 1];
    return `\\mathbf{h}_{(${k + 1})} = \\tanh\\left(${t3(hp)} \\cdot ${tn(p.Wh)} + ${tn(x)} \\cdot ${tn(p.Wx)} + ${tn(p.bh)}\\right) = ${t3(run.h[k])}`;
  });
}

/* ── the level-1 fade run: the first crate's trace through the frames ── */
export function fadeRun(rand) {
  const xs = [TOY.fadeFirst, ...Array.from({ length: TOY.fadeSteps - 1 }, () => rand.pick(TOY.fadeLater))];
  const run = (seq) => {
    let h = 0; // h(0) is usually a zero vector (slide 10)
    return seq.map((x) => (h = rnnStation(h, x).h));
  };
  const h = run(xs);
  const without = run([0, ...xs.slice(1)]);
  return { xs, h, trace: h.map((v, k) => v - without[k]) };
}

/* ── item builders ───────────────────────────────────────────────────── */
let counter = 0;
const nid = (level, key) => `ll${level}-${++counter}-${key}`;

function choiceSet(q) {
  return typeof q.choices === 'string' ? CHOICE_SETS[q.choices] : q.choices;
}

function choiceItem(level, q, rand, extra = {}) {
  const choices = q.id === 'unrolled' ? choiceSet(q) : rand.shuffle(choiceSet(q));
  const item = {
    id: nid(level, q.id),
    type: 'quiz',
    qid: q.id,
    kind: 'choice',
    concept: q.concept,
    src: q.src,
    prompt: q.prompt,
    promptText: q.prompt,
    picture: q.picture ?? null,
    drawer: !!q.drawer,
    choices: choices.map((c) => ({ value: c.value, label: c.label, aria: c.aria })),
    answer: q.answer,
    why: q.why,
    ...extra,
  };
  item.format = (v) => item.choices.find((c) => c.value === v)?.aria ?? String(v);
  return item;
}

const STEP_GAP = 0.05;

function stepItem(level, rand, hard) {
  // draw until the four slips give four different two-decimal numbers
  for (let tries = 0; tries < 40; tries++) {
    const p = { Wh: rand.pick(STEP.Wh), Wx: rand.pick(STEP.Wx), bh: hard ? rand.pick(STEP.bh) : 0, phi: 'tanh' };
    const hPrev = rand.pick(STEP.hPrev);
    const x = rand.pick(STEP.x);
    const s = rnnStation(hPrev, x, p);
    const vals = {
      right: s.h,
      noPhi: s.a,
      noH: tanh(x * p.Wx + p.bh),
      noX: tanh(hPrev * p.Wh + p.bh),
    };
    // four numbers at least 0.05 apart, so the step (not rounding) decides
    const sorted = Object.values(vals).slice().sort((u, w) => u - w);
    if (sorted.some((v, k) => k > 0 && v - sorted[k - 1] < STEP_GAP)) continue;
    const choices = rand.shuffle(Object.keys(vals)).map((k) => ({ value: k, label: f2(vals[k]), aria: `${f2(vals[k])}` }));
    const how = `\\mathbf{h}_{(t)} = \\tanh(${t2(hPrev)} \\times ${tn(p.Wh)} + ${t2(x)} \\times ${tn(p.Wx)} + ${tn(p.bh)}) = \\tanh(${t2(s.a)}) = ${t2(s.h)}`;
    const item = {
      id: nid(level, 'step'),
      type: 'quiz',
      qid: 'step',
      kind: 'choice',
      concept: STEP.concept,
      src: STEP.src,
      prompt: STEP.prompt,
      promptText: `${STEP.prompt} (h(t−1) = ${f2(hPrev)}, x(t) = ${f2(x)}, W_h = ${p.Wh}, W_x = ${p.Wx}, b_h = ${p.bh})`,
      picture: 'step',
      step: { hPrev, x, Wh: p.Wh, Wx: p.Wx, bh: p.bh, a: s.a, h: s.h },
      choices,
      answer: 'right',
      why: `${STEP.why} $${how}$. The other numbers: ${STEP.slips.noPhi} (${f2(vals.noPhi)}), ${STEP.slips.noH} (${f2(vals.noH)}), ${STEP.slips.noX} (${f2(vals.noX)}).`,
    };
    item.format = (v) => (v in vals ? f2(vals[v]) : String(v));
    return item;
  }
  throw new Error('stepItem: no distinct draw');
}

const fillDue = (text, due) => text.replace('{due}', String(due));

function stationItem(level, model, { t, cardKey, x, prev, due, total, hint }) {
  const card = CARDS[model][cardKey];
  const answer = { ...card.answer };
  const care = caredGates(model, prev, x, answer);
  const target = stationOut(model, prev, x, answer);
  const line = fillDue(card.line, due ?? '—');
  const item = {
    id: nid(level, `${model}-${cardKey}`),
    type: 'station',
    kind: 'custom',
    model,
    card: cardKey,
    concept: card.concept,
    src: card.src,
    t,
    total,
    due: due ?? null,
    x,
    prev: { ...prev },
    line,
    sub: card.sub,
    hint: !!hint,
    answer,
    care,
    target,
    why: card.why,
    promptText: `t = ${t} · ${line}`,
    beyond: false,
  };
  item.check = (given) => gradeGates(item, given);
  item.format = (v) => fmtGates(model, v, v === item.answer ? item.care : null);
  return item;
}

// a crate for this station such that every gate is either clearly
// irrelevant or clearly decisive (and the gates the card is about matter)
function pickCrate(rand, model, prev, cardKey, must) {
  const answer = CARDS[model][cardKey].answer;
  const ok = rand.shuffle(TOY.crates).filter((x) => {
    const s = sensitivity(model, prev, x, answer);
    const clean = GATE_KEYS[model].every((k) => s[k] < FLAT || s[k] > CLEAR);
    return clean && must.every((k) => s[k] > CLEAR);
  });
  return ok.length ? ok[0] : null;
}

// the gates each card is about (they must matter whenever the card is drawn)
const MUST = {
  lstm: { load: ['i', 'o'], keep: ['f', 'i', 'o'], topup: ['f', 'i', 'o'], deliver: ['f', 'i', 'o'], loadDeliver: ['f', 'i', 'o'], swap: ['f', 'i', 'o'], dump: ['f', 'i'] },
  gru: { load: ['z'], keep: ['z'], deliver: ['z'], replace: ['z', 'r'], blend: ['z', 'r'] },
};

/* Lay out a route: plan = card keys in order; legs end at a delivery. The
   cargo on board is the canonical state (every earlier station played as
   its card says), so each station is graded on its own. */
function buildRoute(level, model, rand, plan) {
  const stations = [];
  let prev = model === 'lstm' ? { c: 0, h: 0 } : { h: 0 };
  // due = the t of the next delivery at or after each station
  const deliverAt = plan.map((k, idx) => {
    for (let j = idx; j < plan.length; j++) if (plan[j] === 'deliver' || plan[j] === 'loadDeliver') return j + 1;
    return null;
  });
  for (let idx = 0; idx < plan.length; idx++) {
    let cardKey = plan[idx];
    let x = pickCrate(rand, model, prev, cardKey, MUST[model][cardKey]);
    if (x === null && model === 'gru' && (cardKey === 'blend' || cardKey === 'replace')) {
      cardKey = cardKey === 'blend' ? 'replace' : 'blend';
      x = pickCrate(rand, model, prev, cardKey, MUST[model][cardKey]);
    }
    if (x === null) {
      cardKey = 'keep';
      x = pickCrate(rand, model, prev, cardKey, MUST[model][cardKey]) ?? TOY.crates[0];
    }
    const it = stationItem(level, model, { t: idx + 1, cardKey, x, prev, due: deliverAt[idx], total: plan.length, hint: idx < 3 });
    stations.push(it);
    prev = model === 'lstm' ? { c: it.target.c, h: it.target.h } : { h: it.target.h };
  }
  return stations;
}

const pickQ = (rand, model, ids) => {
  const id = rand.pick(ids);
  return QUESTIONS[model].find((q) => q.id === id);
};

/* ── the rounds ──────────────────────────────────────────────────────── */
function level1(rand) {
  const L = 1;
  const run = fadeRun(rand);
  const q = (id, extra) => choiceItem(L, QUESTIONS.rnn.find((x) => x.id === id), rand, { run, ...extra });
  const side = rand.pick(['left', 'right']);
  const [a, b] = rand.shuffle(['allInputs', 'h0']);
  const late = rand.shuffle(['lost', 'tanh', 'relu']).slice(0, 2);
  const items = [
    q('unrolled', { answer: side, unrolledSide: side }),
    q('frame'),
    q('depends'),
    q(a),
    { ...stepItem(L, rand, false), run },
    q(rand.pick(['carry', 'shared'])),
    q('fade'),
    q(rand.pick(['bptt', b])),
    q(late[0]),
    q(late[1]),
    { ...stepItem(L, rand, true), run },
  ];
  return items;
}

function level2(rand) {
  const k1 = rand.int(2, 3);
  const plan = ['load', ...Array(k1).fill('keep'), 'deliver', 'swap', 'keep', 'topup', rand.chance(0.5) ? 'deliver' : 'loadDeliver', 'dump'];
  const st = buildRoute(2, 'lstm', rand, plan);
  const q1 = choiceItem(2, pickQ(rand, 'lstm', ['states', 'roleErase', 'roleAdd', 'roleRead']), rand);
  const q2 = choiceItem(2, pickQ(rand, 'lstm', ['act.f', 'act.i', 'act.o', 'act.g', 'straight']), rand);
  const q3 = choiceItem(2, pickQ(rand, 'lstm', ['cLine', 'yLine']), rand);
  const firstDeliver = st.findIndex((s) => s.card === 'deliver' || s.card === 'loadDeliver');
  // signal stops: after station 2, after the first delivery, before the last station
  const out = [...st.slice(0, 2), q1, ...st.slice(2, firstDeliver + 1), q2, ...st.slice(firstDeliver + 1, -1), q3, st[st.length - 1]];
  return out.map(stampStation(st));
}

function level3(rand) {
  const k1 = rand.int(2, 3);
  const plan = ['load', ...Array(k1).fill('keep'), 'deliver', 'replace', 'keep', 'blend', 'deliver'];
  const st = buildRoute(3, 'gru', rand, plan);
  const q1 = choiceItem(3, pickQ(rand, 'gru', ['merged', 'oneCtrl', 'noOut']), rand);
  const q2 = choiceItem(3, pickQ(rand, 'gru', ['act.z', 'act.r', 'act.gg', 'zOne']), rand);
  const q3 = choiceItem(3, pickQ(rand, 'gru', ['zMult', 'rWhere']), rand);
  const firstDeliver = st.findIndex((s) => s.card === 'deliver');
  const out = [...st.slice(0, 2), q1, ...st.slice(2, firstDeliver + 1), q2, ...st.slice(firstDeliver + 1, -1), q3, st[st.length - 1]];
  return out.map(stampStation(st));
}

// a signal stop sits before the next station on the strip
function stampStation(stations) {
  return (it, idx, all) => {
    if (it.type === 'station') return it;
    const nextStation = all.slice(idx + 1).find((s) => s.type === 'station');
    return { ...it, model: stations[0].model, t: nextStation ? nextStation.t : stations.length, total: stations.length, format: it.format };
  };
}

export function makeItems(rand, level = 1) {
  counter = 0;
  if (level <= 1) return level1(rand);
  if (level === 2) return level2(rand);
  return level3(rand);
}

// the route strip: the stations of a round, in order
export function routeOf(items) {
  return items.filter((it) => it.type === 'station').map((it) => ({ t: it.t, card: it.card, due: it.due, c: it.target.c, h: it.target.h, id: it.id }));
}

// the cargo meter's full height: an LSTM's c(t) has no squashing of its own
// (slide 44) and can pass 1; a GRU's h(t) and a SimpleRNN's h(t) stay in (−1, 1)
export const SCALE = { lstm: 2.6, gru: 1, rnn: 1 };
export { GATES, TOY };
