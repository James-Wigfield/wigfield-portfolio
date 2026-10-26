import { w, eq, tbl, fig, slip } from './ink.js';

/* ============================================================================
   EXAM PRACTICE — PRACTICE PAPER C (written for this page, the harder one)
   ----------------------------------------------------------------------------
   Four questions × 20 marks in the sample paper's format
   (tools/dl-exam-practice/format-spec.md), planned in coverage.md. Paper C
   leans on what A and B leave out and on the asks the slides make easy to
   set as calculations: a Perceptron update, Glorot/He variances, learning-rate
   schedules, 5 × 5 vs two 3 × 3 kernels, inception depth, GRU gates,
   14-day-ahead forecasting, one-autoencoder-at-a-time, the GAN training loop,
   ResNet, positional encodings, the bus/rail encoder–decoder, multi-head
   attention, policy search, TD learning and Q-value iteration. Q1 L1–L3 ·
   Q2 sequences (L4, with L3 and L2) · Q3 L5, L6–7, L3, L8 · Q4 L8, L4, L9.
   Every count, shape and number is verified in TensorFlow / NumPy by
   tools/dl-exam-practice/verify_counts.py ("C Q…" lines).
   ========================================================================== */

const R = String.raw;

export const PAPER_C = {
  id: 'C',
  name: 'Practice Paper C',
  tab: 'Practice paper C',
  head: 'Practice Exam Paper C 2026',
  pages: 20,
  cover: {
    contains: 'This practice exam paper contains: **20** pages **(including title page)**',
    instructions: [
      'This paper contains 4 questions, each is worth 20 marks. **Total : 80 marks**.',
      'The duration of the exam is 2 hours.\nIt is a **closed book** exam.',
      'Candidate should attempt ALL questions.',
      'Answers are to be written on this question paper in the spaces provided.',
    ],
    materialsLead: 'Materials permitted:',
    materials: ['1 UWA approved calculator with sticker.'],
    note: 'Written for this portal from the CITS5017 lecture slides, in the sample paper\'s format, with more calculation and code parts than Papers A and B. Not an official paper.',
  },
  questions: [
    /* ── Question 1 · L1, L2, L3 ─────────────────────────────────────────── */
    {
      id: 'c-q1',
      n: 1,
      parts: [
        {
          id: 'c-q1-a',
          label: '(a)',
          page: 2,
          lines: 13,
          source: 'new',
          prompt: [
            R`A Perceptron with a single threshold logic unit (TLU) has two inputs $x_1$ and $x_2$, connection weights $w_1 = 0.5$ and $w_2 = -0.4$, and a bias $b = -0.1$. The TLU applies the Heaviside step function: $\text{heaviside}(z) = 0$ if $z < 0$ and $1$ if $z \ge 0$. It is trained with the Perceptron learning rule`,
            { eq: R`w_{i,j}^{(\text{next step})} = w_{i,j} + \eta\,(y_j - \hat{y}_j)\,x_i` },
            R`with learning rate $\eta = 0.5$; the bias is updated in the same way, as the weight of an extra input that is always 1. The next training instance is $(x_1, x_2) = (1, 2)$ with target $y = 1$.`,
          ],
          subs: [
            {
              id: 'c-q1-a-i',
              label: 'i.',
              marks: 1,
              source: 'new',
              prompt: ['Compute the output of the TLU for this instance.'],
              topics: [
                { lec: 'L1', slides: [4, 8], name: 'TLUs and computing the outputs' },
              ],
              answer: [
                w(R`$z = 0.5 \times 1 + (-0.4) \times 2 + (-0.1) = -0.4 < 0$, so $\hat{y} = \text{heaviside}(-0.4) =$ **0**.`, 1),
              ],
              difficulty: 1,
              likelihood: 'medium',
            },
            {
              id: 'c-q1-a-ii',
              label: 'ii.',
              marks: 2,
              source: 'new',
              prompt: ['Apply the learning rule once and give the new weights and bias. Does the TLU now classify this instance correctly?'],
              topics: [
                { lec: 'L1', slides: [9, 10], name: 'The Perceptron learning rule' },
              ],
              answer: [
                w(R`$y - \hat{y} = 1 - 0 = 1$, so each weight moves by $\eta \times 1 \times x_i$:`),
                eq(R`w_1 = 0.5 + 0.5 \times 1 \times 1 = 1.0`),
                eq(R`w_2 = -0.4 + 0.5 \times 1 \times 2 = 0.6`),
                eq(R`b = -0.1 + 0.5 \times 1 \times 1 = 0.4`, 1),
                w(R`Now $z = 1.0 \times 1 + 0.6 \times 2 + 0.4 = 2.6 \ge 0$, so the output is 1: **correct**.`, 1),
                slip(R`forgetting the factor $x_i$: $w_2$ moves by $\eta \times 1 \times 2 = 1.0$, twice as far as $w_1$. When the prediction is right, $y - \hat{y} = 0$ and nothing changes.`),
              ],
              difficulty: 2,
              likelihood: 'medium',
            },
            {
              id: 'c-q1-a-iii',
              label: 'iii.',
              marks: 1,
              source: 'new',
              prompt: ['Under what condition is the Perceptron training algorithm guaranteed to converge to a solution?'],
              topics: [
                { lec: 'L1', slides: 12, name: 'The Perceptron convergence theorem' },
              ],
              answer: [
                w('If the training instances are **linearly separable** (the Perceptron convergence theorem, Rosenblatt); the solution is generally not unique.', 1),
              ],
              difficulty: 2,
              likelihood: 'medium',
            },
          ],
        },
        {
          id: 'c-q1-b',
          label: '(b)',
          page: 3,
          lines: 10,
          source: 'new',
          prompt: [R`A dense layer has 200 inputs and 100 neurons, so $\text{fan}_\text{in} = 200$ and $\text{fan}_\text{out} = 100$.`],
          subs: [
            {
              id: 'c-q1-b-i',
              label: 'i.',
              marks: 2,
              source: 'new',
              prompt: [R`The layer uses the logistic activation function and Glorot initialization. Compute the variance $\sigma^2$ of the normal distribution, and the limit $r$ of the uniform distribution over $[-r, +r]$, that Glorot initialization uses for this layer.`],
              topics: [
                { lec: 'L2', slides: [5, 7], name: 'Glorot initialization' },
              ],
              answer: [
                eq(R`\text{fan}_\text{avg} = (200 + 100)/2 = 150`),
                eq(R`\sigma^2 = \frac{1}{\text{fan}_\text{avg}} = \frac{1}{150} \approx 0.00667`, 1),
                eq(R`r = \sqrt{\frac{3}{\text{fan}_\text{avg}}} = \sqrt{0.02} \approx 0.1414`, 1),
              ],
              difficulty: 2,
              likelihood: 'medium',
            },
            {
              id: 'c-q1-b-ii',
              label: 'ii.',
              marks: 1,
              source: 'new',
              prompt: [R`If the layer used the ReLU activation function instead, which initialization should it use, and what would $\sigma^2$ be?`],
              topics: [
                { lec: 'L2', slides: [8, 9], name: 'He initialization' },
              ],
              answer: [
                w(R`**He** initialization: $\sigma^2 = 2 / \text{fan}_\text{in} = 2 / 200 = 0.01$ ($\sigma = 0.1$), e.g. ` + '`kernel_initializer="he_normal"`.', 1),
                slip(R`using $\text{fan}_\text{avg}$ for He initialization: He uses $\text{fan}_\text{in}$ (Glorot uses $\text{fan}_\text{avg}$, LeCun $1/\text{fan}_\text{in}$).`),
              ],
              difficulty: 2,
              likelihood: 'medium',
            },
          ],
        },
        {
          id: 'c-q1-c',
          label: '(c)',
          marks: 6,
          page: 4,
          lines: 21,
          source: 'new',
          prompt: [
            'The Keras code below builds a regression model for a housing data set. Five of the features go through the wide path and six through the deep path:',
            {
              code: `input_wide = tf.keras.layers.Input(shape=[5])
input_deep = tf.keras.layers.Input(shape=[6])
norm_wide = tf.keras.layers.Normalization()(input_wide)
norm_deep = tf.keras.layers.Normalization()(input_deep)
hidden1 = tf.keras.layers.Dense(20, activation="relu")(norm_deep)
hidden2 = tf.keras.layers.Dense(10, activation="relu")(hidden1)
concat = tf.keras.layers.concatenate([norm_wide, hidden2])
output = tf.keras.layers.Dense(1)(concat)
aux_output = tf.keras.layers.Dense(1)(hidden2)
model = tf.keras.Model(inputs=[input_wide, input_deep],
                       outputs=[output, aux_output])
model.compile(loss=("mse", "mse"), loss_weights=(0.9, 0.1),
              optimizer="adam")`,
            },
            'Draw a diagram of the model, showing the output shape of each layer. Compute the number of trainable parameters of each layer and of the whole model. Explain why the model has a second output, `aux_output`, and what `loss_weights=(0.9, 0.1)` does.',
          ],
          topics: [
            { lec: 'L1', slides: [43, 44], name: 'The functional API' },
            { lec: 'L1', slides: [46, 47], name: 'Multiple inputs and outputs' },
          ],
          answer: [
            fig('cWideAux', 'Diagram: Input [5] → Normalization (None, 5) → Concat; Input [6] → Normalization (None, 6) → Dense 20, ReLU (None, 20) → Dense 10, ReLU (None, 10), which goes both into Concat (5 + 10 = 15) and into the auxiliary Dense 1 → aux_output (None, 1); Concat → Dense 1 → output (None, 1).', 2),
            tbl(['Layer', 'Output', 'Trainable parameters'], [
              ['Input wide / deep', '(None, 5) / (None, 6)', '0'],
              ['Normalization ×2', '(None, 5) / (None, 6)', '0 (11 + 13 non-trainable)'],
              ['Dense 20', '(None, 20)', R`$6 \times 20 + 20 = 140$`],
              ['Dense 10', '(None, 10)', R`$20 \times 10 + 10 = 210$`],
              ['concatenate', '(None, 15)', '0'],
              ['output: Dense 1', '(None, 1)', R`$15 \times 1 + 1 = 16$`],
              ['aux_output: Dense 1', '(None, 1)', R`$10 \times 1 + 1 = 11$`],
            ], 1),
            w(R`Total trainable: $140 + 210 + 16 + 11 =$ **377**.`, 1),
            w('The auxiliary output sits on the deep path only. The deep branch is more complex, so it is more likely to overfit than the wide branch; its own loss is used for **regularization**.', 1),
            w('`loss_weights=(0.9, 0.1)`: the loss that training minimizes is 0.9 × MSE(output) + 0.1 × MSE(aux_output), so the main output matters most.', 1),
            slip('feeding all 11 features into Dense 20: the deep path starts from the 6 deep features, and Concat joins the 5 normalized wide features with Dense 10\'s 10 outputs (15, not 5 + 20).'),
          ],
          difficulty: 4,
          likelihood: 'high',
        },
        {
          id: 'c-q1-d',
          label: '(d)',
          marks: 3,
          page: 5,
          lines: 10,
          source: 'new',
          prompt: [R`A model is trained with SGD from an initial learning rate $\eta_0 = 0.01$. Compute the learning rate after $t = 30{,}000$ steps under *power scheduling*, $\eta(t) = \eta_0 / (1 + rt/s)^c$ with $c = 1$, $r = 1$ and $s = 10{,}000$; and after $t = 40{,}000$ steps under *exponential scheduling*, $\eta(t) = \eta_0\, r^{t/s}$ with $r = 0.1$ and $s = 20{,}000$. Why can a learning schedule beat a constant learning rate?`],
          topics: [
            { lec: 'L2', slides: [48, 53], name: 'Learning rate scheduling' },
          ],
          answer: [
            eq(R`\text{power: } \eta(30{,}000) = \frac{0.01}{1 + 30{,}000/10{,}000} = \frac{0.01}{4} = 0.0025`, 1),
            eq(R`\text{exponential: } \eta(40{,}000) = 0.01 \times 0.1^{2} = 0.0001`, 1),
            w('Start with a large learning rate and reduce it once training stops making fast progress: you reach a good solution faster than with the optimal constant rate (too high diverges, too low takes very long).', 1),
            slip(R`exponential scheduling divides $\eta$ by $1/r = 10$ every $s$ steps: after $2s$ steps it is $\eta_0 / 100$, not $\eta_0 / 20$.`),
          ],
          difficulty: 3,
          likelihood: 'medium',
        },
        {
          id: 'c-q1-e',
          label: '(e)',
          marks: 4,
          page: 5,
          lines: 11,
          source: 'new',
          prompt: [R`A common mistake in CNN design is to use convolution kernels that are too large. A layer receives 64 feature maps and outputs 64 feature maps. Compute the number of parameters of one convolutional layer with 64 filters of size $5 \times 5$, and of two stacked convolutional layers with 64 filters of size $3 \times 3$ each. Which is better, and for which layer is a large kernel still a good choice?`],
          topics: [
            { lec: 'L3', slides: 22, name: 'Counting conv parameters' },
            { lec: 'L3', slides: 34, name: 'Two 3 × 3 kernels instead of one 5 × 5' },
          ],
          answer: [
            eq(R`5 \times 5: \ (5 \times 5 \times 64 + 1) \times 64 = 102{,}464`, 1),
            eq(R`2 \times (3 \times 3): \ 2 \times (3 \times 3 \times 64 + 1) \times 64 = 73{,}856`, 1),
            w('Two 3 × 3 layers are better: fewer parameters (and fewer computations), and they usually perform better.', 1),
            w('The exception is the **first** convolutional layer: it can use a large kernel (e.g. 5 × 5) with a stride of 2 or more, to reduce the spatial dimensions without losing too much information.', 1),
            slip('forgetting the input depth: each 5 × 5 filter has 5 × 5 × 64 weights (one 5 × 5 slice per input map) plus one bias.'),
          ],
          difficulty: 3,
          likelihood: 'high',
        },
      ],
    },

    /* ── Question 2 · L4, L3, L2 ─────────────────────────────────────────── */
    {
      id: 'c-q2',
      n: 2,
      parts: [
        {
          id: 'c-q2-a',
          label: '(a)',
          page: 6,
          lines: 12,
          source: 'new',
          prompt: [
            'Given below are the computations of a *GRU* cell:',
            { eq: R`\mathbf{z}_{(t)}^{\top} = \sigma\left(\mathbf{x}_{(t)}^{\top}\mathbf{W}_{xz} + \mathbf{h}_{(t-1)}^{\top}\mathbf{W}_{hz} + \mathbf{b}_{z}^{\top}\right)` },
            { eq: R`\mathbf{r}_{(t)}^{\top} = \sigma\left(\mathbf{x}_{(t)}^{\top}\mathbf{W}_{xr} + \mathbf{h}_{(t-1)}^{\top}\mathbf{W}_{hr} + \mathbf{b}_{r}^{\top}\right)` },
            { eq: R`\mathbf{g}_{(t)}^{\top} = \tanh\left(\mathbf{x}_{(t)}^{\top}\mathbf{W}_{xg} + \left(\mathbf{r}_{(t)} \otimes \mathbf{h}_{(t-1)}\right)^{\top}\mathbf{W}_{hg} + \mathbf{b}_{g}^{\top}\right)` },
            { eq: R`\mathbf{h}_{(t)} = \mathbf{z}_{(t)} \otimes \mathbf{h}_{(t-1)} + \left(1 - \mathbf{z}_{(t)}\right) \otimes \mathbf{g}_{(t)}` },
          ],
          subs: [
            {
              id: 'c-q2-a-i',
              label: 'i.',
              marks: 2,
              source: 'new',
              prompt: [R`Explain the role of $\mathbf{z}_{(t)}$ in the last equation. What happens when its components are close to 1, and when they are close to 0?`],
              topics: [
                { lec: 'L4', slides: [48, 49], name: 'GRU computations' },
              ],
              answer: [
                w(R`$\mathbf{z}_{(t)}$ is a gate controller (logistic, so between 0 and 1) that controls **both** the forget gate and the input gate: it weights the old state $\mathbf{h}_{(t-1)}$, and $1 - \mathbf{z}_{(t)}$ weights the new candidate $\mathbf{g}_{(t)}$.`, 1),
                w(R`Close to 1: the previous state is kept (forget gate open, input gate closed). Close to 0: the state is replaced by $\mathbf{g}_{(t)}$ (the old memory is erased and the new input stored).`, 1),
              ],
              difficulty: 3,
              likelihood: 'high',
            },
            {
              id: 'c-q2-a-ii',
              label: 'ii.',
              marks: 2,
              source: 'new',
              prompt: [R`What does $\mathbf{r}_{(t)}$ control? Give two ways in which the GRU cell simplifies the LSTM cell.`],
              topics: [
                { lec: 'L4', slides: [48, 49], name: 'GRU cells' },
                { lec: 'L4', slides: [42, 47], name: 'The LSTM cell' },
              ],
              answer: [
                w(R`$\mathbf{r}_{(t)}$ (logistic, 0 to 1) multiplies $\mathbf{h}_{(t-1)}$ element-wise inside the main layer's equation for $\mathbf{g}_{(t)}$: it controls which parts of the previous state the main layer sees.`, 1),
                w(R`(Slide 49 prints this term as $\mathbf{r}_{(t)}^{\top}\mathbf{W}_{hg} \otimes \mathbf{h}_{(t-1)}^{\top}$; either way $\mathbf{r}_{(t)}$ scales how much of $\mathbf{h}_{(t-1)}$ reaches $\mathbf{g}_{(t)}$.)`),
                w(R`Any two: the two state vectors ($\mathbf{c}$ and $\mathbf{h}$) are merged into a single vector $\mathbf{h}_{(t)}$; a single gate controller $\mathbf{z}_{(t)}$ controls both the forget gate and the input gate; there is no output gate, so the full state vector is output at every time step.`, 1),
                slip(R`calling $\mathbf{r}_{(t)}$ the forget gate: in the GRU, forgetting is done by $\mathbf{z}_{(t)}$ through $\mathbf{z}_{(t)} \otimes \mathbf{h}_{(t-1)}$.`),
              ],
              difficulty: 3,
              likelihood: 'high',
            },
          ],
        },
        {
          id: 'c-q2-b',
          label: '(b)',
          page: 7,
          lines: 16,
          source: 'new',
          prompt: [
            'The model below forecasts the number of rail riders for each of the next 14 days. Each input sequence covers the previous 56 days, and each day is a 5-dimensional vector (bus riders, rail riders and three one-hot day-type features). The training set is split into mini-batches of 32 sequences.',
            {
              code: `ahead_model = tf.keras.Sequential([
    tf.keras.layers.InputLayer(shape=[None, 5]),
    tf.keras.layers.SimpleRNN(32),
    tf.keras.layers.Dense(14)
])`,
            },
          ],
          subs: [
            {
              id: 'c-q2-b-i',
              label: 'i.',
              marks: 1,
              source: 'new',
              prompt: ['What are the shapes of one mini-batch of inputs and of its targets?'],
              topics: [
                { lec: 'L4', slides: [35, 36], name: 'Forecasting several time steps ahead' },
              ],
              answer: [
                w('Inputs **(32, 56, 5)**: 32 sequences of 56 days of 5 features; targets **(32, 14)**: the rail value for each of the 14 days ahead.', 1),
              ],
              difficulty: 2,
              likelihood: 'high',
            },
            {
              id: 'c-q2-b-ii',
              label: 'ii.',
              marks: 2,
              source: 'new',
              prompt: ['Compute the number of trainable parameters of each layer and of the model.'],
              topics: [
                { lec: 'L4', slides: [9, 10], name: 'Memory-cell dimensions' },
                { lec: 'L4', slides: 38, name: 'ahead_model' },
              ],
              answer: [
                w(R`SimpleRNN: inputs to neurons $5 \times 32$, state to neurons $32 \times 32$, biases $32$:`),
                eq(R`160 + 1{,}024 + 32 = 1{,}216`, 1),
                eq(R`\text{Dense: } 32 \times 14 + 14 = 462`),
                w('Total: **1,678**.', 1),
                slip(R`the recurrent weights are $32 \times 32$ (state to state); the 5 input features only appear in $\mathbf{W}_x$, $5 \times 32$.`),
              ],
              difficulty: 3,
              likelihood: 'high',
            },
            {
              id: 'c-q2-b-iii',
              label: 'iii.',
              marks: 2,
              source: 'new',
              prompt: ['Another way to forecast 14 days ahead is to train a model that predicts one day ahead, and call it 14 times, appending each prediction to the input. How does `ahead_model` differ, and why does the one-step method need the inputs and outputs to have the same features?'],
              topics: [
                { lec: 'L4', slides: [34, 38], name: 'Forecasting several time steps ahead' },
              ],
              answer: [
                w('`ahead_model` outputs all 14 values at once, at the last time step (a sequence-to-vector RNN with `Dense(14)`): one forward pass. The one-step method uses the value predicted at time step t − 1 as the last input value for time step t, 14 times.', 1),
                w('Each prediction is appended to the input sequence as the next time step, so it must be a complete input vector: the method only works when the input and output vectors have the same features (here the inputs have 5 features but the model predicts rail only).', 1),
              ],
              difficulty: 3,
              likelihood: 'medium',
            },
          ],
        },
        {
          id: 'c-q2-c',
          label: '(c)',
          marks: 3,
          page: 8,
          lines: 10,
          source: 'new',
          prompt: [
            R`An *inception module* of GoogLeNet receives feature maps of shape $32 \times 32 \times 192$. Its four branches are listed below; every layer uses a stride of 1 and “same” padding, and every convolutional layer uses ReLU.`,
            {
              table: {
                head: ['Branch', 'Layers'],
                rows: [
                  ['1', '1 × 1 convolution, 64 filters'],
                  ['2', '1 × 1 convolution, 96 filters → 3 × 3 convolution, 128 filters'],
                  ['3', '1 × 1 convolution, 16 filters → 5 × 5 convolution, 32 filters'],
                  ['4', '3 × 3 max pooling → 1 × 1 convolution, 32 filters'],
                ],
              },
            },
            'What is the shape of the module\'s output? Why do all its layers use a stride of 1 and “same” padding, and why do the branches use different kernel sizes?',
          ],
          topics: [
            { lec: 'L3', slides: [41, 43], name: 'GoogLeNet and inception modules' },
          ],
          answer: [
            w(R`Every branch keeps $32 \times 32$; the depth concat stacks the branches' maps along the depth: $64 + 128 + 32 + 32 = 256$, so the output is **32 × 32 × 256**.`, 1),
            w('Stride 1 and “same” padding make every branch output feature maps of the same size, so the final step can concatenate them along the depth dimension (axis=3).', 1),
            w('The different kernel sizes (1 × 1, 3 × 3, 5 × 5) let the module capture patterns at different scales.', 1),
            slip('adding the first 1 × 1 layers of branches 2 and 3 (96 and 16 maps) to the depth: only the last layer of each branch reaches the depth concat.'),
          ],
          difficulty: 3,
          likelihood: 'medium',
        },
        {
          id: 'c-q2-d',
          label: '(d)',
          marks: 4,
          page: 9,
          lines: 11,
          source: 'new',
          prompt: [
            'Given below is a deep RNN that forecasts tomorrow\'s rail ridership from sequences of daily (bus, rail) values:',
            {
              code: `deep_model = tf.keras.Sequential([
    tf.keras.layers.InputLayer(shape=[None, 2]),
    tf.keras.layers.SimpleRNN(32, return_sequences=True),
    tf.keras.layers.SimpleRNN(32, return_sequences=True),
    tf.keras.layers.SimpleRNN(32),
    tf.keras.layers.Dense(1)
])`,
            },
            'For a mini-batch of 32 sequences of 56 days, give the output shape of each layer. Explain why `return_sequences=True` is set on every recurrent layer except the last. Its validation MAE turns out worse than that of a single `SimpleRNN(32)` layer: give a likely reason.',
          ],
          topics: [
            { lec: 'L4', slides: [28, 29], name: 'Forecasting using a deep RNN' },
          ],
          answer: [
            tbl(['Layer', 'Output shape'], [
              ['SimpleRNN(32, return_sequences=True)', '(32, 56, 32)'],
              ['SimpleRNN(32, return_sequences=True)', '(32, 56, 32)'],
              ['SimpleRNN(32)', '(32, 32)'],
              ['Dense(1)', '(32, 1)'],
            ], 2),
            w('A recurrent layer needs a 3D input, one vector per time step: the layers below the last must output their whole sequence of outputs. The last one only passes its final output to the Dense layer (sequence-to-vector).', 1),
            w('The model is a bit **too large** for the task: more layers and parameters do not help this simple series.', 1),
            slip('giving the first two layers the shape (32, 32): with `return_sequences=True` they keep the time axis, (32, 56, 32).'),
          ],
          difficulty: 3,
          likelihood: 'high',
        },
        {
          id: 'c-q2-e',
          label: '(e)',
          marks: 4,
          page: 10,
          lines: 11,
          source: 'new',
          prompt: ['Explain the *dying ReLUs* problem. Describe how leaky ReLU and ELU avoid it, giving the definition of each. What advantage does ELU with α = 1 have over leaky ReLU?'],
          topics: [
            { lec: 'L2', slides: [10, 15], name: 'Nonsaturating activation functions' },
          ],
          answer: [
            w(R`**Dying ReLUs:** during training some neurons "die": they stop outputting anything other than 0, because their input to $\text{ReLU}(z) = \max(0, z)$ is negative, where the gradient is 0.`, 1),
            w(R`**Leaky ReLU:** $\text{LeakyReLU}_\alpha(z) = \max(\alpha z, z)$ with a small slope $\alpha$ (e.g. 0.01, or 0.2) for $z < 0$, so negative inputs still have a gradient.`, 1),
            w(R`**ELU:** $\text{ELU}_\alpha(z) = \alpha(\exp(z) - 1)$ if $z < 0$, $z$ if $z \ge 0$: a non-zero gradient for $z < 0$ avoids dead neurons, and its negative values help alleviate the vanishing gradients problem.`, 1),
            w(R`With $\alpha = 1$, ELU is **smooth everywhere**, including at $z = 0$; leaky ReLU (like ReLU, RReLU and PReLU) is not smooth: its derivative is not continuous at $z = 0$.`, 1),
            slip(R`writing ELU as $\max(\alpha z, z)$: that is leaky ReLU; ELU curves smoothly down towards $-\alpha$.`),
          ],
          difficulty: 3,
          likelihood: 'high',
        },
      ],
    },

    /* ── Question 3 · L5, L6–7, L3, L8 ───────────────────────────────────── */
    {
      id: 'c-q3',
      n: 3,
      parts: [
        {
          id: 'c-q3-a',
          label: '(a)',
          page: 11,
          lines: 12,
          source: 'new',
          prompt: [
            'The code below trains a stacked autoencoder on Fashion MNIST one autoencoder at a time. `X_train_flat` holds the N training images, each flattened to 784 values:',
            {
              code: `def train_autoencoder(n_neurons, X_train, X_valid, output_activation=None):
    n_inputs = X_train.shape[-1]
    encoder = tf.keras.layers.Dense(n_neurons, activation="relu")
    decoder = tf.keras.layers.Dense(n_inputs, activation=output_activation)
    autoencoder = tf.keras.Sequential([encoder, decoder])
    autoencoder.compile(loss="mse", optimizer="nadam")
    autoencoder.fit(X_train, X_train, epochs=10,
                    validation_data=(X_valid, X_valid))
    return encoder, decoder, encoder(X_train), encoder(X_valid)

enc1, dec1, X_train_enc1, X_valid_enc1 = train_autoencoder(
    100, X_train_flat, X_valid_flat)
enc2, dec2, _, _ = train_autoencoder(
    30, X_train_enc1, X_valid_enc1, output_activation="relu")
stacked_ae = tf.keras.Sequential([tf.keras.layers.Flatten(),
    enc1, enc2, dec2, dec1, tf.keras.layers.Reshape([28, 28])])`,
            },
          ],
          subs: [
            {
              id: 'c-q3-a-i',
              label: 'i.',
              marks: 2,
              source: 'new',
              prompt: ['Describe the phases of this training. What are the input and output shapes of `stacked_ae` for a batch of 32 images?'],
              topics: [
                { lec: 'L5', slides: [23, 25], name: 'Training one autoencoder at a time' },
              ],
              answer: [
                w('Phase 1: train a shallow autoencoder 784 → 100 → 784 on the images; its encoder gives a compressed representation `X_train_enc1`. Phase 2: train a second one, 100 → 30 → 100, on `X_train_enc1`, for an even more compressed representation. Phase 3: stack them into one "sandwich", enc1, enc2, dec2, dec1 (and, if needed, train it for a few more epochs).', 1),
                w('Input **(32, 28, 28)** → Flatten (32, 784) → (32, 100) → (32, 30) → (32, 100) → (32, 784) → Reshape → output **(32, 28, 28)**: the same shape, because it reconstructs its inputs.', 1),
                slip('stacking the decoders in the wrong order: they unwind the encoders in reverse, enc1, enc2, dec2, dec1.'),
              ],
              difficulty: 3,
              likelihood: 'medium',
            },
            {
              id: 'c-q3-a-ii',
              label: 'ii.',
              marks: 2,
              source: 'new',
              prompt: ['What is the shape of `X_train_enc1`, and how many trainable parameters do `enc2` and `dec2` have? Why does the second autoencoder use `output_activation="relu"`?'],
              topics: [
                { lec: 'L5', slides: 24, name: 'Training one autoencoder at a time' },
              ],
              answer: [
                w(R`$(N, 100)$. enc2: $100 \times 30 + 30 =$ **3,030**; dec2: $30 \times 100 + 100 =$ **3,100**.`, 1),
                w('The second autoencoder reconstructs `X_train_enc1`, which comes out of enc1\'s ReLU and so is never negative: a ReLU output layer gives outputs in the same range.', 1),
                slip('giving `X_train_enc1` the shape (N, 30) or (N, 784), or counting enc2 as 784 × 30 + 30: enc2\'s inputs are enc1\'s 100 codings.'),
              ],
              difficulty: 3,
              likelihood: 'medium',
            },
          ],
        },
        {
          id: 'c-q3-b',
          label: '(b)',
          page: 12,
          lines: 15,
          source: 'new',
          prompt: [
            'The loop below is one epoch of a GAN\'s training on 28 × 28 Fashion MNIST images, where `gan = tf.keras.Sequential([generator, discriminator])`, `batch_size = 32` (every batch of the dataset holds 32 images) and `codings_size = 30`:',
            {
              code: `for X_batch in dataset:
    # phase 1
    noise = tf.random.normal(shape=[batch_size, codings_size])
    generated_images = generator(noise)
    X_fake_and_real = tf.concat([generated_images, X_batch], axis=0)
    y1 = tf.constant([[0.]] * batch_size + [[1.]] * batch_size)
    discriminator.trainable = True
    discriminator.train_on_batch(X_fake_and_real, y1)
    # phase 2
    noise = tf.random.normal(shape=[batch_size, codings_size])
    y2 = tf.constant([[1.]] * batch_size)
    discriminator.trainable = False
    gan.train_on_batch(noise, y2)`,
            },
          ],
          subs: [
            {
              id: 'c-q3-b-i',
              label: 'i.',
              marks: 2,
              source: 'new',
              prompt: ['What are the shapes of `X_fake_and_real` and `y1`, and what do the values in `y1` mean?'],
              topics: [
                { lec: 'L67', slides: [21, 25], name: 'GAN training, phase 1' },
              ],
              answer: [
                w('`X_fake_and_real`: **(64, 28, 28)**, the 32 generated (fake) images followed by the 32 real images.', 1),
                w('`y1`: **(64, 1)**: the first 32 labels are 0 (fake) and the last 32 are 1 (real). The discriminator is trained on this labelled batch for one step, with the binary cross-entropy loss.', 1),
              ],
              difficulty: 3,
              likelihood: 'high',
            },
            {
              id: 'c-q3-b-ii',
              label: 'ii.',
              marks: 2,
              source: 'new',
              prompt: ['Suppose phase 2 used `y2 = tf.constant([[0.]] * batch_size)` and left out the line `discriminator.trainable = False`. What would `gan.train_on_batch(noise, y2)` then train each of the two networks to do?'],
              topics: [
                { lec: 'L67', slides: [22, 25], name: 'GAN training, phase 2' },
              ],
              answer: [
                w('**Generator:** labels of 0 (fake) train it to produce images the discriminator recognises as fake: the opposite of its goal, which is images the discriminator (wrongly) believes are real (labels 1).', 1),
                w('**Discriminator:** `gan` contains it, so without freezing it backpropagation also updates its weights in phase 2 (here to call the fakes fake once more), instead of only the generator\'s.', 1),
                slip('thinking `gan.train_on_batch` only ever trains the generator: it trains every trainable layer in `gan`, which is why the discriminator is frozen for phase 2.'),
              ],
              difficulty: 3,
              likelihood: 'high',
            },
            {
              id: 'c-q3-b-iii',
              label: 'iii.',
              marks: 1,
              source: 'new',
              prompt: ['Why is the training written as a custom loop instead of calling `fit()`?'],
              topics: [
                { lec: 'L67', slides: [21, 24], name: 'Why a custom training loop' },
              ],
              answer: [
                w('A GAN is two networks with opposite objectives, so it can\'t be trained like a regular network: each iteration has two phases, with different models, data and labels.', 1),
              ],
              difficulty: 2,
              likelihood: 'medium',
            },
          ],
        },
        {
          id: 'c-q3-c',
          label: '(c)',
          marks: 3,
          page: 13,
          lines: 10,
          source: 'new',
          prompt: ['A *variational autoencoder* with 10-dimensional codings has been trained on Fashion MNIST. Explain how it can generate new images, and how it can perform *semantic interpolation* between two images. How does this differ from interpolating the two images at the pixel level?'],
          topics: [
            { lec: 'L67', slides: [16, 18], name: 'Generating images, semantic interpolation' },
            { lec: 'L67', slides: [12, 13], name: 'The latent loss' },
          ],
          answer: [
            w('**Generate:** sample random codings from the Gaussian distribution, e.g. `codings = tf.random.normal(shape=[21, 10])`, and pass them through the decoder only: 21 new images, shape (21, 28, 28). This works because the latent loss pushed the codings to look as if sampled from a Gaussian.', 1),
            w('**Semantic interpolation:** (1) run both images through the encoder to get their codings; (2) interpolate the two codings; (3) decode the interpolated codings to get the final images.', 1),
            w('Interpolating pixels just looks as if the two images were overlaid; interpolating the codings gives a sequence of plausible images that gradually change from one item into the other (e.g. a T-shirt into a sneaker).', 1),
          ],
          difficulty: 2,
          likelihood: 'medium',
        },
        {
          id: 'c-q3-d',
          label: '(d)',
          marks: 4,
          page: 13,
          lines: 11,
          source: 'new',
          prompt: ['In the ILSVRC ImageNet challenge, AlexNet (2012) won by a large margin, and ResNet (2015) won with a CNN of 152 layers. Which two regularization techniques did AlexNet use to reduce overfitting? Briefly explain each. What is the *skip connection* that ResNet relies on, and what does it force the layers it skips to learn?'],
          topics: [
            { lec: 'L3', slides: [38, 40], name: 'AlexNet and data augmentation' },
            { lec: 'L3', slides: [45, 46], name: 'ResNet and residual learning' },
          ],
          answer: [
            w('**Dropout**, with a 50% dropout rate, applied during training to the outputs of the fully connected layers F9 and F10.', 1),
            w('**Data augmentation:** randomly shifting the training images, flipping them horizontally and changing the lighting. It artificially increases the size of the training set with realistic variants of each instance.', 1),
            w(R`A skip (shortcut) connection adds the input $\mathbf{x}$ of a few layers to the output of a deeper layer.`, 1),
            w(R`If the target function is $h(\mathbf{x})$, the layers are forced to model $f(\mathbf{x}) = h(\mathbf{x}) - \mathbf{x}$ instead: **residual learning**. Skip connections are the key to being able to train such a deep network.`, 1),
            slip(R`saying the layers learn $h(\mathbf{x})$: with the skip they learn the residual $h(\mathbf{x}) - \mathbf{x}$.`),
          ],
          difficulty: 3,
          likelihood: 'high',
        },
        {
          id: 'c-q3-e',
          label: '(e)',
          page: 14,
          lines: 12,
          source: 'new',
          prompt: [
            'The original transformer uses fixed *positional encodings*, defined as:',
            { eq: R`P_{p,i} = \begin{cases} \sin\left(p / 1000^{i/d}\right) & \text{if } i \text{ is even} \\ \cos\left(p / 1000^{(i-1)/d}\right) & \text{if } i \text{ is odd} \end{cases}` },
            R`where $P_{p,i}$ is the $i$th component of the encoding for the word at position $p$ in the sentence, and $d$ is the dimension of the keys, values and queries.`,
          ],
          subs: [
            {
              id: 'c-q3-e-i',
              label: 'i.',
              marks: 2,
              source: 'new',
              prompt: ['A batch of 32 sentences of 10 words each has word embeddings of size 512. What are the shapes of the embeddings, of the positional encodings added to them, and of the result? Why must each position have a different encoding?'],
              topics: [
                { lec: 'L8', slides: [29, 33], name: 'Positional encodings' },
                { lec: 'L8', slides: 35, name: 'A PositionalEncoding layer' },
              ],
              answer: [
                w(R`Embeddings **(32, 10, 512)**; positional encodings: one $10 \times 512$ matrix (positions 0–9; shape (1, 10, 512) in the slides' code), the same for every sentence, **added** to each sentence's embeddings; result **(32, 10, 512)**, unchanged.`, 1),
                w('The transformer has no recurrent or convolutional layers: the other layers treat each word independently and attention relates all the words at once, so nothing knows the word order. A unique encoding per position gives the model each word\'s **absolute position**.', 1),
              ],
              difficulty: 3,
              likelihood: 'high',
            },
            {
              id: 'c-q3-e-ii',
              label: 'ii.',
              marks: 2,
              source: 'new',
              prompt: [R`With $d = 4$, compute the encoding $P_{1,0}, P_{1,1}, P_{1,2}, P_{1,3}$ of the word at position $p = 1$, to 4 decimal places (angles in radians).`],
              topics: [
                { lec: 'L8', slides: [32, 33], name: 'The sine/cosine encoding' },
              ],
              answer: [
                eq(R`P_{1,0} = \sin(1) = 0.8415`),
                eq(R`P_{1,1} = \cos(1) = 0.5403`, 1),
                eq(R`P_{1,2} = \sin(1/1000^{2/4}) = \sin(0.0316) = 0.0316`),
                eq(R`P_{1,3} = \cos(1/1000^{2/4}) = \cos(0.0316) = 0.9995`, 1),
                slip(R`using $i$ instead of $i - 1$ in the cosine's exponent ($P_{1,3}$ uses $1000^{2/4}$, not $1000^{3/4}$), or computing in degrees. Slide 35's code uses 10 000 instead of slide 32's 1000; with 10 000, $P_{1,2} = 0.0100$ and $P_{1,3} = 1.0000$.`),
              ],
              difficulty: 4,
              likelihood: 'low',
            },
          ],
        },
      ],
    },

    /* ── Question 4 · L8, L4, L9 ─────────────────────────────────────────── */
    {
      id: 'c-q4',
      n: 4,
      parts: [
        {
          id: 'c-q4-a',
          label: '(a)',
          page: 15,
          lines: 16,
          source: 'new',
          prompt: [
            'The encoder–decoder network below forecasts the daily (bus, rail) ridership for the next 14 days from 56 days of data (the encoder reads the first 55):',
            {
              code: `encoder_inputs = tf.keras.Input(shape=[None, 2])
encoder = tf.keras.layers.Bidirectional(
    tf.keras.layers.SimpleRNN(16, return_state=True))
encoder_outputs, *encoder_state = encoder(encoder_inputs)
encoder_state = tf.keras.layers.Concatenate(axis=-1)(encoder_state)
decoder_inputs = tf.keras.Input(shape=[None, 2])
decoder = tf.keras.layers.SimpleRNN(32, return_sequences=True)
decoder_outputs = decoder(decoder_inputs, initial_state=encoder_state)
outputs = tf.keras.layers.Dense(2)(decoder_outputs)
rnn_ed = tf.keras.Model(inputs=[encoder_inputs, decoder_inputs],
                        outputs=outputs)`,
            },
          ],
          subs: [
            {
              id: 'c-q4-a-i',
              label: 'i.',
              marks: 1,
              source: 'new',
              prompt: ['What is the shape of `encoder_state` after the `Concatenate` layer, and why must the decoder have 32 units?'],
              topics: [
                { lec: 'L8', slides: 14, name: 'The bus/rail encoder–decoder' },
                { lec: 'L8', slides: [7, 8], name: 'Bidirectional RNNs' },
              ],
              answer: [
                w('**(None, 32)**: the forward state (16) and the backward state (16) concatenated. It is the decoder\'s initial state, so the decoder\'s state must have 32 units to match.', 1),
              ],
              difficulty: 2,
              likelihood: 'medium',
            },
            {
              id: 'c-q4-a-ii',
              label: 'ii.',
              marks: 2,
              source: 'new',
              prompt: ['Compute the number of trainable parameters of the encoder, the decoder and the `Dense` layer.'],
              topics: [
                { lec: 'L8', slides: 14, name: 'The bus/rail encoder–decoder' },
                { lec: 'L4', slides: [9, 10], name: 'Memory-cell dimensions' },
              ],
              answer: [
                eq(R`\text{encoder: } 2 \times (2 \times 16 + 16 \times 16 + 16) = 2 \times 304 = 608`, 1),
                eq(R`\text{decoder: } 2 \times 32 + 32 \times 32 + 32 = 1{,}120`),
                eq(R`\text{Dense: } 32 \times 2 + 2 = 66`),
                w('Total: **1,794**.', 1),
                slip('counting the Bidirectional layer once: it holds two SimpleRNN(16) layers, one per direction.'),
              ],
              difficulty: 3,
              likelihood: 'high',
            },
            {
              id: 'c-q4-a-iii',
              label: 'iii.',
              marks: 2,
              source: 'new',
              prompt: ['What does the decoder receive as its inputs at the training stage, and at the testing stage?'],
              topics: [
                { lec: 'L8', slides: [12, 13], name: 'Training and testing an encoder–decoder' },
              ],
              answer: [
                w('**Training:** the last day of `X_train` (day 55, which the encoder does not read), followed by `y_train` shifted by one time step (the true values of days 56–68); its outputs (days 56–69) are compared with `y_train`.', 1),
                w('**Testing:** only the first time step has an input, the last day of `X_test` (`X_test[:, -1, :]`); the others are unknown and set to 0. The network is run 14 times, and each newly predicted (bus, rail) value replaces the decoder\'s input for the next day.', 1),
              ],
              difficulty: 4,
              likelihood: 'medium',
            },
          ],
        },
        {
          id: 'c-q4-b',
          label: '(b)',
          marks: 3,
          page: 16,
          lines: 10,
          source: 'new',
          prompt: [R`In a *multi-head attention* layer, the values $\mathbf{V}$, keys $\mathbf{K}$ and queries $\mathbf{Q}$ each go through a *Linear* layer and are then split into $H$ parts, each going through its own *scaled dot-product attention*. Briefly explain why they are split. If $\mathbf{V}$, $\mathbf{K}$ and $\mathbf{Q}$ each have 512 columns after the Linear layers and $H = 8$, how many columns does each part have, and how many does the output have once the parts are concatenated back together?`],
          topics: [
            { lec: 'L8', slides: [37, 39], name: 'Multi-head attention' },
          ],
          answer: [
            w('Each part goes through its own scaled dot-product attention, so different heads can capture different characteristics of the words (e.g. "like" is a verb, and it is in the present tense).', 1),
            w(R`Each part has $512 / 8 =$ **64** columns ($H$ is the number of heads, the number of parts).`, 1),
            w(R`Concatenating the 8 heads' outputs gives back $8 \times 64 =$ **512** columns, which go through a final Linear layer.`, 1),
            slip(R`giving each head all 512 columns: the split divides the columns between the $H$ heads.`),
          ],
          difficulty: 3,
          likelihood: 'high',
        },
        {
          id: 'c-q4-c',
          label: '(c)',
          page: 16,
          lines: 11,
          source: 'new',
          prompt: [R`A robotic vacuum cleaner is rewarded by the amount of dust it picks up in 30 minutes. Every second, its policy either moves forward with probability $p$, or (with probability $1 - p$) rotates left or right by a random angle between $-r$ and $+r$ degrees.`],
          subs: [
            {
              id: 'c-q4-c-i',
              label: 'i.',
              marks: 2,
              source: 'new',
              prompt: ['What are the policy parameters, and why is this a *stochastic policy*? Why is it impractical to find good parameter values by brute-force policy search?'],
              topics: [
                { lec: 'L9', slides: [11, 13], name: 'Policies and policy search' },
              ],
              answer: [
                w(R`The policy parameters are $p$ and $r$; randomness is involved, so the policy is stochastic (the robot's erratic trajectory guarantees it eventually gets to any place it can reach).`, 1),
                w('Brute force tries all combinations of parameter values; when the policy space is large (generally the case), this is like searching for a needle in a gigantic haystack.', 1),
              ],
              difficulty: 2,
              likelihood: 'medium',
            },
            {
              id: 'c-q4-c-ii',
              label: 'ii.',
              marks: 2,
              source: 'new',
              prompt: ['Briefly explain how a *genetic algorithm* and *policy gradients* would search for good parameter values.'],
              topics: [
                { lec: 'L9', slides: [14, 15], name: 'Genetic algorithms and policy gradients' },
              ],
              answer: [
                w('**Genetic algorithm:** create a first generation of e.g. 100 random policies and try them; kill the 80 worst and let the 20 survivors produce 4 offspring (copies) each; survivors plus offspring form the next generation. Repeat until a good policy is found.', 1),
                w(R`**Policy gradients:** evaluate the gradients of the rewards with respect to the policy parameters and tweak the parameters towards higher rewards (gradient ascent): e.g. increase $p$ slightly; if more dust is picked up, increase it more, otherwise reduce it.`, 1),
              ],
              difficulty: 2,
              likelihood: 'medium',
            },
          ],
        },
        {
          id: 'c-q4-d',
          label: '(d)',
          page: 17,
          lines: 12,
          source: 'new',
          prompt: [
            R`In *temporal difference (TD) learning*, the agent updates its estimate of the value of a state $s$ after each transition it observes:`,
            { eq: R`V_{k+1}(s) \leftarrow (1 - \alpha)\,V_k(s) + \alpha\left(r + \gamma\, V_k(s')\right)` },
          ],
          subs: [
            {
              id: 'c-q4-d-i',
              label: 'i.',
              marks: 2,
              source: 'new',
              prompt: [R`Explain what $\alpha$, $r + \gamma V_k(s')$ and $r + \gamma V_k(s') - V_k(s)$ are. Why is TD learning used instead of the value iteration algorithm?`],
              topics: [
                { lec: 'L9', slides: [50, 52], name: 'Temporal difference learning' },
              ],
              answer: [
                w(R`$\alpha$ is the learning rate; $r + \gamma V_k(s')$ is the **TD target** (the reward observed plus the discounted value estimate of the next state $s'$); $r + \gamma V_k(s') - V_k(s)$ is the **TD error** $\delta_k(s, r, s')$, and $V_{k+1}(s) = V_k(s) + \alpha\,\delta_k(s, r, s')$.`, 1),
                w(R`Value iteration needs the transition probabilities $T(s, a, s')$ and the rewards $R(s, a, s')$. The agent often does not know them, so TD learning updates its estimates from the transitions and rewards it actually observes.`, 1),
              ],
              difficulty: 3,
              likelihood: 'high',
            },
            {
              id: 'c-q4-d-ii',
              label: 'ii.',
              marks: 2,
              source: 'new',
              prompt: [R`The agent's estimates are $V_k(s) = 4$ and $V_k(s') = 10$. It moves from $s$ to $s'$ and receives the reward $r = 2$. With $\alpha = 0.1$ and $\gamma = 0.9$, compute the TD target, the TD error and $V_{k+1}(s)$.`],
              topics: [
                { lec: 'L9', slides: 51, name: 'One TD update' },
              ],
              answer: [
                eq(R`\text{TD target} = 2 + 0.9 \times 10 = 11`),
                eq(R`\text{TD error} = 11 - 4 = 7`, 1),
                eq(R`V_{k+1}(s) = 4 + 0.1 \times 7 = 4.7`, 1),
                slip(R`using $V_k(s)$ in the target: the target looks one step ahead, to the next state's value $V_k(s')$.`),
              ],
              difficulty: 2,
              likelihood: 'high',
            },
          ],
        },
        {
          id: 'c-q4-e',
          label: '(e)',
          page: 18,
          lines: 14,
          source: 'new',
          prompt: [
            R`A Markov decision process has two states, $s_0$ and $s_1$, and two actions, $a_0$ and $a_1$, possible in both states. It is defined in Python as on the lecture slides:`,
            {
              code: `transition_probabilities = [  # shape=[s, a, s']
    [[0.5, 0.5], [1.0, 0.0]],
    [[0.0, 1.0], [0.6, 0.4]]]
rewards = [  # shape=[s, a, s']
    [[0, +10], [+2, 0]],
    [[0, 0], [+20, -10]]]
gamma = 0.9`,
            },
            R`All the Q-values start at 0 and are updated, for all $(s, a)$, with the Q-value iteration algorithm:`,
            { eq: R`Q_{k+1}(s, a) \leftarrow \sum_{s'} T(s, a, s')\left[R(s, a, s') + \gamma \max_{a'} Q_k(s', a')\right]` },
          ],
          subs: [
            {
              id: 'c-q4-e-i',
              label: 'i.',
              marks: 2,
              source: 'new',
              prompt: [R`Compute $Q_1(s, a)$ for all four state–action pairs.`],
              topics: [
                { lec: 'L9', slides: [46, 48], name: 'Q-value iteration' },
              ],
              answer: [
                tbl(['', R`$a_0$`, R`$a_1$`], [
                  [R`$s_0$`, R`$0.5 \times 0 + 0.5 \times 10 = 5$`, R`$1.0 \times 2 = 2$`],
                  [R`$s_1$`, R`$1.0 \times 0 = 0$`, R`$0.6 \times 20 + 0.4 \times (-10) = 8$`],
                ], 2),
              ],
              difficulty: 3,
              likelihood: 'medium',
            },
            {
              id: 'c-q4-e-ii',
              label: 'ii.',
              marks: 2,
              source: 'new',
              prompt: [R`Compute $Q_2(s_0, a_0)$ and $Q_2(s_0, a_1)$. Which action should the agent choose in state $s_0$ after these two iterations?`],
              topics: [
                { lec: 'L9', slides: [46, 49], name: 'Q-value iteration and the optimal policy' },
              ],
              answer: [
                w(R`From $Q_1$: $\max_{a'} Q_1(s_0, a') = 5$ and $\max_{a'} Q_1(s_1, a') = 8$.`),
                eq(R`Q_2(s_0, a_0) = 0.5\,(0 + 0.9 \times 5) + 0.5\,(10 + 0.9 \times 8) = 10.85`, 1),
                w(R`$Q_2(s_0, a_1) = 1.0\,(2 + 0.9 \times 5) = 6.5$, so in $s_0$ the agent chooses $\arg\max_a Q_2(s_0, a) = a_0$ (10.85 > 6.5).`, 1),
                slip(R`using $Q_1(s', a)$ for the same action $a$: the update takes the best action in the next state, $\max_{a'} Q_1(s', a')$.`),
              ],
              difficulty: 4,
              likelihood: 'medium',
            },
          ],
        },
      ],
    },
  ],
};
