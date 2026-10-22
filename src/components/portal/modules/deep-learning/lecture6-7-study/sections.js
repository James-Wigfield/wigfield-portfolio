/* ============================================================================
   LECTURES 6–7 STUDY — SECTION CONTENT (the Read beat)
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

   Every slide 1–32 lands in exactly one section (tools/dl-lecture6-7-study/
   page-check.mjs checks the coverage from these ranges). The slides never
   say where Topic 6 ends and Topic 7 begins, so sections aren't labelled
   by topic.
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
      '**Topics 6&7: Convolutional AEs, Denoising AEs, Variational AEs, GANs, and DCGANs** — CITS5017 Deep Learning, Associate Professor Du Huynh (Unit Coordinator and Lecturer), Semester 2, 2026 (slide 1). The lecture covers **Chapter 17** of *Hands-on Machine Learning with Scikit-Learn, Keras & TensorFlow* (O’Reilly, Third Edition, by Aurélien Géron) (slide 2).',
      'Chapter 17 is *Autoencoders, GANs, and Diffusion Models*. Slide 3 lists the main topics this lecture briefly covers: **convolutional autoencoders**, **denoising autoencoders**, **variational autoencoders**, **Generative Adversarial Networks**, and **deep convolutional generative adversarial networks (DCGANs)**.',
      { print: 'The basic and stacked autoencoders this lecture builds on were Lecture 5. This PDF holds each section’s **Read** beat (the explanation, the slides’ code and footnotes, and Slide check notes where the deck disagrees with itself) and its **Play** beat (what each interactive lab shows, in a finished state), in slide order.' },
      { screen: 'The basic and stacked autoencoders this lecture builds on were Lecture 5 (its own study module). Every section below follows the deck in order: **Read** the short explanation, **Play** with the live lab until the idea clicks, then **Write**: copy the notebook page onto paper and tick each line as it goes in (the intro and the summary have no notebook page). The notebook pages hold only what is worth writing down; where a page leaves out a listing, a figure or a detail, a grey line at its foot says so, and all of it is still here in Read and Play. Ticks and your place are saved in this browser.' },
      'Numbers printed on the slides carry their slide number. Numbers and images this page computes itself are labelled **this page’s own run** or **this page’s working**. The own runs are the slides’ models trained with TensorFlow on Fashion MNIST (`conv_ae` in [§1](#s01), `dropout_ae` in [§2](#s02), the VAE in [§3](#s03)–[§6](#s06), the GAN in [§10](#s10) and the DCGAN in [§11](#s11)), the measurement of slide 25’s `trainable` lines in [§9](#s09), and a toy GAN that this page trains in your browser ([§8](#s08)–[§10](#s10)). [§7](#s07) shows images from the GAN and the VAE runs side by side.',
    ],
    play: ['roadmap'],
  },

  /* ── §1 ─────────────────────────────────────────────────────────────── */
  {
    id: 's01',
    no: '1',
    title: 'Convolutional autoencoders',
    short: 'Convolutional AEs',
    slides: '4–6',
    read: [
      'If you are dealing with images, the autoencoders seen so far will not work well. To build an **autoencoder for images** (e.g., for **unsupervised pretraining** or **dimensionality reduction**), you need a **convolutional autoencoder** (slide 4).',
      'The **encoder** of a convolutional autoencoder is just a regular **CNN** composed of convolutional layers and pooling layers. It typically **reduces the spatial dimensionality** of the inputs (height and width) while **increasing the depth** (the number of channels).',
      'The **decoder** must do the reverse: upscale the image and reduce its depth back to the original dimensions. For this you can use **transpose convolutional layers** (alternatively, you could combine upsampling layers with convolutional layers).',
      'Slide 5 builds “a simple convolutional autoencoder for Fashion MNIST”. Its shape comments trace the image through it:',
      {
        list: [
          '`conv_encoder`: `Reshape([28, 28, 1])` gives the 28 × 28 image one channel. Three rounds of `Conv2D` (16, 32, then 64 filters of size 3, `padding="same"`, ReLU) each followed by `MaxPool2D(pool_size=2)` take it to **14 × 14 × 16**, **7 × 7 × 32** and **3 × 3 × 64**. Then `Conv2D(30, 3, …)` gives **3 × 3 × 30**, and `GlobalAvgPool2D()` gives **30**: the codings.',
          '`conv_decoder`: `Dense(3 * 3 * 16)` (**144 neurons**), `Reshape((3, 3, 16))`, then three `Conv2DTranspose` layers with `strides=2`: to **7 × 7 × 32**, **14 × 14 × 16** (`padding="same"`) and **28 × 28 × 1** (`padding="same"`, no activation), and `Reshape([28, 28])`.',
          '`conv_ae` chains the two. It is compiled with `loss="mse"` and `optimizer="nadam"` and trained with `fit(X_train, X_train, epochs=10, validation_data=(X_valid, X_valid))`: the inputs are also the targets.',
        ],
      },
      { unfold: { label: 'Slide 5 · conv_encoder, conv_decoder and conv_ae (verbatim)', blocks: [{ code: { src: 'CONV_AE', label: 'slide 5' } }] } },
      'Two of the comments need a closer look. The third `MaxPool2D` halves 7 and rounds down, so 7 → **3**. The first `Conv2DTranspose` has no padding argument (so `"valid"`) and takes 3 → **7**; the two with `padding="same"` exactly double: 7 → 14 → 28.',
      'Slide 6 inspects the decoder with `conv_decoder.summary()`: `Dense` **4,464**, the first `Reshape` 0, the three `Conv2DTranspose` layers **4,640**, **4,624** and **145**, the last `Reshape` 0. **Total params: 13,873**, all trainable. Then `conv_ae.count_params()` prints **54479**, the total number of parameters of the whole autoencoder (trainable + non-trainable).',
      { unfold: { label: 'Slide 6 · conv_decoder.summary() and conv_ae.count_params() (verbatim)', blocks: [{ code: { src: 'CONV_SUMMARY', label: 'slide 6' } }] } },
      'This page’s working, layer by layer. A `Dense` layer has inputs × units + units parameters: 30 × 144 + 144 = 4,464. A `Conv2D` or `Conv2DTranspose` layer has kernel height × width × input channels × filters, plus one bias per filter: 3 × 3 × 16 × 32 + 32 = 4,640, 3 × 3 × 32 × 16 + 16 = 4,624 and 3 × 3 × 16 × 1 + 1 = 145. The slide gives no breakdown for the encoder, but the same rule gives 160 + 4,640 + 18,496 + 17,310 = **40,606**, and 40,606 + 13,873 = **54,479**, as slide 6 prints.',
      { note: 'The summary’s layer-type column is cut off by Keras’s fixed column width, so `Conv2DTranspose` prints as “Conv2DTra / nspose” and “Conv2DT / ranspose”. That is Keras’s layout, not a typo.' },
    ],
    play: ['convFlow', 'transpose'],
  },

  /* ── §2 ─────────────────────────────────────────────────────────────── */
  {
    id: 's02',
    no: '2',
    title: 'Other types of autoencoders; denoising autoencoders',
    short: 'Denoising AEs',
    slides: '7–9',
    read: [
      'So far we have seen various kinds of autoencoders (basic, stacked and convolutional), trained either in one shot or in several phases, and a couple of applications: **data visualization** and **unsupervised pretraining** (slide 7).',
      'Up to now, to force the autoencoder to learn interesting features, we have **limited the size of the coding layer**, making it **undercomplete**. There are many other kinds of constraints that can be used, including ones that allow the coding layer to be **just as large as the inputs, or even larger**, resulting in an **overcomplete autoencoder**. The next slides look at **denoising autoencoders** and **variational autoencoders**.',
      'Another way to force the autoencoder to learn useful features is to **add noise to its inputs**, training it to **recover the original, noise-free inputs** (slide 8). In a 2010 paper, Vincent et al.[^1] introduced **stacked denoising autoencoders**. The noise can be **pure Gaussian noise** added to the inputs, or it can be **randomly switched-off inputs**, just like in **dropout**. Figure 17-8, “Denoising autoencoders, with Gaussian noise (left) or dropout (right)”, draws both: a `+` with “Gaussian noise” between the Input and Hidden 1 (left), or a `Dropout` layer in the same place (right).',
      'Slide 9’s implementation uses the dropout version. `dropout_encoder` is `Flatten()`, **`Dropout(0.5)`**, `Dense(100, activation="relu")` and `Dense(30, activation="relu")`; `dropout_decoder` is `Dense(100, activation="relu")`, `Dense(28 * 28)` and `Reshape([28, 28])`. `dropout_ae` chains them, compiled with `loss="mse"` and `optimizer="nadam"` and trained for **10 epochs** with the clean images as the targets: `fit(X_train, X_train, …)`.',
      { unfold: { label: 'Slide 9 · dropout_ae (verbatim)', blocks: [{ code: { src: 'DROPOUT_AE', label: 'slide 9' } }] } },
      'Figure 17-9 shows five noisy images (top, “with half the pixels turned off”) and their reconstructions by the dropout-based denoising autoencoder (bottom).',
      { note: 'The noise comes from the `Dropout(0.5)` layer inside the encoder, so the training images themselves stay clean; they are also the targets. As slide 10 puts it, a denoising autoencoder uses randomness only during training.', label: 'This page’s reading of the code' },
    ],
    play: ['noise', 'codingSize'],
  },

  /* ── §3 ─────────────────────────────────────────────────────────────── */
  {
    id: 's03',
    no: '3',
    title: 'Variational autoencoders: what’s different',
    short: 'VAEs: what’s different',
    slides: '10–11',
    read: [
      'An important category of autoencoders was introduced in 2013 by Diederik Kingma and Max Welling[^2] and quickly became one of the most popular variants: **variational autoencoders** (**VAEs**) (slide 10). VAEs are quite different from all the previous autoencoders in two ways:',
      {
        list: [
          'They are **probabilistic autoencoders**: their outputs are **partly determined by chance, even after training** (as opposed to denoising autoencoders, which use randomness only during training).',
          'Most importantly, they are **generative autoencoders**: they can **generate new instances** that look like they were sampled from the training set.',
        ],
      },
      'Training a VAE on a given dataset gives a good **approximation of the data distribution**. Once we have that, we can **sample from it** to generate new data instances.',
      'In Figure 17-11 (slide 11) the encoder and decoder have two hidden layers each, but there is a twist. Instead of learning lower dimensional representations of the inputs to pass on to the decoder, the encoder learns a **mean coding** $\\boldsymbol{\\mu}$ and a **standard deviation coding** $\\boldsymbol{\\sigma}$ of these representations. The decoder then **draws samples from this distribution** to reconstruct the inputs.',
      'The figure, bottom to top: Input, Hidden 1, Hidden 2, then two coding layers, **Codings μ** and **Codings σ**. Inside a dashed box, σ is multiplied (×) by **Gaussian noise** and the result is added (+) to μ. The sum goes on to Hidden 4, Hidden 5 and the Output. On the right, one instance goes from the input space to its mean coding μ in the coding space; a coding is sampled near μ, inside a grey circle whose size is set by σ; and that sampled coding is decoded back into the input space.',
      'This forces the variational autoencoder to learn the **best** $\\boldsymbol{\\mu}$ and $\\boldsymbol{\\sigma}$ that describe the distribution (assuming Gaussian) of the inputs.',
    ],
    play: ['vaeLive'],
  },

  /* ── §4 ─────────────────────────────────────────────────────────────── */
  {
    id: 's04',
    no: '4',
    title: 'The VAE’s loss: reconstruction + latent loss',
    short: 'Latent loss',
    slides: '12–13',
    read: [
      'During training, the cost function pushes the codings to gradually **migrate within the coding space** (also called the **latent space**) to end up looking like a **cloud of Gaussian points** (slide 12). Drawing samples from this latent space thus allows the decoder to reconstruct the inputs.',
      { slideNote: 'Slide 12 says the decoder reconstructs the inputs “using the two hidden layers *Hidden 3* and *Hidden 4*” (and the parenthesis is never closed). Figure 17-11 on slide 11 labels the decoder’s hidden layers **Hidden 4** and **Hidden 5**, and has no layer labelled Hidden 3: the dashed sampling box sits where it would be. Either way, the decoder has two hidden layers.' },
      'The **variational autoencoder’s latent loss** is defined as:',
      { eq: { name: 'Latent loss (slide 12)', tex: '\\mathscr{L} = -\\frac{1}{2}\\sum_{i=1}^{n}\\left[1 + \\log(\\sigma_i^2) - \\sigma_i^2 - \\mu_i^2\\right]', read: 'add up, over the n coding dimensions, one term per dimension built from that dimension’s mean μᵢ and standard deviation σᵢ' } },
      'where $n$ is the codings’ dimension, and $\\mu_i$ and $\\sigma_i$ are the $i^{\\text{th}}$ components of $\\boldsymbol{\\mu}$ and $\\boldsymbol{\\sigma}$.',
      'A common tweak adopted in practice is to make the encoder output $\\boldsymbol{\\gamma}$, defined as $\\log(\\boldsymbol{\\sigma}^2)$, rather than $\\boldsymbol{\\sigma}$. This makes the algorithm **more numerically stable** and the **training faster**. The latent loss becomes:',
      { eq: { name: 'Latent loss, the tweaked form (slide 12)', tex: '\\mathscr{L} = -\\frac{1}{2}\\sum_{i=1}^{n}\\left[1 + \\gamma_i - \\exp\\left(\\gamma_i\\right) - \\mu_i^2\\right]', read: 'the same loss: log(σᵢ²) is γᵢ, and σᵢ² is exp(γᵢ)' } },
      'So the loss of a VAE has **two parts** (slide 13):',
      {
        list: [
          'the usual **reconstruction loss**, which pushes the autoencoder to reproduce its inputs;',
          'the **latent loss**, which pushes the autoencoder to have codings that look as though they were sampled from a **simple Gaussian distribution**. It is the **Kullback-Leibler divergence** between the target distribution (the Gaussian) and the actual distribution of the codings, and gives the formula[^3] for $\\mathscr{L}$ above.',
        ],
      },
      'Slide 13 adds that we will see later how the latent loss is added to the total loss: that is the `Sampling` layer in [§5](#s05).',
      { note: 'Each dimension’s term is zero when $\\mu_i = 0$ and $\\sigma_i = 1$ (so $\\gamma_i = 0$): 1 + 0 − 1 − 0 = 0. Anywhere else it is positive, because log(σ²) ≤ σ² − 1, with equality only at σ = 1. So the latent loss is smallest, at 0, when every coding dimension has mean 0 and standard deviation 1. The lab below shows it.', label: 'This page’s working, beyond the slides' },
    ],
    play: ['latentLoss'],
  },

  /* ── §5 ─────────────────────────────────────────────────────────────── */
  {
    id: 's05',
    no: '5',
    title: 'Implementing a VAE in Keras',
    short: 'Keras: the VAE',
    slides: '14–15',
    read: [
      'Slide 14 notes that there are **quite a few changes to Géron’s code**: check the lines marked `# ***`. The listing has three parts.',
      '**A custom layer, `Sampling`.** Its `call` receives `mean, logvar`: the codings’ μ and γ. It does two jobs:',
      {
        list: [
          'It **adds the latent loss**. `loss = -0.5 * tf.reduce_sum(1 + logvar - tf.exp(logvar) - tf.square(mean), axis=-1)` is slide 12’s γ formula, summed over all the features (the coding dimensions) for each instance. `self.add_loss(tf.reduce_mean(loss) / 784.)` averages it over the instances in the minibatch and divides by **784 = 28 × 28, the output image dimension** (both are the slide’s comments).',
          'It **samples a coding**: `return tf.random.normal(tf.shape(logvar)) * tf.exp(logvar / 2) + mean`. A standard normal sample (one number per dimension) times $\\exp(\\gamma/2)$, plus μ. Since $\\gamma = \\log(\\sigma^2)$, $\\exp(\\gamma/2) = \\sigma$: this is Figure 17-11’s noise × σ + μ.',
        ],
      },
      '**The encoder.** `inputs` (28 × 28) → `Flatten()` → `Dense(150, activation="relu")` → `Dense(100, activation="relu")`, then two separate `Dense(codings_size)` layers on the same input: `codings_mean` (# mu) and `codings_log_var` (# gamma). `codings = Sampling()([codings_mean, codings_log_var])`, and `variational_encoder` outputs all three: `[codings_mean, codings_log_var, codings]`.',
      '**The decoder.** `decoder_inputs` (`codings_size` numbers) → `Dense(100, activation="relu")` → `Dense(150, activation="relu")` → `Dense(28 * 28)` → `Reshape([28, 28])`: `variational_decoder`.',
      { unfold: { label: 'Slide 14 · Sampling, the encoder and the decoder (verbatim)', blocks: [{ code: { src: 'VAE_PARTS', label: 'slide 14' } }] } },
      'Slide 15 joins them: `_, _, codings = variational_encoder(inputs)` keeps only the sampled codings, `reconstructions = variational_decoder(codings)`, and `variational_ae` maps the inputs to the reconstructions. It is compiled with `loss="mse"` and `optimizer="nadam"`, “to minimize the total loss (latent loss + reconstruction loss)”: the MSE is the reconstruction loss, and the latent loss arrives through `add_loss`. It trains for **25 epochs** with **`batch_size=128`**.',
      { code: { src: 'VAE_FIT', label: 'slide 15' } },
      'Slide 15’s exercise: run `variational_encoder.summary()` and `variational_decoder.summary()` and inspect the layers. With 10 codings, this page’s working gives the encoder 117,750 + 15,100 + 1,010 + 1,010 = **134,870** parameters and the decoder 1,100 + 15,150 + 118,384 = **134,634**; the lab below lays them out layer by layer.',
      { slideNote: 'The VAE’s `codings_size` is never set on slides 14–18. Slide 16 says “the codings are only 10-dimensional”, so this page uses 10. (`codings_size = 30` on slide 23 is the GAN’s, and `codings_size = 100` on slide 29 the DCGAN’s.)' },
      { note: 'Why divide by 784? `loss="mse"` averages the squared error over the 784 pixels, so it is a per-pixel number; the latent loss is summed over the codings. Dividing it by 784 keeps it in proportion to the per-pixel MSE. The slide only says that 784 = 28 × 28 is the output image dimension.', label: 'This page’s reasoning, not the slides’' },
    ],
    play: ['vaeCode'],
  },

  /* ── §6 ─────────────────────────────────────────────────────────────── */
  {
    id: 's06',
    no: '6',
    title: 'Generating images and semantic interpolation',
    short: 'Generate & interpolate',
    slides: '16–18',
    read: [
      'After training, we can **generate Fashion MNIST images** (slide 16): draw `3 * 7` codings from the normal distribution with `tf.random.normal`, and decode them with `variational_decoder`. The result has shape (21, 28, 28).',
      { code: { src: 'VAE_GENERATE', label: 'slide 16' } },
      'Figure 17-12 shows the 21 images in 3 rows of 7. The majority look **fairly convincing, if a bit too fuzzy**. The rest are not great, but the codings are **only 10-dimensional** and the VAE was trained **only for 25 epochs**.',
      'Variational autoencoders also make **semantic interpolation** possible (slide 17). Instead of interpolating two images at the **pixel level**, which would look as if the two images were **overlaid**, we interpolate at the **codings level**:',
      {
        ordered: true,
        list: [
          'run both images through the encoder to get their codings,',
          'interpolate the two codings,',
          'decode the interpolated codings to get the final image.',
        ],
      },
      'We can also replace step 1 by directly **drawing random samples from the normal distribution** to get the two codings.',
      'Slide 18 does just that: it draws 2 codings from the normal distribution, linearly interpolates **10** codings between them with `np.linspace(codings[0], codings[1], 10)`, and decodes the 10. The images gradually go from a **T-shirt** to a **Sneaker**.',
      { code: { src: 'VAE_INTERP', label: 'slide 18' } },
    ],
    play: ['generate', 'interp'],
  },

  /* ── §7 ─────────────────────────────────────────────────────────────── */
  {
    id: 's07',
    no: '7',
    title: 'GANs: generator and discriminator',
    short: 'GANs: the two networks',
    slides: '19–20',
    read: [
      '**Generative adversarial networks** (GANs) were proposed in 2014 by Ian Goodfellow et al.[^4] (slide 19). The idea got researchers excited almost instantly, but it took a few years to overcome some of the difficulties of training GANs.',
      'Like many great ideas, it seems simple in hindsight: **make neural networks compete against each other**, in the hope that this competition will push them to excel. As Figure 17-14 shows, a GAN is composed of two neural networks: a **generator** and a **discriminator**.',
      'Figure 17-14, bottom to top: **Noise** goes into the **Generator** (“Goal = trick the discriminator”), which outputs a **Fake** image. Either the fake image **or** a **Real** one goes into the **Discriminator** (“Goal = tell fake from real”), which outputs **Fake/real**.',
      'The two networks (slide 20):',
      {
        list: [
          '**Generator.** It takes a **random distribution** (typically a Gaussian) as input and outputs some data (typically an image). You can think of the random inputs as the **latent representations** (the **codings**) of the image to be generated. So the generator offers the **same functionality as a decoder in a VAE**, and it can be used in the same way to generate new images: just feed it some Gaussian noise, and it outputs a new image.',
          '**Discriminator.** It takes **either a fake image from the generator or a real image from the training set** as input, and must **guess whether the input image is fake or real**.',
        ],
      },
    ],
    play: ['ganRoles'],
  },

  /* ── §8 ─────────────────────────────────────────────────────────────── */
  {
    id: 's08',
    no: '8',
    title: 'Training a GAN: two phases per iteration',
    short: 'Two training phases',
    slides: '21–22',
    read: [
      'During training, the generator and the discriminator have **opposite goals**: the discriminator tries to **distinguish fake images from real images**, while the generator tries to produce images that look **real enough to trick the discriminator** (slide 21).',
      'Because the GAN is composed of two networks with different objectives, it **cannot be trained like a regular neural network**. Each training iteration is divided into **two phases**:',
      {
        list: [
          '**Phase 1: training the discriminator.** A batch of **real images** is sampled from the training set and completed with an **equal number of fake images** produced by the generator. The labels are set to **0 for fake** images and **1 for real** images. The discriminator is trained on this labelled batch for **one step**, using the **binary cross-entropy loss**. Backpropagation **only optimizes the weights of the discriminator** during this phase.',
          '**Phase 2: training the generator** (slide 22). The generator produces **another batch of fake images**, and once again the discriminator tells whether the images are fake or real. This time **no real images** are added, and **all the labels are set to 1** (real): we want the generator to produce images that the discriminator will (wrongly) believe to be real. The **discriminator’s weights are frozen** during this step, so backpropagation **only affects the weights of the generator**.',
        ],
      },
      { note: 'In phase 2 the generator is trained *through* the discriminator: the loss is how far the discriminator’s output is from “real” (1), and only the generator’s weights move to reduce it. The lab below runs both phases on this page’s toy GAN, which is built to follow that rule, and shows which weights moved. [§9](#s09) makes the same measurement on the slides’ own Keras code, where it depends on the `trainable` lines.', label: 'This page’s reading of slides 21–22' },
    ],
    play: ['phaseStepper'],
  },

  /* ── §9 ─────────────────────────────────────────────────────────────── */
  {
    id: 's09',
    no: '9',
    title: 'Implementing a GAN in Keras',
    short: 'Keras: the GAN',
    slides: '23–25',
    read: [
      'Slide 23 builds a GAN for **Fashion MNIST**. The **generator is similar to an autoencoder’s decoder**, and the **discriminator is a regular binary classifier**.',
      {
        list: [
          '`codings_size = 30`. The `generator` is `Dense(100)` and `Dense(150)`, both `activation="relu"` with `kernel_initializer="he_normal"`, then `Dense(28 * 28, activation="sigmoid")` and `Reshape([28, 28])`.',
          'The `discriminator` is `Flatten()`, `Dense(150)` and `Dense(100)` (ReLU, He initialization), then `Dense(1, activation="sigmoid")`: one probability.',
          '`gan = tf.keras.Sequential([generator, discriminator])`: noise in, the discriminator’s verdict on the generated image out.',
        ],
      },
      { unfold: { label: 'Slide 23 · the generator, the discriminator and gan (verbatim)', blocks: [{ code: { src: 'GAN_BUILD', label: 'slide 23' } }] } },
      'Slide 24 compiles both `discriminator` and `gan` with `loss="binary_crossentropy"` and `optimizer="rmsprop"`, and makes a `tf.data.Dataset` of the training images: `batch_size = 32`, `shuffle(1000)`, `batch(batch_size, drop_remainder=True)` and `prefetch(1)`.',
      { code: { src: 'GAN_COMPILE', label: 'slide 24' } },
      { unfold: { label: 'Slide 24 · the tf.data pipeline (verbatim)', blocks: [{ code: { src: 'GAN_DATASET', label: 'slide 24' } }] } },
      'Since the training loop is unusual, we **cannot use the regular `fit()` method**: we write a **custom training loop** instead. There are **two training phases in each iteration**. In slide 25’s `train_gan`, for every batch `X_batch`:',
      {
        list: [
          '**Phase 1**: `noise` of shape `[batch_size, codings_size]` goes through the `generator` to give `generated_images`; `X_fake_and_real` concatenates them with `X_batch`; `y1` is `[[0.]] * batch_size + [[1.]] * batch_size` (fake first, then real); `discriminator.trainable = True`; `discriminator.train_on_batch(X_fake_and_real, y1)`.',
          '**Phase 2**: new `noise`; `y2` is `[[1.]] * batch_size`; `discriminator.trainable = False`, so that “training gan will result in training the generator only”; `gan.train_on_batch(noise, y2)`.',
          'The loop is run with `train_gan(gan, dataset, batch_size, codings_size, n_epochs=50)`.',
        ],
      },
      { unfold: { label: 'Slide 25 · train_gan (verbatim)', blocks: [{ code: { src: 'GAN_TRAIN', label: 'slide 25' } }] } },
      'Both `trainable` lines are marked `# *** this line is missing in the author’s code`. **`train_on_batch`** is a method of the `tf.keras.Model` class: it runs a **single gradient update on a single batch** of data (slide 25’s note, which points to `https://www.tensorflow.org/api_docs/python/tf/keras/Model#train_on_batch` for details).',
      { note: 'This page ran slides 23–25 with TensorFlow 2.21 (Keras 3.15.1) and measured which weights each phase changed. As printed, phase 1 changed only the discriminator’s weights and phase 2 only the generator’s. With the two `# ***` lines removed, phase 2 changed the discriminator’s weights as well. Keras 3.15.1 reads `trainable` the first time a model’s `train_on_batch` runs and then keeps that setting, so what counts is the flag at those first calls; in slide 25’s loop it is already right. The first lab below shows the numbers.', label: 'What this page’s TensorFlow run observed' },
    ],
    play: ['ganCode', 'toyGan'],
  },

  /* ── §10 ────────────────────────────────────────────────────────────── */
  {
    id: 's10',
    no: '10',
    title: 'GAN results and the difficulties of training',
    short: 'Results & difficulties',
    slides: '26–27',
    read: [
      '**Visualising some generated images** (slide 26). At the end of the **first epoch**, the generated images already start to look like (**very noisy**) Fashion MNIST images: Figure 17-15 shows 32 of them, after one epoch of training.',
      'Unfortunately, the images **never really get much better** than that, and you may even find epochs where the GAN seems to be **forgetting what it learned**. Training a GAN can be challenging. Slide 27 lists the difficulties:',
      {
        list: [
          '**Nash equilibrium.** As training advances, the game may end up in a state that game theorists call a **Nash equilibrium**: when no player would be better off changing their own strategy, assuming the other players do not change theirs. The authors of the paper demonstrated that a GAN can only reach a **single** Nash equilibrium; however, **nothing guarantees that the equilibrium will ever be reached**.',
          '**Mode collapse**, the biggest difficulty: the generator’s outputs gradually become **less diverse**, only producing images in a **specific class**.',
          '**Oscillation.** Because the generator and the discriminator are constantly pushing against each other, their **parameters may end up oscillating and becoming unstable**.',
        ],
      },
      'In short, this is still a very active field of research, and the dynamics of GANs are still not perfectly understood. The good news is that great progress has been made, and some of the results are truly astounding.',
    ],
    play: ['ganSamples', 'collapse'],
  },

  /* ── §11 ────────────────────────────────────────────────────────────── */
  {
    id: 's11',
    no: '11',
    title: 'Deep convolutional GANs (DCGANs)',
    short: 'DCGANs',
    slides: '28–30',
    read: [
      'In the architecture of **Deep Convolutional GANs**[^5] (**DCGANs**), the authors proposed these guidelines for building **stable convolutional GANs** (slide 28):',
      {
        list: [
          'Replace any **pooling layers** with **strided convolutions** (in the discriminator) and **transposed convolutions** (in the generator).',
          'Use **Batch Normalization** in both the generator and the discriminator, except in the generator’s output layer and the discriminator’s input layer.',
          'Remove **fully connected hidden layers** for deeper architectures.',
          'Use **ReLU** activation in the generator for all layers except the output layer, which should use **tanh**.',
          'Use **leaky ReLU** activation in the discriminator for all layers.',
        ],
      },
      'These guidelines will work in many cases, **but not always**.',
      'Slide 29 implements a DCGAN with `codings_size = 100`:',
      {
        list: [
          'The `generator`: `Dense(7 * 7 * 128)`, `Reshape([7, 7, 128])`, `BatchNormalization()`, `Conv2DTranspose(64, kernel_size=5, strides=2, padding="same", activation="relu")`, `BatchNormalization()`, and `Conv2DTranspose(1, kernel_size=5, strides=2, padding="same", activation="tanh")`. This page’s working: 100 → 6,272 → 7 × 7 × 128 → 14 × 14 × 64 → 28 × 28 × 1.',
          'The `discriminator`: `Conv2D(64, kernel_size=5, strides=2, padding="same", activation=tf.keras.layers.LeakyReLU(0.2))`, `Dropout(0.4)`, the same with 128 filters, `Dropout(0.4)`, `Flatten()` and `Dense(1, activation="sigmoid")`. This page’s working: 28 × 28 × 1 → 14 × 14 × 64 → 7 × 7 × 128 → 6,272 → 1.',
          '“Compilation and training are similar to the code for GANs.”',
        ],
      },
      { unfold: { label: 'Slide 29 · the DCGAN (verbatim)', blocks: [{ code: { src: 'DCGAN', label: 'slide 29' } }] } },
      { slideNote: 'Slide 29’s code doesn’t follow every guideline on slide 28. The discriminator has **no Batch Normalization**: it uses `Dropout(0.4)` after each `Conv2D` instead. The generator **starts with a fully connected layer**, `Dense(7 * 7 * 128)`, which has **no activation** rather than ReLU. The discriminator’s last layer uses **sigmoid**, not leaky ReLU (it outputs a probability). Slide 28 itself says the guidelines work “in many cases, but not always”. The lab below goes through them one by one.' },
      { slideNote: 'The DCGAN’s generator ends in **tanh**, whose outputs lie in [−1, 1], while slide 23’s GAN generator ends in **sigmoid**, in [0, 1]. Its output is 28 × 28 × 1, with no final `Reshape`. The slides show no rescaling or reshaping of the training images for either range; slide 29 only says training is similar.' },
      '**Visualising some generated images** (slide 30). Figure 17-16 shows 32 images generated by the DCGAN **after 50 epochs** of training. They still do not look perfect; however, if the architecture is **scaled up** and trained on a **large dataset of faces**, one can generate fairly realistic face images.',
    ],
    play: ['dcgan', 'dcganSamples'],
  },

  /* ── §12 ────────────────────────────────────────────────────────────── */
  {
    id: 's12',
    no: '12',
    title: 'Summary and what’s next',
    short: 'Summary',
    slides: '31–32',
    read: [
      'Slide 31 sums the lecture up as five outcomes, one for each of slide 3’s topics:',
      {
        list: [
          'Understand **convolutional autoencoders**.',
          'Understand **denoising autoencoders**.',
          'Understand **variational autoencoders**.',
          'Understand **generative adversarial networks**.',
          'Understand **deep convolutional generative adversarial networks**.',
        ],
      },
      'Semantic interpolation ([§6](#s06)) is in neither list, but it is part of the variational autoencoder slides (17–18).',
      '**For the next topic** (slide 32): read up to Chapter 16 on *Natural Language Processing with RNNs and Attention* (roughly from pages 595 to 629). And that’s all for this lecture. Have a good week.',
    ],
    play: ['outcomes'],
  },
];
