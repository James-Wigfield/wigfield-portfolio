/* ============================================================================
   LECTURE 5 STUDY — SECTION CONTENT (the Read beat)
   ----------------------------------------------------------------------------
   The module's prose, as data, in slide order. Layout code never holds
   prose: edit a paragraph here and the page updates. The notebook pages
   (the Write beat) live in ./sheets, one file per section.

   Inline markup (rendered by Rich.jsx):
     **bold**   *italic*   `code`   $tex$   [label](#sectionId)   [^n] footnote

   Each section:
     id, no, title, short, slides     identity, rail label, slide receipt
     read      blocks — a string is a paragraph; objects are
               { eq: { name, tex, read } }, { list }, { code: { src, label } },
               { note, label? }, { slideNote }, { unfold: { label, blocks } },
               { fig } ({ code: { src } } takes inline code or a NAMED_CODE
               key from slideData.js)
     play      lab keys (components live in ./labs, mapped in the shell)

   Every slide 1–27 lands in exactly one section (tools/dl-lecture5-study/
   page-check.mjs checks the coverage from these ranges).
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
      '**Topic 5: Representation learning and dimension reduction using Autoencoders** — CITS5017 Deep Learning, Associate Professor Du Huynh, Semester 2, 2026 (slide 1). Today covers **Chapter 17** of *Hands-on Machine Learning with Scikit-Learn, Keras & TensorFlow* (slide 2).',
      'Chapter 17 is *Autoencoders, GANs, and Diffusion Models*. Slide 3 lists the main topics this lecture briefly covers: what autoencoders are; efficient data representations; the encoder and decoder in an autoencoder; performing PCA using an *undercomplete* linear autoencoder; stacked autoencoders and how to implement one using Keras in TensorFlow; tying the weights in a stacked autoencoder and visualizing the reconstruction; unsupervised pre-training using stacked autoencoders; and training one autoencoder at a time. **Diffusion models will not be covered in the unit.**',
      'Every section below follows the deck in order and has three beats: **Read** the short explanation, **Play** with the live lab until the idea clicks, then **Write**: copy the notebook page onto paper and tick each line as it goes in. The notebook pages hold only what is worth writing down. Anything a page leaves out is named in a grey line at its foot, and it is still here in Read and Play. Ticks and your place are saved in this browser.',
      'Numbers printed on the slides carry their slide number. Numbers this page computes itself are labelled as **this page’s own run**: the linear autoencoder trained in [§3](#s03) on the page’s own 3D data, and the Fashion MNIST reconstructions and t-SNE map in [§6](#s06). The slides give no error values to compare them with.',
    ],
    play: ['roadmap'],
  },

  /* ── §1 ─────────────────────────────────────────────────────────────── */
  {
    id: 's01',
    no: '1',
    title: 'What are autoencoders?',
    short: 'What are autoencoders?',
    slides: '4',
    read: [
      'Autoencoders are artificial neural networks capable of learning **efficient representations** of the input data, called **latent representations** or **codings**, **without any supervision**: the training set is unlabelled. These codings typically have a **much lower dimensionality** than the input data, which makes autoencoders useful for **dimensionality reduction** (slide 4).',
      'More importantly, autoencoders act as **feature detectors**, and they can be used for **unsupervised pre-training** of deep neural networks.',
      'Lastly, some autoencoders are **generative models**: they can randomly generate new data that looks very similar to the training data. For example, you could train an autoencoder on pictures of faces, and it would then be able to generate new faces. However, the generated images are usually **fuzzy and not entirely realistic**.',
      { slideNote: 'Slide 4 reads “called *latent representations codings*”: a word seems to be missing. The deck uses both names for the same thing. Figure 17-1 labels the middle of the chess experiment “Latent representation”, and slide 7 and Figure 17-3 call the same thing the “codings”. This page writes “latent representations, or codings”.' },
    ],
    play: ['uses'],
  },

  /* ── §2 ─────────────────────────────────────────────────────────────── */
  {
    id: 's02',
    no: '2',
    title: 'Efficient data representations: encoder, decoder, undercomplete',
    short: 'Encoder, decoder, codings',
    slides: '5–7',
    read: [
      'Slide 5 asks which of two number sequences you find the easiest to memorize: **40, 27, 25, 36, 81, 57, 10, 73, 19, 68**, or **50, 48, 46, 44, 42, 40, 38, 36, 34, 32, 30, 28, 26, 24, 22, 20, 18, 16, 14**. The first is shorter and seemingly easier to remember, but the second has a notable **pattern**: decreasing even numbers from 50 to 14. Once you see the pattern, there is far less to remember.',
      'Just like expert chess players being able to detect patterns in chess games, we can train an autoencoder to convert the inputs to **efficient latent representations**, and then spit out something that (hopefully) looks very close to the inputs. Figure 17-1 (left) draws this chess memory experiment: a board of **inputs**, a **latent representation**, and a board of **outputs (≈ inputs)**.',
      'An autoencoder typically has the same architecture as a **Multi-Layer Perceptron (MLP)**, except that the number of neurons in the **output layer must equal** the number of neurons in the **input layer** (slide 6). In Figure 17-1 (right) there is just one hidden layer of **two neurons**, the **encoder**, and one output layer of **three neurons**, the **decoder**. The inputs are $x_1, x_2, x_3$ and the outputs are $x\'_1, x\'_2, x\'_3$.',
      'The outputs are often called the **reconstructions**, since the autoencoder tries to reconstruct its inputs. The cost function contains a **reconstruction loss** that penalizes the model when the reconstructions are different from the inputs.',
      'Because the internal representation has a **lower dimensionality** than the input data (it is 2D instead of 3D), the autoencoder is said to be **undercomplete** (slide 7). An undercomplete autoencoder cannot trivially copy its inputs to the codings, so it must learn to find a way to output a copy of its inputs. It is **forced to learn the most important features** in the input data, and to drop the unimportant ones.',
    ],
    play: ['sequences', 'fig171'],
  },

  /* ── §3 ─────────────────────────────────────────────────────────────── */
  {
    id: 's03',
    no: '3',
    title: 'PCA with an undercomplete linear autoencoder',
    short: 'Linear AE ≈ PCA',
    slides: '8–9',
    read: [
      'If the autoencoder uses only **linear activations** and the cost function is the **Mean Squared Error (MSE)**, then it can be shown that it ends up performing **Principal Component Analysis** (see Chapter 8) (slide 8).',
      'The example builds a simple linear autoencoder to perform PCA. The `encoder` is a single `Dense(2)` layer and the `decoder` a single `Dense(3)` layer, both with no activation. They are chained into `autoencoder`, which is compiled with `loss="mse"` and `SGD(learning_rate=0.5)`:',
      { code: { src: 'LINEAR_AE', label: 'slide 8' } },
      'Slide 8’s notes: **(i)** the autoencoder consists of two subcomponents, the **encoder** and the **decoder**. **(ii)** Its number of outputs is equal to its number of inputs (3). **(iii)** To perform PCA there is **no activation function** (all neurons are linear), and the cost function is the **MSE**.',
      'Slide 9 trains it on “the same 3D data used in Chapter 8”, a training set of shape (60, 3) that the slide elides as `X_train = [...]`. The key call is `autoencoder.fit(X_train, X_train, epochs=500, verbose=False)`: **the inputs are also the targets**. Then `codings = encoder.predict(X_train)` gives each training point’s 2D coding.',
      { code: { src: 'LINEAR_FIT', label: 'slide 9' } },
      'Slide 9’s two plots. On the left is the 3D training set (axes $x_1, x_2, x_3$) with a light blue plane through it: bright red dots are points above the plane, light red dots are points below it, and blue markers are the points’ projections onto the plane. On the right are the 2D codings, on axes $z_1$ and $z_2$: “the approximate PCA performed by the undercomplete linear autoencoder”. The caption asks you to compare the blue markers in the two diagrams.',
      { note: 'What the autoencoder recovers is PCA’s **subspace**: the plane spanned by the top two principal components. Its two coding axes need not be the principal components themselves. They can be rotated, stretched and not at right angles to each other, while the reconstructions (the points on the plane) stay the same. That fits slide 9’s word *approximate*. The lab below shows it on this page’s own data.', label: 'This page’s clarification, beyond the slides' },
    ],
    play: ['pca'],
  },

  /* ── §4 ─────────────────────────────────────────────────────────────── */
  {
    id: 's04',
    no: '4',
    title: 'Stacked autoencoders',
    short: 'Stacked autoencoders',
    slides: '10–11',
    read: [
      'Just like other neural networks, autoencoders can have **multiple hidden layers**. They are then called **stacked autoencoders** (or **deep autoencoders**) (slide 10).',
      'Adding more layers helps the autoencoder learn **more complex codings**. However, one must be careful not to make the autoencoder **too powerful**. Imagine an encoder so powerful that it just learns to map each input to a **single arbitrary number**, and a decoder that learns the reverse mapping. Such an autoencoder will reconstruct the training data perfectly, but it will not have learned any useful data representation in the process, and it is unlikely to generalize well to new instances.',
      'The architecture of a stacked autoencoder is typically **symmetrical** with regard to the **central hidden layer**, the **coding layer**: it looks like a **sandwich** (slide 11). For example, an autoencoder for MNIST may have **784** inputs, then a hidden layer of **100** neurons, a central hidden layer of **30** neurons, another hidden layer of **100** neurons, and an output layer of **784** neurons (Figure 17-3). Figure 17-3 marks the coding layer’s output as the **Codings** and the output layer’s as the **Reconstruction**.',
    ],
    play: ['sandwich'],
  },

  /* ── §5 ─────────────────────────────────────────────────────────────── */
  {
    id: 's05',
    no: '5',
    title: 'Implementing a stacked autoencoder in Keras',
    short: 'Keras: stacked_ae',
    slides: '12',
    read: [
      'You can implement a stacked autoencoder very much like a regular deep MLP. Slide 12’s code is for the **Fashion MNIST** dataset of 28 × 28 images:',
      {
        list: [
          '`stacked_encoder` takes a 28 × 28 image (`InputLayer(shape=[28,28])`), flattens it into 784 values with `Flatten()`, then applies `Dense(100, activation="relu")` and `Dense(30, activation="relu")`. Its output is the 30 codings.',
          '`stacked_decoder` mirrors it: `Dense(100, activation="relu")`, then `Dense(28 * 28)` with no activation, then `Reshape([28, 28])` back into an image.',
          '`stacked_ae` chains the two. It is compiled with `loss="mse"` and `optimizer="nadam"`, and trained with `fit(X_train, X_train, epochs=20, validation_data=(X_valid, X_valid))`. As in [§3](#s03), the targets are the inputs, for the validation data too.',
        ],
      },
      { code: { src: 'STACKED_AE', label: 'slide 12' } },
      'Slide 12: **this model (`stacked_ae`) has 163,814 trainable parameters.** The slide prints only the total; the split below is this page’s working. A `Dense` layer has one weight per input per unit, plus one bias per unit, so it has inputs × units + units parameters:',
      {
        list: [
          '`Dense(100)` on 784 inputs: 784 × 100 + 100 = **78,500**',
          '`Dense(30)` on 100 inputs: 100 × 30 + 30 = **3,030**',
          '`Dense(100)` on 30 inputs: 30 × 100 + 100 = **3,100**',
          '`Dense(28 * 28)` on 100 inputs: 100 × 784 + 784 = **79,184**',
          '`InputLayer`, `Flatten` and `Reshape` have no parameters. The total is 78,500 + 3,030 + 3,100 + 79,184 = **163,814**, as the slide says.',
        ],
      },
    ],
    play: ['stackedCode'],
  },

  /* ── §6 ─────────────────────────────────────────────────────────────── */
  {
    id: 's06',
    no: '6',
    title: 'Visualizing: reconstructions and t-SNE',
    short: 'Reconstructions & t-SNE',
    slides: '13–15',
    read: [
      '**Visualizing the reconstructions** (slide 13). One way to ensure that an autoencoder is properly trained is to compare the inputs and the outputs: the differences should not be too significant. Figure 17-4 shows five Fashion MNIST originals (top) and their reconstructions (bottom).',
      'The reconstructions are **recognizable, but a bit too lossy**. To improve them we may need to **train the model for longer**, or **make the encoder and decoder deeper**, or **make the codings larger**.',
      '**Visualizing using t-SNE** (slide 14). Once we have reduced the dataset’s dimensionality, we can use **another dimensionality reduction algorithm** to see how well the lower-dimensional data suits the downstream classification task. T-SNE[^1] is a suitable algorithm, as it reduces the data down to **2D** for visualization. The code compresses the validation set with the trained `stacked_encoder` (30 codings per image), then runs `TSNE()` on those codings:',
      { code: { src: 'TSNE', label: 'slide 14' } },
      'Figure 17-5 (slide 15) is the result: Fashion MNIST visualized using an autoencoder followed by t-SNE. Each dot is one validation image, coloured by its class, with small item thumbnails on the clusters. Trousers, bags and footwear form clearly separate clusters, while several kinds of top are mixed together.',
      { note: 'No slide shows the plotting code for Figures 17-4 and 17-5. Slide 25 calls a `plot_reconstructions` helper and points to “the author’s Jupyter notebook file” for it.' },
    ],
    play: ['recon', 'tsne'],
  },

  /* ── §7 ─────────────────────────────────────────────────────────────── */
  {
    id: 's07',
    no: '7',
    title: 'Unsupervised pretraining',
    short: 'Unsupervised pretraining',
    slides: '16–17',
    read: [
      'So autoencoders can be used for dimensionality reduction. Another application is **unsupervised pretraining** (slide 16).',
      'As discussed in Chapter 11, suppose you are tackling a complex supervised task but you do not have a lot of **labelled training data**. One solution is to find a neural network that performs a similar task and **reuse its lower layers**. This makes it possible to train a high-performance model using little training data, because your network won’t have to learn all the low-level features: it will just reuse the **feature detectors** learned by the existing network.',
      'Similarly, we can first train a **stacked autoencoder using all the data**. This training process does **not require the data to be labelled**. Once the stacked autoencoder is trained, we can **reuse its lower layers** in our neural network for the actual task. As that network has **fewer layers that require training**, it can cope with fewer labelled training data.',
      'Figure 17-6 (slide 17) shows the two phases. In **Phase 1**, train the autoencoder (Input, Hidden 1, Hidden 2, Hidden 3, Output) using all the data. In **Phase 2**, **copy the parameters** of Hidden 1 and Hidden 2 into a classifier: Input, Hidden 1, Hidden 2, then an Output layer with a Softmax on top. Then train the classifier on the labelled data. Hidden 3 and the autoencoder’s Output layer are not copied.',
      'There is nothing special about the implementation: just train an autoencoder using all the training data, then reuse its **encoder layers** to create a new neural network for your actual task, and train it using the labelled data.',
    ],
    play: ['pretrain'],
  },

  /* ── §8 ─────────────────────────────────────────────────────────────── */
  {
    id: 's08',
    no: '8',
    title: 'Tying the weights',
    short: 'Tying the weights',
    slides: '18–22',
    read: [
      'When an autoencoder is neatly symmetrical, like the one just built, a common technique is to **tie the weights** of the decoder layers to the weights of the encoder layers. This **halves the number of weights** in the model, **speeding up training** and **limiting the risk of overfitting** (slide 18).',
      'Specifically (slide 19): suppose the autoencoder has a total of $N$ layers, not counting the input layer, and $\\mathbf{W}_{\\ell}$ represents the connection weights of the $\\ell^{\\text{th}}$ layer. Layer 1 is the first hidden layer, layer $\\frac{N}{2}$ is the coding layer, and layer $N$ is the output layer. Then the decoder layer weights can be defined simply as:',
      { eq: { name: 'Tied weights (slide 19)', tex: '\\mathbf{W}_{N-\\ell+1} = \\mathbf{W}_{\\ell}^{\\top}', read: 'each decoder layer uses the transposed weights of the encoder layer that mirrors it, for ℓ = 1, 2, ⋯, N/2' } },
      'with $\\ell = 1, 2, \\cdots, N/2$. In the slide’s example $N = 4$ (Hidden 1, Hidden 2, Hidden 3 and the output layer), so $\\mathbf{W}_4 = \\mathbf{W}_1^{\\top}$ and $\\mathbf{W}_3 = \\mathbf{W}_2^{\\top}$. The diagram labels the decoder’s weights $\\mathbf{W}_2^{\\top}$ (Hidden 2 to Hidden 3) and $\\mathbf{W}_1^{\\top}$ (Hidden 3 to the output layer). **In this example, only $\\mathbf{W}_1$, $\\mathbf{W}_2$ and the bias terms need to be learned.**',
      'To build it in Keras, slide 20 defines a custom layer, `DenseTranspose`. It is given an existing `Dense` layer (`dense`). In `call` it multiplies its inputs by **that layer’s weights, transposed** (`tf.matmul(inputs, self.dense.weights[0], transpose_b=True)`), adds **its own biases**, and applies its activation. Its biases are created in `build` with `shape=[self.dense.input.shape[-1]]`, the line the slide marks `# ***` as its modification to Géron’s code. That shape is the number of **inputs** of the tied `Dense` layer, which is the number of **outputs** of the transposed layer: 100 for `DenseTranspose(dense_2)` and 784 for `DenseTranspose(dense_1)`.',
      { unfold: { label: 'Slide 20 · the DenseTranspose layer (verbatim)', blocks: [{ code: { src: 'DENSE_TRANSPOSE', label: 'slide 20' } }] } },
      'Slide 21 builds `tied_ae`. `tied_encoder` is `InputLayer(shape=[28,28])`, `Flatten()`, `dense_1` (a `Dense(100, activation="relu")`) and `dense_2` (a `Dense(30, activation="relu")`). `tied_decoder` is `DenseTranspose(dense_2, activation="relu")`, `DenseTranspose(dense_1)` and `Reshape([28, 28])`. The model is compiled with `loss="mse"` and `optimizer="nadam"`, and trained for **10 epochs**.',
      { unfold: { label: 'Slide 21 · tied_ae (verbatim)', blocks: [{ code: { src: 'TIED_AE', label: 'slide 21' } }] } },
      'Compared with `stacked_ae`, which has **163,814** trainable parameters, `tied_ae` only has **82,414** (slide 21): the number of parameters that require training is almost halved. This page’s working: the encoder keeps its 78,500 + 3,030 = 81,530 parameters, and each `DenseTranspose` adds only its bias vector, 100 + 784 = 884. So 81,530 + 884 = 82,414. The **weights** are exactly halved (162,800 to 81,400). The 1,014 biases are not tied, which is why the total is only *almost* halved.',
      'Slide 21 also says that `tied_ae` achieves a slightly lower reconstruction error than `stacked_ae`. Slide 22 shows its reconstructions of the same five images as Figure 17-4, originals on top.',
      { slideNote: 'Slide 21’s “slightly lower reconstruction error” comes with no error values on any slide. The two models were also trained for different numbers of epochs: `stacked_ae` for 20 (slide 12) and `tied_ae` for 10 (slide 21). This page quotes the claim but cannot check it from the slides.' },
    ],
    play: ['tiedRule', 'tiedCount'],
  },

  /* ── §9 ─────────────────────────────────────────────────────────────── */
  {
    id: 's09',
    no: '9',
    title: 'Training one autoencoder at a time',
    short: 'One AE at a time',
    slides: '23–25',
    read: [
      'It is possible to train **one shallow autoencoder at a time**, then stack all of them into a single stacked autoencoder (hence the name) (slide 23). Figure 17-7 shows three phases:',
      {
        list: [
          '**Phase 1:** train the first autoencoder (Input, Hidden 1, Output, with target = inputs) to learn a compressed representation $\\mathbf{X}_{(1)}$ of the inputs.',
          '**Phase 2:** using $\\mathbf{X}_{(1)}$ as input data (“the training set encoded by the first encoder”), train the second autoencoder (Input, Hidden 2, Output, with target = inputs) to learn an even more compressed representation $\\mathbf{X}_{(2)}$.',
          '**Phase 3:** finally, build a big sandwich using all these autoencoders: Input, Hidden 1, Hidden 2, Hidden 3, Output. The parameters are copied across: Phase 1’s Hidden 1 and Output, and Phase 2’s Hidden 2 and its Output, which becomes Hidden 3.',
        ],
      },
      'There can be more phases if the autoencoder is very deep.',
      'Slide 24’s `train_autoencoder(n_neurons, X_train, X_valid, n_epochs=10, output_activation=None)` builds one shallow autoencoder: an `encoder`, `Dense(n_neurons, activation="relu")`, and a `decoder`, `Dense(n_inputs, activation=output_activation)` with `n_inputs = X_train.shape[-1]`. It trains them on their own inputs with `loss="mse"` and `optimizer="nadam"`, and returns the encoder, the decoder, and the **encoded** training and validation sets. Then:',
      {
        list: [
          'The images are flattened first: `X_train_flat` and `X_valid_flat`, 784 values per image.',
          'Phase 1: `train_autoencoder(100, X_train_flat, X_valid_flat)` returns `enc1`, `dec1` and the compressed `X_train_enc1`, `X_valid_enc1`, 100 values per image. The shape is 784 → 100 → 784.',
          'Phase 2: `train_autoencoder(30, X_train_enc1, X_valid_enc1, output_activation="relu")` returns `enc2` and `dec2`. The shape is 100 → 30 → 100.',
          'Phase 3: `stacked_ae_1_by_1` stacks `Flatten()`, `enc1`, `enc2`, `dec2`, `dec1` and `Reshape([28, 28])`.',
        ],
      },
      { unfold: { label: 'Slide 24 · train_autoencoder and the three phases (verbatim)', blocks: [{ code: { src: 'TRAIN_1BY1', label: 'slide 24' } }] } },
      'If needed, we can then continue training the full stacked autoencoder for a few epochs (slide 25 uses `epochs=5`) and visualize its reconstructions. Slide 25 shows the same five images again, originals on top.',
      { unfold: { label: 'Slide 25 · fine-tuning and plotting (verbatim)', blocks: [{ code: { src: 'CONTINUE_1BY1', label: 'slide 25' } }] } },
      { note: 'The slides don’t say why the second call passes `output_activation="relu"`. A likely reason: the second autoencoder’s targets are `X_train_enc1`, the outputs of `enc1`’s ReLU layer, so they are never negative, and a ReLU output layer is never negative either. `plot_reconstructions` is not defined on the slides (“see the author’s Jupyter notebook file”).', label: 'This page’s reasoning, not the slides’' },
    ],
    play: ['phases'],
  },

  /* ── §10 ────────────────────────────────────────────────────────────── */
  {
    id: 's10',
    no: '10',
    title: 'Summary and what’s next',
    short: 'Summary',
    slides: '26–27',
    read: [
      'Slide 26 sums the lecture up as six outcomes:',
      {
        list: [
          'Understand that autoencoders can be trained and used as a way to efficiently represent data (analogous to PCA).',
          'Understand the two main parts in an autoencoder: the **encoder** and the **decoder**.',
          'Know how to implement an *undercomplete* linear autoencoder in TensorFlow to perform PCA on the input data.',
          'Understand stacked autoencoders and know how to implement one using TensorFlow.',
          'Understand the concept of tying the weights in a stacked autoencoder and know how to visualize the reconstruction.',
          'Understand how to use stacked autoencoders in unsupervised pre-training tasks.',
        ],
      },
      'Slide 3’s last topic, **training one autoencoder at a time** ([§9](#s09)), has no matching outcome on slide 26.',
      '**For the next two topics** (slide 27): read up to Chapter 17 on *Autoencoders, GANs, and Diffusion Models* (from page 647 to page 667, excluding the *Sparse Autoencoders* section). And that’s all for this lecture.',
    ],
    play: ['outcomes'],
  },
];
