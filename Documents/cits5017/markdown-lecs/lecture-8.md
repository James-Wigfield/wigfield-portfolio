# CITS5017 Deep Learning

Topic 8: Attention Mechanisms, Transformers, and Vision Transformers — Associate Professor Du Huynh (Unit Coordinator and Lecturer) — Semester 2, 2026

*Transcription conventions (slides 1–51): key terms that are dark red on the slides are written in **bold** (dark-red italic → ***bold italic***); black italic stays *italic*; black bold text is flagged in a note where it occurs. The footnote on slide 4 is in a brighter red than the key terms; this is noted there. Maths that is typeset in blue on the slides is written as plain LaTeX; bold upright maths letters (**h**, **y**, **W**, **v**, **e**) are written with `\mathbf`. Bold blue sub-headings directly under a slide title are written as `###` headings. Inline code that is dark-red typewriter on the slides is written as `code`. The transpose glyph is ⊤ (written `^\top`). Footnote markers in the text are written as <sup>N</sup>. Curly quotation marks and apostrophes are written as straight ones (in prose and in code, where the slides' typewriter font draws `'` as a curly ’). Code is transcribed with the exact column positions of the slides' monospaced text (measured from 600-dpi renders). Handwritten annotations over the diagrams on slides 12–13 are transcribed separately from the figure. Slide-number footers ("N / 51") are not recorded.*

---

## Slide 1 — CITS5017 Deep Learning / Topic 8: Attention Mechanisms, Transformers, and Vision Transformers

Associate Professor Du Huynh
(Unit Coordinator and Lecturer)

Semester 2, 2026

> **Figure (slide 1).** Title banner: white text on a dark-blue rectangle, three centred lines: "CITS5017 Deep Learning", "Topic 8: Attention Mechanisms, Transformers,", "and Vision Transformers". Below the lecturer/date lines is the UWA crest: a shield whose upper band is blue with a gold top edge and holds two open books, each showing two pages of text — the left book reads "VIT AM" / "EXC OLU", the right book reads "ERE PER" / "AR TES" (i.e. *Vitam excolere per artes*). Below the books, a gold field rises to a point in the centre of the blue shield; on it sits a black swan with a white wing. Beneath the shield is a blue ribbon with white text "SEEK WISDOM". Below the crest is the blue wordmark "THE UNIVERSITY OF / WESTERN / AUSTRALIA". (No slide number is shown on this slide.)

---

## Slide 2 — Today

Chapters 16.

### Hands-on Machine Learning with Scikit-Learn, Keras & TensorFlow

> **Figure (slide 2).** Small book-cover image, O'REILLY. Top-left: red "O'REILLY" logo. Top-right corner: a diagonal grey banner reading "Third Edition". Title in black: "Hands-On Machine Learning with Scikit-Learn, Keras & TensorFlow". Subtitle in orange: "Concepts, Tools, and Techniques to Build Intelligent Systems". Below it, small "powered by" text with a Jupyter logo. Cover illustration: a black salamander with bright yellow-orange spots and stripes, crawling diagonally across the lower half. Author name at bottom right: "Aurélien Géron".

(The book title is large black text, not blue.)

---

## Slide 3 — Chapter Sixteen

### Natural Language Processing with RNNs and Attention

Here are the main topics we will cover:

- Encoder-decoder networks for neural machine translation
- Bidirectional RNNs and LSTMs
- Attention mechanisms, including additive attention and multiplicative attention
- Implementing attention mechanisms using Keras
- Visual attention
- The original transformer
- The original vision transformer

(The sub-heading is large black text, not blue. It wraps after "and". There is no gap between the sub-heading and "Here are the main topics we will cover:".)

---

## Slide 4 — Encoder-Decoder Networks for Processing Sequences

In an earlier topic, we learnt that we could use an encoder-decoder network<sup>1</sup> for processing sequences:

> **Figure 15-4.** Four small RNN diagrams in a 2 × 2 grid. Every recurrent cell is a small rounded box; inputs enter from below on black upward arrows, outputs leave upward on black arrows, and each cell passes its state to the next cell with a black right-pointing arrow.
> - *Top left (sequence-to-sequence):* five pale-yellow cells in a row. Inputs below, left to right: $x_{(0)}$, $X_{(1)}$, $X_{(2)}$, $X_{(3)}$, $X_{(4)}$ (the first label is drawn with a small, lowercase-looking x; the others are capital X). Outputs above: $Y_{(0)}$ (**no hat**), $\hat{Y}_{(1)}$, $\hat{Y}_{(2)}$, $\hat{Y}_{(3)}$, $\hat{Y}_{(4)}$.
> - *Top right (sequence-to-vector):* four pale-yellow cells; inputs $X_{(0)}$–$X_{(3)}$. The first three outputs $\hat{Y}_{(0)}$, $\hat{Y}_{(1)}$, $\hat{Y}_{(2)}$ and their arrows are light grey and enclosed in a grey dashed box labelled "Ignored outputs" (grey label); only the last output $\hat{Y}_{(3)}$ is black.
> - *Bottom left (vector-to-sequence):* four pale-yellow cells; every input is the same label "X"; outputs $\hat{Y}_{(0)}$–$\hat{Y}_{(3)}$.
> - *Bottom right (encoder-decoder):* a black dashed box labelled "Encoder" (label in grey) holds two pale-yellow cells with inputs $X_{(0)}$, $X_{(1)}$ and greyed-out outputs $\hat{Y}_{(0)}$, $\hat{Y}_{(1)}$ (grey labels, grey arrows). An arrow from the second encoder cell crosses into a second black dashed box labelled "Decoder" (black label) holding three orange cells, with black outputs $\hat{Y}'_{(0)}$, $\hat{Y}'_{(1)}$, $\hat{Y}'_{(2)}$ and grey inputs "0", "0", "0" on grey arrows.

*Caption:* Figure 15-4. Sequence-to-sequence (top left), sequence-to-vector (top right), vector-to-sequence (bottom left), and encoder-decoder (bottom right) networks

**Footnotes:**

1. Do not confuse this with the *encoder* and *decoder* in an autoencoder network.

(Footnote 1 is entirely in bright red, a different red from the dark-red key terms; "encoder" and "decoder" in it are italic. The caption wraps after "(bottom left),".)

---

## Slide 5 — Encoder-Decoder Networks for NMT

#### Left — figure

> **Figure 16-3.** An encoder-decoder RNN translating English to Spanish, drawn bottom-to-top.
> - *Encoder (left):* at the bottom, the italic quoted sentence "I like soccer" has three black arrows fanning up to the token IDs "3", "36", "854". These feed (upward arrows) a blue rounded box "Embedding" (white text). Above it, inside a black dashed box, the bold vectors $\mathbf{x}_{(0)}$, $\mathbf{x}_{(1)}$, $\mathbf{x}_{(2)}$ feed three pale-yellow cells joined by black right arrows. Their outputs $\hat{\mathbf{y}}_{(0)}$, $\hat{\mathbf{y}}_{(1)}$, $\hat{\mathbf{y}}_{(2)}$ and arrows are grey (unused).
> - *Decoder (right):* at the bottom, the italic quoted sentence "<sos> Me gusta el fútbol" has five black arrows fanning up to the token IDs "2", "14", "61", "10", "663", which feed a second, wider blue "Embedding" box. Above it, inside a second black dashed box, $\mathbf{x}_{(0)}$–$\mathbf{x}_{(4)}$ feed five orange cells joined by black right arrows. A black arrow runs from the last encoder cell into the first decoder cell, crossing both dashed boundaries. The black outputs $\hat{\mathbf{y}}_{(0)}$–$\hat{\mathbf{y}}_{(4)}$ go up into a blue rounded box "Dense + softmax activation", from which five arrows rise to two rows of words:
>   - "**Prediction:**" (black): *Me* (green), *encanta* (red), *el* (green), *fútbol* (green), *<eos>* (green);
>   - "**Target:**" (black, top row): *Me*, *gusta*, *el*, *fútbol*, *<eos>* (all black italic).
> - The colours mark correct (green) and wrong (red) predictions: "encanta" was predicted where the target is "gusta".
> - The label "Encoder-Decoder" sits above the left dashed box, with one short arrow down to the encoder box and one diagonal arrow to the decoder box.

*Caption:* Figure 16-3. A simple machine translation model

#### Right — text

The encoder-decoder networks are particularly suitable for ***Neural Machine Translation*** (**NMT**) problems. E.g., input: English sentences; output: Spanish sentences).

("NMT" is dark red, upright; its parentheses are black. The sentence ends with a closing parenthesis that has no matching opening one.)

---

## Slide 6 — Encoder-Decoder Networks for NMT (cont.)

In NMT, words are represented as embedding vectors<sup>2</sup>. The encoder and decoder parts can be implemented as a simple RNN, stacked RNN, or LSTM.

At each time step, a regular recurrent layer only looks at past and present inputs before generating its output. In other words, it is ***causal***, meaning it cannot look into the future. This type of RNN makes sense when forecasting time series, or in the decoder of a sequence-to-sequence model. But for tasks like text classification and translation, it is often preferable to look ahead at the next words before encoding a given word.

e.g., consider the phrases "***the right arm***", "***the right person***", and "***the right to criticize***": to properly encode the word "***right***", you need to look ahead.

**Footnotes:**

2. For example, as **Word2Vec**, **GloVe** (**Global Vectors for Word Representation**), or **fastText**, etc.

(The quotation marks around the dark-red italic phrases are black; the commas sit outside the closing quotes. In the footnote, "Word2Vec", "GloVe", "Global Vectors for Word Representation" and "fastText" are dark red, upright; the parentheses are black.)

---

## Slide 7 — Bidirectional RNNs and LSTMs

One solution is to run two recurrent layers on the same inputs, one reading the words from left to right and the other reading them from right to left, then combine their outputs at each time step, typically by concatenating them. This is what a ***bidirectional recurrent layer*** does:

> **Figure 16-5.** Three time steps, drawn bottom-to-top. At each step there are two stacked cells: a pale-yellow cell in front and a lilac/purple cell offset slightly up and to the right behind it. Each input $\mathbf{x}_{(0)}$, $\mathbf{x}_{(1)}$, $\mathbf{x}_{(2)}$ rises on an **orange** line to a small open (white-filled, purple-outlined) circle, where it splits: an orange arrow continues up into the yellow cell, and a **purple** branch goes right and then up into the purple cell. The yellow cells are chained **left to right** by orange arrows (forward layer); the purple cells are chained **right to left** by purple arrows along their tops (backward layer). From each pair, two black lines rise (one from each cell) and join at a black dot, from which a single black arrow goes up to the output $\hat{\mathbf{y}}_{(0)}$, $\hat{\mathbf{y}}_{(1)}$, $\hat{\mathbf{y}}_{(2)}$. The label "Concatenate" sits beside the third junction dot.

*Caption:* Figure 16-5. A bidirectional recurrent layer

---

## Slide 8 — Bidirectional RNNs and LSTMs (cont.)

For example, the following Bidirectional layer could be used as the encoder in our translation model:

```python
encoder = tf.keras.layers.Bidirectional(
    tf.keras.layers.LSTM(256, return_state=True))
```

There's just one problem. This layer will now return four states instead of two: the final short-term and long-term states of the forward LSTM layer, and the final short-term and long-term states of the backward LSTM layer. These won't fit with the decoder's LSTM layer and we cannot make the decoder bidirectional. To overcome this problem, we can concatenate the two short-term states, and also concatenate the two long-term states:

```python
encoder_outputs, *encoder_state = encoder(encoder_embeddings)
encoder_state = [
  tf.keras.layers.Concatenate(axis=-1)(encoder_state[::2]),  #short-term (0&2)
  tf.keras.layers.Concatenate(axis=-1)(encoder_state[1::2])  #long-term  (1&3)
]
```

("Bidirectional" in the first sentence is plain black text. In the second code box, the two comments run past the right edge of the grey box; "#long-term" is followed by two spaces so that "(1&3)" lines up under "(0&2)".)

---

## Slide 9 — Bidirectional RNNs and LSTMs (cont.)

Let's try a simple Bidirectional RNN on the bus/rail dataset, with inputs being $(\text{bus}, \text{rail})$ values over $56$ days and the outputs that we want to predict are the $(\text{bus}, \text{rail})$ values for the following day ($57^{\text{th}}$ day).

```python
simple_biRNN = tf.keras.Sequential([
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
                 verbose = 0, callbacks=[logging_cb, early_stopping_cb])
```

("(bus, rail)" is blue maths with upright sans-serif words. The parentheses around "57th day" are black; only "57th" is blue. The code box runs down to the slide-number line; the last code line reaches the right edge of the grey box.)

---

## Slide 10 — Bidirectional RNNs and LSTMs (cont.)

```text
Epoch   0: loss: 0.0932, mae: 0.2250; val_loss: 0.0221, val_mae: 0.1136
...
Epoch 160: loss: 0.0046, mae: 0.0404; val_loss: 0.0015, val_mae: 0.0279
Epoch 180: loss: 0.0046, mae: 0.0406; val_loss: 0.0017, val_mae: 0.0288
```

Now test the model on the validation set and compare with the ground truth `y_valid`:

```python
>>> yvalid_pred = simple_biRNN.predict(X_valid, verbose=0)
>>> print(np.mean(np.abs(yvalid_pred - y_valid)) * 1e6)
27936.60823591162
```

This MAE ($27, 936$) is slightly worse than $27{,}855$ from the RNN in topic 4 (slide $33/52$) where we used $(\text{bus}, \text{rail}, \text{one-hot-encoding(days)})$ (i.e., $5$ input features) to predict the $(\text{bus}, \text{rail})$ value on the $57^{\text{th}}$ day.

If we include additional information from the days of the weeks, then the validation MAE should be even lower.

(Both code boxes are grey. "27, 936" is typeset with a space after the comma; "27,855" has no space. The "4" after "topic" is black, not blue. The whole tuple "(bus, rail, one-hot-encoding(days))", including its outer parentheses, is blue; the parentheses around "slide 33/52" and "i.e., 5 input features" are black.)

---

## Slide 11 — Bidirectional RNNs and LSTMs (cont.)

To predict more days ahead, we could use a *for* loop as shown on slide $34/52$<sup>3</sup> in Topic 4 (***Processing Sequences Using RNNs and CNNs***).

> **Figure (slide 11, unnumbered).** A small matplotlib line chart with grid lines, no title and no legend. Y-axis label (rotated, serif): "validation MAE"; y tick labels 50000, 100000, 150000, 200000, 250000, 300000. X-axis label: "# prediction days"; x tick labels 2, 4, 6, 8, 10, 12, 14. One blue line with small round blue markers at x = 1, 2, …, 14 (14 points). Shape: the first point (x = 1) is the lowest, just below the 50000 gridline; the curve then rises steeply and almost linearly up to about the 250000 gridline by x = 6, reaches a small local peak at x = 7, dips slightly at x = 8–9, and then climbs steadily again to its highest point, above the 300000 gridline, at x = 14. No data values are printed on the chart.

(`X_valid` has $56$ days, then $57$ days, then $58$ days, ... in the *for* loop)

Unfortunately, the prediction errors accumulated quickly for this `simple_biRNN` model as we increase the ***prediction horizon***.

**Footnotes:**

3. Note that the example shown on that slide is for one instance only. Modification will be needed to make it work for the whole test set.

(The whole parenthesised line is the slide's own text, parentheses included. "for" is black italic in both places. "34/52" is blue; the footnote marker "3" after it is black.)

---

## Slide 12 — An Encoder-Decoder Network for the Bus/Rail Dataset

> **Figure (slide 12, unnumbered).** A hand-drawn diagram (blue pen: cells, arrows and handwritten labels) inside two typeset coloured boxes, with typeset serif labels.
> - Top left of the slide: a yellow rounded rectangle containing "TRAINING STAGE" in bold purple serif capitals.
> - *Left box:* a red rectangle with the bold red serif label "Encoder" at its bottom centre. Inside, three blue rectangular cells in a row, joined by blue arrows: cell 1 → cell 2 → "…" → cell 3. Below each cell, an upward arrow from a handwritten input label: "(Bus, Rail) / Day 0", "(Bus, Rail) / Day 1", "(Bus, Rail) / Day 54". Above each cell, an upward arrow to the handwritten label "(Discarded)".
> - From the right side of the last encoder cell, a blue line runs right, out of the red box, across the gap between the boxes, and into the first decoder cell (arrowhead at the decoder cell). In the gap, a small black handwritten italic "h" sits just above this line. Below the gap is the typeset label "encoder_state" (dark-blue/navy serif); a black dashed line rises from it to a small arrowhead at the "h".
> - *Right box:* a purple rectangle with the bold purple serif label "Decoder" at its bottom centre. Inside, three blue cells: cell 1 → cell 2 → "…" → cell 3, with a further arrow leaving cell 3 to the right. Inputs (from below): "(Bus, Rail) / Day 55", "(Bus, Rail) / Day 56", "(Bus, Rail) / Day 68". Outputs (above): "Estimated / (Bus, Rail) / Day 56", "Estimated / (Bus, Rail) / Day 57", "Estimated / (Bus, Rail) / Day 69".
> - At this (training) stage every decoder input is an actual (Bus, Rail) value: none is labelled "Estimated" and none is zero.

> **Handwritten annotation (slide 12).** Four annotations around the boxes:
> - *Above the Decoder box (purple, two lines):* "Compare Estimated (Bus, Rail) from Day 56 to Day 69" / "against ground truth y-train and minimize MSE". Under it, a purple curly brace spans the three decoder outputs, its central tip pointing up at "y-train".
> - *Below the Encoder box (blue):* a curly brace spanning the encoder's width (Day 0 … Day 54), labelled "55 days".
> - *Below that (red):* a longer curly brace from the left edge of the Encoder box to beneath the decoder's first column (Day 55), labelled "= X_train has 56 days' data" (the apostrophe is written after a gap, against "data": "days 'data").
> - *Below the Decoder box (purple):* a curly brace spanning the decoder's width, labelled "y-train has 14 days'" / "ground truth data".
>
> (In the purple "y-train" (both places) the joining stroke sits at mid-height like a hyphen; in the red "X_train" it sits near the baseline like an underscore. The "z" of "minimize" is a looped cursive z that dips below the line. The words "Estimated" are written with a flourished E.)

In this network, the *Encoder* tries to learn the patterns in the numbers of bus and rail riders over $55$ days (rather than $56$ days) while the *Decoder* tries to predict these numbers $14$ days ahead. At the training stage, the Decoder's inputs comprise of the last day from `X_train` and `y_train` shifted by one timestep, while its outputs are just `y_train`.

(The diagram has no figure number. "Encoder" and "Decoder" in the first sentence are black italic; "Decoder's" later is upright.)

---

## Slide 13 — An Encoder-Decoder Network for the Bus/Rail Dataset

> **Figure (slide 13, unnumbered).** The same layout as slide 12, for testing.
> - Top left: a yellow rounded rectangle containing "TESTING STAGE" in bold purple serif capitals. Its top edge overlaps the bottom of the dark-blue title bar.
> - *Encoder (red box, "Encoder"):* identical to slide 12 — inputs "(Bus, Rail) / Day 0", "(Bus, Rail) / Day 1", "(Bus, Rail) / Day 54"; outputs "(Discarded)"; cell 1 → cell 2 → "…" → cell 3.
> - The blue line from the last encoder cell to the first decoder cell, the black handwritten "h" above it, and the black dashed line from the typeset navy label "encoder_state" up to the "h" are as on slide 12.
> - *Decoder (purple box, "Decoder"):* three blue cells, cell 1 → cell 2 → "…" → cell 3 → (arrow out to the right).
>   - Cell 1: input "(Bus, Rail) / Day 55"; output "Estimated / (Bus, Rail) / Day 56".
>   - A curved blue arrow leaves cell 1's output stem, loops over to the right and down below the cells, and enters cell 2 from below. Cell 2's input label is "Estimated / (Bus, Rail) / Day 56"; its output is "Estimated / (Bus, Rail) / Day 57".
>   - Cell 2's output likewise curves down and ends in an arrowhead pointing up into the "…" gap. A short dotted vertical stroke below the gap leads into another curved arrow that enters cell 3 from below.
>   - Cell 3: input "Estimated / (Bus, Rail) / Day 68"; output "Estimated / (Bus, Rail) / Day 69".
> - The diagram shows each estimate being fed back as the next input; it shows no zero inputs.

> **Handwritten annotation (slide 13).** Four annotations around the boxes:
> - *Above the Decoder box (purple, two lines):* "Compare Estimated (Bus, Rail) from Day 56 to Day 69" / "against ground truth y_test to get the prediction error". Under it, a purple curly brace spans the decoder outputs, its central tip pointing up at "y_test".
> - *Below the Encoder box (blue):* a curly brace spanning the encoder's width, labelled "55 days".
> - *Below that (red):* a longer curly brace from the left edge of the Encoder box to beneath the decoder's first column (Day 55), labelled "X_test has 56 days' data" (no "=" this time; the apostrophe is again written against "data": "days 'data").
> - *Below the Decoder box (purple):* a curly brace spanning the decoder's width, labelled "assuming ground truth" / "y_test is not available".
>
> (Here the underscores in "y_test" and "X_test" sit at the baseline.)

#### Right and below — text

At the testing stage, the Decoder only has input at the **1st** timestep, coming from the last time step (day $55$) of `X_test`, (i.e., `X_test[:,-1,:]`), while its inputs for other timesteps are unknown (so we set them to $\mathbf{0}$). The whole network is run $14$ times for the $14$ days' prediction. That is, the `model.predict(...)` method is called $14$ times through a *for* loop. Each time in the loop when a new $(\text{bus,rail})$ value is predicted, it replaces the Decoder's input for the next day.

(Layout: the text starts in a narrow column to the right of the diagram; from "are unknown (so we set them to 0)" onward it runs full width below. "1st" is black bold. The "0" is a blue bold zero. "for" is black italic. "(bus,rail)" is blue, with no space after the comma, unlike "(bus, rail)" on slides 9–10.)

---

## Slide 14 — An Encoder-Decoder Network for the Bus/Rail Dataset

```python
inputs_dim = 2   # bus and rail
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
                        outputs=outputs)
```

(The whole slide is one grey code box, with no prose. The box runs down to the slide-number line, beside "14 / 51". The "# Note: …" comment runs past the right edge of the grey box.)

---

## Slide 15 — An Encoder-Decoder Network for the Bus/Rail Dataset

```python
early_stopping_cb = tf.keras.callbacks.EarlyStopping(
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
Epoch 260: loss: 0.0040, mae: 0.0358; val_loss: 0.0025, val_mae: 0.0322
```

(The code and the training log are in one grey box; there is no prose. The lower half of the slide is empty.)

---

## Slide 16 — An Encoder-Decoder Network for the Bus/Rail Dataset

Inspect the learning curves to ensure there is no overfitting or underfitting issue.

```python
hist = history.history
N_training_epochs = len(hist['loss'])
pd.DataFrame(hist).plot(
    figsize=(4,3), xlim=[0, N_training_epochs-1], ylim=[0, 0.2],
    grid=True, xlabel="Epoch", style=["r--", "r-.", "b--", "b-."])
plt.legend(loc="best")
plt.title('Learning curves')
plt.show()
```

> **Figure (slide 16, unnumbered).** A matplotlib learning-curve plot (serif font, grid on). Title: "biRNN Encoder-Decoder". X-axis label "Epoch"; x tick labels 0, 50, 100, 150, 200, 250; the axis runs from 0 to a little past 250. Y-axis has no label; y tick labels 0.00, 0.05, 0.10, 0.15, 0.20 (axis 0 to 0.20). Legend, upper right, four entries: "loss" (red dashed), "mae" (red dash-dot), "val_loss" (blue dashed), "val_mae" (blue dash-dot). Shape: all four curves start at or above the top of the plot at epoch 0 and drop almost vertically within the first few epochs. The two loss curves (dashed) flatten almost at once just above 0.00, with val_loss slightly below loss. The two MAE curves (dash-dot) decay more gradually, levelling off by about epoch 50–100 between the 0.00 and 0.05 gridlines, with val_mae below mae the whole way; val_mae turns up very slightly at the far right. No data values are printed on the chart.

(The code is in a smaller font than on the other slides.)

---

## Slide 17 — An Encoder-Decoder Network for the Bus/Rail Dataset

```python
def predict(model, encoder_inputs, decoder_input, outseq_len, **kwargs):
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
Validation set MAE =  34,863.8857
```

This is the lowest validation MAE so far for multi-task predictions for $14$ days ahead.

(One grey code box. The `def` line and the "# outseq_len …" comment run past the right edge of the box. The printed output has two spaces after "=".)

---

## Slide 18 — Attention Mechanisms

Coming back to the Encoder-Decoder networks for NMT, consider the path from the word "**soccer**" to its translation "**fútbol**" in Figure 16-3: it is quite long! This means that a representation of this word (along with all needs to be carried over many steps before it is actually used. Can't we make this path shorter?

> **Figure 16-3.** The same figure as on slide 5: "I like soccer" → token IDs 3, 36, 854 → "Embedding" → encoder cells (pale yellow, grey unused outputs $\hat{\mathbf{y}}_{(0)}$–$\hat{\mathbf{y}}_{(2)}$); "<sos> Me gusta el fútbol" → token IDs 2, 14, 61, 10, 663 → "Embedding" → decoder cells (orange) → $\hat{\mathbf{y}}_{(0)}$–$\hat{\mathbf{y}}_{(4)}$ → "Dense + softmax activation" → Prediction: *Me* (green), *encanta* (red), *el*, *fútbol*, *<eos>* (green); Target: *Me*, *gusta*, *el*, *fútbol*, *<eos>*. The "Encoder-Decoder" label points to both dashed boxes. Here it is drawn smaller, directly under the text.

*Caption:* Figure 16-3. A simple machine translation model

("soccer" and "fútbol" are dark red, upright; their quotation marks are black. The parenthesis opened at "(along with" is never closed.)

---

## Slide 19 — Attention Mechanisms

In a landmark 2014 paper by Bahdanau et al.<sup>4</sup>, a technique was introduced that allowed the decoder to focus on the appropriate words (as encoded by the encoder) at each time step. e.g., at the time step where the decoder needs to output the word "**fútbol**", it will focus its attention on the word "**soccer**". This means that the path from an input word to its translation is now much shorter, so the short-term memory limitations of RNNs have much less impact. ***Attention mechanisms*** revolutionized neural machine translation (and deep learning in general), allowing a significant improvement in the state of the art, especially for long sentences (e.g., over 30 words).

**Footnotes:**

4. Dzmitry Bahdanau et al., "Neural Machine Translation by Jointly Learning to Align and Translate", arXiv preprint arXiv:1409.0473 (2014)

("fútbol" and "soccer" are dark red, upright, inside black quotation marks. The footnote has no closing full stop, and its comma sits outside the closing quotation mark.)

---

## Slide 20 — Attention Mechanisms (cont.)

#### Left — figure

> **Figure 16-7.** Two dashed-outline panels: the encoder-decoder network on the left (Decoder box above Encoder box) and an "Alignment model" box on the right.
> - *Encoder (lower-left dashed box, label "Encoder" at its bottom left):* the quoted italic words "I", "like", "soccer" sit below the box, each with a black arrow up to $\mathbf{x}_{(0)}$, $\mathbf{x}_{(1)}$, $\mathbf{x}_{(2)}$. Each $\mathbf{x}_{(i)}$ splits into two black arrows: one into a pale-yellow front cell and one (via a right-angle branch) into a purple cell offset behind it. The yellow cells are chained **left to right** by black arrows along their lower edge; the purple cells are chained **right to left** by purple arrows along their top edge (a bidirectional layer). Each pair outputs upward to $\hat{\mathbf{y}}_{(0)}$, $\hat{\mathbf{y}}_{(1)}$, $\hat{\mathbf{y}}_{(2)}$ (with hats).
> - *Weighted sum:* three lines run from the encoder outputs up into a small pink/red rounded box marked "+" at the bottom of the Decoder box: a **thin light-grey** diagonal arrow from $\hat{\mathbf{y}}_{(0)}$, a **grey** vertical arrow from $\hat{\mathbf{y}}_{(1)}$, and a **thick black** diagonal arrow from $\hat{\mathbf{y}}_{(2)}$. They are labelled "$\times\alpha_{(3,0)}$" (light grey, left of the "+" box), "$\times\alpha_{(3,1)}$" (black, beside the $\hat{\mathbf{y}}_{(1)}$ arrow just below the Decoder box) and "$\times\alpha_{(3,2)}$" (black, right of the "+" box). The line weight and shade track the size of each weight; the arrow from "soccer" is the heaviest.
> - *Decoder (upper-left dashed box, label "Decoder" at its bottom left):* a solid orange cell in the centre receives a black arrow from the "+" box below; the label $\mathbf{h}_{(2)}$ sits to the left of that arrow, just under the arrow that enters the cell from the left. The solid cell outputs a black arrow up to $\hat{\mathbf{y}}'_{(3)}$, with the quoted italic word "fútbol above it (no closing quotation mark). To its left is a faded (light-orange, dashed-outline) cell with dashed grey input and output arrows, output $\hat{\mathbf{y}}'_{(2)}$ under the word "el"; to its right a second faded cell with output $\hat{\mathbf{y}}'_{(4)}$. Horizontally: "…" and a dashed grey arrow into the left faded cell, a solid grey arrow from it to the solid cell, a black arrow from the solid cell to the right faded cell, and a dashed grey arrow out to the right. A "…" also sits above the top-left corner of the box.
> - *Alignment model (right dashed box, label "Alignment model" at its bottom left):* at the bottom, $\mathbf{y}_{(0)}$, $\mathbf{y}_{(1)}$, $\mathbf{y}_{(2)}$ (**no hats**) each send a thick black arrow up into a blue rounded box "Dense" (white text). $\mathbf{h}_{(2)}$ enters from the left as a single horizontal line under the Dense box, with three thin branch arrows rising into the Dense box, one beside each $\mathbf{y}_{(i)}$ arrow. The Dense box outputs three arrows up to the italic scores $e_{(3,0)}$, $e_{(3,1)}$, $e_{(3,2)}$, which feed (arrows) an orange rounded box "Softmax"; the Softmax box outputs three arrows (left, centre, right) to $\boldsymbol{\alpha}_{(3,0)}$, $\boldsymbol{\alpha}_{(3,1)}$, $\boldsymbol{\alpha}_{(3,2)}$ at the top.
> - A black dashed arrow runs from the upper-left of the Alignment model box up-left to the Decoder box, ending at the "$\times\alpha_{(3,2)}$" label beside the "+" box.

*Caption:* Figure 16-7. Neural machine translation using an encoder-decoder network with an attention model

#### Right and below — text

Instead of just sending the **encoder's final hidden state** to the decoder, as well as the **previous target word** (not shown in the figure) at each step, **all of the encoder's outputs** are now sent to the decoder as well.

Since the decoder cannot deal with all these outputs, we need to aggregate them:

At each time step, the decoder's memory cell computes a **weighted sum** of all the encoder outputs. This determines which words it will focus on at this step.

(Layout: the first two paragraphs are a narrow column to the right of the figure; the last paragraph runs full width below it. The caption wraps after "using". The dark-red phrases are upright.)

---

## Slide 21 — Attention Mechanisms (cont.)

#### Left — figure

> **Figure 16-7.** The same figure as on slide 20 (encoder with inputs "I", "like", "soccer" and outputs $\hat{\mathbf{y}}_{(0)}$–$\hat{\mathbf{y}}_{(2)}$; the "+" box with "$\times\alpha_{(3,0)}$", "$\times\alpha_{(3,1)}$", "$\times\alpha_{(3,2)}$"; the decoder cell with $\mathbf{h}_{(2)}$ and output $\hat{\mathbf{y}}'_{(3)}$ for "fútbol; the Alignment model with $\mathbf{h}_{(2)}$, $\mathbf{y}_{(0)}$–$\mathbf{y}_{(2)}$ → "Dense" → $e_{(3,0)}$–$e_{(3,2)}$ → "Softmax" → $\boldsymbol{\alpha}_{(3,0)}$–$\boldsymbol{\alpha}_{(3,2)}$).

*Caption:* Figure 16-7. Neural machine translation using an encoder-decoder network with an attention model

#### Right — text

The weight $\alpha(t, i)$ is the weight of the $i^{\text{th}}$ encoder output at the $t^{\text{th}}$ decoder time step. e.g., if, at time step $3$, the weight $\alpha(3, 2)$ is much larger than the weights $\alpha(3, 0)$ and $\alpha(3, 1)$, then the decoder will pay much more attention to the encoder's output for word $\#2$ ("soccer") than to the other two outputs.

But how do we get all these $\alpha(t, i)$ weights?

(In the text the weights are written $\alpha(t, i)$, with the indices in parentheses on the baseline, while the figure writes them as subscripts, $\alpha_{(3,0)}$ etc. "soccer" here is black, not dark red.)

---

## Slide 22 — Attention Mechanisms (cont.)

#### Left — figure

> **Figure 16-7.** The same figure as on slides 20–21.

*Caption:* Figure 16-7. Neural machine translation using an encoder-decoder network with an attention model

#### Right and below — text

Well, all these $\alpha(t, i)$ weights are generated by a small neural network called an ***alignment model*** (or an ***attention layer***), which is trained jointly with the rest of the encoder-decoder model.

The blue **Dense** layer, which contains **only one neuron**, processes the four input vectors<sup>5</sup> and outputs a score $\mathbf{e}_{3,i}$ for each $\mathbf{y}_{(i)}$ for the current time step ($3$). Through the **softmax** layer, the three cores are then converted into probabilities, which are used as weights to help the decoder to predict the next word.

**Footnotes:**

5. vector $\mathbf{h}_{(2)}$ is the hidden state output from the previous time step (in this case, time step $2$) of the decoder; $\mathbf{y}_{(0)}$, $\mathbf{y}_{(1)}$, and $\mathbf{y}_{(2)}$ are three output vectors from the encoder.

(Layout: the text starts in a column to the right of the figure; from "the three cores are then converted …" it runs full width below. "Dense", "only one neuron" and "softmax" are dark red, upright. The score is a bold $\mathbf{e}$ with the plain subscript "3,i" (no parentheses), while $\mathbf{y}_{(i)}$ has a parenthesised subscript. The parentheses around the blue "3" are black. Footnote 5 begins with a lowercase "vector".)

---

## Slide 23 — Attention Mechanisms (cont.)

#### Left — figure

> **Figure 16-7.** The same figure as on slides 20–22.

*Caption:* Figure 16-7. Neural machine translation using an encoder-decoder network with an attention model

#### Right and below — text

**Bahdanau attention**. E.g., in the diagram, the Decoder has already output "**me gusta el**" (meaning "**I like**") so it's now expecting a noun: the word "**soccer**" is the one that best aligns with the current state, so $e_{(3,2)}$ gets a high score and thus a high probability $\alpha_{(3,2)}$ after the **softmax** function.

This particular attention mechanism is called ***Bahdanau attention*** (named after the 2014 paper's first author).

Since it concatenates the output $\mathbf{y}$ vectors from the Encoder and the previous hidden state $\mathbf{h}$ from the Decoder, this attention mechanism is also called ***concatenative attention*** or ***additive attention***.

(The opening "Bahdanau attention" is a run-in heading in **bold blue**, not dark red. "me gusta el", "I like", "soccer" and "softmax" are dark red, upright, with black quotation marks. "me gusta el" wraps after "gusta". "probability" is hyphenated across a line break as "proba-bility". Here the score is an italic non-bold $e$ with a parenthesised subscript, and the weight is written $\alpha_{(3,2)}$ with a subscript. The right column is fully justified. The last two paragraphs run full width below the figure.)

---

## Slide 24 — Attention Mechanisms (cont.)

### Luong attention or multiplicative attention

This is another common attention mechanism proposed shortly after, in 2015, by Luong et al<sup>6</sup>. The authors proposed to simply compute the **dot product** of the output vectors $\mathbf{y}$ and hidden state vector $\mathbf{h}$, as this is often a fairly good similarity measure, and modern hardware can compute it very efficiently.

The only constraint imposed on the network is these vectors must be of the same length.

**Footnotes:**

6. Minh-Thang Luong et al., "Effective Approaches to Attention-Based Neural Machine Translation", Proceedings of the 2015 Conference on Empirical Methods in Natural Language Processing (2015): 1412–1421.

(The sub-heading is bold blue. "dot product" is dark red, upright. "et al" has no full stop before the footnote marker; the full stop comes after the marker. The page range uses an en dash.)

---

## Slide 25 — Attention Mechanisms (cont.)

### Three variants of Luong attention mechanism

The Luong attention mechanism is defined as:

$$
\widetilde{\mathbf{h}}_{(t)} = \sum_{i} \alpha_{(t,i)} \mathbf{y}_{(i)}
$$

with

$$
\alpha_{(t,i)} = \frac{\exp(e_{(t,i)})}{\sum\limits_{i'} \exp(e_{(t,i')})}
$$

$$
e_{(t,i)} = \begin{cases}
\mathbf{h}_{(t)}^{\top} \mathbf{y}_{(i)} & \text{dot product} \\
\mathbf{h}_{(t)}^{\top} \mathbf{W} \mathbf{y}_{(i)} & \text{general dot product} \\
\mathbf{v}^{\top} \text{tanh} \big( \mathbf{W} \big[ \mathbf{h}_{(t)} ; \mathbf{y}_{(i)} \big] \big) & \text{concat}
\end{cases}
$$

The authors compared the concat attention mechanism against the two dot product attention mechanisms and found that the former was outperformed by the two latter mechanisms. Because of that, the concat variant of Luong attention mechanism is less used now.

(The sub-heading is bold blue. "with" and the other prose are black. All three equations and the case labels "dot product", "general dot product", "concat" are blue. The tilde over $\mathbf{h}$ is a wide tilde. In the denominator, $i'$ is set directly below the $\Sigma$. "tanh" is set in upright sans-serif like the body text, whereas "exp" is in roman (serif) type. The ⊤ on $\mathbf{h}$ sits directly above the subscript $(t)$. The parentheses and square brackets in the concat line are slightly enlarged. No equation numbers are shown.)

---

## Slide 26 — Attention Mechanisms (cont.)

### Implementing attention mechanisms using Keras

Keras provides a `tf.keras.layers.Attention` layer for Luong attention, and an `AdditiveAttention` layer for Bahdanau attention. Since we will need to pass all the encoder's outputs to the Attention layer, we need to set `return_sequences=True` when creating the encoder:

```python
encoder = tf.keras.layers.Bidirectional(
tf.keras.layers.LSTM(256, return_sequences=True, return_state=True))
```

For simplicity, we can pass the decoder's outputs instead of its states to the attention layer: in practice this works well too, and it's much easier to code, as shown below:

```python
attention_layer = tf.keras.layers.Attention()  # default: score_mode="dot"
attention_outputs = attention_layer([decoder_outputs, encoder_outputs])
output_layer = tf.keras.layers.Dense(vocab_size, activation="softmax")
Y_proba = output_layer(attention_outputs)
```

By default, the *dot product* variant is used in the `Attention` layer. To use the ***concat*** variant, set `score_mode="concat"`.

(The sub-heading is bold blue. In the third sentence "Attention layer" is plain black text, not typewriter; in the last paragraph `Attention` is dark-red typewriter. "Luong attention" and "Bahdanau attention" are plain black. "dot product" is black italic; "concat" is dark-red italic. In the first code box the second line starts at the same column as `encoder` (no indentation). In the second code box the closing `"` of the comment sticks out past the right edge of the grey box.)

---

## Slide 27 — Attention Mechanisms (cont.)

### The concepts of "keys", "values", and "queries"

Consider the sentence "**I like soccer**" again. Suppose that the encoder managed to understand the word "**I**" is the subject and the word "**like**" is the verb in the encoding process. Now suppose that the decoder has translated the subject "**I**" into Spanish and it should translate the verb next. For this, it needs to fetch the verb from the input sentence. This is analogous to a ***dictionary lookup*** – it is as if the encoder had created a dictionary **{"subject": "They", "verb": "played", ...}** and the decoder wanted to look up the **value** that corresponds to the **key** `"verb"`.

The outputs from the encoder are the **keys** and, optionally, the **values**; the outputs from the decoder are the **queries**.

(The sub-heading is bold blue. The quoted words I like soccer / I / like / I are dark red inside black quotation marks. The dictionary `{"subject": "They", "verb": "played", ...}` is entirely dark red, set in the normal sans font (not typewriter) with maths-style braces, and every one of its quotation marks is drawn as a closing (right) double quote; it wraps after `"subject":`. "dictionary lookup" is dark-red italic. "value", "key", "keys", "values" and "queries" are **black bold**, not dark red. `"verb"` after "key" is dark-red typewriter.)

---

## Slide 28 — Attention Mechanisms (cont.)

### The concepts of "keys", "values", and "queries" (cont.)

The `attention_layer` expects $2$ to $3$ inputs. If the *values* input is not provided, then it is treated as equal to the *keys* input. The line (see slide 26)

```python
attention_outputs = attention_layer([decoder_outputs, encoder_outputs])
```

can therefore be interpreted as

$$
\textit{attention\_outputs} = \textit{attention\_layer([queries, keys])}
$$

The output `attention_outputs` is then converted into an array of probabilities (variable `Y_proba` on slide 26) through the `Dense` layer and the `softmax` activation. The length of the `Y_proba` array corresponds to the vocabulary size of the target language (in our example, Spanish).

These concepts are all represented as vectors in the model and are incorporated extensively in the **transformer** architecture.

(The sub-heading is bold blue. "values" and "keys" in the first paragraph are black italic. Both "26"s are red hyperlink numbers. The centred display line is blue italic sans-serif; its underscores are drawn as low rules, as in a LaTeX `\_`. "transformer" in the last sentence is dark red, not italic.)

---

## Slide 29 — The Original Transformer Architecture

In the 2017 groundbreaking paper "**Attention Is All You Need**"<sup>7</sup> from Google, the authors proposed an architecture called the ***transformer***, which significantly improved the state-of-the-art in NMT without using any recurrent or convolutional layers, just attention mechanisms (plus embedding layers, dense layers, etc).

Because the model is not recurrent, it doesn't suffer as much from the vanishing or exploding gradients problems as RNNs. It can be trained in fewer steps, it's easier to parallelize across multiple GPUs, and it can better capture long-range patterns than RNNs.

**Footnotes:**

7. Ashish Vaswani et al., "Attention Is All You Nee", Proceedings of the 31st International Conference on Neural Information Processing Systems (2017): 6000–6010.

(The paper title in the body is dark red inside black quotation marks; "transformer" is dark-red italic. The footnote's title really is cut off as "Nee"; the page range uses an en dash.)

---

## Slide 30 — The Original Transformer Architecture (cont.)

#### Left — figure

> **Figure 16-8.** The original transformer diagram, drawn bottom-to-top: encoder stack on the left, decoder stack on the right. Every box has a black rounded outline. The fill colours carry meaning: **pink** = the two embedding boxes, **orange** = the attention boxes, **pale yellow-green** = "Add & Norm", **light blue** = "Feed Forward", **lavender** = "Linear", **light green** = "Softmax". Each stack sits in a large light-grey rounded rectangle labelled "N×" outside it (encoder: "N×" to the left of its grey box; decoder: "N×" to the right of its grey box). There are no brackets; the grey boxes themselves mark the repeated layer.
> *Encoder (left).* The label "Inputs" at the bottom has an arrow up into a pink box "Input Embedding". An arrow rises from it into a circled plus (⊕). On the ⊕'s left, a short line joins it to a circle containing a sine-wave symbol (∿), labelled "Positional Encoding" (two lines) further left. From the ⊕ one line rises into the grey encoder box. Inside, bottom to top:
> 1. The incoming line splits. One branch runs left along the bottom of the box, up the inside left edge, and into the left side of the lower "Add & Norm" as an arrow (residual/skip connection). The main line rises and fans out into **three arrows (left, middle, right) into the bottom of an orange "Multi-Head Attention" box. All three come from the same line**, so this is self-attention. An "Add & Norm" box sits directly on top of the attention box.
> 2. From that "Add & Norm" a line rises into a light-blue "Feed Forward" box. Below the Feed Forward box a branch goes left and up the inside left edge into the left side of the upper "Add & Norm" (skip connection). A second "Add & Norm" sits directly on top of "Feed Forward".
> 3. From the top of the upper "Add & Norm" the encoder's output line leaves the grey box upward. It runs right above the encoder box and drops down the gap between the two stacks, outside the decoder box. Just below the decoder's middle attention block it turns right into the decoder box (see decoder step 2).
>
> *Decoder (right).* The label "Outputs (shifted right)" (two lines) at the bottom has an arrow up into a pink box "Output Embedding", then up into a ⊕. On the ⊕'s right, a short line joins it to a sine-wave circle labelled "Positional Encoding" further right. From the ⊕ one line rises into the taller grey decoder box. Inside, bottom to top:
> 1. The incoming line splits. One branch runs right along the bottom and up the inside right edge into the right side of the first "Add & Norm" (skip connection). The main line fans out into **three arrows into the bottom of an orange "Masked Multi-Head Attention" box** (three lines of text; again all three arrows come from the same line). An "Add & Norm" sits on top of it.
> 2. Above that is an orange **"Multi-Head Attention"** box with an "Add & Norm" on top. Three arrows enter its bottom. The **left and middle arrows both come from the encoder's output line**, which enters from the left below this block and curves up into those two positions. The **right (third) arrow comes from the decoder's own first "Add & Norm"** (the masked-attention sub-layer): its output line rises and curves right into the third position. Part-way up, that line also sends a branch right and up the inside right edge into the right side of the second "Add & Norm" (skip connection).
> 3. From the second "Add & Norm" a line rises into a light-blue "Feed Forward" box topped by a third "Add & Norm". Below the Feed Forward box a branch runs right and up the inside right edge into the right side of the third "Add & Norm" (skip connection).
> 4. From the top of the decoder box an arrow rises into a lavender "Linear" box, then into a light-green "Softmax" box. A final arrow points up to the label "Output Probabilities" (two lines).

*Caption:* Figure 16-8. The original 2017 transformer architecture

#### Right — text

In the diagram, the left part is the *encoder*; the right part is the *decoder*. Each embedding layer outputs a 3D tensor of shape **[batch size, sequence length, embedding size]**. After that, the tensors are gradually transformed as they flow through the transformer, but their shape remains the same. In the 2017 paper, the authors set $N = 6$.

There are two embedding layers (pink boxes). There are some skip connections followed by Addition and Normalisation layers. The Feed Forward modules (light blue boxes) comprise two Dense layers each: the first layer uses ReLU; the second layer has no activation function.
Since all these layers treat each word independently from the others, we need a layer that captures the context and relationships among words. This is the role of the ***multi-header attention*** layer in the network.

("encoder" and "decoder" are black italic. The shape "[batch size, sequence length, embedding size]" is dark red, not italic, and wraps after "length,". "multi-header attention" (sic) is dark-red italic. The sentence starting "Since all these layers" begins on a new line with no paragraph gap.)

---

## Slide 31 — The Original Transformer Architecture (cont.)

#### Left — figure

> **Figure 16-8.** The same figure as on slide 30 (the PDF reuses the identical embedded image): encoder on the left ("Inputs" → "Input Embedding" → ⊕ "Positional Encoding" → grey "N×" box with "Multi-Head Attention", "Add & Norm", "Feed Forward", "Add & Norm"). Decoder on the right ("Outputs (shifted right)" → "Output Embedding" → ⊕ "Positional Encoding" → grey "N×" box with "Masked Multi-Head Attention", "Add & Norm", "Multi-Head Attention", "Add & Norm", "Feed Forward", "Add & Norm") → "Linear" → "Softmax" → "Output Probabilities". As on slide 30, the three arrows into each self-attention block (encoder "Multi-Head Attention", decoder "Masked Multi-Head Attention") all branch from one line. For the decoder's upper "Multi-Head Attention", the left and middle arrows come from the encoder's output and the right (third) arrow comes from the decoder's masked-attention sub-layer.

*Caption:* Figure 16-8. The original 2017 transformer architecture

#### Right — text

- The first two arrows going into each multi-head attention layer represent the *keys* and *values*, and the third arrow represents the *queries*.
- The encoder's ***multi-head attention*** layer updates each word representation by attending to (i.e., paying attention to) all other words in the same sentence.
- The decoder's ***masked multi-head attention*** layer does the same thing, but when it processes a word, it doesn't attend to words located after it: it's a causal layer. This is done by the additional *masking* operation.
- The ***positional encodings*** are dense vectors (much like word embeddings) that represent the position of each word in the sentence.

("keys", "values", "queries" and "masking" are black italic; "multi-head attention", "masked multi-head attention" and "positional encodings" are dark-red italic. The bullets are inline "•" paragraphs, not an indented list. The slide does not say which of the first two arrows is the keys and which is the values. In the figure the arrows run left to right, so "first two" = the left and middle arrows.)

---

## Slide 32 — The Original Transformer Architecture (cont.)

There are two key components in the Transformer architecture: **(i)** ***the Positional Encoding layer***; **(ii)** ***the Multi-Head Attention mechanism***.

### Positional encodings

A ***positional encoding*** is a dense vector that encodes the position of a word within a sentence: the $i^{\text{th}}$ positional encoding is added to the word embedding of the $i^{\text{th}}$ word in the sentence. The easiest way to implement this is to use an Embedding layer and make it encode all the positions from $0$ to the maximum sequence length in the batch, then add the result to the word embeddings.
The authors of the *transformer* paper chose to use fixed positional encodings, based on the sine and cosine functions at different frequencies. Their positional encoding matrix $\mathbf{P}$ is defined as:

$$
\mathbf{P}_{p,i} =
\begin{cases}
\sin\left(p/1000^{i/d}\right) & \text{if } i \text{ is even} \\
\cos\left(p/1000^{(i-1)/d}\right) & \text{if } i \text{ is odd}
\end{cases}
$$

where $\mathbf{P}_{p,i}$ denotes the positional encoding for the $i^{\text{th}}$ component of the embedding vector for the word located at the $p^{\text{th}}$ position in the sentence; and $d$ denotes the dimension of the *keys*, *values*, and *queries* vectors.

("(i)" and "(ii)" are **black bold**; the two phrases after them are dark-red italic. "positional encoding" in the first sentence is dark-red italic. "transformer", "keys", "values" and "queries" are black italic. The "th" in $i^{\text{th}}$ / $p^{\text{th}}$ is an upright superscript. The whole display equation is blue, including the "if $i$ is even" / "if $i$ is odd" labels. From a 600-dpi crop, the base is **1000** (four digits, no 10,000) in both rows. The exponents are $i/d$ (sine row) and $(i-1)/d$ (cosine row), and the arguments are written as a slash fraction $p/1000^{\cdots}$ inside tall round brackets.)

---

## Slide 33 — The Original Transformer Architecture (cont.)

### Positional encodings (cont.)

> **Figure 16-9.** Two stacked matplotlib panels that share the horizontal axis $p$ (0 to 200).
> *Top panel (line plot):* y-axis label $P_{(p,i)}$, ticks −1.0, −0.5, 0.0, 0.5, 1.0. No x tick labels; tick marks only, aligned with the bottom panel. Light-grey grid lines, plus a darker grey horizontal line at 0.0. Two sinusoids with the **same period**: a **blue** curve ($i = 100$) starts at 0.0 at $p = 0$ and rises (sine-like), and a **red** curve ($i = 101$) starts at 1.0 at $p = 0$ and falls (cosine-like). Both complete several full cycles across the plot. A **black dashed** vertical line at $p = 22$ and a **grey dashed** vertical line at $p = 60$ each cross both curves, with a blue dot on the blue curve and a red dot on the red curve. The two blue dots are at the same height (below zero), and so are the two red dots (lower, near the trough). A blue **×** sits on the blue curve at $p = 35$, at the same height as the blue dots. There is no red marker at $p = 35$. Legend (upper right, five entries): black dashed "$p = 22$", grey dashed "$p = 60$", blue × "$p = 35$", blue line "$i = 100$", red line "$i = 101$".
> *Bottom panel (image):* a greyscale (black-and-white) heat map of the positional-encoding matrix, transposed. x-axis "$p$" with ticks 0, 25, 50, 75, 100, 125, 150, 175, 200; y-axis "$i$" with ticks 0, 25, 50, 75, 100, 125, 150. **No colour bar.** Shape: near $i = 0$ (bottom) the values oscillate very fast along $p$, as fine stripes fanning out in curved arcs. Moving up (larger $i$) the stripes become wider and the oscillation slower, until near the top the bands are broad and smooth. Fine horizontal striping runs through the whole image because adjacent rows alternate between sine and cosine. The same black and grey dashed vertical lines at $p = 22$ and $p = 60$ cross this panel. A thick **red** horizontal line at $i = 101$ and a thick **blue** one at $i = 100$ (red just above blue) span the full width, with blue/red dots where they meet the dashed lines.

*Caption:* Figure 16-9. Sine/cosine positional encoding matrix (transposed, bottom) with a focus on two values of $i$ (top)

After these positional encodings are added to the word embeddings, the rest of the model has access to the absolute position of each word in the sentence because each position has a unique positional encoding.

(The $i$ in the caption is blue maths. The slide does not explain the dashed lines, dots or × marker, and it does not state the $d$ used to draw the plot.)

---

## Slide 34 — The Original Transformer Architecture (cont.)

### Positional encodings (cont.)

TensorFlow provides a `tfm.vision.layers.PositionalEncoding` layer. Using the `tfm` library requires additional installation `tensorflow_models`<sup>8</sup>. However, it is not too hard to create one yourself.

For efficiency reasons, we precompute the positional encoding matrix in the constructor. The `call()` method just truncates this encoding matrix to the maximum length of the input sequences, and it adds them to the inputs. We also set `supports_masking=True` to propagate the input's automatic mask to the next layer:

**Footnotes:**

8. Installation can be done by running the command: `pip install tf-models-official`. **Warning:** this is probably a very large library and is not easy to install.

(The code the last sentence leads into is on slide 35; the rest of this slide is empty. In the footnote, `pip install` and `tf-models-official` are dark-red typewriter split across a line break, and "Warning:" is **black bold**.)

---

## Slide 35 — The Original Transformer Architecture (cont.)

### Positional encodings (cont.)

```python
class PositionalEncoding(tf.keras.layers.Layer):
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
```

(The whole slide is one code box. The continuation line `2 * np.arange(...)` is aligned under `np.arange(max_length)`, i.e. directly after `np.meshgrid(`. The end of the `def __init__` line (`s):`) sticks out past the right edge of the grey box. Both trig lines use `10_000`, with the same exponent `(i / embed_size)` in the sine and cosine lines.)

---

## Slide 36 — The Original Transformer Architecture (cont.)

### Positional encodings (cont.)

After that, adding the positional encoding to the encoder's outputs is straightforward:

```python
pos_embed_layer = PositionalEncoding(max_length, embed_size)
encoder_in = pos_embed_layer(encoder_embeddings)
decoder_in = pos_embed_layer(decoder_embeddings)
```

The code for the embedding on the decoder part of the network is similar.

---

## Slide 37 — The Original Transformer Architecture (cont.)

### Multi-head attention

Now let's look deeper into the ***multi-head attention*** layer, the heart of the transformer model.

#### Left — figure

> **Figure 16-10.** Drawn bottom-to-top. Three input labels along the bottom, left to right: "V", "K", "Q". Each has an arrow up into its own pale-grey "Linear" box, and each "Linear" has an arrow up into its own pale-yellow "Split" box. From each "Split" box **three parallel arrows** rise, one black, one dark grey and one light grey, into a lavender box labelled "Scaled Dot-Product Attention". That box is the front of a stack of three identical boxes: two paler copies are offset behind it, up and to the right. A hooked brace on the right side of the stack is labelled "H". The black arrows enter the front box; the grey arrows are drawn passing behind it to the paler copies. From the top of the stack, three arrows (black, dark grey, light grey) rise into a pale-yellow "Concat" box. One arrow goes up from "Concat" into a pale-grey "Linear" box, and one arrow leaves the top of the figure with no label.

*Caption:* Figure 16-10. Multi-head attention layer architecture

#### Right — text

To understand how a multi-head attention layer works, we must first understand the ***scaled dot-product attention*** layer, which outputs:

$$
\text{Attention}(\mathbf{Q}, \mathbf{K}, \mathbf{V}) = \text{softmax}\left(\frac{\mathbf{Q}\mathbf{K}^{\top}}{\sqrt{d_{\text{keys}}}}\right)\mathbf{V}
$$

where

- $\mathbf{Q}$ (shape: $[n_{\text{queries}}, d_{\text{keys}}]$; *query* matrix) contains one row per query;
- $\mathbf{K}$ (shape: $[n_{\text{keys}}, d_{\text{keys}}]$; *key* matrix) contains one row per key;
- $\mathbf{V}$ (shape: $[n_{\text{keys}}, d_{\text{values}}]$; *value* matrix) contains one row per value.

(The first sentence runs the full width above the figure. "multi-head attention" and "scaled dot-product attention" are dark-red italic. The display equation is blue: "Attention" and "softmax" are upright sans-serif, $\mathbf{Q}, \mathbf{K}, \mathbf{V}$ are bold, the transpose is ⊤, and the denominator is a square root over $d_{\text{keys}}$, read from a 600-dpi crop. The bullet marks are blue "•", and "query", "key", "value" are black italic.)

---

## Slide 38 — The Original Transformer Architecture (cont.)

### Multi-head attention (cont.)

#### Left — figure

> **Figure 16-10.** The same figure as on slide 37 (the PDF reuses the identical embedded image): V, K, Q → three "Linear" boxes → three "Split" boxes → a stack of "H" lavender "Scaled Dot-Product Attention" boxes → "Concat" → "Linear" → output arrow.

*Caption:* Figure 16-10. Multi-head attention layer architecture

#### Right — text

$$
\text{Attention}(\mathbf{Q}, \mathbf{K}, \mathbf{V}) = \text{softmax}\left(\frac{\mathbf{Q}\mathbf{K}^{\top}}{\sqrt{d_{\text{keys}}}}\right)\mathbf{V}
$$

So,

- $\mathbf{Q}\mathbf{K}^{\top}$ (shape: $[n_{\text{queries}}, n_{\text{keys}}]$) contains one similarity score for each query/key pair.
- The factor $1/d_{\text{keys}}$ scales down the similarity scores to avoid saturating the softmax function, which would lead to tiny gradients.
- The output from the softmax function has the same shape (also $[n_{\text{queries}}, n_{\text{keys}}]$) but the numbers for each row add up to $1$.
- The output shape of $\text{Attention}(\mathbf{Q}, \mathbf{K}, \mathbf{V})$ is therefore $[n_{\text{queries}}, d_{\text{values}}]$ where each row represents the query result (a weighted sum of the values).

(The displayed equation is identical to slide 37's, with √ over $d_{\text{keys}}$. In the second bullet the factor is printed as $1/d_{\text{keys}}$ with **no square root**, confirmed from a 400-dpi crop. "similarity" is hyphenated across a line break on the slide ("simi-larity").)

---

## Slide 39 — The Original Transformer Architecture (cont.)

### Multi-head attention (cont.)

#### Left — figure

> **Figure 16-10.** The same figure as on slides 37–38 (identical embedded image). The text below refers to its parts by colour: the three pale-yellow "Split" boxes ("yellow box") and the pale-yellow "Concat" box ("top yellow box"); "H" labels the stack of "Scaled Dot-Product Attention" boxes.

*Caption:* Figure 16-10. Multi-head attention layer architecture

#### Right — text

- In the training stage, the data going into the network and the multi-head attention layer are 3D tensor (axis $0$ is the minibatch size). All the matrix multiplications can be done efficiently in Python.
- Notice that after $\mathbf{V}$, $\mathbf{K}$, and $\mathbf{Q}$ are individually transformed by the ***Linear*** layers (see diagram), they are split (yellow box) and later on concatenated back (top yellow box). The separate parts going through the ***Scaled Dot-Product Attention*** layer allow different characters of the words to be captured (e.g., not only the word "**like**" is a verb, it is also in present tense).
- The number of parts that $\mathbf{V}$, $\mathbf{K}$, and $\mathbf{Q}$ are split is determined by the value of $H$ (**number of heads**).

("Linear" and "Scaled Dot-Product Attention" are dark-red italic; "like" is dark red inside black quotes; "number of heads" is dark red, not italic. $\mathbf{V}, \mathbf{K}, \mathbf{Q}$ are bold blue and $H$ is blue italic. "individually" is hyphenated across a line break on the slide.)

---

## Slide 40 — The Original Transformer Architecture (cont.)

### Multi-head attention (cont.)

- The multi-head attention layer in the **encoder** is a ***self-attention*** layer as it updates each word representation by attending to (i.e., paying attention to) all other words in the same sentence.
- The decoder's upper multi-head attention layer is where the decoder pays attention to the words in the English sentence. This is called cross-attention, not self-attention in this case. For example, the decoder will probably pay close attention to the word "**soccer**" when it processes the word "**el**" and transforms its representation into a representation of the word "**fútbol**".

("encoder" is dark red, not italic; "self-attention" is dark-red italic; "cross-attention" is plain black. soccer / el / fútbol are dark red inside black quotes. No figure on this slide.)

---

## Slide 41 — The Original Transformer Architecture (cont.)

### Summary

#### Left — figure

> **Figure 16-8.** The same figure as on slides 30–31 (the PDF reuses the identical embedded image): encoder stack (left, "N×") and decoder stack (right, "N×") with "Input Embedding"/"Output Embedding", the ⊕ "Positional Encoding" adders, "Multi-Head Attention", "Masked Multi-Head Attention", the "Add & Norm" and "Feed Forward" boxes, then "Linear" → **light-green "Softmax"** → "Output Probabilities". Arrow routing is as described on slide 30.

*Caption:* Figure 16-8. The original 2017 transformer architecture

#### Right — text

- The decoder uses a starting token (e.g., $\langle\text{SOS}\rangle$) as the prompt. After the first word is predicted, the masking on the first target word is removed and **the entire network is run again to predict the second word using the first word**. This process is repeated until the network outputs (or learns to output) the ending token ($\langle\text{EOS}\rangle$).
- The green **softmax** layer have many neurons (corresponding to the vocabulary size of the target language). ***Beam search*** (not covered in the unit) is often used to help the network focus on those words having high probabilities.

($\langle\text{SOS}\rangle$ and $\langle\text{EOS}\rangle$ are blue: angle brackets around upright sans-serif letters. "the entire network is run again to predict the second word using the first word" is **black bold**. "softmax" is dark red, not italic; "Beam search" is dark-red italic.)

---

## Slide 42 — The Original Transformer Architecture (cont.)

#### Left — figure

> **Figure (slide 42, unnumbered).** A copy of Figure 16-8 extended by hand to two layers. The **lower half** is the original raster figure: "Inputs" → pink "Input Embedding" → ⊕ with sine-wave "Positional Encoding" (left) → grey encoder layer 1 (orange "Multi-Head Attention", "Add & Norm", light-blue "Feed Forward", "Add & Norm"). Beside it, "Outputs (shifted right)" → pink "Output Embedding" → ⊕ with "Positional Encoding" (right) → grey decoder layer 1 ("Masked Multi-Head Attention", "Add & Norm", "Multi-Head Attention", "Add & Norm", "Feed Forward", "Add & Norm"). Its internal arrows and skip connections are as on slide 30. **No "N×" labels are visible.** The lavender "Linear" and light-green "Softmax" boxes have been moved to the very top of the decoder column. A plain arrow leaves "Softmax" upward, with no "Output Probabilities" label.
> The **upper half** is hand-drawn in black, sketch-style strokes: wobbly outlines, white (unfilled) boxes, hand-lettered labels (see the annotation below).
> - **Encoder layer 2** (above encoder layer 1): a hand-drawn rounded outline holding, bottom to top, "Multi-Head Attention", "Add & Norm", "Feed Forward", "Add & Norm". The output line from encoder layer 1's top "Add & Norm" rises straight into it and fans into three arrows into the bottom of "Multi-Head Attention". A branch runs left and up the inside left edge into the lower "Add & Norm" (skip). A second skip runs from between the lower "Add & Norm" and "Feed Forward" up the left edge into the upper "Add & Norm".
> - **Encoder layer 1 → decoder layer 1:** from the line between encoder layer 1 and encoder layer 2, the original printed connection branches right, drops down the gap between the stacks, and enters decoder layer 1's (orange) "Multi-Head Attention" as its **left and middle arrows**. The **right arrow** comes from decoder layer 1's masked-attention "Add & Norm", as in Figure 16-8.
> - **Decoder layer 2** (above decoder layer 1): a hand-drawn outline holding, bottom to top, "Multi-Head Attention", "Add & Norm", "Feed Forward", "Add & Norm". There is **no "Masked Multi-Head Attention" sub-layer** in it. Three hand-drawn arrows enter the bottom of its "Multi-Head Attention". The **left and middle arrows come from encoder layer 2's output**: a hand-drawn line rises from the top of encoder layer 2, runs right above it, drops down the gap and turns right under the attention box. The **right (third) arrow comes from decoder layer 1's output**: the line from decoder layer 1's top "Add & Norm" rises and curves right into the third position. It also branches right and up the inside right edge into the right side of the lower "Add & Norm" (skip). A second skip runs from between the lower "Add & Norm" and "Feed Forward" up the right inside edge into the upper "Add & Norm". From the top of decoder layer 2 an arrow rises into "Linear", then "Softmax", then up.

> **Handwritten annotation (slide 42).** The only handwriting is the labels inside the hand-drawn second layers; there are no free-standing notes, and the "$N = 2$" in the caption is typeset, not handwritten. Encoder layer 2 reads, bottom to top: "Multi-Head Attention", "Add & Norm", "Feed Forward", "Add & Norm". Decoder layer 2 reads, bottom to top: "Multi-Head Attention", "Add & Norm", "Feed Forward", "Add & Norm". The lettering is rounded and hand-drawn, in dark olive/brown, with "Feed Forward" in a blue-grey. In "Multi-Head Attention" the "lt" and "tt" strokes run together, so it looks like "Muli-Head Ahenlion". The "&" looks like an "8" ("Add 8 Norm"). In decoder layer 2, "Forward" looks like "Forwerd". The PDF's text layer holds stray, invisible OCR-like tokens for this drawing ("E I", "ii", "Ma", "Mao"); these are not on the visible slide.

*Caption:* The transformer architecture with $N = 2$

#### Right — text

### Summary (cont.)

- At the inference stage, there is nothing going into the decoder part except for the $\langle\text{SOS}\rangle$ prompt. After the first word is predicted, it is used as input to the decoder. After the second word is predicted, it is appended to the first word. So, the input to the decoder has two words. This process is repeated until the $\langle\text{EOS}\rangle$ is output.

(The sub-heading sits at the top of the right column. $\langle\text{SOS}\rangle$ and $\langle\text{EOS}\rangle$ are blue. The caption is plain black text with a blue $N = 2$ and no figure number.)

---

## Slide 43 — The Original Transformer Architecture (cont.)

### Implementation using Keras

Keras includes a `tf.keras.layers.MultiHeadAttention` layer, so we now have everything we need to build the rest of the transformer.

```python
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
    Z = attn_layer(Z, value=Z, attention_mask=encoder_pad_mask)

    # ... add in other layers as shown in Figure 16-8
```

(From a 400-dpi crop: the first line is `N = 2` with spaces around `=`, and its comment starts in the same column as the `n_units` comment. The loop body is indented 4 spaces and the `num_heads=...` continuation 8. There is a blank line before the final comment, which is indented inside the loop. The `encoder_pad_mask` line's closing `]` sticks out past the right edge of the grey box. The code stops after the first attention sub-layer.)

---

## Slide 44 — Vision Transformers

### Image captioning using visual attention

One of the first applications of attention mechanisms beyond NMT was in generating ***image captions*** using ***visual attention***<sup>9</sup>: a convolutional neural network first processes the image and outputs some feature maps, then a decoder RNN equipped with an attention mechanism generates the caption, one word at a time.

At each decoder time step (i.e., each word), the decoder uses the attention model to focus on just the right part of the image.

**Footnotes:**

9. Kelvin Xu et al., "Show, Attend and Tell: Neural Image Caption Generation with Visual Attention", Proceedings of the 32nd International Conference on Machine Learning (2015): 2048-2057.

("image captions" and "visual attention" are dark-red italic. The footnote's page range uses a hyphen, not an en dash.)

---

## Slide 45 — Vision Transformers (cont.)

### Image captioning using visual attention (cont.)

For example, in Figure 16-12, the model generated the caption "**A woman is throwing a frisbee in a park**", and you can see what part of the input image the decoder focused its attention on when it was about to output the word "**frisbee**": clearly, most of its attention was focused on the frisbee.

> **Figure 16-12.** Two photographs of the same outdoor scene side by side. *Left (input image):* a sunny park with green grass, a band of trees and a pond in the background. A woman in a green top and light-green trousers stands on the left, mid-throw, with one arm out. A red/orange frisbee is in the air at the upper left, level with her head. A small child in a magenta top and patterned trousers stands at the lower right. *Right (the model's focus):* the same image, darkened and desaturated almost everywhere. A soft-edged bright region at the upper left covers the frisbee and extends down over the woman's head and upper body on the left side. The rest of the scene, including the child, is dimmed.

*Caption:* Figure 16-12. Visual attention: an input image (left) and the model's focus before producing the word "frisbee" (right)

(The caption sentence and "frisbee" are dark red inside black quotes.)

---

## Slide 46 — Vision Transformers (cont.)

### The original vision transformer

In October 2020, a team of Google researchers released a paper<sup>10</sup> that introduced a fully transformer-based vision model, called a ***vision transformer*** (**ViT**). The idea is surprisingly simple:

- Just chop the image into little $16 \times 16$ squares, and treat the sequence of squares as if it were a sequence of word representations.
- The squares are first flattened into $16 \times 16 \times 3 = 768$-dimensional vectors – the value $3$ is for the RGB colour channels.
- These vectors then go through a linear layer that transforms them but retains their dimensionality. The resulting sequence of vectors can be treated as a sequence of word embeddings: i.e., adding positional embeddings, and passing the result to the transformer.

This model beat the state of the art on **ImageNet** image classification, but required over $300$ million additional images for training. This makes sense since transformers don't have as many inductive biases as CNNs, so they need extra data just to learn things that CNNs implicitly assume.

**Footnotes:**

10. Alexey Dosovitskiy et al., "An Image Is Worth 16x16 Words: Transformers for Image Recognition at Scale", arXiv preprint arxiv:2010.11929 (2020).

("vision transformer" is dark-red italic; "ViT" and "ImageNet" are dark red, not italic. "300 million" is blue (maths 300 plus blue text "million"). The footnote rule runs directly under "they need extra data just to l…", so it looks like an underline. No input image size is given anywhere on the slide.)

---

## Slide 47 — Vision Transformers (cont.)

(Materials from this slide onward are not covered in the exam)

### Other related papers

- The research field quickly expanded. Just two months later, a paper<sup>11</sup> that introduced ***data-efficient image transformers*** (**DeiTs**) was released from a team of Facebook, where the authors used a ***distillation*** technique to reduce the number of training images required.
- Then in March 2021, DeepMind released an important paper<sup>12</sup> that introduced the ***Perceiver*** architecture – a multimodal transformer, which can handle text, images, audio, etc.
- Just a month later, Caron et al. introduced ***DINO***<sup>13</sup>, an impressive vision transformer trained entirely without labels and capable of high-accuracy semantic segmentation.

**Footnotes:**

11. Hugo Touvron et al., "Training Data-Efficient Image Transformers & Distillation Through Attention", arXiv preprint arxiv:2012.12877 (2020).
12. Andrew Jaegle et al., "Perceiver: General Perception with Iterative Attention", arXiv preprint arxiv:2103.03206 (2021).
13. Mathilde Caron et al., "Emerging Properties in Self-Supervised Vision Transformers", arXiv preprint arxiv:2104.14294 (2021).

(The exam note is small plain black text above the sub-heading. "data-efficient image transformers", "distillation", "Perceiver" and "DINO" are dark-red italic; "DeiTs" is dark red, not italic.)

---

## Slide 48 — Vision Transformers (cont.)

### Other related papers (cont.)

- A **2021 paper**<sup>14</sup> from Google showed how to scale ViTs up or down, depending on the amount of data. They managed to create a huge $2$ billion parameter model that reached over $90.4\%$ top-1 accuracy on ImageNet. Conversely, they also trained a scaled-down model that reached over $84.8\%$ top-1 accuracy on ImageNet, using only $10,000$ images: that's just $10$ images per class!
- In April 2022, DeepMind released the ***Flamingo paper***<sup>15</sup>, which introduced a family of models pretrained on a wide variety of tasks across multiple modalities, including text, images, and videos.
- Then in May 2022, DeepMind introduced ***GATO***<sup>16</sup>, a multimodal model that can be used as a policy for a **reinforcement learning** agent.

**Footnotes:**

14. Xiaohua Zhai et al., "Scaling Vision Transformers", arXiv preprint arxiv:2106.04560v1 (2021).
15. Jean-Baptiste Alayrac et al., "Flamingo: a Visual Language Model for Few-Shot Learning", arXiv preprint arxiv:2204.14198 (2022).
16. Scott Reed et al., "A Generalist Agent", arXiv preprint arxiv:2205.06175 (2022).

("2021 paper" and "reinforcement learning" are dark red, not italic; "Flamingo paper" and "GATO" are dark-red italic. "2 billion", "90.4%", "84.8%", "10, 000" and "10" are blue. The ten thousand is typeset as maths **"10, 000"**, with a space after the comma.)

---

## Slide 49 — Hugging Face's Transformers Library

It's impossible to talk about transformers today without mentioning **Hugging Face**, an AI company that has built a whole ecosystem of easy-to-use open source tools for NLP, vision, and beyond.

The central component of their ecosystem is the Transformers library, which allows you to easily download a pretrained model, including its corresponding tokenizer, and then fine-tune it on your own dataset, if needed. Plus, the library supports TensorFlow, PyTorch, and JAX (with the Flax library).

Hugging Face has also built a Datasets library (similar to the TensorFlow Datasets) that you can use to easily download a standard dataset (such as IMDb) or a custom one, and use it to fine-tune your model.

(Unfortunately, we don't have room to include this library in the unit)

(Only the first "Hugging Face" is dark red; the later one is plain black.)

---

## Slide 50 — Summary

- Understand the encoder-decoder networks for neural machine translation
- Understand bidirectional RNNs and LSTMs
- Understand attention mechanisms and the differences between additive attention and multiplicative attention
- Know how to implement attention mechanisms using Keras
- Understand visual attention
- Understand transformers and vision transformers

---

## Slide 51 — For the next topic...

Read up to Chapter 18 on **Reinforcement Learning**.

And that's all for this lecture.

Have a good week.

---

---

## Quirks

Things on the slides that look wrong, inconsistent or ambiguous. They are recorded here and **not** fixed in the transcript above.

- **Slide 2:** "Chapters 16." uses a plural for a single chapter. The slide text writes "Hands-on" (lowercase "on"), while the cover reads "Hands-On".
- **Slide 4 (Figure 15-4):** In the top-left (sequence-to-sequence) panel, the first output is labelled $Y_{(0)}$ with no hat, while every other output in all four panels has a hat, and the first input looks like a lowercase $x_{(0)}$ while the others are capital $X$. Footnote 1 is in bright red rather than the deck's dark red or black.
- **Slide 5:** "E.g., input: English sentences; output: Spanish sentences)." has a closing parenthesis with no opening one.
- **Slide 6:** Footnote 2, "For example, as Word2Vec, …, or fastText, etc.", has an extra "as" and uses both "For example" and "etc.". "e.g., consider the phrases …" starts a paragraph with lowercase "e.g.".
- **Slide 8:** `encoder_embeddings` is used but not defined on any slide in this range. The comments have no space after "#" ("#short-term", "#long-term"), and both run past the edge of the code box.
- **Slide 9:** `InputLayer(input_shape=[None, 2])` uses the `input_shape=` keyword. The earlier decks (e.g. Topic 5, `InputLayer(shape=[28,28])`) and slide 14 of this deck (`tf.keras.Input(shape=...)`) use `shape=`. The comment gives the shape of `y_train_1` (`(1027,2)`), but `fit` is called with `y_train`, while `validation_data` uses `y_valid_1`. Slides 15 and 17 then use `y_train` and `y_valid` as the 14-day targets of `rnn_ed`. `PrintEpochLossCallback` and `Nepochs` are used here and on slide 15 but never defined. `verbose = 0` has spaces around "=", unlike `verbose=0` on slides 10, 15 and 17. The "# 674 trainable params" comment checks out: each direction of the SimpleRNN has 16 × (2 + 16 + 1) = 304 parameters, so two directions have 608, and Dense(2) on the 32-dimensional concatenation adds 32 × 2 + 2 = 66, giving 674.
- **Slide 10:** The code compares the predictions with `y_valid`, while the model on slide 9 was validated against `y_valid_1`. "27, 936" is typeset with a space after the comma, but "27,855" has none. "the days of the weeks" uses a plural "weeks". "(i.e., 5 input features)" means (bus, rail) plus a 3-way one-hot encoding, but the slide does not say so.
- **Slide 11:** The chart has no figure number and no units. Footnote 3 says "the whole test set", while the slide (and the line under the chart) uses the validation set `X_valid`. The `for`-loop code the slide refers to is not shown; it points to Topic 4, slide 34/52.
- **Slide 12:** "the Decoder's inputs comprise of …" ("comprise" does not take "of"). The handwriting writes "y-train" with a mid-height hyphen-like stroke (the code name is `y_train`). The diagram's labels use "Day 55", while the text writes "the last day from `X_train`" without a day number.
- **Slides 12–13 vs slide 14:** The red handwriting says `X_train`/`X_test` has 56 days of data, and the Encoder sees 55 of them (Day 0–54). The code comment on slide 14, however, says the decoder predicts "14 days after the input 56 days", while the comment above it says the encoder takes "(55 days)". The 56 days are the 55 encoder days plus Day 55, which goes to the decoder.
- **Slide 13:** The text says the Decoder's inputs at the other timesteps "are unknown (so we set them to 0)", but the diagram shows no zeros: each "Estimated" output is fed back as the next input. The text's last sentence describes the feedback, but the diagram does not show the initial zeros. The slide says "day 55" (lowercase) where the diagram says "Day 55". The slide talks about `X_test` ("TESTING STAGE"), but the code on slide 17 runs on `X_valid`. "of `X_test`, (i.e., …)" has a stray comma before the parenthesis. The "TESTING STAGE" label box overlaps the title bar, unlike the "TRAINING STAGE" box on slide 12.
- **Slide 14:** The encoder input uses `tf.keras.Input` while the decoder input uses `tf.keras.layers.Input`; both work, but they are inconsistent. The encoder uses `inputs_dim` for its shape, but the decoder uses a literal `2`. No parameter count is given for `rnn_ed`.
- **Slide 15:** `X_train_decode` and `X_valid_decode` are never defined on any slide; slide 12 only describes them in words. `monitor='val_loss'` uses single quotes, while slide 9 uses `monitor="val_loss"`.
- **Slide 16:** The code sets `plt.title('Learning curves')`, but the plotted chart's title is "biRNN Encoder-Decoder". The chart has no y-axis label.
- **Slide 17:** The function's body is elided: the `for` loop contains only a comment ("# call model.predict(...) and update decoder_ins and outseq"), which is not valid Python as shown. The call passes `model`, but the trained model is named `rnn_ed` (slides 14–15). The call passes `out_seq_length`, but the parameter is named `outseq_len` and `out_seq_length` is never defined. The comments say `X_val`, while the variable is `X_valid`. The comments also say `X_test`, while the slide evaluates the validation set. The output "Validation set MAE =  34,863.8857" has two spaces after "=". The format `{:11,.4f}` applied to 34,863.8857 (exactly 11 characters) would print only one. The `r` prefix on the format string is unnecessary. "multi-task predictions" presumably means multi-step (14-day) predictions.
- **Slide 18:** "a representation of this word (along with all needs to be carried over many steps" is missing words and the closing parenthesis. Géron's text has "(along with all the other words)". Figure 16-3 is repeated from slide 5.
- **Slide 19:** "e.g., at the time step …" starts a sentence with lowercase "e.g.". Footnote 4 has no closing full stop.
- **Slides 20–23 (Figure 16-7):** The word above $\hat{\mathbf{y}}'_{(3)}$ is printed as "fútbol with no closing quotation mark. The encoder's outputs are drawn with hats ($\hat{\mathbf{y}}_{(0)}$–$\hat{\mathbf{y}}_{(2)}$), but the alignment model and footnote 5 call the same vectors $\mathbf{y}_{(0)}$–$\mathbf{y}_{(2)}$ without hats. The figure is repeated on four slides.
- **Weight and score notation (slides 20–25):** The weights appear as $\alpha(t, i)$, $\alpha(3, 2)$ in the text of slides 21–22 (baseline parentheses), as subscripts $\alpha_{(3,0)}$ in the figure, and as $\alpha_{(3,2)}$ and $\alpha_{(t,i)}$ in the text of slides 23 and 25. The scores appear as a bold $\mathbf{e}_{3,i}$ (no parentheses) on slide 22, an italic $e_{(3,2)}$ on slide 23, $e_{(3,0)}$ in the figure and $e_{(t,i)}$ on slide 25.
- **Slide 21:** "e.g., if, at time step 3, …" again starts lowercase.
- **Slide 22:** "the three cores are then converted into probabilities" — "cores" is a typo for "scores". "The blue Dense layer" refers to the colour of the box in the figure. Footnote 5 starts with a lowercase "vector".
- **Slide 23:** "me gusta el" is glossed as meaning "I like", which leaves the article "el" ("the") untranslated. This follows Géron's wording.
- **Slide 24:** "by Luong et al<sup>6</sup>." is missing the full stop of "al.". The statement that the only constraint is that "these vectors must be of the same length" applies to the plain dot product. The "general" variant on slide 25 ($\mathbf{h}^{\top}\mathbf{W}\mathbf{y}$) does not by itself need equal lengths, and the slide does not say so.
- **Slide 25:** $\widetilde{\mathbf{h}}_{(t)}$ is defined by the equation but never named or explained in words on the slide. "tanh" is set in upright sans-serif, while "exp" is in roman type. "Three variants of Luong attention mechanism" and "the concat variant of Luong attention mechanism" lack an article ("the … mechanism").
- **Slide 26:** In the first code box the continuation line `tf.keras.layers.LSTM(...))` is not indented. With `return_state=True` the bidirectional encoder also returns states, but the slide never shows how its outputs are unpacked. `decoder_outputs`, `encoder_outputs` and `vocab_size` are not defined on slides 26–51. The comment `# default: score_mode="dot"` overflows the grey code box. "Attention layer" is plain text in one sentence and `Attention` (typewriter) in another.
- **Slide 27:** The example sentence is "I like soccer", with the subject "I" and the verb "like". But the illustrative dictionary is `{"subject": "They", "verb": "played", ...}`, which doesn't match the sentence. All the dictionary's quotation marks are typeset as closing quotes.
- **Slide 28:** It says the layer's inputs are `[queries, keys]` with an optional third input, and that "If the *values* input is not provided, then it is treated as equal to the *keys* input". Keras's own documentation for `tf.keras.layers.Attention` names the list `[query, value, key]`, with key defaulting to value. `MultiHeadAttention` (slide 43) likewise defaults `key` to `value`. Since keys = values here, the result is the same; only the naming and the direction of the default differ.
- **Slide 29:** Footnote 7's paper title is cut off: "Attention Is All You Nee" (the body text has the full "Attention Is All You Need"). "etc)" has no full stop. The slide writes "state-of-the-art" with hyphens, while slide 46 writes "state of the art".
- **Slide 30:** "multi-header attention" should be "multi-head attention" (the figure and slide 31 say "Multi-Head"). The tensor shape is written "[batch size, sequence length, embedding size]", not "max sequence length". The text says "Addition and Normalisation layers", while the boxes say "Add & Norm".
- **Slide 31 (with Figures 16-8 and 16-10):** "The first two arrows … represent the keys and values, and the third arrow represents the queries". This can only be seen in the decoder's upper attention block, where the left two arrows come from the encoder and the right one from the decoder. In the self-attention blocks all three arrows branch from one line. The slide doesn't say which of the first two is keys and which is values. Figure 16-10 orders its inputs V, K, Q from left to right, which would make the first arrow the values.
- **Slide 32 vs slide 35:** The formula uses base **1000**: $\sin(p/1000^{i/d})$ and $\cos(p/1000^{(i-1)/d})$. The code on slide 35 uses **`10_000`**: `p / 10_000 ** (i / embed_size)`. These disagree by a factor of 10 in the base.
- **Slide 32:** The letter $i$ is used in two senses. First, "the $i^{\text{th}}$ positional encoding is added to the word embedding of the $i^{\text{th}}$ word", where $i$ is a position. Then, in the formula, $i$ is the embedding component and $p$ is the position. $d$ is defined as "the dimension of the keys, values, and queries vectors", but the code uses `embed_size`, and slides 37–38 give keys and values separate dimensions ($d_{\text{keys}}$, $d_{\text{values}}$). "Transformer" is capitalised here but lowercase elsewhere.
- **Slide 33:** Nothing on the slide explains Figure 16-9's markers: the dashed lines at $p = 22$ and $p = 60$, the dots, or the × at $p = 35$. The value of $d$ used for the plot isn't given either, so the plot cannot be checked against slide 32's formula.
- **Slide 34:** One library goes by three names: `tfm` (the alias in the text), `tensorflow_models` (the text) and `tf-models-official` (the footnote's pip package). "TensorFlow provides" a layer that needs a separate, "very large" install.
- **Slide 35:** `np` (NumPy) is used, but `import numpy as np` doesn't appear on slides 26–51. The `def __init__` line overflows the code box.
- **Slide 36:** "adding the positional encoding to the encoder's outputs" — the code adds it to `encoder_embeddings`, which is the encoder's *input*, not its output. "The code for the embedding on the decoder part of the network is similar" follows code that already includes the decoder line (`decoder_in = …`). `max_length`, `embed_size`, `encoder_embeddings` and `decoder_embeddings` are not defined on slides 26–51.
- **Slide 38:** The equation divides by $\sqrt{d_{\text{keys}}}$, but the bullet says "The factor $1/d_{\text{keys}}$ scales down the similarity scores", with no square root.
- **Slide 39:** "are 3D tensor" (singular). "All the matrix multiplications can be done efficiently in Python": the work is done by TensorFlow's tensor operations, not plain Python. "axis 0 is the minibatch size": axis 0 indexes the instances, and its length is the batch size. "they are split (yellow box)" uses the singular, but there are three yellow Split boxes. "different characters of the words" probably means "characteristics". "not only the word 'like' is a verb, it is also in present tense" is awkward grammar.
- **Slide 39 vs slide 43:** Slide 39 says V, K and Q are *split* into $H$ parts. The code on slide 43 uses `key_dim=embed_size` with `num_heads=8`. In Keras, `key_dim` is the size of *each* head, so each head is not a 1/8 split of the embedding.
- **Slide 40:** "self-attention" is highlighted in dark-red italic, but its counterpart "cross-attention" is plain text.
- **Slide 41:** "The green softmax layer have many neurons" should be "has". The first bullet describes masking being "removed" word by word and "the entire network is run again", which reads like inference-time generation. Slide 31 describes masking as a causal mask, and slide 42 describes inference separately. "(or learns to output)" leaves it unclear whether this is training or inference.
- **Slide 42:** The hand-drawn decoder layer 2 has **no Masked Multi-Head Attention sub-layer** (or its Add & Norm), unlike decoder layer 1. The drawing wires encoder layer 1 into decoder layer 1's cross-attention and encoder layer 2 into decoder layer 2's. The slides never say which encoder output each decoder layer uses; in Vaswani et al. (2017) every decoder layer attends to the *final* encoder output. The "N×" labels of Figure 16-8 are gone, and there is no "Output Probabilities" label. The figure has no number. In the hand lettering, "Multi-Head Attention" looks like "Muli-Head Ahenlion", "&" looks like "8", and decoder layer 2's "Forward" looks like "Forwerd". The text layer contains invisible junk tokens ("E I", "ii", "Ma", "Mao").
- **Slide 43:** The code is a partial sketch, and only the first attention sub-layer is shown. `skip = Z` is assigned but not used in the visible code. `n_units` is defined but unused. `encoder_input_ids` and `embed_size` are not defined on slides 26–51 (`encoder_in` comes from slide 36). The `encoder_pad_mask` line overflows the code box. The comment "# instead of 6" agrees with slide 30's $N = 6$.
- **Slide 44:** The section is titled "Vision Transformers", but the model described (a CNN followed by an RNN decoder with attention) isn't a transformer. Footnote 9's page range "2048-2057" uses a hyphen; footnote 7 uses an en dash.
- **Slide 45:** Figure numbering jumps from 16-10 (slides 37–39) to 16-12. No Figure 16-11 appears on slides 26–51.
- **Slide 46:** No input image size is given, so the number of $16 \times 16$ patches can't be worked out. The footnote rule overlaps the last body line, so it looks like an underline. The footnote title writes "16x16" with a letter x. In footnotes 10–16 the identifier is written "arxiv:" in lowercase after "arXiv preprint".
- **Slide 47:** "released from a team of Facebook" is odd phrasing. "(Materials from this slide onward are not covered in the exam)" literally also covers slides 48–51, including the Summary (slide 50). "Just two months later" (after October 2020) and "Just a month later" (after March 2021) agree with the arXiv numbers 2012.12877 and 2104.14294.
- **Slide 48:** "10, 000" is typeset with a space after the comma (a maths-mode comma). "10,000 images … just 10 images per class" implies 1,000 classes, which the slide doesn't state. Footnote 14 alone carries a version suffix ("2106.04560v1").
- **Slide 50:** The Summary uses "additive attention and multiplicative attention", while slide 26 names the layers by author ("Luong attention", "Bahdanau attention"). The two naming schemes are never linked in slides 26–51. Positional encodings and multi-head attention have no outcome of their own; they come under "Understand transformers".
