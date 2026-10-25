/* ============================================================================
   TOPIC 3 · SOFTMAX  (topics/softmax/topic.js)
   ----------------------------------------------------------------------------
   What softmax does, the formula (printed only for attention weights, on L8
   slide 25), softmax vs sigmoid, cross-entropy and argmax, attention, and
   the last layer of a classifier or translator. Numbers come from
   ../../maths/softmax.js (checked against tf.nn.softmax by verify_counts.py).
   ========================================================================== */

export default {
  id: 'softmax',
  title: 'Softmax',
  lectures: ['L1', 'L3', 'L4', 'L8', 'L9'],
  oneLine: 'Softmax turns a list of scores into probabilities: every one positive, all of them summing to 1, the biggest score getting the biggest share.',
  printLead:
    'What softmax does, how to compute it by hand, when to use it instead of a sigmoid, how it pairs with cross-entropy and argmax, and why it turns up in attention and in the last layer of a classifier or a transformer. Labels: a slide receipt (“L8 · slide 25”) means the slide states it; “this page’s own · checked in TF” means this page computed it and checked it against TensorFlow; “beyond the slides” means true but not in the lecture notes.',
  hero: { lab: 'hero', caption: 'Four scores become four probabilities: exponentiate (all positive), add up, divide by the total, and the shares fill exactly 100%. Click to replay.' },
  showsUp: [
    { at: 'L1 · slide 29', what: 'Multiclass output layers: softmax ensures “all the output values are probabilities and they sum to 1”; cross-entropy loss.' },
    { at: 'L1 · slide 31', what: 'The output table: sigmoid for binary and multilabel, softmax for multiclass, “X-entropy” for all three.' },
    { at: 'L1 · slide 40', what: '`y_proba`: a row of 10 probabilities per image; `argmax(axis=-1)` gives `array([9, 2, 1])`.' },
    { at: 'L3 · slide 33', what: 'A CNN’s final layer: “a softmax layer that outputs estimated class probabilities”.' },
    { at: 'L3 · slide 49', what: 'ImageNet’s top-3 probabilities: palace 54.69%, monastery 24.72%, bell_cote 18.55%.' },
    { at: 'L4 · slide 9', what: 'The memory cell’s output activation: “softmax combined with cross-entropy” for multi-class problems.' },
    { at: 'L8 · slides 22–25', what: 'Attention weights: scores $e_{(t,i)}$ through softmax become $\\alpha_{(t,i)}$; slide 25 prints exp over the sum of exps.' },
    { at: 'L8 · slides 37–38', what: 'Scaled dot-product attention: softmax($\\mathbf{Q}\\mathbf{K}^\\top / \\sqrt{d_{\\text{keys}}}$); each row adds up to 1.' },
    { at: 'L8 · slide 41', what: 'The transformer’s top: Linear → Softmax → output probabilities over the vocabulary.' },
    { at: 'L9 · slide 25', what: 'CartPole’s policy uses one sigmoid output for its two actions, not a softmax.' },
  ],
  examAsks: [
    { form: 'Code', what: '`Dense(3, activation="softmax")`: for what problem would this network suit?', part: 'Sample Q1(c)' },
    { form: 'Diagram', what: 'A Bahdanau alignment model: write the equation for the attention weights $\\alpha_{(t,i)}$.', part: 'Practice A Q3(e)' },
    { form: 'Equation', what: 'Scaled dot-product attention: why divide by $\\sqrt{d_{\\text{keys}}}$; the shapes.', part: 'Practice A Q4(a)' },
    { form: 'Code', what: 'A policy network: why one sigmoid output is enough for two actions.', part: 'Practice A Q4(e)' },
    { form: 'Code', what: 'Transfer learning: why the new output layer is `Dense(1, activation="sigmoid")`.', part: 'Practice B Q1(d)' },
    { form: 'Scenario', what: 'A sequence classifier: its output layer and loss.', part: 'Practice B Q2(d)' },
  ],
  steps: [
    /* ── 1 ─────────────────────────────────────────────────────────────── */
    {
      id: 'what',
      title: 'What softmax does',
      short: 'What it does',
      prov: '{s|L1 · slides 29–30}',
      gist: 'Softmax turns any list of scores into probabilities: all positive, summing to 1, with the order kept.',
      read: [
        { list: [
          'Multiclass output layers use it: “This will ensure that all the output values are probabilities and they sum to 1” {s|L1 · slide 29}.',
          'It acts on the whole output layer at once, after the weighted sums: Figure 10-9 draws one Softmax box over all three outputs {s|L1 · slide 30}.',
          'The biggest score gets the biggest share and the order never changes, but a score twice as big does not get twice the share {beyond}.',
          'Every probability stays above 0: no class is ever ruled out completely {beyond}.',
        ] },
      ],
      play: ['shares'],
    },
    /* ── 2 ─────────────────────────────────────────────────────────────── */
    {
      id: 'formula',
      title: 'The formula, by hand',
      short: 'The formula',
      prov: '{s|L8 · slide 25} {beyond}',
      gist: 'Exponentiate every score, add them up, and divide each one by the total.',
      read: [
        { eq: {
          name: 'Softmax',
          tex: '\\hat{p}_k = \\frac{\\exp(z_k)}{\\sum_{j=1}^{K} \\exp(z_j)}',
          read: 'each exponentiated score as a share of the total',
          prov: 'Printed for attention weights, $\\alpha_{(t,i)} = \\exp(e_{(t,i)}) / \\sum_{i\'} \\exp(e_{(t,i\')})$ {s|L8 · slide 25}; as an output layer’s formula {beyond}',
        } },
        { list: [
          'By hand (the exam allows a calculator): $z = (2, 1, 0.1)$ gives $e^{z} = (7.389, 2.718, 1.105)$, total $11.213$, so $\\hat{p} = (0.659, 0.242, 0.099)$ {own}.',
          'Add the same number to every score and nothing changes: the extra factor $e^{c}$ cancels top and bottom {beyond}.',
          'Lecture 1 says what softmax does but never prints this formula {s|L1 · slide 29}.',
        ] },
      ],
      play: ['byhand'],
    },
    /* ── 3 ─────────────────────────────────────────────────────────────── */
    {
      id: 'vs',
      title: 'Softmax or sigmoid?',
      short: 'Softmax vs sigmoid',
      prov: '{s|L1 · slides 29, 31}',
      gist: 'One yes/no answer needs one sigmoid, several independent yes/no labels need a sigmoid each, and one class out of many needs softmax.',
      read: [
        { table: {
          head: ['Problem', 'Outputs', 'Activation', 'Sums to 1?'],
          rows: [
            ['Binary', '1', 'sigmoid (logistic)', 'one number $p$; the other class is $1 - p$ {own}'],
            ['Multilabel', '1 per label', 'a sigmoid each', 'no: every label is separate'],
            ['Multiclass', '1 per class', 'softmax', 'yes {s|L1 · slide 29}'],
          ],
        } },
        { list: [
          'All three train with cross-entropy (“X-entropy”) {s|L1 · slide 31}.',
          'CartPole has two actions but one `Dense(1, activation="sigmoid")` output: the probability of left {s|L9 · slides 23, 25}; right gets $1 - p$ {own}.',
          'A two-class softmax equals a sigmoid of the difference of the two scores {beyond}.',
        ] },
        { slideNote: 'Figure 18-5 (L9 slide 23) follows its one sigmoid output with “Multinomial sampling”: with two outcomes that is a two-way draw, left with probability $p$, right with $1 - p$. The slide never writes the $1 - p$, so it is this page’s own.' },
      ],
      play: ['vs'],
    },
    /* ── 4 ─────────────────────────────────────────────────────────────── */
    {
      id: 'loss',
      title: 'Softmax, cross-entropy and argmax',
      short: 'Cross-entropy · argmax',
      prov: '{s|L1 · slides 29, 37, 40}',
      gist: 'Training pushes up the true class’s probability (the loss is minus its log); at prediction time, argmax picks the class.',
      read: [
        { eq: {
          name: 'Cross-entropy',
          tex: 'J(\\boldsymbol{\\theta}) = -\\frac{1}{m}\\sum_{i=1}^{m}\\sum_{k=1}^{K} y_k^{(i)} \\log\\left(\\hat{p}_k^{(i)}\\right)',
          read: 'the average, over the m examples, of minus the log of the true class’s probability',
          prov: '{s|L1 · slide 29}',
        } },
        { list: [
          'With a one-hot $\\mathbf{y}$ only the true class $k$ survives: $-\\log \\hat{p}_k$. It is 0 when $\\hat{p}_k = 1$ and grows without limit as $\\hat{p}_k \\to 0$ {beyond}.',
          'Keras: `loss="sparse_categorical_crossentropy"` {s|L1 · slide 37}; “sparse” means integer class labels rather than one-hot {beyond}.',
          '`y_proba.argmax(axis=-1)` turns each row of probabilities into a class: `array([9, 2, 1])` {s|L1 · slide 40}. Lab Sheet 3’s pitfall: TensorFlow outputs probabilities, so use `np.argmax` {s|Lab Sheet 3}.',
        ] },
        { slideNote: 'L4 slide 9 lists “softmax combined with cross-entropy” as an activation function for $\\varphi_y$. Softmax is the activation; cross-entropy is the loss.' },
      ],
      play: ['loss'],
    },
    /* ── 5 ─────────────────────────────────────────────────────────────── */
    {
      id: 'attn',
      title: 'Softmax in attention',
      short: 'Attention',
      prov: '{s|L8 · slides 22–25, 37–38}',
      gist: 'Attention turns similarity scores into weights with softmax, so they are positive and sum to 1, then takes the weighted sum.',
      read: [
        { list: [
          'A one-neuron Dense layer scores each encoder output, $e_{(3,i)}$; “through the softmax layer, the three [scores] are then converted into probabilities”, the weights $\\alpha_{(3,i)}$ {s|L8 · slide 22}.',
          'The decoder then uses the weighted sum $\\widetilde{\\mathbf{h}}_{(t)} = \\sum_i \\alpha_{(t,i)}\\,\\mathbf{y}_{(i)}$ {s|L8 · slide 25}.',
          'Scaled dot-product attention: $\\text{softmax}(\\mathbf{Q}\\mathbf{K}^\\top / \\sqrt{d_{\\text{keys}}})\\,\\mathbf{V}$. The softmax output is $[n_{\\text{queries}}, n_{\\text{keys}}]$ and “the numbers for each row add up to 1” {s|L8 · slides 37–38}.',
          'Dividing by $\\sqrt{d_{\\text{keys}}}$ scales the scores down “to avoid saturating the softmax function, which would lead to tiny gradients” {s|L8 · slide 38}.',
        ] },
        { slideNote: 'Slide 38’s bullet says “The factor $1/d_{\\text{keys}}$”, with no square root, while the equation directly above it (and slide 37’s) divides by $\\sqrt{d_{\\text{keys}}}$. The equation is the one to learn.' },
      ],
      play: ['attn'],
    },
    /* ── 6 ─────────────────────────────────────────────────────────────── */
    {
      id: 'last',
      title: 'The last layer: classes or words',
      short: 'The last layer',
      prov: '{s|L3 · slide 33} {s|L8 · slides 26, 28, 41}',
      gist: 'A classifier’s last layer gives one probability per class, a translator’s one per word of the vocabulary; the prediction is the tallest bar.',
      read: [
        { list: [
          'A CNN: “the final layer outputs the prediction (e.g., a softmax layer that outputs estimated class probabilities)” {s|L3 · slide 33}; slide 35 ends `Dense(units=10, activation="softmax")` {s|L3 · slide 35}.',
          'Translation: `Dense(vocab_size, activation="softmax")`; “The length of the `Y_proba` array corresponds to the vocabulary size” {s|L8 · slides 26, 28}. The transformer ends Linear → Softmax → Output Probabilities {s|L8 · slide 41}.',
          'Softmax itself has nothing to learn: the vocabulary-sized Dense (“Linear”) layer under it holds the parameters ([parameter counts](@param-count)) {beyond}.',
          'For a dahlia photo the top 3 are vase 32.66%, daisy 17.81%, honeycomb 12.06%: dahlia isn’t one of the 1,000 classes {s|L3 · slide 49}, and softmax can only share probability among the classes it has {beyond}.',
        ] },
        { slideNote: 'Slide 41 says “The green softmax layer have many neurons (corresponding to the vocabulary size …)”. Those neurons belong to the Linear layer drawn under it; the softmax has none.' },
      ],
      play: ['last'],
    },
  ],
  drill: {
    lab: 'drill',
    title: 'Exam drill: softmax',
    short: 'Exam drill',
    prov: '{own}',
    blurb: 'Scores to probabilities by hand (two decimal places), which outputs move when one score rises, softmax or sigmoid for a scenario, and what an attention matrix’s rows add up to.',
  },
};
