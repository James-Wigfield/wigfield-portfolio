import { w, h, eq, ul, tbl, fig, slip } from './ink.js';

/* ============================================================================
   EXAM PRACTICE — THE OFFICIAL SAMPLE PAPER (sampleExam2026-s2.pdf)
   ----------------------------------------------------------------------------
   Every question and part, verbatim from the page images, typos included
   ("Explain what are involved…", "Given below are the update…", "Explain yur
   answer"). Pages, ruled-line counts and the order of things follow the
   PDF; the figures are rebuilt as SVG in ../figures.jsx. The model answers
   are this page's own, built from the slides and cited under each answer.
   tools/dl-exam-practice/sample-verbatim.txt holds an independent plain-text
   transcription that check-papers.mjs compares these prompts against.
   ========================================================================== */

const R = String.raw;

export const SAMPLE = {
  id: 'sample',
  name: 'Sample Paper',
  tab: 'Sample paper',
  head: 'Sample Exam Paper 2026',
  pages: 10,
  cover: {
    contains: 'This sample exam paper contains: **10** pages **(including title page)**',
    instructions: [
      'This paper contains 2 questions, each is worth 20 marks.',
      '(The actual exam paper will have 4 questions, each is worth 20 marks. **Total : 80 marks**.\nThe duration of the actual exam is 2 hours.\nIt is a **closed book** exam).',
      'Candidate should attempt ALL questions.',
      'Answers are to be written on this question paper in the spaces provided.',
    ],
    materialsLead: 'Materials permitted in the actual exam:',
    materials: ['1 UWA approved calculator with sticker.'],
  },
  questions: [
    {
      id: 's-q1',
      n: 1,
      parts: [
        {
          id: 's-q1-a',
          label: '(a)',
          marks: 4,
          page: 2,
          lines: 11,
          source: 'sample',
          prompt: ['Explain what are involved in a Convolutional layer. Include in your explanation the parameters that define the layer.'],
          topics: [
            { lec: 'L3', slides: [7, 16], name: 'Convolutional layers' },
            { lec: 'L3', slides: 32, name: 'Conv-layer hyperparameters' },
          ],
          answer: [
            w('A conv layer applies a set of $K$ filters to its input. Each neuron is connected only to the neurons in its small **receptive field** in the previous layer (across all of that layer\'s feature maps), not to every pixel.', 1),
            w('Each filter $f_k$ ($n_h \\times n_w \\times N_{\\text{channels}}$) slides over the input with a stride; with its bias $b_k$ it gives one **feature map**, and all neurons in that map share the same weights and bias:', 0),
            eq(R`\mathbf{z}_k = b_k + \sum_{c=0}^{N_{\text{channels}}-1} \mathbf{x}_c * f_{c,k}`, 1),
            w('($*$ is the convolution, $\\mathbf{x}_c$ channel $c$ of the input, $f_{c,k}$ channel $c$ of filter $f_k$.) $K$ filters give $K$ feature maps, so the output has $K$ channels. Weights: a 4D tensor $[f_h, f_w, f_c, f_n]$ ($f_n = K$), plus one bias per filter.', 1),
            w('Defined by: the **number of filters**, their **height and width** (kernel size), the **strides**, and the **padding** ("same" or "valid"), plus the activation function.', 1),
          ],
          difficulty: 3,
          likelihood: 'high',
        },
        {
          id: 's-q1-b',
          label: '(b)',
          marks: 4,
          page: 2,
          lines: 10,
          source: 'sample',
          prompt: ['List two advantages of using a CNN over a fully connected MLP for image classification.'],
          topics: [
            { lec: 'L3', slides: [7, 8], name: 'Local receptive fields' },
            { lec: 'L3', slides: 13, name: 'Shared filters' },
            { lec: 'L3', slides: 22, name: 'Conv vs fully connected parameters' },
          ],
          answer: [
            h('1. Far fewer parameters'),
            w('Each neuron sees only its receptive field and every neuron in a feature map **shares** the same filter.', 1),
            w('One $3 \\times 3$ filter on one feature map needs only 9 weights + 1 bias, whatever the map\'s height and width ($3 \\times 3 \\times 3 + 1 = 28$ on an RGB image); a fully connected layer needs a weight from every pixel to every neuron (675 million for a $150 \\times 100$ RGB image). So far less RAM and computation, and less risk of overfitting.', 1),
            h('2. Detects local features anywhere, as a hierarchy'),
            w('The same filter is applied at every position, so a feature (e.g. an edge) is detected **anywhere** in the image.', 1),
            w('Stacked conv layers learn low-level features in the first layer, then assemble them into **higher-level features** in the next, and so on.', 1),
          ],
          difficulty: 2,
          likelihood: 'high',
        },
        {
          id: 's-q1-c',
          label: '(c)',
          marks: 6,
          page: 3,
          lines: 16,
          source: 'sample',
          prompt: [
            'Given below is the code for a deep neural network:',
            {
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
            'Draw a diagram to illustrate the architecture of the network. Compute the number of trainable parameters in each layer and the total number of trainable parameters in the network. For what problem would it be suitable to use this network?',
          ],
          topics: [
            { lec: 'L1', slides: [43, 45], name: 'Functional API · Wide & Deep' },
            { lec: 'L1', slides: 29, name: 'Classification MLPs' },
          ],
          answer: [
            fig('sWideDeep', 'Diagram: Input (10) → Normalization (10); the deep path goes Normalization → Dense 20, GELU → Concat; the wide path goes Normalization straight to Concat (10 + 20 = 30) → Dense 3, softmax → output.', 2),
            tbl(['Layer', 'Output', 'Trainable parameters'], [
              ['Input', '(None, 10)', '0'],
              ['Normalization', '(None, 10)', '0 (+21 non-trainable)'],
              ['Dense 20, GELU', '(None, 20)', '$10 \\times 20 + 20 = 220$'],
              ['Concatenate', '(None, 30)', '0'],
              ['Dense 3, softmax', '(None, 3)', '$30 \\times 3 + 3 = 93$'],
            ], 2),
            w('Total trainable $= 220 + 93 =$ **313**. (Normalization\'s 21 = 10 means + 10 variances + 1 count, all non-trainable: 334 parameters in all.)', 1),
            w('Suits **multiclass classification** into 3 mutually exclusive classes from 10 input features (structured data): softmax makes the 3 outputs probabilities that sum to 1. The wide path learns simple rules, the deep path deep patterns.', 1),
            slip('counting the Normalization layer\'s 21 statistics as trainable; `model.summary()` lists them as non-trainable.'),
          ],
          difficulty: 4,
          likelihood: 'high',
        },
        {
          id: 's-q1-d',
          label: '(d)',
          marks: 3,
          page: 4,
          lines: 21,
          source: 'sample',
          prompt: [
            R`Given below are the update of the variable $\boldsymbol{\theta}$ (containing the model parameters) for the classical Gradient Descent optimizer:`,
            { eq: R`\boldsymbol{\theta} \leftarrow \boldsymbol{\theta} - \eta \nabla_{\boldsymbol{\theta}} J(\boldsymbol{\theta})` },
            'Briefly explain what each term means and how the optimizer works.',
          ],
          topics: [
            { lec: 'L2', slides: 34, name: 'Gradient descent' },
            { lec: 'L1', slides: 10, name: 'Learning rate' },
          ],
          answer: [
            w(R`$\boldsymbol{\theta}$: the vector of model parameters (the weights). $J(\boldsymbol{\theta})$: the error or loss we try to minimise.`, 1),
            w(R`$\nabla_{\boldsymbol{\theta}} J(\boldsymbol{\theta})$: the gradient of the loss with respect to $\boldsymbol{\theta}$. $\eta$: the learning rate (the step size).`, 1),
            w('Each iteration it computes the gradient at the current $\\boldsymbol{\\theta}$ and steps $\\eta$ times it in the **opposite** direction, so the loss goes down; repeat until it converges. It ignores earlier gradients, so where the gradient is tiny it moves very slowly.', 1),
          ],
          difficulty: 1,
          likelihood: 'high',
        },
        {
          id: 's-q1-e',
          label: '(e)',
          page: 5,
          lines: 14,
          source: 'sample',
          prompt: [
            'The diagram below is a small module of a large DNN:',
            { fig: 'gate', desc: 'Figure: inside a rounded box, x(t) feeds two FC blocks; the left FC (logistic) outputs g(t), the right FC (ReLU) outputs h(t); g(t) and h(t) meet at an element-wise multiplication whose output is z(t). Legend: logistic, ReLU, element-wise multiplication.' },
            'where each of the FC blocks is just a linear layer consisting of a weight matrix and a bias term. Based on the given diagram,',
          ],
          subs: [
            {
              id: 's-q1-e-i',
              label: 'i.',
              marks: 2,
              source: 'sample',
              prompt: [R`write down the equations for $\mathbf{g}_{(t)}$ and $\mathbf{h}_{(t)}$, and then the equation for $\mathbf{z}_{(t)}$.`],
              topics: [
                { lec: 'L4', slides: 47, name: 'Gate equations' },
                { lec: 'L1', slides: [20, 21], name: 'Logistic and ReLU' },
              ],
              answer: [
                eq(R`\mathbf{g}_{(t)}^{\top} = \sigma\left(\mathbf{x}_{(t)}^{\top}\mathbf{W}_{xg} + \mathbf{b}_{g}^{\top}\right) \qquad \mathbf{h}_{(t)}^{\top} = \mathrm{ReLU}\left(\mathbf{x}_{(t)}^{\top}\mathbf{W}_{xh} + \mathbf{b}_{h}^{\top}\right)`, 1),
                eq(R`\mathbf{z}_{(t)} = \mathbf{g}_{(t)} \otimes \mathbf{h}_{(t)}`, 1),
                w(R`$\sigma(z) = 1/(1 + \exp(-z))$ is the logistic function, $\mathrm{ReLU}(z) = \max(0, z)$, and $\otimes$ is element-wise multiplication.`),
                slip('adding an $\\mathbf{h}_{(t-1)}$ term: here the FC blocks take only $\\mathbf{x}_{(t)}$.'),
              ],
              difficulty: 3,
              likelihood: 'high',
            },
            {
              id: 's-q1-e-ii',
              label: 'ii.',
              marks: 1,
              source: 'sample',
              prompt: [R`what are the ranges of values for $\mathbf{g}_{(t)}$ and $\mathbf{h}_{(t)}$?`],
              topics: [
                { lec: 'L4', slides: 46, name: 'Gate ranges' },
                { lec: 'L1', slides: 21, name: 'ReLU' },
              ],
              answer: [
                w(R`Each element of $\mathbf{g}_{(t)}$ is in $(0, 1)$ (logistic); each element of $\mathbf{h}_{(t)}$ is in $[0, \infty)$ (ReLU has no maximum).`, 1),
              ],
              difficulty: 2,
              likelihood: 'high',
            },
          ],
        },
      ],
    },
    {
      id: 's-q2',
      n: 2,
      parts: [
        {
          id: 's-q2-a',
          label: '(a)',
          page: 6,
          lines: 11,
          source: 'sample',
          prompt: [
            'Suppose that you are asked to develop a recurrent neural network (RNN) that, given the 2D coordinates of the first 4 corners of a hand-sketched star, would predict the last corner, as shown in the diagram below:',
            { fig: 'stars', desc: 'Figure: two hand-sketched stars, corners numbered 0 to 4 and joined in order; the left star runs anti-clockwise, the right one clockwise; corner 4 of each is marked in red.' },
            'The corners of each star are numbered from 0 to 4. For each star, the corner that the RNN needs to learn to predict is marked in red (corner #4). The corners of each star can be in any order: anti-clockwise (left diagram) or clockwise (right diagram). The starting corner can be arbitrary.',
          ],
          subs: [
            {
              id: 's-q2-a-i',
              label: 'i.',
              marks: 1,
              source: 'sample',
              prompt: ['What should be the shapes of the input $X$ and output $y$ in your training set? Briefly explain your answer.'],
              topics: [
                { lec: 'L4', slides: 24, name: '3D inputs to recurrent layers' },
                { lec: 'L4', slides: 11, name: 'Training-set shapes' },
              ],
              answer: [
                w('$X$: $(N, 4, 2)$ and $y$: $(N, 2)$, for $N$ training stars. Recurrent layers expect 3D inputs [batch size, time steps, dimensionality]: 4 time steps (corners 0–3), each a 2D point $(x, y)$; the target is corner 4\'s $(x, y)$.', 1),
              ],
              difficulty: 3,
              likelihood: 'high',
            },
            {
              id: 's-q2-a-ii',
              label: 'ii.',
              marks: 1,
              source: 'sample',
              prompt: ['What loss function would be suitable to use for this problem? Briefly explain your answer.'],
              topics: [
                { lec: 'L1', slides: 27, name: 'Regression losses' },
              ],
              answer: [
                w('Mean squared error (MSE): predicting real-valued coordinates is a **regression** task, and MSE is the usual regression loss (MAE is more robust to outliers; the Huber loss combines the two).', 1),
              ],
              difficulty: 2,
              likelihood: 'high',
            },
            {
              id: 's-q2-a-iii',
              label: 'iii.',
              marks: 2,
              source: 'sample',
              prompt: ['If you were to implement a RNN that, given the first 3 corners, can predict the last 2 corners, how would you set up the RNN layers and loss function? What would be the shapes of the input $X$ and output $y$ in your training set? Explain yur answer.'],
              topics: [
                { lec: 'L4', slides: [35, 38], name: 'Forecasting several steps ahead' },
                { lec: 'L4', slides: 34, name: 'Forecasting by looping' },
              ],
              answer: [
                w('Predict both corners at once from the last time step (as for the 14-days-ahead forecast): a recurrent layer that returns only its last output, e.g. `SimpleRNN(32)`, then `Dense(4)` with no activation; a regression loss: MSE (the slides\' forecasting models use the Huber loss).', 1),
                w('$X$: $(N, 3, 2)$ (3 corners of $(x, y)$); $y$: $(N, 4)$, the $(x, y)$ of corners 3 and 4 in one vector (like $X$ (32, 56, 5) → $y$ (32, 14) on the slides).', 1),
                w('(Or train the one-step model and loop: predict corner 3, append it to the input, then predict corner 4.)'),
              ],
              difficulty: 4,
              likelihood: 'high',
            },
          ],
        },
        {
          id: 's-q2-b',
          label: '(b)',
          marks: 5,
          page: 7,
          lines: 11,
          source: 'sample',
          prompt: ['Briefly explain what *variational autoencoders* are and how you would train them. Give an application that would be suitable to use a variational autoencoder.'],
          topics: [
            { lec: 'L67', slides: [10, 13], name: 'Variational autoencoders' },
            { lec: 'L67', slides: [15, 17], name: 'VAE training and uses' },
          ],
          answer: [
            w('VAEs are **probabilistic** autoencoders (outputs partly determined by chance, even after training) and **generative** ones (they generate new instances that look like the training set).', 1),
            w(R`The encoder outputs a mean coding $\boldsymbol{\mu}$ and a standard deviation coding $\boldsymbol{\sigma}$; a coding is sampled from this Gaussian and the decoder reconstructs the input from it.`, 1),
            w('Train it like an autoencoder (inputs = targets, e.g. `fit(X_train, X_train)`) on a loss with two parts: the **reconstruction loss**, which pushes it to reproduce its inputs,', 1),
            w('plus the **latent loss**, the KL divergence between a simple Gaussian and the codings\' distribution, which pushes the codings to look as though they were sampled from a Gaussian:', 0),
            eq(R`\mathscr{L} = -\frac{1}{2}\sum_{i=1}^{n}\left[1 + \log(\sigma_i^2) - \sigma_i^2 - \mu_i^2\right]`, 1),
            w('Application: generating new images (e.g. Fashion MNIST) by decoding random Gaussian codings, or semantic interpolation between two images.', 1),
          ],
          difficulty: 3,
          likelihood: 'high',
        },
        {
          id: 's-q2-c',
          label: '(c)',
          marks: 4,
          page: 7,
          lines: 11,
          source: 'sample',
          prompt: ['List two key components in the classical *transformer* architecture and briefly explain each one of them.'],
          topics: [
            { lec: 'L8', slides: [29, 32], name: 'Transformer components' },
            { lec: 'L8', slides: [37, 40], name: 'Multi-head attention' },
          ],
          answer: [
            h('1. Positional encoding layer'),
            w('The transformer has no recurrent or convolutional layers, so word order must be added: a positional encoding is a dense vector encoding a word\'s position in the sentence, added to that word\'s embedding (fixed sine/cosine encodings in the paper).', 2),
            h('2. Multi-head attention'),
            w(R`The heart of the model: each head computes scaled dot-product attention, $\mathrm{softmax}(\mathbf{Q}\mathbf{K}^{\top}/\sqrt{d_{\text{keys}}})\,\mathbf{V}$, on linear projections of V, K, Q; the $H$ heads are concatenated and passed through a linear layer.`, 1),
            w('It captures the context and relationships among words (in the encoder each word attends to all other words in the sentence), and different heads capture different characteristics of the words.', 1),
          ],
          difficulty: 2,
          likelihood: 'high',
        },
        {
          id: 's-q2-d',
          label: '(d)',
          marks: 4,
          page: 8,
          lines: 11,
          source: 'sample',
          prompt: ['What are *Markov chains*? What are the two differences between *Markov chains* and *Markov decision processes* (MDPs)?'],
          topics: [
            { lec: 'L9', slides: [39, 40], name: 'Markov chains' },
            { lec: 'L9', slides: 41, name: 'Markov decision processes' },
          ],
          answer: [
            w('A Markov chain is a stochastic process with no memory: it has a fixed number of states and randomly evolves from a state $s$ to a state $s\'$ at each step with a fixed probability.', 1),
            w('The probability depends only on the pair $(s, s\')$, not on past states.', 1),
            h('Differences in an MDP'),
            ul([
              ['At each step an **agent chooses one of several actions**, and the transition probabilities depend on the chosen action.', 1],
              ['Some transitions return a **reward** (positive or negative), and the agent\'s goal is to find a policy that maximises rewards over time.', 1],
            ]),
          ],
          difficulty: 2,
          likelihood: 'high',
        },
        {
          id: 's-q2-e',
          label: '(e)',
          marks: 3,
          page: 8,
          lines: 9,
          source: 'sample',
          prompt: [
            'Given below is the *value iteration algorithm* in reinforcement learning:',
            { eq: R`V_{k+1}(s) \leftarrow \max_{a} \sum_{s'} T(s, a, s')\,[R(s, a, s') + \gamma V_k(s')] \;\text{ for all } s` },
            R`Briefly state what this algorithm is used for and what each of the terms $T(s, a, s')$, $R(s, a, s')$, $\gamma$, and $V_k(s')$ means.`,
          ],
          topics: [
            { lec: 'L9', slides: [43, 44], name: 'Bellman equation · value iteration' },
          ],
          answer: [
            w('It estimates the **optimal state value** $V^*(s)$ of every state by applying the Bellman Optimality Equation iteratively; given enough iterations it is guaranteed to converge to the optimal state values for all the states, corresponding to the optimal policy.', 1),
            w('$T(s, a, s\')$: the probability of going from $s$ to $s\'$ given the agent chose action $a$. $R(s, a, s\')$: the reward the agent gets for that transition.', 1),
            w('$\\gamma$: the discount rate (between 0 and 1). $V_k(s\')$: the estimated value of the next state $s\'$ at the $k$th iteration.', 1),
          ],
          difficulty: 2,
          likelihood: 'high',
        },
      ],
    },
  ],
};
