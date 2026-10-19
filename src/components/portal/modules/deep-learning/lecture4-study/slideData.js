/* ============================================================================
   LECTURE 4 STUDY — DATA LIFTED FROM THE SLIDES
   ----------------------------------------------------------------------------
   Every number, table row and code line the labs show, copied from
   Documents/cits5017/lectures/cits5017-lect04-Processing-sequences.pdf (and
   checked against the transcript, Documents/cits5017/markdown-lecs/
   lecture-4.md). Kept apart from the lab components so the slide facts are
   easy to check against the deck. Anything a lab computes itself lives in
   ./rnn.js or the lab, never here.

   Code listings are verbatim, with one tidy: slides 16–17 typeset the book's
   en dash in "# extra code – …" as "{" (a typewriter-font artefact); it is
   written back as "–" here.
   ========================================================================== */

// ── Footnotes (numbered as on the slides) ───────────────────────────────────
export const REFS = {
  1: 'Jimmy Lei Ba et al., “Layer Normalization”, arXiv preprint arXiv:1607.06450 (2016).',
  2: 'Sepp Hochreiter and Jürgen Schmidhuber, “Long Short-Term Memory”, Neural Computation 9, no. 8 (1997): 1735–1780.',
};

// ── Slide 3: the chapter roadmap → the sections that teach each topic ──────
export const ROADMAP = [
  { topic: 'Various application areas of RNNs', secs: ['s01'] },
  { topic: 'Recurrent neurons', secs: ['s01'] },
  { topic: 'Memory cells', secs: ['s02', 's03'] },
  { topic: 'Input and output sequences', secs: ['s04'] },
  { topic: 'Basic RNNs in TensorFlow', secs: ['s08'] },
  { topic: 'Handling variable length input and output sequences', secs: ['s01', 's04', 's08', 's11'] },
  { topic: 'Training to predict time series', secs: ['s05', 's06', 's07', 's08', 's10', 's11'] },
  { topic: 'Deep RNNs', secs: ['s09'] },
  { topic: 'Difficulty of training over many time steps', secs: ['s12', 's13a'] },
  { topic: 'LSTM architecture', secs: ['s13a', 's13b', 's14'] },
];

// ── Slide 12: the four examples (for Figure 15-4's switcher) ───────────────
export const SEQ_MODES = [
  {
    id: 'seq2seq',
    name: 'sequence-to-sequence',
    where: 'top left',
    item: 1,
    text: 'An RNN can take a sequence of inputs and produce a sequence of outputs',
    example: 'take N days of stock prices as input and produce the stock prices of N − 1 ago and of tomorrow',
  },
  {
    id: 'seq2vec',
    name: 'sequence-to-vector',
    where: 'top right',
    item: 2,
    text: 'An RNN can take a sequence of inputs and produce a single output at the last step',
    example: 'take in a sequence of words from a movie review and output a sentiment score (0 (bad) … 4 (good))',
  },
  {
    id: 'vec2seq',
    name: 'vector-to-sequence',
    where: 'bottom left',
    item: 3,
    text: 'An RNN can take a single input at t = 0 (and zeros for other time steps) and produce a sequence of outputs',
    example: 'take in an image and produce a sequence of words that could be a caption of that image',
  },
  {
    id: 'encdec',
    name: 'encoder-decoder',
    where: 'bottom right',
    item: 4,
    text: 'Lastly, you could have a sequence-to-vector network, called an encoder, followed by a vector-to-sequence network, called a decoder',
    example: 'translating a sentence from one language to another language',
  },
];

// ── Slide 15: loading the CTA ridership data ────────────────────────────────
export const LOAD_CODE = `tf.keras.utils.get_file(
  "ridership.tgz", "https://github.com/ageron/data/raw/main/ridership.tgz",
  cache_dir=".", extract=True)

import pandas as pd
from pathlib import Path

path = Path("datasets/ridership/CTA_-_Ridership_-_Daily_Boarding_Totals.csv")
df = pd.read_csv(path, parse_dates=["service_date"])
df.columns = ["date", "day_type", "bus", "rail", "total"]  # shorter names
df = df.sort_values("date").set_index("date")
df = df.drop("total", axis=1)  # no need for total, it's just bus + rail
df = df.drop_duplicates()  # remove duplicated months (2011-10 and 2014-07)

>>> df.head()`;

// slide 15's df.head() output, as printed
export const DF_HEAD = [
  { date: '2001-01-01', day_type: 'U', bus: 297192, rail: 126455 },
  { date: '2001-01-02', day_type: 'W', bus: 780827, rail: 501952 },
  { date: '2001-01-03', day_type: 'W', bus: 824923, rail: 536432 },
  { date: '2001-01-04', day_type: 'W', bus: 870021, rail: 550011 },
  { date: '2001-01-05', day_type: 'W', bus: 890426, rail: 557917 },
];

// the same rows as plain text, for the slide-15 listing
export const DF_HEAD_TEXT = `           day_type     bus    rail
date
${DF_HEAD.map((r) => `${r.date}        ${r.day_type}  ${r.bus}  ${r.rail}`).join('\n')}`;

// ── Slides 16–18: seasonality and the naive forecast ────────────────────────
export const PLOT_CODE = `import matplotlib.pyplot as plt

df["2019-03":"2019-05"].plot(grid=True, marker=".", figsize=(8, 3.5))
save_fig("daily_ridership_plot")  # extra code – saves the figure for the book
plt.show()`;

export const DIFF_CODE = `diff_7 = df[["bus", "rail"]].diff(7)["2019-03":"2019-05"]

fig, axs = plt.subplots(2, 1, sharex=True, figsize=(8, 5))
df.plot(ax=axs[0], legend=False, marker=".")  # original time series
df.shift(7).plot(ax=axs[0], grid=True, legend=False, linestyle=":")  # lagged
diff_7.plot(ax=axs[1], grid=True, marker=".")  # 7-day difference time series
axs[0].set_ylim([170_000, 900_000])  # extra code – beautifies the plot
save_fig("differencing_plot")  # extra code – saves the figure for the book
plt.show()`;

export const MAE_CODE = `>>> diff_7.abs().mean()
bus     43915.608696
rail    42143.271739
dtype: float64

>>> targets = df[["bus", "rail"]]["2019-03":"2019-05"]
>>> (diff_7 / targets).abs().mean()
bus     0.082938
rail    0.089948
dtype: float64`;

// the printed slide-18 numbers (the ridership lab must reproduce these)
export const NAIVE7 = {
  mae: { bus: 43915.608696, rail: 42143.271739 },
  mape: { bus: 0.082938, rail: 0.089948 },
};

// ── Slides 19–22: windowing with timeseries_dataset_from_array ─────────────
export const TOY_CODE = `my_series = [0, 1, 2, 3, 4, 5]
my_dataset = tf.keras.utils.timeseries_dataset_from_array(
    my_series,
    targets=my_series[3:],  # the targets are 3 steps into the future
    sequence_length=3,
    batch_size=2
)
list(my_dataset)

# the output is:
[(<tf.Tensor: shape=(2, 3), dtype=int32, numpy=
  array([[0, 1, 2],
         [1, 2, 3]], dtype=int32)>,
  <tf.Tensor: shape=(2,), dtype=int32, numpy=array([3, 4], dtype=int32)>),
 (<tf.Tensor: shape=(1, 3), dtype=int32, numpy=array([[2, 3, 4]], dtype=int32)
  <tf.Tensor: shape=(1,), dtype=int32, numpy=array([5], dtype=int32)>)]`;

// the slide-19 output, as data: (windows, targets) per batch
export const TOY_BATCHES = [
  { x: [[0, 1, 2], [1, 2, 3]], y: [3, 4] },
  { x: [[2, 3, 4]], y: [5] },
];

export const SPLIT_CODE = `rail_train = df["rail"]["2016-01":"2018-12"] / 1e6
rail_valid = df["rail"]["2019-01":"2019-05"] / 1e6
rail_test = df["rail"]["2019-06":] / 1e6

seq_length = 56
train_ds = tf.keras.utils.timeseries_dataset_from_array(
    rail_train.to_numpy(),
    targets=rail_train[seq_length:],
    sequence_length=seq_length,
    batch_size=32,
    shuffle=True,
    seed=42)

valid_ds = tf.keras.utils.timeseries_dataset_from_array(
    rail_valid.to_numpy(),
    targets=rail_valid[seq_length:],
    sequence_length=seq_length,
    batch_size=32)`;

export const INSPECT_CODE = `index = 0
for xx,yy in train_ds.take(2):
    print(f"Minibatch {index}:")
    print("xx.shape =", xx.shape)
    print("yy.shape =", yy.shape)
    index += 1

# The output is:
Minibatch 0:
xx.shape = (32, 56)
yy.shape = (32,)
Minibatch 1:
xx.shape = (32, 56)
yy.shape = (32,)`;

export const VIS_CODE = `_, axes = plt.subplots(1,5,figsize=(15,3), sharey=True)
history_timesteps = range(56)         # input: rail data for days 0 to 55
next_timestep = 56                    # predict: rail data for day 56
for xx,yy in train_ds.take(1):        # look at the first 5 sequences
    for ax,i in zip(axes, range(5)):  # in a minibatch
        ax.plot(history_timesteps, xx[i,:], "b.-")
        ax.plot(next_timestep, yy[i], "r*")
        ax.grid("on")
        ax.set_xlabel("Day")
        if i == 0:
            ax.set_ylabel("Normalised #rail riders")
plt.show()`;

export const SPLITS = {
  train: { from: '2016-01', to: '2018-12' },
  valid: { from: '2019-01', to: '2019-05' },
  seqLength: 56,
  batchSize: 32,
};

// ── Slides 23–27: linear model → simple RNN ────────────────────────────────
export const LINEAR_CODE = `tf.random.set_seed(42)
model = tf.keras.Sequential([
    tf.keras.layers.InputLayer(shape=[seq_length]),  # seq_length = 56
    tf.keras.layers.Dense(1)
])

early_stopping_cb = tf.keras.callbacks.EarlyStopping(
    monitor="val_mae", patience=50, restore_best_weights=True)
opt = tf.keras.optimizers.SGD(learning_rate=0.02, momentum=0.9)
model.compile(loss=tf.keras.losses.Huber(), optimizer=opt,
              metrics=["mae"])

history = model.fit(train_ds, validation_data=valid_ds, epochs=500,
                    callbacks=[early_stopping_cb])`;

export const RNN1_CODE = `tf.random.set_seed(42)  # extra code - ensures reproducibility
model = tf.keras.Sequential([
    tf.keras.layers.InputLayer(shape=[None, 1]),
    tf.keras.layers.SimpleRNN(1)
])`;

export const FIT_CODE = `# define a utility function for training and evaluation
def fit_and_evaluate(model, train_set, valid_set, learning_rate, epochs=500):
    early_stopping_cb = tf.keras.callbacks.EarlyStopping(
        monitor="val_mae", patience=50, restore_best_weights=True)
    opt = tf.keras.optimizers.SGD(learning_rate=learning_rate, momentum=0.9)
    model.compile(loss=tf.keras.losses.Huber(), optimizer=opt, metrics=["mae"])
    history = model.fit(train_set, validation_data=valid_set, epochs=epochs,
                        callbacks=[early_stopping_cb])
    valid_loss, valid_mae = model.evaluate(valid_set)
    return valid_mae * 1e6`;

export const RNN1_SUMMARY = `>>> model.summary()
Model: "sequential"
_________________________________________________________________
 Layer (type)                Output Shape              Param #
=================================================================
 simple_rnn (SimpleRNN)      (None, 1)                 3

=================================================================
Total params: 3
Trainable params: 3
Non-trainable params: 0`;

export const UNIVAR_CODE = `univar_model = tf.keras.Sequential([
   tf.keras.layers.InputLayer(shape=[None, 1]),
   tf.keras.layers.SimpleRNN(32),
   tf.keras.layers.Dense(1) # no activation function by default
])

>>> univar_model.summary()
Model: "sequential_1"
_________________________________________________________________
 Layer (type)                Output Shape              Param #
=================================================================
 simple_rnn_1 (SimpleRNN)    (None, 32)                1088

 dense (Dense)               (None, 1)                 33

=================================================================
Total params: 1,121
Trainable params: 1,121
Non-trainable params: 0
_________________________________________________________________`;

// ── Slides 28–29: the deep RNN ──────────────────────────────────────────────
export const DEEP_CODE = `deep_model = tf.keras.Sequential([
  tf.keras.layers.InputLayer(shape=[None, 1]),
  tf.keras.layers.SimpleRNN(32, return_sequences=True),  # 1,088 params
  tf.keras.layers.SimpleRNN(32, return_sequences=True),  # 2,080 params
  tf.keras.layers.SimpleRNN(32),                         # 2,080 params
  tf.keras.layers.Dense(1)                               #    33 params
])`;

// ── Slides 30–33: multivariate input, multiple outputs ──────────────────────
export const MULVAR_DF_CODE = `df_mulvar = df[["bus","rail"]]/1e6  # use both bus and rail series
df_mulvar["next_day_type"] = df["day_type"].shift(-1)  # and tomorrow's type
df_mulvar = pd.get_dummies(df_mulvar)  # one-hot encode the day type
mulvar_train = df_mulvar["2016-01":"2018-12"]
mulvar_valid = df_mulvar["2019-01":"2019-05"]
mulvar_test = df_mulvar["2019-06":]
mulvar_train.head()`;

// slide 30's mulvar_train.head(), as printed
export const MULVAR_COLUMNS = ['bus', 'rail', 'next_day_type_A', 'next_day_type_U', 'next_day_type_W'];
export const MULVAR_HEAD = [
  { date: '2016-01-01', row: [0.303321, 0.319835, 1, 0, 0] },
  { date: '2016-01-02', row: [0.448859, 0.365509, 0, 1, 0] },
  { date: '2016-01-03', row: [0.34054, 0.287661, 0, 0, 1] },
  { date: '2016-01-04', row: [0.829429, 0.703185, 0, 0, 1] },
  { date: '2016-01-05', row: [0.846789, 0.727716, 0, 0, 1] },
];

export const MULVAR_DS_CODE = `train_mulvar_ds = tf.keras.utils.timeseries_dataset_from_array(
    tf.convert_to_tensor(mulvar_train, dtype=tf.float32),  # use all 5 columns
    targets=mulvar_train["rail"][seq_length:],  # forecast only the rail serie
    [...]       # the other 4 arguments are the same as earlier
)
valid_mulvar_ds = tf.keras.utils.timeseries_dataset_from_array(
    tf.convert_to_tensor(mulvar_valid, dtype=tf.float32),
    targets=mulvar_valid["rail"][seq_length:],
    [...]      # the other 2 arguments are the same as earlier
)`;

export const MULVAR_MODEL_CODE = `mulvar_model = tf.keras.Sequential([
    tf.keras.layers.InputLayer(shape=[None, 5]),
    tf.keras.layers.SimpleRNN(32),
    tf.keras.layers.Dense(1)
])`;

export const MULTASK_CODE = `train_multask_ds = tf.keras.utils.timeseries_dataset_from_array(
    tf.convert_to_tensor(mulvar_train, dtype=tf.float32),
    targets=mulvar_train[["bus", "rail"]][seq_length:],  # 2 targets per day
    [...])      # the other 4 arguments are the same as earlier
valid_multask_ds = tf.keras.utils.timeseries_dataset_from_array(
    tf.convert_to_tensor(mulvar_valid, dtype=tf.float32),
    targets=mulvar_valid[["bus", "rail"]][seq_length:],
    [...])      # the other 2 arguments are the same as earlier

multask_model = tf.keras.Sequential([
    tf.keras.layers.InputLayer(shape=[None, 5]),
    tf.keras.layers.SimpleRNN(32),
    tf.keras.layers.Dense(2) ])

fit_and_evaluate(multask_model, train_multask_ds, valid_multask_ds,
                 learning_rate=0.02)`;

export const MULTASK_PRED_CODE = `Y_preds_valid = multask_model.predict(valid_multask_ds)
for idx, name in enumerate(["bus", "rail"]):
    mae = 1e6 * tf.keras.metrics.MeanAbsoluteError()(
        mulvar_valid[name][seq_length:].to_numpy(), Y_preds_valid[:, idx])
    print(name, int(mae))`;

export const MULTASK_OUT = `bus 26,812
rail 28,896`;

// ── Slides 34–39: forecasting several steps ahead ──────────────────────────
export const LOOP_CODE = `import numpy as np
# recall that rail_valid starts in 2019-01-01
X = rail_valid.to_numpy()[np.newaxis, :seq_length, np.newaxis] # one instance
for step_ahead in range(14):
    y_pred_one = univar_model.predict(X)
    X = np.concatenate([X, y_pred_one.reshape(1, 1, 1)], axis=1)`;

export const AHEAD_DS_CODE = `def split_inputs_and_targets(mulvar_series, ahead=14, target_col=1):
    return mulvar_series[:, :-ahead], mulvar_series[:, -ahead:, target_col]

ahead_train_ds = tf.keras.utils.timeseries_dataset_from_array(
    tf.convert_to_tensor(mulvar_train, dtype=tf.float32),
    targets=None,
    sequence_length=seq_length + 14,
    batch_size=32,
    shuffle=True,
    seed=42
).map(split_inputs_and_targets)

ahead_valid_ds = tf.keras.utils.timeseries_dataset_from_array(
    tf.convert_to_tensor(mulvar_valid, dtype=tf.float32),
    targets=None,
    sequence_length=seq_length + 14,
    batch_size=32
).map(split_inputs_and_targets)`;

export const AHEAD_INSPECT_CODE = `>>> print("Number of batches in ahead_train_ds =", len(ahead_train_ds))
>>> for x, y in ahead_train_ds.take(1):   # inspect a minibatch
>>>     print(x.shape)
>>>     print(y.shape)
Number of batches in ahead_train_ds = 33
(32, 56, 5)
(32, 14)`;

export const AHEAD_VIS_CODE = `_, axes = plt.subplots(1, 2, figsize=(15,4))
days_in = range(seq_length)                 # days 0 to 55
days_out = range(seq_length, seq_length+14) # days 56 to 69
for x, y in ahead_train_ds.take(1):
    for ax,id in zip(axes,range(2)):
        ax.plot(days_in, x[id,:,0], "y.-", label="bus (input)")
        ax.plot(days_in, x[id,:,1], "b.-", label="rail (input)")
        ax.plot(days_out, y[id], "r.-", label="rail (output)")
        ax.grid("on")
        ax.set_xlabel("Day")
        if id == 0:
            ax.set_ylabel("Normalised #daily riders")
        ax.legend(loc="upper left")
plt.show()`;

export const AHEAD_MODEL_CODE = `ahead_model = tf.keras.Sequential([
    tf.keras.layers.InputLayer(shape=[None, 5]),
    tf.keras.layers.SimpleRNN(32),
    tf.keras.layers.Dense(14) ])
# Training code omitted...
X = mulvar_valid.to_numpy()[np.newaxis, :seq_length]  # shape [1, 56, 5]
Y_pred = ahead_model.predict(X)  # shape [1, 14]`;

// ── Slides 40–41: long sequences ───────────────────────────────────────────
export const LN_CODE = `model = tf.keras.Sequential([
    tf.keras.layers.InputLayer(shape=[None,5]),
    tf.keras.layers.SimpleRNNCell(32),
    tf.keras.layers.LayerNormalization(),
    tf.keras.layers.Dense(1)
])`;

// ── Slides 43, 49, 50: LSTM, GRU and Conv1D models ─────────────────────────
export const LSTM_CODE = `# Number of trainable parameters: 685
lstm_model = tf.keras.Sequential([
    tf.keras.layers.InputLayer(shape=[None, 1]),
    tf.keras.layers.LSTM(12),
    tf.keras.layers.Dense(1)
])`;

export const GRU_CODE = `# Number of trainable parameters: 1401
gru_model = tf.keras.Sequential([
    tf.keras.layers.InputLayer(shape=[None, 1]),
    tf.keras.layers.GRU(20),
    tf.keras.layers.Dense(1)
])`;

export const CNN_GRU_CODE = `# Number of trainable parameters: 1283
cnn_gru_model = tf.keras.Sequential([
    tf.keras.layers.InputLayer(shape=[None, 1]),
    tf.keras.layers.Conv1D(filters=8, kernel_size=3, strides=1, activation="relu"),
    tf.keras.layers.Conv1D(filters=16, kernel_size=3, strides=2, activation="relu"),
    tf.keras.layers.GRU(10),
    tf.keras.layers.Dense(1)
])`;

// Parameter counts printed on the slides (the labs must reproduce them)
export const SLIDE_PARAMS = {
  linear: 57, // slide 23
  rnn1: 3, // slide 25
  univar: { rnn: 1088, dense: 33, total: 1121 }, // slide 27
  deep: { layers: [1088, 2080, 2080, 33], total: 5281 }, // slide 29
  lstm: 685, // slide 43
  gru: 1401, // slide 49
  cnnGru: 1283, // slide 50
};

// ── The validation-MAE scoreboard (slides 18–50) ───────────────────────────
// Rail ridership, validation period 2019-01 → 2019-05, one-step forecasts
// unless `kind` says otherwise. `mae` is the number to plot; `label` is the
// slide's own wording. Only numbers printed on the slides appear here.
export const SCOREBOARD = [
  { id: 'naive', model: '7-day shift (naive forecast)', code: 'diff_7', slide: 18, sec: 's06', mae: 42143.271739, label: '42,143', note: 'rail MAE over 2019-03 → 2019-05; bus 43,915.6 on the same slide', kind: 'baseline' },
  { id: 'linear', model: 'linear model', code: 'Dense(1) on 56 inputs', slide: 23, sec: 's08', mae: 38245, label: 'about 38,245' },
  { id: 'rnn1', model: 'one-neuron RNN', code: 'SimpleRNN(1)', slide: 24, sec: 's08', mae: 100000, gt: true, label: 'greater than 100,000' },
  { id: 'univar', model: 'univar_model', code: 'SimpleRNN(32) + Dense(1)', slide: 26, sec: 's08', mae: 27703, label: 'around 27,703' },
  { id: 'deep', model: 'deep_model', code: '3 × SimpleRNN(32) + Dense(1)', slide: 29, sec: 's09', mae: 29672, label: 'about 29,672' },
  { id: 'mulvar', model: 'mulvar_model', code: '5 input features', slide: 31, sec: 's10', mae: 22062, label: '22,062' },
  {
    id: 'multask',
    model: 'multask_model (rail output)',
    code: 'Dense(2): bus and rail',
    slide: 33,
    sec: 's10',
    mae: 28896,
    label: 'rail 28,896',
    kind: 'multi',
    note: 'the rail output of a model that also predicts bus (26,812). Its 27,855 is both outputs together — not like-for-like. A second, "2024 run" gave 24,421 together, bus 25,162, rail 23,680.',
  },
  { id: 'loop', model: 'univar_model, looped', code: '14 one-step predictions', slide: 34, sec: 's11', mae: 30734, label: '30,734', kind: 'ahead14', note: '14 days ahead, not one — not like-for-like' },
  { id: 'ahead', model: 'ahead_model', code: 'Dense(14), 5 inputs', slide: 38, sec: 's11', mae: 33887, label: '33,887', kind: 'ahead14', note: '14 days ahead in one shot — not like-for-like' },
  { id: 'lstm', model: 'lstm_model', code: 'LSTM(12) + Dense(1)', slide: 43, sec: 's13a', mae: 30262, label: '30,262' },
  { id: 'gru', model: 'gru_model', code: 'GRU(20) + Dense(1)', slide: 49, sec: 's14', mae: 26497, label: '26,497' },
  { id: 'cnnGru', model: 'cnn_gru_model', code: '2 × Conv1D + GRU(10) + Dense(1)', slide: 50, sec: 's15', mae: 30209, label: '30,209' },
];

// slide 33, both runs in full
export const MULTASK_RUNS = [
  { run: 'the slide’s run', total: 27855, bus: 26812, rail: 28896 },
  { run: '“my 2024 run”', total: 24421, bus: 25162, rail: 23680 },
];

// ── Slide 51: learning outcomes → the sections that teach them ─────────────
export const OUTCOMES = [
  { text: 'Know when it would be suitable to use RNNs', secs: ['s01', 's04'] },
  { text: 'Understand recurrent neurons and memory cells', secs: ['s01', 's02', 's03'] },
  { text: 'Understand input and output sequences in a RNN', secs: ['s04'] },
  { text: 'Know how to implement a simple RNN in TensorFlow', secs: ['s08'] },
  { text: 'Know how to handle variable length input and output sequences', secs: ['s01', 's04', 's08', 's11'] },
  { text: 'Know how to train a simple RNN to predict time series', secs: ['s05', 's06', 's07', 's08', 's10', 's11'] },
  { text: 'Know how to build a deep RNN', secs: ['s09'] },
  { text: 'Understand the difficulty of training over many time steps', secs: ['s12', 's13a'] },
  { text: 'Understand the LSTM and GRU architectures', secs: ['s13a', 's13b', 's14'] },
  { text: 'Know how to use 1D convolutional layers to process sequences', secs: ['s15'] },
];

// Listings the section text can embed by name: { code: { src: 'deep' } }
export const NAMED_CODE = {
  load: LOAD_CODE,
  dfHead: DF_HEAD_TEXT,
  plot: PLOT_CODE,
  diff: DIFF_CODE,
  mae: MAE_CODE,
  toy: TOY_CODE,
  split: SPLIT_CODE,
  inspect: INSPECT_CODE,
  vis: VIS_CODE,
  linear: LINEAR_CODE,
  rnn1: RNN1_CODE,
  fit: FIT_CODE,
  rnn1Summary: RNN1_SUMMARY,
  univar: UNIVAR_CODE,
  deep: DEEP_CODE,
  mulvarDf: MULVAR_DF_CODE,
  mulvarDs: MULVAR_DS_CODE,
  mulvarModel: MULVAR_MODEL_CODE,
  multask: MULTASK_CODE,
  multaskPred: MULTASK_PRED_CODE,
  multaskOut: MULTASK_OUT,
  loop: LOOP_CODE,
  aheadDs: AHEAD_DS_CODE,
  aheadInspect: AHEAD_INSPECT_CODE,
  aheadVis: AHEAD_VIS_CODE,
  aheadModel: AHEAD_MODEL_CODE,
  ln: LN_CODE,
  lstm: LSTM_CODE,
  gru: GRU_CODE,
  cnnGru: CNN_GRU_CODE,
};
