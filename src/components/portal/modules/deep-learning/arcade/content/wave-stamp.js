/* ============================================================================
   WAVE STAMP — CONTENT (pure data, slide-cited; Lecture 8 slides 31–36, 44–47)
   ----------------------------------------------------------------------------
   COPY       stage copy, intro, level names, labels
   CHOICE     choice items by level (prompt, choices, answer, why, src)
   ORDER      the ViT pipeline ordering item (slide 46)
   VIT_SIZES  this page's own example image sizes for the patch count
              (slide 46 gives no image size: every count item is `beyond`)
   NOT_EXAMINED  the one item about slide 47 onward (its exam status only)
   Generated items (barcode matching, P values, angles, the base quirk, the
   code's index trick, shapes, 768) are built in maths/waveStamp.js from
   lecture8-study/attn.js posEncoding / vitPatches.
   Choice labels may hold $…$ (KaTeX); `plain` is the same label in text for
   the feedback line and the why card. `focus` on a ViT item picks how much of
   the slide-46 pipeline the picture shows ('chop' when it would give the
   answer away; 'all' otherwise). The visual-attention items (slides 44–45)
   use the `caption` stage instead (CNN → feature maps → decoder RNN with
   attention), never the patch grid; `focus: 'decoder'` keeps that pipeline
   behind a "?" until the answer is in.
   ========================================================================== */

const L8 = (slides) => ({ lecture: 8, slides });

export const COPY = {
  intro: 'Every position p gets its own barcode. Read the stamp, name the position, mind the base.',
  controls: [
    'Pick an answer with keys 1–4, or tap it.',
    'Numbers go in on the keypad (keys 0–9, “.” and “-”, Enter).',
    '“Show the maths” opens slide 32’s formula (and the stamp’s numbers). Level 3 ordering: keys 1–5 move a card up, Enter submits.',
  ],
  levelNames: ['barcodes · slide 32', 'base 1000 vs 10 000 · the code', 'bonus · ViT patches'],
  stampLabel: 'THE STAMP',
  rackLabel: 'THE RACK · one barcode per position',
  rackHidden: 'the rack is face down: read the stamp',
  slideBase: 'slide 32 · base 1000',
  codeBase: 'slide 35 code · base 10_000',
  rackA: 'rack A',
  rackB: 'rack B',
  ownImage: 'This image and its size are this page’s own example: slide 46 gives no image size.',
  notExamined: 'not examined',
  beyond: 'beyond the slides',
  patchSide: '16 px',
  vecLabel: '768',
  seqLabel: 'sequence of patch vectors',
  plusPos: '+ positional embeddings',
  toTransformer: 'transformer',
  linear: 'linear',
  across: 'i = 0 … {n} across',
  formulaHidden: 'slide 32 · the base is hidden',
  codeAsMaths: ' (the code, written as maths)',
  submitOrder: 'Submit order',
  capImage: 'image',
  capCnn: 'CNN',
  capMaps: 'feature maps',
  capDecoder: 'decoder RNN + attention',
  capAttention: 'attention',
  capWords: ['word 1', 'word 2', 'word 3'],
  capCaption: 'the caption',
};

/* ── choice items ──────────────────────────────────────────────────────── */
export const CHOICE = [
  // ── level 1: why sinusoids, what P is ───────────────────────────────────
  {
    id: 'ws.l1.unique', level: 1, concept: 'posenc.why', src: L8([33]), stage: 'wall',
    prompt: 'After the positional encodings are added to the word embeddings, why does the rest of the model know where each word is?',
    promptText: 'Why the model knows each word’s position',
    choices: [
      { value: 'unique', label: 'Each position has a unique positional encoding, so it has access to each word’s absolute position' },
      { value: 'ltr', label: 'The attention layers read the words strictly left to right' },
      { value: 'learned', label: 'The encodings are learned to mark the gaps between words' },
      { value: 'times', label: 'Each word embedding is multiplied by its position p' },
    ],
    answer: 'unique',
    why: 'Slide 33: after these positional encodings are added to the word embeddings, the rest of the model has access to the absolute position of each word in the sentence, because each position has a unique positional encoding.',
  },
  {
    id: 'ws.l1.fixed', level: 1, concept: 'posenc.why', src: L8([32]), stage: 'wall',
    prompt: 'What kind of positional encodings did the authors of the transformer paper choose?',
    promptText: 'The transformer paper’s positional encodings',
    choices: [
      { value: 'fixed', label: 'Fixed encodings based on the sine and cosine functions at different frequencies' },
      { value: 'embedding', label: 'An Embedding layer trained to encode the positions 0 to the maximum length' },
      { value: 'onehot', label: 'One-hot vectors of the position' },
      { value: 'scalar', label: 'A single extra number p appended to each word embedding' },
    ],
    answer: 'fixed',
    why: 'Slide 32: the authors of the transformer paper chose to use fixed positional encodings, based on the sine and cosine functions at different frequencies. An Embedding layer that encodes the positions is the slide’s “easiest way to implement” positional encodings, not the paper’s choice.',
  },
  {
    id: 'ws.l1.added', level: 1, concept: 'posenc.why', src: L8([31, 32]), stage: 'wall',
    prompt: 'A positional encoding is a dense vector. What is done with the one for the word at position p?',
    promptText: 'What happens to a position’s encoding',
    choices: [
      { value: 'added', label: 'It is added to the word embedding of the word at that position' },
      { value: 'concat', label: 'It is appended to the end of the sentence as an extra word' },
      { value: 'replace', label: 'It replaces the word’s embedding' },
      { value: 'weights', label: 'It is multiplied into the attention weights' },
    ],
    answer: 'added',
    why: 'Slides 31–32: positional encodings are dense vectors (much like word embeddings) that represent the position of each word in the sentence; the positional encoding for a position is added to the word embedding of the word at that position. (Slide 32 calls this “the $i^{\\text{th}}$ positional encoding … the $i^{\\text{th}}$ word”; this game writes p for the position, as the slide’s formula does.)',
  },
  {
    id: 'ws.l1.easiest', level: 1, concept: 'posenc.why', src: L8([32]), stage: 'wall',
    prompt: 'What does slide 32 call the easiest way to implement positional encodings?',
    promptText: 'The easiest way to implement positional encodings',
    choices: [
      { value: 'embedding', label: 'An Embedding layer encoding all positions from 0 to the maximum sequence length in the batch, added to the word embeddings' },
      { value: 'sort', label: 'Sort the words by position before the encoder' },
      { value: 'rnn', label: 'Run a recurrent layer over the sentence before the attention layers' },
      { value: 'mask', label: 'Use the causal mask to number the words' },
    ],
    answer: 'embedding',
    why: 'Slide 32: the easiest way to implement this is to use an Embedding layer and make it encode all the positions from 0 to the maximum sequence length in the batch, then add the result to the word embeddings. The paper’s authors instead chose fixed sine/cosine encodings.',
  },
  {
    id: 'ws.l1.fast', level: 1, concept: 'posenc.formula', src: L8([32, 33]), stage: 'wall',
    prompt: 'Going down the rack (p = 0, 1, 2, …), which components of the barcode change fastest?',
    promptText: 'Which components of P change fastest along p',
    choices: [
      { value: 'low', label: 'The first ones ($i = 0, 1$): their divisor $1000^{0} = 1$ is the smallest', plain: 'The first ones (i = 0, 1): their divisor 1000⁰ = 1 is the smallest' },
      { value: 'high', label: 'The last ones ($i = d-2, d-1$)', plain: 'The last ones (i = d − 2, d − 1)' },
      { value: 'same', label: 'All components change at the same rate' },
      { value: 'odd', label: 'Only the odd (cosine) components change' },
    ],
    answer: 'low',
    why: 'Slide 32: $\\mathbf{P}_{p,i}$ divides p by $1000^{i/d}$ (or $1000^{(i-1)/d}$), which grows with i, so the low components oscillate fastest along p and the high ones slowly: sine and cosine at different frequencies. Figure 16-9 on slide 33 (the matrix transposed) shows the fast stripes near i = 0 and broad bands at large i.',
  },
  {
    id: 'ws.l1.d', level: 1, concept: 'posenc.formula', src: L8([32]), stage: 'wall',
    prompt: 'In slide 32’s formula for $\\mathbf{P}_{p,i}$, what is d?',
    promptText: 'What d is in slide 32’s formula',
    choices: [
      { value: 'dim', label: 'The dimension of the keys, values and queries vectors' },
      { value: 'len', label: 'The number of words in the sentence' },
      { value: 'maxp', label: 'The largest position p' },
      { value: 'heads', label: 'The number of attention heads' },
    ],
    answer: 'dim',
    why: 'Slide 32: $\\mathbf{P}_{p,i}$ denotes the positional encoding for the $i^{\\text{th}}$ component of the embedding vector for the word at the $p^{\\text{th}}$ position, and d denotes the dimension of the keys, values, and queries vectors. The code on slide 35 uses embed_size in its place.',
  },

  // ── level 2: the base quirk and the code ───────────────────────────────
  {
    id: 'ws.l2.even', level: 2, concept: 'posenc.code', src: L8([35]), stage: 'code', code: { id: 'l8.posenc.class', lines: [3, 6, 7, 8] },
    prompt: 'What does the PositionalEncoding constructor on slide 35 assert about embed_size?',
    promptText: 'The assert in PositionalEncoding.__init__',
    choices: [
      { value: 'even', label: 'embed_size % 2 == 0: “embed_size must be even”' },
      { value: 'pow2', label: 'embed_size must be a power of 2' },
      { value: 'gtmax', label: 'embed_size must be larger than max_length' },
      { value: 'heads', label: 'embed_size must divide by the number of heads' },
    ],
    answer: 'even',
    why: 'Slide 35: assert embed_size % 2 == 0, "embed_size must be even". The sines fill the even columns pos_emb[0, :, ::2] and the cosines the odd columns pos_emb[0, :, 1::2], embed_size // 2 of each.',
  },
  {
    id: 'ws.l2.masking', level: 2, concept: 'posenc.code', src: L8([34, 35]), stage: 'code', code: { id: 'l8.posenc.class', lines: [10] },
    prompt: 'Why does the layer set self.supports_masking = True?',
    promptText: 'supports_masking=True in PositionalEncoding',
    choices: [
      { value: 'propagate', label: 'To propagate the input’s automatic mask to the next layer' },
      { value: 'causal', label: 'To make the layer causal, like the decoder’s masked attention' },
      { value: 'drop', label: 'To drop the encodings of padded positions from the matrix' },
      { value: 'train', label: 'To let the encodings be trained' },
    ],
    answer: 'propagate',
    why: 'Slide 34: we also set supports_masking=True to propagate the input’s automatic mask to the next layer (the line is in the constructor on slide 35).',
  },
  {
    id: 'ws.l2.precompute', level: 2, concept: 'posenc.code', src: L8([34, 35]), stage: 'code', code: { id: 'l8.posenc.class', lines: [12, 13, 14] },
    prompt: 'The encoding matrix is computed once in the constructor. What does call() do with it?',
    promptText: 'What PositionalEncoding.call() does',
    choices: [
      { value: 'truncate', label: 'Truncates it to the maximum length of the input sequences and adds it to the inputs' },
      { value: 'recompute', label: 'Recomputes the sines and cosines for the batch' },
      { value: 'concat', label: 'Concatenates it to the inputs along the last axis' },
      { value: 'multiply', label: 'Multiplies the inputs by it' },
    ],
    answer: 'truncate',
    why: 'Slide 34: for efficiency reasons the positional encoding matrix is precomputed in the constructor; the call() method just truncates it to the maximum length of the input sequences and adds it to the inputs. Slide 35: return inputs + self.pos_encodings[:, :batch_max_length].',
  },
  {
    id: 'ws.l2.args', level: 2, concept: 'posenc.code', src: L8([35, 36]), stage: 'code', code: { id: 'l8.posenc.class', lines: [1, 4, 5, 6] },
    prompt: 'In PositionalEncoding(max_length, embed_size), which argument sets how many positions are precomputed?',
    promptText: 'Which argument sets the number of positions',
    choices: [
      { value: 'max_length', label: 'max_length: the positions are np.arange(max_length)' },
      { value: 'embed_size', label: 'embed_size: one position per embedding component' },
      { value: 'batch', label: 'batch_max_length, read from the inputs' },
      { value: 'dtype', label: 'dtype' },
    ],
    answer: 'max_length',
    why: 'Slide 35: p comes from np.arange(max_length), so positions 0 … max_length − 1 are precomputed; embed_size is the length of each encoding (pos_emb has shape (1, max_length, embed_size)). batch_max_length is only used in call() to truncate.',
  },
  {
    id: 'ws.l2.agree', level: 2, concept: 'posenc.formula', src: L8([32, 35]), stage: 'twin',
    prompt: 'For which components i do slide 32’s formula and slide 35’s code give the same value at every position p?',
    promptText: 'Where base 1000 and base 10_000 agree',
    choices: [
      { value: 'first', label: 'Only $i = 0$ and $i = 1$: their exponent is 0, and any base to the 0 is 1', plain: 'Only i = 0 and i = 1: their exponent is 0, and any base to the 0 is 1' },
      { value: 'all', label: 'All of them: the two slides use the same base' },
      { value: 'even', label: 'The even (sine) components only' },
      { value: 'none', label: 'None of them' },
    ],
    answer: 'first',
    why: 'Slide 32 typesets the base as 1000; the code on slide 35 uses 10_000. For i = 0 the exponent i/d is 0 and for i = 1 it is (i − 1)/d = 0, so both give sin(p) and cos(p); from i = 2 on, the bigger base divides p by more.',
  },
  {
    id: 'ws.l2.added', level: 2, concept: 'posenc.code', src: L8([36]), stage: 'code', code: { id: 'l8.posenc.use', lines: [0, 1, 2] },
    prompt: 'On slide 36, what does pos_embed_layer get applied to?',
    promptText: 'Where slide 36 adds P',
    choices: [
      { value: 'embeddings', label: 'encoder_embeddings and decoder_embeddings: the word embeddings going into the encoder and the decoder' },
      { value: 'ids', label: 'The token IDs, before the Embedding layer looks them up' },
      { value: 'weights', label: 'The attention weights' },
      { value: 'logits', label: 'The final Dense layer’s outputs' },
    ],
    answer: 'embeddings',
    why: 'Slide 36’s code: encoder_in = pos_embed_layer(encoder_embeddings) and decoder_in = pos_embed_layer(decoder_embeddings), one layer for both. The sentence above it says “adding the positional encoding to the encoder’s outputs”, but the code adds it to the embeddings, the encoder’s input (slide 32: added to the word embeddings).',
  },

  // ── level 3: ViT (slides 44–46) ─────────────────────────────────────────
  {
    id: 'ws.l3.channels', level: 3, concept: 'vit.patches', src: L8([46]), stage: 'patches',
    prompt: 'In 16 × 16 × 3 = 768, what is the 3?',
    promptText: 'The 3 in 16 × 16 × 3',
    choices: [
      { value: 'rgb', label: 'The RGB colour channels' },
      { value: 'heads', label: 'The number of attention heads' },
      { value: 'rows', label: 'Three patches per row' },
      { value: 'qkv', label: 'One copy each for queries, keys and values' },
    ],
    answer: 'rgb',
    why: 'Slide 46: the squares are first flattened into 16 × 16 × 3 = 768-dimensional vectors; the value 3 is for the RGB colour channels.',
  },
  {
    id: 'ws.l3.chop', level: 3, concept: 'vit.patches', src: L8([46]), stage: 'patches',
    prompt: 'How does the vision transformer (ViT) turn an image into something a transformer can read?',
    promptText: 'How ViT turns an image into a sequence',
    choices: [
      { value: 'chop', label: 'Chop it into little 16 × 16 squares and treat them as a sequence of word representations' },
      { value: 'pixel', label: 'Read the image one pixel at a time' },
      { value: 'cnn', label: 'Run a CNN and use each feature map as a word' },
      { value: 'channels', label: 'Split it into its 3 colour channels, one word each' },
    ],
    answer: 'chop',
    why: 'Slide 46: the idea is surprisingly simple: just chop the image into little 16 × 16 squares, and treat the sequence of squares as if it were a sequence of word representations.',
  },
  {
    id: 'ws.l3.linear', level: 3, concept: 'vit.patches', src: L8([46]), stage: 'patches',
    prompt: 'What do the flattened 768-dimensional vectors go through next?',
    promptText: 'After flattening the ViT patches',
    choices: [
      { value: 'linear', label: 'A linear layer that transforms them but retains their dimensionality' },
      { value: 'cnn', label: 'A CNN that outputs feature maps' },
      { value: 'pool', label: 'A pooling layer that halves their size' },
      { value: 'softmax', label: 'A softmax over the 768 values' },
    ],
    answer: 'linear',
    why: 'Slide 46: these vectors then go through a linear layer that transforms them but retains their dimensionality (still 768).',
  },
  {
    id: 'ws.l3.sequence', level: 3, concept: 'vit.patches', src: L8([46]), stage: 'patches',
    prompt: 'After the linear layer, how is the sequence of patch vectors treated?',
    promptText: 'How ViT treats the patch vectors',
    choices: [
      { value: 'words', label: 'As a sequence of word embeddings: add positional embeddings and pass the result to the transformer' },
      { value: 'cnn', label: 'As one long image fed to a CNN' },
      { value: 'target', label: 'As the decoder’s target sentence' },
      { value: 'keys', label: 'As keys only, with no queries' },
    ],
    answer: 'words',
    why: 'Slide 46: the resulting sequence of vectors can be treated as a sequence of word embeddings: i.e. adding positional embeddings, and passing the result to the transformer.',
  },
  {
    id: 'ws.l3.data', level: 3, concept: 'vit.dataHungry', src: L8([46]), stage: 'patches', focus: 'all',
    prompt: 'ViT beat the state of the art on ImageNet image classification. What did it need for training?',
    promptText: 'What ViT needed for training',
    choices: [
      { value: 'more', label: 'Over 300 million additional images' },
      { value: 'less', label: 'Fewer images than a CNN, thanks to attention' },
      { value: 'cnn', label: 'A pretrained CNN to supply feature maps' },
      { value: 'nopos', label: 'Nothing extra: it dropped the positional embeddings' },
    ],
    answer: 'more',
    why: 'Slide 46: this model beat the state of the art on ImageNet image classification, but required over 300 million additional images for training.',
  },
  {
    id: 'ws.l3.bias', level: 3, concept: 'vit.dataHungry', src: L8([46]), stage: 'patches', focus: 'all',
    prompt: 'Why does ViT need so much extra training data, according to slide 46?',
    promptText: 'Why ViT is data hungry',
    choices: [
      { value: 'bias', label: 'Transformers don’t have as many inductive biases as CNNs, so they need extra data to learn what CNNs implicitly assume' },
      { value: 'morebias', label: 'Transformers have more inductive biases than CNNs' },
      { value: 'overfit', label: 'Its 768-dimensional patches overfit unless every layer uses dropout' },
      { value: 'size', label: 'Attention cannot handle images larger than 16 × 16' },
    ],
    answer: 'bias',
    why: 'Slide 46: this makes sense since transformers don’t have as many inductive biases as CNNs, so they need extra data just to learn things that CNNs implicitly assume.',
  },
  {
    id: 'ws.l3.caption', level: 3, concept: 'vit.visualAttention', src: L8([44]), stage: 'caption', focus: 'decoder',
    prompt: 'Image captioning using visual attention (slide 44): what writes the caption?',
    promptText: 'What writes the caption with visual attention',
    choices: [
      { value: 'rnn', label: 'A decoder RNN with an attention mechanism, one word at a time, after a CNN outputs feature maps' },
      { value: 'vit', label: 'A vision transformer reading 16 × 16 patches' },
      { value: 'cnn', label: 'The CNN alone, one word per feature map' },
      { value: 'enc', label: 'An encoder-only transformer with positional encodings' },
    ],
    answer: 'rnn',
    why: 'Slide 44: a convolutional neural network first processes the image and outputs some feature maps, then a decoder RNN equipped with an attention mechanism generates the caption, one word at a time, focusing on just the right part of the image at each step. (It sits under the heading “Vision Transformers”, but this model is not a transformer.)',
  },
  {
    id: 'ws.l3.frisbee', level: 3, concept: 'vit.visualAttention', src: L8([45]), stage: 'caption', focus: 'all',
    prompt: 'Figure 16-12: just before the model output the word “frisbee”, where was most of its attention?',
    promptText: 'Figure 16-12’s attention before “frisbee”',
    choices: [
      { value: 'frisbee', label: 'On the frisbee' },
      { value: 'face', label: 'On the woman’s face' },
      { value: 'even', label: 'Spread evenly over the whole image' },
      { value: 'park', label: 'On the park in the background' },
    ],
    answer: 'frisbee',
    why: 'Slide 45: the model generated the caption “A woman is throwing a frisbee in a park”; when it was about to output the word “frisbee”, most of its attention was focused on the frisbee.',
  },
];

/* ── the ViT pipeline in order (slide 46) ─────────────────────────────── */
export const ORDER = {
  concept: 'vit.patches',
  src: L8([46]),
  prompt: 'Put ViT’s steps in order (a card’s number key moves it up).',
  promptText: 'The ViT pipeline in order',
  steps: [
    'Chop the image into 16 × 16 squares',
    'Flatten each square into a 768-dimensional vector',
    'Linear layer (keeps the dimensionality)',
    'Add positional embeddings',
    'Pass the sequence to the transformer',
  ],
  why: 'Slide 46: chop the image into little 16 × 16 squares; flatten them into 16 × 16 × 3 = 768-dimensional vectors; a linear layer transforms them but retains their dimensionality; treat the sequence as word embeddings by adding positional embeddings; pass the result to the transformer.',
};

/* ── this page's own example images for the patch count ──────────────── */
export const VIT_SIZES = {
  beyond: true,
  note: 'Slide 46 gives no input image size (QUIRKS l8.vit.missingDetails), so every image size here is this page’s own example; only the 16 × 16 patch and the 768 come from the slide.',
  sizes: [[32, 48], [48, 64], [64, 64], [64, 96], [96, 96], [64, 128], [96, 160], [128, 128], [224, 224]], // [H, W] in pixels, multiples of 16
  src: L8([46]),
};

/* ── slide 47 onward: its exam status, nothing else ──────────────────── */
export const NOT_EXAMINED = {
  id: 'ws.l3.notExamined', level: 3, concept: 'vit.variants', src: L8([47]), stage: 'patches', focus: 'all', notExamined: true,
  prompt: 'Lecture 8, slide 47 onward (“Other related papers”): what does the deck say about these slides?',
  promptText: 'Exam status of slide 47 onward',
  choices: [
    { value: 'not', label: 'They are not covered in the exam' },
    { value: 'short', label: 'They are examined as short answers only' },
    { value: 'dates', label: 'Only their dates are examined' },
    { value: 'replace', label: 'They replace slide 46 in the exam' },
  ],
  answer: 'not',
  why: 'Slide 47 carries the note “(Materials from this slide onward are not covered in the exam)”, so this game drills the ViT patching on slide 46 and nothing after it.',
};

/* ── why-text pieces shared by the generated items ───────────────────── */
export const NOTES = {
  base: 'Slide 32 typesets the base as 1000; the code on slide 35 uses 10_000 (a factor of 10 apart). This item uses the base of the slide it names.',
  radians: 'The angle is in radians (NumPy’s np.sin / np.cos convention; the slides do not state units).',
  codeIndex: 'In the slide-35 code i = 2 * np.arange(embed_size // 2) takes only the even values 0, 2, 4, …, and the cosine line reuses the same i / embed_size: for an odd column that is slide 32’s (i − 1)/d.',
  unique: 'Each position has a unique positional encoding (slide 33).',
};
