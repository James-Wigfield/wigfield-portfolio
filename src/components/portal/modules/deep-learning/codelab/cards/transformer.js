// Code Lab cards: tab 9 · Attention & transformers (L8). Slides 41 (beam
// search) and 47 onward are marked not examined; neither has code.
export const TRANSFORMER = [
  {
    id: 'attention',
    title: 'Attention in Keras: Luong attention and multi-head self-attention',
    rating: 'core',
    why: 'Sample Q2(c) names multi-head attention as a key component: say what the queries, keys and values are, and what the mask does.',
    sources: [{ kind: 'lecture', lec: 8, slides: '25–28' }, { kind: 'lecture', lec: 8, slides: '37–43' }],
    blocks: ['L8 s26 #2', 'L8 s43'],
    provenance: 'trimmed',
    inv: ['l8-keras-attention-layer', 'l8-mha-encoder-loop', 'l8-attn-encoder-seq'],
    file: 'attention.py',
    code: `attention_layer = tf.keras.layers.Attention()  # default: score_mode="dot"
attention_outputs = attention_layer([decoder_outputs, encoder_outputs])
output_layer = tf.keras.layers.Dense(vocab_size, activation="softmax")
Y_proba = output_layer(attention_outputs)

N = 2          # instead of 6
num_heads = 8
dropout_rate = 0.1
n_units = 128  # for the first Dense layer in each Feed Forward block
encoder_pad_mask = tf.math.not_equal(encoder_input_ids, 0)[:, tf.newaxis]
Z = encoder_in
for _ in range(N):
    skip = Z
    attn_layer = tf.keras.layers.MultiHeadAttention(
        num_heads=num_heads, key_dim=embed_size, dropout=dropout_rate)
    Z = attn_layer(Z, value=Z, attention_mask=encoder_pad_mask)`,
    marks: [
      { n: 1, token: { line: 1, text: 'Attention()' }, say: 'Luong (multiplicative) attention: dot-product scores. AdditiveAttention would be Bahdanau’s.' },
      { n: 2, token: { line: 2, text: '[decoder_outputs, encoder_outputs]' }, say: 'Queries = the decoder’s outputs; keys (and values) = the encoder’s outputs, one per input word.' },
      { n: 3, lines: [10, 10], say: 'True for real tokens, False for padding (ID 0), so padded words get no attention.' },
      { n: 4, token: { line: 16, text: 'attn_layer(Z, value=Z' }, say: 'Self-attention: queries, keys and values are all Z, 8 heads in parallel.' },
    ],
    moves: {
      eq: [{ name: 'Scaled dot-product attention (slides 37–38)', tex: String.raw`\text{Attention}(\mathbf{Q}, \mathbf{K}, \mathbf{V}) = \text{softmax}\left(\frac{\mathbf{Q}\mathbf{K}^{\top}}{\sqrt{d_{\text{keys}}}}\right)\mathbf{V}`, plain: 'Attention(Q, K, V) = softmax(Q Kᵀ / √d_keys) V', line: 16 }],
      shapes: [
        { name: 'Q', shape: '[n_queries, d_keys]', means: 'one row per query (output position)' },
        { name: 'K, V', shape: '[n_keys, d_keys], [n_keys, d_values]', means: 'one row per key; V has one row per key too' },
        { name: 'Z, mask', shape: '(batch, T, embed_size), (batch, 1, T)', means: 'Z keeps its shape; the mask broadcasts over the queries' },
      ],
      forWhat: 'Letting each output focus on the most relevant inputs: a translation decoder over the encoder’s words, an encoder over its own words.',
    },
    slideCheck: 'Slide 38’s bullet writes 1/d_keys; the equation divides by √d_keys. key_dim=embed_size gives each of the 8 heads full-size projections, not the 1/8 splits slide 39 describes. The loop stops after the first sub-layer (no Add & Norm or feed-forward code).',
  },
  {
    id: 'positional-encoding',
    title: 'Positional encoding as a Keras layer',
    rating: 'core',
    why: 'Sample Q2(c)’s other key component: match the sine and cosine lines to the formula, and say how the encoding meets the embeddings.',
    sources: [{ kind: 'lecture', lec: 8, slides: '32–36' }],
    blocks: ['L8 s35', 'L8 s36'],
    provenance: 'trimmed',
    inv: ['l8-positional-encoding', 'l8-pos-encoding-use'],
    file: 'positional_encoding.py',
    code: `class PositionalEncoding(tf.keras.layers.Layer):
    def __init__(self, max_length, embed_size, dtype=tf.float32, **kwargs):
        super().__init__(dtype=dtype, **kwargs)
        assert embed_size % 2 == 0, "embed_size must be even"
        p, i = np.meshgrid(np.arange(max_length),
                           2 * np.arange(embed_size // 2))
        pos_emb = np.empty((1, max_length, embed_size))
        pos_emb[0, :, ::2] = np.sin(p / 10_000 ** (i / embed_size)).T
        pos_emb[0, :, 1::2] = np.cos(p / 10_000 ** (i / embed_size)).T
        self.pos_encodings = tf.constant(pos_emb.astype(self.dtype))
        self.supports_masking = True
    def call(self, inputs):
        batch_max_length = tf.shape(inputs)[1]
        return inputs + self.pos_encodings[:, :batch_max_length]
pos_embed_layer = PositionalEncoding(max_length, embed_size)
encoder_in = pos_embed_layer(encoder_embeddings)`,
    marks: [
      { n: 1, token: { line: 6, text: '2 * np.arange(embed_size // 2)' }, say: 'i runs over the even indices 0, 2, 4 …: one frequency per sine–cosine pair.' },
      { n: 2, lines: [8, 8], say: 'Even columns: sin(p / 10000^(i/d)), the formula’s even-i case.' },
      { n: 3, lines: [9, 9], say: 'Column i + 1 reuses exponent i/d = ((i + 1) − 1)/d: the odd case, with cosine.' },
      { n: 4, token: { line: 14, text: 'inputs + self.pos_encodings' }, say: 'Added to the word embeddings (not concatenated), cut to this batch’s length.' },
    ],
    moves: {
      eq: [{ name: 'Positional encoding (slide 32)', tex: String.raw`\mathbf{P}_{p,i} = \begin{cases} \sin\left(p/1000^{i/d}\right) & \text{if } i \text{ is even} \\ \cos\left(p/1000^{(i-1)/d}\right) & \text{if } i \text{ is odd} \end{cases}`, plain: 'P(p, i) = sin(p / 1000^(i/d)) if i is even; cos(p / 1000^((i − 1)/d)) if i is odd', line: 8 }],
      shapes: [
        { name: 'pos_encodings', shape: '(1, max_length, embed_size)', means: 'one row per position p, one column per dimension i' },
        { name: 'encoder_in', shape: '(batch, length, embed_size)', means: 'the same shape as the embeddings' },
      ],
      forWhat: 'Giving a transformer word order: attention ignores positions, so each position gets a fixed sine–cosine signature.',
    },
    slideCheck: 'Slide 32’s formula uses base 1000; the code uses 10_000 (Python’s digit separator: 10000, the base in Vaswani et al.). The layer has no trainable parameters, and the same layer serves the decoder.',
  },
];
