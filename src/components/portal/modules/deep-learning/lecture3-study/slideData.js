/* ============================================================================
   LECTURE 3 STUDY — DATA LIFTED FROM THE SLIDES
   ----------------------------------------------------------------------------
   Every number, table row and code line the labs show, copied from
   Documents/cits5017/lectures/cits5017-lect03-CNNs.pdf. Kept apart from the
   lab components so the slide facts are easy to check against the deck.
   ========================================================================== */

// ── Footnotes (numbered as on the slides) ───────────────────────────────────
export const REFS = {
  1: 'David H. Hubel, “Single Unit Activity in Striate Cortex of Unrestrained Cats,” The Journal of Physiology 147 (1959): 226–238.',
  2: 'David H. Hubel and Torsten N. Wiesel, “Receptive Fields of Single Neurons in the Cat’s Striate Cortex,” The Journal of Physiology 148 (1959): 574–591.',
  3: 'Kunihiko Fukushima, “Neocognitron: A Self-Organizing Neural Network Model for a Mechanism of Pattern Recognition Unaffected by Shift in Position,” Biological Cybernetics 36 (1980): 193–202.',
  4: 'One bias term per filter in the convolution layer.',
  5: 'A fully connected layer with 150 × 100 neurons, each connected to all 150 × 100 × 3 inputs, would have 150² × 100² × 3 = 675 million parameters!',
  6: 'ILSVRC stands for ImageNet Large Scale Visual Recognition Competition. Also referred to as ImageNet Challenge.',
  7: 'The top-five error rate is the number of test images for which the system’s top five predictions did not include the correct answer.',
  8: 'Christian Szegedy et al., “Going Deeper with Convolutions,” CVPR 2015.',
  9: 'Karen Simonyan and Andrew Zisserman, “Very Deep Convolutional Networks for Large-Scale Image Recognition,” arXiv preprint arXiv:1409.1556 (2014).',
  10: 'Kaiming He et al., “Deep Residual Learning for Image Recognition,” arXiv preprint arXiv:1512.03385 (2015).',
  11: 'François Chollet, “Xception: Deep Learning with Depthwise Separable Convolutions,” arXiv preprint arXiv:1610.02357 (2016).',
  12: 'Jie Hu et al., “Squeeze-and-Excitation Networks,” CVPR 2018, pp. 7132–7141.',
};

// ── Slide 6: the four 3×3 filters ───────────────────────────────────────────
export const SLIDE6_FILTERS = [
  { id: 'sobelx', name: 'Sobel-x', role: 'vertical edges', m: [[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]], div: 1 },
  { id: 'sobely', name: 'Sobel-y', role: 'horizontal edges', m: [[-1, -2, -1], [0, 0, 0], [1, 2, 1]], div: 1 },
  { id: 'mean', name: 'Uniform averaging', role: 'smoothing', m: [[1, 1, 1], [1, 1, 1], [1, 1, 1]], div: 9 },
  { id: 'lap', name: 'Laplacian', role: '2nd derivative', m: [[0, 1, 0], [1, -4, 1], [0, 1, 0]], div: 1 },
];

// ── Slide 3: the chapter roadmap ────────────────────────────────────────────
export const ROADMAP = [
  { topic: 'Convolutional layers', secs: ['s02', 's03'] },
  { topic: 'Filters and feature maps', secs: ['s04'] },
  { topic: 'Stacking multiple feature maps', secs: ['s05'] },
  { topic: 'Pooling layers', secs: ['s09'] },
  { topic: 'TensorFlow implementation for CNNs', secs: ['s06', 's07', 's11'] },
  { topic: 'Memory requirements of CNNs', secs: ['s08'] },
  { topic: 'CNN architectures', secs: ['s10', 's11', 's12a', 's12b', 's12c'] },
  { topic: 'Using pretrained models and transfer learning', secs: ['s13', 's14'] },
];

// ── Slides 17–19: the Conv2D example ────────────────────────────────────────
export const SLIDE17_CODE = `from sklearn.datasets import load_sample_images
import tensorflow as tf
import matplotlib.pyplot as plt

images = load_sample_images()["images"]
images = tf.keras.layers.CenterCrop(height=70, width=120)(images)
images = tf.keras.layers.Rescaling(scale=1 / 255)(images)

images.shape         # output: TensorShape([2, 70, 120, 3])`;

// ── Slide 35: the Fashion-MNIST CNN ─────────────────────────────────────────
export const FASHION_CODE = `from functools import partial
DefaultConv2D = partial(tf.keras.layers.Conv2D, kernel_size=3, padding="same",
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
    tf.keras.layers.Dense(units=128, activation="relu",
                          kernel_initializer="he_normal"),
    tf.keras.layers.Dropout(0.5),
    tf.keras.layers.Dense(units=64, activation="relu",
                          kernel_initializer="he_normal"),
    tf.keras.layers.Dropout(0.5),
    tf.keras.layers.Dense(units=10, activation="softmax")
])`;

// ── Slide 37: LeNet-5 (rows listed top → bottom, exactly as on the slide) ───
export const LENET = [
  { layer: 'Out', type: 'Fully connected', maps: '–', size: '10', kernel: '–', stride: '–', act: 'RBF' },
  { layer: 'F6', type: 'Fully connected', maps: '–', size: '84', kernel: '–', stride: '–', act: 'tanh' },
  { layer: 'C5', type: 'Convolution', maps: '120', size: '1×1', kernel: '5×5', stride: '1', act: 'tanh', n: 1, k: 5, s: 1, pad: 'valid' },
  { layer: 'S4', type: 'Avg pooling', maps: '16', size: '5×5', kernel: '2×2', stride: '2', act: 'tanh', n: 5, k: 2, s: 2, pad: 'valid' },
  { layer: 'C3', type: 'Convolution', maps: '16', size: '10×10', kernel: '5×5', stride: '1', act: 'tanh', n: 10, k: 5, s: 1, pad: 'valid' },
  { layer: 'S2', type: 'Avg pooling', maps: '6', size: '14×14', kernel: '2×2', stride: '2', act: 'tanh', n: 14, k: 2, s: 2, pad: 'valid' },
  { layer: 'C1', type: 'Convolution', maps: '6', size: '28×28', kernel: '5×5', stride: '1', act: 'tanh', n: 28, k: 5, s: 1, pad: 'valid' },
  { layer: 'In', type: 'Input', maps: '1', size: '32×32', kernel: '–', stride: '–', act: '–', n: 32 },
];

// ── Slide 39: AlexNet (as printed — the slide's table has no C7 row) ────────
export const ALEXNET = [
  { layer: 'Out', type: 'Fully connected', maps: '–', size: '1,000', kernel: '–', stride: '–', pad: '–', act: 'Softmax' },
  { layer: 'F10', type: 'Fully connected', maps: '–', size: '4,096', kernel: '–', stride: '–', pad: '–', act: 'ReLU' },
  { layer: 'F9', type: 'Fully connected', maps: '–', size: '4,096', kernel: '–', stride: '–', pad: '–', act: 'ReLU' },
  { layer: 'S8', type: 'Max pooling', maps: '256', size: '6×6', kernel: '3×3', stride: '2', pad: 'valid', act: '–', n: 6, k: 3, s: 2 },
  { layer: 'C6', type: 'Convolution', maps: '384', size: '13×13', kernel: '3×3', stride: '1', pad: 'same', act: 'ReLU', n: 13, k: 3, s: 1 },
  { layer: 'C5', type: 'Convolution', maps: '384', size: '13×13', kernel: '3×3', stride: '1', pad: 'same', act: 'ReLU', n: 13, k: 3, s: 1 },
  { layer: 'S4', type: 'Max pooling', maps: '256', size: '13×13', kernel: '3×3', stride: '2', pad: 'valid', act: '–', n: 13, k: 3, s: 2 },
  { layer: 'C3', type: 'Convolution', maps: '256', size: '27×27', kernel: '5×5', stride: '1', pad: 'same', act: 'ReLU', n: 27, k: 5, s: 1 },
  { layer: 'S2', type: 'Max pooling', maps: '96', size: '27×27', kernel: '3×3', stride: '2', pad: 'valid', act: '–', n: 27, k: 3, s: 2 },
  { layer: 'C1', type: 'Convolution', maps: '96', size: '55×55', kernel: '11×11', stride: '4', pad: 'valid', act: 'ReLU', n: 55, k: 11, s: 4 },
  { layer: 'In', type: 'Input', maps: '3 (RGB)', size: '227×227', kernel: '–', stride: '–', pad: '–', act: '–', n: 227 },
];

// ── Figure 14-15: the nine inception modules ────────────────────────────────
// top = maps out of the four top convolutions (1×1, 3×3, 5×5, 1×1 after the
// pool); bottom = maps out of the two 1×1 convolutions feeding the 3×3 and the
// 5×5. The reading is checkable on the figure itself: each module's top row
// sums to the depth of what comes next (480 and 832 at the max pools, 1024 at
// the global average pool).
export const INCEPTION = [
  { no: 1, hw: 32, cin: 192, top: [64, 128, 32, 32], bottom: [96, 12] },
  { no: 2, hw: 32, cin: 256, top: [128, 192, 96, 64], bottom: [128, 32] },
  { no: 3, hw: 16, cin: 480, top: [192, 208, 48, 64], bottom: [96, 16] },
  { no: 4, hw: 16, cin: 512, top: [160, 224, 64, 64], bottom: [112, 24] },
  { no: 5, hw: 16, cin: 512, top: [128, 256, 64, 64], bottom: [128, 24] },
  { no: 6, hw: 16, cin: 512, top: [112, 288, 64, 64], bottom: [144, 32] },
  { no: 7, hw: 16, cin: 528, top: [256, 320, 128, 128], bottom: [160, 32] },
  { no: 8, hw: 8, cin: 832, top: [256, 320, 128, 128], bottom: [160, 32] },
  { no: 9, hw: 8, cin: 832, top: [384, 384, 128, 128], bottom: [192, 48] },
];

// The rest of Figure 14-15, bottom → top, with the shape each step outputs
// (256×256 ImageNet input, "+2(S)" = stride 2 with "same" padding).
export const GOOGLENET_FLOW = [
  { label: 'Input', out: '256×256×3' },
  { label: 'Convolution 64, 7×7+2(S)', out: '128×128×64' },
  { label: 'Max pool 64, 3×3+2(S)', out: '64×64×64' },
  { label: 'Local response normalization', out: '64×64×64' },
  { label: 'Convolution 64, 1×1+1(S)', out: '64×64×64' },
  { label: 'Convolution 192, 3×3+1(S)', out: '64×64×192' },
  { label: 'Local response normalization', out: '64×64×192' },
  { label: 'Max pool 192, 3×3+2(S)', out: '32×32×192' },
  { module: 1 },
  { module: 2 },
  { label: 'Max pool 480, 3×3+2(S)', out: '16×16×480' },
  { module: 3 },
  { module: 4 },
  { module: 5 },
  { module: 6 },
  { module: 7 },
  { label: 'Max pool 832, 3×3+2(S)', out: '8×8×832' },
  { module: 8 },
  { module: 9 },
  { label: 'Global avg pool 1024', out: '1024' },
  { label: 'Dropout 40%', out: '1024' },
  { label: 'Fully connected 1000 units', out: '1000' },
  { label: 'Softmax', out: '1000' },
];

// ── Slides 36–47: the ILSVRC story ──────────────────────────────────────────
export const ARCHS = [
  { id: 'lenet', name: 'LeNet-5', year: 1998, who: 'Yann LeCun', sec: 's12a',
    result: 'Widely used for handwritten digit recognition (MNIST)',
    idea: 'Conv + average-pooling layers, tanh activations, RBF output', err: null },
  { id: 'alexnet', name: 'AlexNet', year: 2012, who: 'Alex Krizhevsky, Ilya Sutskever, Geoffrey Hinton', sec: 's12a',
    result: 'Won ILSVRC 2012: 17% top-5 error (second best 26%)',
    idea: 'Much larger and deeper than LeNet-5; first to stack conv layers directly on top of each other; dropout + data augmentation', err: 17, bound: '=' },
  { id: 'googlenet', name: 'GoogLeNet', year: 2014, who: 'Christian Szegedy et al., Google Research', sec: 's12b',
    result: 'Won ILSVRC 2014: top-5 error below 7%',
    idea: 'Much deeper, using inception modules; roughly 6 million parameters vs AlexNet’s 60 million', err: 7, bound: '<' },
  { id: 'vgg', name: 'VGGNet', year: 2014, who: 'Karen Simonyan, Andrew Zisserman (VGG, Oxford)', sec: 's12b',
    result: 'Runner-up in ILSVRC 2014',
    idea: '2–3 conv layers + a pooling layer, repeated (16 or 19 conv layers); only 3×3 filters, but many', err: null },
  { id: 'resnet', name: 'ResNet', year: 2015, who: 'Kaiming He et al.', sec: 's12c',
    result: 'Won ILSVRC 2015: top-5 error under 3.6%',
    idea: '152 layers (variants: 34, 50, 101); skip connections → residual learning', err: 3.6, bound: '<' },
  { id: 'xception', name: 'Xception', year: 2016, who: 'François Chollet (author of Keras)', sec: 's12c',
    result: 'Significantly outperformed Inception-v3 on a huge task (350 million images, 17,000 classes)',
    idea: 'A variant of GoogLeNet', err: null },
  { id: 'senet', name: 'SENet', year: 2017, who: 'Jie Hu et al.', sec: 's12c',
    result: 'Won ILSVRC 2017: 2.25% top-5 error',
    idea: 'Squeeze-and-Excitation Network: extends inception networks and ResNets and boosts their performance', err: 2.25, bound: '=' },
];

export const OTHER_ARCHS = ['ResNeXt (2016)', 'DenseNet (2016)', 'MobileNet (2017)', 'CSPNet (2019)', 'EfficientNet (2019)'];

// ── Slides 48–49: ResNet-50 on the two sample images ────────────────────────
export const RESNET_CODE = `from sklearn.datasets import load_sample_images
model = tf.keras.applications.ResNet50(weights="imagenet")
images = np.array(load_sample_images()["images"], dtype=float32)
images_resized = tf.keras.layers.Resizing(height=224, width=224,
                                   crop_to_aspect_ratio=True)(images)
# images are converted from RGB to BGR; each color channel is zero-centered
inputs = tf.keras.applications.resnet50.preprocess_input(images_resized)

>>> Y_proba = model.predict(inputs)
>>> Y_proba.shape
(2, 1000)

top_K = tf.keras.applications.resnet50.decode_predictions(Y_proba, top=3)
for image_index in range(len(images)):
   print(f"Image #{image_index}")
   for class_id, name, y_proba in top_K[image_index]:
      print(f" {class_id} - {name:12s} {y_proba:.2%}")`;

export const RESNET_PREDS = [
  { image: 'Image #0', truth: 'palace', inImageNet: true, top: [
    { id: 'n03877845', name: 'palace', p: 54.69 },
    { id: 'n03781244', name: 'monastery', p: 24.72 },
    { id: 'n02825657', name: 'bell_cote', p: 18.55 },
  ] },
  { image: 'Image #1', truth: 'dahlia', inImageNet: false, top: [
    { id: 'n04522168', name: 'vase', p: 32.66 },
    { id: 'n11939491', name: 'daisy', p: 17.81 },
    { id: 'n03530642', name: 'honeycomb', p: 12.06 },
  ] },
];

// ── Slides 50–51: transfer learning with Xception ───────────────────────────
export const FLOWERS_CODE = `import tensorflow as tf
import tensorflow_datasets as tfds

(test_set_raw, valid_set_raw, train_set_raw), info = tfds.load("tf_flowers",
            split=["train[:10%]", "train[10%:25%]", "train[25%:]"],
            as_supervised=True, with_info=True)
dataset_size = info.splits["train"].num_examples # 3670
class_names = info.features["label"].names # ["dandelion", "daisy", "tulips", "sunflowers", "roses"]
n_classes = info.features["label"].num_classes # 5

batch_size = 32
preprocess = tf.keras.Sequential([
    tf.keras.layers.Resizing(height=224, width=224, crop_to_aspect_ratio=True),
    # Xception requires the input pixel values in the range between -1 and 1
    tf.keras.layers.Lambda(tf.keras.applications.xception.preprocess_input)
])
train_set = train_set_raw.map(lambda X, y: (preprocess(X), y))
train_set = train_set.shuffle(1000, seed=42).batch(batch_size).prefetch(1)
valid_set = valid_set_raw.map(lambda X, y: (preprocess(X), y)).batch(batch_size)
test_set = test_set_raw.map(lambda X, y: (preprocess(X), y)).batch(batch_size)`;

// Slide 51. Two typesetting artefacts are tidied so the code is valid Python:
// the deck breaks `base_model =` across two lines, and typesets the second
// compile with curly quotes. The calls themselves are exactly as printed.
export const XCEPTION_CODE = `# load the Xception model
base_model = tf.keras.applications.xception.Xception(weights="imagenet", include_top=False)

avg = tf.keras.layers.GlobalAveragePooling2D()(base_model.output)
output = tf.keras.layers.Dense(n_classes, activation="softmax")(avg)
model = tf.keras.Model(inputs=base_model.input, outputs=output)

# freeze the pretrained layers, compile and train for a few epochs
for layer in base_model.layers:
    layer.trainable = False

optimizer = tf.keras.optimizers.SGD(learning_rate=0.1, momentum=0.9)
model.compile(loss="sparse_categorical_crossentropy", optimizer=optimizer, metrics=["accuracy"])
history = model.fit(train_set, validation_data=valid_set, epochs=3)

# unfreeze some layers and train for a few more epochs
for layer in base_model.layers[56:]:
    layer.trainable = True

optimizer = tf.keras.optimizers.SGD(learning_rate=0.01, momentum=0.9)
model.compile(loss='sparse_categorical_crossentropy', optimizer=optimizer, metrics=['accuracy'])
history = model.fit(train_set, validation_data=valid_set, epochs=10)`;

// ── Slide 52: learning outcomes → the sections that teach them ──────────────
export const OUTCOMES = [
  { text: 'Understand how the input layer and different convolutional layers are connected', secs: ['s03', 's05'] },
  { text: 'Understand the purpose of filters and what they generate (the feature maps)', secs: ['s02', 's04'] },
  { text: 'Know how to stack multiple feature maps', secs: ['s05'] },
  { text: 'Understand the role of pooling layers in a CNN', secs: ['s09'] },
  { text: 'Know how to implement a simple CNN using TensorFlow', secs: ['s06', 's07', 's11'] },
  { text: 'Understand the large memory requirements of CNNs', secs: ['s08'] },
  { text: 'Know some basic CNN architectures', secs: ['s11', 's12a', 's12b', 's12c'] },
  { text: 'Know how to implement transfer learning with a pretrained model', secs: ['s13', 's14'] },
];
