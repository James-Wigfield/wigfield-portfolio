/* ============================================================================
   DEEP LEARNING — CODE LAB ENTRIES
   ----------------------------------------------------------------------------
   Every code example from the CITS5017 decks (Topics 1–3), one entry per
   block, kept VERBATIM from Documents/cits5017/markdown-lecs/lecture-N.md.
   Entries with `derived: true` are faithful restatements of slide TEXT
   (no code block existed on the slide) and are badged as such in the UI.

   Adding an entry = one object here. Fields:
     id        stable slug (anchor + React key)
     lecture   1 | 2 | 3
     slide     the slide receipt string
     topic     short topic tag shown on the card
     title     what you'd search for in a test
     note      the one-line exam answer that goes with the code
     keywords  generous search vocabulary (concepts, API names, symptoms)
     label     the editor-tab filename
     code      the code, verbatim from the deck
     derived   OPTIONAL — true when restated from slide text, not a code block
   ========================================================================== */

export const LECTURES = {
  1: 'Topic 1 · Intro to ANNs',
  2: 'Topic 2 · Training DNNs',
  3: 'Topic 3 · CNNs',
};

export const ENTRIES = [
  /* ── Lecture 1 ─────────────────────────────────────────────────────────── */
  {
    id: 'perceptron-sklearn',
    lecture: 1,
    slide: 'slide 13',
    topic: 'Perceptron',
    title: 'Perceptron in Scikit-Learn',
    note: 'A single-TLU network on two iris features; predict returns hard True/False — perceptrons output no class probability (slide 15).',
    keywords: ['perceptron', 'sklearn', 'scikit-learn', 'tlu', 'iris', 'setosa', 'fit', 'predict', 'linear classifier', 'threshold logic unit', 'hard threshold'],
    label: 'perceptron_iris.py',
    code: `import numpy as np
from sklearn.datasets import load_iris
from sklearn.linear_model import Perceptron
iris = load_iris()
X = iris.data[:, (2, 3)]                      # petal length, petal width
y = (iris.target == 0).astype(np.int)   # Iris Setosa?
per_clf = Perceptron(random_state=42)
per_clf.fit(X, y)
y_pred = per_clf.predict([[2, 0.5], [3, 1]]) # predicts True and False`,
  },
  {
    id: 'perceptron-sgd-equiv',
    lecture: 1,
    slide: 'slide 14',
    topic: 'Perceptron',
    title: 'Perceptron ≡ SGDClassifier (the hyperparameters)',
    note: 'Scikit-Learn’s Perceptron class is equivalent to an SGDClassifier with exactly these four settings.',
    keywords: ['perceptron', 'sgdclassifier', 'sgd', 'equivalent', 'stochastic gradient descent', 'eta0', 'penalty', 'learning rate', 'no regularization'],
    label: 'perceptron_equivalence.py',
    derived: true,
    code: `from sklearn.linear_model import SGDClassifier
# Perceptron == SGDClassifier with:
clf = SGDClassifier(loss="perceptron",
                    learning_rate="constant",
                    eta0=1,           # learning rate
                    penalty=None)     # no regularization`,
  },
  {
    id: 'regression-mlp-sklearn',
    lecture: 1,
    slide: 'slide 26',
    topic: 'Regression MLP',
    title: 'Regression MLP — MLPRegressor + StandardScaler pipeline',
    note: 'California housing, 3 hidden layers × 50 neurons; targets are in [0, 5] so RMSE ≈ 0.505 ≈ 10% error. Loss: MSE / MAE / Huber (slide 27).',
    keywords: ['regression', 'mlp', 'mlpregressor', 'california housing', 'pipeline', 'standardscaler', 'scaling', 'rmse', 'mean squared error', 'hidden_layer_sizes', 'train_test_split', 'huber', 'mae', 'mse'],
    label: 'regression_mlp.py',
    code: `from sklearn.datasets import fetch_california_housing
from sklearn.metrics import mean_squared_error
from sklearn.model_selection import train_test_split
from sklearn.neural_network import MLPRegressor
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

housing = fetch_california_housing()
X_train_full, X_test, y_train_full, y_test = train_test_split(
    housing.data, housing.target, random_state=42)
X_train, X_valid, y_train, y_valid = train_test_split(
    X_train_full, y_train_full, random_state=42)

# 3 hidden layers with 50 neurons per layer
mlp_reg = MLPRegressor(hidden_layer_sizes=[50, 50, 50], random_state=42)
pipeline = make_pipeline(StandardScaler(), mlp_reg)
pipeline.fit(X_train, y_train)
y_pred = pipeline.predict(X_valid)
rmse = mean_squared_error(y_valid, y_pred, squared=False)  # around 0.505`,
  },
  {
    id: 'tf-keras-versions',
    lecture: 1,
    slide: 'slide 33',
    topic: 'Keras setup',
    title: 'Check TensorFlow / Keras versions',
    note: 'The unit’s expected versions: TensorFlow 2.17.0 and Keras 3.10.0. Since Keras 2.4, Keras is TensorFlow-only.',
    keywords: ['tensorflow', 'keras', 'version', 'install', 'setup', 'import', '__version__', '2.17', '3.10'],
    label: 'check_versions.py',
    code: `import tensorflow as tf
from tensorflow import keras
tf.__version__
# output: '2.17.0'
keras.__version__
# output: '3.10.0'`,
  },

  /* ── Lecture 2 ─────────────────────────────────────────────────────────── */
  {
    id: 'he-init',
    lecture: 2,
    slide: 'slide 9',
    topic: 'Initialization',
    title: 'He initialization — kernel_initializer',
    note: 'Keras defaults to Glorot-uniform; switch per layer with kernel_initializer. Match to activation: ReLU family → He, sigmoid/tanh/softmax → Glorot, SELU → LeCun.',
    keywords: ['he initialization', 'he_normal', 'kernel_initializer', 'weight initialization', 'glorot', 'xavier', 'lecun', 'vanishing gradients', 'init', 'fan_in', 'relu init', 'dense'],
    label: 'he_init.py',
    code: `import tensorflow as tf
tf.keras.layers.Dense(10, activation="relu", kernel_initializer="he_normal")`,
  },
  {
    id: 'variance-scaling-init',
    lecture: 2,
    slide: 'slide 9',
    topic: 'Initialization',
    title: 'VarianceScaling initializer (fan_avg)',
    note: 'He-style scaling (scale=2) computed over fan_avg with a uniform distribution — the custom-initializer escape hatch.',
    keywords: ['variancescaling', 'variance scaling', 'fan_avg', 'fan average', 'custom initializer', 'initializers', 'uniform distribution', 'weight initialization', 'he over fan_avg'],
    label: 'variance_scaling.py',
    code: `he_avg_init = tf.keras.initializers.VarianceScaling(scale=2., mode="fan_avg",
                                                    distribution="uniform")
dense = tf.keras.layers.Dense(50, activation="sigmoid",
                              kernel_initializer=he_avg_init)`,
  },
  {
    id: 'leaky-relu-ways',
    lecture: 2,
    slide: 'slide 12',
    topic: 'Activations',
    title: 'Leaky ReLU — three ways to attach it',
    note: 'alpha was renamed negative_slope in tf-2.16 (defaults 0.3); a leak of 0.2 tends to beat 0.01. Fixes dying ReLUs.',
    keywords: ['leaky relu', 'leakyrelu', 'negative_slope', 'alpha', 'dying relus', 'dead neurons', 'activation', 'nonsaturating', 'tf 2.16', 'activations subpackage'],
    label: 'leaky_relu.py',
    code: `# for tf-2.15 or older
leaky_relu = tf.keras.layers.LeakyReLU(alpha=0.2)  # default alpha=0.3
# for tf-2.16 onward
leaky_relu = tf.keras.layers.LeakyReLU(negative_slope=0.2)  # default negative_slope=0.3
dense = tf.keras.layers.Dense(50, activation=leaky_relu,
                              kernel_initializer="he_normal")

# can also use the leaky_relu function defined under the tf.keras.activations subpackage
dense = tf.keras.layers.Dense(50, activation=tf.keras.activations.leaky_relu, ...)
dense = tf.keras.layers.Dense(50, activation="leaky_relu", ...)`,
  },
  {
    id: 'leaky-relu-layer',
    lecture: 2,
    slide: 'slide 12',
    topic: 'Activations',
    title: 'LeakyReLU as a separate layer',
    note: 'Dense carries NO activation; the LeakyReLU layer that follows is the activation — the same pattern BN-before-activation uses.',
    keywords: ['leaky relu layer', 'leakyrelu', 'separate layer', 'activation layer', 'sequential', 'no activation', 'negative_slope'],
    label: 'leaky_relu_layer.py',
    code: `model = tf.keras.models.Sequential([
    # [...]  # more layers
    tf.keras.layers.Dense(50, kernel_initializer="he_normal"),  # no activation
    tf.keras.layers.LeakyReLU(negative_slope=0.2),  # activation in a separate layer
    # [...]  # more layers
])`,
  },
  {
    id: 'bn-after-activation',
    lecture: 2,
    slide: 'slide 26',
    topic: 'Batch Norm',
    title: 'Batch Normalization — after the activation',
    note: 'BN right after Flatten (standardizes the inputs) and after each hidden layer. γ, β trainable; moving mean/variance estimated for test time.',
    keywords: ['batch normalization', 'batchnormalization', 'batch norm', 'bn', 'after activation', 'flatten', 'fashion mnist', 'sequential', 'gamma beta', 'normalize', 'internal covariate shift'],
    label: 'bn_after_activation.py',
    code: `model = keras.models.Sequential([
    tf.keras.layers.InputLayer(shape=[28, 28]),
    tf.keras.layers.Flatten(),
    tf.keras.layers.BatchNormalization(),
    tf.keras.layers.Dense(300, activation="relu",
                          kernel_initializer="he_normal"),
    tf.keras.layers.BatchNormalization(),
    tf.keras.layers.Dense(100, activation="relu",
                          kernel_initializer="he_normal"),
    tf.keras.layers.BatchNormalization(),
    tf.keras.layers.Dense(10, activation="softmax")
])`,
  },
  {
    id: 'bn-summary-params',
    lecture: 2,
    slide: 'slide 27',
    topic: 'Batch Norm',
    title: 'model.summary() — where BN’s parameters come from',
    note: 'Each BN layer holds 4 params per feature: γ + β (trainable) and moving mean + variance (non-trainable). Non-trainable total = (784+300+100)×2 = 2,368.',
    keywords: ['model.summary', 'summary', 'parameter count', 'param', 'non-trainable', 'trainable params', 'batch norm parameters', '3136', '2368', '271346', 'counting parameters'],
    label: 'console',
    code: `>>> model.summary()
Model: "sequential"
 Layer (type)                     Output Shape    Param #
 flatten (Flatten)                (None, 784)     0
 batch_normalization (BatchNorm.) (None, 784)     3,136
 dense (Dense)                    (None, 300)     235,500
 batch_normalization_1            (None, 300)     1,200
 dense_1 (Dense)                  (None, 100)     30,100
 batch_normalization_2            (None, 100)     400
 dense_2 (Dense)                  (None, 10)      1,010
Total params: 271,346 (1.04 MB)
Trainable params: 268,978 (1.03 MB)
Non-trainable params: 2,368 (9.25 KB)`,
  },
  {
    id: 'bn-before-activation',
    lecture: 2,
    slide: 'slide 28',
    topic: 'Batch Norm',
    title: 'Batch Normalization — before the activation',
    note: 'The BN authors’ preference: Activation becomes its own layer and Dense gets use_bias=False — BN’s β already does the bias’s job.',
    keywords: ['batch norm before activation', 'use_bias=false', 'use_bias', 'activation layer', 'bn before', 'ioffe szegedy', 'batchnormalization', 'no bias'],
    label: 'bn_before_activation.py',
    code: `model = tf.keras.Sequential([
    tf.keras.layers.InputLayer(shape=[28, 28]),
    tf.keras.layers.Flatten(),
    tf.keras.layers.Dense(300, kernel_initializer="he_normal",
                          use_bias=False),
    tf.keras.layers.BatchNormalization(),
    tf.keras.layers.Activation("relu"),
    tf.keras.layers.Dense(100, kernel_initializer="he_normal",
                          use_bias=False),
    tf.keras.layers.BatchNormalization(),
    tf.keras.layers.Activation("relu"),
    tf.keras.layers.Dense(10, activation="softmax")
])`,
  },
  {
    id: 'gradient-clipping',
    lecture: 2,
    slide: 'slide 29',
    topic: 'Clipping',
    title: 'Gradient clipping — clipvalue / clipnorm',
    note: 'clipvalue=1.0 clamps every component to [−1, 1] (can change the gradient’s direction); clipnorm=1.0 rescales the whole vector, keeping its orientation. Mostly an RNN fix — BN is tricky there.',
    keywords: ['gradient clipping', 'clipvalue', 'clipnorm', 'exploding gradients', 'optimizer', 'sgd', 'rnn', 'compile', 'threshold', 'clip'],
    label: 'gradient_clipping.py',
    code: `optimizer = tf.keras.optimizers.SGD(clipvalue=1.0)
model.compile(loss="mse", optimizer=optimizer)
# alternative: clipnorm=1.0 retains the gradient vector's orientation`,
  },
  {
    id: 'transfer-learning',
    lecture: 2,
    slide: 'slide 31',
    topic: 'Transfer',
    title: 'Transfer learning — reuse, freeze, fit, unfreeze, recompile',
    note: 'Drop model_A’s output layer, add a new head, freeze the reused layers for 4 epochs, then unfreeze and RECOMPILE before the 16-epoch fine-tune. Recompiling after (un)freezing is mandatory.',
    keywords: ['transfer learning', 'freeze', 'unfreeze', 'trainable = false', 'trainable', 'load_model', 'layers[:-1]', 'pretrained', 'fine-tune', 'fine tuning', 'recompile', 'fashion mnist', 'model_a', 'model_b', 'reuse layers', 'binary_crossentropy', 'sigmoid head'],
    label: 'transfer_learning.py',
    code: `# assuming the trained model_A is saved to "my_model_A.keras"
model_A = tf.keras.models.load_model("my_model_A.keras")
model_B_on_A = tf.keras.Sequential(model_A.layers[:-1])
model_B_on_A.add(tf.keras.layers.Dense(1, activation="sigmoid"))

# freeze the reused layers for the first epochs
for layer in model_B_on_A.layers[:-1]:
    layer.trainable = False
optimizer = tf.keras.optimizers.SGD(learning_rate=0.001)
model_B_on_A.compile(loss="binary_crossentropy", optimizer=optimizer, metrics=["accuracy"])
# for example, train the model for 4 epochs
history = model_B_on_A.fit(X_train_B, y_train_B, epochs=4, validation_data=(X_valid_B, y_valid_B))

# unfreeze the layers and train for 16 epochs. Note that the model needs to be recompiled
for layer in model_B_on_A.layers[:-1]:
    layer.trainable = True
optimizer = tf.keras.optimizers.SGD(learning_rate=0.001)
model_B_on_A.compile(loss="binary_crossentropy", optimizer=optimizer, metrics=["accuracy"])
history = model_B_on_A.fit(X_train_B, y_train_B, epochs=16, validation_data=(X_valid_B, y_valid_B))`,
  },
  {
    id: 'transfer-evaluate',
    lecture: 2,
    slide: 'slide 32',
    topic: 'Transfer',
    title: 'Transfer learning — evaluate the gain',
    note: '91.85% → 93.85% test accuracy = (8.15−6.15)/8.15 ≈ 25% relative error-rate reduction. Works well with deep CNNs, NOT small dense nets.',
    keywords: ['evaluate', 'test accuracy', 'transfer learning results', 'error rate', '93.85', '91.85', '25%', 'evaluate the model'],
    label: 'console',
    code: `>>> model_B_on_A.evaluate(X_test_B, y_test_B)
[0.2546142041683197, 0.9384999871253967]
# model_B alone:  test accuracy = 91.85%  (error rate 8.15%)
# model_B_on_A:   test accuracy = 93.85%  (error rate 6.15%)
# relative error-rate reduction = (8.15 - 6.15)/8.15 ≈ 25%`,
  },

  {
    id: 'momentum',
    lecture: 2,
    slide: 'slide 35',
    topic: 'Optimizers',
    title: 'Momentum optimizer — SGD with momentum=0.9',
    note: 'The gradient acts as an acceleration feeding m ← βm − η∇J, θ ← θ+m. β = 0.9 usually works, almost always beats plain GD, and can roll past local optima.',
    keywords: ['momentum', 'sgd', 'optimizer', 'beta', 'faster optimizers', 'momentum vector', 'acceleration', 'gradient descent'],
    label: 'momentum.py',
    code: `# standard SGD optimizer
optimizer = tf.keras.optimizers.SGD(learning_rate=0.001)

# Momentum optimizer
optimizer = tf.keras.optimizers.SGD(learning_rate=0.001, momentum=0.9)`,
  },
  {
    id: 'nesterov',
    lecture: 2,
    slide: 'slide 37',
    topic: 'Optimizers',
    title: 'Nesterov accelerated gradient — nesterov=True',
    note: 'NAG measures the gradient a look-ahead step at θ + βm (not at θ), landing slightly closer to the optimum than regular momentum (Figure 11-7).',
    keywords: ['nesterov', 'nag', 'nesterov momentum', 'look-ahead', 'accelerated gradient', 'optimizer', 'nesterov=true'],
    label: 'nesterov.py',
    code: `optimizer = tf.keras.optimizers.SGD(learning_rate=0.001,
                                    momentum=0.9, nesterov=True)`,
  },
  {
    id: 'adagrad',
    lecture: 2,
    slide: 'slide 40',
    topic: 'Optimizers',
    title: 'AdaGrad — and why not to use it for deep nets',
    note: 'Adaptive learning rate: divides by accumulated squared gradients, decaying η fastest along steep dimensions — but it stops too early on DNNs. Fine for simpler tasks like linear regression.',
    keywords: ['adagrad', 'adaptive learning rate', 'stops too early', 'accumulated gradients', 'optimizer', 'elongated bowl', 'duchi'],
    label: 'adagrad.py',
    code: `optimizer = tf.keras.optimizers.Adagrad(learning_rate=0.001)
# Do NOT use AdaGrad to train deep neural networks — the learning rate
# gets scaled down so much that training stops before the optimum.`,
  },
  {
    id: 'rmsprop',
    lecture: 2,
    slide: 'slide 42',
    topic: 'Optimizers',
    title: 'RMSProp — recent gradients only, rho=0.9',
    note: 's ← ρs + (1−ρ)∇J⊗∇J fixes AdaGrad’s premature decay; ρ = 0.9 rarely needs tuning. The favourite before Adam arrived.',
    keywords: ['rmsprop', 'rho', 'decay rate', 'adaptive', 'optimizer', 'tieleman', 'hinton', 'recent gradients'],
    label: 'rmsprop.py',
    code: `optimizer = tf.keras.optimizers.RMSprop(learning_rate=0.001, rho=0.9)`,
  },
  {
    id: 'adam',
    lecture: 2,
    slide: 'slide 44',
    topic: 'Optimizers',
    title: 'Adam — adaptive moment estimation',
    note: 'Momentum + RMSProp with bias correction: β₁ = 0.9 (momentum’s β), β₂ = 0.999 (RMSProp’s ρ). Adaptive, so η = 0.001 often just works.',
    keywords: ['adam', 'adaptive moment estimation', 'beta_1', 'beta_2', 'kingma', 'optimizer', 'bias correction', 'default learning rate'],
    label: 'adam.py',
    code: `optimizer = tf.keras.optimizers.Adam(learning_rate=0.001,
                                     beta_1=0.9, beta_2=0.999)`,
  },
  {
    id: 'adam-variants',
    lecture: 2,
    slide: 'slide 46',
    topic: 'Optimizers',
    title: 'AdaMax · Nadam · AdamW',
    note: 'AdaMax swaps Adam’s step 2 for a max; Nadam adds the Nesterov trick (usually beats Adam); AdamW integrates weight decay — tune weight_decay too.',
    keywords: ['adamax', 'nadam', 'adamw', 'weight decay', 'weight_decay', 'adam variants', 'optimizer', 'dozat', 'nesterov adam'],
    label: 'adam_variants.py',
    code: `# AdaMax
optimizer = tf.keras.optimizers.Adamax(learning_rate=0.001,
                                       beta_1=0.9, beta_2=0.999)
# Nadam
optimizer = tf.keras.optimizers.Nadam(learning_rate=0.001,
                                      beta_1=0.9, beta_2=0.999)
# AdamW  (you may need to also fine tune weight_decay)
optimizer = tf.optimizers.AdamW(weight_decay=1e-5, learning_rate=0.001,
                                beta_1=0.9, beta_2=0.999)`,
  },
  {
    id: 'power-scheduling',
    lecture: 2,
    slide: 'slide 51',
    topic: 'LR schedules',
    title: 'Power scheduling — InverseTimeDecay',
    note: 'η(t) = η₀/(1 + rt/s)^c with c typically 1: after s steps η₀/(1+r), after 2s steps η₀/(1+2r). staircase=True makes it drop in steps.',
    keywords: ['power scheduling', 'inversetimedecay', 'inverse time decay', 'learning rate schedule', 'decay_steps', 'decay_rate', 'staircase', 'lr schedule'],
    label: 'power_scheduling.py',
    code: `# initial_learning_rate / (1 + decay_rate * step / decay_step)

lr_schedule = tf.keras.optimizers.schedules.InverseTimeDecay(
    initial_learning_rate=0.01,
    decay_steps=10_000,
    decay_rate=1.0,
    staircase=False
)
optimizer = tf.keras.optimizers.SGD(learning_rate=lr_schedule)`,
  },
  {
    id: 'exponential-scheduling',
    lecture: 2,
    slide: 'slide 53',
    topic: 'LR schedules',
    title: 'Exponential scheduling — ExponentialDecay',
    note: 'η(t) = η₀·r^(t/s): drops by factor r every s steps (r = 0.1, s = 15 → η₀/10 after 15 steps, η₀/100 after 30).',
    keywords: ['exponential scheduling', 'exponentialdecay', 'exponential decay', 'learning rate schedule', 'decay_rate', 'decay_steps', 'staircase'],
    label: 'exponential_scheduling.py',
    code: `# initial_learning_rate * decay_rate ** (step / decay_steps)
lr_schedule = tf.keras.optimizers.schedules.ExponentialDecay(
    initial_learning_rate=0.01,
    decay_steps=20_000,
    decay_rate=0.1,
    staircase=False
)
optimizer = tf.keras.optimizers.SGD(learning_rate=lr_schedule)`,
  },
  {
    id: 'custom-scheduler',
    lecture: 2,
    slide: 'slide 54',
    topic: 'LR schedules',
    title: 'Custom schedule — LearningRateScheduler callback',
    note: 'Any function of the epoch works. Callbacks fire at the end of each EPOCH, not per gradient step; an optimizer is still needed. Alternative: subclass schedules.LearningRateSchedule.',
    keywords: ['custom scheduler', 'learningratescheduler', 'callback', 'exponential_decay', 'closure', 'own scheduler', 'epoch', 'learning rate schedule'],
    label: 'custom_scheduler.py',
    code: `def exponential_decay(lr0, s):
    def exp_decay_fn(epoch):
        return lr0 * 0.1**(epoch / s)
    return exp_decay_fn

my_exp_decay_fn = exponential_decay(lr0=0.01, s=20)
lr_scheduler = tf.keras.callbacks.LearningRateScheduler(my_exp_decay_fn)
history = model.fit(X_train, y_train, ..., callbacks=[lr_scheduler])`,
  },
  {
    id: 'piecewise-scheduling',
    lecture: 2,
    slide: 'slide 56',
    topic: 'LR schedules',
    title: 'Piecewise constant scheduling — PiecewiseConstantDecay',
    note: 'A constant η per interval: values[i] holds until boundaries[i]. Works well but needs fiddling to pick the sequence.',
    keywords: ['piecewise constant', 'piecewiseconstantdecay', 'boundaries', 'values', 'step schedule', 'learning rate schedule'],
    label: 'piecewise_constant.py',
    code: `# An example:
lr_schedule = tf.keras.optimizers.schedules.PiecewiseConstantDecay(
    boundaries=[50_000, 80_000],
    values=[0.01, 0.005, 0.001]
)
optimizer = tf.keras.optimizers.SGD(learning_rate=lr_schedule)`,
  },
  {
    id: 'reduce-lr-on-plateau',
    lecture: 2,
    slide: 'slide 57',
    topic: 'LR schedules',
    title: 'Performance scheduling — ReduceLROnPlateau',
    note: 'Halves η whenever the best validation loss hasn’t improved for 5 consecutive epochs. Inspect afterwards via history.history["learning_rate"] and ["val_loss"].',
    keywords: ['performance scheduling', 'reducelronplateau', 'reduce lr on plateau', 'factor', 'patience', 'plateau', 'validation loss', 'callback', 'learning rate schedule'],
    label: 'reduce_lr_on_plateau.py',
    code: `lr_scheduler = tf.keras.callbacks.ReduceLROnPlateau(factor=0.5,
                                                    patience=5)
history = model.fit(X_train, y_train, [...], callbacks=[lr_scheduler])`,
  },
  {
    id: 'l2-regularization',
    lecture: 2,
    slide: 'slide 60',
    topic: 'Regularization',
    title: 'ℓ2 regularization — kernel_regularizer',
    note: 'The regularization loss is added to the final loss each step. l1(…) for ℓ1, l1_l2(…) for both together.',
    keywords: ['l2', 'l1', 'regularization', 'kernel_regularizer', 'regularizers', 'weight penalty', 'l1_l2', 'overfitting'],
    label: 'l2_layer.py',
    code: `layer = tf.keras.layers.Dense(100, activation="elu",
                              kernel_initializer="he_normal",
                              kernel_regularizer=tf.keras.regularizers.l2(0.01))`,
  },
  {
    id: 'regularized-dense-partial',
    lecture: 2,
    slide: 'slide 61',
    topic: 'Regularization',
    title: 'Same regularizer everywhere — functools.partial',
    note: 'Bakes activation + init + regularizer into a reusable Dense factory; the output layer overrides activation to softmax.',
    keywords: ['functools', 'partial', 'regularizeddense', 'dry', 'same regularization every layer', 'l2', 'factory', 'overfitting'],
    label: 'regularized_dense.py',
    code: `from functools import partial

RegularizedDense = partial(tf.keras.layers.Dense,
                           activation="relu",
                           kernel_initializer="he_normal",
                           kernel_regularizer=tf.keras.regularizers.l2(0.01))

model = tf.keras.Sequential([
    tf.keras.layers.InputLayer(shape=[28, 28]),
    tf.keras.layers.Flatten(),                  # layer 0
    RegularizedDense(100),                      # layer 1
    RegularizedDense(100),                      # layer 2
    RegularizedDense(10, activation="softmax")  # layer 3
])`,
  },
  {
    id: 'dropout-model',
    lecture: 2,
    slide: 'slide 64',
    topic: 'Regularization',
    title: 'Dropout — a Dropout layer before every Dense layer',
    note: 'rate=0.2; dropout hits inputs + hidden (never outputs) and only during training — so evaluate the training loss WITHOUT dropout or overfitting can hide behind similar train/val losses.',
    keywords: ['dropout', 'rate', 'dropout layer', 'regularization', 'overfitting', 'dropped neurons', 'hinton', 'p=0.2', 'training only'],
    label: 'dropout_model.py',
    code: `model = tf.keras.models.Sequential([
    tf.keras.layers.InputLayer(shape=[28, 28]),
    tf.keras.layers.Flatten(),
    tf.keras.layers.Dropout(rate=0.2),
    tf.keras.layers.Dense(100, activation="relu", kernel_initializer="he_normal"),
    tf.keras.layers.Dropout(rate=0.2),
    tf.keras.layers.Dense(100, activation="relu", kernel_initializer="he_normal"),
    tf.keras.layers.Dropout(rate=0.2),
    tf.keras.layers.Dense(10, activation="softmax")
])`,
  },

  /* ── Lecture 3 ─────────────────────────────────────────────────────────── */
  {
    id: 'conv-layer-tensors',
    lecture: 3,
    slide: 'slide 16',
    topic: 'CNN shapes',
    title: 'Convolutional layer in Keras — the four tensor shapes',
    note: 'Weights are [f_h, f_w, f_c, f_n] with f_c = the input’s channels; one bias per filter. Params = f_h·f_w·f_c·f_n + f_n — independent of the image size.',
    keywords: ['conv', 'cnn', 'convolutional layer', 'tensor shapes', '4d tensor', 'filters', 'kernels', 'bias', 'channels', 'f_h f_w f_c f_n', 'mini-batch', 'batch shape', 'weights shape', 'parameter count', 'image shape'],
    label: 'conv_layer_shapes.py',
    derived: true,
    code: `# one image — a 3D tensor
image.shape      # [height, width, channels]

# a mini-batch — a 4D tensor
batch.shape      # [batch size, height, width, channels]

# all the filters of a conv layer (its weights) — a 4D tensor
kernels.shape    # [f_h, f_w, f_c, f_n]   f_c must equal the input's channels

# the bias terms — a 1D tensor, one bias per filter
biases.shape     # [f_n]

# trainable parameters = f_h * f_w * f_c * f_n  +  f_n`,
  },
];
