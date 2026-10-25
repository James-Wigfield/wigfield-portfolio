import { softmax, sigmoid } from '../../maths/softmax.js';

/* ============================================================================
   TOPIC 3 · THE EXAM DRILL: SOFTMAX
   ----------------------------------------------------------------------------
   make(seed) — one of five question kinds, seeded:
     probs     three logits → each probability to 2 decimal places (verify
               items let verify_counts.py check them against tf.nn.softmax)
     rise      one score goes up: what happens to the outputs?
     which     a scenario → softmax, one sigmoid, a sigmoid per label, none
     rows      attention shapes: Q, K → the softmax matrix and its row sums
     shift     every score + c: what happens?
   FIXED = questions from the unit, with receipts.
   ========================================================================== */

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = (r, xs) => xs[Math.floor(r() * xs.length)];
const r2 = (v) => Math.round(v * 100) / 100;
const f3 = (v) => v.toFixed(3);

function probs(seed, r) {
  const z = [pick(r, [3, 2, 2.5, 1.5, 4]), pick(r, [1, 0.5, 1.2, 2, 0]), pick(r, [0, -1, 0.1, 0.5, -0.5])];
  const p = softmax(z);
  const e = z.map((v) => Math.exp(v));
  const s = e.reduce((a, b) => a + b, 0);
  return {
    id: `p${seed}`,
    prov: '{own}',
    prompt: `An output layer’s three scores (logits) are $z = (${z.join(', ')})$. Give the softmax probability of each class to 2 decimal places.`,
    fields: z.map((v, k) => ({ key: `p${k}`, label: `$\\hat{p}_${k + 1}$ (score ${v})`, answer: r2(p[k]), type: 'number', tol: 0.011, placeholder: '0.00' })),
    working: [
      `Exponentiate: $e^{z} = (${e.map(f3).join(', ')})$.`,
      `Add them up: $${e.map(f3).join(' + ')} = ${f3(s)}$.`,
      `Divide each by the total: $\\hat{p} = (${p.map(f3).join(', ')})$; they add up to 1 {beyond}.`,
    ],
    verify: { kind: 'softmax', z, p },
  };
}

function rise(seed, r) {
  const k = 1 + Math.floor(r() * 3);
  return {
    id: `r${seed}`,
    prov: '{own}',
    prompt: `A softmax output layer has three classes. The score of class ${k} goes up by 1 and the other scores stay the same. What happens to the three probabilities?`,
    fields: [{
      key: 'c',
      label: 'The probabilities',
      type: 'choice',
      answer: 'kup',
      options: [
        { value: 'kup', label: `class ${k}’s goes up, the other two go down` },
        { value: 'allup', label: 'all three go up' },
        { value: 'konly', label: `only class ${k}’s changes` },
        { value: 'none', label: 'nothing changes' },
      ],
    }],
    working: [
      `They must still add up to 1 {s|L1 · slide 29}: if class ${k}’s share grows, the others must shrink.`,
      `Its exponential grows by a factor $e^1 \\approx 2.718$ while the others stay put, so the total grows and every other share falls {beyond}.`,
    ],
  };
}

const SCENARIOS = [
  { s: 'Classify a Fashion MNIST image as one of 10 clothing items.', a: 'softmax', why: 'One class out of 10: softmax over 10 outputs {s|L1 · slides 29, 35}.' },
  { s: 'Decide whether an email is spam or not.', a: 'sigmoid1', why: 'Binary: “one single output neuron with a logistic activation function” {s|L1 · slide 29}.' },
  { s: 'Tag a photo with every object that appears in it (cat, dog, car, tree).', a: 'sigmoidN', why: 'Multilabel: one logistic output per label; several can be on at once {s|L1 · slide 29}.' },
  { s: 'CartPole: choose to push the cart left or right.', a: 'sigmoid1', why: 'Two actions, one sigmoid output: the probability of left; right gets $1 - p$ {s|L9 · slide 25}.' },
  { s: 'Predict tomorrow’s rail ridership.', a: 'none', why: 'Regression: “the output neurons usually do not need an activation function” {s|L1 · slide 24}.' },
  { s: 'Pick the next Spanish word from the target vocabulary.', a: 'softmax', why: '`Dense(vocab_size, activation="softmax")` {s|L8 · slide 26}.' },
  { s: 'Decide whether a sequence of four noisy vertices runs clockwise (1) or anticlockwise (0).', a: 'sigmoid1', why: 'Binary labels 1 and 0 {s|Lab Sheet 4}: one sigmoid output {s|L1 · slide 29}.' },
  { s: 'Classify a wine as one of 3 cultivars.', a: 'softmax', why: 'One class out of 3 {s|Lab Sheet 3}: softmax {s|L1 · slide 29}.' },
];
const WHICH_OPTS = [
  { value: 'softmax', label: 'softmax over one output per class' },
  { value: 'sigmoid1', label: 'one output with a sigmoid' },
  { value: 'sigmoidN', label: 'one sigmoid output per label' },
  { value: 'none', label: 'no activation (a regression output)' },
];

function which(seed, r) {
  const sc = pick(r, SCENARIOS);
  return {
    id: `w${seed}`,
    prov: '{own}',
    prompt: `${sc.s} What should the output layer be?`,
    fields: [{ key: 'c', label: 'Output layer', type: 'choice', answer: sc.a, options: WHICH_OPTS }],
    working: [sc.why],
  };
}

function rows(seed, r) {
  const nq = pick(r, [2, 3, 4, 5, 10]);
  const nk = pick(r, [3, 4, 6, 8, 12]);
  const d = pick(r, [16, 32, 64]);
  return {
    id: `a${seed}`,
    prov: '{own}',
    prompt: `In scaled dot-product attention, $\\mathbf{Q}$ has shape $[${nq}, ${d}]$ and $\\mathbf{K}$ has shape $[${nk}, ${d}]$. What shape is $\\text{softmax}(\\mathbf{Q}\\mathbf{K}^\\top / \\sqrt{${d}})$, and what does each of its rows add up to?`,
    fields: [
      { key: 'rows', label: 'rows', type: 'number', answer: nq },
      { key: 'cols', label: 'columns', type: 'number', answer: nk },
      { key: 'sum', label: 'each row adds up to', type: 'number', answer: 1 },
    ],
    working: [
      `$\\mathbf{Q}\\mathbf{K}^\\top$ is $[n_{\\text{queries}}, n_{\\text{keys}}] = [${nq}, ${nk}]$: one score per query/key pair {s|L8 · slide 38}.`,
      `The softmax keeps that shape, “but the numbers for each row add up to 1” {s|L8 · slide 38}: it runs along each row, once per query.`,
      `Dividing by $\\sqrt{${d}} = ${Math.sqrt(d).toFixed(Number.isInteger(Math.sqrt(d)) ? 0 : 2)}$ only scales the scores {s|L8 · slide 37}.`,
    ],
  };
}

function shift(seed, r) {
  const c = pick(r, [5, 10, -3, 100]);
  const z = [2, 1, 0.1];
  return {
    id: `s${seed}`,
    prov: '{own}',
    prompt: `The scores $z = (2, 1, 0.1)$ give $\\hat{p} = (0.66, 0.24, 0.10)$. If ${c > 0 ? `${c} is added to` : `${-c} is subtracted from`} every score, what happens to the probabilities?`,
    fields: [{
      key: 'c',
      label: 'The probabilities',
      type: 'choice',
      answer: 'same',
      options: [
        { value: 'same', label: 'they stay exactly the same' },
        { value: 'flat', label: 'they become more equal' },
        { value: 'sharp', label: 'the biggest one grows' },
        { value: 'scale', label: 'they all change by the same factor' },
      ],
    }],
    working: [
      `$\\exp(z_k + c) = e^{c} \\exp(z_k)$: the factor $e^{c}$ appears in every term, top and bottom, and cancels {beyond}.`,
      'Multiplying the scores (as $\\sqrt{d_{\\text{keys}}}$ does, by dividing) is different: that does change the probabilities {s|L8 · slide 38}.',
    ],
    verify: { kind: 'softmax', z: z.map((v) => v + c), p: softmax(z) },
  };
}

export function make(seed) {
  const r = rng(seed);
  const kind = pick(r, ['probs', 'probs', 'rise', 'which', 'which', 'rows', 'shift']);
  return { probs, rise, which, rows, shift }[kind](seed, r);
}

/* ── from the unit ─────────────────────────────────────────────────────── */
const P40 = [0, 0, 0, 0, 0, 0.18, 0, 0.01, 0, 0.8];

export const FIXED = [
  {
    id: 'u-l1s40',
    title: 'From the unit · L1 slide 40',
    prov: '{s|L1 · slide 40}',
    prompt: `Slide 40’s first row of \`y_proba.round(2)\` is $(${P40.join(', ')})$ for classes 0 to 9. Which class does \`argmax(axis=-1)\` pick, and how much do the printed numbers add up to?`,
    fields: [
      { key: 'c', label: 'class', type: 'number', answer: 9 },
      { key: 's', label: 'printed row sum', type: 'number', answer: 0.99, tol: 0.001 },
    ],
    working: [
      'The tallest probability is 0.8, at index 9 (“Ankle boot”): `array([9, 2, 1])` {s|L1 · slide 40}.',
      'Rounded to 2 places the row adds up to 0.99, not 1: rounding, not a broken softmax (the slide doesn’t say so) {own}.',
    ],
  },
  {
    id: 'u-sample',
    title: 'From the unit · sample Q1(c)',
    prov: '{s|Sample Q1(c)}',
    prompt: 'The sample paper’s network ends `Dense(3, activation="softmax")`. What kind of problem does that output layer suit?',
    fields: [{
      key: 'c',
      label: 'Problem',
      type: 'choice',
      answer: 'multi',
      options: [
        { value: 'multi', label: 'multiclass: one of 3 classes' },
        { value: 'multilabel', label: 'multilabel: any of 3 labels' },
        { value: 'binary', label: 'binary' },
        { value: 'reg', label: 'regression of 3 numbers' },
      ],
    }],
    working: ['Three softmax outputs are three probabilities that add up to 1: one class out of three, mutually exclusive {s|L1 · slide 29}.'],
  },
  {
    id: 'u-l8s25',
    title: 'From the unit · L8 slide 25',
    prov: '{s|L8 · slide 25}',
    prompt: 'Three encoder outputs get scores $e_{(t,i)} = (1, 2, 0)$. Give the attention weight $\\alpha_{(t,1)}$ on the middle one (the score 2), to 2 decimal places.',
    fields: [{ key: 'a', label: '$\\alpha_{(t,1)}$', type: 'number', answer: r2(softmax([1, 2, 0])[1]), tol: 0.011 }],
    working: [
      '$\\alpha_{(t,i)} = \\exp(e_{(t,i)}) / \\sum_{i\'} \\exp(e_{(t,i\')})$ {s|L8 · slide 25}.',
      `$e^{2} / (e^{1} + e^{2} + e^{0}) = ${f3(Math.exp(2))} / ${f3(Math.exp(1) + Math.exp(2) + 1)} = ${f3(softmax([1, 2, 0])[1])}$ {own}.`,
    ],
    verify: { kind: 'softmax', z: [1, 2, 0], p: softmax([1, 2, 0]) },
  },
  {
    id: 'u-l9s25',
    title: 'From the unit · L9 slide 25',
    prov: '{s|L9 · slides 23, 25}',
    prompt: `CartPole’s policy network outputs one number through a sigmoid. If the output layer’s score is 0.4, what is the probability of pushing right?`,
    fields: [{ key: 'p', label: 'P(right)', type: 'number', answer: r2(1 - sigmoid(0.4)), tol: 0.011 }],
    working: [
      `The one output is the probability of action 0 (left) {s|L9 · slide 23}: $\\sigma(0.4) = 1/(1 + e^{-0.4}) = ${f3(sigmoid(0.4))}$ {s|L1 · slide 20}.`,
      `Right gets the rest: $1 - ${f3(sigmoid(0.4))} = ${f3(1 - sigmoid(0.4))}$ (the slide never writes $1 - p$) {own}.`,
    ],
  },
  {
    id: 'u-l8s38',
    title: 'From the unit · L8 slide 38',
    prov: '{s|L8 · slide 38}',
    prompt: 'Why are the similarity scores in scaled dot-product attention divided by $\\sqrt{d_{\\text{keys}}}$?',
    fields: [{
      key: 'c',
      label: 'Because',
      type: 'choice',
      answer: 'sat',
      options: [
        { value: 'sat', label: 'big scores would saturate the softmax, giving tiny gradients' },
        { value: 'sum', label: 'otherwise the rows wouldn’t add up to 1' },
        { value: 'shape', label: 'to make the shapes match' },
        { value: 'neg', label: 'to keep the scores positive' },
      ],
    }],
    working: ['“to avoid saturating the softmax function, which would lead to tiny gradients” {s|L8 · slide 38}. The rows add up to 1 whatever the scale.'],
  },
];
