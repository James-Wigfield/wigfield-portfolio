/* ============================================================================
   LECTURES 6–7 STUDY — SLIDE FACTS
   ----------------------------------------------------------------------------
   Everything the module quotes from the deck — CITS5017 Topics 6&7,
   "Convolutional AEs, Denoising AEs, Variational AEs, GANs, and DCGANs"
   (32 slides, Chapter 17 of Géron's Hands-On Machine Learning, 3rd ed.) —
   kept in one place: the code listings verbatim (indentation and the ×
   in slide 5's comments as printed), the numbers the slides print, figure
   captions, footnotes, slide 3's topics, slide 28's guidelines and slide 31's
   outcomes. Checked against Documents/cits5017/markdown-lecs/lecture-6-7.md.

   MODELS restates each listing as a layer spec for ./gen.js flow(), so the
   labs can work out every shape and parameter count; nothing in it is a
   number the slides don't give, except where ./gen.js computes it.
   ========================================================================== */

/* ── the numbers the slides print ─────────────────────────────────────────── */
export const PARAMS = {
  convDecoder: { value: 13873, slide: 6, text: 'Total params: 13,873' },
  convAe: { value: 54479, slide: 6, text: '>>> conv_ae.count_params()   # output the total number of parameters (trainable + non-trainable)\n54479' },
};

// slide 6's conv_decoder.summary(), row by row (layer names as printed)
export const SUMMARY_ROWS = [
  { name: 'dense_12 (Dense)', shape: '(None, 144)', params: 4464 },
  { name: 'reshape_4 (Reshape)', shape: '(None, 3, 3, 16)', params: 0 },
  { name: 'conv2d_transpose (Conv2DTra nspose)', shape: '(None, 7, 7, 32)', params: 4640 },
  { name: 'conv2d_transpose_1 (Conv2DT ranspose)', shape: '(None, 14, 14, 16)', params: 4624 },
  { name: 'conv2d_transpose_2 (Conv2DT ranspose)', shape: '(None, 28, 28, 1)', params: 145 },
  { name: 'reshape_5 (Reshape)', shape: '(None, 28, 28)', params: 0 },
];

/* ── slide 3's topics → the sections that teach them ─────────────────────── */
export const ROADMAP = [
  { topic: 'Convolutional autoencoders', secs: ['s01'] },
  { topic: 'Denoising autoencoders', secs: ['s02'] },
  { topic: 'Variational autoencoders', secs: ['s03', 's04', 's05', 's06'] },
  { topic: 'Generative Adversarial Networks', secs: ['s07', 's08', 's09', 's10'] },
  { topic: 'Deep convolutional generative adversarial networks (DCGANs)', secs: ['s11'] },
];

/* ── slide 31's outcomes → sections ──────────────────────────────────────── */
export const OUTCOMES = [
  { text: 'Understand convolutional autoencoders', secs: ['s01'] },
  { text: 'Understand denoising autoencoders', secs: ['s02'] },
  { text: 'Understand variational autoencoders', secs: ['s03', 's04', 's05', 's06'] },
  { text: 'Understand generative adversarial networks', secs: ['s07', 's08', 's09', 's10'] },
  { text: 'Understand deep convolutional generative adversarial networks', secs: ['s11'] },
];

/* ── slide 32's reading ──────────────────────────────────────────────────── */
export const READING = 'Read up to Chapter 16 on Natural Language Processing with RNNs and Attention (roughly from pages 595 to 629).';

/* ── slide 28's DCGAN guidelines, verbatim ───────────────────────────────── */
export const GUIDELINES = [
  'Replace any pooling layers with strided convolutions (in the discriminator) and transposed convolutions (in the generator).',
  'Use Batch Normalization in both the generator and the discriminator, except in the generator’s output layer and the discriminator’s input layer.',
  'Remove fully connected hidden layers for deeper architectures.',
  'Use ReLU activation in the generator for all layers except the output layer, which should use tanh.',
  'Use leaky ReLU activation in the discriminator for all layers.',
];

/* ── footnotes (Fnote / RefsProvider) ────────────────────────────────────── */
export const REFS = {
  1: 'Pascal Vincent et al., “Stacked Denoising Autoencoders: Learning Useful Representations in a Deep Network with a Local Denoising Criterion,” *Journal of Machine Learning Research* 11 (2010): 3371-3408. (Slide 8, footnote 1.)',
  2: 'Diederik Kingma and Max Welling, “Auto-Encoding Variational Bayes”, arXiv preprint arXiv:1312.6114 (2013). (Slide 10, footnote 2.)',
  3: 'For more mathematical details, check out the original paper on *variational autoencoders*, or Carl Doersch’s “Tutorial on Variational Autoencoders”, arXiv:1606.05908, 2016 (2016). (Slide 13, footnote 3.)',
  4: 'Ian Goodfellow et al., “Generative Adversarial Nets,” Int. Conf. on Neural Information Processing Systems (2014): 2672-2680. (Slide 19, footnote 4.)',
  5: 'Alec Radford et al., “Unsupervised Representation Learning with Deep Convolutional Generative Adversarial Networks,” arXiv:1511.06434 (2015). (Slide 28, footnote 5.)',
};

/* ── figure captions, verbatim ───────────────────────────────────────────── */
export const CAPTIONS = {
  fig178: 'Figure 17-8. Denoising autoencoders, with Gaussian noise (left) or dropout (right)',
  fig179: 'Figure 17-9. (top) Noisy images (with half the pixels turned off) and (bottom) their reconstructions by the dropout-based denoising autoencoder.',
  fig1711: 'Figure 17-11. A variational autoencoder (left) and an instance going through it (right)',
  fig1712: 'Figure 17-12. Fashion MNIST images generated by the variational autoencoder',
  slide18: 'Semantic interpolation.',
  fig1714: 'Figure 17-14. A generative adversarial network.',
  fig1715: 'Figure 17-15. Images generated by the GAN after one epoch of training',
  fig1716: 'Figure 17-16. Images generated by the DCGAN after 50 epochs of training',
};

/* ── code listings, verbatim ─────────────────────────────────────────────── */
const CONV_AE = `conv_encoder = tf.keras.Sequential([
    tf.keras.layers.Reshape([28, 28, 1]),
    tf.keras.layers.Conv2D(16, 3, padding="same", activation="relu"),
    tf.keras.layers.MaxPool2D(pool_size=2),  # output: 14 × 14 × 16
    tf.keras.layers.Conv2D(32, 3, padding="same", activation="relu"),
    tf.keras.layers.MaxPool2D(pool_size=2),  # output: 7 × 7 × 32
    tf.keras.layers.Conv2D(64, 3, padding="same", activation="relu"),
    tf.keras.layers.MaxPool2D(pool_size=2),  # output: 3 × 3 × 64
    tf.keras.layers.Conv2D(30, 3, padding="same", activation="relu"),  # output: 3 × 3 × 30
    tf.keras.layers.GlobalAvgPool2D()  # output: 30
])
conv_decoder = tf.keras.Sequential([
    tf.keras.layers.Dense(3 * 3 * 16),     # 144 neurons
    tf.keras.layers.Reshape((3, 3, 16)),   # output: 3 × 3 × 16
    tf.keras.layers.Conv2DTranspose(32, 3, strides=2, activation="relu"), # output: 7 × 7 × 32
    tf.keras.layers.Conv2DTranspose(16, 3, strides=2, padding="same",
                                    activation="relu"),                 # output: 14 × 14 × 16
    tf.keras.layers.Conv2DTranspose(1, 3, strides=2, padding="same"),   # output: 28 × 28 × 1
    tf.keras.layers.Reshape([28, 28])
])
conv_ae = tf.keras.Sequential([conv_encoder, conv_decoder])

# compile and fit the model
conv_ae.compile(loss="mse", optimizer="nadam")
history = conv_ae.fit(X_train, X_train, epochs=10,
                      validation_data=(X_valid, X_valid))`;

const CONV_SUMMARY = `>>> conv_decoder.summary()
Model: "sequential_12"
_________________________________________________________________
 Layer (type)                Output Shape              Param #
=================================================================
 dense_12 (Dense)            (None, 144)               4464

 reshape_4 (Reshape)         (None, 3, 3, 16)          0

 conv2d_transpose (Conv2DTra  (None, 7, 7, 32)         4640
 nspose)

 conv2d_transpose_1 (Conv2DT  (None, 14, 14, 16)       4624
 ranspose)

 conv2d_transpose_2 (Conv2DT  (None, 28, 28, 1)        145
 ranspose)

 reshape_5 (Reshape)         (None, 28, 28)            0

=================================================================
Total params: 13,873
Trainable params: 13,873
Non-trainable params: 0

>>> conv_ae.count_params()   # output the total number of parameters (trainable + non-trainable)
54479`;

const DROPOUT_AE = `dropout_encoder = tf.keras.Sequential([
    tf.keras.layers.Flatten(),
    tf.keras.layers.Dropout(0.5),
    tf.keras.layers.Dense(100, activation="relu"),
    tf.keras.layers.Dense(30, activation="relu")
])
dropout_decoder = tf.keras.Sequential([
    tf.keras.layers.Dense(100, activation="relu"),
    tf.keras.layers.Dense(28 * 28),
    tf.keras.layers.Reshape([28, 28])
])
dropout_ae = tf.keras.Sequential([dropout_encoder, dropout_decoder])

# compile and fit the model
dropout_ae.compile(loss="mse", optimizer="nadam")
history = dropout_ae.fit(X_train, X_train, epochs=10,
                         validation_data=(X_valid, X_valid))`;

const VAE_PARTS = `# define a customized layer
class Sampling(tf.keras.Layer):
    def call(self, inputs):
        mean, logvar = inputs
        # sum the losses over all the features
        loss = -0.5 * tf.reduce_sum(1 + logvar - tf.exp(logvar) - tf.square(mean), axis=-1)
        # average over instances in the minibatch. 784=28*28 is the output image dimension.
        # *** add the latent loss here ***
        self.add_loss(tf.reduce_mean(loss) / 784.)                             # ***
        return tf.random.normal(tf.shape(logvar)) * tf.exp(logvar / 2) + mean

# the encoder part of the VAE
inputs = tf.keras.Input(shape=[28, 28])
Z = tf.keras.layers.Flatten()(inputs)
Z = tf.keras.layers.Dense(150, activation="relu")(Z)
Z = tf.keras.layers.Dense(100, activation="relu")(Z)
codings_mean = tf.keras.layers.Dense(codings_size)(Z)     # mu
codings_log_var = tf.keras.layers.Dense(codings_size)(Z)  # gamma
codings = Sampling()([codings_mean, codings_log_var])
variational_encoder = tf.keras.Model(
    inputs=inputs, outputs=[codings_mean, codings_log_var, codings])           # ***

# the decoder part of the VAE
decoder_inputs = tf.keras.Input(shape=[codings_size])
x = tf.keras.layers.Dense(100, activation="relu")(decoder_inputs)
x = tf.keras.layers.Dense(150, activation="relu")(x)
x = tf.keras.layers.Dense(28 * 28)(x)
outputs = tf.keras.layers.Reshape([28, 28])(x)
variational_decoder = tf.keras.Model(inputs=decoder_inputs, outputs=outputs)   # ***`;

const VAE_FIT = `# now join the encoder and decoder together to form our VAE
_, _, codings = variational_encoder(inputs)
reconstructions = variational_decoder(codings)
variational_ae = tf.keras.Model(inputs=inputs, outputs=reconstructions)

# compile and train our VAE to minimize the total loss (latent loss + reconstruction loss)
variational_ae.compile(loss="mse", optimizer="nadam")
history = variational_ae.fit(X_train, X_train, epochs=25, batch_size=128,
                             validation_data=(X_valid, X_valid))`;

const VAE_GENERATE = `# after training, we can generate Fashion MNIST images
codings = tf.random.normal(shape=[3 * 7, codings_size])
images = variational_decoder(codings).numpy()  # shape is (21,28,28)`;

const VAE_INTERP = `tf.random.set_seed(123)

# generate 2 codings from the normal distribution
codings = tf.random.normal(shape=[2, codings_size])

# linearly interpolate 10 elements from the 2 codings
inter_codings = np.linspace(codings[0], codings[1], 10)

# decode the 10 codings
images = variational_decoder(inter_codings).numpy()

plot_multiple_images(images, n_cols=10)         # see code for chapter 17`;

const GAN_BUILD = `codings_size = 30
from tensorflow.keras.layers import Dense
generator = tf.keras.Sequential([
    Dense(100, activation="relu", kernel_initializer="he_normal"),
    Dense(150, activation="relu", kernel_initializer="he_normal"),
    Dense(28 * 28, activation="sigmoid"),
    tf.keras.layers.Reshape([28, 28])
])
discriminator = tf.keras.Sequential([
    tf.keras.layers.Flatten(),
    Dense(150, activation="relu", kernel_initializer="he_normal"),
    Dense(100, activation="relu", kernel_initializer="he_normal"),
    Dense(1, activation="sigmoid")
])
gan = tf.keras.Sequential([generator, discriminator])`;

const GAN_COMPILE = `discriminator.compile(loss="binary_crossentropy", optimizer="rmsprop")
gan.compile(loss="binary_crossentropy", optimizer="rmsprop")`;

const GAN_DATASET = `batch_size = 32
dataset = tf.data.Dataset.from_tensor_slices(X_train).shuffle(1000)
dataset = dataset.batch(batch_size, drop_remainder=True).prefetch(1)`;

const GAN_TRAIN = `def train_gan(gan, dataset, batch_size, codings_size, n_epochs):
    generator, discriminator = gan.layers
    for epoch in tf.range(n_epochs):
        epoch = tf.cast(epoch, tf.int64)
        tf.print(f"Epoch {epoch + 1}/{n_epochs}")  # extra code
        for X_batch in dataset:
            ### phase 1 - training the discriminator
            noise = tf.random.normal(shape=[batch_size, codings_size])
            generated_images = generator(noise)
            X_fake_and_real = tf.concat([generated_images, X_batch], axis=0)
            y1 = tf.constant([[0.]] * batch_size + [[1.]] * batch_size)
            discriminator.trainable = True  # *** this line is missing in the author's code
            discriminator.train_on_batch(X_fake_and_real, y1)
            ### phase 2 - training the generator
            noise = tf.random.normal(shape=[batch_size, codings_size])
            y2 = tf.constant([[1.]] * batch_size)
            # discriminator now needs to be non-trainable so that training gan
            # will result in training the generator only.
            discriminator.trainable = False  # *** this line is missing in the author's code
            gan.train_on_batch(noise, y2)
        # extra code - plot images during training (omit to save time)
train_gan(gan, dataset, batch_size, codings_size, n_epochs=50)`;

const DCGAN = `codings_size = 100

generator = tf.keras.Sequential([
    tf.keras.layers.Dense(7 * 7 * 128),
    tf.keras.layers.Reshape([7, 7, 128]),
    tf.keras.layers.BatchNormalization(),
    tf.keras.layers.Conv2DTranspose(64, kernel_size=5, strides=2,
                                    padding="same", activation="relu"),
    tf.keras.layers.BatchNormalization(),
    tf.keras.layers.Conv2DTranspose(1, kernel_size=5, strides=2,
                                    padding="same", activation="tanh"),
])
discriminator = tf.keras.Sequential([
    tf.keras.layers.Conv2D(64, kernel_size=5, strides=2, padding="same",
                        activation=tf.keras.layers.LeakyReLU(0.2)),
    tf.keras.layers.Dropout(0.4),
    tf.keras.layers.Conv2D(128, kernel_size=5, strides=2, padding="same",
                        activation=tf.keras.layers.LeakyReLU(0.2)),
    tf.keras.layers.Dropout(0.4),
    tf.keras.layers.Flatten(),
    tf.keras.layers.Dense(1, activation="sigmoid")
])
gan = tf.keras.Sequential([generator, discriminator])

# compilation and training are similar to the code for GANs`;

// { code: { src: 'NAME' } } in sections.js picks one of these
export const NAMED_CODE = {
  CONV_AE,
  CONV_SUMMARY,
  DROPOUT_AE,
  VAE_PARTS,
  VAE_FIT,
  VAE_GENERATE,
  VAE_INTERP,
  GAN_BUILD,
  GAN_COMPILE,
  GAN_DATASET,
  GAN_TRAIN,
  DCGAN,
};

/* ── the listings as layer specs for gen.js flow() ───────────────────────────
   `line` = the 1-based line of the listing each layer is built on (for the
   labs' code highlighting); `comment` = the slide's own shape comment.      */
export const MODELS = {
  conv_encoder: {
    input: [28, 28],
    layers: [
      { type: 'Reshape', to: [28, 28, 1], call: 'Reshape([28, 28, 1])', line: 2 },
      { type: 'Conv2D', filters: 16, k: 3, padding: 'same', call: 'Conv2D(16, 3, padding="same", activation="relu")', line: 3 },
      { type: 'MaxPool2D', pool: 2, call: 'MaxPool2D(pool_size=2)', line: 4, comment: '14 × 14 × 16' },
      { type: 'Conv2D', filters: 32, k: 3, padding: 'same', call: 'Conv2D(32, 3, padding="same", activation="relu")', line: 5 },
      { type: 'MaxPool2D', pool: 2, call: 'MaxPool2D(pool_size=2)', line: 6, comment: '7 × 7 × 32' },
      { type: 'Conv2D', filters: 64, k: 3, padding: 'same', call: 'Conv2D(64, 3, padding="same", activation="relu")', line: 7 },
      { type: 'MaxPool2D', pool: 2, call: 'MaxPool2D(pool_size=2)', line: 8, comment: '3 × 3 × 64' },
      { type: 'Conv2D', filters: 30, k: 3, padding: 'same', call: 'Conv2D(30, 3, padding="same", activation="relu")', line: 9, comment: '3 × 3 × 30' },
      { type: 'GlobalAvgPool2D', call: 'GlobalAvgPool2D()', line: 10, comment: '30' },
    ],
  },
  conv_decoder: {
    input: [30],
    layers: [
      { type: 'Dense', units: 144, call: 'Dense(3 * 3 * 16)', line: 13, comment: '144 neurons' },
      { type: 'Reshape', to: [3, 3, 16], call: 'Reshape((3, 3, 16))', line: 14, comment: '3 × 3 × 16' },
      { type: 'Conv2DTranspose', filters: 32, k: 3, s: 2, padding: 'valid', call: 'Conv2DTranspose(32, 3, strides=2, activation="relu")', line: 15, comment: '7 × 7 × 32' },
      { type: 'Conv2DTranspose', filters: 16, k: 3, s: 2, padding: 'same', call: 'Conv2DTranspose(16, 3, strides=2, padding="same", activation="relu")', line: 16, lines: [16, 17], comment: '14 × 14 × 16' },
      { type: 'Conv2DTranspose', filters: 1, k: 3, s: 2, padding: 'same', call: 'Conv2DTranspose(1, 3, strides=2, padding="same")', line: 18, comment: '28 × 28 × 1' },
      { type: 'Reshape', to: [28, 28], call: 'Reshape([28, 28])', line: 19 },
    ],
  },
  dropout_encoder: {
    input: [28, 28],
    layers: [
      { type: 'Flatten', call: 'Flatten()', line: 2 },
      { type: 'Dropout', rate: 0.5, call: 'Dropout(0.5)', line: 3 },
      { type: 'Dense', units: 100, call: 'Dense(100, activation="relu")', line: 4 },
      { type: 'Dense', units: 30, call: 'Dense(30, activation="relu")', line: 5 },
    ],
  },
  dropout_decoder: {
    input: [30],
    layers: [
      { type: 'Dense', units: 100, call: 'Dense(100, activation="relu")', line: 8 },
      { type: 'Dense', units: 784, call: 'Dense(28 * 28)', line: 9 },
      { type: 'Reshape', to: [28, 28], call: 'Reshape([28, 28])', line: 10 },
    ],
  },
  // codings_size = 10: never set for the VAE on slides 14–18; slide 16 says
  // "the codings are only 10-dimensional"
  variational_encoder: {
    input: [28, 28],
    layers: [
      { type: 'Flatten', call: 'Flatten()', name: 'Z', line: 14 },
      { type: 'Dense', units: 150, call: 'Dense(150, activation="relu")', name: 'Z', line: 15 },
      { type: 'Dense', units: 100, call: 'Dense(100, activation="relu")', name: 'Z', line: 16 },
      { type: 'Dense', units: 10, call: 'Dense(codings_size)', name: 'codings_mean', line: 17, comment: 'mu' },
      { type: 'Dense', units: 10, same: true, call: 'Dense(codings_size)', name: 'codings_log_var', line: 18, comment: 'gamma' },
      { type: 'Sampling', call: 'Sampling()([codings_mean, codings_log_var])', name: 'codings', line: 19 },
    ],
  },
  variational_decoder: {
    input: [10],
    layers: [
      { type: 'Dense', units: 100, call: 'Dense(100, activation="relu")', name: 'x', line: 25 },
      { type: 'Dense', units: 150, call: 'Dense(150, activation="relu")', name: 'x', line: 26 },
      { type: 'Dense', units: 784, call: 'Dense(28 * 28)', name: 'x', line: 27 },
      { type: 'Reshape', to: [28, 28], call: 'Reshape([28, 28])', name: 'outputs', line: 28 },
    ],
  },
  generator: {
    input: [30],
    layers: [
      { type: 'Dense', units: 100, call: 'Dense(100, activation="relu", kernel_initializer="he_normal")', line: 4 },
      { type: 'Dense', units: 150, call: 'Dense(150, activation="relu", kernel_initializer="he_normal")', line: 5 },
      { type: 'Dense', units: 784, call: 'Dense(28 * 28, activation="sigmoid")', line: 6 },
      { type: 'Reshape', to: [28, 28], call: 'Reshape([28, 28])', line: 7 },
    ],
  },
  discriminator: {
    input: [28, 28],
    layers: [
      { type: 'Flatten', call: 'Flatten()', line: 10 },
      { type: 'Dense', units: 150, call: 'Dense(150, activation="relu", kernel_initializer="he_normal")', line: 11 },
      { type: 'Dense', units: 100, call: 'Dense(100, activation="relu", kernel_initializer="he_normal")', line: 12 },
      { type: 'Dense', units: 1, call: 'Dense(1, activation="sigmoid")', line: 13 },
    ],
  },
  dcgan_generator: {
    input: [100],
    layers: [
      { type: 'Dense', units: 6272, call: 'Dense(7 * 7 * 128)', line: 4 },
      { type: 'Reshape', to: [7, 7, 128], call: 'Reshape([7, 7, 128])', line: 5 },
      { type: 'BatchNormalization', call: 'BatchNormalization()', line: 6 },
      { type: 'Conv2DTranspose', filters: 64, k: 5, s: 2, padding: 'same', call: 'Conv2DTranspose(64, kernel_size=5, strides=2, padding="same", activation="relu")', line: 7, lines: [7, 8] },
      { type: 'BatchNormalization', call: 'BatchNormalization()', line: 9 },
      { type: 'Conv2DTranspose', filters: 1, k: 5, s: 2, padding: 'same', call: 'Conv2DTranspose(1, kernel_size=5, strides=2, padding="same", activation="tanh")', line: 10, lines: [10, 11] },
    ],
  },
  // the discriminator reads the generator's 28 × 28 × 1 output (the slide
  // gives it no input shape)
  dcgan_discriminator: {
    input: [28, 28, 1],
    layers: [
      { type: 'Conv2D', filters: 64, k: 5, s: 2, padding: 'same', call: 'Conv2D(64, kernel_size=5, strides=2, padding="same", activation=LeakyReLU(0.2))', line: 14, lines: [14, 15] },
      { type: 'Dropout', rate: 0.4, call: 'Dropout(0.4)', line: 16 },
      { type: 'Conv2D', filters: 128, k: 5, s: 2, padding: 'same', call: 'Conv2D(128, kernel_size=5, strides=2, padding="same", activation=LeakyReLU(0.2))', line: 17, lines: [17, 18] },
      { type: 'Dropout', rate: 0.4, call: 'Dropout(0.4)', line: 19 },
      { type: 'Flatten', call: 'Flatten()', line: 20 },
      { type: 'Dense', units: 1, call: 'Dense(1, activation="sigmoid")', line: 21 },
    ],
  },
};

/* ── slide 28's guidelines held against slide 29's code ──────────────────────
   status: 'yes' the code follows it · 'part' it follows it in one network or
   for some layers only. `lines` = DCGAN listing lines to light up.          */
export const GUIDELINE_CHECKS = [
  {
    g: 0,
    status: 'yes',
    lines: [7, 8, 10, 11, 14, 15, 17, 18],
    note: 'No pooling layers anywhere. The discriminator downsamples with strides=2 Conv2D layers; the generator upsamples with strides=2 Conv2DTranspose layers.',
  },
  {
    g: 1,
    status: 'part',
    lines: [6, 9, 16, 19],
    note: 'The generator has BatchNormalization after its Dense layer and after its first Conv2DTranspose, and none on its output layer, as the guideline says. The discriminator has no BatchNormalization at all: it uses Dropout(0.4) after each Conv2D instead.',
  },
  {
    g: 2,
    status: 'part',
    lines: [4, 5],
    note: 'The generator starts with a fully connected layer, Dense(7 * 7 * 128), whose output is reshaped into 7 × 7 × 128 feature maps. The discriminator’s only Dense layer is its output layer, Dense(1, activation="sigmoid"), not a hidden layer. The guideline is for deeper architectures, and these networks are small.',
  },
  {
    g: 3,
    status: 'part',
    lines: [4, 7, 8, 10, 11],
    note: 'The middle Conv2DTranspose uses "relu" and the output layer uses "tanh". The first layer, Dense(7 * 7 * 128), has no activation at all.',
  },
  {
    g: 4,
    status: 'part',
    lines: [14, 15, 17, 18, 21],
    note: 'Both Conv2D layers use LeakyReLU(0.2). The last layer, Dense(1), uses "sigmoid", to output a probability.',
  },
];
