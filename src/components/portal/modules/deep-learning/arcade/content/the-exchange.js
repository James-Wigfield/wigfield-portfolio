/* ============================================================================
   THE EXCHANGE — CONTENT (pure data, slide-cited; Lecture 8)
   ----------------------------------------------------------------------------
   CHOICE   choice items by level (prompt, choices, answer, why, src)
   ORDER    the multi-head pipeline ordering item
   COPY     stage copy. The patch-board items are generated in
            maths/theExchange.js from the toy transformer's real attention.
   ========================================================================== */

export const OWN = 'The attention weights on the board are this page’s own toy English → Spanish transformer (trained by the Lecture 8 study page), not the slides’ model.';

const L8 = (slides) => ({ lecture: 8, slides });

export const CHOICE = [
  // ── level 1: one cable (the bottleneck) and what attention changes ─────
  {
    id: 'x.l1.finalState', level: 1, concept: 'encdec.finalState', src: L8([5, 12, 13]),
    prompt: 'Without attention, what does the encoder hand to the decoder?',
    choices: [
      { value: 'final', label: 'Only its final hidden state' },
      { value: 'all', label: 'All of its outputs, one per word' },
      { value: 'first', label: 'The embedding of the first word' },
      { value: 'softmax', label: 'A softmax over the Spanish vocabulary' },
    ],
    answer: 'final',
    why: 'In Figure 16-3 the encoder’s outputs ŷ(0)–ŷ(2) are grey (unused); only an arrow from the last encoder cell enters the first decoder cell. One cable carries the whole sentence.',
  },
  {
    id: 'x.l1.longPath', level: 1, concept: 'attn.motivation', src: L8([18]),
    prompt: 'In Figure 16-3, why is “soccer” → “fútbol” hard for the plain encoder–decoder?',
    choices: [
      { value: 'path', label: 'The path is long: the word’s representation is carried over many steps before it is used' },
      { value: 'emb', label: 'The embeddings are too small to hold a noun' },
      { value: 'sos', label: 'The decoder never sees the ⟨SOS⟩ token' },
      { value: 'vocab', label: 'The two vocabularies have different sizes' },
    ],
    answer: 'path',
    why: 'Slide 18: the path from “soccer” to its translation “fútbol” is quite long, so the word’s representation must be carried over many steps before it is actually used.',
  },
  {
    id: 'x.l1.longSentences', level: 1, concept: 'attn.motivation', src: L8([19]),
    prompt: 'Attention mechanisms improved NMT most for…',
    choices: [
      { value: 'long', label: 'Long sentences (e.g. over 30 words)' },
      { value: 'short', label: 'Short sentences' },
      { value: 'single', label: 'Single-word inputs' },
      { value: 'noverb', label: 'Sentences without verbs' },
    ],
    answer: 'long',
    why: 'Slide 19: attention revolutionised NMT with a significant improvement in the state of the art, especially for long sentences (e.g. over 30 words).',
  },
  {
    id: 'x.l1.allOutputs', level: 1, concept: 'attn.weightedSum', src: L8([20]),
    prompt: 'With attention, what is sent to the decoder?',
    choices: [
      { value: 'all', label: 'All of the encoder’s outputs, not just the final hidden state' },
      { value: 'final', label: 'Only the encoder’s final hidden state' },
      { value: 'avg', label: 'The average of the encoder’s outputs' },
      { value: 'last2', label: 'The last two encoder outputs' },
    ],
    answer: 'all',
    why: 'Slide 20: instead of just sending the encoder’s final hidden state (and the previous target word), all of the encoder’s outputs are now sent to the decoder as well.',
  },
  {
    id: 'x.l1.weightedSum', level: 1, concept: 'attn.weightedSum', src: L8([20]),
    prompt: 'At each time step, what does the decoder’s memory cell compute from the encoder outputs?',
    choices: [
      { value: 'wsum', label: 'A weighted sum of all the encoder outputs' },
      { value: 'max', label: 'The maximum encoder output' },
      { value: 'concat', label: 'The concatenation of all encoder outputs' },
      { value: 'dotlast', label: 'A dot product with the last output only' },
    ],
    answer: 'wsum',
    why: 'Slide 20: the decoder’s memory cell computes a weighted sum of all the encoder outputs; this determines which words it will focus on at this step.',
  },
  {
    id: 'x.l1.alpha', level: 1, concept: 'attn.weightedSum', src: L8([21]),
    prompt: 'α(t, i) is…',
    choices: [
      { value: 'w', label: 'The weight of the i-th encoder output at the t-th decoder time step' },
      { value: 'score', label: 'The raw similarity score before the softmax' },
      { value: 'emb', label: 'The i-th embedding of the t-th word' },
      { value: 'prob', label: 'The probability of the t-th Spanish word' },
    ],
    answer: 'w',
    why: 'Slide 21: α(t, i) is the weight of the i-th encoder output at the t-th decoder time step. If α(3, 2) is much larger than α(3, 0) and α(3, 1), the decoder pays much more attention to word #2 (“soccer”).',
  },

  // ── level 2: the Bahdanau and Luong desks ──────────────────────────────
  {
    id: 'x.l2.alignment', level: 2, concept: 'attn.alignment', src: L8([22]),
    prompt: 'What generates the α(t, i) weights?',
    choices: [
      { value: 'align', label: 'A small neural network, the alignment model (or attention layer), trained jointly with the rest' },
      { value: 'fixed', label: 'A fixed table set by hand' },
      { value: 'enc', label: 'The encoder’s last cell alone' },
      { value: 'pos', label: 'The positions of the words' },
    ],
    answer: 'align',
    why: 'Slide 22: the α(t, i) weights are generated by a small neural network called an alignment model (or an attention layer), trained jointly with the rest of the encoder–decoder model.',
  },
  {
    id: 'x.l2.denseOne', level: 2, concept: 'attn.alignment', src: L8([22]),
    prompt: 'In slide 22’s alignment model, what does the one-neuron Dense layer output?',
    choices: [
      { value: 'score', label: 'A score e(3, i) for each encoder output y(i)' },
      { value: 'alpha', label: 'The weights α(3, i) directly' },
      { value: 'word', label: 'The next Spanish word' },
      { value: 'h', label: 'The decoder’s new hidden state' },
    ],
    answer: 'score',
    why: 'Slide 22: the blue Dense layer, which contains only one neuron, processes the four input vectors and outputs a score e(3, i) for each y(i); a softmax then turns the three scores into probabilities used as weights.',
  },
  {
    id: 'x.l2.fourInputs', level: 2, concept: 'attn.alignment', src: L8([22]),
    prompt: 'The alignment model at decoder step 3 reads which vectors?',
    choices: [
      { value: 'h2y', label: 'h(2), the decoder’s previous hidden state, and y(0), y(1), y(2)' },
      { value: 'xs', label: 'The three input word embeddings' },
      { value: 'h3', label: 'h(3) and the previous Spanish word' },
      { value: 'y2', label: 'Only y(2), the last encoder output' },
    ],
    answer: 'h2y',
    why: 'Slide 22: the four input vectors are h(2), the decoder’s hidden state output from the previous time step, and y(0), y(1), y(2), the three output vectors from the encoder.',
  },
  {
    id: 'x.l2.bahdanauAlias', level: 2, concept: 'attn.bahdanau', src: L8([23]),
    prompt: 'Bahdanau attention is also called…',
    choices: [
      { value: 'add', label: 'Concatenative attention or additive attention' },
      { value: 'mul', label: 'Multiplicative attention' },
      { value: 'dot', label: 'Dot-product attention' },
      { value: 'scaled', label: 'Scaled attention' },
    ],
    answer: 'add',
    why: 'Slide 23: because it concatenates the encoder’s output vectors y and the decoder’s previous hidden state h, Bahdanau attention is also called concatenative attention or additive attention.',
  },
  {
    id: 'x.l2.bahdanauExample', level: 2, concept: 'attn.bahdanau', src: L8([23]),
    prompt: 'Having output “me gusta el”, the decoder expects a noun. Which score gets high?',
    choices: [
      { value: 'e32', label: 'e(3, 2), for “soccer”, so α(3, 2) is high after the softmax' },
      { value: 'e30', label: 'e(3, 0), for “I”' },
      { value: 'e31', label: 'e(3, 1), for “like”' },
      { value: 'all', label: 'All three equally' },
    ],
    answer: 'e32',
    why: 'Slide 23: “soccer” best aligns with the current state, so e(3, 2) gets a high score and a high probability α(3, 2) after the softmax.',
  },
  {
    id: 'x.l2.luongAlias', level: 2, concept: 'attn.luong', src: L8([24]),
    prompt: 'Luong attention is also called…',
    choices: [
      { value: 'mul', label: 'Multiplicative attention: the dot product of h and y' },
      { value: 'add', label: 'Additive attention' },
      { value: 'concat', label: 'Concatenative attention' },
      { value: 'self', label: 'Self-attention' },
    ],
    answer: 'mul',
    why: 'Slide 24: Luong attention, or multiplicative attention (2015), simply computes the dot product of the output vectors y and the hidden state vector h: a fairly good similarity measure that modern hardware computes very efficiently.',
  },
  {
    id: 'x.l2.sameLength', level: 2, concept: 'attn.luong', src: L8([24]),
    prompt: 'The only constraint the dot product imposes on the network is…',
    choices: [
      { value: 'len', label: 'The vectors must be of the same length' },
      { value: 'unit', label: 'The vectors must be unit length' },
      { value: 'pos', label: 'All entries must be positive' },
      { value: 'enc', label: 'The encoder must be bidirectional' },
    ],
    answer: 'len',
    why: 'Slide 24: the only constraint imposed on the network by the dot product is that these vectors must be of the same length.',
  },
  {
    id: 'x.l2.variantGeneral', level: 2, concept: 'attn.luongVariants', src: L8([25]),
    prompt: 'Which Luong variant is $e_{(t,i)} = \\mathbf{h}_{(t)}^{\\top}\\mathbf{W}\\mathbf{y}_{(i)}$?',
    promptText: 'Which Luong variant is e(t,i) = h(t)ᵀ W y(i)?',
    choices: [
      { value: 'general', label: 'General dot product' },
      { value: 'dot', label: 'Dot product' },
      { value: 'concat', label: 'Concat' },
      { value: 'additive', label: 'Additive' },
    ],
    answer: 'general',
    why: 'Slide 25: the general dot product adds a matrix W between h(t)ᵀ and y(i); the plain dot product is h(t)ᵀ y(i) and concat is vᵀ tanh(W [h(t); y(i)]).',
  },
  {
    id: 'x.l2.variantConcat', level: 2, concept: 'attn.luongVariants', src: L8([25]),
    prompt: 'Which Luong variant is $e_{(t,i)} = \\mathbf{v}^{\\top}\\tanh\\big(\\mathbf{W}[\\mathbf{h}_{(t)};\\mathbf{y}_{(i)}]\\big)$?',
    promptText: 'Which Luong variant is e(t,i) = vᵀ tanh(W [h(t); y(i)])?',
    choices: [
      { value: 'concat', label: 'Concat' },
      { value: 'general', label: 'General dot product' },
      { value: 'dot', label: 'Dot product' },
      { value: 'scaled', label: 'Scaled dot product' },
    ],
    answer: 'concat',
    why: 'Slide 25: the concat variant concatenates h(t) and y(i), multiplies by W, applies tanh, then takes the dot product with v. It was outperformed by the two dot-product variants, so it is less used now.',
  },
  {
    id: 'x.l2.keras', level: 2, concept: 'attn.keras', src: L8([26]),
    prompt: 'In Keras, which layer is Bahdanau attention?',
    choices: [
      { value: 'additive', label: 'tf.keras.layers.AdditiveAttention (Attention is Luong)' },
      { value: 'attention', label: 'tf.keras.layers.Attention' },
      { value: 'mha', label: 'tf.keras.layers.MultiHeadAttention' },
      { value: 'dense', label: 'A Dense layer with a softmax' },
    ],
    answer: 'additive',
    why: 'Slide 26: Keras provides tf.keras.layers.Attention for Luong attention and AdditiveAttention for Bahdanau attention. By default Attention uses the dot-product variant (score_mode="dot").',
  },
  {
    id: 'x.l2.queries', level: 2, concept: 'attn.qkv', src: L8([27, 28]),
    prompt: 'In attention_layer([decoder_outputs, encoder_outputs]), which are the queries?',
    choices: [
      { value: 'dec', label: 'The decoder outputs; the encoder outputs are the keys (and values)' },
      { value: 'enc', label: 'The encoder outputs' },
      { value: 'both', label: 'Both, alternating' },
      { value: 'emb', label: 'The word embeddings' },
    ],
    answer: 'dec',
    why: 'Slides 27–28: the outputs from the encoder are the keys and, optionally, the values; the outputs from the decoder are the queries. attention_layer([decoder_outputs, encoder_outputs]) reads as attention_layer([queries, keys]).',
  },
  {
    id: 'x.l2.valuesDefault', level: 2, concept: 'attn.qkv', src: L8([28]),
    prompt: 'If the values input is not given to the Attention layer…',
    choices: [
      { value: 'keys', label: 'It is treated as equal to the keys input' },
      { value: 'zero', label: 'It is set to zeros' },
      { value: 'queries', label: 'It is treated as equal to the queries' },
      { value: 'error', label: 'The layer raises an error' },
    ],
    answer: 'keys',
    why: 'Slide 28: the attention_layer expects 2 to 3 inputs; if the values input is not provided it is treated as equal to the keys input.',
  },

  // ── level 3: the transformer floor ─────────────────────────────────────
  {
    id: 'x.l3.whyScale', level: 3, concept: 'transformer.scaling', src: L8([38]),
    prompt: 'Why are the similarity scores scaled down by √d_keys?',
    choices: [
      { value: 'sat', label: 'To avoid saturating the softmax, which would lead to tiny gradients' },
      { value: 'speed', label: 'To make the matrix product faster' },
      { value: 'norm', label: 'So the rows of V add up to 1' },
      { value: 'mask', label: 'To mask the future words' },
    ],
    answer: 'sat',
    why: 'Slide 38: the scaling factor scales down the similarity scores to avoid saturating the softmax function, which would lead to tiny gradients. (The slide’s bullet writes the factor as 1/d_keys; its equation, and slide 37’s, divide by √d_keys.)',
  },
  {
    id: 'x.l3.shapeQ', level: 3, concept: 'transformer.sdpa', src: L8([37]),
    prompt: 'The shape of Q in Attention(Q, K, V) is…',
    choices: [
      { value: 'q', label: '[n_queries, d_keys]' },
      { value: 'k', label: '[n_keys, d_values]' },
      { value: 'o', label: '[n_queries, d_values]' },
      { value: 's', label: '[n_queries, n_keys]' },
    ],
    answer: 'q',
    why: 'Slide 37: Q has shape [n_queries, d_keys], one row per query; K is [n_keys, d_keys]; V is [n_keys, d_values].',
  },
  {
    id: 'x.l3.shapeOut', level: 3, concept: 'transformer.sdpa', src: L8([38]),
    prompt: 'The output of Attention(Q, K, V) has shape…',
    choices: [
      { value: 'o', label: '[n_queries, d_values]' },
      { value: 's', label: '[n_queries, n_keys]' },
      { value: 'q', label: '[n_queries, d_keys]' },
      { value: 'v', label: '[n_keys, d_values]' },
    ],
    answer: 'o',
    why: 'Slide 38: QKᵀ is [n_queries, n_keys], the softmax keeps that shape with each row adding up to 1, and multiplying by V gives [n_queries, d_values]: each row is a weighted sum of the values.',
  },
  {
    id: 'x.l3.selfQKV', level: 3, concept: 'transformer.selfVsCross', src: L8([40, 31]),
    prompt: 'In the encoder’s multi-head attention layer, where do the queries, keys and values come from?',
    choices: [
      { value: 'same', label: 'All from the same sentence: it is self-attention' },
      { value: 'dec', label: 'Queries from the decoder, keys and values from the encoder' },
      { value: 'prev', label: 'From the previous translation' },
      { value: 'pos', label: 'Keys from the positional encodings only' },
    ],
    answer: 'same',
    why: 'Slide 40: the encoder’s multi-head attention layer is a self-attention layer; it updates each word representation by attending to all other words in the same sentence (in the self-attention blocks all three arrows branch from one line, slide 31).',
  },
  {
    id: 'x.l3.crossQKV', level: 3, concept: 'transformer.selfVsCross', src: L8([31, 40]),
    prompt: 'In the decoder’s upper multi-head attention layer (cross-attention)…',
    choices: [
      { value: 'cross', label: 'Keys and values come from the encoder’s output; the queries from the decoder' },
      { value: 'self', label: 'Everything comes from the decoder’s own words' },
      { value: 'swap', label: 'Queries come from the encoder; keys and values from the decoder' },
      { value: 'none', label: 'It has no keys, only values' },
    ],
    answer: 'cross',
    why: 'Slides 31 and 40: the first two arrows into the decoder’s upper attention layer are the keys and values from the encoder’s output, the third the queries from the decoder: cross-attention, where the decoder pays attention to the English words.',
  },
  {
    id: 'x.l3.mask', level: 3, concept: 'transformer.mask', src: L8([31, 41]),
    prompt: 'The decoder’s masked multi-head attention layer is masked so that…',
    choices: [
      { value: 'causal', label: 'A word cannot attend to the words after it (it is causal)' },
      { value: 'pad', label: 'Only padding tokens are visible' },
      { value: 'enc', label: 'The encoder output is hidden from it' },
      { value: 'rand', label: 'Half the words are dropped at random' },
    ],
    answer: 'causal',
    why: 'Slide 31: the masked multi-head attention layer in the decoder is causal; slide 41: after the first word is predicted, the masking on it is removed and the network runs again to predict the next word.',
  },
  {
    id: 'x.l3.heads', level: 3, concept: 'transformer.mha', src: L8([39]),
    prompt: 'In multi-head attention, H is…',
    choices: [
      { value: 'h', label: 'The number of parts V, K and Q are split into (the number of heads)' },
      { value: 'd', label: 'The dimension of the keys' },
      { value: 'n', label: 'The number of layers N' },
      { value: 'v', label: 'The vocabulary size' },
    ],
    answer: 'h',
    why: 'Slide 39: V, K and Q are individually transformed by Linear layers, split into parts determined by H, passed through Scaled Dot-Product Attention, concatenated and sent through a final Linear layer; the parts let different characteristics of the words be captured.',
  },
  {
    id: 'x.l3.elSoccer', level: 3, concept: 'transformer.selfVsCross', src: L8([40]),
    prompt: 'Slide 40: when the decoder processes “el”, which English word does it probably attend to most?',
    choices: [
      { value: 'soccer', label: '“soccer” (turning “el” into a representation of “fútbol”)' },
      { value: 'I', label: '“I”' },
      { value: 'like', label: '“like”' },
      { value: 'sos', label: '⟨SOS⟩' },
    ],
    answer: 'soccer',
    why: 'Slide 40: the decoder will probably pay close attention to “soccer” when it processes the word “el” and transforms its representation into a representation of “fútbol”.',
  },
];

export const ORDER = {
  id: 'x.l3.mhaOrder', level: 3, concept: 'transformer.mha', src: L8([37, 39]),
  prompt: 'Put the multi-head attention pipeline in order (Figure 16-10).',
  steps: ['Linear', 'Split', 'Scaled Dot-Product Attention', 'Concat', 'Linear'],
  why: 'Slides 37 and 39: V, K and Q each go through a Linear layer, are Split into H parts, pass through Scaled Dot-Product Attention, are concatenated (Concat) and sent through a final Linear layer.',
};

export const COPY = {
  intro: 'Patch each query into the keys. The toy transformer’s real attention grades your plugs.',
  controls: [
    'Choice items: keys 1–4. Number items: the keypad, Enter.',
    'Patch board: tap a key socket (or press its number) to cycle its plug off → dim → bright, then Connect (Enter). Brightness is the weight; the output is the weighted sum of the values.',
    'A patch is right when the brightest plug is on the right word and the pattern is close (L1 distance ≤ 0.6).',
  ],
  patchCross: 'Cross-attention · the decoder’s query into the English keys',
  patchSelf: 'Self-attention · an English word into its own sentence',
  own: OWN,
  levelNames: ['one cable · patch board', 'Bahdanau vs Luong desks', 'masks · heads · scaling'],
};

export const LEVELS = { off: 0, dim: 0.15, bright: 0.7 };
export const PATCH_L1_TOL = 0.6;
