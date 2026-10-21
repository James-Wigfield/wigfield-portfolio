/* ============================================================================
   LECTURE 5 STUDY — SLIDE FACTS
   ----------------------------------------------------------------------------
   Everything the module quotes from the deck — CITS5017 Topic 5,
   "Representation learning and dimension reduction using Autoencoders"
   (27 slides, Chapter 17 of Géron's Hands-On Machine Learning, 3rd ed.) —
   kept in one place: the code listings verbatim (indentation as on the slide
   images), the two parameter counts the slides print, figure captions, the
   footnote, slide 3's topics and slide 26's outcomes. Checked against
   Documents/cits5017/markdown-lecs/lecture-5.md.

   Nothing here is computed. The page's own numbers live in ./ae.js and
   ./data (and are labelled as this page's own wherever they are shown).
   ========================================================================== */

export const DECK = {
  topic: 'Topic 5: Representation learning and dimension reduction using Autoencoders',
  lecturer: 'Associate Professor Du Huynh (Unit Coordinator and Lecturer)',
  semester: 'Semester 2, 2026',
  slides: 27,
  chapter: 'Chapter 17',
  chapterTitle: 'Autoencoders, GANs, and Diffusion Models',
};

/* ── the two parameter counts printed on the slides ──────────────────────── */
export const PARAMS = {
  stacked: { value: 163814, slide: 12, text: 'This model (stacked_ae) has 163,814 trainable parameters.' },
  tied: { value: 82414, slide: 21, text: 'tied_ae only has 82,414 trainable parameters (number of parameters that require training is almost halved).' },
};

/* ── slide 5's two sequences ─────────────────────────────────────────────── */
export const SEQ_A = [40, 27, 25, 36, 81, 57, 10, 73, 19, 68];
export const SEQ_B = [50, 48, 46, 44, 42, 40, 38, 36, 34, 32, 30, 28, 26, 24, 22, 20, 18, 16, 14];

/* ── slide 3's topics → the sections that teach them ─────────────────────── */
export const ROADMAP = [
  { topic: 'What are Autoencoders?', secs: ['s01'] },
  { topic: 'Efficient data representations', secs: ['s02'] },
  { topic: 'Encoder and decoder in an autoencoder', secs: ['s02', 's03'] },
  { topic: 'Performing PCA using an undercomplete linear autoencoder', secs: ['s03'] },
  { topic: 'Stacked autoencoders and how to implement one using Keras in TensorFlow', secs: ['s04', 's05'] },
  { topic: 'Tying the weights in a stacked autoencoder and visualizing the reconstruction', secs: ['s08', 's06'] },
  { topic: 'Unsupervised pre-training using stacked autoencoders', secs: ['s07'] },
  { topic: 'Training one autoencoder at a time', secs: ['s09'] },
];

/* ── slide 26's outcomes → sections (slide 3's last topic has none) ──────── */
export const OUTCOMES = [
  { text: 'Understand that autoencoders can be trained and used as a way to efficiently represent data (analogous to PCA).', secs: ['s01', 's02', 's03'] },
  { text: 'Understand the two main parts in an autoencoder: the encoder and the decoder.', secs: ['s02'] },
  { text: 'Know how to implement an undercomplete linear autoencoder in TensorFlow to perform PCA on the input data.', secs: ['s03'] },
  { text: 'Understand stacked autoencoders and know how to implement one using TensorFlow.', secs: ['s04', 's05'] },
  { text: 'Understand the concept of tying the weights in a stacked autoencoder and know how to visualize the reconstruction.', secs: ['s08', 's06'] },
  { text: 'Understand how to use stacked autoencoders in unsupervised pre-training tasks.', secs: ['s07'] },
];

/* ── slide 27's reading ──────────────────────────────────────────────────── */
export const READING = 'Read up to Chapter 17 on Autoencoders, GANs, and Diffusion Models (from page 647 to page 667; excluding the Sparse Autoencoders section)';

/* ── footnotes (Fnote / RefsProvider) ────────────────────────────────────── */
export const REFS = {
  1: '*t-distributed stochastic neighbour embedding* (proposed by van der Maaten and Hinton in 2008) reduces dimensionality while trying to keep similar instances close and dissimilar instances apart. (Slide 14, footnote 1.)',
};

/* ── figure captions, verbatim ───────────────────────────────────────────── */
export const CAPTIONS = {
  fig171: 'Figure 17-1. The chess memory experiment (left) and a simple autoencoder (right)',
  slide9: 'Left: The 3D training set. Bright/light red dots: 3D points above/below the light blue plane; blue markers: the projections of the 3D points onto the plane. Right: The approximate PCA performed by the undercomplete linear autoencoder. (compare the blue markers in the two diagrams)',
  fig173: 'Figure 17-3. Stacked autoencoder',
  fig174: 'Figure 17-4. Original images (top) and their reconstructions (bottom)',
  fig175: 'Figure 17-5. Fashion MNIST visualization using an autoencoder followed by t-SNE',
  fig176: 'Figure 17-6. Unsupervised pretraining using autoencoders.',
  slide19: 'Tying the weights in a stacked autoencoder (N = 4 in this example).',
  slide22: 'Original images (top) and their reconstructions (bottom)',
  fig177: 'Figure 17-7. Training one autoencoder at a time',
  slide25: 'Original images (top) and their reconstructions (bottom)',
};

/* ── code listings, verbatim ─────────────────────────────────────────────── */
const LINEAR_AE = `import tensorflow as tf

encoder = tf.keras.models.Sequential([tf.keras.layers.Dense(2)])
decoder = tf.keras.models.Sequential([tf.keras.layers.Dense(3)])
autoencoder = tf.keras.Sequential([encoder, decoder])

optimizer = tf.keras.optimizers.SGD(learning_rate=0.5)
autoencoder.compile(loss="mse", optimizer=optimizer)`;

const LINEAR_FIT = `X_train = [...]  # shape of X_train is (60,3) in the example above
history = autoencoder.fit(X_train, X_train, epochs=500, verbose=False)
codings = encoder.predict(X_train)`;

const STACKED_AE = `stacked_encoder = tf.keras.Sequential([
    tf.keras.layers.InputLayer(shape=[28,28]),
    tf.keras.layers.Flatten(),
    tf.keras.layers.Dense(100, activation="relu"),
    tf.keras.layers.Dense(30, activation="relu"),
])
stacked_decoder = tf.keras.Sequential([
    tf.keras.layers.Dense(100, activation="relu"),
    tf.keras.layers.Dense(28 * 28),
    tf.keras.layers.Reshape([28, 28])
])
stacked_ae = tf.keras.Sequential([stacked_encoder, stacked_decoder])

stacked_ae.compile(loss="mse", optimizer="nadam")
history = stacked_ae.fit(X_train, X_train, epochs=20,
                         validation_data=(X_valid, X_valid))`;

const TSNE = `from sklearn.manifold import TSNE
X_valid_compressed = stacked_encoder.predict(X_valid)
tsne = TSNE()
X_valid_2D = tsne.fit_transform(X_valid_compressed)`;

const DENSE_TRANSPOSE = `class DenseTranspose(tf.keras.layers.Layer):
    def __init__(self, dense, activation=None, **kwargs):
        super().__init__(**kwargs)
        self.dense = dense
        self.activation = tf.keras.activations.get(activation)

    def build(self, batch_input_shape):
        self.biases = self.add_weight(
                        name="bias",
                        shape=[self.dense.input.shape[-1]],    # ***
                        initializer="zeros")
        super().build(batch_input_shape)

    def call(self, inputs):
        Z = tf.matmul(inputs, self.dense.weights[0], transpose_b=True)
        return self.activation(Z + self.biases)

dense_1 = tf.keras.layers.Dense(100, activation="relu")
dense_2 = tf.keras.layers.Dense(30, activation="relu")`;

const TIED_AE = `tied_encoder = tf.keras.Sequential([
    tf.keras.layers.InputLayer(shape=[28,28]),
    tf.keras.layers.Flatten(),
    dense_1,
    dense_2
])
tied_decoder = tf.keras.Sequential([
    DenseTranspose(dense_2, activation="relu"),
    DenseTranspose(dense_1),
    tf.keras.layers.Reshape([28, 28])
])

tied_ae = tf.keras.Sequential([tied_encoder, tied_decoder])
tied_ae.compile(loss="mse", optimizer="nadam")
history = tied_ae.fit(X_train, X_train, epochs=10,
                      validation_data=(X_valid, X_valid))`;

const TRAIN_1BY1 = `def train_autoencoder(n_neurons, X_train, X_valid, n_epochs=10,
                      output_activation=None):
    n_inputs = X_train.shape[-1]
    encoder = tf.keras.layers.Dense(n_neurons, activation="relu")
    decoder = tf.keras.layers.Dense(n_inputs, activation=output_activation)
    autoencoder = tf.keras.Sequential([encoder, decoder])
    autoencoder.compile(loss="mse", optimizer="nadam")
    autoencoder.fit(X_train, X_train, epochs=n_epochs,
                    validation_data=(X_valid, X_valid))
    return encoder, decoder, encoder(X_train), encoder(X_valid)

X_train_flat = tf.keras.layers.Flatten()(X_train)
X_valid_flat = tf.keras.layers.Flatten()(X_valid)

# Train the first autoencoder using X_train_flat and X_valid_flat.
# X_train_enc1 and X_valid_enc1 are the compressed representations.
enc1, dec1, X_train_enc1, X_valid_enc1 = train_autoencoder(
    100, X_train_flat, X_valid_flat)

# Train the second autoencoder using X_train_enc1 and X_valid_enc1.
enc2, dec2, _, _ = train_autoencoder(
    30, X_train_enc1, X_valid_enc1, output_activation="relu")

# Stack up to form the final autoencoder.
stacked_ae_1_by_1 = tf.keras.Sequential([
    tf.keras.layers.Flatten(),
    enc1, enc2, dec2, dec1,
    tf.keras.layers.Reshape([28, 28])
])`;

const CONTINUE_1BY1 = `# If needed, we can then continue training the full stacked autoencoder
# for a few epochs
stacked_ae_1_by_1.compile(loss="mse", optimizer="nadam")
history = stacked_ae_1_by_1.fit(X_train, X_train, epochs=5,
                                validation_data=(X_valid, X_valid))

# visualize the reconstruction
plot_reconstructions(stacked_ae_1_by_1) # see the author's Jupyter
                                        # notebook file
plt.show()`;

// { code: { src: 'NAME' } } in sections.js picks one of these
export const NAMED_CODE = {
  LINEAR_AE,
  LINEAR_FIT,
  STACKED_AE,
  TSNE,
  DENSE_TRANSPOSE,
  TIED_AE,
  TRAIN_1BY1,
  CONTINUE_1BY1,
};

// slide 12's listing, line by line, with the layer each line builds (the
// StackedCodeLab links lines ↔ rows of the parameter table)
export const STACKED_LINES = STACKED_AE.split('\n');
export const STACKED_LINE_LAYER = {
  2: 'input',
  3: 'flatten',
  4: 'enc1',
  5: 'enc2',
  8: 'dec1',
  9: 'dec2',
  10: 'reshape',
  15: 'fit',
  16: 'fit',
};
