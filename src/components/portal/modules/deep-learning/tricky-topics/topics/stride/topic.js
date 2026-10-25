/* ============================================================================
   TOPIC 4 · STRIDE  (topics/stride/topic.js)
   ----------------------------------------------------------------------------
   What stride does, how it combines with padding, the 2D case, the output-
   size rules (BEYOND THE SLIDES: derived from L3 slide 9's index rule and
   checked in TensorFlow over a sweep), pooling's default stride, and
   transposed convolutions. Sizes come from ../../maths/strideRules.js.
   ========================================================================== */

export default {
  id: 'stride',
  title: 'Stride',
  lectures: ['L3', 'L4', 'L6–7'],
  oneLine: 'Stride is how far the window jumps between one output and the next: jump further and you get fewer outputs, but the window’s weights stay the same.',
  printLead:
    'What stride does, how it combines with "valid" and "same" padding to set the output size, the 2D case, pooling’s default stride, and transposed convolutions that grow an image back. The output-size formulas are not printed on the slides: they are labelled “beyond the slides”, derived from L3 slide 9’s rule and checked in TensorFlow. Labels: a slide receipt (“L3 · slide 21”) means the slide states it; “this page’s own · checked in TF” means this page computed it and checked it in TensorFlow.',
  hero: { lab: 'hero', caption: 'A window of 3 hops along 9 inputs, 2 at a time: four positions, so four outputs. Click to replay.' },
  showsUp: [
    { at: 'L3 · slide 9', what: '“The distance between two consecutive receptive fields is called the stride”: a 5 × 7 input to a 3 × 4 layer, stride 2.' },
    { at: 'L3 · slides 20–21', what: 'Figures 14-7 and 14-8: "valid" vs "same", stride 1 and 2; with stride > 1 “the output size will not be equal to the input size, even if padding="same"”.' },
    { at: 'L3 · slides 24, 34', what: 'Out of memory? “reducing dimensionality using a larger stride value”; a big first kernel “usually with a stride of 2 or more”.' },
    { at: 'L3 · slides 26, 28', what: 'Max pooling 2 × 2, stride 2 (Figure 14-9); “the strides default to the kernel size”.' },
    { at: 'L3 · slides 37, 39', what: 'LeNet-5 and AlexNet tables: kernel, stride and size per layer (227 → 55 → 27 …).' },
    { at: 'L4 · slide 50', what: '`Conv1D(filters=16, kernel_size=3, strides=2)` before a GRU.' },
    { at: 'L6–7 · slides 5, 28–29', what: '`Conv2DTranspose(…, strides=2)` grows 3 → 7 → 14 → 28; DCGAN: replace pooling with strided convolutions.' },
  ],
  examAsks: [
    { form: 'Code', what: 'A small CNN: every layer’s output shape (padding and pooling sizes).', part: 'Practice A Q1(c)' },
    { form: 'Code', what: 'Conv1D (default stride and padding) + LSTM: the shapes.', part: 'Practice B Q2(b)' },
    { form: 'Code', what: 'A DCGAN generator with strided transposed convolutions: each layer’s shape.', part: 'Practice B Q3(b)' },
    { form: 'Scenario', what: 'A conv layer on a big image: its compute and memory.', part: 'Practice B Q1(c)' },
  ],
  steps: [
    /* ── 1 ─────────────────────────────────────────────────────────────── */
    {
      id: 'what',
      title: 'What stride is: how far the window jumps',
      short: 'What stride is',
      prov: '{s|L3 · slides 9, 14}',
      gist: 'Stride is the distance between one receptive field and the next: the window jumps that many inputs each time.',
      read: [
        { list: [
          '“It is also possible to connect a large input layer to a much smaller layer by spacing out the receptive fields. The distance between two consecutive receptive fields is called the *stride*” {s|L3 · slide 9}.',
          'Neuron $i$ looks at inputs $i\\,s$ to $i\\,s + f - 1$: the window starts $s$ further along for each output {s|L3 · slides 9, 14}.',
          'Stride 1 visits every position; stride 2 every other one, so about half as many outputs.',
          'The window is the same weights wherever it lands, so stride never changes the parameter count ([parameter counts](@param-count)) {s|L3 · slide 22}.',
        ] },
      ],
      play: ['slide'],
    },
    /* ── 2 ─────────────────────────────────────────────────────────────── */
    {
      id: 'padding',
      title: 'Stride and padding together: Figure 14-8',
      short: 'Stride + padding',
      prov: '{s|L3 · slides 20–21}',
      gist: '"valid" never pads, so the last inputs can be left out; "same" pads with zeros, but a stride above 1 still shrinks the output.',
      read: [
        { list: [
          '"valid" stays inside the input: a kernel of 7 at stride 1 leaves the output with “6 fewer pixels than the input” {s|L3 · slide 20}.',
          '"same" pads zeros so stride 1 keeps the size, but with a stride above 1 “the output size will not be equal to the input size, even if padding="same"” {s|L3 · slide 21}.',
          'Figure 14-8: 10 inputs, kernel 7, stride 2. "valid": 2 outputs and the 10th input **ignored**. "same": 2 zeros on the left, 3 on the right, **5** outputs {s|L3 · slide 21}.',
          'The extra zero goes on the right: TensorFlow’s rule, which the slide doesn’t state {beyond}.',
        ] },
        { slideNote: 'Slide 20 says the default "valid" padding “means zero-padding”. It means none: slide 28 says “(i.e., no padding at all)”, and "same" is the one that pads.' },
      ],
      play: ['fig148'],
    },
    /* ── 3 ─────────────────────────────────────────────────────────────── */
    {
      id: 'twod',
      title: 'Stride in 2D: slide 9’s 5 × 7 → 3 × 4',
      short: 'Stride in 2D',
      prov: '{s|L3 · slide 9}',
      gist: 'In 2D the window jumps by the vertical stride down and the horizontal stride across, so each direction shrinks on its own.',
      read: [
        { list: [
          'Figure 14-4: “a 5 × 7 input layer (plus zero padding) is connected to a 3 × 4 layer, using 3 × 3 receptive fields and a stride of 2 in both directions” {s|L3 · slide 9}.',
          'Rows: $i\\,s_h$ to $i\\,s_h + f_h - 1$; columns: $j\\,s_w$ to $j\\,s_w + f_w - 1$ {s|L3 · slide 9}.',
          'The figure pads one zero all round (7 × 9 with the padding): exactly what "same" does for this input at stride 2 {own}.',
          '`strides` can differ by direction: with `padding="same"`, `strides=(1, 2)` halves only the width {beyond}.',
        ] },
      ],
      play: ['grid2d'],
    },
    /* ── 4 ─────────────────────────────────────────────────────────────── */
    {
      id: 'rules',
      title: 'The output-size rules (beyond the slides)',
      short: 'Output-size rules',
      prov: '{beyond} {s|L3 · slides 18, 37, 39}',
      gist: '"same": divide by the stride and round up; "valid": take off the kernel, divide by the stride, round down, add one.',
      read: [
        { table: {
          head: ['Padding', 'Output length', 'Worked on the slides’ layers'],
          rows: [
            ['"same"', '$\\lceil n / s \\rceil$', '70 → 70 at stride 1 {s|L3 · slide 20}'],
            ['"valid"', '$\\lfloor (n - k) / s \\rfloor + 1$', '70 × 120, k 7 → 64 × 114 {s|L3 · slide 18}; AlexNet C1 227, k 11, s 4 → 55; S2 55, k 3, s 2 → 27 {s|L3 · slide 39}'],
          ],
        } },
        { list: [
          'Neither formula is on the slides {beyond}; both follow from slide 9’s rule, and this page checks them against TensorFlow for every $n \\le 40$, $k \\le 7$, $s \\le 4$ {own}.',
          'LeNet-5: 32 → 28 (k 5, s 1) → 14 (2 × 2 pooling, s 2) {s|L3 · slide 37}. L4 slide 50: 56 → 54 → 26 (k 3, s 1 then s 2, "valid") {own}.',
        ] },
        { slideNote: 'Slide 39’s AlexNet table goes C6 → S8: the C7 row (256 maps, 13 × 13, 3 × 3, stride 1, same) is missing, so S8’s 256 maps don’t follow from C6’s 384. The sizes and strides are still good stride examples.' },
      ],
      play: ['calc'],
    },
    /* ── 5 ─────────────────────────────────────────────────────────────── */
    {
      id: 'pool',
      title: 'Pooling’s stride, and when to use a bigger one',
      short: 'Pooling · bigger strides',
      prov: '{s|L3 · slides 24, 26, 28, 34}',
      gist: 'A pooling layer’s stride defaults to its size, so `MaxPool2D()` halves height and width, rounding down.',
      read: [
        { list: [
          '“By default, the strides default to the kernel size and "valid" padding (i.e., no padding at all) is assumed” {s|L3 · slide 28}. 2 × 2 pooling, stride 2: 7 → 3, the last row and column dropped {own}.',
          'Figure 14-9: 2 × 2 max pooling, stride 2, no padding; “only the maximum input value in each receptive field makes it to the next layer” {s|L3 · slide 26}.',
          'A bigger stride saves memory: out-of-memory fix ii is “reducing dimensionality using a larger stride value” {s|L3 · slide 24}; a big first kernel goes with “a stride of 2 or more” {s|L3 · slide 34}.',
          'DCGANs “replace any pooling layers with strided convolutions (in the discriminator)” {s|L6–7 · slide 28}.',
        ] },
      ],
      play: ['pool'],
    },
    /* ── 6 ─────────────────────────────────────────────────────────────── */
    {
      id: 'up',
      title: 'Transposed convolutions: stride 2 grows the image',
      short: 'Transposed convs',
      prov: '{s|L6–7 · slides 5–6}',
      gist: 'A transposed convolution with stride 2 does the reverse: it roughly doubles height and width, and its parameter count still ignores the stride.',
      read: [
        { list: [
          'The conv autoencoder’s decoder: 3 × 3 × 16 → 7 × 7 × 32 → 14 × 14 × 16 → 28 × 28 × 1 {s|L6–7 · slide 5}.',
          'The first `Conv2DTranspose(32, 3, strides=2)` has no `padding`, so it uses "valid": $3 \\times 2 + (3 - 2) = 7$. The two with `padding="same"` double: 7 → 14 → 28 {own} {beyond}.',
          'Its summary counts 4,640 for the first one: $(3 \\times 3 \\times 16 + 1) \\times 32$, no stride in it {s|L6–7 · slide 6}.',
          'Stride changes the shape and the work; it never changes the parameter count.',
        ] },
      ],
      play: ['upsample'],
    },
  ],
  drill: {
    lab: 'drill',
    title: 'Exam drill: output sizes',
    short: 'Exam drill',
    prov: '{own}',
    blurb: 'n, k, s and the padding → the output size, with the window picture to check it; a CNN’s code → every layer’s height and width; and why a stride of 2 is there.',
  },
};
