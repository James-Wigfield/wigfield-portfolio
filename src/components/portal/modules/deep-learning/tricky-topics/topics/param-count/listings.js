/* ============================================================================
   TOPIC 1 · THE SLIDES' OWN CODE (for "from the unit" drill questions)
   ----------------------------------------------------------------------------
   Verbatim from the slide images (indentation normalised), except that a
   comment stating the answer is removed — the label says so. Generated code
   elsewhere in this topic is labelled "generated".
   ========================================================================== */

export const LISTINGS = {
  'l1-widedeep': {
    label: 'L1 slide 44 · verbatim',
    code: `normalization_layer = tf.keras.layers.Normalization()
hidden_layer1 = tf.keras.layers.Dense(30, activation="relu")
hidden_layer2 = tf.keras.layers.Dense(30, activation="relu")
concat_layer = tf.keras.layers.Concatenate()
output_layer = tf.keras.layers.Dense(1)
input_ = tf.keras.layers.Input(shape=X_train.shape[1:])
normalized = normalization_layer(input_)
hidden1 = hidden_layer1(normalized)
hidden2 = hidden_layer2(hidden1)
concat = concat_layer([normalized, hidden2])
output = output_layer(concat)
model = tf.keras.Model(inputs=[input_], outputs=[output])`,
  },
  'sample-q1c': {
    label: 'sample paper Q1(c) · verbatim',
    code: `normalization_layer = tf.keras.layers.Normalization()
hidden_layer = tf.keras.layers.Dense(20, activation="gelu")
concat_layer = tf.keras.layers.Concatenate()
output_layer = tf.keras.layers.Dense(3, activation="softmax")

input_ = tf.keras.layers.Input(shape=[10])
normalized = normalization_layer(input_)
hidden = hidden_layer(normalized)
concat = concat_layer([normalized, hidden])
output = output_layer(concat)

model = tf.keras.Model(inputs=[input_], outputs=[output])`,
  },
  'l3-cnn': {
    label: 'L3 slide 35 · verbatim',
    code: `from functools import partial
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
])`,
  },
  'l4-lstm': {
    label: 'L4 slide 43 · verbatim, its count comment removed',
    code: `lstm_model = tf.keras.Sequential([
    tf.keras.layers.InputLayer(shape=[None, 1]),
    tf.keras.layers.LSTM(12),
    tf.keras.layers.Dense(1)
])`,
  },
  'l4-gru': {
    label: 'L4 slide 49 · verbatim, its count comment removed',
    code: `gru_model = tf.keras.Sequential([
    tf.keras.layers.InputLayer(shape=[None, 1]),
    tf.keras.layers.GRU(20),
    tf.keras.layers.Dense(1)
])`,
  },
  'l8-birnn': {
    label: 'L8 slide 9 · verbatim, its count comment removed',
    code: `simple_biRNN = tf.keras.Sequential([
    tf.keras.layers.InputLayer(input_shape=[None, 2]),
    tf.keras.layers.Bidirectional(
        tf.keras.layers.SimpleRNN(16)),
    tf.keras.layers.Dense(2)
])`,
  },
  'practiceA-q1c': {
    label: 'practice paper A Q1(c) · verbatim',
    code: `model = tf.keras.Sequential([
    tf.keras.layers.InputLayer(shape=[32, 32, 3]),
    tf.keras.layers.Conv2D(16, kernel_size=3, padding="same", activation="relu"),
    tf.keras.layers.MaxPool2D(pool_size=2),
    tf.keras.layers.Conv2D(32, kernel_size=3, padding="same", activation="relu"),
    tf.keras.layers.MaxPool2D(pool_size=2),
    tf.keras.layers.GlobalAveragePooling2D(),
    tf.keras.layers.Dense(10, activation="softmax")
])`,
  },
};
