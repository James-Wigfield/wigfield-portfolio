// Code Lab cards: tab 5 · CNNs (L3). The pretrained-model pattern (L3 s48–51)
// is Project 1's NASNetMobile card (tab 1).
export const CNN = [
  {
    id: 'conv-shapes',
    title: 'Conv2D: output shapes, kernels and padding',
    rating: 'core',
    why: 'Sample Q1(a) asks what defines a conv layer: read off the filters, kernel size and padding, the output shape and the weight shapes.',
    sources: [{ kind: 'lecture', lec: 3, slides: '16–20' }],
    blocks: ['L3 s17', 'L3 s18', 'L3 s19', 'L3 s20'],
    provenance: 'trimmed',
    inv: ['l3-sample-images', 'l3-conv2d-valid', 'l3-conv-weights-shape', 'l3-conv2d-same'],
    file: 'conv_layer.py',
    code: `images.shape    # output: TensorShape([2, 70, 120, 3])
# …
conv_layer = tf.keras.layers.Conv2D(filters=32, kernel_size=7)
fmaps = conv_layer(images)
fmaps.shape    # output: TensorShape([2, 64, 114, 32])
# …
>>> kernels, biases = conv_layer.get_weights()
>>> kernels.shape
(7, 7, 3, 32)
>>> biases.shape
(32,)
conv_layer = tf.keras.layers.Conv2D(filters=32, kernel_size=7,
                                    padding="same")
fmaps = conv_layer(images)
fmaps.shape               # output: TensorShape([2, 70, 120, 32])`,
    marks: [
      { n: 1, token: { line: 3, text: 'Conv2D(filters=32, kernel_size=7)' }, say: '32 filters of 7 × 7; the defaults are stride 1 and padding "valid", which means no padding.' },
      { n: 2, token: { line: 5, text: '[2, 64, 114, 32]' }, say: 'Valid: 70 − 7 + 1 = 64, 120 − 7 + 1 = 114; one channel per filter.' },
      { n: 3, lines: [9, 9], say: '[kernel height, kernel width, input channels, filters]: (7 × 7 × 3 + 1) × 32 = 4,736 parameters.' },
      { n: 4, token: { line: 13, text: 'padding="same"' }, say: 'Zero-pads so the output keeps 70 × 120; padding adds no parameters.' },
    ],
    moves: {
      count: 'convValid',
      shapes: [
        { name: 'images', shape: '(2, 70, 120, 3)', means: '[batch, height, width, channels]: 2 RGB images' },
        { name: 'kernels', shape: '(7, 7, 3, 32)', means: 'one 7 × 7 × 3 kernel per filter' },
        { name: 'biases', shape: '(32,)', means: 'one bias per filter' },
      ],
      forWhat: 'The building block of a CNN: each filter detects one local pattern everywhere in the image, sharing its weights.',
    },
    slideCheck: 'Slide 19’s text calls fmaps [2, 64, 114, 3]; slide 18 prints [2, 64, 114, 32], which is right. Slide 20 says “"valid", which means zero-padding”: valid means no padding, and "same" pads with zeros.',
  },
  {
    id: 'fashion-cnn',
    title: 'A CNN for Fashion MNIST',
    rating: 'core',
    why: 'Draw it with every output shape, count the conv and dense layers, and explain the partial() defaults.',
    sources: [{ kind: 'lecture', lec: 3, slides: '35' }],
    blocks: ['L3 s35'],
    provenance: 'trimmed',
    inv: ['l3-fashion-cnn', 'l3-maxpool'],
    file: 'fashion_cnn.py',
    code: `DefaultConv2D = partial(tf.keras.layers.Conv2D, kernel_size=3, padding="same",
                        activation="relu", kernel_initializer="he_normal")
model = tf.keras.Sequential([
    tf.keras.layers.InputLayer(shape=[28, 28, 1]),
    DefaultConv2D(filters=64, kernel_size=7),
    tf.keras.layers.MaxPool2D(),
    DefaultConv2D(filters=128),
    DefaultConv2D(filters=128),
    tf.keras.layers.MaxPool2D(),
    DefaultConv2D(filters=256),
    DefaultConv2D(filters=256),
    tf.keras.layers.MaxPool2D(),
    tf.keras.layers.Flatten(),
# …
    tf.keras.layers.Dense(units=10, activation="softmax")
])`,
    marks: [
      { n: 1, lines: [1, 2], say: 'Every conv defaults to 3 × 3, same padding, ReLU and He initialisation unless overridden.' },
      { n: 2, token: { line: 5, text: 'kernel_size=7' }, say: 'The first layer overrides with a large 7 × 7 kernel on the 1-channel 28 × 28 input.' },
      { n: 3, token: { line: 6, text: 'MaxPool2D()' }, say: '2 × 2 pooling halves height and width, 28 → 14 → 7 → 3 (rounding down); filters then double.' },
      { n: 4, lines: [13, 14], say: '3 × 3 × 256 = 2,304 values feed a head of Dense 128, Dropout 0.5, Dense 64, Dropout 0.5.' },
    ],
    moves: {
      draw: 'fashionCnn',
      count: 'fashionCnn',
      forWhat: 'Image classification (10 Fashion-MNIST classes): convolutions find local patterns, pooling shrinks the maps, a dense head decides.',
    },
    slideCheck: 'The slide prints no summary; these counts follow the conv rule (k_h · k_w · c_in + 1) × filters. The text reports over 92% test accuracy.',
    xref: [{ to: 'p1-cnn', text: 'Project 1’s small CNN uses GAP instead of Flatten' }],
  },
];
