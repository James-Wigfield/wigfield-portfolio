# Brief: slide reader (one per lecture deck)

You are extracting, from ONE lecture deck of CITS5017 Deep Learning, everything a set of exam-revision mini games
will need: the drillable concepts, every equation (in the slides' own notation), every number printed on a slide
that a function could reproduce, the facts that make good quiz answers and distractors, the code the slides print,
and the quirks (where the slides disagree with each other, with Keras, or with the transcript).

The master brief for the whole project is `Documents/temp/prompt-dumping/build_dl_arcade.md` (read the sections
"What you're building", "Reading the slides", "The games" and "Accuracy protocol"). Your output is consumed by
game builders and by accuracy checkers who will compare every claim against the PDF, so precision and exact slide
numbers matter more than volume.

## Sources of truth (nothing else)
1. The lecture PDF: `Documents/cits5017/lectures/<deck>.pdf`. Text: `pdftotext -layout -f N -l N <pdf> -`.
   Figures and anything with maths that pdftotext mangles (Greek letters and operators are often dropped):
   `pdftoppm -png -r 90 -f N -l N <pdf> <scratch>/slide` then look at the PNG with the Read tool.
   Render every equation slide and every figure-led slide; do not trust the text layer for equations.
2. The markdown transcript `Documents/cits5017/markdown-lecs/lecture-N.md` (slide by slide, with figure
   descriptions and a "Quirks" section). Lecture 3's transcript stops at slide 16: use the PDF for the rest.
The textbook, the internet, your memory and the existing study modules are NOT sources. If you know something is
true but the slides do not say it, either leave it out or include it with `beyond: true`.

## Output: ONE file, `src/components/portal/modules/deep-learning/arcade/content/lecture<N>.js`
(lecture67.js for the shared Lectures 6–7 deck). Pure data, ES module, no imports, no functions, no React.
Every item carries `src: { lecture: N, slides: [..] }` (lecture 6 for the 6–7 deck; integers; the exact slides
where the claim is made, not a range of the whole section). Use this schema exactly:

```js
export const LECTURE = 4;                    // 6 for the 6–7 deck
export const TITLE = 'Processing sequences using RNNs and CNNs';   // the deck's title as printed
export const SLIDE_COUNT = 52;

// Drillable concepts. Ids are namespaced by TOPIC (not lecture) so games across lectures share them:
//   params.<layer>  parameter counts (params.dense, params.conv2d, params.convT, params.bn, params.simpleRnn,
//                   params.lstm, params.gru, params.conv1d, params.tied, params.mha, params.pool)
//   shape.<layer>   output shapes (shape.conv2d, shape.pool, shape.convT, shape.conv1d)
//   then topic prefixes: perceptron. mlp. backprop. loss. act. init. bn. clip. transfer. optim. sched. reg.
//   cnn. pool. arch. rnn. lstm. gru. forecast. conv1d. ae. pca. tied. pretrain. vae. gan. dcgan. convae.
//   denoise. attn. transformer. posenc. vit. encdec.
// Only concepts the slides actually teach. `hard` = 1–3 (3 = the things students get wrong in exams).
export const CONCEPTS = [
  { id: 'gru.update', lecture: 4, title: 'GRU update (z) and reset (r) gates', slides: [48, 49], hard: 3,
    summary: 'one sentence in the slides’ words' },
];

// Equations exactly as the slides typeset them (KaTeX), with the slides' symbols. `read` = plain words.
// `vars` lists each hyperparameter the slide names, with the default/typical value THE SLIDE gives (or omit).
export const EQUATIONS = {
  momentum: {
    tex: ['\\mathbf{m} \\leftarrow \\beta \\mathbf{m} - \\eta \\nabla_\\theta J(\\theta)', '\\theta \\leftarrow \\theta + \\mathbf{m}'],
    read: 'the gradient is an acceleration, not a speed',
    vars: { beta: { sym: '\\beta', value: 0.9, note: 'usually set to 0.9' } },
    src: { lecture: 2, slides: [34] },
  },
};

// Numbers printed on slides that a function can reproduce (parameter counts, output shapes, accuracies the code
// prints, sizes like 16×16×3 = 768). These become unit-test anchors. `code` = the printed Keras code that
// produced the number, verbatim where it is short. `how` = the arithmetic in words if the slide shows it.
export const ANCHORS = [
  { id: 'l4.gru.1401', what: 'GRU(20) on univariate input + Dense(1): total params', value: 1401,
    code: 'tf.keras.layers.GRU(20, input_shape=[None, 1]) + Dense(1)', how: '3·(1·20 + 20·20 + 2·20) + 21',
    src: { lecture: 4, slides: [49] } },
];

// Facts: short true statements in the slides' words, each tied to a concept. These are the raw material for
// choice questions, "why" cards and distractors. Keep each under ~25 words. Include the WRONG-looking facts
// students confuse (e.g. "f uses σ, g uses tanh") as separate facts so distractors can be built from them.
export const FACTS = [
  { id: 'l4.lstm.gates.act', concept: 'lstm.gates', text: 'The gates i, f and o use the logistic (sigmoid) activation; g uses tanh.',
    src: { lecture: 4, slides: [47] } },
];

// Code printed on the slides that a game may quote (verbatim; keep short, trim comments if long).
export const CODE = [
  { id: 'l4.gru.model', lang: 'python', text: 'model = tf.keras.Sequential([\n  tf.keras.layers.GRU(20, input_shape=[None, 1]),\n  tf.keras.layers.Dense(1)\n])', src: { lecture: 4, slides: [49] } },
];

// Quirks: anything a checker must know — slides disagreeing with each other, with Keras defaults, typos in the
// slide, a figure that contradicts the text, the transcript's own Quirks entries (re-verified against the PDF).
export const QUIRKS = [
  { id: 'l4.gru.bias', text: 'Slide 49’s GRU equations have one bias per block, but the 1,401 printed uses Keras’s reset_after=True (two biases per block).', src: { lecture: 4, slides: [49] } },
];
```

Rules
- Read every slide of your deck, in order. Render the figure-led and equation slides to PNG and look at them.
- Prefer many small FACTS with exact slides over long summaries. Equations: every one the deck prints.
- Keep the slides' notation: row vectors in Lecture 4 (xᵀW), γ = log σ² in Lectures 6–7, Bahdanau / Luong names
  in Lecture 8, θ / η / J(θ) / m / s / ⊗ / ⊘ / ε in Lecture 2's optimisers, and so on. Write KaTeX for the
  equations (escape backslashes for JS strings).
- Default values: only the ones the slides state, with the slide.
- When the transcript's Quirks section says something, re-check it on the PDF and record the verdict in QUIRKS.
- Anything you add that the slides don't say gets `beyond: true` on the item and a `note` saying why it's there.
  Keep those rare.
- Do not write anything else in the repo. Scratch renders go in your scratchpad directory (the system prompt
  names it), never in the repo.
- Lint: the file must be valid ES2020. Run `node --input-type=module -e "import('<abs path>').then(m => console.log(Object.keys(m), m.CONCEPTS.length, m.FACTS.length, m.ANCHORS.length))"` before you finish. Also run
  `npx eslint <file>` from the repo root and fix anything it reports.

## What to report back (short)
- Counts: concepts, equations, anchors, facts, code blocks, quirks.
- The 5–10 hardest concepts in this deck (for the games to weight), each with its slides.
- Any slide you could not read, and any place where the PDF and the transcript disagree.
