/* ============================================================================
   LECTURE 8 STUDY — SLIDE FACTS
   ----------------------------------------------------------------------------
   Everything the module quotes from the deck — CITS5017 Topic 8, "Attention
   Mechanisms, Transformers, and Vision Transformers" (51 slides, Chapter 16
   of Géron's Hands-On Machine Learning, 3rd ed.) — in one place: the code
   listings verbatim (indentation as on the slide images), the numbers the
   slides print, footnotes, slide 3's topics and slide 50's outcomes. Checked
   against Documents/cits5017/markdown-lecs/lecture-8.md.

   Nothing here is computed. The page's own numbers live in ./attn.js,
   ./toys.js and ./data (and are labelled as this page's own wherever shown).
   ========================================================================== */

/* ── numbers the slides print ────────────────────────────────────────────── */
export const PRINTED = {
  biRnnParams: { value: 674, slide: 9, text: '# 674 trainable params' },
  trainShape: { slide: 9, text: '# X_train.shape = (1027,56,2), y_train_1.shape = (1027,2)' },
  biRnnMAE: { value: 27936.60823591162, slide: 10, text: '27936.60823591162' },
  topic4MAE: { value: 27855, slide: 10, text: '27,855 from the RNN in topic 4 (slide 33/52)' },
  rnnEdMAE: { value: 34863.8857, slide: 17, text: 'Validation set MAE =  34,863.8857' },
  nPaper: { value: 6, slide: 30 },
  nSlide43: { value: 2, slide: 43 },
  vitDim: { value: 768, slide: 46, text: '16 × 16 × 3 = 768' },
  vitImages: { slide: 46, text: 'over 300 million additional images' },
};

/* ── slide 3's topics → the sections that teach them ─────────────────────── */
export const ROADMAP = [
  { topic: 'Encoder-decoder networks for neural machine translation', secs: ['s01', 's04', 's05'] },
  { topic: 'Bidirectional RNNs and LSTMs', secs: ['s02', 's03'] },
  { topic: 'Attention mechanisms, including additive attention and multiplicative attention', secs: ['s06', 's07'] },
  { topic: 'Implementing attention mechanisms using Keras', secs: ['s08'] },
  { topic: 'Visual attention', secs: ['s15'] },
  { topic: 'The original transformer', secs: ['s09', 's10', 's11', 's12', 's13', 's14'] },
  { topic: 'The original vision transformer', secs: ['s15'] },
];

/* ── slide 50's outcomes → sections ──────────────────────────────────────── */
export const OUTCOMES = [
  { text: 'Understand the encoder-decoder networks for neural machine translation', secs: ['s01', 's04', 's05'] },
  { text: 'Understand bidirectional RNNs and LSTMs', secs: ['s02', 's03'] },
  { text: 'Understand attention mechanisms and the differences between additive attention and multiplicative attention', secs: ['s06', 's07'] },
  { text: 'Know how to implement attention mechanisms using Keras', secs: ['s08'] },
  { text: 'Understand visual attention', secs: ['s15'] },
  { text: 'Understand transformers and vision transformers', secs: ['s09', 's10', 's11', 's12', 's13', 's14', 's15'] },
];

/* ── slide 51 ────────────────────────────────────────────────────────────── */
export const READING = 'Read up to Chapter 18 on Reinforcement Learning.';

/* ── footnotes (Fnote / RefsProvider), verbatim ──────────────────────────── */
export const REFS = {
  1: 'Do not confuse this with the *encoder* and *decoder* in an autoencoder network. (Slide 4, footnote 1.)',
  2: 'For example, as **Word2Vec**, **GloVe** (**Global Vectors for Word Representation**), or **fastText**, etc. (Slide 6, footnote 2.)',
  3: 'Note that the example shown on that slide is for one instance only. Modification will be needed to make it work for the whole test set. (Slide 11, footnote 3.)',
  4: 'Dzmitry Bahdanau et al., “Neural Machine Translation by Jointly Learning to Align and Translate”, arXiv preprint arXiv:1409.0473 (2014) (Slide 19, footnote 4.)',
  5: 'vector $\\mathbf{h}_{(2)}$ is the hidden state output from the previous time step (in this case, time step 2) of the decoder; $\\mathbf{y}_{(0)}$, $\\mathbf{y}_{(1)}$, and $\\mathbf{y}_{(2)}$ are three output vectors from the encoder. (Slide 22, footnote 5.)',
  6: 'Minh-Thang Luong et al., “Effective Approaches to Attention-Based Neural Machine Translation”, Proceedings of the 2015 Conference on Empirical Methods in Natural Language Processing (2015): 1412–1421. (Slide 24, footnote 6.)',
  7: 'Ashish Vaswani et al., “Attention Is All You Nee”, Proceedings of the 31st International Conference on Neural Information Processing Systems (2017): 6000–6010. (Slide 29, footnote 7; the title is cut off on the slide.)',
  8: 'Installation can be done by running the command: `pip install tf-models-official`. **Warning:** this is probably a very large library and is not easy to install. (Slide 34, footnote 8.)',
  9: 'Kelvin Xu et al., “Show, Attend and Tell: Neural Image Caption Generation with Visual Attention”, Proceedings of the 32nd International Conference on Machine Learning (2015): 2048-2057. (Slide 44, footnote 9.)',
  10: 'Alexey Dosovitskiy et al., “An Image Is Worth 16x16 Words: Transformers for Image Recognition at Scale”, arXiv preprint arxiv:2010.11929 (2020). (Slide 46, footnote 10.)',
  11: 'Hugo Touvron et al., “Training Data-Efficient Image Transformers & Distillation Through Attention”, arXiv preprint arxiv:2012.12877 (2020). (Slide 47, footnote 11.)',
  12: 'Andrew Jaegle et al., “Perceiver: General Perception with Iterative Attention”, arXiv preprint arxiv:2103.03206 (2021). (Slide 47, footnote 12.)',
  13: 'Mathilde Caron et al., “Emerging Properties in Self-Supervised Vision Transformers”, arXiv preprint arxiv:2104.14294 (2021). (Slide 47, footnote 13.)',
  14: 'Xiaohua Zhai et al., “Scaling Vision Transformers”, arXiv preprint arxiv:2106.04560v1 (2021). (Slide 48, footnote 14.)',
  15: 'Jean-Baptiste Alayrac et al., “Flamingo: a Visual Language Model for Few-Shot Learning”, arXiv preprint arxiv:2204.14198 (2022). (Slide 48, footnote 15.)',
  16: 'Scott Reed et al., “A Generalist Agent”, arXiv preprint arxiv:2205.06175 (2022). (Slide 48, footnote 16.)',
};

/* ── code listings, verbatim ─────────────────────────────────────────────── */
const BI_ENCODER = `encoder = tf.keras.layers.Bidirectional(
    tf.keras.layers.LSTM(256, return_state=True))`;

const BI_STATES = `encoder_outputs, *encoder_state = encoder(encoder_embeddings)
encoder_state = [
  tf.keras.layers.Concatenate(axis=-1)(encoder_state[::2]),  #short-term (0&2)
  tf.keras.layers.Concatenate(axis=-1)(encoder_state[1::2])  #long-term  (1&3)
]`;

const SIMPLE_BIRNN = `simple_biRNN = tf.keras.Sequential([
    tf.keras.layers.InputLayer(input_shape=[None, 2]),
    tf.keras.layers.Bidirectional(
        tf.keras.layers.SimpleRNN(16)),
    tf.keras.layers.Dense(2)
])                                        # 674 trainable params
early_stopping_cb = tf.keras.callbacks.EarlyStopping(
    monitor="val_loss", patience=50, restore_best_weights=True)

# PrintEpochLossCallback -- A customized Callback class to help reduce
# the verbose printing of training loss, MAE, etc.
logging_cb = PrintEpochLossCallback(20, Nepochs)
opt = tf.keras.optimizers.SGD(learning_rate=0.02, momentum=0.9)
simple_biRNN.compile(loss="mse", optimizer=opt, metrics=["mae"])

# X_train.shape = (1027,56,2), y_train_1.shape = (1027,2)
history = simple_biRNN.fit(X_train, y_train, epochs=500,
                 validation_data=(X_valid, y_valid_1),
                 verbose = 0, callbacks=[logging_cb, early_stopping_cb])`;

const BIRNN_LOG = `Epoch   0: loss: 0.0932, mae: 0.2250; val_loss: 0.0221, val_mae: 0.1136
...
Epoch 160: loss: 0.0046, mae: 0.0404; val_loss: 0.0015, val_mae: 0.0279
Epoch 180: loss: 0.0046, mae: 0.0406; val_loss: 0.0017, val_mae: 0.0288`;

const BIRNN_EVAL = `>>> yvalid_pred = simple_biRNN.predict(X_valid, verbose=0)
>>> print(np.mean(np.abs(yvalid_pred - y_valid)) * 1e6)
27936.60823591162`;

const RNN_ED = `inputs_dim = 2   # bus and rail
# the encoder takes in (bus,rail) sequences (55 days)
encoder_inputs = tf.keras.Input(shape=[None, inputs_dim])
encoder = tf.keras.layers.Bidirectional(
    tf.keras.layers.SimpleRNN(16, return_state=True))
encoder_outputs, *encoder_state = encoder(encoder_inputs)

# encoder_state is a list containing 2 elements: the forward
# state and the backward state. We need to pass them to the decoder.
encoder_state = tf.keras.layers.Concatenate(axis=-1)(encoder_state)
# encoder_state is now a Keras tensor of shape (None,32)

# the decoder learns to predict (bus,rail) sequences (14 days
# after the input 56 days)
decoder_inputs = tf.keras.layers.Input(shape=[None, 2])

# Note: the #neurons for the decoder must match the shape of encoder_state
decoder = tf.keras.layers.SimpleRNN(32, return_sequences=True)
decoder_outputs = decoder(decoder_inputs, initial_state=encoder_state)

outputs = tf.keras.layers.Dense(2)(decoder_outputs)

rnn_ed = tf.keras.Model(inputs=[encoder_inputs, decoder_inputs],
                        outputs=outputs)`;

const RNN_ED_FIT = `early_stopping_cb = tf.keras.callbacks.EarlyStopping(
    monitor='val_loss', patience=50, restore_best_weights=True)

logging_cb = PrintEpochLossCallback(20, Nepochs)

rnn_ed.compile(loss="mse", optimizer="nadam", metrics=["mae"])
history = rnn_ed.fit((X_train, X_train_decode), y_train, epochs=500,
               validation_data=((X_valid, X_valid_decode), y_valid),
               verbose=0, callbacks=[logging_cb, early_stopping_cb])

Epoch   0: loss: 0.0956, mae: 0.2332; val_loss: 0.0316, val_mae: 0.1468
...
Epoch 220: loss: 0.0042, mae: 0.0364; val_loss: 0.0024, val_mae: 0.0307
Epoch 240: loss: 0.0041, mae: 0.0361; val_loss: 0.0024, val_mae: 0.0314
Epoch 260: loss: 0.0040, mae: 0.0358; val_loss: 0.0025, val_mae: 0.0322`;

const CURVES = `hist = history.history
N_training_epochs = len(hist['loss'])
pd.DataFrame(hist).plot(
    figsize=(4,3), xlim=[0, N_training_epochs-1], ylim=[0, 0.2],
    grid=True, xlabel="Epoch", style=["r--", "r-.", "b--", "b-."])
plt.legend(loc="best")
plt.title('Learning curves')
plt.show()`;

const PREDICT = `def predict(model, encoder_inputs, decoder_input, outseq_len, **kwargs):
    # encoder_inputs could be X_val or X_test over 55 days (0 to 54).
    # decoder_input is X_val for 1 day only (day 55).
    # outseq_len is the required length of the output sequences (14 here).
    batch_size = encoder_inputs.shape[0]
    out_dim = decoder_input.shape[-1]

    # the output sequence to be predicted
    outseq = np.zeros((batch_size, outseq_len, out_dim))
    # construct the inputs for the decoder
    decoder_ins = np.zeros((batch_size, outseq_len, out_dim))
    decoder_ins[:, 0, :] = decoder_input
    for t in range(outseq_len):
        # call model.predict(...) and update decoder_ins and outseq
    return outseq
>>> yvalid_pred = predict(model, X_valid, X_valid_decode[:,0],
                          out_seq_length, verbose=0)
>>> print(r'Validation set MAE = {:11,.4f}'.format(
                   np.mean(np.abs(yvalid_pred-y_valid))*1e6))
Validation set MAE =  34,863.8857`;

const KERAS_ENCODER = `encoder = tf.keras.layers.Bidirectional(
tf.keras.layers.LSTM(256, return_sequences=True, return_state=True))`;

const KERAS_ATTENTION = `attention_layer = tf.keras.layers.Attention()  # default: score_mode="dot"
attention_outputs = attention_layer([decoder_outputs, encoder_outputs])
output_layer = tf.keras.layers.Dense(vocab_size, activation="softmax")
Y_proba = output_layer(attention_outputs)`;

const POS_ENCODING = `class PositionalEncoding(tf.keras.layers.Layer):
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
        return inputs + self.pos_encodings[:, :batch_max_length]`;

const POS_USE = `pos_embed_layer = PositionalEncoding(max_length, embed_size)
encoder_in = pos_embed_layer(encoder_embeddings)
decoder_in = pos_embed_layer(decoder_embeddings)`;

const KERAS_TRANSFORMER = `N = 2          # instead of 6
num_heads = 8
dropout_rate = 0.1
n_units = 128  # for the first Dense layer in each Feed Forward block
encoder_pad_mask = tf.math.not_equal(encoder_input_ids, 0)[:, tf.newaxis]
Z = encoder_in
for _ in range(N):
    skip = Z
    attn_layer = tf.keras.layers.MultiHeadAttention(
        num_heads=num_heads, key_dim=embed_size, dropout=dropout_rate)
    Z = attn_layer(Z, value=Z, attention_mask=encoder_pad_mask)

    # ... add in other layers as shown in Figure 16-8`;

export const NAMED_CODE = {
  BI_ENCODER,
  BI_STATES,
  SIMPLE_BIRNN,
  BIRNN_LOG,
  BIRNN_EVAL,
  RNN_ED,
  RNN_ED_FIT,
  CURVES,
  PREDICT,
  KERAS_ENCODER,
  KERAS_ATTENTION,
  POS_ENCODING,
  POS_USE,
  KERAS_TRANSFORMER,
};
