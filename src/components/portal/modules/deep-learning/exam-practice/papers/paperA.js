import { w, h, eq, ul, tbl, fig, slip } from './ink.js';

/* ============================================================================
   EXAM PRACTICE — PRACTICE PAPER A (written for this page)
   ----------------------------------------------------------------------------
   Four questions × 20 marks in the sample paper's format
   (tools/dl-exam-practice/format-spec.md), planned in coverage.md: Q1
   L1–L3 · Q2 L4, L5, L6–7 · Q3 GANs, unsupervised pretraining, attention ·
   Q4 transformer attention and RL. A validator checked every question before
   its answer was written (difficulty and likelihood are its ratings); every
   answer is built from the slides it cites and was checked blind against
   them. Parameter counts are verified in TensorFlow by
   tools/dl-exam-practice/verify_counts.py.
   ========================================================================== */

const R = String.raw;

export const PAPER_A = {
  id: 'A',
  name: 'Practice Paper A',
  tab: 'Practice paper A',
  head: 'Practice Exam Paper A 2026',
  pages: 16,
  cover: {
    contains: 'This practice exam paper contains: **16** pages **(including title page)**',
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
      id: 'a-q1',
      n: 1,
      parts: [
        {
          id: 'a-q1-a',
          label: '(a)',
          marks: 4,
          page: 2,
          lines: 11,
          source: 'new',
          prompt: ['Briefly explain how the backpropagation algorithm trains a multilayer perceptron (MLP). Why did Rumelhart et al. replace the step function with the logistic function in the MLP\'s architecture?'],
          topics: [
            { lec: 'L1', slides: 19, name: 'Backpropagation' },
            { lec: 'L1', slides: 20, name: 'Logistic activation' },
          ],
          answer: [
            w('For each training instance it first makes a **forward pass**, computing the output of every neuron in each layer.', 1),
            w('It measures the network\'s output error, then makes a **reverse pass**: through each layer in reverse, it measures the error contribution from each connection, back to the input layer.', 1),
            w('Finally a **Gradient Descent step** slightly tweaks the connection weights to reduce the error. (Backpropagation is Gradient Descent using reverse-mode autodiff.)', 1),
            w(R`The step function has no gradient to work with, while the logistic function $\sigma(z) = 1/(1 + \exp(-z))$ has a well-defined nonzero derivative everywhere.`, 1),
          ],
          difficulty: 2,
          likelihood: 'high',
        },
        {
          id: 'a-q1-b',
          label: '(b)',
          marks: 4,
          page: 2,
          lines: 11,
          source: 'new',
          prompt: [
            R`Given below are the equations of batch normalization (BN) for a minibatch $B$ of $m_B$ instances:`,
            { eq: R`\boldsymbol{\mu}_B = \frac{1}{m_B}\sum_{i=1}^{m_B}\mathbf{x}^{(i)}` },
            { eq: R`\boldsymbol{\sigma}_B^2 = \frac{1}{m_B}\sum_{i=1}^{m_B}\left(\mathbf{x}^{(i)} - \boldsymbol{\mu}_B\right)^2` },
            { eq: R`\hat{\mathbf{x}}^{(i)} = \frac{\mathbf{x}^{(i)} - \boldsymbol{\mu}_B}{\sqrt{\boldsymbol{\sigma}_B^2 + \epsilon}}` },
            { eq: R`\mathbf{z}^{(i)} = \boldsymbol{\gamma} \otimes \hat{\mathbf{x}}^{(i)} + \boldsymbol{\beta}` },
            R`where $\epsilon$ is a small constant. Briefly explain what $\boldsymbol{\mu}_B$, $\boldsymbol{\sigma}_B^2$, $\hat{\mathbf{x}}^{(i)}$, $\boldsymbol{\gamma}$ and $\boldsymbol{\beta}$ are. What does BN use in place of $\boldsymbol{\mu}_B$ and $\boldsymbol{\sigma}_B^2$ when making predictions on the test set?`,
          ],
          topics: [
            { lec: 'L2', slides: [23, 24], name: 'Batch normalization' },
          ],
          answer: [
            w(R`$\boldsymbol{\mu}_B$ and $\boldsymbol{\sigma}_B^2$: the mean and variance vectors of the inputs, computed over the minibatch $B$.`, 1),
            w(R`$\hat{\mathbf{x}}^{(i)}$: instance $i$'s input, zero-centred and normalized, used inside the BN layer.`, 1),
            w(R`$\boldsymbol{\gamma}$ and $\boldsymbol{\beta}$: the trainable **scale** and **shift** vectors (one parameter per input feature), learned with the weights; $\otimes$ is element-wise multiplication.`, 1),
            w('On the test set BN uses the mean and variance of the entire training set, estimated during training as **moving averages** of the minibatch means and variances.', 1),
          ],
          difficulty: 2,
          likelihood: 'high',
        },
        {
          id: 'a-q1-c',
          label: '(c)',
          marks: 6,
          page: 3,
          lines: 16,
          source: 'new',
          prompt: [
            'Given below is the code for a convolutional neural network:',
            {
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
            'Give the output shape and the number of parameters of each layer, and the total number of parameters in the network. If the `GlobalAveragePooling2D` layer were replaced by a `Flatten` layer, how many parameters would the output layer have?',
          ],
          topics: [
            { lec: 'L3', slides: [15, 16], name: 'Conv-layer weights' },
            { lec: 'L3', slides: 22, name: 'Counting conv parameters' },
            { lec: 'L3', slides: [20, 28], name: 'Padding and pooling shapes' },
            { lec: 'L3', slides: 31, name: 'Global average pooling' },
            { lec: 'L1', slides: 36, name: 'Dense-layer parameters' },
          ],
          answer: [
            tbl(['Layer', 'Output shape', 'Parameters'], [
              ['Conv2D 16, 3 × 3', '(None, 32, 32, 16)', R`$(3 \times 3 \times 3 + 1) \times 16 = 448$`],
              ['MaxPool2D 2 × 2', '(None, 16, 16, 16)', '0'],
              ['Conv2D 32, 3 × 3', '(None, 16, 16, 32)', R`$(3 \times 3 \times 16 + 1) \times 32 = 4640$`],
              ['MaxPool2D 2 × 2', '(None, 8, 8, 32)', '0'],
              ['GlobalAvgPool2D', '(None, 32)', '0'],
              ['Dense 10, softmax', '(None, 10)', R`$32 \times 10 + 10 = 330$`],
            ], 4),
            w(R`“same” padding keeps the height and width; each pooling layer halves them and has no weights. Total $= 448 + 4640 + 330 =$ **5,418**.`, 1),
            w('With `Flatten`: $8 \\times 8 \\times 32 = 2048$ inputs, so the output layer would have $2048 \\times 10 + 10 =$ **20,490** parameters. Global average pooling reduces each feature map to a single number, so it needs far fewer.', 1),
            slip(R`the second Conv2D's filters span all 16 input channels: $3 \times 3 \times 16$ weights per filter, not $3 \times 3 \times 3$.`),
          ],
          difficulty: 3,
          likelihood: 'high',
        },
        {
          id: 'a-q1-d',
          label: '(d)',
          marks: 3,
          page: 4,
          lines: 9,
          source: 'new',
          prompt: ['Explain what the *vanishing gradients* problem is and how it affects the training of a deep neural network. Give two of the causes that Glorot and Bengio identified.'],
          topics: [
            { lec: 'L2', slides: [5, 6], name: 'Vanishing gradients' },
          ],
          answer: [
            w('Gradients get smaller and smaller as the algorithm progresses down to the lower layers, so the Gradient Descent update leaves the lower layers\' weights virtually unchanged: training never converges to a good solution, or converges extremely slowly.', 1),
            w('Two causes identified by Glorot and Bengio:'),
            ul([
              [R`Weights initialized from $N(0, 1)$: the variance of each layer's outputs is much greater than the variance of its inputs.`, 1],
              ['The **logistic** activation has mean 0.5 rather than 0, and saturates at 0 or 1 for large inputs, where its derivative is extremely close to 0.', 1],
            ]),
          ],
          difficulty: 2,
          likelihood: 'high',
        },
        {
          id: 'a-q1-e',
          label: '(e)',
          marks: 3,
          page: 4,
          lines: 9,
          source: 'new',
          prompt: ['Briefly explain how *dropout* works during training and when making predictions. Why can comparing the training loss with the validation loss be misleading when dropout is used?'],
          topics: [
            { lec: 'L2', slides: [62, 64], name: 'Dropout' },
          ],
          answer: [
            w(R`At every training step, every neuron (including the input neurons, but not the output neurons) has a probability $p$, the **dropout rate** (typically 10%–50%), of being temporarily dropped out: ignored for that step, but maybe active in the next.`, 1),
            w('After training, neurons are no longer dropped: predictions use all of them, with the connection weights that have been learned.', 1),
            w('Dropout is only active during training, so the training loss is computed with neurons dropped but the validation loss with all of them: a model may be overfitting the training set and yet have similar training and validation losses. Evaluate the training loss without dropout (e.g. after training).', 1),
          ],
          difficulty: 2,
          likelihood: 'medium',
        },
      ],
    },
    {
      id: 'a-q2',
      n: 2,
      parts: [
        {
          id: 'a-q2-a',
          label: '(a)',
          page: 5,
          lines: 11,
          source: 'new',
          prompt: [
            R`The diagram below shows a layer of recurrent neurons (a memory cell) unrolled through three time steps. At each time step $t$ the layer receives an input vector $\mathbf{x}_{(t)}$ with 3 features, updates its hidden state $\mathbf{h}_{(t)}$ using 6 recurrent neurons, and produces an output vector $\mathbf{y}_{(t)}$ with 1 value.`,
            { fig: 'memCell', desc: 'Figure: three copies of the same memory cell side by side for time steps 0, 1 and 2; each receives x(t) from below and h(t−1) from the cell on its left, passes h(t) to the right, and emits y(t) above.' },
            'Based on the diagram,',
          ],
          subs: [
            {
              id: 'a-q2-a-i',
              label: 'i.',
              marks: 2,
              source: 'new',
              prompt: [R`write down the equations for $\mathbf{h}_{(t)}$ and $\mathbf{y}_{(t)}$, naming each weight matrix and bias vector.`],
              topics: [
                { lec: 'L4', slides: [8, 9], name: 'Memory-cell equations' },
              ],
              answer: [
                eq(R`\mathbf{h}_{(t)}^{\top} = \varphi_h\left(\mathbf{h}_{(t-1)}^{\top}\mathbf{W}_h + \mathbf{x}_{(t)}^{\top}\mathbf{W}_x + \mathbf{b}_h^{\top}\right)`),
                w(R`where $\mathbf{W}_x$ (input weights), $\mathbf{W}_h$ (recurrent weights on $\mathbf{h}_{(t-1)}$) and the bias $\mathbf{b}_h$ are learned; $\varphi_h$ is e.g. tanh.`, 1),
                eq(R`\mathbf{y}_{(t)}^{\top} = \varphi_y\left(\mathbf{h}_{(t)}^{\top}\mathbf{W}_y + \mathbf{b}_y^{\top}\right)`),
                w(R`where $\mathbf{W}_y$ (output weights) and the bias $\mathbf{b}_y$ are learned; $\varphi_y$ is the output activation.`, 1),
              ],
              difficulty: 2,
              likelihood: 'high',
            },
            {
              id: 'a-q2-a-ii',
              label: 'ii.',
              marks: 2,
              source: 'new',
              prompt: ['give the shape of each weight matrix and bias vector in your equations of part i., and the total number of parameters in the cell.'],
              topics: [
                { lec: 'L4', slides: [9, 10], name: 'Memory-cell dimensions' },
              ],
              answer: [
                tbl(['', 'Shape', 'Parameters'], [
                  [R`$\mathbf{W}_x$`, '3 × 6', '18'],
                  [R`$\mathbf{W}_h$`, '6 × 6', '36'],
                  [R`$\mathbf{b}_h$`, '6', '6'],
                  [R`$\mathbf{W}_y$`, '6 × 1', '6'],
                  [R`$\mathbf{b}_y$`, '1', '1'],
                ], 1),
                w(R`Total $= 18 + 36 + 6 + 6 + 1 =$ **67** parameters, shared by every time step.`, 1),
                w(R`(With column vectors, $\mathbf{W}_x \mathbf{x}_{(t)}$, each shape is transposed; the total is the same.)`),
              ],
              difficulty: 3,
              likelihood: 'medium',
            },
          ],
        },
        {
          id: 'a-q2-b',
          label: '(b)',
          marks: 4,
          page: 6,
          lines: 11,
          source: 'new',
          prompt: ['Recurrent neural networks can be set up with four different configurations of input and output sequences. Name each configuration and give an example application of each.'],
          topics: [
            { lec: 'L4', slides: [12, 13], name: 'Input and output sequences' },
          ],
          answer: [
            ul([
              [R`**Sequence-to-sequence**: a sequence in, a sequence out, e.g. $N$ days of stock prices in, the series shifted one day ahead (up to tomorrow) out.`, 1],
              ['**Sequence-to-vector**: only the output at the last step is kept, e.g. the words of a movie review in, a sentiment score (0 bad … 4 good) out.', 1],
              [R`**Vector-to-sequence**: a single input at $t = 0$ (zeros afterwards), a sequence out, e.g. an image in, its caption out.`, 1],
              ['**Encoder–decoder**: a sequence-to-vector encoder followed by a vector-to-sequence decoder, e.g. translating a sentence into another language.', 1],
            ]),
          ],
          difficulty: 1,
          likelihood: 'high',
        },
        {
          id: 'a-q2-c',
          label: '(c)',
          marks: 4,
          page: 6,
          lines: 11,
          source: 'new',
          prompt: [
            'A colleague trains the model below to forecast tomorrow\'s number of rail riders (in millions, with values from 0 to about 1.4) from the previous 56 days:',
            {
              code: `model = tf.keras.Sequential([
    tf.keras.layers.InputLayer(shape=[None, 1]),
    tf.keras.layers.SimpleRNN(1)
])`,
            },
            'Its validation error is very large. Give two reasons why, and describe how you would change the model to fix both problems.',
          ],
          topics: [
            { lec: 'L4', slides: [24, 27], name: 'Forecasting with a simple RNN' },
          ],
          answer: [
            w('The model has a **single recurrent neuron** and only 3 parameters, so its memory is extremely limited.', 1),
            w('SimpleRNN\'s default activation is **tanh**, so it can only output values between −1 and +1: it can never predict values between 1.0 and 1.4.', 1),
            w('Fix: use a larger recurrent layer, e.g. `SimpleRNN(32)`,', 1),
            w('followed by a dense output layer with a single neuron and **no activation function**, `Dense(1)`, so the output isn\'t limited to (−1, 1).', 1),
          ],
          difficulty: 2,
          likelihood: 'medium',
        },
        {
          id: 'a-q2-d',
          label: '(d)',
          marks: 4,
          page: 7,
          lines: 11,
          source: 'new',
          prompt: [
            'When a stacked autoencoder is symmetrical, a common technique is to *tie the weights* of its decoder layers to those of its encoder layers:',
            { eq: R`\mathbf{W}_{N-\ell+1} = \mathbf{W}_{\ell}^{\top} \quad \text{with } \ell = 1, 2, \cdots, N/2` },
            R`Explain what $N$, $\ell$ and $\mathbf{W}_{\ell}$ denote, and give one benefit of tying the weights. A tied autoencoder for Fashion MNIST has Dense layers of 256, 64, 256 and 784 units on the flattened 784-pixel input, and every layer has its own bias terms. How many parameters must be learned?`,
          ],
          topics: [
            { lec: 'L5', slides: [18, 21], name: 'Tying the weights' },
          ],
          answer: [
            w(R`$N$: the total number of layers, not counting the input layer; $\ell$: a layer number, from the first hidden layer ($\ell = 1$) to the coding layer ($\ell = N/2$); $\mathbf{W}_{\ell}$: the connection weights of the $\ell$th layer.`, 1),
            w('Each decoder layer reuses the transposed weights of the matching encoder layer, which **halves the number of weights**: training is faster and the risk of overfitting is lower.', 1),
            tbl(['Layer', 'Parameters to learn'], [
              ['Dense 256', R`$784 \times 256 + 256 = 200{,}960$`],
              ['Dense 64 (codings)', R`$256 \times 64 + 64 = 16{,}448$`],
              [R`Dense 256, tied to $\mathbf{W}_2^{\top}$`, 'biases only: 256'],
              [R`Dense 784, tied to $\mathbf{W}_1^{\top}$`, 'biases only: 784'],
            ], 1),
            w('Total $=$ **218,448** (untied, it would be 435,536).', 1),
          ],
          difficulty: 3,
          likelihood: 'medium',
        },
        {
          id: 'a-q2-e',
          label: '(e)',
          marks: 4,
          page: 7,
          lines: 11,
          source: 'new',
          prompt: ['Explain how a *denoising autoencoder* is trained, and describe two ways of adding the noise. How does its use of randomness differ from that of a variational autoencoder?'],
          topics: [
            { lec: 'L67', slides: [8, 10], name: 'Denoising autoencoders' },
            { lec: 'L5', slides: 6, name: 'Reconstruction loss' },
          ],
          answer: [
            w('Noise is added to its inputs, and it is trained to recover the original, **noise-free** inputs: the clean inputs are the targets of the reconstruction loss.', 1),
            w('Noise option 1: pure **Gaussian noise** added to the inputs.', 1),
            w('Noise option 2: randomly **switched-off inputs**, just like dropout (e.g. a `Dropout(0.5)` layer before the first hidden layer).', 1),
            w('A denoising autoencoder uses randomness only during training; a VAE is probabilistic: its outputs are partly determined by chance, **even after training**.', 1),
          ],
          difficulty: 2,
          likelihood: 'medium',
        },
      ],
    },
    {
      id: 'a-q3',
      n: 3,
      parts: [
        {
          id: 'a-q3-a',
          label: '(a)',
          marks: 4,
          page: 8,
          lines: 15,
          source: 'new',
          prompt: [
            'Given below is the code for a generative adversarial network (GAN) that generates 28 × 28 images. During training, the generator is fed batches of random Gaussian codings of size `codings_size`:',
            {
              code: `codings_size = 20
generator = tf.keras.Sequential([
    tf.keras.layers.Dense(64, activation="relu"),
    tf.keras.layers.Dense(28 * 28, activation="sigmoid"),
    tf.keras.layers.Reshape([28, 28])
])
discriminator = tf.keras.Sequential([
    tf.keras.layers.Flatten(),
    tf.keras.layers.Dense(64, activation="relu"),
    tf.keras.layers.Dense(1, activation="sigmoid")
])
gan = tf.keras.Sequential([generator, discriminator])`,
            },
            'Draw a diagram to illustrate the GAN, showing the shape of the data passed between its parts. Compute the number of trainable parameters in the generator and in the discriminator.',
          ],
          topics: [
            { lec: 'L67', slides: [19, 20], name: 'Generator and discriminator' },
            { lec: 'L67', slides: [23, 25], name: 'A GAN in Keras' },
            { lec: 'L1', slides: 36, name: 'Dense-layer parameters' },
          ],
          answer: [
            fig('aGan', 'Sketch: noise codings (batch, 20) → generator: Dense 64 ReLU → (batch, 64) → Dense 784 sigmoid → (batch, 784) → Reshape → fake images (batch, 28, 28); fake and real images (batch, 28, 28) → discriminator: Flatten → (batch, 784) → Dense 64 ReLU → (batch, 64) → Dense 1 sigmoid → (batch, 1), the probability that each image is real.', 2),
            w(R`Generator: $20 \times 64 + 64 = 1344$ and $64 \times 784 + 784 = 50{,}960$, so **52,304**.`, 1),
            w(R`Discriminator: $784 \times 64 + 64 = 50{,}240$ and $64 \times 1 + 1 = 65$, so **50,305**.`, 1),
          ],
          difficulty: 3,
          likelihood: 'high',
        },
        {
          id: 'a-q3-b',
          label: '(b)',
          marks: 5,
          page: 9,
          lines: 14,
          source: 'new',
          prompt: ['A GAN cannot be trained like a regular neural network: each training iteration has two phases. Explain both phases, including what makes up each batch, the labels and the loss used, and which weights are updated.'],
          topics: [
            { lec: 'L67', slides: [21, 22], name: 'The two training phases' },
            { lec: 'L67', slides: [24, 25], name: 'The custom training loop' },
          ],
          answer: [
            h('Phase 1: train the discriminator'),
            w('A batch of real images from the training set, completed with an equal number of fake images from the generator.', 1),
            w('Labels: 0 for fake, 1 for real; one training step with the **binary cross-entropy** loss.', 1),
            w('Backpropagation only updates the **discriminator\'s** weights.', 1),
            h('Phase 2: train the generator'),
            w('A new batch of fake images only, from new Gaussian noise (no real images), all labelled **1 (real)** and passed through the whole GAN with the same **binary cross-entropy** loss: we want the discriminator to (wrongly) believe they are real.', 1),
            w('The discriminator\'s weights are **frozen**, so backpropagation through the GAN only updates the generator\'s weights.', 1),
          ],
          difficulty: 3,
          likelihood: 'high',
        },
        {
          id: 'a-q3-c',
          label: '(c)',
          marks: 3,
          page: 10,
          lines: 9,
          source: 'new',
          prompt: ['List three difficulties of training GANs and briefly explain each.'],
          topics: [
            { lec: 'L67', slides: 27, name: 'Difficulties of training GANs' },
          ],
          answer: [
            ul([
              ['**Nash equilibrium**: a GAN can only reach a single Nash equilibrium (no player better off changing strategy), but nothing guarantees it will ever be reached.', 1],
              ['**Mode collapse** (the biggest difficulty): the generator\'s outputs gradually become less diverse, only producing images of one class.', 1],
              ['**Instability**: the generator and discriminator constantly push against each other, so their parameters may oscillate and become unstable.', 1],
            ]),
          ],
          difficulty: 1,
          likelihood: 'high',
        },
        {
          id: 'a-q3-d',
          label: '(d)',
          marks: 4,
          page: 10,
          lines: 11,
          source: 'new',
          prompt: ['You have a large set of images, but only a few of them are labelled. Explain how a stacked autoencoder can be used for *unsupervised pretraining* of a classifier, and why this helps.'],
          topics: [
            { lec: 'L5', slides: [16, 17], name: 'Unsupervised pretraining' },
            { lec: 'L2', slides: 30, name: 'Reusing lower layers' },
          ],
          answer: [
            w('**Phase 1**: train a stacked autoencoder using **all** the images; this needs no labels.', 1),
            w('**Phase 2**: reuse its lower layers (e.g. Hidden 1 and Hidden 2, with their parameters copied) as the lower layers of the classifier,', 1),
            w('add an output (softmax) layer, and train the classifier on the few **labelled** images.', 1),
            w('It helps because the network then has fewer layers that require training, so it can cope with fewer labelled training data.', 1),
          ],
          difficulty: 2,
          likelihood: 'high',
        },
        {
          id: 'a-q3-e',
          label: '(e)',
          page: 11,
          lines: 11,
          source: 'new',
          prompt: [
            R`The diagram below shows the alignment model of *Bahdanau attention* at decoder time step 3. A Dense layer with a single neuron scores the decoder's previous hidden state $\mathbf{h}_{(2)}$ against each encoder output $\mathbf{y}_{(i)}$, and a softmax layer turns the scores $e_{(3,i)}$ into the weights $\alpha_{(3,i)}$.`,
            { fig: 'bahdanau', desc: 'Figure: the decoder state h(2) is paired with each encoder output y(0), y(1), y(2); each pair goes into the same one-neuron Dense layer, giving scores e(3,0), e(3,1), e(3,2); a softmax layer turns the three scores into the weights α(3,0), α(3,1), α(3,2).' },
            'Based on the diagram,',
          ],
          subs: [
            {
              id: 'a-q3-e-i',
              label: 'i.',
              marks: 2,
              source: 'new',
              prompt: [R`write down the equation for the attention weights $\alpha_{(t,i)}$ in terms of the scores $e_{(t,i)}$, and the equation for the weighted sum $\widetilde{\mathbf{h}}_{(t)}$ of the encoder outputs that the decoder uses.`],
              topics: [
                { lec: 'L8', slides: [20, 22], name: 'Attention weights' },
                { lec: 'L8', slides: 25, name: 'Weighted sum of encoder outputs' },
              ],
              answer: [
                eq(R`\alpha_{(t,i)} = \frac{\exp\left(e_{(t,i)}\right)}{\sum_{i'} \exp\left(e_{(t,i')}\right)}`, 1),
                eq(R`\widetilde{\mathbf{h}}_{(t)} = \sum_{i} \alpha_{(t,i)}\, \mathbf{y}_{(i)}`, 1),
              ],
              difficulty: 3,
              likelihood: 'medium',
            },
            {
              id: 'a-q3-e-ii',
              label: 'ii.',
              marks: 2,
              source: 'new',
              prompt: ['why is Bahdanau attention also called *additive* (or *concatenative*) attention, and how does Luong\'s dot-product attention compute the score instead?'],
              topics: [
                { lec: 'L8', slides: [23, 25], name: 'Additive vs multiplicative attention' },
              ],
              answer: [
                w('It **concatenates** each encoder output $\\mathbf{y}_{(i)}$ with the decoder\'s previous hidden state and scores the pair with the Dense layer (the alignment model), hence *concatenative* (or *additive*) attention.', 1),
                w(R`Luong (multiplicative) attention takes the **dot product**, $e_{(t,i)} = \mathbf{h}_{(t)}^{\top}\mathbf{y}_{(i)}$: often a good similarity measure, and fast to compute; the vectors must have the same length.`, 1),
              ],
              difficulty: 2,
              likelihood: 'high',
            },
          ],
        },
      ],
    },
    {
      id: 'a-q4',
      n: 4,
      parts: [
        {
          id: 'a-q4-a',
          label: '(a)',
          page: 12,
          lines: 14,
          source: 'new',
          prompt: [
            'Given below is the scaled dot-product attention used in the *transformer*:',
            { eq: R`\text{Attention}(\mathbf{Q}, \mathbf{K}, \mathbf{V}) = \text{softmax}\left(\frac{\mathbf{Q}\mathbf{K}^{\top}}{\sqrt{d_{\text{keys}}}}\right)\mathbf{V}` },
          ],
          subs: [
            {
              id: 'a-q4-a-i',
              label: 'i.',
              marks: 2,
              source: 'new',
              prompt: [R`Briefly explain what $\mathbf{Q}$, $\mathbf{K}$ and $\mathbf{V}$ contain, and why the similarity scores are divided by $\sqrt{d_{\text{keys}}}$.`],
              topics: [
                { lec: 'L8', slides: [27, 28], name: 'Queries, keys and values' },
                { lec: 'L8', slides: 31, name: 'Self-attention' },
                { lec: 'L8', slides: [37, 38], name: 'Scaled dot-product attention' },
                { lec: 'L8', slides: 40, name: 'Cross-attention' },
              ],
              answer: [
                w(R`$\mathbf{Q}$ holds the **queries**, one row per query, $[n_{\text{queries}}, d_{\text{keys}}]$; $\mathbf{K}$ the **keys**, $[n_{\text{keys}}, d_{\text{keys}}]$, and $\mathbf{V}$ the **values**, $[n_{\text{keys}}, d_{\text{values}}]$. Like a dictionary lookup: each query is matched against every key and returns a weighted sum of the values. In the decoder's cross-attention layer the queries come from the decoder and the keys and values from the encoder's outputs; in a self-attention layer (the encoder's, or the decoder's masked one) all three come from the same sentence.`, 1),
                w(R`Dividing by $\sqrt{d_{\text{keys}}}$ scales down the scores to avoid saturating the softmax function, which would lead to tiny gradients.`, 1),
              ],
              difficulty: 2,
              likelihood: 'high',
            },
            {
              id: 'a-q4-a-ii',
              label: 'ii.',
              marks: 2,
              source: 'new',
              prompt: [R`In a cross-attention layer, 4 decoder words (the queries) attend to an encoder sentence of 6 words (the keys), with $d_{\text{keys}} = 64$ and $d_{\text{values}} = 32$. Give the shapes of $\mathbf{Q}$, $\mathbf{K}$, $\mathbf{V}$ and $\mathbf{Q}\mathbf{K}^{\top}$.`],
              topics: [
                { lec: 'L8', slides: [37, 38], name: 'Attention shapes' },
                { lec: 'L8', slides: 40, name: 'Cross-attention' },
              ],
              answer: [
                tbl(['', 'Shape', 'Rule'], [
                  [R`$\mathbf{Q}$`, '[4, 64]', R`$[n_{\text{queries}}, d_{\text{keys}}]$`],
                  [R`$\mathbf{K}$`, '[6, 64]', R`$[n_{\text{keys}}, d_{\text{keys}}]$`],
                  [R`$\mathbf{V}$`, '[6, 32]', R`$[n_{\text{keys}}, d_{\text{values}}]$`],
                  [R`$\mathbf{Q}\mathbf{K}^{\top}$`, '[4, 6]', R`$[n_{\text{queries}}, n_{\text{keys}}]$`],
                ], 2),
                slip(R`$\mathbf{V}$ has one row per **key** (6), not per query.`),
              ],
              difficulty: 3,
              likelihood: 'medium',
            },
            {
              id: 'a-q4-a-iii',
              label: 'iii.',
              marks: 1,
              source: 'new',
              prompt: [R`For the layer in ii., give the shape of $\text{Attention}(\mathbf{Q}, \mathbf{K}, \mathbf{V})$ and the number by which the similarity scores are divided.`],
              topics: [
                { lec: 'L8', slides: [37, 38], name: 'Attention output' },
              ],
              answer: [
                w(R`Output $[n_{\text{queries}}, d_{\text{values}}] =$ **[4, 32]**, one weighted sum of the values per query; the scores are divided by $\sqrt{64} =$ **8**.`, 1),
                w(R`(Slide 38's bullet prints the factor as $1/d_{\text{keys}}$; the equation has the square root.)`),
              ],
              difficulty: 2,
              likelihood: 'medium',
            },
          ],
        },
        {
          id: 'a-q4-b',
          label: '(b)',
          marks: 4,
          page: 13,
          lines: 11,
          source: 'new',
          prompt: [R`An agent takes actions at steps 0, 1 and 2 and receives rewards of $+10$, $0$ and $-50$ respectively, after which the episode ends. With a discount rate $\gamma = 0.9$, compute the *return* (the sum of discounted future rewards) of each of the three actions. Briefly explain the *credit assignment problem* that these returns are used to address.`],
          topics: [
            { lec: 'L9', slides: [26, 28], name: 'Credit assignment · discounted rewards' },
          ],
          answer: [
            w(R`Work backwards: each return is the action's reward plus $\gamma$ times the next return. Step 2: $-50$; step 1: $0 + 0.9 \times (-50) = -45$.`, 1),
            w(R`Step 0: $10 + 0.9 \times (-45) =$ **−30.5** (the same as $10 + 0.9 \times 0 + 0.9^2 \times (-50)$).`, 1),
            w('**Credit assignment problem**: rewards are sparse and delayed, so when the agent gets a reward it is hard to know which actions should get credited (or blamed) for it.', 1),
            w(R`So each action is evaluated by the sum of all the rewards that come after it, discounted by $\gamma$ at each step.`, 1),
          ],
          difficulty: 2,
          likelihood: 'high',
        },
        {
          id: 'a-q4-c',
          label: '(c)',
          page: 13,
          lines: 11,
          source: 'new',
          prompt: [
            'Given below is the update of the *Q-learning* algorithm:',
            { eq: R`Q_{k+1}(s, a) \leftarrow (1 - \alpha)\, Q_k(s, a) + \alpha\left(r + \gamma \max_{a'} Q_k(s', a')\right)` },
          ],
          subs: [
            {
              id: 'a-q4-c-i',
              label: 'i.',
              marks: 2,
              source: 'new',
              prompt: [R`Briefly explain what $\alpha$ and the term $r + \gamma \max_{a'} Q_k(s', a')$ represent, and why the maximum over $a'$ is taken.`],
              topics: [
                { lec: 'L9', slides: 53, name: 'Q-learning' },
              ],
              answer: [
                w(R`$\alpha$ is the learning rate (e.g. 0.01). $r + \gamma \max_{a'} Q_k(s', a')$ is the reward $r$ observed on leaving $s$ with $a$, plus the discounted rewards it expects later; $Q$ keeps a running average of it.`, 1),
                w(R`The maximum over $a'$ is taken because the target policy would act **optimally** from the next state $s'$.`, 1),
              ],
              difficulty: 2,
              likelihood: 'high',
            },
            {
              id: 'a-q4-c-ii',
              label: 'ii.',
              marks: 2,
              source: 'new',
              prompt: [R`An agent in state $s_1$ takes action $a_2$, receives a reward $r = -50$ and lands in state $s_2$, where the only possible action is $a_1$, with $Q_k(s_2, a_1) = 40$. If $Q_k(s_1, a_2) = 0$, $\alpha = 0.1$ and $\gamma = 0.9$, compute $Q_{k+1}(s_1, a_2)$.`],
              topics: [
                { lec: 'L9', slides: 53, name: 'A Q-learning update' },
              ],
              answer: [
                eq(R`Q_{k+1}(s_1, a_2) = (1 - 0.1) \times 0 + 0.1 \times \left(-50 + 0.9 \times 40\right)`, 1),
                w(R`$= 0.1 \times (-14) =$ **−1.4**`, 1),
              ],
              difficulty: 2,
              likelihood: 'medium',
            },
          ],
        },
        {
          id: 'a-q4-d',
          label: '(d)',
          marks: 3,
          page: 14,
          lines: 9,
          source: 'new',
          prompt: [R`Explain the $\epsilon$-greedy policy used to explore during Q-learning, and why $\epsilon$ is gradually reduced during training. Is Q-learning an *on-policy* or an *off-policy* algorithm? Briefly explain.`],
          topics: [
            { lec: 'L9', slides: [56, 57], name: 'ε-greedy · off-policy' },
          ],
          answer: [
            w(R`With probability $\epsilon$ the agent explores randomly; with probability $1 - \epsilon$ it acts greedily, choosing the action with the highest Q-value.`, 1),
            w(R`$\epsilon$ starts close to 1, so the MDP is explored thoroughly, and is gradually reduced to a small value (e.g. 0.05), so the agent becomes more greedy as its Q-values improve.`, 1),
            w('**Off-policy**: the policy being trained is not necessarily the one used during training (it can even learn by watching an agent act randomly).', 1),
          ],
          difficulty: 2,
          likelihood: 'high',
        },
        {
          id: 'a-q4-e',
          label: '(e)',
          marks: 4,
          page: 14,
          lines: 15,
          source: 'new',
          prompt: [
            'Given below is the code for a neural network policy for the CartPole environment, whose observations have 4 values and whose two actions are 0 (accelerate left) and 1 (accelerate right):',
            {
              code: `n_inputs = 4
model = tf.keras.models.Sequential([
    tf.keras.layers.Dense(5, activation="relu", input_shape=[n_inputs]),
    tf.keras.layers.Dense(1, activation="sigmoid"),
])`,
            },
            'Draw a diagram of the network, showing the number of neurons and the activation function in each layer. Explain why a single output neuron with a sigmoid activation is enough for the two actions, and how the agent chooses an action from the network\'s output.',
          ],
          topics: [
            { lec: 'L9', slides: [23, 25], name: 'Neural network policies' },
            { lec: 'L1', slides: 29, name: 'One logistic neuron for two classes' },
          ],
          answer: [
            fig('aPolicy', 'Sketch: 4 observation inputs, fully connected to 5 hidden neurons with ReLU, fully connected to 1 output neuron with sigmoid, which outputs p, the probability of action 0 (left).', 2),
            w(R`The output neuron gives $p$, the probability of action 0 (left), so action 1 (right) has probability $1 - p$: as in binary classification, one output neuron with the logistic (sigmoid) activation is sufficient.`, 1),
            w(R`The agent **samples** an action at random according to $p$ rather than always taking the likelier one: the exploration/exploitation trade-off.`, 1),
            slip('the lecture\'s Figure 18-5 draws 4 hidden neurons, but this code has 5: draw what the code says.'),
          ],
          difficulty: 2,
          likelihood: 'medium',
        },
      ],
    },
  ],
};
