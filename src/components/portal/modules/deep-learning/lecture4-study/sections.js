/* ============================================================================
   LECTURE 4 STUDY — SECTION CONTENT
   ----------------------------------------------------------------------------
   The whole module's text, as data, in slide order. Layout code never holds
   prose: edit a note here and the page updates.

   Inline markup (rendered by Rich.jsx):
     **bold**   *italic*   `code`   $tex$   [label](#sectionId)   [^n] footnote

   Each section:
     id, no, title, slides            identity + slide receipt
     group     (optional) a sub-part heading in the index, e.g. §13's two pages
     read      blocks — a string is a paragraph; objects are
               { eq }, { list }, { code }, { note }, { slideNote }, { unfold }
               ({ code: { src } } takes inline code or a NAMED_CODE key)
     play      lab keys (components live in ./labs, mapped in the shell)
     board     true → the validation-MAE scoreboard strip, up to this section
     notes     [{ h, lines }] — the notebook page, 2–4 sub-headings
     draw      [{ fig, caption }] — line-art diagram keys (./diagrams.jsx)
     formulas  [{ tex | code, read, tag? }]
     worked    { title, lines }
     check     [{ q, a }]
   Any block may be left out; the notebook keeps the order fixed.
   ========================================================================== */

export const SECTIONS = [
  /* ── §0 ─────────────────────────────────────────────────────────────── */
  {
    id: 's00',
    no: '0',
    title: 'Intro: roadmap & how to use this page',
    short: 'Intro & roadmap',
    slides: '1–3',
    read: [
      '**Topic 4: Processing Sequences Using RNNs and CNNs** — CITS5017 Deep Learning, A/Prof Du Huynh, Semester 2, 2026 (slide 1). Today covers **Chapter 15** of *Hands-on Machine Learning with Scikit-Learn, Keras & TensorFlow* (slide 2).',
      'Slide 3 lists the main topics the lecture briefly covers: the **various application areas of RNNs**, **recurrent neurons**, **memory cells**, **input and output sequences**, **basic RNNs in TensorFlow**, **handling variable length input and output sequences**, **training to predict time series**, **deep RNNs**, the **difficulty of training over many time steps**, and the **LSTM architecture**.',
      'Every section below follows the deck in order and has the same three beats: **Read** the short explanation, **Play** with the live lab until the idea clicks, then **Write** — copy the notebook page onto paper and tick each line as it goes in. Ticks and your place are saved in this browser, and the index marks a section done once all its lines are ticked.',
      'From [§6](#s06) on, the slides tell one story: forecasting Chicago’s daily rail ridership with a series of models, each scored by its **validation MAE**. A small **scoreboard** under the labs grows as the models arrive, holding only numbers printed on the slides, each with its slide number.',
    ],
    play: ['roadmap'],
    notes: [
      {
        h: 'Topic 4 · Chapter 15',
        lines: [
          'Topic 4 is Processing Sequences Using RNNs and CNNs.',
          'Today covers Chapter 15 of *Hands-on Machine Learning with Scikit-Learn, Keras & TensorFlow*.',
        ],
      },
      {
        h: 'Main topics (slide 3)',
        lines: [
          'First, the application areas of RNNs, then recurrent neurons and memory cells.',
          'Then input and output sequences, and basic RNNs in TensorFlow.',
          'Then handling variable length input and output sequences, and training to predict time series.',
          'Finally, deep RNNs, the difficulty of training over many time steps, and the LSTM architecture.',
        ],
      },
    ],
  },

  /* ── §1 ─────────────────────────────────────────────────────────────── */
  {
    id: 's01',
    no: '1',
    title: 'What RNNs are for · recurrent neurons & unrolling',
    short: 'Recurrent neurons',
    slides: '4–6',
    read: [
      '**Recurrent neural networks** (RNNs) are a class of nets that can **predict the future** (well, up to a point). They can analyze **time series** data such as stock prices and tell you when to buy or sell; in autonomous driving systems they can **anticipate car trajectories** and help avoid accidents. More generally, they can work on **sequences of arbitrary lengths**, rather than on the fixed-sized inputs of all the nets discussed so far (slide 4).',
      'Because RNNs can take **sentences, documents or audio samples** as input, they can be used in **automatic translation**, **speech-to-text**, **sentiment analysis**, or generating the next notes in a melody (e.g. Google’s *Magenta project*, `https://magenta.tensorflow.org/`).',
      'So far the networks have mostly been **feedforward**: the activations flow in one direction, from the input layer to the output layer. A recurrent neural network looks very much like a feedforward network, except it also has **connections pointing backward** (slide 5).',
      'The simplest possible RNN is **one neuron** receiving inputs, producing an output, and **sending that output back to itself** (Figure 15-1, left). At each **time step** $t$ (also called a **frame**), this recurrent neuron may receive the inputs $\\mathbf{x}_{(t)}$ and its own output from the previous time step, $\\hat{\\mathbf{y}}_{(t-1)}$. Drawing one copy of the neuron per time step, along a time axis, is called **unrolling the network through time** (Figure 15-1, right). The first copy receives 0 as its “previous output”.',
      'A **layer** of recurrent neurons is easy to create: at each time step $t$, **every neuron** receives both the input vector $\\mathbf{x}_{(t)}$ and the output vector from the previous time step, $\\mathbf{y}_{(t-1)}$ (Figure 15-2, slide 6). Both the inputs and the outputs are now **vectors** — with a single neuron, the output was a scalar.',
      { slideNote: 'Slide 5 writes the fed-back output with a hat, $\\hat{\\mathbf{y}}_{(t-1)}$; slide 6 writes $\\mathbf{y}_{(t-1)}$ — both mean the previous step’s output. Slide 5 also sets the single neuron’s input and output in bold (vector) type, while slide 6 says that output “was a scalar” and Figure 15-1 labels them as plain scalars $x$ and $\\hat{y}$.' },
    ],
    play: ['neuron', 'layer'],
    notes: [
      {
        h: 'What RNNs are for (slide 4)',
        lines: [
          'RNNs can predict the future (up to a point): they analyse time series such as stock prices, or anticipate car trajectories.',
          'They work on sequences of arbitrary lengths, not on the fixed-size inputs of the nets seen so far.',
          'Uses include automatic translation, speech-to-text, sentiment analysis and generating the next notes in a melody (e.g. Google’s Magenta project).',
        ],
      },
      {
        h: 'A recurrent neuron (slide 5)',
        lines: [
          'A recurrent network is like a feedforward one, except it also has connections pointing backward.',
          'The simplest RNN is one neuron that sends its output back to itself.',
          'At each time step $t$ (a frame) it receives the inputs $\\mathbf{x}_{(t)}$ and its own previous output $\\hat{\\mathbf{y}}_{(t-1)}$.',
          'Drawing one copy of the neuron per time step is called unrolling the network through time.',
        ],
      },
      {
        h: 'A layer of recurrent neurons (slide 6)',
        lines: [
          'In a recurrent layer, every neuron receives the input vector $\\mathbf{x}_{(t)}$ and the previous output vector $\\mathbf{y}_{(t-1)}$.',
          'The inputs and outputs are now vectors; with a single neuron the output was a scalar.',
        ],
      },
    ],
    draw: [
      { fig: 'unroll', caption: 'Figure 15-1: label $x$, $\\hat{y}$ and the loop on the left; on the right label $x_{(0)} \\ldots x_{(3)}$, $\\hat{y}_{(0)} \\ldots \\hat{y}_{(3)}$, the 0 fed into the first copy, and the time arrow.' },
    ],
    check: [
      { q: 'What two things does a recurrent neuron receive at time step $t$?', a: 'The inputs $\\mathbf{x}_{(t)}$ and its own output from the previous time step, $\\hat{\\mathbf{y}}_{(t-1)}$.' },
      { q: 'What is unrolling the network through time?', a: 'Drawing the recurrent neuron once per time step along a time axis, each copy passing its output to the next.' },
    ],
  },

  /* ── §2 ─────────────────────────────────────────────────────────────── */
  {
    id: 's02',
    no: '2',
    title: 'Memory cells: the hidden state h(t)',
    short: 'Memory cells',
    slides: '7–9',
    read: [
      'Notice that $\\mathbf{y}_{(2)}$ depends on $\\mathbf{x}_{(2)}$ and $\\mathbf{y}_{(1)}$, which in turn depends on $\\mathbf{x}_{(1)}$ and $\\mathbf{y}_{(0)}$, and so on. So $\\mathbf{y}_{(t)}$ is a **function of all the inputs since time $t = 0$**: $\\mathbf{x}_{(0)}, \\mathbf{x}_{(1)}, \\cdots, \\mathbf{x}_{(t)}$ (slide 7).',
      'Since the output of a recurrent neuron at time step $t$ is a function of all the inputs from previous time steps, it has a form of **memory**. A part of a neural network that preserves some state across time steps is called a **memory cell** (or simply a **cell**). A single recurrent neuron, or a layer of recurrent neurons, is a very basic cell; there are more complex and powerful types of cells in more complex networks ([§13](#s13a), [§14](#s14)).',
      '$\\mathbf{h}_{(t)}$ (where “h” stands for “hidden”) denotes a **cell’s state** at time step $t$. In general, a cell’s state at time step $t$ is a function of some inputs at $t$ and its state at $t-1$: $\\mathbf{h}_{(t)} = f(\\mathbf{x}_{(t)}, \\mathbf{h}_{(t-1)})$. Its output $\\hat{\\mathbf{y}}_{(t)}$ is also a function of the previous state and the current inputs. Figure 15-3 makes the point that **a cell’s hidden state and its output may be different** (slide 8).',
      'Mathematically (slide 9):',
      {
        eq: {
          name: 'The recurrent layer (slide 9)',
          tex: '\\begin{aligned} \\mathbf{h}_{(t)}^{\\top} &= \\varphi_h\\left(\\mathbf{h}_{(t-1)}^{\\top}\\mathbf{W}_h + \\mathbf{x}_{(t)}^{\\top}\\mathbf{W}_x + \\mathbf{b}_h^{\\top}\\right) \\\\ \\mathbf{y}_{(t)}^{\\top} &= \\varphi_y\\left(\\mathbf{h}_{(t)}^{\\top}\\mathbf{W}_y + \\mathbf{b}_y^{\\top}\\right) \\end{aligned}',
          read: 'the new state mixes the old state and the new input through two weight matrices, adds a bias and applies φ_h; the output reads the state through W_y.',
        },
      },
      'where:',
      {
        list: [
          '$\\mathbf{x}_{(t)}^{\\top}$ is an input instance (an $n_{\\text{inputs}}$-dimensional row vector) at time step $t$;',
          '$\\mathbf{y}_{(t)}^{\\top}$ is the corresponding output instance (an $n_{\\text{outputs}}$-dimensional row vector);',
          '$\\mathbf{h}_{(t)}^{\\top}$ is the hidden state vector (an $n_{\\text{neurons}}$-dimensional row vector) at time step $t$;',
          '$\\mathbf{W}_h$ ($n_{\\text{neurons}} \\times n_{\\text{neurons}}$), $\\mathbf{W}_x$ ($n_{\\text{inputs}} \\times n_{\\text{neurons}}$) and $\\mathbf{W}_y$ ($n_{\\text{neurons}} \\times n_{\\text{outputs}}$) are unknown weight matrices that need to be learned from the training process;',
          '$\\mathbf{b}_h^{\\top}$ ($n_{\\text{neurons}}$-dimensional row vector) and $\\mathbf{b}_y^{\\top}$ ($n_{\\text{outputs}}$-dimensional row vector) are bias vectors that need to be learned also;',
          '$\\varphi_h$ is an appropriate activation function (e.g. ReLU, tanh);',
          '$\\varphi_y$ is an appropriate activation function (e.g. sigmoid for binary classification, or softmax combined with cross-entropy for multi-class classification).',
        ],
      },
      { slideNote: 'Slides 7 and 9 write the output without a hat, $\\mathbf{y}_{(t)}$; slide 8 writes the output as $\\hat{\\mathbf{y}}_{(t)}$, and slide 10 uses $\\mathbf{y}_{(3)}$ for the ground truth. Read the unhatted $\\mathbf{y}$ of slides 7 and 9 as the network’s output.' },
      { slideNote: 'Slide 9 lists “softmax combined with cross-entropy” as an example of the activation $\\varphi_y$. Strictly, softmax is the activation and cross-entropy is the loss it is paired with in training.' },
    ],
    play: ['dependency', 'stateEq'],
    notes: [
      {
        h: 'Memory (slide 7)',
        lines: [
          '$\\mathbf{y}_{(t)}$ depends on $\\mathbf{x}_{(t)}$ and $\\mathbf{y}_{(t-1)}$, which depends on $\\mathbf{x}_{(t-1)}$, and so on back to $t = 0$.',
          'So the output at step $t$ is a function of all the inputs $\\mathbf{x}_{(0)}, \\ldots, \\mathbf{x}_{(t)}$: a form of memory.',
          'A part of a network that preserves state across time steps is a memory cell (or cell); a recurrent neuron or layer is a very basic cell.',
        ],
      },
      {
        h: 'The hidden state (slide 8)',
        lines: [
          'A cell’s state at step $t$ is $\\mathbf{h}_{(t)}$ (“h” for hidden), and in general $\\mathbf{h}_{(t)} = f(\\mathbf{x}_{(t)}, \\mathbf{h}_{(t-1)})$.',
          'The output $\\hat{\\mathbf{y}}_{(t)}$ is also a function of the previous state and the current inputs, and it may differ from the hidden state (Figure 15-3).',
        ],
      },
      {
        h: 'The equations (slide 9)',
        lines: [
          'The new state is $\\varphi_h$ of the old state times $\\mathbf{W}_h$, plus the input times $\\mathbf{W}_x$, plus the bias $\\mathbf{b}_h$.',
          'The output is $\\varphi_y$ of the state times $\\mathbf{W}_y$, plus the bias $\\mathbf{b}_y$.',
          '$\\mathbf{W}_h$ is $n_{\\text{neurons}} \\times n_{\\text{neurons}}$, $\\mathbf{W}_x$ is $n_{\\text{inputs}} \\times n_{\\text{neurons}}$ and $\\mathbf{W}_y$ is $n_{\\text{neurons}} \\times n_{\\text{outputs}}$; all are learned in training.',
          '$\\varphi_h$ is e.g. ReLU or tanh; $\\varphi_y$ is e.g. sigmoid (binary) or softmax with cross-entropy (multi-class).',
        ],
      },
    ],
    draw: [
      { fig: 'hiddenState', caption: 'Figure 15-3: label $\\mathbf{x}_{(t)}$ below and $\\hat{\\mathbf{y}}_{(t)}$ above each cell, and $\\mathbf{h}_{(0)}$, $\\mathbf{h}_{(1)}$ on the sideways arrows — the state and the output are different arrows.' },
    ],
    formulas: [
      { tex: '\\mathbf{h}_{(t)}^{\\top} = \\varphi_h\\left(\\mathbf{h}_{(t-1)}^{\\top}\\mathbf{W}_h + \\mathbf{x}_{(t)}^{\\top}\\mathbf{W}_x + \\mathbf{b}_h^{\\top}\\right)', read: 'New state = activation of (old state × W_h + input × W_x + bias).' },
      { tex: '\\mathbf{y}_{(t)}^{\\top} = \\varphi_y\\left(\\mathbf{h}_{(t)}^{\\top}\\mathbf{W}_y + \\mathbf{b}_y^{\\top}\\right)', read: 'Output = activation of (state × W_y + bias).' },
    ],
    worked: {
      title: 'Why the three terms can be added (row vectors × matrices)',
      lines: [
        '$\\mathbf{h}_{(t-1)}^{\\top}\\mathbf{W}_h$: $(1 \\times n_{\\text{neurons}})(n_{\\text{neurons}} \\times n_{\\text{neurons}}) \\to 1 \\times n_{\\text{neurons}}$.',
        '$\\mathbf{x}_{(t)}^{\\top}\\mathbf{W}_x$: $(1 \\times n_{\\text{inputs}})(n_{\\text{inputs}} \\times n_{\\text{neurons}}) \\to 1 \\times n_{\\text{neurons}}$, the same as $\\mathbf{b}_h^{\\top}$.',
      ],
    },
    check: [
      { q: 'Which inputs does $\\mathbf{y}_{(3)}$ depend on?', a: 'All of $\\mathbf{x}_{(0)}, \\mathbf{x}_{(1)}, \\mathbf{x}_{(2)}, \\mathbf{x}_{(3)}$ — every input since $t = 0$.' },
      { q: 'What shape is $\\mathbf{W}_x$?', a: '$n_{\\text{inputs}} \\times n_{\\text{neurons}}$.' },
    ],
  },

  /* ── §3 ─────────────────────────────────────────────────────────────── */
  {
    id: 's03',
    no: '3',
    title: 'The weather RNN & minibatch shapes',
    short: 'Weather example',
    slides: '10–11',
    read: [
      'Slide 10: the inputs could be the **temperatures**, **precipitations**, **atmospheric pressures** and **wind speeds** for three consecutive days (so $\\mathbf{x}_{(0)}, \\mathbf{x}_{(1)}, \\mathbf{x}_{(2)} \\in \\mathbb{R}^4$), and we want to train a simple RNN with **5 neurons** to predict the **temperature** and **precipitation** for the following day (i.e. predict $\\hat{\\mathbf{y}}_{(3)} \\in \\mathbb{R}^2$).',
      'Then $\\mathbf{W}_h \\in \\mathbb{R}^{5\\times 5}$ and $\\mathbf{h}_{(t)} \\in \\mathbb{R}^5$, $\\mathbf{W}_x \\in \\mathbb{R}^{4\\times 5}$, $\\mathbf{W}_y \\in \\mathbb{R}^{5\\times 2}$. We are interested **only in $\\hat{\\mathbf{y}}_{(3)}$**, which will be compared with the ground truth $\\mathbf{y}_{(3)}$ in the loss function (e.g. average MSE); the diagram marks the other two outputs **(Discarded)**. The initial hidden state vector $\\mathbf{h}_{(0)}^{\\top}$ for each training instance is usually set to a **zero vector**.',
      'Slide 11: let $m$ be the **minibatch size**. Then the training data $\\mathbf{X}_{(t)} \\in \\mathbb{R}^{m\\times 4}$ and $\\mathbf{Y}_{(t)} \\in \\mathbb{R}^{m\\times 2}$, for all $t$, and the equations of slide 9 become:',
      {
        eq: {
          name: 'The weather RNN on a minibatch (slide 11)',
          tex: '\\begin{aligned} \\mathbb{R}^{m\\times 5} \\ni \\mathbf{H}_{(t)} &= \\varphi_h\\left(\\mathbf{H}_{(t-1)}\\mathbf{W}_h + \\mathbf{X}_{(t)}\\mathbf{W}_x + \\mathbf{B}_h\\right) \\\\ \\mathbb{R}^{m\\times 2} \\ni \\hat{\\mathbf{Y}}_{(t)} &= \\varphi_y\\left(\\mathbf{H}_{(t)}\\mathbf{W}_y + \\mathbf{B}_y\\right) \\end{aligned}',
          read: 'the same equations with one row per instance: m states of 5, m inputs of 4, m outputs of 2.',
        },
      },
      {
        eq: {
          name: 'The stacked biases',
          tex: '\\mathbf{B}_h = \\begin{bmatrix} \\mathbf{b}_h^{\\top} \\\\ \\vdots \\\\ \\mathbf{b}_h^{\\top} \\end{bmatrix} \\in \\mathbb{R}^{m\\times 5} \\quad \\text{and} \\quad \\mathbf{B}_y = \\begin{bmatrix} \\mathbf{b}_y^{\\top} \\\\ \\vdots \\\\ \\mathbf{b}_y^{\\top} \\end{bmatrix} \\in \\mathbb{R}^{m\\times 2}',
          read: 'the same bias row repeated m times, once per instance.',
        },
      },
      'The training data are usually set up as **3D tensors**: $\\mathbf{X} \\in \\mathbb{R}^{N\\times 3\\times 4}$ and $\\mathbf{Y} \\in \\mathbb{R}^{N\\times 2}$ for this example, where $N$ is the **training set size**.',
      { slideNote: 'The slide-10/11 diagram feeds $\\mathbf{h}_{(0)}$ and $\\mathbf{x}_{(0)}$ into the first cell and labels what comes out $\\mathbf{h}_{(1)}$ and $\\hat{\\mathbf{y}}_{(1)}$, so its subscripts run one step ahead of slide 8’s $\\mathbf{h}_{(t)} = f(\\mathbf{x}_{(t)}, \\mathbf{h}_{(t-1)})$, slide 9’s equations and Figure 15-3. Read the output subscripts as “the day being predicted”: the cell that sees $\\mathbf{x}_{(2)}$ predicts day 3, $\\hat{\\mathbf{y}}_{(3)}$. The lab draws it the slide’s way.' },
      { slideNote: 'Slide 11 calls both $\\mathbf{X}$ and $\\mathbf{Y}$ “3D tensors”, but $\\mathbf{Y} \\in \\mathbb{R}^{N\\times 2}$ has only two axes — one target row per training instance, because only $\\hat{\\mathbf{y}}_{(3)}$ is compared with the truth. For the same reason, its “$\\mathbf{Y}_{(t)} \\in \\mathbb{R}^{m\\times 2}$, for all $t$” describes the shape a target would have at any step; in this example only the last step’s target is used.' },
    ],
    play: ['shapes'],
    notes: [
      {
        h: 'The weather example (slide 10)',
        lines: [
          'Inputs: temperature, precipitation, atmospheric pressure and wind speed on three consecutive days, so $\\mathbf{x}_{(0)}, \\mathbf{x}_{(1)}, \\mathbf{x}_{(2)} \\in \\mathbb{R}^4$.',
          'A simple RNN with 5 neurons predicts the next day’s temperature and precipitation: $\\hat{\\mathbf{y}}_{(3)} \\in \\mathbb{R}^2$.',
          'So $\\mathbf{W}_h \\in \\mathbb{R}^{5\\times5}$, $\\mathbf{W}_x \\in \\mathbb{R}^{4\\times5}$, $\\mathbf{W}_y \\in \\mathbb{R}^{5\\times2}$ and $\\mathbf{h}_{(t)} \\in \\mathbb{R}^5$.',
          'Only $\\hat{\\mathbf{y}}_{(3)}$ goes into the loss (e.g. average MSE against $\\mathbf{y}_{(3)}$); the earlier outputs are discarded.',
          'The initial hidden state $\\mathbf{h}^{\\top}_{(0)}$ is usually set to a zero vector.',
        ],
      },
      {
        h: 'Minibatches (slide 11)',
        lines: [
          'With minibatch size $m$, each step’s inputs stack into $\\mathbf{X}_{(t)} \\in \\mathbb{R}^{m\\times4}$ and the targets into $\\mathbf{Y}_{(t)} \\in \\mathbb{R}^{m\\times2}$.',
          'The states become $\\mathbf{H}_{(t)} \\in \\mathbb{R}^{m\\times5}$, and the biases stack into $\\mathbf{B}_h \\in \\mathbb{R}^{m\\times5}$ and $\\mathbf{B}_y \\in \\mathbb{R}^{m\\times2}$, one row per instance.',
          'The whole training set is a 3D tensor $\\mathbf{X} \\in \\mathbb{R}^{N\\times3\\times4}$, with targets $\\mathbf{Y} \\in \\mathbb{R}^{N\\times2}$.',
        ],
      },
    ],
    draw: [
      { fig: 'weatherRnn', caption: 'Label each cell “RNN cell (5 neurons)”, the inputs $\\mathbf{x}^{\\top}_{(t)} \\in \\mathbb{R}^4$, $\\mathbf{h}^{\\top}_{(0)}$ (a zero vector) on the left, and mark the first two outputs “(Discarded)”.' },
    ],
    formulas: [
      { tex: '\\mathbb{R}^{m\\times 5} \\ni \\mathbf{H}_{(t)} = \\varphi_h\\left(\\mathbf{H}_{(t-1)}\\mathbf{W}_h + \\mathbf{X}_{(t)}\\mathbf{W}_x + \\mathbf{B}_h\\right)', read: 'm states at once: (m×5)(5×5) + (m×4)(4×5) + (m×5) → m×5.' },
      { tex: '\\mathbb{R}^{m\\times 2} \\ni \\hat{\\mathbf{Y}}_{(t)} = \\varphi_y\\left(\\mathbf{H}_{(t)}\\mathbf{W}_y + \\mathbf{B}_y\\right)', read: 'm outputs at once: (m×5)(5×2) + (m×2) → m×2.' },
      { tex: '\\mathbf{X} \\in \\mathbb{R}^{N\\times 3\\times 4}, \\quad \\mathbf{Y} \\in \\mathbb{R}^{N\\times 2}', read: 'N instances × 3 time steps × 4 features in; one 2-value target per instance out.' },
    ],
    worked: {
      title: 'Counting the weights to learn (this page’s count from the slide-10 shapes; the slides give none)',
      lines: [
        '$\\mathbf{W}_h$: $5 \\times 5 = 25$; $\\mathbf{W}_x$: $4 \\times 5 = 20$; $\\mathbf{b}_h$: 5; $\\mathbf{W}_y$: $5 \\times 2 = 10$; $\\mathbf{b}_y$: 2.',
        'Total: $25 + 20 + 5 + 10 + 2 = 62$ — the same 62 at every time step, because the cells share them.',
      ],
    },
    check: [
      { q: 'In the weather example, which outputs are used in the loss?', a: 'Only $\\hat{\\mathbf{y}}_{(3)}$; $\\hat{\\mathbf{y}}_{(1)}$ and $\\hat{\\mathbf{y}}_{(2)}$ are discarded.' },
      { q: 'What shape is $\\mathbf{H}_{(t)}$ for a minibatch of $m$ instances?', a: '$m \\times 5$ — one 5-neuron state row per instance.' },
    ],
  },
  /* ── §4 ─────────────────────────────────────────────────────────────── */
  {
    id: 's04',
    no: '4',
    title: 'Input and output sequences',
    short: 'Input & output sequences',
    slides: '12–13',
    read: [
      'Slide 12 lists four ways an RNN can map inputs to outputs, drawn in Figure 15-4 (slide 13). Recall that an *input* is just a vector (or a number) and an *output* is another vector (or number).',
      {
        list: [
          '**Sequence-to-sequence** (top left): an RNN can take a sequence of inputs and produce a sequence of outputs — e.g. take $N$ days of stock prices as input and produce the stock prices of $N-1$ ago and of tomorrow.',
          '**Sequence-to-vector** (top right): take a sequence of inputs and produce a single output at the last step — e.g. take in a sequence of words from a movie review and output a sentiment score (0 (bad) … 4 (good)). The figure greys out the other outputs as **ignored outputs**.',
          '**Vector-to-sequence** (bottom left): take a single input at $t = 0$ (and zeros for other time steps) and produce a sequence of outputs — e.g. take in an image and produce a sequence of words that could be a caption of that image.',
          '**Encoder–decoder** (bottom right): a sequence-to-vector network, called an **encoder**, followed by a vector-to-sequence network, called a **decoder** — e.g. translating a sentence from one language to another language.',
        ],
      },
      'In every panel time runs left to right, inputs enter from below and outputs leave from above. In the encoder–decoder, the encoder’s own outputs are greyed out and the decoder’s inputs are zeros; the decoder’s outputs $\\hat{\\mathbf{Y}}\'_{(t)}$ are the result.',
      { slideNote: 'Item 1’s wording is garbled (“the stock prices of $N - 1$ ago and of tomorrow” — a word, presumably “days”, is missing). What it describes: the outputs are the inputs shifted one day into the future — feed $N$ days of prices and the network outputs the same $N$ days moved on by one, so its last output is the day after the last input, “tomorrow”.' },
      { slideNote: 'Item 3 says the vector-to-sequence network gets its input only at $t = 0$, with zeros afterwards, but Figure 15-4’s bottom-left panel feeds the same X at every time step. The lab shows both set-ups, each labelled with its source. Separately, the figure’s top-left panel prints its first input as a lowercase $x_{(0)}$ and its first output as an unhatted $Y_{(0)}$, where the rest of the figure has $X$ and $\\hat{Y}$; the page draws them like the rest.' },
    ],
    play: ['seqModes'],
    notes: [
      {
        h: 'Sequences in and out (slide 12)',
        lines: [
          'Sequence-to-sequence: a sequence in, a sequence out — e.g. N days of stock prices in, the prices shifted one day into the future out.',
          'Sequence-to-vector: a sequence in, one output at the last step — e.g. a movie review in, a sentiment score (0 bad … 4 good) out.',
          'Vector-to-sequence: a single input at $t = 0$ (zeros at the other steps), a sequence out — e.g. an image in, a caption out.',
          'Encoder–decoder: an encoder (sequence-to-vector) followed by a decoder (vector-to-sequence), e.g. for translating a sentence.',
          'An input is just a vector (or a number), and so is an output.',
        ],
      },
      {
        h: 'Reading Figure 15-4 (slide 13)',
        lines: [
          'Time runs left to right; inputs enter from below and outputs leave from above.',
          'Outputs the task does not need are ignored (greyed out), and the decoder is fed zeros as its inputs.',
        ],
      },
    ],
    draw: [
      { fig: 'seqModes', caption: 'Sketch the four panels of Figure 15-4; label each with its name and a slide-12 example, and grey out the ignored outputs. (The figure feeds X at every step of vector → sequence; slide 12’s text says X, then zeros.)' },
    ],
    check: [
      { q: 'Which mode turns a movie review into a sentiment score?', a: 'Sequence-to-vector: only the output at the last step is used.' },
      { q: 'What are the two halves of an encoder–decoder?', a: 'An encoder (sequence-to-vector) followed by a decoder (vector-to-sequence).' },
    ],
  },

  /* ── §5 ─────────────────────────────────────────────────────────────── */
  {
    id: 's05',
    no: '5',
    title: 'Training: backpropagation through time',
    short: 'BPTT',
    slides: '14',
    read: [
      'To train an RNN, the trick is to **unroll it through time** (as in [§1](#s01)) and then use **regular backpropagation** (Figure 15-5). This strategy is called **backpropagation through time** (BPTT).',
      '$\\{\\mathbf{X}_{(t)} \\mid t = 0, \\ldots, 4\\}$ denotes the batch of training sequences fed into the network, and $\\{\\hat{\\mathbf{Y}}_{(t)} \\mid t = 0, \\ldots, 4\\}$ the corresponding computed output.',
      'In Figure 15-5 the loss function is computed from the **last three outputs only**: $\\mathscr{L}(\\mathbf{Y}_{(2)}, \\mathbf{Y}_{(3)}, \\mathbf{Y}_{(4)};\\ \\hat{\\mathbf{Y}}_{(2)}, \\hat{\\mathbf{Y}}_{(3)}, \\hat{\\mathbf{Y}}_{(4)})$, comparing the targets $\\mathbf{Y}$ with the outputs $\\hat{\\mathbf{Y}}$. The gradients of the loss are then **propagated backward through the unrolled network** — the solid arrows; the dashed arrows are the forward pass.',
      'Every cell in the figure is labelled **W,b**: it is one cell with one set of parameters, drawn once per time step (slide 40 says it outright: “the same weights are used in every time step”). This page’s reading of what that means for training: the gradient for W and b collects a contribution from every time step the backward pass reaches — the lab adds them up.',
    ],
    play: ['bptt'],
    notes: [
      {
        h: 'Backpropagation through time (slide 14)',
        lines: [
          'To train an RNN, unroll it through time and then use regular backpropagation: this is backpropagation through time (BPTT).',
          'The forward pass runs left to right through the unrolled network and computes the outputs $\\hat{\\mathbf{Y}}_{(t)}$.',
          'The gradients of the loss are then propagated backward through the unrolled network (the solid arrows in Figure 15-5).',
        ],
      },
      {
        h: 'Which outputs count (Figure 15-5)',
        lines: [
          'In the example the loss uses only the last three outputs, $\\hat{\\mathbf{Y}}_{(2)}$, $\\hat{\\mathbf{Y}}_{(3)}$ and $\\hat{\\mathbf{Y}}_{(4)}$, against their targets.',
          'Outputs that are not in the loss send no gradient, but gradient from later outputs still flows back through their cells.',
          'Every cell uses the same $\\mathbf{W}$ and $\\mathbf{b}$ (the same weights at every step, slide 40), so their gradient adds up a contribution from every step it reaches.',
        ],
      },
    ],
    draw: [
      { fig: 'bptt', caption: 'Figure 15-5: label W,b in every cell, the dashed forward arrows, the solid gradient arrows, and the loss over $\\hat{\\mathbf{Y}}_{(2)}, \\hat{\\mathbf{Y}}_{(3)}, \\hat{\\mathbf{Y}}_{(4)}$.' },
    ],
    formulas: [
      { tex: '\\mathscr{L}\\left(\\mathbf{Y}_{(2)}, \\mathbf{Y}_{(3)}, \\mathbf{Y}_{(4)};\\ \\hat{\\mathbf{Y}}_{(2)}, \\hat{\\mathbf{Y}}_{(3)}, \\hat{\\mathbf{Y}}_{(4)}\\right)', read: 'The loss compares the targets Y with the outputs Ŷ — here only at steps 2, 3 and 4.' },
    ],
    check: [
      { q: 'What is BPTT?', a: 'Backpropagation through time: unroll the RNN through time, then run regular backpropagation.' },
      { q: 'In Figure 15-5, does $\\hat{\\mathbf{Y}}_{(0)}$ send any gradient?', a: 'No — only $\\hat{\\mathbf{Y}}_{(2)}$, $\\hat{\\mathbf{Y}}_{(3)}$ and $\\hat{\\mathbf{Y}}_{(4)}$ are in the loss, although gradient from them still flows back through cell 0.' },
    ],
  },

  /* ── §6 ─────────────────────────────────────────────────────────────── */
  {
    id: 's06',
    no: '6',
    title: 'Ridership, seasonality & the naive forecast',
    short: 'Naive forecast',
    slides: '15–18',
    read: [
      'From slide 15 to slide 50 the deck forecasts **Chicago’s daily ridership** — the number of bus and rail boardings each day (Figure 15-6, “Daily ridership in Chicago”). Slide 15 downloads `ridership.tgz` and loads the file `CTA_-_Ridership_-_Daily_Boarding_Totals.csv` with pandas.',
      'The code renames the columns to `date`, `day_type`, `bus`, `rail` and `total`, sorts by date and makes it the index, drops `total` (it’s just bus + rail) and drops duplicated rows (the months 2011-10 and 2014-07 appear twice). So `df` has **3 columns** — `day_type`, `bus` and `rail` — and each row is named by the date the data was collected.',
      { unfold: { label: 'Slide 15’s loading code, in full', blocks: [{ code: { src: 'load', label: 'load_ridership.py', meta: 'slide 15' } }, { code: { src: 'dfHead', label: 'df.head() — output', meta: 'slide 15 (shown there as a table)' } }] } },
      'Plotting March to May 2019 (Figure 15-6, slide 16) shows a similar pattern repeated each week: a **weekly seasonality**. If we simply copy a past value to make our forecast, it is called **naive forecasting**. **Naive forecasting is often a good baseline, and it can even be tricky to beat in some cases.**',
      'Here, copying the value from the **previous week** works better, due to the strong weekly seasonality (slide 17). `diff_7` is each day’s count minus the count 7 days earlier, over March–May 2019; Figure 15-7 overlays the series with its 7-day lagged copy (top) and plots the difference between $t$ and $t - 7$ (bottom).',
      { unfold: { label: 'Slides 16–17’s plotting code', blocks: [{ code: { src: 'plot', label: 'plot_ridership.py', meta: 'slide 16 · its “{” in “# extra code {” written as “–”' } }, { code: { src: 'diff', label: 'differencing.py', meta: 'slide 17 · “{” written as “–”, as on slide 16' } }] } },
      'Slide 18: the **mean absolute error** (MAE), also called the *mean absolute deviation* (MAD), of this forecast is `diff_7.abs().mean()`. Dividing the forecast errors by the target values gives the **mean absolute percentage error** (MAPE):',
      { unfold: { label: 'Slide 18’s code — also in the lab below', blocks: [{ code: { src: 'mae', label: 'naive_forecast_metrics.py', meta: 'slide 18' } }] } },
      'The bus forecast has a **higher MAE** than the rail one, but its **MAPE is lower**. This **7-days’ shift** prediction is the **baseline** for benchmarking the RNN methods that follow: its rail MAE of 42,143 starts the scoreboard below.',
      { note: 'MAPE is printed as a fraction: 0.089948 is about 9.0 %. The lab runs slide 15’s steps on the real dataset (downloaded from slide 15’s URL); at a 7-day lag its numbers match slide 18 to all six printed decimals.' },
    ],
    play: ['ridership'],
    board: true,
    notes: [
      {
        h: 'The data (slides 15–16)',
        lines: [
          'The dataset is Chicago’s daily ridership; after slide 15’s cleaning, `df` has the columns `day_type`, `bus` and `rail`, indexed by date.',
          'The same pattern repeats every week (Figure 15-6): this is weekly seasonality.',
        ],
      },
      {
        h: 'Naive forecasting (slides 16–17)',
        lines: [
          'Naive forecasting copies a past value as the forecast; it is often a good baseline and can be tricky to beat.',
          'With strong weekly seasonality, copying last week’s value works better: `diff_7` is each day minus the same day a week before.',
        ],
      },
      {
        h: 'Measuring the error (slide 18)',
        lines: [
          'MAE (mean absolute error, also called MAD) is the mean of the absolute errors: `diff_7.abs().mean()`.',
          'MAPE (mean absolute percentage error) divides each error by its target first: `(diff_7 / targets).abs().mean()`.',
          'March–May 2019: MAE bus 43,915.6 and rail 42,143.3; MAPE bus 0.0829 and rail 0.0899.',
          'Bus has the higher MAE but the lower MAPE; this 7-days’ shift is the baseline for the RNNs.',
        ],
      },
    ],
    draw: [
      { fig: 'naive', caption: 'Draw two weeks of a weekly pattern, the same curve shifted right by 7 days (dotted), and one error $e_{(t)}$ between them; write MAE = mean $|e_{(t)}|$.' },
    ],
    formulas: [
      { tex: '\\text{MAE} = \\frac{1}{n}\\sum_{t} \\left| y_{(t)} - y_{(t-7)} \\right|', tag: 'slide 18’s diff_7.abs().mean()', read: 'The average size of the error when the forecast is last week’s value.' },
      { tex: '\\text{MAPE} = \\frac{1}{n}\\sum_{t} \\left| \\frac{y_{(t)} - y_{(t-7)}}{y_{(t)}} \\right|', tag: 'slide 18’s (diff_7 / targets).abs().mean()', read: 'The same errors as fractions of the true value (0.0899 ≈ 9 %).' },
    ],
    worked: {
      title: 'Slide 18’s numbers, March–May 2019',
      lines: [
        'Rail: MAE 42,143.27 riders a day; MAPE 0.089948 ≈ 9.0 %.',
        'Bus: MAE 43,915.61 (higher) but MAPE 0.082938 ≈ 8.3 % (lower) — bus counts are larger, so a similar error is a smaller fraction.',
      ],
    },
    check: [
      { q: 'What is naive forecasting?', a: 'Copying a past value as the forecast — here, the value from the same day last week.' },
      { q: 'Bus has the higher MAE but the lower MAPE. How can that be?', a: 'MAPE divides each error by the true value; bus counts are larger, so similar errors are smaller fractions.' },
    ],
  },

  /* ── §7 ─────────────────────────────────────────────────────────────── */
  {
    id: 's07',
    no: '7',
    title: 'Preparing the data: windows & batches',
    short: 'Windowing the data',
    slides: '19–22',
    read: [
      'Data preparation is an important step in sequence processing, as the input data usually does not come in a form that can be used directly (slide 19). Keras’s `tf.keras.utils.timeseries_dataset_from_array` cuts a series into **windows** (input sequences), pairs each with a **target**, and groups them into **batches**:',
      { code: { src: 'toy', label: 'toy_windows.py', meta: 'slide 19' } },
      'With `sequence_length=3` the windows are `[0, 1, 2]`, `[1, 2, 3]` and `[2, 3, 4]`, and `targets=my_series[3:]` gives them the targets 3, 4 and 5 — each target is **3 steps into the future** counting from the window’s first value — the value right after the window. `batch_size=2` puts the first two windows in a batch of shape `(2, 3)` with targets `(2,)`, and the last window in a batch of shape `(1, 3)` with target `(1,)`.',
      'Slide 20: the first step is to split the data into a **training period** (2016-01 to 2018-12), a **validation period** (2019-01 to 2019-05) and a **test period** (2019-06 onwards), focusing on the **rail** ridership for now, divided by `1e6`. Each window is then **56 days** long, with the next day as its target:',
      { unfold: { label: 'Slide 20’s code — also in the lab below', blocks: [{ code: { src: 'split', label: 'rail_datasets.py', meta: 'slide 20' } }] } },
      'Slide 21 inspects two minibatches of `train_ds`: each has inputs of shape `(32, 56)` — 32 windows of 56 days — and targets of shape `(32,)`. Slide 22 plots the first five sequences of a minibatch: days 0 to 55 as the input (a blue line) and day 56 as the value to predict (a red star).',
      { unfold: { label: 'Slides 21–22’s code', blocks: [{ code: { src: 'inspect', label: 'inspect_batches.py', meta: 'slide 21' } }, { code: { src: 'vis', label: 'visualise_windows.py', meta: 'slide 22' } }] } },
      { note: 'Only `train_ds` is shuffled (`shuffle=True, seed=42`); the validation windows keep their time order.' },
      { slideNote: 'Slide 22’s code passes `sharey=True`, but each of its five plotted panels has its own y-axis range — the figure doesn’t look like that code’s output. The lab draws the panels with their own ranges, like the figure.' },
    ],
    play: ['window', 'railWindows'],
    notes: [
      {
        h: 'Windows and targets (slide 19)',
        lines: [
          '`timeseries_dataset_from_array` cuts a series into windows of `sequence_length` values, pairs each with a target, and groups them into batches.',
          'For `[0, 1, 2, 3, 4, 5]` with `sequence_length=3` and `targets=my_series[3:]`: windows [0, 1, 2] → 3, [1, 2, 3] → 4, [2, 3, 4] → 5.',
          'With `batch_size=2` the batches have shapes (2, 3) with targets (2,), then (1, 3) with target (1,).',
        ],
      },
      {
        h: 'The rail series (slides 20–22)',
        lines: [
          'Split by date — training 2016-01 to 2018-12, validation 2019-01 to 2019-05, test from 2019-06 — and divide the rail counts by 1e6.',
          'Each window is `seq_length = 56` days and its target is the next day: the targets are the series shifted by 56 (`rail_train[seq_length:]`).',
          'Batches of 32 give inputs of shape (32, 56) and targets of shape (32,); only the training set is shuffled (seed 42).',
          'Slide 22 plots days 0 to 55 of a window as a line and day 56 as the star to predict.',
        ],
      },
    ],
    draw: [
      { fig: 'windows', caption: 'Draw the series 0 … 5, bracket the three windows of length 3, arrow each to its target, and group them into a batch of 2 and a batch of 1.' },
    ],
    formulas: [
      { code: 'timeseries_dataset_from_array(series, targets=series[L:],\n    sequence_length=L, batch_size=B)', tag: 'this page’s general form of slides 19–20', read: 'Windows of L values: window p is series[p … p+L−1] and its target is series[p+L].' },
    ],
    worked: {
      title: 'Counting the windows',
      lines: [
        'Slide 19: every window needs a target, and `my_series[3:]` = [3, 4, 5] has 3 values, so there are 3 windows; batches of 2 → 2 batches, of sizes 2 and 1.',
        'Rail (this page’s count from the data): 1,096 training days − 56 = 1,040 windows → 32 full batches of 32 + one of 16 = 33 batches.',
      ],
    },
    check: [
      { q: 'What shapes does a `train_ds` minibatch have?', a: 'Inputs (32, 56) — 32 windows of 56 days — and targets (32,).' },
      { q: 'In slide 19, what is the target of the window [1, 2, 3]?', a: '4 — the value right after the window.' },
    ],
  },

  /* ── §8 ─────────────────────────────────────────────────────────────── */
  {
    id: 's08',
    no: '8',
    title: 'Linear model → simple RNN',
    short: 'Linear → simple RNN',
    slides: '23–27',
    read: [
      '**Forecasting using a linear model** (slide 23). A single `Dense(1)` layer on the 56 inputs is a linear model: one weight per day of the window, plus a bias. It is trained with the Huber loss, SGD (`learning_rate=0.02, momentum=0.9`) and early stopping on `val_mae` (patience 50, best weights restored).',
      { unfold: { label: 'Slide 23’s code', blocks: [{ code: { src: 'linear', label: 'linear_model.py', meta: 'slide 23' } }] } },
      'This model has **57 trainable parameters** (0 non-trainable) and reaches a validation MAE of **about 38,245** (“your mileage may vary”) — better than the MAE of the 7-days’ shift, 42,143 (slide 18).',
      '**Forecasting using a simple RNN** (slide 24). The simplest RNN is a single recurrent neuron:',
      { code: { src: 'rnn1', label: 'simple_rnn.py', meta: 'slide 24' } },
      'All recurrent layers in Keras expect **3D inputs** of shape `[batch size, time steps, dimensionality]`, where dimensionality is 1 for a univariate time series and more for a multivariate one. Slide 24 also defines `fit_and_evaluate`, which compiles with the same settings, trains with early stopping and returns the validation MAE × 1e6 (back in riders). The validation MAE of this model is **greater than 100,000**!',
      { slideNote: 'Slide 21’s batches have shape (32, 56) — two axes — while slide 24 says recurrent layers expect 3D inputs [batch size, time steps, dimensionality]. The slides never show the step that turns (32, 56) into (32, 56, 1).' },
      { unfold: { label: 'Slide 24’s fit_and_evaluate, and slide 25’s summary', blocks: [{ code: { src: 'fit', label: 'fit_and_evaluate.py', meta: 'slide 24' } }, { code: { src: 'rnn1Summary', label: 'model.summary()', meta: 'slide 25' } }] } },
      'That was expected, for two reasons (slides 25–26):',
      {
        list: [
          'The model has only a **single recurrent neuron**, so at each step it can only use the current input and its own previous output — its memory is extremely limited, and the whole model has **only 3 parameters**.',
          'The series contains values from 0 to about 1.4, but since the default activation function is **tanh**, the recurrent layer can only output values between −1 and +1: there is no way it can predict values between 1.0 and 1.4.',
        ],
      },
      { slideNote: 'The real rail training series (2016–2018, ÷ 1e6, loaded on this page from slide 15’s data) peaks at **1.147**, on 2016-11-04 — the only day above 1.0, and the highest rail value in the whole 2001–2021 file — so “about 1.4” overstates the range. The point stands: tanh can never output more than +1, and one of the 1,040 training targets (2016-11-04) lies above it.' },
      'The fix is `univar_model` (slides 26–27): a larger recurrent layer of **32 recurrent neurons**, plus a **dense output layer** with a single output neuron and **no activation function**:',
      { unfold: { label: 'Slide 27’s code — also in the lab below', blocks: [{ code: { src: 'univar', label: 'univar_model.py', meta: 'slide 27' } }] } },
      'Compiling, fitting and evaluating this `univar_model` as before, we should get a validation MAE **around 27,703** — below both the baseline and the linear model.',
    ],
    play: ['linear', 'tanhCeiling'],
    board: true,
    notes: [
      {
        h: 'The linear model (slide 23)',
        lines: [
          'A `Dense(1)` layer on the 56 inputs is a linear model with 56 weights + 1 bias = 57 parameters.',
          'Trained with the Huber loss, SGD (lr 0.02, momentum 0.9) and early stopping, it reaches a validation MAE of about 38,245, better than the 42,143 baseline.',
        ],
      },
      {
        h: 'One recurrent neuron (slides 24–26)',
        lines: [
          'Keras recurrent layers expect 3D inputs: [batch size, time steps, dimensionality], with dimensionality 1 for a univariate series.',
          '`InputLayer(shape=[None, 1])` leaves the number of time steps open (`None`), so the same model takes sequences of any length.',
          '`SimpleRNN(1)` has only 3 parameters, so its memory is extremely limited; its validation MAE is over 100,000.',
          'Its default activation, tanh, can only output values between −1 and +1, but the series (÷ 1e6) goes above 1.0.',
        ],
      },
      {
        h: 'univar_model (slides 26–27)',
        lines: [
          'The fix: 32 recurrent neurons, plus a `Dense(1)` output layer with no activation function.',
          '`SimpleRNN(32)` has 1,088 parameters and `Dense(1)` has 33: 1,121 in total.',
          'It reaches a validation MAE of around 27,703, beating the baseline and the linear model.',
        ],
      },
    ],
    draw: [
      { fig: 'univar', caption: 'Label the input [None, 1], SimpleRNN(32) unrolled with its 32-wide state passed sideways, the last state into Dense(1), and the single output.' },
    ],
    formulas: [
      { tex: '\\#\\text{params} = \\underbrace{n_{\\text{inputs}}\\,n_{\\text{neurons}}}_{\\mathbf{W}_x} + \\underbrace{n_{\\text{neurons}}^{2}}_{\\mathbf{W}_h} + \\underbrace{n_{\\text{neurons}}}_{\\mathbf{b}_h}', tag: 'this page’s count from slide 9’s shapes', read: 'Input weights, recurrent weights and biases: 1×32 + 32×32 + 32 = 1,088.' },
      { tex: '\\#\\text{params}\\big(\\texttt{Dense}(k)\\big) = (\\text{inputs} + 1) \\times k', tag: 'a Dense layer’s count — not printed on these slides', read: 'One weight per input plus a bias, per unit: 56 + 1 = 57; 32 + 1 = 33.' },
    ],
    worked: {
      title: 'univar_model’s 1,121 parameters (slide 27)',
      lines: [
        'SimpleRNN(32) on 1 input: $1 \\times 32 + 32 \\times 32 + 32 = 32 + 1{,}024 + 32 = 1{,}088$.',
        'Dense(1) on 32 inputs: $32 + 1 = 33$. Total $1{,}088 + 33 = 1{,}121$, as the summary prints. SimpleRNN(1): $1 + 1 + 1 = 3$.',
      ],
    },
    check: [
      { q: 'Why can’t `SimpleRNN(1)` forecast the rail series well?', a: 'It has only 3 parameters (very little memory), and its tanh output is stuck between −1 and +1 while the series (÷ 1e6) goes above 1.0.' },
      { q: 'How many parameters does `SimpleRNN(32)` have on a univariate series?', a: '1,088: 32 input weights + 1,024 recurrent weights + 32 biases.' },
    ],
  },

  /* ── §9 ─────────────────────────────────────────────────────────────── */
  {
    id: 's09',
    no: '9',
    title: 'Deep RNNs',
    short: 'Deep RNNs',
    slides: '28–29',
    read: [
      'It is quite common to **stack multiple layers of cells** to form a **deep RNN** (Figure 15-10, slide 28): the stack on the left, and the same network unrolled through time on the right, where each layer passes its outputs up to the next layer and its state along to its own next time step.',
      'Implementing a deep RNN with Keras is straightforward: just stack the recurrent layers. **Important:** set `return_sequences=True` for all the `SimpleRNN` layers **except the last one** (slide 29):',
      { unfold: { label: 'Slide 29’s code — also in the lab below', blocks: [{ code: { src: 'deep', label: 'deep_model.py', meta: 'slide 29' } }] } },
      'With `return_sequences=True` a recurrent layer outputs its state at **every** time step, so the next recurrent layer receives a whole sequence; without it, a layer outputs only its **last** state — which is what the final `Dense(1)` needs.',
      'The model has **5,281 trainable parameters** (0 non-trainable). Its validation MAE is **about 29,672**, which is **worse** than the previous “shallower” RNN (27,703): it looks like this RNN is a bit too large for the task.',
    ],
    play: ['deepStack'],
    board: true,
    notes: [
      {
        h: 'Stacking layers (slide 28)',
        lines: [
          'A deep RNN stacks several layers of cells: each layer’s outputs are the inputs of the layer above (Figure 15-10).',
          'Unrolled, every layer also passes its state sideways to its own next time step.',
        ],
      },
      {
        h: 'In Keras (slide 29)',
        lines: [
          'Stack the recurrent layers, and set `return_sequences=True` on every `SimpleRNN` except the last.',
          'A layer with `return_sequences=True` outputs its state at every time step, so the next recurrent layer gets a sequence.',
          'The last `SimpleRNN(32)` outputs only its final state, which `Dense(1)` turns into the forecast.',
        ],
      },
      {
        h: 'The result',
        lines: [
          'Parameters: 1,088 + 2,080 + 2,080 + 33 = 5,281.',
          'Validation MAE about 29,672 — worse than the shallower `univar_model` (27,703): this RNN is a bit too large for the task.',
        ],
      },
    ],
    draw: [
      { fig: 'deepRnn', caption: 'Figure 15-10: draw 3 layers × 4 time steps (0, 1, t−1, t); label $\\mathbf{X}_{(t)}$ at the bottom, $\\hat{\\mathbf{Y}}_{(t)}$ at the top and the sideways state arrows. In slide 29’s deep_model, layers 1 and 2 need return_sequences=True and the last layer passes on only its last step; Figure 15-10 itself draws an output at every step.' },
    ],
    formulas: [
      { code: 'SimpleRNN(32, return_sequences=True)  # a 32-wide output at every step\nSimpleRNN(32)                         # only the last step\'s 32 values', tag: 'the comments are this page’s', read: 'Keep the time axis for every recurrent layer that feeds another; drop it in the last one.' },
    ],
    worked: {
      title: 'deep_model’s 5,281 parameters (slide 29)',
      lines: [
        'Layer 1 (1 input): $1 \\times 32 + 32 \\times 32 + 32 = 1{,}088$.',
        'Layers 2 and 3 (32 inputs each): $32 \\times 32 + 32 \\times 32 + 32 = 2{,}080$; Dense(1): $32 + 1 = 33$; total $5{,}281$.',
      ],
    },
    check: [
      { q: 'Which layers of a deep RNN need `return_sequences=True`?', a: 'Every recurrent layer except the last one.' },
      { q: 'Did `deep_model` beat `univar_model`?', a: 'No: about 29,672 against 27,703 — the deeper RNN was a bit too large for the task.' },
    ],
  },

  /* ── §10 ────────────────────────────────────────────────────────────── */
  {
    id: 's10',
    no: '10',
    title: 'Multivariate input & multiple outputs',
    short: 'Multivariate & multitask',
    slides: '30–33',
    read: [
      'A great quality of neural networks is their **flexibility**: they can deal with **multivariate time series** with almost no change to their architecture (slide 30). For example, predict the rail series with the **day type** as an additional input:',
      { code: { src: 'mulvarDf', label: 'df_mulvar.py', meta: 'slide 30' } },
      'Both the bus and rail series are used (÷ 1e6), plus **tomorrow’s day type** — `shift(-1)` moves each day’s type up one row — one-hot encoded by `pd.get_dummies` into `next_day_type_A`, `next_day_type_U` and `next_day_type_W`: **5 columns** in all. `mulvar_train.head()` starts on 2016-01-01 with bus 0.303321, rail 0.319835 and `next_day_type_A` = 1.',
      'Slide 31: the datasets use **all 5 columns** as inputs but forecast **only the rail series** (`targets=mulvar_train["rail"][seq_length:]`); the other arguments are as before. The model changes only its input shape, to `[None, 5]`:',
      { unfold: { label: 'Slide 31’s dataset code', blocks: [{ code: { src: 'mulvarDs', label: 'mulvar_datasets.py', meta: 'slide 31' } }] } },
      { unfold: { label: 'Slide 31’s code — also in the lab below', blocks: [{ code: { src: 'mulvarModel', label: 'mulvar_model.py', meta: 'slide 31' } }] } },
      'Evaluated with `fit_and_evaluate`, this `mulvar_model` reaches a validation MAE of **22,062** — the best so far.',
      '**Forecasting multiple outputs** (slide 32). With small changes to the datasets, a **multitask** RNN predicts both the daily numbers of rail and bus riders: the targets become `mulvar_train[["bus", "rail"]][seq_length:]` (2 targets per day) and the output layer becomes `Dense(2)`.',
      { unfold: { label: 'Slides 32–33’s code', blocks: [{ code: { src: 'multask', label: 'multask_model.py', meta: 'slide 32' } }, { code: { src: 'multaskPred', label: 'per_series_mae.py', meta: 'slide 33' } }, { code: { src: 'multaskOut', label: 'output', meta: 'slide 33' } }] } },
      'Slide 33: this `multask_model` gives **27,855 MAE**. Using `predict` to get the raw daily predictions gives the MAE of each series: **bus 26,812** and **rail 28,896**. Different runs can yield slightly different results: in a **2024 run**, the total validation MAE was **24,421**, with **25,162** for bus and **23,680** for rail.',
      { slideNote: 'Slide 33’s code ends in `print(name, int(mae))`, which would print `bus 26812` without the comma shown in its output box.' },
      { note: 'Slide 33 quotes two runs, and its 27,855 and 24,421 cover both outputs together, so neither is like-for-like with the single-output rail MAEs. The scoreboard lists the rail figure of the slide’s first run and flags the row.' },
    ],
    play: ['feature'],
    board: true,
    notes: [
      {
        h: 'Multivariate input (slides 30–31)',
        lines: [
          'Neural networks handle multivariate time series with almost no change to their architecture.',
          '`df_mulvar` holds bus and rail (÷ 1e6) plus tomorrow’s day type, one-hot encoded into `next_day_type_A`, `_U` and `_W`: 5 columns.',
          'The inputs use all 5 columns but the targets are only the rail series; the model’s input shape becomes `[None, 5]`.',
          '`mulvar_model` (SimpleRNN(32) + Dense(1)) reaches a validation MAE of 22,062, the best so far.',
        ],
      },
      {
        h: 'Multiple outputs (slides 32–33)',
        lines: [
          'A multitask model predicts bus and rail together: two targets per day and a `Dense(2)` output layer.',
          '`multask_model` gives 27,855 MAE; per series, bus 26,812 and rail 28,896.',
          'Different runs differ: a 2024 run gave 24,421 in total, bus 25,162 and rail 23,680.',
        ],
      },
    ],
    draw: [
      { fig: 'mulvar', caption: 'Draw one input row with its 5 columns (bus, rail, A, U, W) and the SimpleRNN(32), then the two alternative output layers: Dense(1) → rail (mulvar_model) or Dense(2) → bus and rail (multask_model).' },
    ],
    formulas: [
      { code: 'df_mulvar["next_day_type"] = df["day_type"].shift(-1)\ndf_mulvar = pd.get_dummies(df_mulvar)', read: 'Tomorrow’s day type moved onto today’s row, then one-hot encoded into three 0/1 columns.' },
      { code: 'InputLayer(shape=[None, 5]) … Dense(2)', read: 'Any number of days of 5 features in; two numbers (bus, rail) out.' },
    ],
    worked: {
      title: 'Parameter counts the slides don’t print (computed here)',
      lines: [
        '`mulvar_model`: SimpleRNN(32) on 5 inputs $= 5 \\times 32 + 32 \\times 32 + 32 = 1{,}216$, plus Dense(1) $= 33$: $1{,}249$.',
        '`multask_model`: the same RNN plus Dense(2) $= 32 \\times 2 + 2 = 66$: $1{,}282$.',
      ],
    },
    check: [
      { q: 'What are `mulvar_model`’s 5 input columns?', a: 'bus, rail, next_day_type_A, next_day_type_U and next_day_type_W.' },
      { q: 'What changes to make the model predict bus and rail?', a: 'Two targets per day (`mulvar_train[["bus", "rail"]][seq_length:]`) and a `Dense(2)` output layer.' },
    ],
  },

  /* ── §11 ────────────────────────────────────────────────────────────── */
  {
    id: 's11',
    no: '11',
    title: 'Forecasting several steps ahead',
    short: 'Several steps ahead',
    slides: '34–39',
    read: [
      'One way to forecast several time steps ahead is to use the predicted value at time step $t - 1$ as the **last input value for time step $t$** (slide 34). Starting from the first 56 days of `rail_valid` (which starts on 2019-01-01), `univar_model` predicts one day, the prediction is appended to `X`, and this repeats 14 times:',
      { unfold: { label: 'Slide 34’s code — also in the lab below', blocks: [{ code: { src: 'loop', label: 'forecast_14_steps.py', meta: 'slide 34' } }] } },
      'Figure 15-11 shows the result — forecasting **14 steps ahead, 1 step at a time**, from “Today” (25 February 2019). **Validation MAE = 30,734.** This method only works when the input and output vectors [have] the same features. Note that `univar_model` was trained to predict **one** step ahead only.',
      'Alternatively, train an RNN to forecast the rail riders for the next **14 days** at the last time step (slide 35). Each window is now `seq_length + 14` = 70 days long with `targets=None`, and `split_inputs_and_targets` cuts every window into the first 56 days of all 5 columns (the inputs) and the last 14 values of column `target_col=1`, rail (the targets):',
      { unfold: { label: 'Slide 35’s code — also in the lab below', blocks: [{ code: { src: 'aheadDs', label: 'ahead_datasets.py', meta: 'slide 35' } }] } },
      'Slide 36: `ahead_train_ds` has **33 batches**; a batch has inputs of shape **(32, 56, 5)** and targets of shape **(32, 14)**. Plotting the first two sequences of a training batch (slide 37) confirms the set-up: each input timestep is a 5-dimensional vector, and only the number of rail riders is predicted, for 14 time steps ahead.',
      { unfold: { label: 'Slide 36’s code', blocks: [{ code: { src: 'aheadInspect', label: 'inspect_ahead.py', meta: 'slide 36' } }, { code: { src: 'aheadVis', label: 'plot_ahead.py', meta: 'slide 36' } }] } },
      'The model, `ahead_model`, ends in a `Dense(14)` output layer — one output per day ahead (slide 38):',
      { unfold: { label: 'Slide 38’s code — also in the lab below', blocks: [{ code: { src: 'aheadModel', label: 'ahead_model.py', meta: 'slide 38' } }] } },
      'It gave a validation MAE of **33,887** for rail. Forecasting just one day is obviously better than forecasting 14 days into the future; but even with 5 input features, `ahead_model` performed slightly **worse** than `univar_model`, which uses 1 feature and predicts 1 day at a time through looping (30,734).',
      '**Sequence-to-sequence, a preview** (slide 39). Instead of forecasting the next 14 values only at the very last time step, a model can be trained to forecast at **each and every** time step — e.g. use days 0 to 9 to forecast days 10 to 19, then days 1 to 10 to forecast days 11 to 20, and so on. This can be done with the **Encoder–Decoder** architecture (bottom right of Figure 15-4, [§4](#s04)), which the deck studies in **lecture topic 8 (Transformers)**.',
      { fig: 'seq2seqPreview' },
      { slideNote: 'Slide 39 has a typo (“to forest the output” for “forecast”), and its example uses 10-day inputs and 10-day outputs, not the 14-day horizon and 56-day windows of slides 35–38. Its title says sequence-to-sequence (Figure 15-4’s top-left panel), yet it says this “can be done using” the encoder–decoder of the bottom-right panel.' },
    ],
    play: ['loop', 'aheadSplit'],
    board: true,
    notes: [
      {
        h: 'One step at a time (slide 34)',
        lines: [
          'Feed the prediction for step $t - 1$ back in as the last input for step $t$, and repeat 14 times.',
          'Slide 34 starts from the first 56 days of `rail_valid` and appends each `univar_model` prediction to `X`.',
          'This works only when the inputs and outputs have the same features; the validation MAE was 30,734.',
        ],
      },
      {
        h: '14 days at once (slides 35–38)',
        lines: [
          'Make each window 70 days (`seq_length + 14`) and split it: 56 days of all 5 columns in, the next 14 rail values out (`target_col=1`).',
          '`ahead_train_ds` has 33 batches, with inputs (32, 56, 5) and targets (32, 14).',
          '`ahead_model` ends in `Dense(14)`, one output per day ahead; its rail validation MAE was 33,887, slightly worse than looping `univar_model`.',
        ],
      },
      {
        h: 'Sequence-to-sequence (slide 39)',
        lines: [
          'A model can instead forecast at every time step, e.g. days 0–9 → days 10–19, then days 1–10 → days 11–20.',
          'This can be done using the encoder–decoder architecture, studied in lecture topic 8 (Transformers).',
        ],
      },
    ],
    draw: [
      { fig: 'loop', caption: 'Draw X as a row of boxes, the model, and the prediction appended as a new last box; label X.shape growing from (1, 56, 1) to (1, 70, 1) after 14 rounds (shapes worked out from slide 34’s code).' },
      { fig: 'aheadSplit', caption: 'Draw one 70-day window with 5 columns; bracket days 0–55 of every column as the inputs and the rail column of days 56–69 as the targets.' },
    ],
    formulas: [
      { code: 'return mulvar_series[:, :-ahead], mulvar_series[:, -ahead:, target_col]', read: 'Inputs = all but the last 14 days; targets = the last 14 days of column target_col (1 = rail).' },
      { tex: '(32,\\ 70,\\ 5) \\;\\longrightarrow\\; (32,\\ 56,\\ 5) \\;+\\; (32,\\ 14)', tag: 'the 70-day batch is this page’s; the split shapes are slide 36’s', read: 'One batch of 70-day windows split into inputs and 14-day rail targets.' },
    ],
    worked: {
      title: 'Counting ahead_train_ds’s batches (slide 36 prints 33; this page’s count)',
      lines: [
        'Training period 2016-01-01 to 2018-12-31: 1,096 days. Windows of 70: $1{,}096 - 70 + 1 = 1{,}027$.',
        'Batches of 32: $\\lceil 1{,}027 / 32 \\rceil = 33$ — 32 full batches and one of 3.',
      ],
    },
    check: [
      { q: 'How does slide 34 get 14 days from a one-step model?', a: 'It predicts one day, appends the prediction to the input X, and repeats 14 times.' },
      { q: 'What shapes does an `ahead_train_ds` batch have?', a: 'Inputs (32, 56, 5) and targets (32, 14): 56 days of 5 features in, 14 rail values out.' },
    ],
  },

  /* ── §12 ────────────────────────────────────────────────────────────── */
  {
    id: 's12',
    no: '12',
    title: 'Handling long sequences',
    short: 'Long sequences',
    slides: '40–41',
    read: [
      'Just like the deep nets of previous chapters, training an RNN on **long sequences** (many time steps) has the **vanishing/exploding gradient** problem: it takes a long time to train, or the training may be unstable. Moreover, when an RNN processes a long sequence, it will **gradually forget the first inputs** in the sequence (slide 40).',
      'To fight the unstable gradients, tricks such as **good parameter initialization**, **faster optimizers** and **dropout** should all be considered. However, **nonsaturating activation functions** (e.g. ReLU) may not help as much here, because **the same weights are used in every time step** and may lead to **exploding outputs**. You can reduce that risk with a **smaller learning rate** or a **saturating activation function** like the hyperbolic tangent — that’s why tanh is the default.',
      '**Batch normalisation** can be put over RNN layers, but it was reported not to yield good results when BN was used at each time step (slide 41). **Layer normalization**[^1] has been reported to be better for RNNs. It is very similar to batch normalization, but instead of normalizing **across the batch dimension**, layer normalization normalizes **across the features dimension**. Slide 41’s example:',
      { code: { src: 'ln', label: 'layer_norm.py', meta: 'slide 41' } },
      { slideNote: 'This example won’t run as written. `SimpleRNNCell(32)` is a **cell** — it computes a single time step and needs its state passed in — so it can’t sit directly in a `Sequential` model fed with sequences; a cell has to be wrapped in a `tf.keras.layers.RNN` layer. Even wrapped, a `LayerNormalization()` placed after the RNN layer would normalize once, after the last step — not inside the cell at every time step, which is how the textbook applies it (a custom cell, wrapped in `RNN`). The cell and `RNN`-wrapper details are Keras facts beyond the slides. The code is shown as on the slide.' },
    ],
    play: ['gradient', 'normAxis'],
    notes: [
      {
        h: 'Long sequences (slide 40)',
        lines: [
          'Training an RNN over many time steps has the vanishing/exploding gradient problem: training is slow or unstable.',
          'An RNN processing a long sequence gradually forgets the first inputs.',
          'Good initialization, faster optimizers and dropout should all be considered; ReLU may not help as much, because the same weights are used at every step and the outputs can explode.',
          'A smaller learning rate or a saturating activation such as tanh reduces the risk — that is why tanh is the default.',
        ],
      },
      {
        h: 'Normalization (slide 41)',
        lines: [
          'Batch normalisation over RNN layers was reported not to give good results when used at each time step.',
          'Layer normalization (Ba et al., 2016) is reported to be better for RNNs: it normalizes across the features dimension instead of the batch dimension.',
        ],
      },
    ],
    draw: [
      { fig: 'normAxes', caption: 'Draw a batch × features grid twice; shade one column for batch norm and one row for layer norm, and label the dimension each normalizes across.' },
    ],
    worked: {
      title: 'The same weight at every step (the lab’s one-unit RNN)',
      lines: [
        'The same weight $w$ is used at every step, so each step multiplies the gradient by a factor $w\\,\\varphi\'$; if those factors were 0.9 for 50 steps, $0.9^{50} \\approx 0.005$.',
        'If they were 1.1 instead: $1.1^{50} \\approx 117$ — a small difference per step becomes huge. For tanh, $\\varphi\' \\le 1$, so saturation shrinks the factor further.',
      ],
    },
    check: [
      { q: 'Why may ReLU not help with unstable gradients in an RNN?', a: 'The same weights are used at every time step, so a nonsaturating activation can let the outputs explode.' },
      { q: 'Across which dimension does layer normalization normalize?', a: 'The features dimension; batch normalization normalizes across the batch dimension.' },
    ],
  },

  /* ── §13.1 ──────────────────────────────────────────────────────────── */
  {
    id: 's13a',
    no: '13.1',
    group: 'LSTM cells',
    title: 'The LSTM cell and its long-term state',
    short: 'LSTM: long-term state',
    slides: '42–45',
    read: [
      'Due to the transformations the data goes through when traversing an RNN, **some information is lost at each time step**; after a while, the RNN’s state contains virtually no trace of the first inputs. To tackle this problem, various types of cells with **long-term memory** have been introduced (slide 42).',
      'The **long short-term memory (LSTM)** cell was proposed in 1997[^2]. Considered as a black box, it can be used very much like a basic cell, except it performs much better: **training will converge faster**, and it will **detect long-term dependencies** in the data.',
      'In TensorFlow you can simply use an `LSTM` layer instead of a `SimpleRNN` (slide 43):',
      { code: { src: 'lstm', label: 'lstm_model.py', meta: 'slide 43' } },
      'This model gave a validation MAE of **30,262**. LSTM cells manage **two state vectors**: $\\mathbf{h}_{(t)}$ and $\\mathbf{c}_{(t)}$ (“c” stands for “cell”). Think of $\\mathbf{h}_{(t)}$ as the **short-term state** and $\\mathbf{c}_{(t)}$ as the **long-term state**. The key idea is that the network can learn **what to store** in the long-term state, **what to throw away**, and **what to read** from it.',
      'Figure 15-12 (slides 44–45): as the long-term state $\\mathbf{c}_{(t-1)}$ traverses the cell from left to right, it first goes through a **forget gate**, dropping some memories, and then it **adds some new memories** via the addition operation (which adds the memories selected by an **input gate**). The result $\\mathbf{c}_{(t)}$ is sent straight out, without any further transformation.',
      'Moreover, $\\mathbf{c}_{(t)}$ is also passed through the **tanh** function and then filtered by the **output gate**. This produces the short-term state $\\mathbf{h}_{(t)}$, which is equal to the cell’s output for this time step, $\\mathbf{y}_{(t)}$.',
      { slideNote: 'Figure 15-12 labels the cell’s output $\\hat{\\mathbf{y}}_{(t)}$ (with a hat); the slide text and equations write $\\mathbf{y}_{(t)}$.' },
    ],
    play: ['lstmCell'],
    board: true,
    notes: [
      {
        h: 'Why LSTM (slides 42–43)',
        lines: [
          'Some information is lost at each time step, so after a while a basic RNN’s state holds virtually no trace of the first inputs.',
          'The LSTM cell (1997) adds long-term memory: training converges faster and it detects long-term dependencies.',
          'In Keras, swap `SimpleRNN` for `LSTM`: `lstm_model` (`LSTM(12)`) has 685 parameters and a validation MAE of 30,262.',
        ],
      },
      {
        h: 'Two states (slide 43)',
        lines: [
          'An LSTM cell keeps two state vectors: $\\mathbf{h}_{(t)}$, the short-term state, and $\\mathbf{c}_{(t)}$, the long-term state.',
          'It learns what to store in the long-term state, what to throw away and what to read from it.',
        ],
      },
      {
        h: 'The long-term path (slides 44–45)',
        lines: [
          '$\\mathbf{c}_{(t-1)}$ first passes the forget gate, which drops some memories, then the addition adds new memories selected by the input gate.',
          'The result $\\mathbf{c}_{(t)}$ leaves the cell with no further transformation.',
          '$\\mathbf{c}_{(t)}$ also goes through tanh and is filtered by the output gate, giving $\\mathbf{h}_{(t)} = \\mathbf{y}_{(t)}$.',
        ],
      },
    ],
    draw: [
      { fig: 'lstmCell', caption: 'Figure 15-12: label the c line with the forget ⊗ and the +, the four FC boxes f, g, i, o (σ, tanh, σ, σ), the input ⊗, and the tanh and output ⊗ that give $\\mathbf{h}_{(t)}$.' },
    ],
    check: [
      { q: 'Which LSTM state is the long-term one?', a: '$\\mathbf{c}_{(t)}$; $\\mathbf{h}_{(t)}$ is the short-term state (and the output).' },
      { q: 'What happens to $\\mathbf{c}_{(t-1)}$ on its way through the cell?', a: 'The forget gate drops some memories, then new memories selected by the input gate are added; the result leaves as $\\mathbf{c}_{(t)}$.' },
    ],
  },

  /* ── §13.2 ──────────────────────────────────────────────────────────── */
  {
    id: 's13b',
    no: '13.2',
    group: 'LSTM cells',
    title: 'Inside the LSTM: four FC layers and the equations',
    short: 'LSTM: gates & equations',
    slides: '46–47',
    read: [
      'For the short-term state $\\mathbf{h}_{(t-1)}$, new memories come from the input $\\mathbf{x}_{(t)}$. Both $\\mathbf{h}_{(t-1)}$ and $\\mathbf{x}_{(t)}$ are fed to **four different fully connected (FC) layers** (slide 46):',
      {
        list: [
          'The **main layer** outputs $\\mathbf{g}_{(t)}$. It has the usual role of analyzing the current inputs $\\mathbf{x}_{(t)}$ and the previous (short-term) state $\\mathbf{h}_{(t-1)}$; in an LSTM cell, this layer’s output is **partially stored in the long-term state**.',
          'The three other layers are **gate controllers**. Since they use the **logistic** activation function, their outputs range from **0 to 1**.',
          '— the **forget gate** (controlled by $\\mathbf{f}_{(t)}$) controls which parts of the long-term state should be **erased**;',
          '— the **input gate** (controlled by $\\mathbf{i}_{(t)}$) controls which parts of $\\mathbf{g}_{(t)}$ should be **added** to the long-term state;',
          '— finally, the **output gate** (controlled by $\\mathbf{o}_{(t)}$) controls which parts of the long-term state should be **read and output** at this time step (both to $\\mathbf{h}_{(t)}$ and $\\mathbf{y}_{(t)}$).',
        ],
      },
      'In short, an LSTM cell can learn to **recognize an important input** (the role of the input gate), **store it** in the long-term state, **preserve it for as long as it is needed** (the role of the forget gate), and **extract it whenever it is needed** (slide 47). This explains why LSTMs have been amazingly successful at capturing long-term patterns in time series, long texts, audio recordings, and more.',
      'LSTM computations (slide 47):',
      {
        eq: {
          name: 'The LSTM cell (slide 47)',
          tex: '\\begin{aligned} \\mathbf{i}_{(t)}^{\\top} &= \\sigma\\left(\\mathbf{x}_{(t)}^{\\top}\\mathbf{W}_{xi} + \\mathbf{h}_{(t-1)}^{\\top}\\mathbf{W}_{hi} + \\mathbf{b}_{i}^{\\top}\\right) \\\\ \\mathbf{f}_{(t)}^{\\top} &= \\sigma\\left(\\mathbf{x}_{(t)}^{\\top}\\mathbf{W}_{xf} + \\mathbf{h}_{(t-1)}^{\\top}\\mathbf{W}_{hf} + \\mathbf{b}_{f}^{\\top}\\right) \\\\ \\mathbf{o}_{(t)}^{\\top} &= \\sigma\\left(\\mathbf{x}_{(t)}^{\\top}\\mathbf{W}_{xo} + \\mathbf{h}_{(t-1)}^{\\top}\\mathbf{W}_{ho} + \\mathbf{b}_{o}^{\\top}\\right) \\\\ \\mathbf{g}_{(t)}^{\\top} &= \\tanh\\left(\\mathbf{x}_{(t)}^{\\top}\\mathbf{W}_{xg} + \\mathbf{h}_{(t-1)}^{\\top}\\mathbf{W}_{hg} + \\mathbf{b}_{g}^{\\top}\\right) \\\\ \\mathbf{c}_{(t)} &= \\mathbf{f}_{(t)} \\otimes \\mathbf{c}_{(t-1)} + \\mathbf{i}_{(t)} \\otimes \\mathbf{g}_{(t)} \\\\ \\mathbf{y}_{(t)} &= \\mathbf{h}_{(t)} = \\mathbf{o}_{(t)} \\otimes \\tanh\\left(\\mathbf{c}_{(t)}\\right) \\end{aligned}',
          read: 'three logistic gates and a tanh main layer, each from x(t) and h(t−1); the long-term state keeps f of the old and adds i of g; the output is o of tanh(c).',
        },
      },
      { note: '$\\sigma$ is the logistic function and $\\otimes$ is element-wise multiplication. The gate lines use transposed row vectors, as slide 9 does; the $\\mathbf{c}_{(t)}$ and $\\mathbf{h}_{(t)}$ lines are element-wise.' },
      { slideNote: 'Slide 47 writes the gate lines with transposed row vectors but drops the ⊤ on the $\\mathbf{c}_{(t)}$ and $\\mathbf{h}_{(t)}$ lines; both are element-wise, so the result is the same.' },
    ],
    play: ['lstmMath'],
    notes: [
      {
        h: 'Four FC layers (slide 46)',
        lines: [
          'Both $\\mathbf{h}_{(t-1)}$ and $\\mathbf{x}_{(t)}$ feed four fully connected layers.',
          'The main layer outputs $\\mathbf{g}_{(t)}$ (tanh); its output is partly stored in the long-term state.',
          'The other three are gate controllers with the logistic function, so their outputs are between 0 and 1.',
        ],
      },
      {
        h: 'The three gates',
        lines: [
          'Forget gate $\\mathbf{f}_{(t)}$: which parts of the long-term state to erase.',
          'Input gate $\\mathbf{i}_{(t)}$: which parts of $\\mathbf{g}_{(t)}$ to add to the long-term state.',
          'Output gate $\\mathbf{o}_{(t)}$: which parts of the long-term state to read and output, to both $\\mathbf{h}_{(t)}$ and $\\mathbf{y}_{(t)}$.',
        ],
      },
      {
        h: 'In short (slide 47)',
        lines: [
          'An LSTM learns to recognize an important input (input gate), store it, preserve it as long as needed (forget gate) and extract it when needed.',
        ],
      },
    ],
    draw: [
      { fig: 'lstmGates', caption: 'Draw $\\mathbf{x}_{(t)}$ and $\\mathbf{h}_{(t-1)}$ feeding four FC boxes; write σ on f, i, o and tanh on g, and where each output goes: f → forget ⊗, i and g → input ⊗, o → output ⊗.' },
    ],
    formulas: [
      { tex: '\\mathbf{i}_{(t)}^{\\top} = \\sigma\\left(\\mathbf{x}_{(t)}^{\\top}\\mathbf{W}_{xi} + \\mathbf{h}_{(t-1)}^{\\top}\\mathbf{W}_{hi} + \\mathbf{b}_{i}^{\\top}\\right)', read: 'The input gate, between 0 and 1: how much of g to add.' },
      { tex: '\\mathbf{f}_{(t)}^{\\top} = \\sigma\\left(\\mathbf{x}_{(t)}^{\\top}\\mathbf{W}_{xf} + \\mathbf{h}_{(t-1)}^{\\top}\\mathbf{W}_{hf} + \\mathbf{b}_{f}^{\\top}\\right)', read: 'The forget gate: how much of the old long-term state to keep.' },
      { tex: '\\mathbf{o}_{(t)}^{\\top} = \\sigma\\left(\\mathbf{x}_{(t)}^{\\top}\\mathbf{W}_{xo} + \\mathbf{h}_{(t-1)}^{\\top}\\mathbf{W}_{ho} + \\mathbf{b}_{o}^{\\top}\\right)', read: 'The output gate: how much of the long-term state to read out.' },
      { tex: '\\mathbf{g}_{(t)}^{\\top} = \\tanh\\left(\\mathbf{x}_{(t)}^{\\top}\\mathbf{W}_{xg} + \\mathbf{h}_{(t-1)}^{\\top}\\mathbf{W}_{hg} + \\mathbf{b}_{g}^{\\top}\\right)', read: 'The main layer: the candidate new memory, between −1 and 1.' },
      { tex: '\\mathbf{c}_{(t)} = \\mathbf{f}_{(t)} \\otimes \\mathbf{c}_{(t-1)} + \\mathbf{i}_{(t)} \\otimes \\mathbf{g}_{(t)}', read: 'Keep what the forget gate lets through; add what the input gate selects from g.' },
      { tex: '\\mathbf{y}_{(t)} = \\mathbf{h}_{(t)} = \\mathbf{o}_{(t)} \\otimes \\tanh\\left(\\mathbf{c}_{(t)}\\right)', read: 'The output gate reads part of tanh of the long-term state.' },
    ],
    worked: {
      title: 'One step by hand — the lab’s toy cell storing a signal',
      lines: [
        '$\\mathbf{i}_{(t)} = \\sigma(4) = 0.982$, $\\mathbf{f}_{(t)} = \\sigma(5) = 0.993$, $\\mathbf{g}_{(t)} = \\tanh(3) = 0.995$, $\\mathbf{o}_{(t)} = \\sigma(-4) = 0.018$; $\\mathbf{c}_{(t-1)} = 0$.',
        '$\\mathbf{c}_{(t)} = 0.993 \\times 0 + 0.982 \\times 0.995 = 0.977$ (stored); $\\mathbf{h}_{(t)} = 0.018 \\times \\tanh(0.977) = 0.014$ (not read out yet).',
      ],
    },
    check: [
      { q: 'What range do the gate controllers output, and why?', a: '0 to 1, because they use the logistic (σ) activation function.' },
      { q: 'Which gate decides what is erased from the long-term state?', a: 'The forget gate, controlled by $\\mathbf{f}_{(t)}$.' },
    ],
  },

  /* ── §14 ────────────────────────────────────────────────────────────── */
  {
    id: 's14',
    no: '14',
    title: 'GRU cells',
    short: 'GRU cells',
    slides: '48–49',
    read: [
      'The **GRU cell** (Figure 15-13) is a **simplified version of the LSTM** cell (slide 48):',
      {
        list: [
          'Both state vectors are **merged into a single vector** $\\mathbf{h}_{(t)}$.',
          'A **single gate controller** $\\mathbf{z}_{(t)}$ controls **both the forget gate and the input gate**.',
          'There is **no output gate**: the full state vector is output at every time step.',
        ],
      },
      'In Figure 15-13, $\\mathbf{z}_{(t)}$ multiplies the old state $\\mathbf{h}_{(t-1)}$ on the top line, while $1 - \\mathbf{z}_{(t)}$ multiplies the main layer’s output $\\mathbf{g}_{(t)}$ before the addition. A second gate controller, $\\mathbf{r}_{(t)}$, multiplies $\\mathbf{h}_{(t-1)}$ before it reaches the main layer. GRU computations (slide 49):',
      {
        eq: {
          name: 'The GRU cell (slide 49)',
          tex: '\\begin{aligned} \\mathbf{z}_{(t)}^{\\top} &= \\sigma\\left(\\mathbf{x}_{(t)}^{\\top}\\mathbf{W}_{xz} + \\mathbf{h}_{(t-1)}^{\\top}\\mathbf{W}_{hz} + \\mathbf{b}_{z}^{\\top}\\right) \\\\ \\mathbf{r}_{(t)}^{\\top} &= \\sigma\\left(\\mathbf{x}_{(t)}^{\\top}\\mathbf{W}_{xr} + \\mathbf{h}_{(t-1)}^{\\top}\\mathbf{W}_{hr} + \\mathbf{b}_{r}^{\\top}\\right) \\\\ \\mathbf{g}_{(t)}^{\\top} &= \\tanh\\left(\\mathbf{x}_{(t)}^{\\top}\\mathbf{W}_{xg} + \\left(\\mathbf{r}_{(t)}^{\\top}\\mathbf{W}_{hg} \\otimes \\mathbf{h}_{(t-1)}^{\\top}\\right) + \\mathbf{b}_{g}^{\\top}\\right) \\\\ \\mathbf{h}_{(t)} &= \\mathbf{z}_{(t)} \\otimes \\mathbf{h}_{(t-1)} + \\left(1 - \\mathbf{z}_{(t)}\\right) \\otimes \\mathbf{g}_{(t)} \\end{aligned}',
          read: 'two logistic gates z and r, a tanh main layer g; the new state keeps z of the old state and takes 1 − z of g.',
        },
      },
      { slideNote: 'As typeset, the $\\mathbf{g}_{(t)}$ line reads $\\left(\\mathbf{r}^{\\top}_{(t)}\\mathbf{W}_{hg} \\otimes \\mathbf{h}^{\\top}_{(t-1)}\\right)$: multiply $\\mathbf{r}$ by $\\mathbf{W}_{hg}$, then element-wise by $\\mathbf{h}_{(t-1)}$. Figure 15-13 (slide 48) applies the gate first — $\\mathbf{r}_{(t)} \\otimes \\mathbf{h}_{(t-1)}$, then the FC layer, i.e. $\\left(\\mathbf{r}_{(t)} \\otimes \\mathbf{h}_{(t-1)}\\right)^{\\top}\\mathbf{W}_{hg}$ (the textbook writes the same thing in column form, $\\mathbf{W}_{hg}^{\\top}(\\mathbf{r}_{(t)} \\otimes \\mathbf{h}_{(t-1)})$). Both have valid shapes because $\\mathbf{W}_{hg}$ is square, so the difference is easy to miss. The lab computes the figure’s order and shows the slide’s line next to it.' },
      'Example (slide 49):',
      { code: { src: 'gru', label: 'gru_model.py', meta: 'slide 49' } },
      'Validation MAE from `gru_model` = **26,497**.',
      { note: 'Where 1,401 comes from — an aside beyond the slides: Keras’s `GRU` layer (default `reset_after=True`) keeps **two** bias vectors per gate group (and applies $\\mathbf{r}_{(t)}$ after multiplying $\\mathbf{h}_{(t-1)}$ by $\\mathbf{W}_{hg}$ — a third ordering), so `GRU(20)` on 1 input has $3 \\times (20 \\times 1 + 20 \\times 20 + 2 \\times 20) = 1{,}380$ parameters, plus 21 for `Dense(1)`: 1,401. With one bias per gate, as slide 49’s equations show, it would be $3 \\times 440 + 21 = 1{,}341$.' },
    ],
    play: ['gru'],
    board: true,
    notes: [
      {
        h: 'A simplified LSTM (slide 48)',
        lines: [
          'The GRU merges the two state vectors into one, $\\mathbf{h}_{(t)}$.',
          'One gate controller, $\\mathbf{z}_{(t)}$, controls both the forget gate and the input gate.',
          'There is no output gate: the full state vector is output at every time step.',
        ],
      },
      {
        h: 'The computations (slide 49)',
        lines: [
          '$\\mathbf{z}_{(t)}$ and $\\mathbf{r}_{(t)}$ are logistic gates computed from $\\mathbf{x}_{(t)}$ and $\\mathbf{h}_{(t-1)}$.',
          '$\\mathbf{g}_{(t)}$ is the tanh main layer, and $\\mathbf{r}_{(t)}$ gates how much of $\\mathbf{h}_{(t-1)}$ it sees.',
          'The new state is $\\mathbf{z}_{(t)} \\otimes \\mathbf{h}_{(t-1)} + (1 - \\mathbf{z}_{(t)}) \\otimes \\mathbf{g}_{(t)}$: keep a share of the old state, fill the rest from $\\mathbf{g}_{(t)}$.',
        ],
      },
      {
        h: 'In Keras (slide 49)',
        lines: ['`gru_model` (`GRU(20)` + `Dense(1)`) has 1,401 parameters and a validation MAE of 26,497.'],
      },
    ],
    draw: [
      { fig: 'gruCell', caption: 'Figure 15-13: label the single h line, the z ⊗ on top, the 1 − z box and its ⊗ with g, the +, the r ⊗ $\\mathbf{h}_{(t-1)}$ into the g box, and σ, σ, tanh on r, z, g.' },
    ],
    formulas: [
      { tex: '\\mathbf{z}_{(t)}^{\\top} = \\sigma\\left(\\mathbf{x}_{(t)}^{\\top}\\mathbf{W}_{xz} + \\mathbf{h}_{(t-1)}^{\\top}\\mathbf{W}_{hz} + \\mathbf{b}_{z}^{\\top}\\right)', read: 'z: the single gate controller for both forgetting and adding.' },
      { tex: '\\mathbf{r}_{(t)}^{\\top} = \\sigma\\left(\\mathbf{x}_{(t)}^{\\top}\\mathbf{W}_{xr} + \\mathbf{h}_{(t-1)}^{\\top}\\mathbf{W}_{hr} + \\mathbf{b}_{r}^{\\top}\\right)', read: 'r: the second gate controller, which gates the old state on its way to g.' },
      { tex: '\\mathbf{g}_{(t)}^{\\top} = \\tanh\\left(\\mathbf{x}_{(t)}^{\\top}\\mathbf{W}_{xg} + \\left(\\mathbf{r}_{(t)}^{\\top}\\mathbf{W}_{hg} \\otimes \\mathbf{h}_{(t-1)}^{\\top}\\right) + \\mathbf{b}_{g}^{\\top}\\right)', tag: 'as typeset — see the Slide check', read: 'The candidate state. As typeset, r meets W_hg first; Figure 15-13 gates h(t−1) first — both fit because W_hg is square.' },
      { tex: '\\mathbf{h}_{(t)} = \\mathbf{z}_{(t)} \\otimes \\mathbf{h}_{(t-1)} + \\left(1 - \\mathbf{z}_{(t)}\\right) \\otimes \\mathbf{g}_{(t)}', read: 'z of the old state plus (1 − z) of the candidate.' },
    ],
    worked: {
      title: 'LSTM vs GRU on the slides’ models (totals from slides 43 and 49; breakdowns this page’s)',
      lines: [
        '`lstm_model`: four FC layers, $4 \\times (12 + 144 + 12) + 13 = 685$.',
        '`gru_model`: three FC layers, $3 \\times (20 + 400 + 40) + 21 = 1{,}401$ (this page’s breakdown, using Keras’s two biases per layer — the aside above).',
      ],
    },
    check: [
      { q: 'Name the GRU’s three simplifications of the LSTM.', a: 'One state vector instead of two; one gate controller z for both the forget and input gates; no output gate.' },
      { q: 'If $\\mathbf{z}_{(t)} = 1$, what is $\\mathbf{h}_{(t)}$?', a: '$\\mathbf{h}_{(t-1)}$ — the old state is kept unchanged.' },
    ],
  },

  /* ── §15 ────────────────────────────────────────────────────────────── */
  {
    id: 's15',
    no: '15',
    title: '1D convolution layers for sequences',
    short: '1D convolutions',
    slides: '50',
    read: [
      'Similar to using 2D convolution layers for images, a **1D convolutional layer** can be used on sequences, producing a **1D feature map per kernel**. If you use 10 kernels, the layer’s output is composed of **10 1D sequences** (all of the same length) — or, equivalently, you can view this output as a single **10D sequence** (slide 50).',
      { unfold: { label: 'Slide 50’s code — also in the lab below', blocks: [{ code: { src: 'cnnGru', label: 'cnn_gru_model.py', meta: 'slide 50' } }] } },
      'If you train and evaluate this model, it performs similarly well to the previous models: its validation MAE was **30,209**. It is actually possible to use **only 1D convolutional layers** and drop the recurrent layers entirely!',
      { note: 'Slide 50 prints only the total, 1,283; the shapes and per-layer counts in the lab and the worked number are this page’s, beyond the slides (Keras’s default `"valid"` padding, and its two GRU biases per gate group from [§14](#s14)).' },
      '**Exercise** (slide 50): the `lstm_model`, `gru_model` and `cnn_gru_model` above use only the #rail riders as input and predict the #rail riders on the 57th day. **Modify the codes to take in 5-feature input and train the model.**',
    ],
    play: ['conv1d', 'cnnGru'],
    board: true,
    notes: [
      {
        h: 'Conv1D on sequences (slide 50)',
        lines: [
          'A 1D convolutional layer slides its kernels along the time axis and produces one 1D feature map per kernel.',
          'With 10 kernels the output is 10 1D sequences of the same length — or, equivalently, one 10D sequence.',
        ],
      },
      {
        h: 'cnn_gru_model',
        lines: [
          'Two Conv1D layers (8 filters of size 3, stride 1; then 16 filters of size 3, stride 2; both ReLU) feed a `GRU(10)` and a `Dense(1)`.',
          'It has 1,283 trainable parameters and a validation MAE of 30,209 — similar to the previous models.',
          'You can even drop the recurrent layers and use only 1D convolutional layers.',
        ],
      },
      {
        h: 'Exercise',
        lines: ['Change `lstm_model`, `gru_model` and `cnn_gru_model` to take the 5-feature input, and train them.'],
      },
    ],
    draw: [
      { fig: 'conv1d', caption: 'Draw 8 input days, a kernel of 3 sliding over them with stride 1, and separately with stride 2; write the output lengths 6 and 3 underneath.' },
    ],
    formulas: [
      { tex: 'L_{\\text{out}} = \\left\\lfloor \\frac{L_{\\text{in}} - k}{s} \\right\\rfloor + 1', tag: '"valid" padding — beyond the slide', read: 'How many positions of a size-k kernel fit, moving s steps at a time.' },
      { tex: '\\#\\text{params}\\big(\\texttt{Conv1D}\\big) = k \\times c_{\\text{in}} \\times \\text{filters} + \\text{filters}', tag: 'beyond the slide', read: 'Each filter has k weights per input channel, plus one bias.' },
    ],
    worked: {
      title: 'cnn_gru_model on a 56-day window (this page’s breakdown, beyond the slides; GRU with Keras’s two biases)',
      lines: [
        'Lengths: $56 - 3 + 1 = 54$, then $\\lfloor (54 - 3) / 2 \\rfloor + 1 = 26$ steps of 16 channels into GRU(10).',
        'Parameters: $32 + 400 + 840 + 11 = 1{,}283$ — slide 50’s total.',
      ],
    },
    check: [
      { q: 'A Conv1D layer has 16 filters. How many 1D sequences does it output?', a: '16 — one feature map per kernel (or, equivalently, one 16-dimensional sequence).' },
      { q: 'Why does the GRU in `cnn_gru_model` see 26 steps, not 56?', a: 'The two Conv1D layers shorten the sequence: 56 → 54 (kernel 3, stride 1) → 26 (kernel 3, stride 2).' },
    ],
  },

  /* ── §16 ────────────────────────────────────────────────────────────── */
  {
    id: 's16',
    no: '16',
    title: 'Summary',
    short: 'Summary',
    slides: '51–52',
    read: [
      'Slide 51 lists what you should be able to do after this topic. Tick each outcome in the checklist below once you can explain it from your notes; every outcome links back to the sections — and notebook pages — that teach it. The full scoreboard sums up the forecasting story of slides 18–50.',
      'For the next topic (slide 52): read up to **Chapter 17**, on *Autoencoders, GANs, and Diffusion Models* (up to page 647). (Not on the slides: the unit’s Lab Sheet 4 practises this topic.)',
    ],
    play: ['scoreboard', 'outcomes'],
    notes: [
      {
        h: 'Learning outcomes (slide 51)',
        lines: [
          'Know when it would be suitable to use RNNs (§1, §4).',
          'Understand recurrent neurons and memory cells (§1–§3).',
          'Understand input and output sequences in a RNN (§4).',
          'Know how to implement a simple RNN in TensorFlow (§8).',
          'Know how to handle variable length input and output sequences (§1, §4, §8, §11).',
          'Know how to train a simple RNN to predict time series (§5–§8, §10, §11).',
          'Know how to build a deep RNN (§9).',
          'Understand the difficulty of training over many time steps (§12, §13.1).',
          'Understand the LSTM and GRU architectures (§13, §14).',
          'Know how to use 1D convolutional layers to process sequences (§15).',
        ],
      },
      {
        h: 'Next (slide 52)',
        lines: ['Read up to Chapter 17: Autoencoders, GANs, and Diffusion Models (up to page 647).'],
      },
    ],
  },
];
