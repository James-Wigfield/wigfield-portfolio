/* ============================================================================
   TOPIC 1 · PARAMETER COUNTS  (topics/param-count/topic.js)
   ----------------------------------------------------------------------------
   One method that works on any source (code, a diagram, a summary with gaps,
   a sentence, equations), then the rule for every layer type the unit uses.
   Every count here is either printed on the slide it cites ({s|…}) or this
   page's own ({own}: computed by ../../maths/paramRules.js and asserted in
   Keras by tools/dl-tricky-topics/verify_counts.py). Models: ../../maths/
   models.js. Schema and budgets: ../../ADDING-A-TOPIC.md.
   ========================================================================== */

export default {
  id: 'param-count',
  title: 'Parameter counts',
  lectures: ['L1', 'L2', 'L3', 'L4', 'L5', 'L6–7', 'L8', 'L9'],
  oneLine: 'A model’s parameters are the numbers it learns, its weights and biases, and you can count them layer by layer from the sizes flowing in.',
  printLead:
    'How to count the parameters of every kind of model in CITS5017, from any source: code, a diagram, a model.summary() with gaps, a sentence or a set of equations. One method, then one rule per layer type, each tied to the slide that shows it. Labels: a slide receipt (“L3 · slide 22”) means the slide prints it; “this page’s own · checked in TF” means this page computed it and checked it in TensorFlow; “beyond the slides” means true but not in the lecture notes.',
  hero: { lab: 'hero', caption: 'Three inputs meet four neurons: one weight per connection, one bias per neuron, (3 + 1) × 4 = 16. Click to replay.' },
  showsUp: [
    { at: 'L1 · slide 36', what: '`model.summary()` of the Fashion MNIST MLP: **266,610**; `weights.shape` (784, 300), `biases.shape` (300,).' },
    { at: 'L1 · slide 45', what: 'Wide & Deep: Normalization’s **17** non-trainable; `Concatenate` widens to (None, 38).' },
    { at: 'L2 · slide 27', what: 'BatchNormalization: **271,346** = 268,978 trainable + 2,368 non-trainable.' },
    { at: 'L3 · slide 22', what: '200 filters of 5 × 5 on RGB: (5 × 5 × 3 + 1) × 200 = **15,200**, against 675 million for a dense layer.' },
    { at: 'L4 · slides 25, 27, 29', what: 'SimpleRNN counts **3**, **1,121** and **5,281**: the 56 time steps never appear.' },
    { at: 'L4 · slides 43, 49, 50', what: 'LSTM **685**, GRU **1401**, Conv1D + GRU **1283**, printed as code comments.' },
    { at: 'L5 · slides 12, 21', what: 'Tied weights: **163,814** → **82,414** trainable.' },
    { at: 'L6–7 · slide 6', what: 'Conv decoder summary **13,873**; `conv_ae.count_params()` **54479**.' },
    { at: 'L8 · slide 9', what: '`Bidirectional(SimpleRNN(16))` + `Dense(2)`: **674** trainable params (a code comment).' },
    { at: 'L9 · slides 25, 61', what: 'The policy network and the DQN: code only, so their counts (31, 1,282) are this page’s own.' },
  ],
  examAsks: [
    { form: 'Code', what: 'Wide & Deep with Normalization + Concatenate: draw it, count every layer’s trainable parameters and the total.', part: 'Sample Q1(c)' },
    { form: 'Code', what: 'A small CNN: output shape and parameters per layer; GAP vs Flatten before the output layer.', part: 'Practice A Q1(c)' },
    { form: 'Diagram', what: 'An unrolled memory cell: write its equations, the shapes of its weights, the count.', part: 'Practice A Q2(a)' },
    { form: 'Equation', what: 'Tied weights in an autoencoder: the tying equation and the count.', part: 'Practice A Q2(d)' },
    { form: 'Scenario', what: 'A conv layer described in words: its parameters, compute and memory.', part: 'Practice B Q1(c)' },
    { form: 'Code', what: 'A GAN, a Conv1D + LSTM model, a DQN: draw and count.', part: 'Practice A Q3(a)' },
  ],
  steps: [
    /* ── 1 ─────────────────────────────────────────────────────────────── */
    {
      id: 'what',
      title: 'What a parameter is, and the method',
      short: 'What a parameter is',
      prov: '{s|L1 · slide 8} {s|L1 · slide 45}',
      gist: 'A parameter is a number the model learns: every weight and every bias.',
      read: [
        { list: [
          'A Dense layer has one **weight** per connection, an $n_{\\text{in}} \\times n_{\\text{out}}$ grid, plus one **bias** per neuron {s|L1 · slide 8}.',
          '**Trainable** parameters are changed by training; **non-trainable** ones are stored but not trained. `model.summary()` prints both {s|L1 · slide 45}.',
          '**The method, for any source:** (1) list the layers; (2) track the size flowing *into* each ([shapes](@shapes)); (3) apply that layer’s rule; (4) score 0 for layers with nothing to learn; (5) split trainable from non-trainable; (6) add up, and write the working: the marks are in it.',
        ] },
        { eq: { name: 'Dense layer', tex: '(n_{\\text{in}} + 1) \\times n_{\\text{out}}', read: 'a weight from every input, plus one bias, for every neuron', prov: '{s|L1 · slide 36}' } },
      ],
      play: ['loom'],
    },
    /* ── 2 ─────────────────────────────────────────────────────────────── */
    {
      id: 'dense',
      title: 'Dense layers, and an MLP’s total',
      short: 'Dense layers',
      prov: '{s|L1 · slide 36}',
      gist: 'Count a stack of Dense layers one layer at a time: each layer’s inputs are the previous layer’s outputs.',
      read: [
        'Slide 36’s Fashion MNIST model: `Flatten` turns each 28 × 28 image into 784 numbers, then three Dense layers {s|L1 · slide 36}.',
        { table: {
          head: ['Layer', 'Inputs', 'Working', 'Params'],
          rows: [
            ['Flatten', '28 × 28', 'nothing to learn', '0'],
            ['Dense(300)', '784', '(784 + 1) × 300', '235,500'],
            ['Dense(100)', '300', '(300 + 1) × 100', '30,100'],
            ['Dense(10)', '100', '(100 + 1) × 10', '1,010'],
            ['Total', '', '', '**266,610** {s|L1 · slide 36}'],
          ],
        } },
        '235,500 of the 266,610 sit in the first Dense layer (88%) {own}: a wide input makes a big layer.',
      ],
      play: ['stack'],
    },
    /* ── 3 ─────────────────────────────────────────────────────────────── */
    {
      id: 'diagram',
      title: 'Counting from a diagram',
      short: 'From a diagram',
      prov: '{s|L1 · slide 7} {s|L1 · slide 17}',
      gist: 'In a diagram every arrow between neurons is a weight; then add one bias for every neuron that isn’t an input.',
      read: [
        { list: [
          'Input neurons only hold the data: no weights, no biases.',
          'Figure 10-5 has 2 inputs and 3 output neurons: 6 arrows, so 6 weights, plus 3 biases = **9** {s|L1 · slide 7} {own}.',
          'Slide 8 states it as matrices: $\\mathbf{W}$ has one row per input feature and one column per neuron; $\\mathbf{b}$ has one bias per neuron {s|L1 · slide 8}.',
          'Lecture 1 draws a bias as a small circle on its neuron {s|L1 · slide 17}. Some figures draw a separate bias neuron that always outputs 1: then its arrows *are* the biases, so don’t add them again {beyond}.',
        ] },
      ],
      play: ['diagram'],
    },
    /* ── 4 ─────────────────────────────────────────────────────────────── */
    {
      id: 'zero',
      title: 'Layers with nothing to learn, and why Concatenate matters',
      short: 'Zero layers · Concatenate',
      prov: '{s|L1 · slide 45} {s|L3 · slide 25}',
      gist: 'Layers that only move, reshape or mix data score 0, but they change what the next layer receives.',
      read: [
        { list: [
          'Score 0: `Flatten`, `Reshape`, `Dropout`, pooling, `GlobalAvgPool2D`, `Concatenate`, `Activation`, the VAE’s `Sampling` {s|L1 · slide 36} {s|L3 · slide 25}.',
          '`Concatenate` puts its inputs side by side. Wide & Deep joins the 8 normalized features to 30 hidden outputs, so the last Dense sees **38** inputs: $(38 + 1) \\times 1 = 39$ {s|L1 · slide 45}.',
          'Sample Q1(c) has the same shape: $10 + 20 = 30$ inputs into `Dense(3)`, so $(30 + 1) \\times 3 = 93$ {s|Sample Q1(c)} {own}.',
          'The trap: counting the last Dense from the hidden layer alone (31 or 63) instead of the concatenated width.',
        ] },
      ],
      play: ['widedeep'],
    },
    /* ── 5 ─────────────────────────────────────────────────────────────── */
    {
      id: 'norm',
      title: 'Normalization and BatchNormalization: trainable or not',
      short: 'Normalization · BN',
      prov: '{s|L1 · slide 45} {s|L2 · slide 27}',
      gist: 'Normalization and BatchNormalization store numbers per feature; count them, then split trainable from non-trainable.',
      read: [
        { table: {
          head: ['Layer', 'Per feature', 'Trainable', 'Example'],
          rows: [
            ['Normalization', 'mean, variance (+ 1 count)', 'none: $2n + 1$ non-trainable', '8 features → 17 {s|L1 · slide 45}'],
            ['BatchNormalization', '$\\gamma$, $\\beta$, moving mean, moving variance', '$\\gamma$, $\\beta$: half of $4n$', '784 → 3,136 {s|L2 · slide 27}'],
          ],
        } },
        { list: [
          'Slide 27’s model has BN after `Flatten` and after each hidden layer: $2 \\times (784 + 300 + 100) = 2{,}368$ non-trainable, as its summary prints {s|L2 · slide 27}.',
          'Why “non-trainable”: the moving averages are updated by averaging, not by gradient descent {beyond}.',
        ] },
        { slideNote: 'Slide 23 names only $\\gamma$ and $\\beta$ as BN’s parameters and says the mean and variance are estimated with a moving average. The 4-per-feature count (3,136 = 4 × 784) appears only in slide 27’s summary; no slide explains it.' },
      ],
      play: ['norm'],
    },
    /* ── 6 ─────────────────────────────────────────────────────────────── */
    {
      id: 'conv',
      title: 'Conv2D: one filter is a brick, and the image size doesn’t matter',
      short: 'Conv layers',
      prov: '{s|L3 · slide 19} {s|L3 · slide 22}',
      gist: 'One filter has $k_h \\times k_w \\times c_{\\text{in}}$ weights plus one bias, and a layer has `filters` of them, whatever the size of the image.',
      read: [
        { eq: { name: 'Conv2D', tex: '(k_h \\times k_w \\times c_{\\text{in}} + 1) \\times \\text{filters}', read: 'one brick of weights plus one bias, for every filter', prov: '{s|L3 · slide 22}' } },
        { list: [
          'Kernels are `[kernel_height, kernel_width, input_channels, output_channels]`, biases `[output_channels]` {s|L3 · slide 19}. `Conv2D(32, 7)` on RGB: `(7, 7, 3, 32)` and `(32,)`, so $7 \\times 7 \\times 3 \\times 32 + 32 = 4{,}736$ {own}.',
          '200 filters of 5 × 5 on a 150 × 100 RGB image: $(5 \\times 5 \\times 3 + 1) \\times 200 = 15{,}200$. A dense layer would need 675 million {s|L3 · slide 22}.',
          'No image size in the formula: one filter is reused at every position {s|L3 · slide 8}. No stride either ([stride](@stride)).',
          '`Conv1D`: $(k \\times c_{\\text{in}} + 1) \\times \\text{filters}$. `Conv2DTranspose` counts like Conv2D: $(3 \\times 3 \\times 16 + 1) \\times 32 = 4{,}640$ {s|L6–7 · slide 6}.',
        ] },
        { slideNote: 'Slide 22’s footnote, 150² × 100² × 3 = 675 million, counts the dense layer’s weights only; with its 15,000 biases it would be 675,015,000. The conv answer, (5 × 5 × 3 + 1) × 200, does include the biases.' },
      ],
      play: ['brick'],
    },
    /* ── 7 ─────────────────────────────────────────────────────────────── */
    {
      id: 'cnn',
      title: 'A whole CNN, and Flatten vs GlobalAvgPool',
      short: 'A whole CNN',
      prov: '{s|L3 · slide 35} {own}',
      gist: 'Count a CNN while tracking the shape: each conv needs the channels coming in, and the first Dense needs everything Flatten hands it.',
      read: [
        { list: [
          'Slide 35’s CNN takes 28 × 28 × 1; three `MaxPool2D()` take the image 28 → 14 → 7 → 3, since 7 ÷ 2 rounds down {s|L3 · slide 35} {own}.',
          '`Flatten` then hands 3 × 3 × 256 = 2,304 numbers to `Dense(128)`: $(2304 + 1) \\times 128 = 295{,}040$ {own}.',
          'The whole model: **1,413,834** parameters. No slide prints this total {own}.',
          'With `GlobalAvgPool2D` instead, `Dense(128)` sees 256 numbers: 32,896 {own}. Practice A Q1(c) asks exactly this: 330 vs 20,490 {s|Practice A Q1(c)}.',
        ] },
      ],
      play: ['cnn'],
    },
    /* ── 8 ─────────────────────────────────────────────────────────────── */
    {
      id: 'rnn',
      title: 'SimpleRNN: three blocks, reused at every time step',
      short: 'SimpleRNN',
      prov: '{s|L4 · slide 9} {s|L4 · slides 25, 27, 29}',
      gist: 'A recurrent layer has three weight blocks, $\\mathbf{W}_x$, $\\mathbf{W}_h$ and $\\mathbf{b}$, reused at every time step, so the sequence length never enters the count.',
      read: [
        { eq: { name: 'SimpleRNN', tex: '\\text{units} \\times (\\text{units} + n_{\\text{in}}) + \\text{units}', read: 'W_x is n_in × units, W_h is units × units, b has one per unit', prov: '{s|L4 · slide 9}' } },
        { list: [
          'Slide 9’s shapes: $\\mathbf{W}_x$ is $n_{\\text{inputs}} \\times n_{\\text{neurons}}$, $\\mathbf{W}_h$ is $n_{\\text{neurons}} \\times n_{\\text{neurons}}$ {s|L4 · slide 9}.',
          '`SimpleRNN(1)` on one feature: $1 \\times (1 + 1) + 1 = 3$ {s|L4 · slide 25}. `SimpleRNN(32)`: 1,088 {s|L4 · slide 27}; on 32 inputs: 2,080 {s|L4 · slide 29}.',
          '56 time steps or 5,000: the same three blocks, the same count.',
          'The output `Dense(1)` is its own layer: $(32 + 1) \\times 1 = 33$ {s|L4 · slide 27}.',
        ] },
        { note: 'Slides 9–11’s memory cell also holds the output weights $\\mathbf{W}_y$ and $\\mathbf{b}_y$ {s|L4 · slide 9}, which Keras puts in the separate Dense layer. When a question draws the cell with its output, count them together: Practice A Q2(a) gets 60 + 7 = 67.', label: 'Watch out' },
      ],
      play: ['unroll'],
    },
    /* ── 9 ─────────────────────────────────────────────────────────────── */
    {
      id: 'gates',
      title: 'LSTM ×4, GRU ×3, Bidirectional ×2',
      short: 'LSTM · GRU · Bidirectional',
      prov: '{s|L4 · slides 43, 49} {s|L8 · slide 9}',
      gist: 'An LSTM is four SimpleRNN-sized blocks, a GRU three (plus Keras’s extra bias), and Bidirectional runs two copies.',
      read: [
        { table: {
          head: ['Layer', 'Count', 'The slides’ example'],
          rows: [
            ['LSTM', '$4 \\times (u(u + n_{\\text{in}}) + u)$', 'LSTM(12) + Dense(1): 672 + 13 = **685** {s|L4 · slide 43}'],
            ['GRU (Keras)', '$3 \\times (u(u + n_{\\text{in}}) + 2u)$', 'GRU(20) + Dense(1): 1,380 + 21 = **1,401** {s|L4 · slide 49}'],
            ['GRU, 1 bias per gate', '$3 \\times (u(u + n_{\\text{in}}) + u)$', '1,320 + 21 = 1,341 {own}'],
            ['Bidirectional', '2 × the wrapped layer', '2 × 304 + 66 = **674** {s|L8 · slide 9}'],
          ],
        } },
        { list: [
          'Why: an LSTM feeds $\\mathbf{h}_{(t-1)}$ and $\\mathbf{x}_{(t)}$ to four fully connected layers {s|L4 · slide 46}, a GRU to three {s|L4 · slide 48}.',
        ] },
        { slideNote: 'Slide 49’s GRU equations show one bias per gate ($\\mathbf{b}_z$, $\\mathbf{b}_r$, $\\mathbf{b}_g$), which gives 1,341. Its printed 1401 is Keras’s default `reset_after=True`, which keeps two bias vectors per gate. Slide 50’s 1283 has the same cause: one bias per gate would give 1,253.' },
      ],
      play: ['gates'],
    },
    /* ── 10 ────────────────────────────────────────────────────────────── */
    {
      id: 'gen',
      title: 'Autoencoders and GANs; tied weights',
      short: 'AEs · GANs · tied',
      prov: '{s|L5 · slides 12, 19, 21} {s|L6–7 · slide 6}',
      gist: 'Autoencoders and GANs are built from the same layers, so count them the same way; a tied decoder layer adds only its biases.',
      read: [
        { list: [
          'Stacked autoencoder, 784 → 100 → 30 → 100 → 784: **163,814** {s|L5 · slide 12}.',
          'Tied: $\\mathbf{W}_{N-\\ell+1} = \\mathbf{W}_\\ell^\\top$, so “only $\\mathbf{W}_1$, $\\mathbf{W}_2$, and the bias terms need to be learned” {s|L5 · slide 19}: **82,414** {s|L5 · slide 21}.',
          'Conv decoder: 4,464 + 4,640 + 4,624 + 145 = **13,873**; whole conv AE 54,479 {s|L6–7 · slide 6}; so the encoder is 40,606 {own}.',
          'GAN (codings 30): generator 136,634, discriminator 132,951. DCGAN: generator 840,321 trainable + 384 non-trainable (its two BN layers), discriminator 212,865 {own}.',
        ] },
        { slideNote: 'Slide 18 says tying “halves the number of weights”, slide 21 “almost halved”: the biases aren’t tied, so 82,414 is a little more than half of 163,814 (81,907).' },
      ],
      play: ['tied'],
    },
    /* ── 11 ────────────────────────────────────────────────────────────── */
    {
      id: 'frozen',
      title: 'Frozen layers and transfer learning',
      short: 'Frozen layers',
      prov: '{s|L2 · slide 31} {s|L3 · slide 51}',
      gist: 'Freezing a layer doesn’t remove its parameters: they stay in the model and stop being trained.',
      read: [
        { list: [
          'Transfer learning freezes the reused layers: `layer.trainable = False` {s|L2 · slide 31}; `for layer in base_model.layers: layer.trainable = False` {s|L3 · slide 51}.',
          'Recompile after freezing or unfreezing {s|L2 · slide 31}.',
          'The total stays the same; frozen weights move from “Trainable params” to “Non-trainable params” in `summary()` {beyond}.',
          'A GAN freezes the discriminator while the generator trains {s|L6–7 · slide 22}.',
        ] },
      ],
      play: ['freeze'],
    },
    /* ── 12 ────────────────────────────────────────────────────────────── */
    {
      id: 'disguise',
      title: 'Same model, five disguises (and the whole rule table)',
      short: 'Five disguises',
      prov: '{own}',
      gist: 'Whatever form a model arrives in, rewrite it as a list of layers with the size flowing into each, and the counting is the same.',
      read: [
        { table: {
          head: ['Layer', 'Rule', 'Where'],
          rows: [
            ['Dense', '$(n_{\\text{in}} + 1) \\times n$; no bias: $n_{\\text{in}} \\times n$', '{s|L1 · slide 36} {s|L2 · slide 28}'],
            ['Normalization', '$2n + 1$, all non-trainable', '{s|L1 · slide 45}'],
            ['BatchNormalization', '$4n$, half non-trainable', '{s|L2 · slide 27}'],
            ['Conv2D / 1D / Transpose', '$(k_h k_w c_{\\text{in}} + 1) \\times \\text{filters}$', '{s|L3 · slide 22}'],
            ['SimpleRNN', '$u(u + n_{\\text{in}}) + u$', '{s|L4 · slides 9, 25}'],
            ['LSTM · GRU', '× 4 · × 3 (+ $3u$ extra bias in Keras)', '{s|L4 · slides 43, 49}'],
            ['Bidirectional', '× 2', '{s|L8 · slide 9}'],
            ['Tied decoder', 'biases only', '{s|L5 · slide 19}'],
            ['Flatten, pooling, Dropout …', '0', '{s|L3 · slide 25}'],
          ],
        } },
        'Code gives `units`, `filters`, `kernel_size`; a diagram gives arrows and neurons; a summary gives each output shape; a sentence gives “200 filters of 5 × 5”; equations give matrix sizes.',
      ],
      play: ['disguise'],
    },
  ],
  drill: {
    lab: 'drill',
    title: 'Exam drill: count it',
    short: 'Exam drill',
    prov: '{own}',
    blurb: 'Random models in the unit’s layers, shown as code, a diagram, a summary with gaps, a sentence or equations. Type every layer’s count and the total; the working appears after you check. Reverse mode asks for the units or filters instead.',
  },
};
