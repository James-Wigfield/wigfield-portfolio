/* ============================================================================
   LECTURE 3 STUDY — SECTION CONTENT
   ----------------------------------------------------------------------------
   The whole module's text, as data, in slide order. Layout code never holds
   prose: edit a note here and the page updates.

   Inline markup (rendered by Rich.jsx):
     **bold**   *italic*   `code`   $tex$   [label](#sectionId)   [^n] footnote

   Each section:
     id, no, title, slides            identity + slide receipt
     read      blocks — a string is a paragraph; objects are
               { eq }, { list }, { code }, { note }, { slideNote }, { unfold },
               { matrices: true } (the four slide-6 filters)
     play      lab keys (components live in ./labs, mapped in the shell)
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
      '**Topic 3: Deep Computer Vision Using Convolutional Neural Networks** — CITS5017 Deep Learning, A/Prof Du Huynh, Semester 2, 2026 (slide 1). The reading is **Chapter 14** of *Hands-On Machine Learning with Scikit-Learn, Keras & TensorFlow* (slide 2).',
      'Slide 3 lists the main topics: **convolutional layers**, **filters and feature maps**, **stacking multiple feature maps**, **pooling layers**, the **TensorFlow implementation** for CNNs, the **memory requirements** of CNNs, **CNN architectures**, and **using pretrained models and transfer learning**.',
      'Every section below follows the deck in order and has the same three beats: **Read** the short explanation, **Play** with the live lab until the idea clicks, then **Write** — copy the notebook page onto paper and tick each line as it goes in. Ticks and your place are saved in this browser, and the index marks a section done once all its lines are ticked.',
    ],
    play: ['roadmap'],
    notes: [
      {
        h: 'Topic 3 · Chapter 14',
        lines: [
          'Topic 3 is Deep Computer Vision Using Convolutional Neural Networks (CNNs).',
          'The reading is Chapter 14 of *Hands-On Machine Learning with Scikit-Learn, Keras & TensorFlow*.',
        ],
      },
      {
        h: 'Main topics (slide 3)',
        lines: [
          'Convolutional layers come first: filters and feature maps, then stacking multiple feature maps.',
          'Pooling layers are the second common building block of a CNN.',
          'Then the TensorFlow implementation for CNNs, and their memory requirements.',
          'Finally, CNN architectures and using pretrained models and transfer learning.',
        ],
      },
    ],
  },

  /* ── §1 ─────────────────────────────────────────────────────────────── */
  {
    id: 's01',
    no: '1',
    title: 'Origins: visual cortex → neocognitron',
    short: 'Origins',
    slides: '4–5',
    read: [
      'Convolutional neural networks (CNNs) **emerged from the study of the brain’s visual cortex**[^1][^2].',
      'Figure 14-1: biological neurons in the visual cortex respond to specific patterns in small regions of the visual field called **receptive fields**. As the visual signal makes its way through consecutive brain modules, neurons respond to **more complex patterns in larger receptive fields**.',
      'These studies inspired the **neocognitron**[^3] (introduced in 1980), which gradually evolved into what we now call **convolutional neural networks**.',
      'Thanks to the increase in **computational power**, the amount of available **training data**, and the **tricks from Chapter 11** for training deep nets, CNNs have managed to achieve **superhuman performance on some complex visual tasks**. They are not restricted to visual perception: they are also successful at **voice recognition** and **natural language processing (NLP)**.',
    ],
    play: ['orientation', 'depthField'],
    notes: [
      {
        h: 'The visual cortex (slide 4)',
        lines: [
          'CNNs emerged from studies of the brain’s visual cortex (Hubel 1959; Hubel & Wiesel 1959).',
          'Visual-cortex neurons respond to specific patterns in small regions of the visual field, called receptive fields.',
          'As the signal passes through consecutive brain modules, neurons respond to more complex patterns in larger receptive fields.',
        ],
      },
      {
        h: 'From the neocognitron to CNNs (slide 5)',
        lines: [
          'These studies inspired the neocognitron (Fukushima, 1980), which gradually evolved into today’s CNNs.',
          'More computing power, more training data and the Chapter 11 training tricks let CNNs reach superhuman performance on some complex visual tasks.',
          'CNNs are not limited to vision: they also work for voice recognition and natural language processing (NLP).',
        ],
      },
    ],
    draw: [
      {
        fig: 'cortex',
        caption: 'Label the three levels (lines → shapes → objects) and the three receptive fields on the house, smallest to largest.',
      },
    ],
    check: [
      { q: 'What is a receptive field?', a: 'The small region of the visual field that a neuron responds to.' },
      { q: 'What happens to receptive fields deeper in the visual pathway?', a: 'They get larger, and the neurons respond to more complex patterns.' },
    ],
  },

  /* ── §2 ─────────────────────────────────────────────────────────────── */
  {
    id: 's02',
    no: '2',
    title: 'Convolution: a brief introduction',
    short: 'Convolution',
    slides: '6',
    read: [
      'Given an image $\\mathcal{I}$ and a $3 \\times 3$ filter $f$, the convolution output of the input image $\\mathcal{I}$ by $f$ at pixel $(x, y)$ is:',
      {
        eq: {
          name: 'Convolution with a 3×3 filter',
          tex: "\\mathcal{I}'(x, y) = \\sum_{i=-1}^{1}\\sum_{j=-1}^{1} \\mathcal{I}(x + i,\\, y + j)\\, f(i, j)",
          read: 'centre f on pixel (x, y), multiply each of the 9 pixels under it by the matching filter weight, and add the 9 products.',
        },
      },
      "where $\\mathcal{I}'$ is the **output image**. Some common $3 \\times 3$ filters used in computer vision are **Sobel-x** (for detecting vertical edges), **Sobel-y** (for detecting horizontal edges), the **uniform averaging filter** (for smoothing) and the **Laplacian operator** (a 2nd-derivative filter):",
      { matrices: true },
      'Larger filters can also be defined. **Odd-size filters** ($5 \\times 5$, $7 \\times 7$, …) are usually preferred.',
      {
        unfold: {
          label: 'The slide’s animation links',
          blocks: [
            { list: ['`https://www.youtube.com/watch?v=ulKbLD6BRJA` — 1-D convolution.', '`https://commons.wikimedia.org/wiki/File:2D_Convolution_Animation.gif` — 2-D convolution.'] },
          ],
        },
      },
    ],
    play: ['convStep'],
    notes: [
      {
        h: 'The operation',
        lines: [
          'Convolution slides a small filter $f$ over the image $\\mathcal{I}$ and computes one output pixel at each position.',
          'At pixel $(x, y)$, multiply each of the 9 neighbouring pixels by the matching filter weight and add the 9 products.',
          "The results form the output image $\\mathcal{I}'$.",
        ],
      },
      {
        h: 'Common 3×3 filters',
        lines: [
          'Sobel-x detects vertical edges; Sobel-y detects horizontal edges.',
          'The uniform averaging filter (all 1s, times 1/9) smooths the image.',
          'The Laplacian operator is a 2nd-derivative filter.',
          'Larger filters can be defined; odd sizes (5×5, 7×7, …) are usually preferred.',
        ],
      },
    ],
    draw: [
      { fig: 'convWindow', caption: "Label the input $\\mathcal{I}$, the 3×3 filter window $f$ centred on $(x, y)$, and the one output pixel $\\mathcal{I}'(x, y)$ it produces." },
    ],
    formulas: [
      { tex: "\\mathcal{I}'(x, y) = \\sum_{i=-1}^{1}\\sum_{j=-1}^{1} \\mathcal{I}(x + i,\\, y + j)\\, f(i, j)", read: 'Centre the filter on (x, y), multiply the 9 overlapping pairs, add them up.' },
      { filters: true, read: 'Sobel-x → vertical edges · Sobel-y → horizontal edges · 1/9 average → smoothing · Laplacian → 2nd derivative.' },
    ],
    worked: {
      title: 'Sobel-x on a 3×3 patch with a vertical edge',
      lines: [
        'Patch (rows): [0 0 8], [0 0 8], [0 0 8] — dark on the left, bright on the right.',
        'Sum = (−1·0 + 0·0 + 1·8) + (−2·0 + 0·0 + 2·8) + (−1·0 + 0·0 + 1·8) = 8 + 16 + 8 = **32**.',
        'On a flat patch (all 8s) the left and right columns cancel: the sum is **0**.',
      ],
    },
    check: [
      { q: 'Which slide-6 filter would you use to find vertical edges?', a: 'Sobel-x.' },
      { q: 'What does the uniform averaging filter do?', a: 'It smooths the image: each output pixel is the mean of its 3×3 neighbourhood.' },
    ],
  },

  /* ── §3 ─────────────────────────────────────────────────────────────── */
  {
    id: 's03',
    no: '3',
    title: 'Convolutional layers & connections between layers',
    short: 'Conv layers',
    slides: '7–9',
    read: [
      'The most important building block of a CNN is the **convolutional layer** (slide 7). Neurons in the first convolutional layer are **not** connected to every single pixel in the input image, but only to pixels in their **receptive fields**. In turn, each neuron in the second convolutional layer is connected only to neurons located within a **small rectangle** in the first layer (Figure 14-2).',
      'This architecture lets the network concentrate on **low-level features** in the first hidden layer, then assemble them into **higher-level features** in the next hidden layer, and so on.',
      'Slide 8: all 9 pixels of a $3 \\times 3$ patch in the feature map at layer $i$ are connected to 1 pixel in the feature map at layer $i+1$. Those 9 connection weights form a $3 \\times 3$ filter $\\mathbf{W}$ that training needs to learn, and **the same weights $\\mathbf{W}$ are used for every patch**. So if only one $3 \\times 3$ filter is used, just **9 parameters from $\\mathbf{W}$ plus a bias** need to be estimated, regardless of the number of rows and columns of the feature map.',
      'Slide 9: a large input layer can also be connected to a much smaller layer by **spacing out the receptive fields**. The distance between two consecutive receptive fields is the **stride**. In Figure 14-4, a $5 \\times 7$ input layer (plus **zero padding**) is connected to a $3 \\times 4$ layer using $3 \\times 3$ receptive fields and a stride of 2 in both directions ($s_h = s_w = 2$).',
      {
        eq: {
          name: 'Which neurons a neuron is connected to (slide 9)',
          tex: '\\text{rows } i\\,s_h \\text{ to } i\\,s_h + f_h - 1, \\qquad \\text{columns } j\\,s_w \\text{ to } j\\,s_w + f_w - 1',
          read: 'the neuron in row i, column j of the upper layer sees this f_h × f_w block of the previous layer; s_h and s_w are the vertical and horizontal strides.',
        },
      },
    ],
    play: ['receptiveField'],
    notes: [
      {
        h: 'Receptive fields (slide 7)',
        lines: [
          'The convolutional layer is the most important building block of a CNN.',
          'A neuron in the first conv layer connects only to the pixels in its receptive field, not to every pixel in the image.',
          'Each neuron in the second conv layer connects only to a small rectangle of neurons in the first layer.',
          'So the first layer finds low-level features and the next layers assemble them into higher-level features.',
        ],
      },
      {
        h: 'Shared weights (slide 8)',
        lines: [
          'The 9 connections from a 3×3 patch form a 3×3 filter $\\mathbf{W}$, and the same $\\mathbf{W}$ is used at every position.',
          'One 3×3 filter needs only 9 weights + 1 bias = 10 parameters, whatever the size of the feature map.',
        ],
      },
      {
        h: 'Stride (slide 9)',
        lines: [
          'The stride is the distance between two consecutive receptive fields: $s_h$ vertically and $s_w$ horizontally.',
          'A bigger stride connects a large layer to a much smaller one: 5×7 input + zero padding, 3×3 fields, stride 2 → a 3×4 layer.',
          'Neuron $(i, j)$ connects to rows $i\\,s_h$ to $i\\,s_h + f_h - 1$ and columns $j\\,s_w$ to $j\\,s_w + f_w - 1$ of the layer below.',
        ],
      },
    ],
    draw: [
      { fig: 'stride', caption: 'Label the zero padding, one 3×3 receptive field, the stride $s_w = 2$ between two fields, and the 3×4 output layer.' },
    ],
    formulas: [
      { tex: '\\text{rows } i\\,s_h \\ldots i\\,s_h + f_h - 1, \\quad \\text{cols } j\\,s_w \\ldots j\\,s_w + f_w - 1', read: 'Neuron (i, j) looks at an f_h × f_w window whose top-left corner sits at row i·s_h, column j·s_w.' },
    ],
    worked: {
      title: 'Figure 14-4’s neuron (1, 2), with $f_h = f_w = 3$ and $s_h = s_w = 2$',
      lines: [
        'Rows: $1 \\times 2 = 2$ to $2 + 3 - 1 = 4$. Columns: $2 \\times 2 = 4$ to $4 + 3 - 1 = 6$ (counted on the zero-padded grid).',
        'Parameters for that one shared 3×3 filter: $3 \\times 3 + 1 = 10$, for all 12 neurons of the 3×4 layer.',
      ],
    },
    check: [
      { q: 'What is the stride?', a: 'The distance between two consecutive receptive fields.' },
      { q: 'How many parameters does one 3×3 filter need on a single feature map?', a: '10 — 9 weights plus 1 bias, whatever the size of the map.' },
    ],
  },

  /* ── §4 ─────────────────────────────────────────────────────────────── */
  {
    id: 's04',
    no: '4',
    title: 'Filters & feature maps',
    short: 'Filters',
    slides: '10–11',
    read: [
      'A neuron’s weights can be represented as **a small image** having the same size as the receptive field. These are **filters** (or **convolution kernels**).',
      'Slide 10’s first filter is a black square with a vertical white line in the middle: a $7 \\times 7$ matrix **full of 0s except for the central column, which is full of 1s**. Neurons using these weights ignore everything in their receptive field except the central vertical line, since all the other inputs get multiplied by 0.',
      'The second filter is a black square with a **horizontal** white line in the middle. Once again, neurons using these weights ignore everything in their receptive field except the central horizontal line.',
      'Figure 14-5 applies the two filters to the same input image and gets **two feature maps**. In Feature Map 1 (vertical filter) the vertical lines stay sharp while the horizontal detail is smeared; in Feature Map 2 (horizontal filter) it is the other way round.',
    ],
    play: ['filterMap'],
    notes: [
      {
        h: 'Filters (slide 10)',
        lines: [
          'A neuron’s weights can be drawn as a small image the same size as its receptive field: a filter (or convolution kernel).',
          'The vertical-line filter is a 7×7 matrix of 0s except for a central column of 1s.',
          'A neuron using it ignores everything in its receptive field except the central vertical line, because every other input is multiplied by 0.',
          'The horizontal-line filter has a central row of 1s instead, so only the central horizontal line counts.',
        ],
      },
      {
        h: 'Feature maps (slide 11)',
        lines: [
          'Convolving an input with a filter gives a feature map.',
          'The same input convolved with two different filters gives two feature maps (Figure 14-5).',
          'In the vertical filter’s map the vertical lines stand out; in the horizontal filter’s map the horizontal lines do.',
        ],
      },
    ],
    draw: [
      { fig: 'lineFilters', caption: 'Shade the line of 1s in each 7×7 filter, then label which feature map each filter produces from the input.' },
    ],
    worked: {
      title: 'What the vertical filter keeps',
      lines: ['A 7×7 receptive field has 49 inputs: the vertical filter keeps the 7 in the central column and multiplies the other 42 by 0.'],
    },
    check: [
      { q: 'What does a neuron using the vertical-line filter ignore?', a: 'Everything in its receptive field except the central vertical line.' },
      { q: 'How many feature maps do two filters give?', a: 'Two — one feature map per filter.' },
    ],
  },

  /* ── §5 ─────────────────────────────────────────────────────────────── */
  {
    id: 's05',
    no: '5',
    title: 'Stacking multiple feature maps',
    short: 'Stacking maps',
    slides: '12–15',
    read: [
      'So far each convolutional layer has been drawn as a thin 2D layer, but in reality it is composed of **several feature maps stacked together**, so it is more accurately represented in **3D** (Figure 14-6). Input images have channels too — red, green and blue.',
      'Within one feature map, all neurons **share the same parameters** (the weights and the bias term of the filter). Neurons in different feature maps use different parameters: each feature map in a layer is generated by convolving a filter with the input of that layer.',
      'A neuron’s receptive field is the same as before, but it **extends across all the previous layer’s feature maps**. So a convolutional layer simultaneously applies multiple filters to its inputs, making it capable of detecting multiple features anywhere in its inputs. If a layer has **$n$ filters**, it generates **$n$ feature maps** — its output has $n$ channels.',
      'Slide 14: a neuron in row $i$, column $j$ of feature map $k$ in convolutional layer $\\ell$ is connected to the outputs of the neurons in layer $\\ell - 1$ located in rows $i\\,s_h$ to $i\\,s_h + f_h - 1$ and columns $j\\,s_w$ to $j\\,s_w + f_w - 1$, **across all feature maps** of layer $\\ell - 1$. All neurons at the same row $i$ and column $j$ but in different feature maps are connected to **the exact same neurons** in the previous layer.',
      'Slide 15: if the input $\\mathbf{x}$ is $N_{\\text{height}} \\times N_{\\text{width}} \\times N_{\\text{channels}}$ and there are $K$ filters of size $n_h \\times n_w$, each filter $f_k$ must have $N_{\\text{channels}}$ channels for the convolution to be legal. So each $f_k$ is $n_h \\times n_w \\times N_{\\text{channels}}$, and together the filters form an $n_h \\times n_w \\times N_{\\text{channels}} \\times K$ tensor. The $k$th output channel is:',
      {
        eq: {
          name: 'Output channel k (slide 15)',
          tex: '\\boldsymbol{z}_k = b_k + \\sum_{c=0}^{N_{\\text{channels}}-1} \\mathbf{x}_c * f_{c,k}',
          read: 'convolve each input channel x_c with its own slice f_c,k of filter k, add the results, then add the bias b_k.',
        },
      },
      'Here $*$ is the convolution operation, $\\mathbf{x}_c$ ($N_{\\text{height}} \\times N_{\\text{width}}$) is channel $c$ of $\\mathbf{x}$, $f_{c,k}$ (an $n_h \\times n_w$ matrix) is channel $c$ of filter $f_k$, and $b_k$ is the bias term of $f_k$. So **each filter produces one output channel** (one output feature map).',
      { note: 'Slide 15 writes the filter size as $n_h \\times n_w$; slides 9, 14 and 16 call the same sizes $f_h \\times f_w$.' },
    ],
    play: ['channelSum'],
    notes: [
      {
        h: 'Layers are 3D (slides 12–13)',
        lines: [
          'A conv layer is really several feature maps stacked together, so it is drawn in 3D; a colour image has 3 channels (red, green, blue).',
          'All neurons within one feature map share the same parameters (the filter’s weights and bias); different feature maps use different filters.',
          'A conv layer with $n$ filters produces $n$ feature maps, so its output has $n$ channels.',
        ],
      },
      {
        h: 'Receptive fields across maps (slide 14)',
        lines: [
          'A neuron’s receptive field extends across all the feature maps of the previous layer.',
          'Neuron $(i, j)$ in map $k$ of layer $\\ell$ sees rows $i\\,s_h$ to $i\\,s_h + f_h - 1$ and columns $j\\,s_w$ to $j\\,s_w + f_w - 1$ of every map in layer $\\ell - 1$.',
          'Neurons at the same $(i, j)$ in different maps see exactly the same inputs; only their filters differ.',
        ],
      },
      {
        h: 'The multi-channel convolution (slide 15)',
        lines: [
          'Each of the $K$ filters must have $N_{\\text{channels}}$ channels, so each filter is $n_h \\times n_w \\times N_{\\text{channels}}$.',
          'All the filters stack into one $n_h \\times n_w \\times N_{\\text{channels}} \\times K$ tensor.',
          'Output channel $k$ is the bias $b_k$ plus the sum over input channels of $\\mathbf{x}_c$ convolved with $f_{c,k}$: one feature map per filter.',
        ],
      },
    ],
    draw: [
      { fig: 'stack', caption: 'Label the input channels (R, G, B), the feature maps of conv layer 1, and the receptive field that spans every channel.' },
    ],
    formulas: [
      { tex: '\\boldsymbol{z}_k = b_k + \\sum_{c=0}^{N_{\\text{channels}}-1} \\mathbf{x}_c * f_{c,k}', read: 'Output map k = bias + each input channel convolved with its own slice of filter k, summed over channels.' },
      { tex: 'n_h \\times n_w \\times N_{\\text{channels}} \\times K', read: 'The filter tensor: K filters, each with one n_h × n_w slice per input channel.' },
    ],
    worked: {
      title: 'The lab’s layer: a 5×5 RGB input and two 3×3 filters, stride 1',
      lines: [
        'Each filter is $3 \\times 3 \\times 3 = 27$ weights + 1 bias; together they form a $3 \\times 3 \\times 3 \\times 2$ tensor.',
        'Each output value adds 27 products and 1 bias; the output is $3 \\times 3 \\times 2$ (two feature maps).',
      ],
    },
    check: [
      { q: 'A conv layer has 64 filters. How many channels does its output have?', a: '64 — one feature map per filter.' },
      { q: 'Why must each filter have $N_{\\text{channels}}$ channels?', a: 'So it can be convolved with every input channel — otherwise the convolution is not legal (slide 15).' },
    ],
  },

  /* ── §6 ─────────────────────────────────────────────────────────────── */
  {
    id: 's06',
    no: '6',
    title: 'Implementing Conv2D in Keras',
    short: 'Conv2D in Keras',
    slides: '16–19',
    read: [
      'In Keras, each input image is typically a **3D tensor** of shape `[height, width, channels]`, and a mini-batch is a **4D tensor** of shape `[minibatch size, height, width, channels]` (slide 16).',
      'The weights of a convolutional layer (all its filters) are a **4D tensor** of shape $[f_h, f_w, f_c, f_n]$: $f_h$ and $f_w$ are the height and width of the filters, $f_c$ is their number of channels (the same as the input image), and $f_n$ is the total number of filters. The **bias terms** are a **1D tensor** of shape $[f_n]$ — one bias term per filter[^4].',
      'Slide 17 loads the two sample images, centre-crops them to 70×120 and rescales the pixel values by 1/255:',
      { code: { src: 'slide17', label: 'load_images.py', meta: 'slide 17' } },
      'Slide 18 creates a convolutional layer with 32 filters of size 7×7 and applies it: `conv_layer = tf.keras.layers.Conv2D(filters=32, kernel_size=7)`, then `fmaps = conv_layer(images)` gives `fmaps.shape` = `TensorShape([2, 64, 114, 32])`.',
      'Slide 19: just like a `Dense` layer, a `Conv2D` layer holds all the layer’s weights, including the kernels and biases. The **kernels are initialized randomly**, while the **biases are initialized to zero**. `conv_layer.get_weights()` returns kernels of shape `(7, 7, 3, 32)` — `[kernel_height, kernel_width, input_channels, output_channels]` — and biases of shape `(32,)` — `[output_channels]`.',
      'The input is `[2, 70, 120, 3]` but the output feature maps are `[2, 64, 114, 32]`: the **spatial dimension of the output is smaller** ([§7](#s07) shows why).',
      { slideNote: 'Slide 19’s text prints the output shape as `[2, 64, 114, 3]`; the code output on slide 18 shows `[2, 64, 114, 32]` — 32 channels, one per filter.' },
    ],
    play: ['conv2d'],
    notes: [
      {
        h: 'Tensor shapes (slide 16)',
        lines: [
          'One image is a 3D tensor `[height, width, channels]`; a mini-batch is a 4D tensor `[batch size, height, width, channels]`.',
          'A conv layer’s weights (all its filters) are a 4D tensor $[f_h, f_w, f_c, f_n]$.',
          '$f_h$ and $f_w$ are the filter height and width, $f_c$ is the number of channels (the same as the input) and $f_n$ is the number of filters.',
          'The biases are a 1D tensor $[f_n]$: one bias per filter.',
        ],
      },
      {
        h: 'The slide example (slides 17–19)',
        lines: [
          'Two sample images, centre-cropped to 70×120 and rescaled by 1/255, give `images.shape` = `[2, 70, 120, 3]`.',
          '`Conv2D(filters=32, kernel_size=7)` turns them into `fmaps` of shape `[2, 64, 114, 32]`.',
          '`conv_layer.get_weights()` returns kernels of shape `(7, 7, 3, 32)` and biases of shape `(32,)`.',
          'The kernels start random and the biases start at zero.',
          'The output is spatially smaller than the input: 64×114 instead of 70×120.',
        ],
      },
    ],
    draw: [
      { fig: 'kerasTensors', caption: 'Label the axes of each tensor (batch, height, width, channels) and write the kernel and bias shapes under the arrow.' },
    ],
    formulas: [
      { tex: '\\text{kernels: } [f_h, f_w, f_c, f_n] \\qquad \\text{biases: } [f_n]', read: 'Filter height, width, channels (= input channels), number of filters; one bias per filter.' },
      { tex: '(f_h \\times f_w \\times f_c + 1) \\times f_n', tag: 'slide 22’s count', read: 'Parameters of a conv layer: each filter’s weights plus its bias, times the number of filters.' },
    ],
    worked: {
      title: 'The slide-18 layer',
      lines: ['Parameters: $(7 \\times 7 \\times 3 + 1) \\times 32 = 148 \\times 32 = 4{,}736$.'],
    },
    check: [
      { q: 'What shape are the kernels of `Conv2D(filters=32, kernel_size=7)` on RGB images?', a: '`(7, 7, 3, 32)`.' },
      { q: 'How are a Conv2D layer’s kernels and biases initialised?', a: 'Kernels randomly; biases to zero.' },
    ],
  },

  /* ── §7 ─────────────────────────────────────────────────────────────── */
  {
    id: 's07',
    no: '7',
    title: 'Padding options ("valid" vs "same")',
    short: 'Padding',
    slides: '20–21',
    read: [
      'The default padding option is **"valid"**: the convolution is *valid* in the sense that it **does not go outside the image boundary**, so no zeros are added and the output shrinks. In Figure 14-7 (`kernel_size=7`, `strides=1`) the "valid" output has **6 fewer pixels** than the input.',
      'With **`padding="same"`**, zeros are added around the input so that the output has the **same number of pixels as the input** (with `strides=1`). In the slide example, the output feature maps become `[2, 70, 120, 32]`:',
      { code: { src: 'conv_layer = tf.keras.layers.Conv2D(filters=32, kernel_size=7,\n                                    padding="same")\nfmaps = conv_layer(images)\nfmaps.shape               # output: TensorShape([2, 70, 120, 32])', label: 'same_padding.py', meta: 'slide 20' } },
      'Slide 21: if the stride is greater than 1 (in any direction), the output size will **not** equal the input size, even with `padding="same"`. Figure 14-8 (`kernel_size=7`, `strides=2`) shows a much smaller output under "same", and shows that **"valid" padding may ignore some inputs**.',
      { slideNote: 'Slide 20’s first sentence reads “"valid", which means zero-padding”. Figure 14-7 and slide 28 (“"valid" padding (i.e., no padding at all)”) show that "valid" adds no zeros — "same" is the option that zero-pads.' },
    ],
    play: ['padding'],
    notes: [
      {
        h: '"valid" (the default)',
        lines: [
          '`padding="valid"` is the default: the filter never goes outside the image boundary, so no zeros are added.',
          'With `kernel_size=7` and stride 1, the "valid" output has 6 fewer pixels than the input (Figure 14-7).',
        ],
      },
      {
        h: '"same"',
        lines: [
          '`padding="same"` adds zeros around the input so that, with stride 1, the output is the same size as the input.',
          'In the slide example, "same" gives `fmaps` of shape `[2, 70, 120, 32]` instead of `[2, 64, 114, 32]`.',
        ],
      },
      {
        h: 'Strides greater than 1 (slide 21)',
        lines: [
          'With a stride above 1, the output is smaller than the input even with "same" padding.',
          '"valid" padding may also ignore some inputs at the edge (Figure 14-8).',
        ],
      },
    ],
    draw: [
      { fig: 'paddingS1', caption: 'Figure 14-7: label the zero padding and write the output size beside each row — 4 for "valid", 10 for "same".' },
      { fig: 'paddingS2', caption: 'Figure 14-8 (strides=2): cross out the ignored input under "valid" and note the 2 + 3 zeros under "same".' },
    ],
    formulas: [
      { tex: '\\text{valid: } \\left\\lfloor \\frac{n - k}{s} \\right\\rfloor + 1 \\qquad \\text{same: } \\left\\lceil \\frac{n}{s} \\right\\rceil', tag: 'derived from Figs 14-7/14-8', read: 'Count how many windows of size k fit with stride s: "valid" stays inside the n inputs; "same" pads so ⌈n/s⌉ fit.' },
    ],
    worked: {
      title: 'The slide numbers, checked',
      lines: [
        'Slide example, kernel 7, stride 1: "valid" → $70 - 7 + 1 = 64$ and $120 - 7 + 1 = 114$; "same" → 70 and 120.',
        'Figure 14-8, $n = 10$, $k = 7$, $s = 2$: "valid" → $\\lfloor 3/2 \\rfloor + 1 = 2$ (one input ignored); "same" → $\\lceil 10/2 \\rceil = 5$.',
      ],
    },
    check: [
      { q: 'What does `padding="same"` give for the slide example?', a: '`[2, 70, 120, 32]` — the same height and width as the input.' },
      { q: 'Does "same" padding keep the size when the stride is 2?', a: 'No — the output is smaller than the input even with "same".' },
    ],
  },

  /* ── §8 ─────────────────────────────────────────────────────────────── */
  {
    id: 's08',
    no: '8',
    title: 'Memory requirements of CNNs',
    short: 'Memory',
    slides: '22–24',
    read: [
      'Convolutional layers require a **huge amount of RAM**, especially **during training**, because the reverse pass of backpropagation requires all the intermediate values computed during the forward pass.',
      'Slide 22’s example: a convolutional layer with **200 filters of size 5×5**, stride 1 and "same" padding, on a **150 × 100 RGB image**. It has $(5 \\times 5 \\times 3 + 1) \\times 200 = 15{,}200$ parameters to train — **independent of the height and width** of the input image. Compared with a dense (fully connected) layer[^5], that is actually very small.',
      'Slide 23: each of the 200 feature maps contains $150 \\times 100$ neurons, and each neuron computes a weighted sum of its $5 \\times 5 \\times 3 = 75$ inputs: $15{,}000 \\times 75 \\times 200 = 225$ million float multiplications — not as bad as a fully connected layer, but still intensive, and that is **for one training instance**.',
      'With single-precision floats (4 bytes, or 32 bits, per number), the feature maps need $150 \\times 100 \\times 200 \\times 4 = 12$ MB of RAM for one instance. With 100 instances in the mini-batch, that is **1.2 GB** of RAM.',
      'Slide 24: when **testing** (making predictions), the RAM occupied by one layer can be released as soon as the next layer has been computed, so you only need as much RAM as **two consecutive layers**. During **training**, everything computed in the forward pass must be kept for the reverse pass, so you need (at least) **the total RAM of all layers**.',
      'If training crashes with an out-of-memory error, you can try:',
      { list: ['(i) reducing the mini-batch size;', '(ii) reducing dimensionality using a larger stride value;', '(iii) removing a few layers (making the CNN less deep);', '(iv) using 16-bit floats instead of 32-bit floats; and/or', '(v) distributing the CNN across multiple devices.'] },
    ],
    play: ['memory'],
    notes: [
      {
        h: 'Why CNNs need so much RAM',
        lines: ['Conv layers need a huge amount of RAM, especially in training, because backpropagation’s reverse pass needs every intermediate value from the forward pass.'],
      },
      {
        h: 'The slide example: 200 5×5 filters, stride 1, "same", 150×100 RGB input',
        lines: [
          'Parameters: $(5 \\times 5 \\times 3 + 1) \\times 200 = 15{,}200$, independent of the image’s height and width.',
          'A fully connected layer of 150×100 neurons, each connected to all 150×100×3 inputs, would need 675 million parameters.',
          'Multiplications: 15,000 neurons per map × 75 inputs each × 200 maps = 225 million, for one instance.',
          'RAM for the feature maps with 4-byte floats: 150×100×200×4 = 12 MB per instance, so 1.2 GB for a mini-batch of 100.',
        ],
      },
      {
        h: 'Training vs testing (slide 24)',
        lines: [
          'When testing, a layer’s RAM is freed once the next layer is computed, so you need only two consecutive layers’ worth.',
          'In training, everything from the forward pass is kept, so you need at least the total RAM of all layers.',
          'Out of memory? Use a smaller mini-batch, a larger stride, fewer layers, 16-bit floats, or several devices.',
        ],
      },
    ],
    draw: [
      { fig: 'memory', caption: 'Bracket what stays in RAM: two consecutive layers when testing, every layer when training.' },
    ],
    formulas: [
      { tex: '(5 \\times 5 \\times 3 + 1) \\times 200 = 15{,}200', read: 'Parameters: weights per filter plus one bias, times the number of filters.' },
      { tex: '(150 \\times 100) \\times 75 \\times 200 = 225 \\text{ million}', read: 'Multiplications: neurons per map × inputs per neuron × number of maps.' },
      { tex: '150 \\times 100 \\times 200 \\times 4 \\text{ B} = 12 \\text{ MB}', read: 'Feature-map RAM for one instance with 4-byte (32-bit) floats.' },
    ],
    worked: {
      title: 'Scaling the slide example',
      lines: [
        'Mini-batch of 100: $12 \\text{ MB} \\times 100 = 1.2$ GB.',
        'With 16-bit floats (2 bytes) the same batch needs half: 0.6 GB.',
      ],
    },
    check: [
      { q: 'Why does training need more RAM than testing?', a: 'The reverse pass needs every forward-pass value, so all layers are kept; testing only needs two consecutive layers.' },
      { q: 'Name three ways to fix an out-of-memory error.', a: 'Any three of: a smaller mini-batch, a larger stride, fewer layers, 16-bit floats, multiple devices.' },
    ],
  },

  /* ── §9 ─────────────────────────────────────────────────────────────── */
  {
    id: 's09',
    no: '9',
    title: 'Pooling layers',
    short: 'Pooling',
    slides: '25–31',
    read: [
      '**Pooling layers** are the second common building block of CNNs. Their goal is to **subsample** (i.e. shrink) the input image in order to reduce the computational load, the memory usage and the number of parameters (thereby limiting the risk of overfitting).',
      'Just like in convolutional layers, each neuron in a pooling layer is connected to the outputs of a limited number of neurons in the previous layer, within a small rectangular receptive field, and you must define the pooling layer’s **size, stride and padding type**. However, a pooling neuron has **no weights**: all it does is aggregate the inputs using an aggregation function such as the **max** or the **mean**.',
      'Figure 14-9 uses a $2 \\times 2$ **max pooling** kernel, a stride of 2 and no padding: only the maximum input value in each receptive field makes it to the next layer (the window $1, 5, 3, 2$ gives $5$), while the other inputs are dropped.',
      '**Max vs average pooling** (slide 27): average pooling allows more information to be preserved, while max pooling preserves only the strongest features, getting rid of all the meaningless ones, so the next layer gets a cleaner signal. Max pooling offers **stronger translation invariance** than average pooling and requires slightly less work to compute. Average pooling used to be very popular, but people mostly use max pooling now, as it generally performs better.',
      'In Keras (slide 28) use `MaxPooling2D` (alias `MaxPool2D`) for max pooling and `AveragePooling2D` (alias `AvgPool2D`) for average pooling. By default the **strides equal the kernel size** and **"valid" padding** (no padding at all) is assumed:',
      { code: { src: '# both lines below are equivalent\nmax_pool = tf.keras.layers.MaxPooling2D(pool_size=2)\nmax_pool = tf.keras.layers.MaxPool2D(pool_size=2)\n\n# both lines below are equivalent\navg_pool = tf.keras.layers.AveragePooling2D(pool_size=2)\navg_pool = tf.keras.layers.AvgPool2D(pool_size=2)', label: 'pooling.py', meta: 'slide 28' } },
      'A pooling layer typically works on every input channel **independently**, so the output depth is the same as the input depth. Unlike convolutional kernels, pooling kernels have no weights to learn — they are just **stateless sliding windows** (slide 29).',
      'Alternatively you can **pool over the depth dimension**: the image’s height and width stay unchanged, but the number of channels is reduced. Keras does not include a depthwise max pooling layer, though it is not too difficult to implement yourself. **Depthwise max pooling** lets the CNN learn to be **invariant** to various features — for example it could learn several filters, each detecting a different **rotation** of the same pattern, and the output would be the same regardless of the rotation (Figure 14-11, slide 30).',
      '**Global average pooling** (slide 31) is like `AveragePooling2D` but global: it averages all the pixel values of each feature map and reduces it to a **single number**:',
      { code: { src: '>>> images.shape\nTensorShape([2, 70, 120, 3])\n\n>>> global_avg_pool = tf.keras.layers.GlobalAvgPool2D()\n>>> global_avg_pool(images)\n<tf.Tensor: shape=(2, 3), dtype=float32, ...', label: 'global_avg_pool.py', meta: 'slide 31' } },
    ],
    play: ['pooling', 'depthPool'],
    notes: [
      {
        h: 'What pooling does (slides 25–26)',
        lines: [
          'Pooling layers subsample (shrink) the input to cut computation, memory use and the number of parameters, which also limits overfitting.',
          'Each pooling neuron looks at a small rectangular receptive field; you choose its size, stride and padding type.',
          'A pooling neuron has no weights: it just aggregates its inputs with a function such as max or mean.',
          '2×2 max pooling with stride 2 and no padding keeps only the largest value in each 2×2 window (Figure 14-9).',
        ],
      },
      {
        h: 'Max vs average (slide 27)',
        lines: [
          'Average pooling keeps more information; max pooling keeps only the strongest features, giving the next layer a cleaner signal.',
          'Max pooling gives stronger translation invariance, needs slightly less work and generally performs better, so it is now used most.',
        ],
      },
      {
        h: 'Keras and other kinds (slides 28–31)',
        lines: [
          '`MaxPooling2D` (`MaxPool2D`) and `AveragePooling2D` (`AvgPool2D`): strides default to the pool size, padding to "valid" (none).',
          'Pooling works on each channel independently, so the output depth equals the input depth.',
          'Depthwise max pooling pools across channels instead: height and width stay the same, the channels are reduced, and it can learn invariance, e.g. to rotation.',
          'Global average pooling averages each whole feature map to one number: `[2, 70, 120, 3]` → `(2, 3)`.',
        ],
      },
    ],
    draw: [
      { fig: 'maxPool', caption: 'Label the 2×2 window and stride 2, then circle the value that survives max pooling.' },
      { fig: 'globalPool', caption: 'Label each feature map → one number (its average): depth 3 in, 3 numbers out.' },
    ],
    formulas: [
      { code: 'tf.keras.layers.MaxPooling2D(pool_size=2)', read: '2×2 max pooling; strides default to 2 (the pool size) and padding to "valid".' },
      { code: 'tf.keras.layers.AveragePooling2D(pool_size=2)', read: 'The same window, but each output is the mean of its 4 inputs.' },
      { code: 'tf.keras.layers.GlobalAvgPool2D()', read: '[batch, height, width, channels] → [batch, channels]: one average per feature map.' },
    ],
    worked: {
      title: 'Figure 14-9’s first window',
      lines: [
        'Window $1, 5, 3, 2$: max pooling keeps $5$; average pooling would give $(1 + 5 + 3 + 2)/4 = 2.75$.',
        'The lab’s 6×9 input with a 2×2 pool and stride 2 → a 3×4 output: the 9th column is never read.',
      ],
    },
    check: [
      { q: 'How many weights does a pooling layer learn?', a: 'None — it is a stateless sliding window.' },
      { q: 'What does `GlobalAvgPool2D()` do to a `[2, 70, 120, 3]` batch?', a: 'Averages each of the 3 maps over all 70×120 pixels, giving shape `(2, 3)`.' },
    ],
  },

  /* ── §10 ────────────────────────────────────────────────────────────── */
  {
    id: 's10',
    no: '10',
    title: 'Hyperparameters in a CNN',
    short: 'Hyperparameters',
    slides: '32',
    read: [
      'Unfortunately, convolutional layers have quite a few hyperparameters: you must choose **the number of filters**, **their height and width**, **the strides**, and **the padding type** ("SAME" or "VALID").',
      'Similarly, pooling layers have a **pool size**, a **stride** (default `None`) and a **padding type** (default `"valid"`) to choose. A stride of `None` means the stride defaults to the pool size (slide 28).',
      'As always, **cross-validation** can find the right hyperparameter values, but this is very time-consuming. The common CNN architectures in [§11](#s11) and [§12](#s12a) give an idea of what values work best in practice.',
    ],
    play: ['hyper'],
    notes: [
      {
        h: 'Convolutional layers',
        lines: [
          'A conv layer has quite a few hyperparameters, set as arguments of `Conv2D`.',
          'You choose the number of filters (`filters`) and their height and width (`kernel_size`).',
          'You also choose the strides (`strides`) and the padding type, "SAME" or "VALID" (`padding`).',
        ],
      },
      {
        h: 'Pooling layers',
        lines: [
          'A pooling layer has a pool size (`pool_size`), a stride (`strides`, default `None`) and a padding type (`padding`, default "valid").',
          'A pooling stride of `None` means the stride equals the pool size.',
        ],
      },
      {
        h: 'Choosing values',
        lines: [
          'Cross-validation can find good values, but it is very time-consuming.',
          'Common CNN architectures show which values work best in practice.',
        ],
      },
    ],
    worked: {
      title: 'One conv + pool on a 28×28×1 image',
      lines: [
        '`Conv2D(filters=32, kernel_size=3, padding="same")` → 28×28×32, with $(3 \\times 3 \\times 1 + 1) \\times 32 = 320$ parameters.',
        '`MaxPool2D(pool_size=2)` (stride `None` = 2) → 14×14×32, with no parameters.',
      ],
    },
    check: [
      { q: 'List the four hyperparameters you choose for a conv layer.', a: 'The number of filters, their height and width, the strides, and the padding type.' },
      { q: 'What are a pooling layer’s default stride and padding?', a: 'Stride `None` (= the pool size) and padding "valid".' },
    ],
  },

  /* ── §11 ────────────────────────────────────────────────────────────── */
  {
    id: 's11',
    no: '11',
    title: 'Typical CNN architecture + Fashion-MNIST example',
    short: 'Typical CNN',
    slides: '33–35',
    read: [
      'Typical CNN architectures stack **a few convolutional layers** (each one generally followed by a **ReLU** layer), then a **pooling layer**, then another few convolutional layers (+ReLU), then another pooling layer, and so on (Figure 14-12).',
      'The image gets **smaller and smaller** as it progresses through the network, but it also typically gets **deeper and deeper** (more feature maps). Near the output, a regular **feedforward neural network** of a few fully connected layers (+ReLUs) is added, and the final layer outputs the prediction — e.g. a **softmax** layer that outputs estimated class probabilities.',
      'Slide 34: a common mistake is to use convolution kernels that are **too large**. It is better to stack **two convolutional layers with 3×3 kernels instead of one layer with a 5×5 kernel**: the network uses fewer parameters (and less computation) and usually performs better. The exception is the **first** convolutional layer, which can typically have a large kernel (e.g. 5×5), usually with a **stride of 2 or more**: this reduces the spatial dimension of the image without losing too much information.',
      'Slide 35 builds a simple CNN for the **Fashion MNIST** dataset. `functools.partial` defines `DefaultConv2D`: a `Conv2D` with `kernel_size=3`, `padding="same"`, `activation="relu"` and `kernel_initializer="he_normal"` already filled in. The lab below walks through the model line by line.',
      'Compiled with the `"sparse_categorical_crossentropy"` loss and trained, the CNN reaches **over 92% accuracy** on the test set — not state of the art, but pretty good, and clearly much better than the earlier MLP.',
    ],
    play: ['shapeFlow', 'kernelStack'],
    notes: [
      {
        h: 'The pattern (slide 33, Figure 14-12)',
        lines: [
          'Stack a few conv layers (each followed by ReLU), then a pooling layer, and repeat.',
          'The image gets smaller and smaller through the network, but deeper and deeper (more feature maps).',
          'Near the output, add a regular feedforward network of a few fully connected layers (+ReLU).',
          'The final layer outputs the prediction, e.g. a softmax layer of estimated class probabilities.',
        ],
      },
      {
        h: 'Kernel sizes (slide 34)',
        lines: [
          'Avoid large kernels: two stacked 3×3 conv layers use fewer parameters and less computation than one 5×5, and usually perform better.',
          'Exception: the first conv layer can use a large kernel (e.g. 5×5) with a stride of 2 or more, to shrink the image without losing much information.',
        ],
      },
      {
        h: 'The Fashion MNIST CNN (slide 35)',
        lines: [
          '`DefaultConv2D` uses `partial` to fix `kernel_size=3`, `padding="same"`, `activation="relu"` and `kernel_initializer="he_normal"`.',
          'Layers: 28×28×1 input → Conv 64 (7×7) → pool → Conv 128 ×2 → pool → Conv 256 ×2 → pool → Flatten → Dense 128 → Dropout → Dense 64 → Dropout → Dense 10 (softmax).',
          'Compiled with `"sparse_categorical_crossentropy"`, it reaches over 92% test accuracy, much better than the MLP.',
        ],
      },
    ],
    draw: [
      { fig: 'cnnPipeline', caption: 'Label conv, pooling and fully connected, and show the maps getting smaller but deeper towards the output.' },
    ],
    worked: {
      title: 'Slide 35’s shapes (per image)',
      lines: [
        '28×28×1 → 28×28×64 → 14×14×64 → 14×14×128 → 7×7×128 → 7×7×256 → 3×3×256 → 2,304 → 128 → 64 → 10.',
        'First conv layer: $(7 \\times 7 \\times 1 + 1) \\times 64 = 3{,}200$ parameters. The last pool takes 7 → 3, and Flatten gives $3 \\times 3 \\times 256 = 2{,}304$.',
      ],
    },
    check: [
      { q: 'Why stack two 3×3 conv layers instead of one 5×5?', a: 'Fewer parameters and less computation, and it usually performs better.' },
      { q: 'What happens to the image’s size and depth as it goes through a typical CNN?', a: 'It gets smaller and smaller, but deeper and deeper (more feature maps).' },
    ],
  },

  /* ── §12.1 ──────────────────────────────────────────────────────────── */
  {
    id: 's12a',
    no: '12.1',
    group: 'Classic architectures',
    title: 'ILSVRC, LeNet-5 & AlexNet',
    short: 'LeNet-5 & AlexNet',
    slides: '36–40',
    read: [
      'Over the years, variants of the basic architecture led to amazing advances in the field, measured by the error rate in competitions such as the **ILSVRC ImageNet Challenge**[^6]. The **top-5 error rate**[^7] for image classification fell from **over 26% to less than 3%** in just six years (slide 36).',
      '**LeNet-5 (1998)** is perhaps the most widely known CNN architecture. It was created by **Yann LeCun** and widely used for handwritten digit recognition (**MNIST**); its layers are in the lab below. The main difference from more modern classification CNNs is the activation functions: today we would use **ReLU instead of tanh** and **softmax instead of RBF** (slide 37).',
      '**AlexNet (2012)** won the 2012 ILSVRC challenge by a large margin: a **17% top-5 error rate**, while the second best achieved only 26%. It was developed by **Alex Krizhevsky**, **Ilya Sutskever** and **Geoffrey Hinton**. It is quite similar to LeNet-5, only **much larger and deeper**, and it was the **first to stack convolutional layers directly on top of each other**, instead of stacking a pooling layer on top of each convolutional layer (slide 38).',
      'To reduce overfitting the authors used two regularization techniques (slide 39): **dropout** with a 50% rate during training, applied to the outputs of layers F9 and F10; and **data augmentation**, randomly shifting the training images by various offsets, flipping them horizontally and changing the lighting conditions.',
      '**Data augmentation** (slide 40) artificially increases the size of the training set by generating many realistic variants of each training instance. Because it helps reduce overfitting, it is considered a **regularization technique**. For example, slightly shift, rotate and resize every picture in the training set by various amounts and add the resulting pictures to the training set (Figure 14-13).',
      { slideNote: 'The slide-39 AlexNet table goes straight from C6 to S8 — there is no C7 row — and S8 has 256 maps while C6 has 384. Pooling doesn’t change the depth (slide 29), so a layer between them isn’t shown.' },
    ],
    play: ['classicTables', 'augment'],
    notes: [
      {
        h: 'ILSVRC (slide 36)',
        lines: [
          'Progress is measured by the top-5 error rate in the ILSVRC ImageNet Challenge, which fell from over 26% to less than 3% in six years.',
          'The top-5 error rate is the number of test images for which the system’s top five predictions did not include the correct answer.',
        ],
      },
      {
        h: 'LeNet-5 (1998, slide 37)',
        lines: [
          'Created by Yann LeCun and widely used for handwritten digit recognition (MNIST).',
          'Layers: 32×32 input → C1 conv 6@28×28 → S2 avg pool 6@14×14 → C3 conv 16@10×10 → S4 avg pool 16@5×5 → C5 conv 120@1×1 → F6 FC 84 → Out FC 10.',
          'It used tanh and an RBF output; today we would use ReLU and softmax.',
        ],
      },
      {
        h: 'AlexNet (2012, slides 38–39)',
        lines: [
          'Won ILSVRC 2012 with a 17% top-5 error (second best: 26%); by Krizhevsky, Sutskever and Hinton.',
          'Like LeNet-5 but much larger and deeper, and the first to stack conv layers directly on top of each other.',
          'A 227×227 RGB input; C1 uses 96 filters of 11×11 with stride 4; later layers use 5×5 and 3×3 kernels and 3×3 max pooling.',
          'Regularization: 50% dropout on F9 and F10, plus data augmentation (random shifts, horizontal flips, lighting changes).',
        ],
      },
      {
        h: 'Data augmentation (slide 40)',
        lines: ['Data augmentation adds realistic variants of each training image (shifted, rotated, resized) to the training set; it reduces overfitting, so it counts as regularization.'],
      },
    ],
    draw: [
      { fig: 'lenet', caption: 'Label each LeNet-5 layer with its maps and size; mark the C (convolution) and S (pooling) layers.' },
      { fig: 'augment', caption: 'Label each variant with the change applied: shifted, rotated, flipped.' },
    ],
    worked: {
      title: 'Checking the tables with the §7 rule',
      lines: [
        'LeNet-5: C1 $32 - 5 + 1 = 28$; S2 $28 / 2 = 14$; C3 $14 - 5 + 1 = 10$; S4 $10 / 2 = 5$; C5 $5 - 5 + 1 = 1$.',
        'AlexNet C1 ("valid", stride 4): $\\lfloor (227 - 11) / 4 \\rfloor + 1 = 55$.',
      ],
    },
    check: [
      { q: 'What structural change did AlexNet make compared with LeNet-5?', a: 'It stacked conv layers directly on top of each other (and was much larger and deeper).' },
      { q: 'Which two regularization techniques did AlexNet use?', a: 'Dropout (50%) on F9 and F10, and data augmentation.' },
    ],
  },

  /* ── §12.2 ──────────────────────────────────────────────────────────── */
  {
    id: 's12b',
    no: '12.2',
    group: 'Classic architectures',
    title: 'GoogLeNet & VGGNet',
    short: 'GoogLeNet & VGGNet',
    slides: '41–44',
    read: [
      '**GoogLeNet (2014)** was developed by **Christian Szegedy et al.**[^8] from Google Research. It won the ILSVRC 2014 challenge by pushing the top-5 error rate **below 7%**. This came in large part from the network being **much deeper** than previous CNNs, made possible by sub-networks called **inception modules**, which let GoogLeNet use parameters much more efficiently: it has **10 times fewer parameters than AlexNet** (roughly 6 million instead of 60 million).',
      'The **inception module** (Figure 14-14, slide 42): the notation “$3 \\times 3 + 1(\\text{S})$” means a $3 \\times 3$ kernel, stride 1 and "same" padding, and all the conv layers use the ReLU activation. The input signal is first **copied and fed to four different layers**. The second set of conv layers uses **different kernel sizes** ($1 \\times 1$, $3 \\times 3$ and $5 \\times 5$), letting them capture patterns at **different scales**. Because every layer uses "same" padding, all their feature maps have the same size, so the final **depth concat** step can concatenate them along the depth dimension (`axis=3`).',
      'The whole network (Figure 14-15, slide 43): each ImageNet input image is 256 × 256, there are 1000 classes, and the network has **9 inception modules**. The input to the first inception module is 32 × 32 × 192 (height × width × channels) and the input to the global average pool is 8 × 8 × 1024. For mini-batches of size *m*, the data is a 4D tensor — e.g. *m* × 8 × 8 × 1024 going into the global average pool.',
      { note: 'Figure 14-15 also contains two **local response normalization** layers near the input; the slides don’t describe them further.' },
      '**VGGNet (2014)**, the runner-up in ILSVRC 2014, was developed by **Karen Simonyan and Andrew Zisserman**[^9] at the Visual Geometry Group (VGG) research lab at Oxford. It had a very simple, classical architecture: **2 or 3 convolutional layers and a pooling layer**, then again 2 or 3 conv layers and a pooling layer, and so on (16 or 19 conv layers in total, depending on the variant), plus a final dense network with 2 hidden layers and the output layer. It used **only 3 × 3 filters, but many filters** (slide 44).',
    ],
    play: ['inception'],
    notes: [
      {
        h: 'GoogLeNet (2014, slide 41)',
        lines: [
          'By Christian Szegedy et al. (Google Research); won ILSVRC 2014 with a top-5 error below 7%.',
          'It was much deeper than earlier CNNs, made possible by sub-networks called inception modules.',
          'It has 10 times fewer parameters than AlexNet: roughly 6 million instead of 60 million.',
        ],
      },
      {
        h: 'The inception module (slide 42)',
        lines: [
          '“3×3 + 1(S)” means a 3×3 kernel, stride 1 and "same" padding; every conv layer uses ReLU.',
          'The input is copied into four branches; the second set of conv layers uses 1×1, 3×3 and 5×5 kernels to capture patterns at different scales.',
          '"same" padding keeps every branch’s maps the same size, so they can be concatenated along the depth dimension (`axis=3`).',
        ],
      },
      {
        h: 'The whole network (slide 43)',
        lines: [
          'ImageNet inputs are 256×256 with 1000 classes, and the network has 9 inception modules.',
          'The first inception module receives 32×32×192; the global average pool receives 8×8×1024 ($m$×8×8×1024 for a mini-batch of $m$).',
        ],
      },
      {
        h: 'VGGNet (2014, slide 44)',
        lines: ['The ILSVRC 2014 runner-up (Simonyan & Zisserman, Oxford): 2–3 conv layers then a pooling layer, repeated (16 or 19 conv layers), plus a dense network with 2 hidden layers; only 3×3 filters, but many of them.'],
      },
    ],
    draw: [
      { fig: 'inception', caption: 'Label each branch’s kernel sizes, the max pool, and the depth concat at the top; note that “+1(S)” = stride 1, "same" padding.' },
    ],
    worked: {
      title: 'The first inception module (Figure 14-15)',
      lines: [
        'Input 32×32×192. The four branches output 64, 128, 32 and 32 maps, so the depth concat gives 32×32×256.',
        '5×5 branch with its 1×1 (12 maps) first: $(1 \\times 1 \\times 192 + 1) \\times 12 + (5 \\times 5 \\times 12 + 1) \\times 32 = 11{,}948$ parameters.',
        'The same 5×5 conv straight on 192 channels: $(5 \\times 5 \\times 192 + 1) \\times 32 = 153{,}632$.',
      ],
    },
    check: [
      { q: 'Why must every layer in an inception module use "same" padding?', a: 'So every branch outputs maps of the same height and width, which can then be concatenated along the depth dimension.' },
      { q: 'What filter size does VGGNet use?', a: 'Only 3×3 — but many filters.' },
    ],
  },

  /* ── §12.3 ──────────────────────────────────────────────────────────── */
  {
    id: 's12c',
    no: '12.3',
    group: 'Classic architectures',
    title: 'ResNet & more recent architectures',
    short: 'ResNet & beyond',
    slides: '45–47',
    read: [
      'The **Residual Network (ResNet)**, proposed by **Kaiming He et al.**[^10], won the ILSVRC 2015 challenge with an astounding top-5 error rate **under 3.6%**. The winning variant was an extremely deep CNN of **152 layers** (other variants have 34, 50 and 101 layers).',
      'It confirmed the general trend: models are getting **deeper and deeper, with fewer and fewer parameters**. The key to being able to train such a deep network is to use **skip connections** (also called **shortcut connections**).',
      'When training a neural network, the goal is to make it model a target function $h(\\mathbf{x})$. By skipping connections and **adding the feature $\\mathbf{x}$ to a deeper layer**, the network is forced to model $f(\\mathbf{x}) = h(\\mathbf{x}) - \\mathbf{x}$ rather than $h(\\mathbf{x})$. This is called **residual learning** (Figure 14-16, slide 46).',
      {
        eq: {
          name: 'Residual learning (slide 46)',
          tex: 'f(\\mathbf{x}) = h(\\mathbf{x}) - \\mathbf{x}',
          read: 'with the skip connection the block outputs f(x) + x, so its layers only have to model the difference between the target h(x) and the input x.',
        },
      },
      'More recent architectures (slide 47): **Xception**[^11] (2016), a variant of GoogLeNet by **François Chollet** (the author of Keras), which significantly outperformed Inception-v3 on a huge vision task (350 million images and 17,000 classes); and **SENet**[^12] (2017), the **Squeeze-and-Excitation Network**, which won ILSVRC 2017 with an astonishing **2.25% top-5 error rate** by extending existing architectures such as inception networks and ResNets and boosting their performance.',
      'Other noteworthy architectures include **ResNeXt** (2016), **DenseNet** (2016), **MobileNet** (2017), **CSPNet** (2019) and **EfficientNet** (2019).',
    ],
    play: ['residual', 'timeline'],
    notes: [
      {
        h: 'ResNet (2015, slides 45–46)',
        lines: [
          'The Residual Network (ResNet), by Kaiming He et al., won ILSVRC 2015 with a top-5 error under 3.6%.',
          'The winning variant had 152 layers; other variants have 34, 50 and 101 layers.',
          'It confirmed the trend: models are getting deeper and deeper, with fewer and fewer parameters.',
          'The key to training such a deep network is skip connections (also called shortcut connections).',
          'A network normally models a target $h(\\mathbf{x})$; adding the input $\\mathbf{x}$ to a deeper layer forces it to model $f(\\mathbf{x}) = h(\\mathbf{x}) - \\mathbf{x}$ instead. This is residual learning.',
        ],
      },
      {
        h: 'More recent architectures (slide 47)',
        lines: [
          'Xception (2016), by François Chollet (the author of Keras), is a variant of GoogLeNet that significantly outperformed Inception-v3 on a huge task (350 million images, 17,000 classes).',
          'SENet (Squeeze-and-Excitation Network) won ILSVRC 2017 with a 2.25% top-5 error; it extends architectures such as inception networks and ResNets and boosts their performance.',
          'Other noteworthy architectures: ResNeXt (2016), DenseNet (2016), MobileNet (2017), CSPNet (2019), EfficientNet (2019).',
        ],
      },
    ],
    draw: [
      { fig: 'residual', caption: 'Label the skip connection, the + node, and $f(\\mathbf{x}) = h(\\mathbf{x}) - \\mathbf{x}$ beside the two layers.' },
    ],
    formulas: [
      { tex: 'f(\\mathbf{x}) = h(\\mathbf{x}) - \\mathbf{x} \\quad\\Longleftrightarrow\\quad f(\\mathbf{x}) + \\mathbf{x} = h(\\mathbf{x})', read: 'With the skip, the layers learn the residual; adding x back gives the target.' },
    ],
    worked: {
      title: 'Top-5 error, winner by winner',
      lines: ['AlexNet 17% (2012) → GoogLeNet below 7% (2014) → ResNet under 3.6% (2015) → SENet 2.25% (2017).'],
    },
    check: [
      { q: 'What does a skip connection add, and where?', a: 'The input $\\mathbf{x}$ is added to the output of a deeper layer.' },
      { q: 'With a skip connection, what does the network model instead of $h(\\mathbf{x})$?', a: 'The residual $f(\\mathbf{x}) = h(\\mathbf{x}) - \\mathbf{x}$.' },
    ],
  },

  /* ── §13 ────────────────────────────────────────────────────────────── */
  {
    id: 's13',
    no: '13',
    title: 'Using pretrained models from Keras',
    short: 'Pretrained models',
    slides: '48–49',
    read: [
      'In general, you won’t have to implement standard models like GoogLeNet or ResNet manually: **pretrained networks** are readily available with a single line of code in the **`tf.keras.applications`** package.',
      'Slide 48 loads **ResNet-50** with ImageNet weights, resizes the two sample images to 224 × 224 (`crop_to_aspect_ratio=True`), and runs `resnet50.preprocess_input`, which converts the images from **RGB to BGR** and **zero-centres each colour channel**. `model.predict(inputs)` returns `Y_proba` of shape **(2, 1000)** — one probability for each of the 1,000 ImageNet classes, for each image — and `decode_predictions(Y_proba, top=3)` lists each image’s **top 3** classes.',
      'Slide 49: the correct classes are **palace** and **dahlia**. The model is correct for the first image (palace, 54.69%) but wrong for the second (vase, 32.66%) — because **dahlia is not one of the 1,000 ImageNet classes**.',
      'What if you want an image classifier for classes that are not part of ImageNet? You may still benefit from the pretrained models by using them to perform **transfer learning** ([§14](#s14)).',
    ],
    play: ['pretrained'],
    notes: [
      {
        h: 'One line of code (slide 48)',
        lines: [
          'Standard pretrained models such as ResNet are available in `tf.keras.applications`, so you rarely implement them yourself.',
          '`model = tf.keras.applications.ResNet50(weights="imagenet")` loads ResNet-50 with ImageNet weights.',
          'Resize the images to 224×224 (`crop_to_aspect_ratio=True`), then `resnet50.preprocess_input` converts RGB to BGR and zero-centres each colour channel.',
          '`model.predict(inputs)` returns `Y_proba` of shape `(2, 1000)`: one probability per ImageNet class for each image.',
          '`resnet50.decode_predictions(Y_proba, top=3)` gives each image’s top 3 (class id, name, probability).',
        ],
      },
      {
        h: 'The result (slide 49)',
        lines: [
          'Image #0: palace 54.69% — correct. Image #1: vase 32.66% — but the correct class is dahlia.',
          'The second is wrong because dahlia is not one of the 1,000 ImageNet classes.',
          'For classes outside ImageNet, reuse a pretrained model through transfer learning.',
        ],
      },
    ],
    draw: [
      { fig: 'pretrained', caption: 'Write the tensor shape on each arrow of the pipeline.' },
    ],
    formulas: [
      { code: 'tf.keras.applications.ResNet50(weights="imagenet")', read: 'A pretrained ResNet-50 in one line.' },
      { code: 'tf.keras.applications.resnet50.preprocess_input(images_resized)', read: 'RGB → BGR and zero-centre each colour channel, as ResNet-50 expects.' },
      { code: 'tf.keras.applications.resnet50.decode_predictions(Y_proba, top=3)', read: 'Turn the (2, 1000) probabilities into each image’s top 3 named classes.' },
    ],
    check: [
      { q: 'What shape does `model.predict` return for the 2 images?', a: '`(2, 1000)` — one probability per ImageNet class for each image.' },
      { q: 'Why did ResNet-50 get the second image wrong?', a: 'Its correct class, dahlia, is not one of the 1,000 ImageNet classes.' },
    ],
  },

  /* ── §14 ────────────────────────────────────────────────────────────── */
  {
    id: 's14',
    no: '14',
    title: 'Transfer learning with a pretrained model',
    short: 'Transfer learning',
    slides: '50–51',
    read: [
      'Slides 50–51 train a model to classify **pictures of flowers** by reusing a pretrained **Xception** model.',
      'The data: `tfds.load("tf_flowers", …)` splits the 3,670 images into a **test set (the first 10%)**, a **validation set (the next 15%)** and a **training set (the remaining 75%)**, with 5 classes — dandelion, daisy, tulips, sunflowers and roses. Every image is resized to 224 × 224 (`crop_to_aspect_ratio=True`) and passed through `xception.preprocess_input`, because Xception requires input pixel values between −1 and 1. Batches hold 32 images, and the training set is shuffled.',
      { unfold: { label: 'Slide 50’s data pipeline, in full', blocks: [{ code: { src: 'flowers', label: 'flowers_data.py', meta: 'slide 50' } }] } },
      'The model: load `Xception(weights="imagenet", include_top=False)` as the **base model**, add a **`GlobalAveragePooling2D`** layer on its output and a **`Dense(n_classes, activation="softmax")`** output layer, and wrap everything in a `tf.keras.Model`.',
      'Training happens in **two phases**. First, **freeze the pretrained layers** (`layer.trainable = False` for every base layer), compile with SGD (`learning_rate=0.1`, `momentum=0.9`) and train for **3 epochs**. Then **unfreeze some layers** (`base_model.layers[56:]`), compile again with a **lower learning rate** (0.01) and train for **10 more epochs**.',
      'Using this model you should get around **92% test accuracy**; training a bit longer should take it to **95% to 97%**.',
    ],
    play: ['transfer'],
    notes: [
      {
        h: 'The data (slide 50)',
        lines: [
          'Goal: classify flower pictures (tf_flowers: 3,670 images, 5 classes) by reusing a pretrained Xception model.',
          'Split: the first 10% for testing, the next 15% for validation and the remaining 75% for training.',
          'Preprocess: resize to 224×224 (`crop_to_aspect_ratio=True`) and apply `xception.preprocess_input`, which puts pixels between −1 and 1; batch size 32.',
        ],
      },
      {
        h: 'The model (slide 51)',
        lines: [
          'Load `Xception(weights="imagenet", include_top=False)` as the base model.',
          'Add `GlobalAveragePooling2D` on `base_model.output`, then a `Dense(n_classes, activation="softmax")` output layer.',
        ],
      },
      {
        h: 'Two-phase training',
        lines: [
          'Phase 1: freeze every base layer (`trainable = False`), compile with `SGD(learning_rate=0.1, momentum=0.9)` and train for 3 epochs.',
          'Phase 2: unfreeze `base_model.layers[56:]`, recompile with a lower learning rate (0.01) and train for 10 more epochs.',
          'Result: about 92% test accuracy, and 95–97% with a bit more training.',
        ],
      },
    ],
    draw: [
      { fig: 'transfer', caption: 'Label which layers are frozen in each phase, and each phase’s learning rate and number of epochs.' },
    ],
    formulas: [
      { code: 'for layer in base_model.layers:\n    layer.trainable = False', read: 'Phase 1: freeze the whole pretrained base.' },
      { code: 'for layer in base_model.layers[56:]:\n    layer.trainable = True', read: 'Phase 2: unfreeze the layers from index 56 up.' },
      { code: 'SGD(learning_rate=0.1, momentum=0.9) → SGD(learning_rate=0.01, momentum=0.9)', read: 'The learning rate drops tenfold for fine-tuning.' },
    ],
    worked: {
      title: 'The training plan',
      lines: [
        'Split of 3,670 images: 10% test ≈ 367, 15% validation ≈ 551, 75% training ≈ 2,752.',
        'Epochs: 3 (head only, lr 0.1) + 10 (layers 56+ and head, lr 0.01) = 13 in total.',
      ],
    },
    check: [
      { q: 'What changes between phase 1 and phase 2?', a: '`base_model.layers[56:]` are unfrozen, the model is recompiled with a lower learning rate (0.01 instead of 0.1), and it trains for 10 more epochs.' },
      { q: 'Which layers sit on top of the Xception base?', a: '`GlobalAveragePooling2D`, then `Dense(n_classes, activation="softmax")`.' },
    ],
  },

  /* ── §15 ────────────────────────────────────────────────────────────── */
  {
    id: 's15',
    no: '15',
    title: 'Summary',
    short: 'Summary',
    slides: '52–53',
    read: [
      'Slide 52 lists what you should be able to do after this topic. Tick each outcome in the checklist below once you can explain it from your notes; every outcome links back to the sections — and notebook pages — that teach it.',
      'For the next topic (slide 53): read up to **Chapter 15**, *Processing Sequences Using RNNs and CNNs*.',
    ],
    play: ['outcomes'],
    notes: [
      {
        h: 'Learning outcomes (slide 52)',
        lines: [
          'Understand how the input layer and the convolutional layers are connected (§3, §5).',
          'Understand the purpose of filters and what they generate: the feature maps (§2, §4).',
          'Know how to stack multiple feature maps (§5).',
          'Understand the role of pooling layers in a CNN (§9).',
          'Know how to implement a simple CNN using TensorFlow (§6, §7, §11).',
          'Understand the large memory requirements of CNNs (§8).',
          'Know some basic CNN architectures (§11, §12).',
          'Know how to implement transfer learning with a pretrained model (§13, §14).',
        ],
      },
      {
        h: 'Next (slide 53)',
        lines: ['Read up to Chapter 15: Processing Sequences Using RNNs and CNNs.'],
      },
    ],
  },
];
