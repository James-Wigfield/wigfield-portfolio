/* ============================================================================
   TOPIC 2 · SHAPES  (topics/shapes/topic.js)
   ----------------------------------------------------------------------------
   What "the shape" of a tensor, an input, an output or a weight means: axes,
   the batch axis, reading real tuples, the unit's data conventions, how each
   layer changes a shape, weight shapes, and the exam's "scenario → shapes of
   X and y". Shapes come from ../../maths/shapeRules.js (checked in Keras by
   verify_counts.py); printed tuples carry their slide.
   ========================================================================== */

export default {
  id: 'shapes',
  title: 'Shapes',
  lectures: ['L1', 'L3', 'L4', 'L6–7', 'L8'],
  oneLine: 'A shape is a list of counts, one per axis of a box of numbers: how many examples, how many rows, columns and channels, how many time steps or features.',
  printLead:
    'What the numbers in a shape like (2, 70, 120, 3) mean, why summaries print None, why recurrent layers want 3D input, how each layer changes a shape, and how weight shapes relate to data shapes. Colours are the same in every topic: batch, height, width, channels, time steps and features each have their own. Labels: a slide receipt (“L3 · slide 17”) means the slide prints it; “this page’s own · checked in TF” means this page computed it and checked it in TensorFlow; “beyond the slides” means true but not in the lecture notes.',
  hero: { lab: 'hero', caption: 'An image is a box of numbers: 70 rows, 120 columns, 3 colour channels. Two of them make a batch, and the shape reads (2, 70, 120, 3). Click to replay.' },
  showsUp: [
    { at: 'L1 · slide 36', what: '`summary()` prints `(None, 784)`; `weights.shape` (784, 300), `biases.shape` (300,).' },
    { at: 'L3 · slide 16', what: 'Images `[height, width, channels]`; a mini-batch `[minibatch_size, height, width, channels]`; kernels `[f_h, f_w, f_c, f_n]`.' },
    { at: 'L3 · slides 17–20', what: '`TensorShape([2, 70, 120, 3])` → `Conv2D(32, 7)` → `[2, 64, 114, 32]`; with `padding="same"`, `[2, 70, 120, 32]`.' },
    { at: 'L3 · slide 31', what: '`GlobalAvgPool2D` turns (2, 70, 120, 3) into shape=(2, 3).' },
    { at: 'L3 · slide 43', what: 'The batch axis written as $m$: “m × 8 × 8 × 1024”.' },
    { at: 'L4 · slide 24', what: 'Recurrent layers “expect 3D inputs of shape [batch size, time steps, dimensionality]”.' },
    { at: 'L4 · slides 29, 36, 38', what: '`return_sequences=True`; batches of (32, 56, 5) → (32, 14); one instance [1, 56, 5] → [1, 14].' },
    { at: 'L6–7 · slide 5', what: 'The conv autoencoder’s comments: 28 × 28 → 14 × 14 × 16 → 7 × 7 × 32 → 3 × 3 × 64 → 30, and back up to 28 × 28 × 1.' },
    { at: 'L8 · slides 37–38', what: '$\\mathbf{Q}$ $[n_{\\text{queries}}, d_{\\text{keys}}]$, $\\mathbf{K}$ $[n_{\\text{keys}}, d_{\\text{keys}}]$, $\\mathbf{V}$ $[n_{\\text{keys}}, d_{\\text{values}}]$; output $[n_{\\text{queries}}, d_{\\text{values}}]$.' },
  ],
  examAsks: [
    { form: 'Scenario', what: 'An RNN that predicts a star’s last corner: the shapes of X and y, and the loss.', part: 'Sample Q2(a)' },
    { form: 'Code', what: 'A small CNN: every layer’s output shape (and parameters).', part: 'Practice A Q1(c)' },
    { form: 'Equation', what: 'Scaled dot-product attention: the shapes of Q, K, V and of the output.', part: 'Practice A Q4(a)' },
    { form: 'Code', what: 'Conv1D + LSTM: draw it with the shapes.', part: 'Practice B Q2(b)' },
    { form: 'Scenario', what: 'Noisy-square sequences: the shapes of X and y, the output layer and the loss.', part: 'Practice B Q2(d)' },
    { form: 'Code', what: 'A DCGAN generator: the output shape of each layer.', part: 'Practice B Q3(b)' },
  ],
  steps: [
    /* ── 1 ─────────────────────────────────────────────────────────────── */
    {
      id: 'tensor',
      title: 'A tensor is a box of numbers; its shape counts each axis',
      short: 'Tensors and axes',
      prov: '{s|L1 · slide 36} {s|L3 · slide 16}',
      gist: 'A shape lists how many numbers there are along each axis of a box; the number of axes is its rank.',
      read: [
        { table: {
          head: ['Rank', 'Shape', 'Example'],
          rows: [
            ['0', '`()`', 'one number: a loss'],
            ['1', '`(300,)`', 'a vector: slide 36’s biases {s|L1 · slide 36}'],
            ['2', '`(784, 300)`', 'a matrix: slide 36’s Dense kernel {s|L1 · slide 36}'],
            ['3', '`(70, 120, 3)`', 'one image: height, width, channels {s|L3 · slide 16}'],
            ['4', '`(2, 70, 120, 3)`', 'a batch of images {s|L3 · slides 16–17}'],
          ],
        } },
        'The trailing comma in `(300,)` is Python’s way of writing a one-axis tuple: 300 numbers in a row {beyond}.',
      ],
      play: ['builder'],
    },
    /* ── 2 ─────────────────────────────────────────────────────────────── */
    {
      id: 'batch',
      title: 'The batch axis comes first, and shows as None',
      short: 'The batch axis',
      prov: '{s|L1 · slide 36} {s|L3 · slides 16, 43}',
      gist: 'The first axis counts the examples processed together; it can be any number, so `summary()` prints it as None.',
      read: [
        { list: [
          'A mini-batch of images is `[minibatch_size, height, width, channels]` {s|L3 · slide 16}; slide 43 writes the batch size as $m$: “m × 8 × 8 × 1024” {s|L3 · slide 43}.',
          '`summary()` prints `(None, 784)`: None means “any number of examples” {s|L1 · slide 36} {beyond}.',
          '`InputLayer(shape=[28, 28])` leaves the batch axis out; Keras adds it {s|L1 · slide 35}.',
          'Feed 1, 2 or 32 examples: only the first number changes, and no parameter count does.',
          'Careful: in `InputLayer(shape=[None, 1])` the None is the **time** axis (any sequence length), not the batch {s|L4 · slide 24}.',
        ] },
      ],
      play: ['batch'],
    },
    /* ── 3 ─────────────────────────────────────────────────────────────── */
    {
      id: 'read',
      title: 'Reading a real tuple',
      short: 'Reading a tuple',
      prov: '{s|L3 · slides 17–19}',
      gist: 'Read a tuple from left to right as nested counts: (2, 70, 120, 3) is 2 images, each 70 rows of 120 pixels, each pixel 3 colour values.',
      read: [
        { list: [
          '`images.shape` → `TensorShape([2, 70, 120, 3])`: two sample images cropped to 70 × 120, RGB {s|L3 · slide 17}.',
          'After `Conv2D(filters=32, kernel_size=7)`: `TensorShape([2, 64, 114, 32])`. The batch stays 2; height and width shrink by 6; the last axis is now the **32 filters** {s|L3 · slide 18}.',
          'The total count of numbers is the product: $2 \\times 70 \\times 120 \\times 3 = 50{,}400$, from the shape {s|L3 · slide 17}.',
        ] },
        { slideNote: 'Slide 19 says the output feature maps are `[2, 64, 114, 3]`; slide 18 prints `TensorShape([2, 64, 114, 32])`, and slide 19’s own kernels are `(7, 7, 3, 32)`. The last axis is the number of filters, 32.' },
      ],
      play: ['tuple'],
    },
    /* ── 4 ─────────────────────────────────────────────────────────────── */
    {
      id: 'gallery',
      title: 'The unit’s data shapes',
      short: 'Data shapes',
      prov: '{s|L3 · slide 16} {s|L4 · slide 24} {s|L8 · slides 37–38}',
      gist: 'Each kind of data has its own layout, and the batch always comes first.',
      read: [
        { table: {
          head: ['Data', 'Shape', 'Example'],
          rows: [
            ['Tabular', '[batch, features]', 'Wide & Deep: `(None, 8)` {s|L1 · slide 45}'],
            ['Images', '[batch, height, width, channels]', '`[2, 70, 120, 3]` {s|L3 · slides 16–17}'],
            ['Sequences', '[batch size, time steps, dimensionality]', '`(32, 56, 5)` {s|L4 · slides 24, 36}'],
            ['Attention', '$\\mathbf{Q}$ $[n_{\\text{queries}}, d_{\\text{keys}}]$, $\\mathbf{K}$ $[n_{\\text{keys}}, d_{\\text{keys}}]$', 'scores $[n_{\\text{queries}}, n_{\\text{keys}}]$ {s|L8 · slides 37–38}'],
          ],
        } },
        '“dimensionality is 1 for univariate time series and more for multivariate time series” {s|L4 · slide 24}.',
        { slideNote: 'L4 slide 21 prints the rail dataset’s batches as `xx.shape = (32, 56)`, two axes, while slide 24 says recurrent layers expect 3D input and builds `InputLayer(shape=[None, 1])`. No reshape to `(32, 56, 1)` is shown; the only explicit one is slide 34’s `[np.newaxis, :seq_length, np.newaxis]`.' },
      ],
      play: ['gallery'],
    },
    /* ── 5 ─────────────────────────────────────────────────────────────── */
    {
      id: 'layers',
      title: 'How each layer changes a shape',
      short: 'Layers change shapes',
      prov: '{s|L3 · slides 18–31} {s|L4 · slide 29} {s|L6–7 · slide 5}',
      gist: 'Every layer has a shape rule: some keep the shape, some change only the last axis, convolutions and pooling resize height and width.',
      read: [
        { table: {
          head: ['Layer', 'Shape in → out'],
          rows: [
            ['`Flatten`', '(7, 7, 128) → (6272,): multiply everything out'],
            ['`Dense(n)`', 'last axis → n: (None, 784) → (None, 300) {s|L1 · slide 36}'],
            ['`Conv2D(f, k)`', 'height, width by kernel, stride, padding; channels → f {s|L3 · slides 18–20}'],
            ['`MaxPool2D(2)`', 'height, width halve (rounding down); channels kept {s|L3 · slides 28–29}'],
            ['`GlobalAvgPool2D`', '(h, w, c) → (c,) {s|L3 · slide 31}'],
            ['`SimpleRNN(n)`', '(time, dim) → (n,); with `return_sequences=True` → (time, n) {s|L4 · slide 29}'],
            ['`Conv2DTranspose`, stride 2', 'height, width roughly double: 7 → 14 → 28 {s|L6–7 · slide 5}'],
            ['`Reshape`, `Concatenate`', 'to the given shape; last axes add up (8 + 30 = 38) {s|L1 · slide 45}'],
          ],
        } },
        'The exact conv and pooling sizes are the [stride](@stride) topic’s.',
      ],
      play: ['tracer'],
    },
    /* ── 6 ─────────────────────────────────────────────────────────────── */
    {
      id: 'weights',
      title: 'Weight shapes vs data shapes',
      short: 'Weight shapes',
      prov: '{s|L1 · slide 36} {s|L3 · slides 16, 19} {s|L4 · slides 9–10}',
      gist: 'A layer’s weights have their own fixed shapes, set by the sizes going in and out, never by the batch.',
      read: [
        { list: [
          'Dense: kernel `(n_in, n_out)`, bias `(n_out,)`: `(784, 300)` and `(300,)` {s|L1 · slide 36}.',
          'Conv2D: kernels `[kernel_height, kernel_width, input_channels, output_channels]`, biases `[output_channels]`: `(7, 7, 3, 32)` and `(32,)` {s|L3 · slide 19}.',
          'SimpleRNN: $\\mathbf{W}_x$ $n_{\\text{inputs}} \\times n_{\\text{neurons}}$, $\\mathbf{W}_h$ $n_{\\text{neurons}} \\times n_{\\text{neurons}}$; with 4 inputs and 5 neurons, $\\mathbf{W}_x \\in \\mathbb{R}^{4 \\times 5}$, $\\mathbf{W}_h \\in \\mathbb{R}^{5 \\times 5}$ {s|L4 · slides 9–10}.',
          'Multiply out each weight shape and add: that is the parameter count ([parameter counts](@param-count)) {own}.',
        ] },
      ],
      play: ['weights'],
    },
    /* ── 7 ─────────────────────────────────────────────────────────────── */
    {
      id: 'scenario',
      title: 'The exam move: a scenario → the shapes of X and y',
      short: 'Scenario → X and y',
      prov: '{s|Sample Q2(a)} {s|Lab Sheet 4} {s|L4 · slide 11}',
      gist: 'Count the examples, the time steps and the numbers per step for X; for y, count what is predicted per example.',
      read: [
        { list: [
          'Slide 11: three days of 4 measurements predicting 2 numbers gives $\\mathbf{X} \\in \\mathbb{R}^{N \\times 3 \\times 4}$ and $\\mathbf{Y} \\in \\mathbb{R}^{N \\times 2}$ {s|L4 · slide 11}.',
          'Lab Sheet 4: 200 sequences of 4 noisy 2D vertices, labelled 1 or 0: `X_train` (200, 4, 2), `y_train` (200,). Task 3, three vertices in, the fourth out: (200, 3, 2) and (200, 2) {s|Lab Sheet 4}.',
          'Sample Q2(a): 4 star corners in, the last corner out {s|Sample Q2(a)}, so X $(N, 4, 2)$, y $(N, 2)$ {own}, as Exam Practice answers it.',
        ] },
      ],
      play: ['scenario'],
    },
  ],
  drill: {
    lab: 'drill',
    title: 'Exam drill: shapes',
    short: 'Exam drill',
    prov: '{own}',
    blurb: 'A model → every layer’s output shape (batch as None); a scenario → the shapes of X and y; a tuple → what each axis means.',
  },
};
