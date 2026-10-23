/* ============================================================================
   BLOCK BUILDER — CONTENT (pure data, slide-cited; Lecture 3 only)
   ----------------------------------------------------------------------------
   Lecture 3's architecture slides (Documents/cits5017/lectures/
   cits5017-lect03-CNNs.pdf): 33–34 (typical CNN), 36–47 (ILSVRC, LeNet-5,
   AlexNet, GoogLeNet, VGGNet, ResNet, Xception, SENet) and 49–51
   (pretrained models, transfer learning). The transcript stops at slide 16,
   so everything here was read from the PDF (tables and figures rendered).

     GAME, INTRO, UI          copy (templates use %name% placeholders)
     ARCHS                    the seven names the slides give, with years
     LENET5, ALEXNET          the slide-37 / slide-39 tables, row by row
     GOOGLENET                Figure 14-15 (slide 43): the tower, the nine
                              inception modules' printed numbers, the three
                              depth-concat sums the figure prints
     INCEPTION                Figure 14-14 (slide 42): the four branches
                              and the decoy branches
     RESIDUAL                 Figure 14-16 (slide 46): the residual unit
     VGG                      slide 44's recipe, drawn as blocks
     CLAIMS, NUMBERS          level 1: claim → name, name → number / year
     FRAGMENTS                level 1: which architecture is this picture from
     QUICK                    level 2: one-tap follow-ups (inception, ResNet)
     ORDERS                   level 2 / 3: the stacks to put in order
     RULES                    level 3: why texts for the table cells
     TYPICAL, TRANSFER        level 3: slides 33–34 and 49–51 choices
     ROUNDS                   the item plan per level

   What the slides only NAME is not drilled: Xception and SENet get one
   paragraph each (slide 47 names depthwise separable convolution and the
   SE block but does not explain them); local response normalization appears only as two blocks in
   Figure 14-15 and is never explained; the purpose of the 1 × 1 convs is
   not stated; slide 39's AlexNet table has no C7 row (S8's 256 maps cannot
   come from C6's 384), so S8's maps are never asked. Nothing here is
   marked `beyond`.
   ========================================================================== */

export const LECTURE = 3;

export const GAME = {
  id: 'block-builder',
  title: 'Block Builder',
  blurb: 'Name a CNN from its parts, stack its blocks bottom-up, fill the gaps in its table: LeNet-5 to SENet, as far as the slides go.',
  levelNames: ['name the net', 'stack the blocks', 'fill the spec'],
};

export const INTRO = {
  line: 'Name the net from its parts, stack its blocks in order, then fill in the missing numbers.',
  controls: [
    'Pick an answer with a tap or keys 1–6.',
    'Stacking: tap a card (keys 1–9) to drop it into the lowest empty slot; tap it again or press Backspace to take it back; Enter locks the stack.',
    'Wiring: tap the block the skip connection leaves from, then the block it joins (keys 1–4).',
    'Missing numbers: the keypad or keys 0–9, then Enter.',
  ],
};

export const UI = {
  which: 'Which architecture?',
  textPrompt: 'Pick the slides’ answer.',
  whichPicture: 'Which architecture is this from?',
  whichRows: 'Which architecture’s table are these rows from?',
  claimK: 'the slides say',
  exhibitK: 'architecture',
  orderPrompt: 'Stack %name%’s missing blocks, bottom to top.',
  orderSub: 'Tap a card to drop it into the lowest empty slot.',
  finetunePrompt: 'Put slide 51’s fine-tuning steps in order, top to bottom.',
  finetuneSub: 'The first two steps are in place. Tap a card to fill the next empty step.',
  placed: '%n% / %m% placed',
  undo: 'undo',
  lock: 'lock',
  branchesPrompt: 'Build Figure 14-14’s four branches.',
  branchesSub: 'Pick the 4 real branches; %d% of the cards are decoys.',
  picked: '%n% / 4 picked',
  wirePrompt: 'Wire Figure 14-16’s skip connection.',
  wireFrom: 'Tap the block it leaves from.',
  wireTo: 'Now tap the block it joins.',
  cellPrompt: 'Fill in %layer%’s %col%.',
  cellSub: 'Rows above %layer% are hidden.',
  cellSubAll: 'The whole table, with the Activation column hidden.',
  sumPrompt: 'How many feature maps does this module’s depth concat send up to the %block%?',
  sumSub: 'The inception module below it, with the numbers Figure 14-15 prints.',
  sumBar: 'top four numbers',
  hiddenRows: 'rows above hidden',
  keypadCell: '%layer% %col%',
  keypadSum: 'Feature maps',
  figInception: 'Figure 14-14. Inception module (slide 42)',
  figResidual: 'Figure 14-16. Residual learning (slide 46)',
  figGoogLeNet: 'Figure 14-15. GoogLeNet architecture, a part (slide 43)',
  figVgg: 'Slide 44’s description, drawn as blocks',
  figLenet: 'Slide 37 · LeNet-5',
  figAlexnet: 'Slide 39 · AlexNet',
  tableLenet: 'LeNet-5 (slide 37)',
  tableAlexnet: 'AlexNet (slide 39)',
  more: '⋯',
  moduleTag: 'inception module',
  topicTypical: 'Typical CNN architectures',
  topicTransfer: 'Pretrained models · transfer learning',
  wireAria: 'Figure 14-16 without its skip connection; the four blocks are buttons',
  incAria: 'Figure 14-14, the inception module: the input is copied to four branches that meet in a depth concat',
  incSlotsAria: 'Figure 14-14 with its four branches empty; picked branches fill the columns left to right',
  resAria: 'Figure 14-16: Input, Layer 1, Layer 2 and a + node; a skip connection carries the input to the +',
  barAria: 'The module’s top four printed numbers as four stacked segments; they add up to the printed depth',
  towerAria: 'A stack of layers, bottom to top',
  stepsAria: 'Slide 51’s steps, top to bottom',
  tableAria: 'Rows of a layer table',
  input: 'Input',
  concat: 'Depth concat',
  skip: 'Skip connection',
  slot: 'empty slot %n%',
  cols: { layer: 'Layer', type: 'Type', maps: 'Maps', size: 'Size', kernel: 'Kernel size', stride: 'Stride', padding: 'Padding', act: 'Activation' },
  colsShort: { layer: 'Layer', type: 'Type', maps: 'Maps', size: 'Size', kernel: 'Kernel', stride: 'Str.', padding: 'Pad', act: 'Act.' },
  colWord: { size: 'size', maps: 'number of maps' },
  dash: '–',
  answerOrder: 'bottom to top',
};

// ── the seven architectures the slides name ─────────────────────────────
export const ARCHS = {
  lenet5: { name: 'LeNet-5', year: 1998, concept: 'arch.lenet5', src: { lecture: 3, slides: [37] } },
  alexnet: { name: 'AlexNet', year: 2012, concept: 'arch.alexnet', src: { lecture: 3, slides: [38, 39] } },
  googlenet: { name: 'GoogLeNet', year: 2014, concept: 'arch.googlenet', src: { lecture: 3, slides: [41, 42, 43] } },
  vgg: { name: 'VGGNet', year: 2014, concept: 'arch.vgg', src: { lecture: 3, slides: [44] } },
  resnet: { name: 'ResNet', year: 2015, concept: 'arch.resnet', src: { lecture: 3, slides: [45, 46] } },
  xception: { name: 'Xception', year: 2016, concept: 'arch.xception', src: { lecture: 3, slides: [47] } },
  senet: { name: 'SENet', year: 2017, concept: 'arch.senet', src: { lecture: 3, slides: [47] } },
};
// the architectures whose parts the slides draw or tabulate (distractors for picture items)
export const DRAWN = ['lenet5', 'alexnet', 'googlenet', 'vgg', 'resnet'];

// ── slide 37: LeNet-5, bottom (In) → top (Out) as the table prints it ──
// tone = the block colour on the stage (visual only)
export const LENET5 = {
  key: 'lenet5',
  arch: 'lenet5',
  slide: 37,
  src: { lecture: 3, slides: [37] },
  columns: ['layer', 'type', 'maps', 'size', 'kernel', 'stride', 'act'],
  rows: [
    { layer: 'In', type: 'Input', maps: 1, size: [32, 32], kernel: null, stride: null, act: null, tone: 'in', src: { lecture: 3, slides: [37] } },
    { layer: 'C1', type: 'Convolution', maps: 6, size: [28, 28], kernel: 5, stride: 1, act: 'tanh', tone: 'conv', src: { lecture: 3, slides: [37] } },
    { layer: 'S2', type: 'Avg pooling', maps: 6, size: [14, 14], kernel: 2, stride: 2, act: 'tanh', tone: 'pool', src: { lecture: 3, slides: [37] } },
    { layer: 'C3', type: 'Convolution', maps: 16, size: [10, 10], kernel: 5, stride: 1, act: 'tanh', tone: 'conv', src: { lecture: 3, slides: [37] } },
    { layer: 'S4', type: 'Avg pooling', maps: 16, size: [5, 5], kernel: 2, stride: 2, act: 'tanh', tone: 'pool', src: { lecture: 3, slides: [37] } },
    { layer: 'C5', type: 'Convolution', maps: 120, size: [1, 1], kernel: 5, stride: 1, act: 'tanh', tone: 'conv', src: { lecture: 3, slides: [37] } },
    { layer: 'F6', type: 'Fully connected', maps: null, size: 84, kernel: null, stride: null, act: 'tanh', tone: 'fc', src: { lecture: 3, slides: [37] } },
    { layer: 'Out', type: 'Fully connected', maps: null, size: 10, kernel: null, stride: null, act: 'RBF', tone: 'out', src: { lecture: 3, slides: [37] } },
  ],
  merge: [],
};

// ── slide 39: AlexNet, bottom (In) → top (Out). No C7 row on the slide. ──
export const ALEXNET = {
  key: 'alexnet',
  arch: 'alexnet',
  slide: 39,
  src: { lecture: 3, slides: [39] },
  columns: ['layer', 'type', 'maps', 'size', 'kernel', 'stride', 'padding', 'act'],
  rows: [
    { layer: 'In', type: 'Input', maps: 3, mapsNote: '(RGB)', size: [227, 227], kernel: null, stride: null, padding: null, act: null, tone: 'in', src: { lecture: 3, slides: [39] } },
    { layer: 'C1', type: 'Convolution', maps: 96, size: [55, 55], kernel: 11, stride: 4, padding: 'valid', act: 'ReLU', tone: 'conv', src: { lecture: 3, slides: [39] } },
    { layer: 'S2', type: 'Max pooling', maps: 96, size: [27, 27], kernel: 3, stride: 2, padding: 'valid', act: null, tone: 'pool', src: { lecture: 3, slides: [39] } },
    { layer: 'C3', type: 'Convolution', maps: 256, size: [27, 27], kernel: 5, stride: 1, padding: 'same', act: 'ReLU', tone: 'conv', src: { lecture: 3, slides: [39] } },
    { layer: 'S4', type: 'Max pooling', maps: 256, size: [13, 13], kernel: 3, stride: 2, padding: 'valid', act: null, tone: 'pool', src: { lecture: 3, slides: [39] } },
    { layer: 'C5', type: 'Convolution', maps: 384, size: [13, 13], kernel: 3, stride: 1, padding: 'same', act: 'ReLU', tone: 'conv', src: { lecture: 3, slides: [39] } },
    { layer: 'C6', type: 'Convolution', maps: 384, size: [13, 13], kernel: 3, stride: 1, padding: 'same', act: 'ReLU', tone: 'conv', src: { lecture: 3, slides: [39] } },
    // the slide jumps from C6 (384 maps) to S8 (256 maps): its maps are never asked (QUIRKS l3.quirk.alexnetC7)
    { layer: 'S8', type: 'Max pooling', maps: 256, size: [6, 6], kernel: 3, stride: 2, padding: 'valid', act: null, tone: 'pool', noMapsCell: true, src: { lecture: 3, slides: [39] } },
    { layer: 'F9', type: 'Fully connected', maps: null, size: 4096, kernel: null, stride: null, padding: null, act: 'ReLU', tone: 'fc', src: { lecture: 3, slides: [39] } },
    { layer: 'F10', type: 'Fully connected', maps: null, size: 4096, kernel: null, stride: null, padding: null, act: 'ReLU', tone: 'fc', src: { lecture: 3, slides: [39] } },
    { layer: 'Out', type: 'Fully connected', maps: null, size: 1000, kernel: null, stride: null, padding: null, act: 'Softmax', tone: 'out', src: { lecture: 3, slides: [39] } },
  ],
  // identical rows become one stacking card (two identical cards could swap places)
  merge: [['C5', 'C6'], ['F9', 'F10']],
};

// ── slide 43: Figure 14-15, GoogLeNet, bottom → top ─────────────────────
export const GOOGLENET = {
  key: 'googlenet',
  arch: 'googlenet',
  slide: 43,
  src: { lecture: 3, slides: [43] },
  tower: [
    { id: 'g.in', label: 'Input', tone: 'in' },
    { id: 'g.c1', label: 'Convolution', sub: '64, 7×7+2(S)', tone: 'conv' },
    { id: 'g.p1', label: 'Max pool', sub: '64, 3×3+2(S)', tone: 'pool' },
    { id: 'g.lrn1', label: 'Local response normalization', tone: 'lrn' },
    { id: 'g.c2', label: 'Convolution', sub: '64, 1×1+1(S)', tone: 'conv' },
    { id: 'g.c3', label: 'Convolution', sub: '192, 3×3+1(S)', tone: 'conv' },
    { id: 'g.lrn2', label: 'Local response normalization', tone: 'lrn' },
    { id: 'g.p2', label: 'Max pool', sub: '192, 3×3+2(S)', tone: 'pool' },
    { id: 'g.inc2a', label: '2 inception modules', tone: 'inc' },
    { id: 'g.p480', label: 'Max pool', sub: '480, 3×3+2(S)', tone: 'pool' },
    { id: 'g.inc5', label: '5 inception modules', tone: 'inc' },
    { id: 'g.p832', label: 'Max pool', sub: '832, 3×3+2(S)', tone: 'pool' },
    { id: 'g.inc2b', label: '2 inception modules', tone: 'inc' },
    { id: 'g.gap', label: 'Global avg pool', sub: '1024', tone: 'pool' },
    { id: 'g.drop', label: 'Dropout 40%', tone: 'drop' },
    { id: 'g.fc', label: 'Fully connected', sub: '1000 units', tone: 'fc' },
    { id: 'g.soft', label: 'Softmax', tone: 'out' },
  ],
  // the nine inception modules' numbers exactly as the figure prints them, bottom → top
  // (the slide does not label them; the top four of a module add up to the depth the figure prints above it)
  modules: [
    { top: [64, 128, 32, 32], bottom: [96, 12] },
    { top: [128, 192, 96, 64], bottom: [128, 32] },
    { top: [192, 208, 48, 64], bottom: [96, 16] },
    { top: [160, 224, 64, 64], bottom: [112, 24] },
    { top: [128, 256, 64, 64], bottom: [128, 24] },
    { top: [112, 288, 64, 64], bottom: [144, 32] },
    { top: [256, 320, 128, 128], bottom: [160, 32] },
    { top: [256, 320, 128, 128], bottom: [160, 32] },
    { top: [384, 384, 128, 128], bottom: [192, 48] },
  ],
  // the three depths the figure prints right above a module
  sums: [
    { id: 'sum480', module: 1, into: 'Max pool 480, 3×3+2(S)', label: 'Max pool', sub: '?, 3×3+2(S)', tone: 'pool', printed: 480, src: { lecture: 3, slides: [42, 43] } },
    { id: 'sum832', module: 6, into: 'Max pool 832, 3×3+2(S)', label: 'Max pool', sub: '?, 3×3+2(S)', tone: 'pool', printed: 832, src: { lecture: 3, slides: [42, 43] } },
    { id: 'sum1024', module: 8, into: 'Global avg pool 1024', label: 'Global avg pool', sub: '?', tone: 'pool', printed: 1024, also: '8 × 8 × 1024', src: { lecture: 3, slides: [42, 43] } },
  ],
  // level 2 draws tower[8 … 16]; these may become cards (the two "2 inception modules" stay fixed)
  view: [8, 16],
  orderable: ['g.p480', 'g.inc5', 'g.p832', 'g.gap', 'g.drop', 'g.fc', 'g.soft'],
  fragments: {
    stem: ['g.c2', 'g.c3', 'g.lrn2', 'g.p2'],
    head: ['g.gap', 'g.drop', 'g.fc', 'g.soft'],
  },
  facts: {
    numbers: 'Slide 43: ImageNet images are 256 × 256 with 1000 classes; the network has 9 inception modules; the first one’s input is 32 × 32 × 192 and the global avg pool’s input is 8 × 8 × 1024 (m × 8 × 8 × 1024 for a minibatch of size m).',
  },
};

// slide 43: "there are 1000 classes" (AlexNet's softmax Out row, slide 39, prints 1,000)
export const IMAGENET = { classes: 1000, src: { lecture: 3, slides: [43] } };

// ── slide 42: Figure 14-14, the inception module ────────────────────────
// parts bottom → top; branches left → right as drawn
export const INCEPTION = {
  src: { lecture: 3, slides: [42] },
  branches: [
    { id: 'b1', parts: [{ type: 'Convolution', spec: '1×1 + 1(S)', tone: 'conv' }] },
    { id: 'b3', parts: [{ type: 'Convolution', spec: '1×1 + 1(S)', tone: 'conv' }, { type: 'Convolution', spec: '3×3 + 1(S)', tone: 'conv' }] },
    { id: 'b5', parts: [{ type: 'Convolution', spec: '1×1 + 1(S)', tone: 'conv' }, { type: 'Convolution', spec: '5×5 + 1(S)', tone: 'conv' }] },
    { id: 'bp', parts: [{ type: 'Max pool', spec: '3×3+1(S)', tone: 'pool' }, { type: 'Convolution', spec: '1×1 + 1(S)', tone: 'conv' }] },
  ],
  // each decoy contradicts the figure or slide 42's text
  decoys: [
    { id: 'x31', parts: [{ type: 'Convolution', spec: '3×3 + 1(S)', tone: 'conv' }, { type: 'Convolution', spec: '1×1 + 1(S)', tone: 'conv' }], note: 'the figure puts the 1 × 1 below the 3 × 3' },
    { id: 'xp2', parts: [{ type: 'Max pool', spec: '3×3+2(S)', tone: 'pool' }, { type: 'Convolution', spec: '1×1 + 1(S)', tone: 'conv' }], note: 'the module’s max pool is 3×3+1(S): stride 1' },
    { id: 'x7', parts: [{ type: 'Convolution', spec: '1×1 + 1(S)', tone: 'conv' }, { type: 'Convolution', spec: '7×7 + 1(S)', tone: 'conv' }], note: 'the second set uses 1 × 1, 3 × 3 and 5 × 5 only' },
    { id: 'x5', parts: [{ type: 'Convolution', spec: '5×5 + 1(S)', tone: 'conv' }], note: 'the figure’s single-conv branch is the 1 × 1; the 5 × 5 sits on a 1 × 1' },
  ],
  why: 'Figure 14-14 (slide 42): the input is copied to four branches: a 1 × 1 conv; 1 × 1 → 3 × 3; 1 × 1 → 5 × 5; and a 3 × 3 max pool → 1 × 1. Every layer is "+1(S)" (stride 1, "same" padding), so the four outputs have the same size and the depth concat can stack them.',
};

// ── slide 46: Figure 14-16, the residual unit ───────────────────────────
export const RESIDUAL = {
  src: { lecture: 3, slides: [46] },
  blocks: [
    { id: 'in', label: 'Input', key: '1' },
    { id: 'l1', label: 'Layer 1', key: '2' },
    { id: 'l2', label: 'Layer 2', key: '3' },
    { id: 'add', label: '+', key: '4' },
  ],
  out: 'h(x)',
  fx: 'f(x) = h(x) − x',
  answer: ['in', 'add'],
  why: 'Figure 14-16 (slide 46): the skip connection carries the input x past Layer 1 and Layer 2 to the + node, which adds it to their output. The layers are forced to model $f(\\mathbf{x}) = h(\\mathbf{x}) - \\mathbf{x}$, and the unit outputs $h(\\mathbf{x})$: residual learning.',
};

// ── slide 44: VGGNet's description, drawn as blocks (bottom → top) ──────
export const VGG = {
  src: { lecture: 3, slides: [44] },
  tower: [
    { label: 'Input', tone: 'in' },
    { label: 'Convolution', sub: '3×3', tone: 'conv' },
    { label: 'Convolution', sub: '3×3', tone: 'conv' },
    { label: 'Pooling', tone: 'pool' },
    { label: 'Convolution', sub: '3×3', tone: 'conv' },
    { label: 'Convolution', sub: '3×3', tone: 'conv' },
    { label: 'Convolution', sub: '3×3', tone: 'conv' },
    { label: 'Pooling', tone: 'pool' },
    { label: '⋯ 16 or 19 conv layers in all', tone: 'more' },
    { label: 'Dense', sub: 'hidden', tone: 'fc' },
    { label: 'Dense', sub: 'hidden', tone: 'fc' },
    { label: 'Output', tone: 'out' },
  ],
};

// ── level 1: claim → name (choices: the answer + 3 others, never one in `not`) ──
// tier 1 = the headline claims; tier 2 = who / details / the one-paragraph nets
export const CLAIMS = [
  { id: 'lecun', arch: 'lenet5', tier: 1, text: 'Created by Yann LeCun in 1998 and widely used for handwritten digit recognition (MNIST).', src: { lecture: 3, slides: [37] },
    why: 'Slide 37: LeNet-5, perhaps the most widely known CNN architecture, was created by Yann LeCun in 1998 and widely used for handwritten digit recognition (MNIST).' },
  { id: 'tanhRbf', arch: 'lenet5', tier: 2, text: 'Its activations are tanh, with an RBF output; today we would use ReLU and softmax instead.', src: { lecture: 3, slides: [37] },
    why: 'Slide 37: the main difference between LeNet-5 and more modern classification CNNs is the activation functions: ReLU instead of tanh and softmax instead of RBF.' },
  { id: 'alex17', arch: 'alexnet', tier: 1, text: 'Won the 2012 ILSVRC challenge with a 17% top-5 error rate, while the second best achieved only 26%.', src: { lecture: 3, slides: [38] },
    why: 'Slide 38: AlexNet won the 2012 ImageNet ILSVRC challenge by a large margin: 17% top-5 error against 26% for the second best.' },
  { id: 'alexStack', arch: 'alexnet', tier: 1, not: ['vgg'], text: 'The first to stack convolutional layers directly on top of each other, instead of a pooling layer on top of each one.', src: { lecture: 3, slides: [38] },
    why: 'Slide 38: AlexNet is quite similar to LeNet-5, only much larger and deeper, and it was the first to stack convolutional layers directly on top of each other.' },
  { id: 'alexWho', arch: 'alexnet', tier: 2, text: 'Developed by Alex Krizhevsky, Ilya Sutskever and Geoffrey Hinton.', src: { lecture: 3, slides: [38] },
    why: 'Slide 38: AlexNet was developed by Alex Krizhevsky (hence the name), Ilya Sutskever and Geoffrey Hinton.' },
  { id: 'alexReg', arch: 'alexnet', tier: 2, text: 'Used 50% dropout on the outputs of F9 and F10, and data augmentation by shifting, flipping and changing the lighting.', src: { lecture: 3, slides: [39] },
    why: 'Slide 39: to reduce overfitting AlexNet’s authors used dropout (50% rate) on the outputs of layers F9 and F10, and data augmentation (random shifts, horizontal flips, lighting changes).' },
  { id: 'goog7', arch: 'googlenet', tier: 1, text: 'Won the ILSVRC 2014 challenge by pushing the top-5 error rate below 7%.', src: { lecture: 3, slides: [41] },
    why: 'Slide 41: GoogLeNet won ILSVRC 2014 with a top-5 error rate below 7%. VGGNet was the 2014 runner-up (slide 44).' },
  { id: 'goog10x', arch: 'googlenet', tier: 1, not: ['alexnet', 'lenet5', 'senet'], text: 'Has 10 times fewer parameters than AlexNet: roughly 6 million instead of 60 million.', src: { lecture: 3, slides: [41] },
    why: 'Slide 41: inception modules let GoogLeNet use parameters much more efficiently; it has 10 times fewer parameters than AlexNet (roughly 6 million instead of 60 million).' },
  { id: 'googInception', arch: 'googlenet', tier: 1, not: ['xception', 'senet'], text: 'Its sub-networks called inception modules let it go much deeper than previous CNNs.', src: { lecture: 3, slides: [41] },
    why: 'Slide 41: GoogLeNet’s performance came in large part from being much deeper than previous CNNs, made possible by sub-networks called inception modules.' },
  { id: 'googWho', arch: 'googlenet', tier: 2, text: 'Developed by Christian Szegedy et al. from Google Research.', src: { lecture: 3, slides: [41] },
    why: 'Slide 41: the GoogLeNet architecture was developed by Christian Szegedy et al. from Google Research.' },
  { id: 'googNine', arch: 'googlenet', tier: 2, not: ['xception', 'senet'], text: 'Has 9 inception modules; the input to the global avg pool is 8 × 8 × 1024.', src: { lecture: 3, slides: [43] },
    why: 'Slide 43: GoogLeNet has 9 inception modules, and the input to its global avg pool is 8 × 8 × 1024 (m × 8 × 8 × 1024 for a minibatch of size m).' },
  { id: 'vggRunner', arch: 'vgg', tier: 1, text: 'The runner-up in ILSVRC 2014, from the Visual Geometry Group research lab at Oxford.', src: { lecture: 3, slides: [44] },
    why: 'Slide 44: VGGNet, by Karen Simonyan and Andrew Zisserman of Oxford’s Visual Geometry Group (VGG), was the ILSVRC 2014 runner-up; GoogLeNet won that year (slide 41).' },
  { id: 'vgg33', arch: 'vgg', tier: 1, text: 'Used only 3 × 3 filters, but many filters: 2 or 3 conv layers and a pooling layer, again and again.', src: { lecture: 3, slides: [44] },
    why: 'Slide 44: VGGNet had a very simple, classical architecture: 2 or 3 convolutional layers and a pooling layer, repeated, using only 3 × 3 filters but many of them.' },
  { id: 'vggDepth', arch: 'vgg', tier: 2, text: 'Reached a total of just 16 or 19 convolutional layers, depending on the variant, plus a dense network with 2 hidden layers.', src: { lecture: 3, slides: [44] },
    why: 'Slide 44: VGGNet reached a total of just 16 or 19 convolutional layers depending on the variant, plus a final dense network with 2 hidden layers and the output layer.' },
  { id: 'res36', arch: 'resnet', tier: 1, text: 'Won the ILSVRC challenge in 2015 with a top-five error rate under 3.6%.', src: { lecture: 3, slides: [45] },
    why: 'Slide 45: ResNet won the ILSVRC challenge in 2015 with an astounding top-five error rate under 3.6%.' },
  { id: 'res152', arch: 'resnet', tier: 1, text: 'Its winning variant was an extremely deep CNN of 152 layers; other variants have 34, 50 and 101.', src: { lecture: 3, slides: [45] },
    why: 'Slide 45: ResNet’s winning variant used an extremely deep CNN composed of 152 layers (other variants have 34, 50 and 101 layers).' },
  { id: 'resSkip', arch: 'resnet', tier: 1, not: ['senet', 'xception'], text: 'The key to training such a deep network is skip connections, also called shortcut connections.', src: { lecture: 3, slides: [46] },
    why: 'Slide 46: the key to being able to train ResNet’s very deep network is to use skip connections (also called shortcut connections).' },
  { id: 'resWho', arch: 'resnet', tier: 2, text: 'Proposed by Kaiming He et al.', src: { lecture: 3, slides: [45] },
    why: 'Slide 45: the Residual Network (ResNet) was proposed by Kaiming He et al.' },
  { id: 'xcChollet', arch: 'xception', tier: 2, text: 'A variant of GoogLeNet proposed in 2016 by François Chollet, the author of Keras.', src: { lecture: 3, slides: [47] },
    why: 'Slide 47: Xception (2016) is a variant of GoogLeNet proposed by François Chollet, the author of Keras.' },
  { id: 'xc350', arch: 'xception', tier: 2, text: 'Significantly outperformed Inception-v3 on a huge vision task: 350 million images and 17,000 classes.', src: { lecture: 3, slides: [47] },
    why: 'Slide 47: Xception significantly outperformed Inception-v3 on a huge vision task (350 million images and 17,000 classes).' },
  { id: 'se225', arch: 'senet', tier: 2, text: 'Won the ILSVRC 2017 challenge with an astonishing 2.25% top-five error rate.', src: { lecture: 3, slides: [47] },
    why: 'Slide 47: SENet was the winning architecture in the ILSVRC 2017 challenge, with a 2.25% top-five error rate.' },
  { id: 'seExtends', arch: 'senet', tier: 2, not: ['xception'], text: 'Extends existing architectures such as inception networks and ResNets, and boosts their performance.', src: { lecture: 3, slides: [47] },
    why: 'Slide 47: SENet extends existing architectures such as inception networks and ResNets, and boosts their performance.' },
  { id: 'seName', arch: 'senet', tier: 2, text: 'Its name stands for Squeeze-and-Excitation Network.', src: { lecture: 3, slides: [47] },
    why: 'Slide 47: SENet stands for Squeeze-and-Excitation Network. The slides name it but do not draw its block.' },
];

// ── level 1: name → number / phrase (choices are the listed options, shuffled) ──
export const NUMBERS = [
  { id: 'alexErr', concept: 'arch.ilsvrc', tier: 1, exhibit: 'AlexNet · ILSVRC 2012', q: 'AlexNet’s top-5 error rate?', answer: '17%', wrong: ['26%', 'below 7%', 'under 3.6%'], src: { lecture: 3, slides: [38] },
    why: 'Slide 38: AlexNet achieved a 17% top-5 error rate; 26% was the second best that year.' },
  { id: 'googErr', concept: 'arch.ilsvrc', tier: 1, exhibit: 'GoogLeNet · ILSVRC 2014', q: 'GoogLeNet’s top-5 error rate?', answer: 'below 7%', wrong: ['17%', 'under 3.6%', '2.25%'], src: { lecture: 3, slides: [41] },
    why: 'Slide 41: GoogLeNet won ILSVRC 2014 by pushing the top-5 error rate below 7%.' },
  { id: 'resErr', concept: 'arch.ilsvrc', tier: 1, exhibit: 'ResNet · ILSVRC 2015', q: 'ResNet’s top-five error rate?', answer: 'under 3.6%', wrong: ['below 7%', '17%', '2.25%'], src: { lecture: 3, slides: [45] },
    why: 'Slide 45: ResNet won the 2015 challenge with a top-five error rate under 3.6%.' },
  { id: 'seErr', concept: 'arch.ilsvrc', tier: 2, exhibit: 'SENet · ILSVRC 2017', q: 'SENet’s top-five error rate?', answer: '2.25%', wrong: ['under 3.6%', 'below 7%', '17%'], src: { lecture: 3, slides: [47] },
    why: 'Slide 47: SENet won ILSVRC 2017 with an astonishing 2.25% top-five error rate.' },
  { id: 'resDepth', concept: 'arch.resnet', tier: 1, exhibit: 'ResNet · the winning variant', q: 'How many layers?', answer: '152', wrong: ['34', '50', '101'], src: { lecture: 3, slides: [45] },
    why: 'Slide 45: the winning ResNet was an extremely deep CNN of 152 layers; 34, 50 and 101 are the other variants.' },
  { id: 'vggDepthN', concept: 'arch.vgg', tier: 2, exhibit: 'VGGNet', q: 'How many convolutional layers in total?', answer: '16 or 19', wrong: ['2 or 3', '34 or 50', '152'], src: { lecture: 3, slides: [44] },
    why: 'Slide 44: VGGNet reached a total of just 16 or 19 convolutional layers, depending on the variant; 2 or 3 is how many it stacks before each pooling layer.' },
  { id: 'googParams', concept: 'arch.googlenet', tier: 1, exhibit: 'GoogLeNet vs AlexNet', q: 'GoogLeNet’s parameters, compared with AlexNet’s?', answer: '10 times fewer (≈ 6 million vs 60 million)', wrong: ['10 times more (≈ 60 million vs 6 million)', 'about the same (≈ 60 million each)', '2 times fewer (≈ 30 million vs 60 million)'], src: { lecture: 3, slides: [41] },
    why: 'Slide 41: GoogLeNet has 10 times fewer parameters than AlexNet: roughly 6 million instead of 60 million.' },
  { id: 'googModules', concept: 'arch.googlenet', tier: 2, exhibit: 'GoogLeNet', q: 'How many inception modules does the network have?', answer: '9', wrong: ['2', '5', '16'], src: { lecture: 3, slides: [43] },
    why: 'Slide 43: the network has 9 inception modules; Figure 14-15 draws them in groups of 2, 5 and 2.' },
  { id: 'top5', concept: 'arch.ilsvrc', tier: 2, exhibit: 'ILSVRC', q: 'What does the top-5 error rate count?', answer: 'test images whose top five predictions did not include the correct answer',
    wrong: ['test images whose single top prediction was wrong', 'classes that were wrong in 5 or more test images', 'test images misclassified by 5 or more models'], src: { lecture: 3, slides: [36] },
    why: 'Slide 36 (footnote 7): the top-five error rate is the number of test images for which the system’s top five predictions did not include the correct answer.' },
  { id: 'sixYears', concept: 'arch.ilsvrc', tier: 2, exhibit: 'ILSVRC', q: 'The top-5 error fell from over 26% to less than 3% in…', answer: 'just six years', wrong: ['just two years', 'twelve years', 'twenty years'], src: { lecture: 3, slides: [36] },
    why: 'Slide 36: in the ILSVRC ImageNet Challenge the top-5 error rate for image classification fell from over 26% to less than 3% in just six years.' },
];
// "Which year does the slide give?" — generated from ARCHS (the years in the slide headings)
export const YEARS = {
  q: 'Which year do the slides give for it?',
  why: 'Slide %slide%: %name% (%year%).',
  slideOf: { lenet5: 37, alexnet: 38, googlenet: 41, vgg: 44, resnet: 45, xception: 47, senet: 47 },
};

// ── level 1: pictures → name ────────────────────────────────────────────
export const FRAGMENTS = {
  lenetRows: { arch: 'lenet5', concept: 'arch.lenet5', src: { lecture: 3, slides: [37] },
    why: 'Slide 37’s LeNet-5 table: tanh activations, average pooling with 2 × 2 kernels and stride 2, a 32 × 32 input and an RBF output.' },
  alexRows: { arch: 'alexnet', concept: 'arch.alexnet', src: { lecture: 3, slides: [39] },
    why: 'Slide 39’s AlexNet table: ReLU, 3 × 3 max pooling with stride 2, a padding column (valid / same), and an 11 × 11 stride-4 first layer on a 227 × 227 RGB input.' },
  inception: { arch: 'googlenet', concept: 'arch.inception', not: ['xception', 'senet'], src: { lecture: 3, slides: [41, 42] },
    why: 'Figure 14-14 is GoogLeNet’s inception module (slide 41): the input is copied to four branches that are joined by a depth concat (slide 42).' },
  residual: { arch: 'resnet', concept: 'arch.resnet', not: ['xception', 'senet'], src: { lecture: 3, slides: [46] },
    why: 'Figure 14-16 (slide 46) is ResNet’s residual learning: a skip connection adds the input $\\mathbf{x}$ to the layers’ output, so they model $f(\\mathbf{x}) = h(\\mathbf{x}) - \\mathbf{x}$.' },
  vgg: { arch: 'vgg', concept: 'arch.vgg', src: { lecture: 3, slides: [44] },
    why: 'Slide 44’s VGGNet: 2 or 3 conv layers and a pooling layer, repeated, only 3 × 3 filters (16 or 19 conv layers in all), then a dense network with 2 hidden layers and the output layer.' },
  googStem: { arch: 'googlenet', concept: 'arch.googlenet', not: ['xception', 'senet'], src: { lecture: 3, slides: [43] },
    why: 'These blocks are from Figure 14-15 (slide 43), the bottom of GoogLeNet. Local response normalization appears in the slides only as two blocks in that figure; they never explain it.' },
  googHead: { arch: 'googlenet', concept: 'arch.googlenet', not: ['xception', 'senet', 'resnet'], src: { lecture: 3, slides: [43] },
    why: 'The top of Figure 14-15 (slide 43), GoogLeNet: global avg pool 1024 → dropout 40% → fully connected 1000 units → softmax.' },
};

// ── level 2: one-tap follow-ups on the two figures ─────────────────────
export const QUICK = [
  { id: 'axis', concept: 'arch.inception', figure: 'inception', q: 'The depth concat stacks the four branches along which axis?', answer: 'axis=3 (depth)', wrong: ['axis=0', 'axis=1 (height)', 'axis=2 (width)'], src: { lecture: 3, slides: [42, 43] },
    why: 'Slide 42: the depth concat step concatenates along the depth dimension (axis=3); a minibatch is a 4D tensor, m × height × width × channels (slide 43).' },
  { id: 'same', concept: 'arch.inception', figure: 'inception', q: 'Why does every layer in the module use "same" padding?', answer: 'so all four branches output feature maps of the same size, which the depth concat needs',
    wrong: ['so each branch halves the height and width', 'so the module has no parameters to learn', 'so the conv layers can skip the ReLU'], src: { lecture: 3, slides: [42] },
    why: 'Slide 42: the "same" padding used in all the layers ensures the feature maps they produce are the same size, which allows the final depth concat step.' },
  { id: 'scales', concept: 'arch.inception', figure: 'inception', q: 'Why do the second-set convs use 1 × 1, 3 × 3 and 5 × 5 kernels?', answer: 'to capture patterns at different scales',
    wrong: ['to make feature maps of different sizes', 'to replace the ReLU activations', 'to reduce the image without pooling'], src: { lecture: 3, slides: [42] },
    why: 'Slide 42: the second set of convolutional layers use different kernel sizes (1 × 1, 3 × 3 and 5 × 5), allowing them to capture patterns at different scales. ("Same" padding keeps every map the same size.)' },
  { id: 'fx', concept: 'arch.resnet', figure: 'residual', hide: 'fx', q: 'What are Layer 1 and Layer 2 forced to model?', answer: 'f(x) = h(x) − x', wrong: ['h(x)', 'h(x) + x', 'x − h(x)'], src: { lecture: 3, slides: [46] },
    why: 'Slide 46: by adding the feature $\\mathbf{x}$ to a deeper layer, the network is forced to model $f(\\mathbf{x}) = h(\\mathbf{x}) - \\mathbf{x}$ rather than the target $h(\\mathbf{x})$: residual learning.' },
  { id: 'add', concept: 'arch.resnet', figure: 'residual', q: 'What does the + node add together?', answer: 'the input x and the output of Layer 2', wrong: ['the outputs of Layer 1 and Layer 2', 'the input x and the output of Layer 1', 'h(x) and f(x)'], src: { lecture: 3, slides: [46] },
    why: 'Figure 14-16 (slide 46): the skip connection carries the input $\\mathbf{x}$ past both layers, and the + adds it to Layer 2’s output: $f(\\mathbf{x}) + \\mathbf{x} = h(\\mathbf{x})$.' },
  { id: 'unitOut', concept: 'arch.resnet', figure: 'residual', hide: 'out', q: 'What leaves the residual unit above the + node?', answer: 'h(x)', wrong: ['f(x)', 'x', 'h(x) − x'], src: { lecture: 3, slides: [46] },
    why: 'Figure 14-16 (slide 46): the layers model $f(\\mathbf{x}) = h(\\mathbf{x}) - \\mathbf{x}$ and the + adds $\\mathbf{x}$ back, so the unit outputs the target $h(\\mathbf{x})$.' },
];

// ── level 2 / 3: the stacks to put in order ─────────────────────────────
export const ORDERS = {
  lenet5: { concept: 'arch.lenet5', name: 'LeNet-5', src: { lecture: 3, slides: [33, 37] },
    why: 'Slide 37 bottom to top: In 1@32×32 → C1 conv 6@28×28 → S2 avg pool 6@14×14 → C3 conv 16@10×10 → S4 avg pool 16@5×5 → C5 conv 120@1×1 → F6 84 → Out 10 (RBF). The image gets smaller and deeper (slide 33).' },
  alexnet: { concept: 'arch.alexnet', name: 'AlexNet', src: { lecture: 3, slides: [39] },
    why: 'Slide 39 bottom to top: In 3@227×227 → C1 96@55×55 → S2 96@27×27 → C3 256@27×27 → S4 256@13×13 → C5, C6 384@13×13 → S8 256@6×6 → F9, F10 4,096 → Out 1,000 softmax. (The table has no C7 row, so S8’s 256 maps do not follow C6’s 384.)' },
  googlenet: { concept: 'arch.googlenet', name: 'GoogLeNet', src: { lecture: 3, slides: [43] },
    why: 'Figure 14-15 (slide 43) bottom to top: 2 inception modules → max pool 480 → 5 inception modules → max pool 832 → 2 inception modules → global avg pool 1024 → dropout 40% → fully connected 1000 units → softmax.' },
  finetune: { concept: 'transfer.finetune', name: 'fine-tuning', src: { lecture: 3, slides: [51] },
    why: 'Slide 51: freeze the pretrained layers, compile and train for a few epochs (SGD learning_rate=0.1, epochs=3); then unfreeze base_model.layers[56:], compile again (SGD learning_rate=0.01) and train for a few more epochs (epochs=10).' },
};
// slide 51's code as steps (top → bottom); the first two are always in place
export const FINETUNE = [
  { id: 'ft.load', label: 'load the Xception model', code: 'base_model = Xception(weights="imagenet", include_top=False)', fixed: true },
  { id: 'ft.head', label: 'add the head', code: 'GlobalAveragePooling2D() → Dense(n_classes, activation="softmax")', fixed: true },
  { id: 'ft.freeze', label: 'freeze the pretrained layers', code: 'for layer in base_model.layers: layer.trainable = False' },
  { id: 'ft.compile1', label: 'compile', code: 'SGD(learning_rate=0.1, momentum=0.9)' },
  { id: 'ft.fit1', label: 'train', code: 'model.fit(…, epochs=3)' },
  { id: 'ft.unfreeze', label: 'unfreeze some layers', code: 'for layer in base_model.layers[56:]: layer.trainable = True' },
  { id: 'ft.compile2', label: 'compile', code: 'SGD(learning_rate=0.01, momentum=0.9)' },
  { id: 'ft.fit2', label: 'train', code: 'model.fit(…, epochs=10)' },
];

// ── level 3: the table-cell rules (why texts; %tokens% filled per cell) ──
export const RULES = {
  valid1: {
    src: { lecture: 3, slides: [20] },
    text: 'Slide %slide%’s table prints no padding, but 32 → 28 under C1’s 5 × 5 kernel means none, so its convs are taken as "valid" (the kernel does not go outside the image boundary, slide 20). %layer%’s %f% × %f% kernel at stride 1 stays inside the map, so each axis loses $f - 1$ pixels: %n% − %f% + 1 = %out%, the %out% × %out% slide %slide% prints.',
    maths: ['$\\text{positions} = n - f + 1 = %n% - %f% + 1$'],
  },
  tile: {
    src: { lecture: 3, slides: [26] },
    text: '%layer%’s %f% × %f% pooling windows at stride %s% tile the map without overlapping, like slide 26’s 2 × 2, stride-2 max pooling, so %n% × %n% becomes %out% × %out%, as slide %slide% prints.',
    maths: ['$%f% \\times %f%$ windows, stride %s%: $n / %s% = %n% / %s%$'],
  },
  same1: {
    src: { lecture: 3, slides: [20] },
    text: '%layer% uses "same" padding at stride 1, and "same" keeps the height and width (slide 20): %n% × %n% stays %out% × %out%, as slide %slide% prints.',
    maths: ['"same", stride 1: the output keeps $n = %n%$'],
  },
  validS: {
    src: { lecture: 3, slides: [9, 20, 21] },
    text: '%layer%: a "valid" %f% × %f% window fits $n - f + 1$ = %n% − %f% + 1 = %pos% positions per axis, and stride %s% keeps the first and every %sth% one after it (slides 9, 21): %out%, the %out% × %out% slide %slide% prints.',
    maths: ['$\\text{positions} = n - f + 1 = %n% - %f% + 1$', 'stride %s%: keep the 1st position and every %sth% one after it'],
  },
  pooledMaps: {
    src: { lecture: 3, slides: [29] },
    text: 'A pooling layer typically works on every input channel independently, so its output depth is the same as its input depth (slide 29): %layer% keeps %prev%’s %out% maps.',
    maths: ['pooling: depth out = depth in (%prev%)'],
  },
  classes: {
    src: { lecture: 3, slides: [33, 43] },
    text: 'The final layer is a softmax that outputs the estimated class probabilities (slide 33), one per class, and ImageNet has 1000 classes (slide 43): Out has 1,000.',
    maths: ['softmax: one estimated probability per class', 'ImageNet: 1000 classes (slide 43)'],
  },
  sum: {
    src: { lecture: 3, slides: [42, 43] },
    text: 'The depth concat stacks the module’s outputs along the depth dimension (axis=3, slide 42), and Figure 14-15 prints %out% on “%into%” (slide 43). The slide does not label the module’s numbers; the top four printed numbers add up to the printed depth: %calc% = %out%.',
    maths: ['the top four printed numbers add up to the printed depth', '$%calc% = %out%$'],
  },
};
// which cells each tier may ask (level 3 ramps 1 → 3)
export const CELL_TIERS = {
  valid1: 1,
  pooledMaps: 1,
  tile: 2,
  same1: 2,
  classes: 2,
  validS: 3,
};

// ── level 3: slides 33–34, typical CNN architecture ─────────────────────
export const TYPICAL = [
  { id: 'replace5', q: 'Instead of one conv layer with a 5 × 5 kernel, the slides recommend…', answer: 'two stacked conv layers with 3 × 3 kernels',
    wrong: ['one conv layer with a 7 × 7 kernel', 'two stacked conv layers with 5 × 5 kernels', 'a 5 × 5 pooling layer'], src: { lecture: 3, slides: [34] },
    why: 'Slide 34: it is better to stack two convolutional layers with 3 × 3 kernels than to use one layer with a 5 × 5 kernel.' },
  { id: 'why33', q: 'Why are two stacked 3 × 3 conv layers better than one 5 × 5?', answer: 'fewer parameters, less computation, and usually better performance',
    wrong: ['more parameters, so more capacity', 'no padding is needed', 'no pooling layers are needed'], src: { lecture: 3, slides: [34] },
    why: 'Slide 34: with two 3 × 3 layers the network uses fewer parameters (and less computation) and will usually perform better.' },
  { id: 'first', q: 'Which layer can typically use a large kernel (e.g. 5 × 5), usually with a stride of 2 or more?', answer: 'the first convolutional layer',
    wrong: ['the last convolutional layer', 'every pooling layer', 'the fully connected layers'], src: { lecture: 3, slides: [34] },
    why: 'Slide 34: one exception to "no large kernels" is the first convolutional layer, which can have a large kernel (e.g. 5 × 5), usually with a stride of 2 or more.' },
  { id: 'firstWhy', q: 'Why give the first conv layer a large kernel with a stride of 2 or more?', answer: 'to reduce the spatial dimension of the image without losing too much information',
    wrong: ['to add more feature maps early', 'to capture patterns at different scales', 'to replace the fully connected layers'], src: { lecture: 3, slides: [34] },
    why: 'Slide 34: a large first kernel with stride 2 or more reduces the spatial dimension of the image without losing too much information.' },
  { id: 'mistake', q: 'A common mistake when designing a CNN, per the slides?', answer: 'using convolution kernels that are too large',
    wrong: ['using too many 3 × 3 kernels', 'putting a pooling layer after the conv layers', 'adding fully connected layers near the output'], src: { lecture: 3, slides: [34] },
    why: 'Slide 34: a common mistake is to use convolution kernels that are too large.' },
  { id: 'shape', q: 'As it goes up a typical CNN, the image gets…', answer: 'smaller and smaller, but deeper and deeper (more feature maps)',
    wrong: ['bigger and bigger, and deeper and deeper', 'smaller and smaller, and shallower (fewer feature maps)', 'the same size, but deeper and deeper'], src: { lecture: 3, slides: [33] },
    why: 'Slide 33: the image gets smaller and smaller as it progresses through the network, but it also typically gets deeper and deeper (more feature maps).' },
  { id: 'head', q: 'What does a typical CNN add near the output layer?', answer: 'a few fully connected layers (+ReLUs), then a final layer such as a softmax',
    wrong: ['another stack of pooling layers', 'a depth concat of all the feature maps', 'a skip connection back to the input'], src: { lecture: 3, slides: [33] },
    why: 'Slide 33: near the output a regular feedforward network of a few fully connected layers (+ReLUs) is added, and the final layer outputs the prediction (e.g. a softmax of class probabilities).' },
  { id: 'stack', q: 'The typical CNN stack, bottom to top?', answer: 'a few conv layers (+ReLU), a pooling layer, a few more conv layers (+ReLU), another pooling layer, and so on',
    wrong: ['all the pooling layers first, then all the conv layers', 'a pooling layer after every fully connected layer', 'fully connected layers first, then conv layers'], src: { lecture: 3, slides: [33] },
    why: 'Slide 33: typical CNNs stack a few convolutional layers (each generally followed by a ReLU), then a pooling layer, then another few conv layers (+ReLU), then another pooling layer, and so on.' },
];

// ── level 3: slides 49–51, pretrained models and transfer learning ──────
export const TRANSFER = [
  { id: 'lr2', concept: 'transfer.finetune', q: 'After unfreezing base_model.layers[56:], slide 51 compiles again with…', answer: 'SGD(learning_rate=0.01, momentum=0.9)',
    wrong: ['SGD(learning_rate=0.1, momentum=0.9)', 'SGD(learning_rate=1.0, momentum=0.9)', 'no new compile: it keeps training'], src: { lecture: 3, slides: [51] },
    why: 'Slide 51: after unfreezing base_model.layers[56:] the model is compiled again with SGD(learning_rate=0.01, momentum=0.9); the frozen phase used learning_rate=0.1.' },
  { id: 'top', concept: 'transfer.finetune', q: 'What does slide 51 put on top of Xception(weights="imagenet", include_top=False)?', answer: 'GlobalAveragePooling2D, then Dense(n_classes, activation="softmax")',
    wrong: ['Flatten, then Dense(1000, activation="softmax")', 'two Dense(4096) layers, then a softmax', 'nothing: include_top=False keeps the ImageNet head'], src: { lecture: 3, slides: [51] },
    why: 'Slide 51: avg = GlobalAveragePooling2D()(base_model.output), then output = Dense(n_classes, activation="softmax")(avg).' },
  { id: 'firstPhase', concept: 'transfer.finetune', q: 'In slide 51’s first training phase, the pretrained Xception layers are…', answer: 'frozen (layer.trainable = False), trained 3 epochs with SGD learning_rate=0.1',
    wrong: ['all trainable, trained 10 epochs with SGD learning_rate=0.01', 'frozen, trained 10 epochs with SGD learning_rate=0.01', 'removed, and replaced by new conv layers'], src: { lecture: 3, slides: [51] },
    why: 'Slide 51: freeze the pretrained layers (layer.trainable = False), compile with SGD(learning_rate=0.1, momentum=0.9) and train for epochs=3.' },
  { id: 'dahlia', concept: 'transfer.pretrained', q: 'Slide 49: ResNet50 calls a dahlia a vase (32.66%). Why is it wrong?', answer: 'dahlia is not one of the 1,000 ImageNet classes',
    wrong: ['the images were not resized to 224 × 224', 'preprocess_input was skipped', 'top=3 hides the right class'], src: { lecture: 3, slides: [48, 49] },
    why: 'Slide 49: the model is wrong on the second image because dahlia is not one of the 1,000 ImageNet classes; for such classes you can still use pretrained models through transfer learning.' },
];

// ── the item plan per level (ramps within the round) ────────────────────
export const ROUNDS = {
  1: ['claim:1', 'figure', 'claim:1', 'number:1', 'rows', 'claim:2', 'year', 'picture', 'claim:2', 'number:2'],
  2: ['wire', 'order:lenet5:3', 'branches', 'quick', 'order:alexnet:4', 'quick', 'order:googlenet:3', 'order:any:5'],
  3: ['cell:1', 'typical', 'sum', 'cell:2', 'finetune:4', 'cell:3', 'transfer', 'sum'],
};
