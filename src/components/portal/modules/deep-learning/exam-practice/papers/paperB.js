import { w, h, eq, ul, tbl, fig, slip } from './ink.js';

/* ============================================================================
   EXAM PRACTICE — PRACTICE PAPER B (written for this page)
   ----------------------------------------------------------------------------
   Four questions × 20 marks in the sample paper's format
   (tools/dl-exam-practice/format-spec.md), planned in coverage.md: Q1
   L1–L3 · Q2 L4–L5 (+ L3) · Q3 L6–7 (VAE code, DCGAN, conv AEs) and L8 ·
   Q4 L8 transformer inference and L9 RL. Every question was checked by a
   validator before its answer was written; every answer is built from the
   slides it cites and was checked blind against them.
   ========================================================================== */

const R = String.raw;

export const PAPER_B = {
  id: 'B',
  name: 'Practice Paper B',
  tab: 'Practice paper B',
  head: 'Practice Exam Paper B 2026',
  pages: 19,
  cover: {
    contains: 'This practice exam paper contains: **19** pages **(including title page)**',
    instructions: [
      'This paper contains 4 questions, each is worth 20 marks. **Total : 80 marks**.',
      'The duration of the exam is 2 hours.\nIt is a **closed book** exam.',
      'Candidate should attempt ALL questions.',
      'Answers are to be written on this question paper in the spaces provided.',
    ],
    materialsLead: 'Materials permitted:',
    materials: ['1 UWA approved calculator with sticker.'],
    note: 'Written for this portal from the CITS5017 lecture slides, in the sample paper\'s format. Not an official paper.',
  },
  questions: [
    {
      id: 'b-q1',
      n: 1,
      parts: [
        {
          id: 'b-q1-a',
          label: '(a)',
          page: 2,
          lines: 11,
          source: 'new',
          prompt: [
            R`The diagram below shows a multilayer perceptron of threshold logic units (TLUs). Each TLU computes the weighted sum of its inputs plus its bias and applies the Heaviside step function: $\text{heaviside}(z) = 0$ if $z < 0$ and $1$ if $z \ge 0$. The connection weights and the biases are written on the diagram.`,
            { fig: 'xorMlp', desc: 'Figure: inputs x1 and x2 each connect with weight 1 to two hidden TLUs, h1 (bias −3/2) and h2 (bias −1/2); h1 connects to the output TLU with weight −1 and h2 with weight +1; the output TLU has bias −1/2.' },
            'Based on the diagram,',
          ],
          subs: [
            {
              id: 'b-q1-a-i',
              label: 'i.',
              marks: 3,
              source: 'new',
              prompt: [R`compute the network's output for the inputs $(x_1, x_2) = (0, 0)$, $(0, 1)$, $(1, 0)$ and $(1, 1)$. Which logical function does the network compute?`],
              topics: [
                { lec: 'L1', slides: [4, 5], name: 'TLUs and step functions' },
                { lec: 'L1', slides: 17, name: 'An MLP for XOR' },
              ],
              answer: [],
              difficulty: null,
              likelihood: null,
            },
            {
              id: 'b-q1-a-ii',
              label: 'ii.',
              marks: 1,
              source: 'new',
              prompt: ['why can\'t a single-layer Perceptron compute this function?'],
              topics: [
                { lec: 'L1', slides: [12, 16], name: 'Weaknesses of Perceptrons' },
              ],
              answer: [],
              difficulty: null,
              likelihood: null,
            },
          ],
        },
        {
          id: 'b-q1-b',
          label: '(b)',
          page: 3,
          lines: 14,
          source: 'new',
          prompt: [
            'Given below are the update steps of the *Adam* optimizer:',
            { eq: R`\begin{aligned} &1.\quad \mathbf{m} \leftarrow \beta_1 \mathbf{m} + (1 - \beta_1)\nabla_{\boldsymbol{\theta}} J(\boldsymbol{\theta}) \\ &2.\quad \mathbf{s} \leftarrow \beta_2 \mathbf{s} + (1 - \beta_2)\nabla_{\boldsymbol{\theta}} J(\boldsymbol{\theta}) \otimes \nabla_{\boldsymbol{\theta}} J(\boldsymbol{\theta}) \\ &3.\quad \widehat{\mathbf{m}} \leftarrow \mathbf{m} / (1 - \beta_1^{\,t}) \\ &4.\quad \widehat{\mathbf{s}} \leftarrow \mathbf{s} / (1 - \beta_2^{\,t}) \\ &5.\quad \boldsymbol{\theta} \leftarrow \boldsymbol{\theta} - \eta\, \widehat{\mathbf{m}} \oslash \sqrt{\widehat{\mathbf{s}} + \epsilon} \end{aligned}` },
          ],
          subs: [
            {
              id: 'b-q1-b-i',
              label: 'i.',
              marks: 3,
              source: 'new',
              prompt: [R`Briefly explain what the vectors $\mathbf{m}$ and $\mathbf{s}$ keep track of, what $\beta_1$ and $\beta_2$ are, and which two optimizers Adam combines.`],
              topics: [
                { lec: 'L2', slides: [43, 44], name: 'Adam' },
                { lec: 'L2', slides: [34, 41], name: 'Momentum and RMSProp' },
              ],
              answer: [],
              difficulty: null,
              likelihood: null,
            },
            {
              id: 'b-q1-b-ii',
              label: 'ii.',
              marks: 2,
              source: 'new',
              prompt: [R`Why are steps 3 and 4 needed, and what is $t$?`],
              topics: [
                { lec: 'L2', slides: 43, name: 'Adam steps 3 and 4' },
              ],
              answer: [],
              difficulty: null,
              likelihood: null,
            },
          ],
        },
        {
          id: 'b-q1-c',
          label: '(c)',
          page: 4,
          lines: 14,
          source: 'new',
          prompt: ['A convolutional layer with 64 filters of size 3 × 3, a stride of 1 and "same" padding is applied to RGB images of 224 × 224 pixels. All values are stored as 32-bit floats.'],
          subs: [
            {
              id: 'b-q1-c-i',
              label: 'i.',
              marks: 1,
              source: 'new',
              prompt: ['How many parameters does the layer have?'],
              topics: [
                { lec: 'L3', slides: [15, 16], name: 'Conv-layer parameters' },
                { lec: 'L3', slides: 22, name: 'Parameters vs image size' },
              ],
              answer: [],
              difficulty: null,
              likelihood: null,
            },
            {
              id: 'b-q1-c-ii',
              label: 'ii.',
              marks: 2,
              source: 'new',
              prompt: ['How many multiplications does the layer compute for one image, and how many bytes do its output feature maps occupy for one image?'],
              topics: [
                { lec: 'L3', slides: [22, 23], name: 'Compute and memory of a conv layer' },
              ],
              answer: [],
              difficulty: null,
              likelihood: null,
            },
            {
              id: 'b-q1-c-iii',
              label: 'iii.',
              marks: 2,
              source: 'new',
              prompt: ['Explain why training a CNN needs much more RAM than making predictions with it, and give two ways to reduce memory use if training runs out of RAM.'],
              topics: [
                { lec: 'L3', slides: [22, 24], name: 'Memory requirements of CNNs' },
              ],
              answer: [],
              difficulty: null,
              likelihood: null,
            },
          ],
        },
        {
          id: 'b-q1-d',
          label: '(d)',
          marks: 3,
          page: 5,
          lines: 9,
          source: 'new',
          prompt: [
            'Someone has trained `model_A` to classify 8 of the 10 Fashion MNIST classes. You need a binary classifier for T-shirts versus pullovers but have only 200 labelled images, so you use transfer learning:',
            {
              code: `model_A = tf.keras.models.load_model("my_model_A.keras")
model_B_on_A = tf.keras.Sequential(model_A.layers[:-1])
model_B_on_A.add(tf.keras.layers.Dense(1, activation="sigmoid"))
for layer in model_B_on_A.layers[:-1]:
    layer.trainable = False`,
            },
            'Why is `model_A`\'s output layer replaced, and why by `Dense(1, activation="sigmoid")`? What does the `for` loop do? If transfer learning raises the test accuracy from 91.85% to 93.85%, by what percentage has the error rate dropped?',
          ],
          topics: [
            { lec: 'L2', slides: [30, 32], name: 'Transfer learning' },
            { lec: 'L1', slides: 29, name: 'Binary classification output' },
          ],
          answer: [],
          difficulty: null,
          likelihood: null,
        },
        {
          id: 'b-q1-e',
          label: '(e)',
          marks: 3,
          page: 5,
          lines: 9,
          source: 'new',
          prompt: [R`With *exponential scheduling*, the learning rate at step $t$ is $\eta(t) = \eta_0\, r^{t/s}$. For $\eta_0 = 0.01$, $r = 0.1$ and $s = 20{,}000$, compute the learning rate after 10,000 steps and after 40,000 steps. Give one reason to use a learning schedule rather than a constant learning rate.`],
          topics: [
            { lec: 'L2', slides: [48, 49], name: 'Learning-rate scheduling' },
            { lec: 'L2', slides: [52, 53], name: 'Exponential scheduling' },
          ],
          answer: [],
          difficulty: null,
          likelihood: null,
        },
      ],
    },
    {
      id: 'b-q2',
      n: 2,
      parts: [
        {
          id: 'b-q2-a',
          label: '(a)',
          page: 6,
          lines: 11,
          source: 'new',
          prompt: [
            R`The diagram below shows an *LSTM cell*. Its four fully connected (FC) layers all receive $\mathbf{x}_{(t)}$ and $\mathbf{h}_{(t-1)}$: three of them use the logistic function and output the gate controllers $\mathbf{f}_{(t)}$, $\mathbf{i}_{(t)}$ and $\mathbf{o}_{(t)}$, and one uses tanh and outputs $\mathbf{g}_{(t)}$.`,
            { fig: 'lstm', desc: 'Figure: the long-term state c(t−1) runs along the top through an element-wise multiplication with f(t) (forget gate) and an addition of i(t) ⊗ g(t) (input gate), leaving as c(t); c(t) also passes through tanh and is multiplied element-wise by o(t) (output gate) to give h(t) = y(t). Four FC layers (f, g, i, o) take x(t) and h(t−1).' },
            'Based on the diagram,',
          ],
          subs: [
            {
              id: 'b-q2-a-i',
              label: 'i.',
              marks: 2,
              source: 'new',
              prompt: [R`write down the equations for the long-term state $\mathbf{c}_{(t)}$ and for the output $\mathbf{y}_{(t)} = \mathbf{h}_{(t)}$.`],
              topics: [
                { lec: 'L4', slides: [44, 47], name: 'LSTM equations' },
              ],
              answer: [],
              difficulty: null,
              likelihood: null,
            },
            {
              id: 'b-q2-a-ii',
              label: 'ii.',
              marks: 2,
              source: 'new',
              prompt: ['briefly explain the roles of the forget gate, the input gate and the output gate, and why their values lie between 0 and 1.'],
              topics: [
                { lec: 'L4', slides: [46, 47], name: 'LSTM gates' },
              ],
              answer: [],
              difficulty: null,
              likelihood: null,
            },
          ],
        },
        {
          id: 'b-q2-b',
          label: '(b)',
          marks: 6,
          page: 7,
          lines: 20,
          source: 'new',
          prompt: [
            'Given below is the code for a network that processes sequences of 30 time steps with 2 features each:',
            {
              code: `model = tf.keras.Sequential([
    tf.keras.layers.InputLayer(shape=[30, 2]),
    tf.keras.layers.Conv1D(filters=8, kernel_size=3, activation="relu"),
    tf.keras.layers.LSTM(16),
    tf.keras.layers.Dense(1)
])`,
            },
            'Draw a diagram of the network, showing the shape of the data between layers. Compute the number of parameters of each layer and of the whole network. What does the output of the `Conv1D` layer represent?',
          ],
          topics: [
            { lec: 'L4', slides: 50, name: '1D convolutional layers' },
            { lec: 'L4', slides: [43, 47], name: 'LSTM parameters' },
            { lec: 'L3', slides: [19, 20], name: '"valid" padding' },
          ],
          answer: [],
          difficulty: null,
          likelihood: null,
        },
        {
          id: 'b-q2-c',
          label: '(c)',
          marks: 3,
          page: 8,
          lines: 9,
          source: 'new',
          prompt: ['Training an RNN on long sequences can be unstable. Explain why nonsaturating activation functions such as ReLU may not help, how this risk can be reduced, and how *layer normalization* differs from batch normalization.'],
          topics: [
            { lec: 'L4', slides: [40, 41], name: 'Handling long sequences' },
          ],
          answer: [],
          difficulty: null,
          likelihood: null,
        },
        {
          id: 'b-q2-d',
          label: '(d)',
          marks: 3,
          page: 8,
          lines: 9,
          source: 'new',
          prompt: ['For the Chicago Transit Authority ridership data, a naive forecast that copies the value from one week earlier has a mean absolute error (MAE) of about 43,916 for bus and 42,143 for rail, but a mean absolute percentage error (MAPE) of 8.3% for bus and 9.0% for rail. Explain what *naive forecasting* is and why it is used, and why bus can have the higher MAE but the lower MAPE.'],
          topics: [
            { lec: 'L4', slides: [16, 18], name: 'Naive forecasting · MAE and MAPE' },
          ],
          answer: [],
          difficulty: null,
          likelihood: null,
        },
        {
          id: 'b-q2-e',
          label: '(e)',
          page: 9,
          lines: 11,
          source: 'new',
          prompt: [
            'Given below is the code for an autoencoder trained on a 3D data set `X_train` of shape (60, 3):',
            {
              code: `encoder = tf.keras.models.Sequential([tf.keras.layers.Dense(2)])
decoder = tf.keras.models.Sequential([tf.keras.layers.Dense(3)])
autoencoder = tf.keras.Sequential([encoder, decoder])

optimizer = tf.keras.optimizers.SGD(learning_rate=0.5)
autoencoder.compile(loss="mse", optimizer=optimizer)
history = autoencoder.fit(X_train, X_train, epochs=500, verbose=False)
codings = encoder.predict(X_train)`,
            },
          ],
          subs: [
            {
              id: 'b-q2-e-i',
              label: 'i.',
              marks: 2,
              source: 'new',
              prompt: ['Why is the model trained with `X_train` as both its inputs and its targets, and what is the shape of `codings`?'],
              topics: [
                { lec: 'L5', slides: [4, 6], name: 'Autoencoders · reconstructions' },
                { lec: 'L5', slides: 9, name: 'Codings of the linear AE' },
              ],
              answer: [],
              difficulty: null,
              likelihood: null,
            },
            {
              id: 'b-q2-e-ii',
              label: 'ii.',
              marks: 2,
              source: 'new',
              prompt: ['Why does this autoencoder end up performing principal component analysis (PCA), and why is it called *undercomplete*?'],
              topics: [
                { lec: 'L5', slides: [7, 8], name: 'Undercomplete linear AE = PCA' },
              ],
              answer: [],
              difficulty: null,
              likelihood: null,
            },
          ],
        },
      ],
    },
    {
      id: 'b-q3',
      n: 3,
      parts: [
        {
          id: 'b-q3-a',
          label: '(a)',
          page: 10,
          lines: 14,
          source: 'new',
          prompt: [
            'Given below is a custom layer used in a variational autoencoder (VAE), whose encoder outputs a `mean` and a `logvar` vector for each instance:',
            {
              code: `class Sampling(tf.keras.Layer):
    def call(self, inputs):
        mean, logvar = inputs
        loss = -0.5 * tf.reduce_sum(1 + logvar - tf.exp(logvar) - tf.square(mean), axis=-1)
        self.add_loss(tf.reduce_mean(loss) / 784.)
        return tf.random.normal(tf.shape(logvar)) * tf.exp(logvar / 2) + mean`,
            },
          ],
          subs: [
            {
              id: 'b-q3-a-i',
              label: 'i.',
              marks: 3,
              source: 'new',
              prompt: ['Write down the latent loss computed by the line `loss = ...` as an equation, defining each symbol, and explain why the encoder outputs `logvar` rather than the standard deviation.'],
              topics: [
                { lec: 'L67', slides: [12, 13], name: 'The latent loss' },
                { lec: 'L67', slides: 14, name: 'The Sampling layer' },
              ],
              answer: [],
              difficulty: null,
              likelihood: null,
            },
            {
              id: 'b-q3-a-ii',
              label: 'ii.',
              marks: 2,
              source: 'new',
              prompt: ['Explain what the `return` line computes and how its result is used.'],
              topics: [
                { lec: 'L67', slides: 11, name: 'Mean and standard deviation codings' },
                { lec: 'L67', slides: [14, 15], name: 'Sampling the codings' },
              ],
              answer: [],
              difficulty: null,
              likelihood: null,
            },
          ],
        },
        {
          id: 'b-q3-b',
          label: '(b)',
          page: 11,
          lines: 14,
          source: 'new',
          prompt: [
            'Given below is the generator of a deep convolutional GAN (DCGAN), which takes codings of size 100:',
            {
              code: `generator = tf.keras.Sequential([
    tf.keras.layers.Dense(7 * 7 * 128),
    tf.keras.layers.Reshape([7, 7, 128]),
    tf.keras.layers.BatchNormalization(),
    tf.keras.layers.Conv2DTranspose(64, kernel_size=5, strides=2,
                                    padding="same", activation="relu"),
    tf.keras.layers.BatchNormalization(),
    tf.keras.layers.Conv2DTranspose(1, kernel_size=5, strides=2,
                                    padding="same", activation="tanh"),
])`,
            },
          ],
          subs: [
            {
              id: 'b-q3-b-i',
              label: 'i.',
              marks: 2,
              source: 'new',
              prompt: ['Give the output shape of each layer.'],
              topics: [
                { lec: 'L67', slides: 29, name: 'A DCGAN in Keras' },
                { lec: 'L67', slides: 5, name: 'Transposed convolutions' },
              ],
              answer: [],
              difficulty: null,
              likelihood: null,
            },
            {
              id: 'b-q3-b-ii',
              label: 'ii.',
              marks: 3,
              source: 'new',
              prompt: ['State three of the DCGAN guidelines proposed by Radford et al. that this generator follows, and point to where it follows each one.'],
              topics: [
                { lec: 'L67', slides: 28, name: 'DCGAN guidelines' },
              ],
              answer: [],
              difficulty: null,
              likelihood: null,
            },
          ],
        },
        {
          id: 'b-q3-c',
          label: '(c)',
          marks: 3,
          page: 12,
          lines: 9,
          source: 'new',
          prompt: ['Explain how the encoder and the decoder of a *convolutional autoencoder* change the shape of an image, and which kinds of layers each one uses.'],
          topics: [
            { lec: 'L67', slides: 4, name: 'Convolutional autoencoders' },
            { lec: 'L3', slides: 33, name: 'Typical CNN architecture' },
          ],
          answer: [],
          difficulty: null,
          likelihood: null,
        },
        {
          id: 'b-q3-d',
          label: '(d)',
          marks: 4,
          page: 12,
          lines: 11,
          source: 'new',
          prompt: ['A regular recurrent layer is said to be *causal*. Explain what this means, why a bidirectional recurrent layer is often preferable for tasks such as translation, and how a bidirectional layer combines its outputs.'],
          topics: [
            { lec: 'L8', slides: 6, name: 'Causal recurrent layers' },
            { lec: 'L8', slides: 7, name: 'Bidirectional RNNs' },
          ],
          answer: [],
          difficulty: null,
          likelihood: null,
        },
        {
          id: 'b-q3-e',
          label: '(e)',
          marks: 3,
          page: 13,
          lines: 9,
          source: 'new',
          prompt: ['The original *vision transformer* (ViT) chops an image into 16 × 16 squares. For a 224 × 224 RGB image, how many squares are produced, and how long is the vector that each square becomes? Why did the ViT need over 300 million additional training images to beat the state of the art?'],
          topics: [
            { lec: 'L8', slides: 46, name: 'The vision transformer' },
          ],
          answer: [],
          difficulty: null,
          likelihood: null,
        },
      ],
    },
    {
      id: 'b-q4',
      n: 4,
      parts: [
        {
          id: 'b-q4-a',
          label: '(a)',
          page: 14,
          lines: 11,
          source: 'new',
          prompt: ['A trained *transformer* translates the English sentence "I like soccer" into the Spanish "Me gusta el fútbol".'],
          subs: [
            {
              id: 'b-q4-a-i',
              label: 'i.',
              marks: 2,
              source: 'new',
              prompt: [R`Describe how the decoder produces the translation at inference time, starting from the $\langle\text{SOS}\rangle$ token. How many times is the whole network run to output "Me gusta el fútbol $\langle\text{EOS}\rangle$"?`],
              topics: [
                { lec: 'L8', slides: [41, 42], name: 'Generating a translation' },
              ],
              answer: [],
              difficulty: null,
              likelihood: null,
            },
            {
              id: 'b-q4-a-ii',
              label: 'ii.',
              marks: 2,
              source: 'new',
              prompt: ['Explain what the decoder\'s *masked* multi-head attention layer does, and how it differs from the decoder\'s upper multi-head attention layer.'],
              topics: [
                { lec: 'L8', slides: 31, name: 'Masked multi-head attention' },
                { lec: 'L8', slides: 40, name: 'Cross-attention' },
              ],
              answer: [],
              difficulty: null,
              likelihood: null,
            },
          ],
        },
        {
          id: 'b-q4-b',
          label: '(b)',
          marks: 5,
          page: 15,
          lines: 14,
          source: 'new',
          prompt: [
            R`The diagram below shows a Markov decision process (MDP) with states $s_0$, $s_1$, $s_2$ and actions $a_0$, $a_1$, $a_2$. Each arrow is labelled with its transition probability, and the rewards of the transitions that have one are shown in red.`,
            { fig: 'mdp', desc: 'Figure: from s0, action a0 returns to s0 with probability 0.7 (reward +10) or goes to s1 with 0.3; a1 returns to s0 with 1.0; a2 returns to s0 with 0.8 or goes to s1 with 0.2. From s1, a0 stays in s1 with 1.0; a2 goes to s2 with 1.0 (reward −50). From s2, a1 goes to s0 with 0.8 (reward +40), to s1 with 0.1 and stays in s2 with 0.1.' },
            'The value iteration algorithm updates the state values as follows:',
            { eq: R`V_{k+1}(s) \leftarrow \max_{a} \sum_{s'} T(s, a, s')\,[R(s, a, s') + \gamma V_k(s')] \;\text{ for all } s` },
            R`With $\gamma = 0.9$ and $V_0(s) = 0$ for every state, compute $V_1(s)$ and $V_2(s)$ for all three states.`,
          ],
          topics: [
            { lec: 'L9', slides: 41, name: 'An MDP' },
            { lec: 'L9', slides: [43, 44], name: 'Value iteration' },
          ],
          answer: [],
          difficulty: null,
          likelihood: null,
        },
        {
          id: 'b-q4-c',
          label: '(c)',
          page: 16,
          lines: 9,
          source: 'new',
          prompt: [
            R`Running Q-value iteration to convergence on the same MDP with $\gamma = 0.9$ gives the Q-values below ($-\infty$ marks an action that is not possible in that state):`,
            { table: { head: ['', '$a_0$', '$a_1$', '$a_2$'], rows: [['$s_0$', '18.92', '17.03', '13.62'], ['$s_1$', '0', '$-\\infty$', '−4.88'], ['$s_2$', '$-\\infty$', '50.13', '$-\\infty$']] } },
          ],
          subs: [
            {
              id: 'b-q4-c-i',
              label: 'i.',
              marks: 1,
              source: 'new',
              prompt: [R`Briefly explain what the optimal Q-value $Q^*(s, a)$ means.`],
              topics: [
                { lec: 'L9', slides: 45, name: 'Q-values' },
              ],
              answer: [],
              difficulty: null,
              likelihood: null,
            },
            {
              id: 'b-q4-c-ii',
              label: 'ii.',
              marks: 2,
              source: 'new',
              prompt: [R`Give the optimal policy $\pi^*(s)$ for each state, and explain the choice in state $s_1$.`],
              topics: [
                { lec: 'L9', slides: [46, 49], name: 'The optimal policy' },
              ],
              answer: [],
              difficulty: null,
              likelihood: null,
            },
          ],
        },
        {
          id: 'b-q4-d',
          label: '(d)',
          page: 17,
          lines: 11,
          source: 'new',
          prompt: [
            'Given below is a deep Q-network (DQN) for CartPole (4 observation values, 2 actions), followed by the lines of its training step that compute the target Q-values:',
            {
              code: `model = tf.keras.Sequential([
    tf.keras.layers.Dense(32, activation="elu", input_shape=[4]),
    tf.keras.layers.Dense(32, activation="elu"),
    tf.keras.layers.Dense(2)
])

next_Q_values = model.predict(next_states, verbose=0)
max_next_Q_values = next_Q_values.max(axis=1)
runs = 1.0 - (dones | truncateds)  # episode is not done or truncated
target_Q_values = rewards + runs * discount_factor * max_next_Q_values`,
            },
          ],
          subs: [
            {
              id: 'b-q4-d-i',
              label: 'i.',
              marks: 1,
              source: 'new',
              prompt: ['Compute the number of trainable parameters of the DQN.'],
              topics: [
                { lec: 'L9', slides: 61, name: 'A DQN in Keras' },
                { lec: 'L1', slides: 36, name: 'Dense-layer parameters' },
              ],
              answer: [],
              difficulty: null,
              likelihood: null,
            },
            {
              id: 'b-q4-d-ii',
              label: 'ii.',
              marks: 2,
              source: 'new',
              prompt: [R`Write down the target Q-value $y(s, a)$ as an equation and explain each term.`],
              topics: [
                { lec: 'L9', slides: 60, name: 'The target Q-value' },
                { lec: 'L9', slides: 63, name: 'The training step' },
              ],
              answer: [],
              difficulty: null,
              likelihood: null,
            },
            {
              id: 'b-q4-d-iii',
              label: 'iii.',
              marks: 1,
              source: 'new',
              prompt: ['Compute the target for a transition with reward 1, `discount_factor = 0.95` and next-state Q-values [3.0, 5.0], when the episode has not ended.'],
              topics: [
                { lec: 'L9', slides: [60, 63], name: 'Computing a target' },
              ],
              answer: [],
              difficulty: null,
              likelihood: null,
            },
          ],
        },
        {
          id: 'b-q4-e',
          label: '(e)',
          marks: 4,
          page: 17,
          lines: 11,
          source: 'new',
          prompt: ['*Policy gradient* algorithms optimize a policy\'s parameters by following the gradients toward higher rewards. Briefly explain the four steps of the REINFORCE variant covered in the lecture.'],
          topics: [
            { lec: 'L9', slides: [30, 31], name: 'Policy gradients · REINFORCE' },
          ],
          answer: [],
          difficulty: null,
          likelihood: null,
        },
      ],
    },
  ],
};

// keep the builders imported for the answers that follow validation
export const INK = { w, h, eq, ul, tbl, fig, slip };
