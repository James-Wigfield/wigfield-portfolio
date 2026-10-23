/* ============================================================================
   LATENT SURFER — CONTENT (pure data, slide-cited)
   ----------------------------------------------------------------------------
   Lectures 6–7, slides 10–18 (Documents/cits5017/lectures/
   cits5017-lect06-07-AE-conv-var-GAN.pdf). Every item carries
   src: { lecture: 6, slides } (6 = the shared Lectures 6–7 deck).

     UI, INTRO, LEVEL_NAMES   copy for the stage (no facts)
     ROUNDS                   the item types per level, in ramp order
     FIND                     "find a sneaker" in a 2D slice of this page's VAE
     SAMPLING                 slide 14's Sampling: μ + exp(γ/2) · noise
     INTERP                   semantic interpolation (slides 17–18)
     LOSS                     slide 12's latent loss, γ form
     FACTS                    term / sign / wiring questions (choices)

   Templates use %name% placeholders, filled by maths/latentSurfer.js
   (`fill`), so KaTeX braces never clash with them. Plain-text twins
   (`text`, `promptText`) feed the why cards, which do not render KaTeX in
   the you / answer row.

   Notation: μ, σ, γ = log(σ²) and ℒ as on slide 12; coding dimensions are
   numbered i = 1 … n as slide 12 numbers them. ε is this game's name for one
   draw of the Gaussian noise (Figure 17-11 "Gaussian noise", slide 14
   tf.random.normal(tf.shape(logvar))): the slides give that draw no symbol.
   "This page's own run" = the VAE that the Lectures 6–7 study page trained
   from slides 14–15's code (lecture6-7-study/data/vae.js), not the slides'
   figures.
   ========================================================================== */

export const LECTURE = 6;

export const UI = {
  own: 'this page’s own run',
  loading: 'loading this page’s own VAE decoder (int8 weights, about 228 KB)…',
  failed: 'This page’s VAE decoder did not load. Leave and try again.',
  lockIn: 'Lock in',
  lockKey: 'Enter',
  yours: 'your decode',
  target: 'target',
  mse: 'MSE to target',
  mseNeed: 'right at ≤ %tau%',
  heat: 'latent loss ℒ',
  heatFind: 'ℒ of your μ with the target’s γ (this page’s run)',
  map: 'the 2D slice, decoded',
  sliderLabel: 'μ%d% (coding dimension %d% of 10)',
  noiseLabel: 'Gaussian noise',
  codingsOut: 'codings',
  sigmaBox: 'Codings σ',
  muBox: 'Codings μ',
  muVal: 'μ = %v%',
  sigmaUnknown: 'σ = exp(γ/2) = ?',
  sigmaVal: 'σ = exp(γ/2) = %v%',
  noiseVal: 'ε = %v%',
  outUnknown: '?',
  gammaLine: 'γ = log %var% ≈ %g%  (codings_log_var, # gamma)',
  lineMu: 'μ',
  lineZ: 'codings',
  lineAria: 'Number line: where the sampled coding lands.',
  bellLabel: 'dimension %i%: μ = %mu%, σ² = exp(γ) = %var%',
  targetCaption: 'target · X_valid[%idx%] · %cls%',
  stripCaption: 'decoded by this page’s VAE decoder',
  choicesCaption: 'every image: decoded (or overlaid) by this page’s VAE',
  imageAria: 'image %v%',
  back: 'arcade',
  slot: 'images[%k%]',
  pick: 'Pick the image',
  reveal: 'the 10 decoded codings',
  bellTarget: 'the target Gaussian, drawn as N(0, 1)',
  bellCoding: 'N(μ, σ²) of this dimension',
  meterUnknown: '?',
  dimRow: 'dimension %i%',
  you: 'you',
  ends: ['codings[0]', 'codings[1]'],
  midSlot: 'midpoint',
  mapAria: 'Map of the slice: decoded images on a grid over μ%a% (across) and μ%b% (up). Tap to jump there.',
  diagramAria: 'Figure 17-11’s sampling wiring: Codings σ times the Gaussian noise, plus Codings μ, gives the codings.',
  bellsAria: 'The coding distribution of each dimension drawn against the standard Gaussian.',
  heatAria: 'Latent loss heat meter',
};

export const INTRO = {
  line: 'Surf the latent space of this page’s own trained VAE.',
  controls: [
    'Find: drag the two sliders (or tap the map) until your decode matches the target; arrow keys steer, Enter locks in.',
    'Sampling and latent loss: type the number on the keypad (digits, . and −, Enter).',
    'Interpolation and the formula questions: tap a choice or press 1–4.',
  ],
};

export const LEVEL_NAMES = ['find a sneaker · sample', 'interpolate · γ-form loss', 'two-dimension loss · no map'];

// item types per level, in ramp order (the round's difficulty climbs)
export const ROUNDS = {
  1: ['find', 'sample', 'fact', 'mid', 'sample', 'loss', 'fact'],
  2: ['find', 'sample', 'slot', 'loss', 'fact', 'interpT', 'sample', 'loss'],
  3: ['sample', 'loss', 'slot', 'find', 'fact', 'loss', 'sample', 'fact'],
};

/* ── 1. Find a sneaker ──────────────────────────────────────────────────── */
export const FIND = {
  concept: 'vae.latentSpace',
  src: { lecture: 6, slides: [12, 15, 16] },
  // X_valid indices (this page's 12 labelled items) used as targets, per level.
  // X_valid[3] (labelled Shirt) and X_valid[9] (Bag) are left out: their
  // decodes are the least like their labels.
  targets: { 1: [8, 11], 2: [8, 11, 1, 2, 4, 6, 7], 3: [8, 11, 1, 2, 4, 6, 7, 10] },
  // the start point's two values come from an item of another class
  starts: [0, 1, 2, 4, 5, 6, 7, 8, 10, 11],
  range: [-3, 3],
  step: 0.05,
  // MSE threshold on the displayed pixels (0–1), per level
  tau: { 1: 0.006, 2: 0.004, 3: 0.003 },
  // tiles per side of the decoded map of the slice; 0 = no map
  tiles: { 1: 7, 2: 7, 3: 0 },
  // a start this close to the target would be no search at all
  minStartMse: 0.05,
  article: { Sneaker: 'a sneaker', Bag: 'a bag', 'T-shirt/top': 'a T-shirt/top', Sandal: 'a sandal', Coat: 'a coat', Shirt: 'a shirt', Pullover: 'a pullover', Dress: 'a dress', Trouser: 'a trouser', 'Ankle boot': 'an ankle boot' },
  prompt: 'Find %what%: steer until your decode matches the target.',
  held: 'You steer μ%a% and μ%b%: 2 of the 10 coding dimensions. The other 8 are held at the target’s μ, and the decoder is fed μ itself (no noise).',
  why: 'Right when the mean squared error between your decoded image and the target’s is at most %tau% (displayed pixels, 0 to 1; MSE is the reconstruction loss slide 15 compiles with, loss="mse"). The target is this page’s decoder applied to the mean coding μ that this page’s encoder gives X_valid[%idx%], a %cls%: $\\mu_{%a%} = %ta%$, $\\mu_{%b%} = %tb%$.',
  answerText: 'μ%a% = %va%, μ%b% = %vb%',
};

/* ── 2. Sampling (slides 11, 12, 14) ────────────────────────────────────── */
export const SAMPLING = {
  concept: 'vae.sampling',
  src: { lecture: 6, slides: [11, 12, 14] },
  // σ² (so γ = log σ² and σ = √σ² are mental arithmetic), μ and ε per level
  levels: {
    1: { variance: [4, 9], mu: [0, 1, -1], eps: [1, 2, -1, 0.5] },
    2: { variance: [4, 9, 0.25, 16], mu: [0.5, -0.5, 1, -2, 1.5], eps: [-1.5, 1.5, -2, 0.5, -0.5] },
    3: { variance: [0.25, 0.04, 2.25, 6.25, 0.36], mu: [0.3, -1.2, 2.4, -0.7], eps: [-1.2, 0.4, 2.5, -0.8] },
  },
  tol: 0.01,
  prompt: 'One coding dimension: μ = %mu%, γ = log %var% ≈ %g%, noise ε = %eps%. Which coding does the Sampling layer return?',
  why: 'Figure 17-11 wires codings = μ + σ × Gaussian noise, and γ = log(σ²) (slide 12) makes σ = exp(γ/2), which is slide 14’s tf.exp(logvar / 2): $%mu% + \\exp(%g%/2)\\cdot(%eps%) = %mu% + %sig%\\cdot(%eps%) = %z%$. exp(γ) = %var% is σ², the variance.',
  traps: {
    variance: 'That is μ + exp(γ)·ε: exp(γ) = σ² is the variance. The noise is scaled by exp(γ/2) = σ.',
    noMu: 'That is σ·ε alone: Figure 17-11 then adds Codings μ.',
    halfGamma: 'That uses γ/2 itself as the scale; the scale is exp(γ/2).',
  },
  draw: 'ε here is one draw of the Gaussian noise (Figure 17-11), i.e. of tf.random.normal(tf.shape(logvar)) on slide 14; the slides give it no symbol.',
};

/* ── 3. Semantic interpolation (slides 17, 18) ──────────────────────────── */
export const INTERP = {
  concept: 'vae.interpolation',
  src: { lecture: 6, slides: [17, 18] },
  n: 10, // slide 18: np.linspace(codings[0], codings[1], 10)
  // the two codings: μ of two X_valid items from this page's encoder (slide 17
  // step 1), or this page's run of slide 18's two tf.random.normal codings
  // (slide 17: step 1 can be replaced by random samples from the normal
  // distribution)
  pairs: [
    { from: 'items', a: 0, b: 8 }, { from: 'items', a: 2, b: 11 }, { from: 'items', a: 6, b: 8 },
    { from: 'items', a: 1, b: 7 }, { from: 'items', a: 5, b: 4 }, { from: 'items', a: 10, b: 11 },
    { from: 'items', a: 0, b: 1 }, { from: 'items', a: 7, b: 11 }, { from: 'slide18' },
  ],
  pairText: { items: 'μ (codings_mean, no noise) of X_valid[%a%] (%ca%) and X_valid[%b%] (%cb%) from this page’s encoder', slide18: 'this page’s run of slide 18’s two tf.random.normal codings' },
  slots: { 2: [2, 3, 6, 7], 3: [1, 2, 3, 6, 7, 8] },
  // two decoded choices closer than this (pixel MSE) would look alike
  minApart: 0.02,
  promptMid: 'Semantic interpolation: which image is the coding halfway between codings[0] and codings[1], decoded?',
  promptSlot: 'inter_codings = np.linspace(codings[0], codings[1], 10). Which image is images[%k%]?',
  promptT: 'inter_codings = np.linspace(codings[0], codings[1], 10). images[%k%] decodes codings[0] + t · (codings[1] − codings[0]) with t =',
  code: 'inter_codings = np.linspace(codings[0], codings[1], 10)',
  steps: 'Slide 17: (1) run both images through the encoder to get their codings, (2) interpolate the two codings, (3) decode the interpolated codings to get the final image.',
  general: 'Each interpolated coding is $\\text{codings[0]} + t\\,(\\text{codings[1]} - \\text{codings[0]})$ for some $t$ from 0 to 1, decoded by variational_decoder.',
  // what each choice was (revealed after the pick)
  kinds: {
    decode: 'decoded coding at t = %t%',
    overlay: 'the two images overlaid at the pixel level',
    reversed: 'decoded coding at t = %t% (counted from the wrong end)',
    near: 'decoded coding at t = %t%',
  },
  whyMid: 'Slide 17: semantic interpolation interpolates the two codings and decodes the result; interpolating at the pixel level instead would look as if the two images were overlaid. The midpoint coding is $\\tfrac{1}{2}(\\text{codings[0]} + \\text{codings[1]})$, decoded by this page’s decoder.',
  // slot and interpT items lean on linspace's endpoint=True default: beyond the slides
  beyondNote: 'NumPy’s np.linspace includes both ends by default (endpoint=True); slide 18 only says “linearly interpolate 10 elements from the 2 codings”.',
  whySlot: 'np.linspace(codings[0], codings[1], 10) returns 10 evenly spaced codings, and NumPy includes both ends by default (endpoint=True; slide 18 does not say so, but it is consistent with slide 18’s strip going from T-shirt to Sneaker), so images[%k%] decodes $\\text{codings[0]} + \\tfrac{%k%}{9}(\\text{codings[1]} - \\text{codings[0]})$. Overlaying pixels is what slide 17 says semantic interpolation avoids.',
  whyT: 'np.linspace(codings[0], codings[1], 10) puts 10 evenly spaced codings from codings[0] to codings[1], both ends included by NumPy’s default (endpoint=True; slide 18 does not say so, but it is consistent with slide 18’s strip going from T-shirt to Sneaker), so the steps are 1/9 apart and images[%k%] sits at $t = \\tfrac{%k%}{9}$, not $\\tfrac{%k%}{10}$.',
};

/* ── 4. Latent loss, γ form (slide 12) ──────────────────────────────────── */
export const LOSS = {
  concept: 'vae.latentLoss',
  conceptGamma: 'vae.gamma',
  src: { lecture: 6, slides: [12] },
  levels: {
    1: { n: 1, variance: [1], mu: [1, -1, 2, -2, 3] },
    2: { n: 1, variance: [4, 0.25, 9], mu: [0, 1, -1, 0.5] },
    3: { n: 2, variance: [1, 4, 0.25], mu: [0, 1, -1, 2] },
  },
  tol: { 1: 0.01, 2: 0.015, 3: 0.02 },
  prompt1: 'n = 1: μ₁ = %mu1%, γ₁ = log %var1% ≈ %g1%. What is the latent loss ℒ?',
  prompt2: 'n = 2: μ₁ = %mu1%, γ₁ = log %var1% ≈ %g1%; μ₂ = %mu2%, γ₂ = log %var2% ≈ %g2%. What is the latent loss ℒ?',
  why: 'Slide 12, γ form: $\\mathscr{L} = -\\tfrac{1}{2}\\sum_{i=1}^{n}\\left[1 + \\gamma_i - \\exp(\\gamma_i) - \\mu_i^2\\right]$, with $\\exp(\\gamma_i) = \\sigma_i^2$: %sub% $= %L%$.',
  traps: {
    noHalf: 'That is the bracket summed without the −½ in front.',
    sign: 'That has the sign flipped: the −½ multiplies the whole sum.',
    muSign: 'That adds μᵢ²; inside the bracket μᵢ² is subtracted.',
  },
  // the heat meter's full scale (ℒ units)
  meterMax: 6,
  // the dashed bell under each loss question
  bellsNote: {
    text: 'Beyond the slides: the dashed curve is drawn as N(0, 1). Slide 13 calls the target “the Gaussian distribution” without giving its parameters; mean 0 and variance 1 is where each term of slide 12’s ℒ is 0, and slide 16 samples new codings with tf.random.normal.',
    beyond: true,
    note: 'A picture label, not a graded claim: the loss questions themselves use only slide 12’s formula.',
    src: { lecture: 6, slides: [12, 13, 16] },
  },
};

/* ── 5. Term, sign and wiring questions ─────────────────────────────────── */
// choices: the right one first (maths shuffles); `label` may hold $…$ KaTeX,
// `text` is the plain twin for the why card, `aria` for screen readers.
// `eq` names the lecture67.js EQUATIONS entry shown above the question; it
// frames the question and never contains its answer.
export const FACTS = [
  {
    id: 'gammaDef', level: 1, concept: 'vae.gamma', src: { lecture: 6, slides: [12, 14] }, eq: 'vaeLatentLossSigma',
    prompt: 'Slide 12’s tweak: the encoder outputs γ rather than σ. γ is defined as…',
    choices: [
      { label: '$\\log(\\sigma^2)$', text: 'log(σ²)', aria: 'log of sigma squared' },
      { label: '$\\log(\\sigma)$', text: 'log(σ)', aria: 'log of sigma' },
      { label: '$\\sigma^2$', text: 'σ²', aria: 'sigma squared' },
      { label: '$\\exp(\\sigma)$', text: 'exp(σ)', aria: 'exp of sigma' },
    ],
    why: 'Slide 12: the encoder outputs γ (defined as log(σ²)) rather than σ. So γ is a log variance, which is why slide 14 names the head codings_log_var (# gamma) and the Sampling layer calls it logvar.',
  },
  {
    id: 'scale', level: 1, concept: 'vae.sampling', src: { lecture: 6, slides: [11, 12, 14] }, eq: null,
    prompt: 'Slide 14’s Sampling layer returns tf.random.normal(tf.shape(logvar)) * ▢ + mean. What is ▢?',
    choices: [
      { label: '`tf.exp(logvar / 2)`', text: 'tf.exp(logvar / 2)' },
      { label: '`tf.exp(logvar)`', text: 'tf.exp(logvar)' },
      { label: '`logvar / 2`', text: 'logvar / 2' },
      { label: '`tf.square(logvar)`', text: 'tf.square(logvar)' },
    ],
    why: 'Slide 14 returns tf.random.normal(tf.shape(logvar)) * tf.exp(logvar / 2) + mean. With γ = log(σ²) (slide 12), $\\exp(\\gamma/2) = \\sigma$, so this is Figure 17-11’s σ × noise + μ; tf.exp(logvar) would be σ², the variance.',
  },
  {
    id: 'wiring', level: 1, concept: 'vae.sampling', src: { lecture: 6, slides: [11] }, eq: null,
    prompt: 'Figure 17-11 (slide 11): the Gaussian noise is…',
    choices: [
      { label: 'multiplied by Codings σ, then Codings μ is added', text: 'multiplied by Codings σ, then Codings μ is added' },
      { label: 'multiplied by Codings μ, then Codings σ is added', text: 'multiplied by Codings μ, then Codings σ is added' },
      { label: 'added to Codings σ and to Codings μ', text: 'added to Codings σ and to Codings μ' },
      { label: 'fed straight into Hidden 4', text: 'fed straight into Hidden 4' },
    ],
    why: 'In Figure 17-11 Codings σ and the Gaussian noise meet at ×, and the product meets Codings μ at +; that sum feeds Hidden 4 (slide 12 calls the decoder layers Hidden 3 and Hidden 4).',
  },
  {
    id: 'outputs', level: 1, concept: 'vae.encoderOutputs', src: { lecture: 6, slides: [11] }, eq: null,
    prompt: 'Instead of a lower dimensional representation of the inputs, a VAE’s encoder learns…',
    choices: [
      { label: 'a mean coding μ and a standard deviation coding σ', text: 'a mean coding μ and a standard deviation coding σ' },
      { label: 'one coding and its reconstruction', text: 'one coding and its reconstruction' },
      { label: 'a mean coding μ only', text: 'a mean coding μ only' },
      { label: 'the pixel mean and the pixel variance', text: 'the pixel mean and the pixel variance' },
    ],
    why: 'Slide 11: the encoder learns a mean coding μ and a standard deviation coding σ; the decoder then draws samples from this distribution to reconstruct the inputs.',
  },
  {
    id: 'codingsLevel', level: 1, concept: 'vae.interpolation', src: { lecture: 6, slides: [17] }, eq: null,
    prompt: 'Semantic interpolation with a VAE interpolates…',
    choices: [
      { label: 'the two codings, then decodes them', text: 'the two codings, then decodes them' },
      { label: 'the two images’ pixels', text: 'the two images’ pixels' },
      { label: 'the encoder’s weights', text: 'the encoder’s weights' },
      { label: 'the two reconstruction losses', text: 'the two reconstruction losses' },
    ],
    why: 'Slide 17: instead of interpolating two images at the pixel level (which would look as if the two images were overlaid), we interpolate at the codings level: encode, interpolate the two codings, decode.',
  },
  {
    id: 'twoParts', level: 1, concept: 'vae.totalLoss', src: { lecture: 6, slides: [13, 15] }, eq: null,
    prompt: 'The loss (or cost) function of a VAE consists of two parts:',
    choices: [
      { label: 'the reconstruction loss and the latent loss', text: 'the reconstruction loss and the latent loss' },
      { label: 'the reconstruction loss and binary cross-entropy', text: 'the reconstruction loss and binary cross-entropy' },
      { label: 'the latent loss and the accuracy', text: 'the latent loss and the accuracy' },
      { label: 'the encoder’s loss and the decoder’s loss', text: 'the encoder’s loss and the decoder’s loss' },
    ],
    why: 'Slide 13: the usual reconstruction loss, which pushes the autoencoder to reproduce its inputs, and the latent loss, which pushes the codings to look sampled from a simple Gaussian. Slide 15 trains to minimise the total (latent loss + reconstruction loss).',
  },
  {
    id: 'gammaTerm', level: 2, concept: 'vae.gamma', src: { lecture: 6, slides: [12] }, eq: 'vaeLatentLossSigma',
    prompt: 'Rewriting the latent loss with γ: which term takes the place of σᵢ²?',
    choices: [
      { label: '$\\exp(\\gamma_i)$', text: 'exp(γᵢ)', aria: 'exp of gamma i' },
      { label: '$\\gamma_i$', text: 'γᵢ', aria: 'gamma i' },
      { label: '$\\exp(\\gamma_i/2)$', text: 'exp(γᵢ/2)', aria: 'exp of gamma i over 2' },
      { label: '$\\gamma_i^2$', text: 'γᵢ²', aria: 'gamma i squared' },
    ],
    why: 'γᵢ = log(σᵢ²), so σᵢ² = exp(γᵢ) and log(σᵢ²) becomes γᵢ. Slide 12: $\\mathscr{L} = -\\tfrac{1}{2}\\sum_{i=1}^{n}[1 + \\gamma_i - \\exp(\\gamma_i) - \\mu_i^2]$.',
  },
  {
    id: 'logTerm', level: 2, concept: 'vae.gamma', src: { lecture: 6, slides: [12] }, eq: 'vaeLatentLossSigma',
    prompt: 'Rewriting the latent loss with γ: which term takes the place of log(σᵢ²)?',
    choices: [
      { label: '$\\gamma_i$', text: 'γᵢ', aria: 'gamma i' },
      { label: '$\\exp(\\gamma_i)$', text: 'exp(γᵢ)', aria: 'exp of gamma i' },
      { label: '$\\gamma_i/2$', text: 'γᵢ/2', aria: 'gamma i over 2' },
      { label: '$\\log(\\gamma_i)$', text: 'log(γᵢ)', aria: 'log of gamma i' },
    ],
    why: 'By definition γ = log(σ²) (slide 12), so log(σᵢ²) is γᵢ itself: $1 + \\log(\\sigma_i^2) - \\sigma_i^2 - \\mu_i^2$ becomes $1 + \\gamma_i - \\exp(\\gamma_i) - \\mu_i^2$.',
  },
  {
    id: 'half', level: 2, concept: 'vae.latentLoss', src: { lecture: 6, slides: [12, 14] }, eq: null,
    prompt: 'Slide 12’s latent loss is ▢ × Σᵢ [1 + log(σᵢ²) − σᵢ² − μᵢ²]. What is ▢?',
    choices: [
      { label: '$-\\tfrac{1}{2}$', text: '−½', aria: 'minus one half' },
      { label: '$+\\tfrac{1}{2}$', text: '+½', aria: 'plus one half' },
      { label: '$-1$', text: '−1', aria: 'minus one' },
      { label: '$\\tfrac{1}{n}$', text: '1/n', aria: 'one over n' },
    ],
    why: 'Slide 12: $\\mathscr{L} = -\\tfrac{1}{2}\\sum_{i=1}^{n}[1 + \\log(\\sigma_i^2) - \\sigma_i^2 - \\mu_i^2]$, the same −½ in the γ form; slide 14’s code writes it as -0.5 * tf.reduce_sum(…).',
  },
  {
    id: 'kl', level: 2, concept: 'vae.totalLoss', src: { lecture: 6, slides: [13] }, eq: null,
    prompt: 'Slide 13: the latent loss is the Kullback-Leibler divergence between…',
    choices: [
      { label: 'the target distribution (the Gaussian) and the actual distribution of the codings', text: 'the target distribution (the Gaussian) and the actual distribution of the codings' },
      { label: 'the inputs and their reconstructions', text: 'the inputs and their reconstructions' },
      { label: 'the encoder’s and the decoder’s weights', text: 'the encoder’s and the decoder’s weights' },
      { label: 'two neighbouring codings', text: 'two neighbouring codings' },
    ],
    why: 'Slide 13: the latent loss is the Kullback-Leibler divergence between the target distribution (i.e., the Gaussian distribution) and the actual distribution of the codings; this gives the formula for ℒ on slide 12.',
  },
  {
    id: 'step1', level: 2, concept: 'vae.interpolation', src: { lecture: 6, slides: [17, 18] }, eq: null,
    prompt: 'Slide 17’s step 1 (run both images through the encoder to get their codings) can be replaced by…',
    choices: [
      { label: 'drawing random samples from the normal distribution', text: 'drawing random samples from the normal distribution' },
      { label: 'averaging the two images’ pixels', text: 'averaging the two images’ pixels' },
      { label: 'training the decoder again', text: 'training the decoder again' },
      { label: 'setting both codings to zero', text: 'setting both codings to zero' },
    ],
    why: 'Slide 17: we can also replace step 1 by directly drawing random samples from the normal distribution to get the two codings, which is what slide 18’s tf.random.normal(shape=[2, codings_size]) does.',
  },
  {
    id: 'ends', level: 2, concept: 'vae.interpolation', src: { lecture: 6, slides: [18] }, eq: null,
    beyond: true,
    note: 'NumPy’s np.linspace includes both ends by default (endpoint=True); slide 18 only says “linearly interpolate 10 elements from the 2 codings”.',
    prompt: 'inter_codings = np.linspace(codings[0], codings[1], 10): images[0] and images[9] decode…',
    choices: [
      { label: 'codings[0] and codings[1] themselves', text: 'codings[0] and codings[1] themselves' },
      { label: 'the codings one tenth in from each end', text: 'the codings one tenth in from each end' },
      { label: 'the midpoint coding, twice', text: 'the midpoint coding, twice' },
      { label: 'two fresh random codings', text: 'two fresh random codings' },
    ],
    why: 'NumPy’s np.linspace includes both ends by default (endpoint=True), so images[0] and images[9] decode codings[0] and codings[1] themselves. Slide 18 only says “linearly interpolate 10 elements from the 2 codings”; this is consistent with its strip going from T-shirt to Sneaker.',
  },
  {
    id: 'gammaWhy', level: 2, concept: 'vae.gamma', src: { lecture: 6, slides: [12] }, eq: 'vaeGammaDef',
    prompt: 'Why does slide 12 make the encoder output γ rather than σ?',
    choices: [
      { label: 'the algorithm is more numerically stable and training is faster', text: 'the algorithm is more numerically stable and training is faster' },
      { label: 'it makes the latent loss zero', text: 'it makes the latent loss zero' },
      { label: 'it removes the Gaussian noise', text: 'it removes the Gaussian noise' },
      { label: 'the decoder takes γ as its input', text: 'the decoder takes γ as its input' },
    ],
    why: 'Slide 12: a common tweak adopted in practice is to make the encoder output γ (defined as log(σ²)) rather than σ, so that the algorithm is more numerically stable and the training is faster.',
  },
  {
    id: 'cloud', level: 2, concept: 'vae.latentSpace', src: { lecture: 6, slides: [12] }, eq: null,
    prompt: 'During training, the cost function pushes the codings to…',
    choices: [
      { label: 'migrate within the latent space until they look like a cloud of Gaussian points', text: 'migrate within the latent space until they look like a cloud of Gaussian points' },
      { label: 'collapse onto a single point', text: 'collapse onto a single point' },
      { label: 'match the input pixels', text: 'match the input pixels' },
      { label: 'spread out evenly over a cube', text: 'spread out evenly over a cube' },
    ],
    why: 'Slide 12: the cost function pushes the codings to gradually migrate within the coding space (also called the latent space) to end up looking like a cloud of Gaussian points.',
  },
  {
    id: 'muSign', level: 3, concept: 'vae.latentLoss', src: { lecture: 6, slides: [12] }, eq: 'vaeLatentLossGamma',
    prompt: 'Inside slide 12’s bracket, μᵢ² is subtracted. So with γᵢ fixed, moving μᵢ away from 0 makes ℒ…',
    choices: [
      { label: 'larger: $-\\tfrac{1}{2}\\cdot(-\\mu_i^2) = +\\tfrac{1}{2}\\mu_i^2$', text: 'larger (−½ · (−μᵢ²) = +½μᵢ²)', aria: 'larger, plus one half mu i squared' },
      { label: 'smaller: the μᵢ² term is subtracted', text: 'smaller', aria: 'smaller' },
      { label: 'unchanged: only γᵢ matters', text: 'unchanged', aria: 'unchanged' },
      { label: 'negative', text: 'negative', aria: 'negative' },
    ],
    why: 'ℒ = −½Σ[1 + γᵢ − exp(γᵢ) − μᵢ²] (slide 12): the −½ times −μᵢ² is +½μᵢ², so mean codings further from 0 cost more latent loss.',
  },
  {
    id: 'addLoss', level: 3, concept: 'vae.totalLoss', src: { lecture: 6, slides: [14, 15] }, eq: 'vaeLatentLossCode',
    prompt: 'Slide 14: self.add_loss(tf.reduce_mean(loss) / 784.). What is the 784?',
    choices: [
      { label: '28*28, the output image dimension', text: '28*28, the output image dimension' },
      { label: 'the batch size', text: 'the batch size' },
      { label: 'the number of coding dimensions', text: 'the number of coding dimensions' },
      { label: 'the number of training epochs', text: 'the number of training epochs' },
    ],
    why: 'Slide 14’s comment: average over instances in the minibatch; 784=28*28 is the output image dimension. compile(loss="mse") supplies the reconstruction loss (slide 15), so training minimises the total loss.',
  },
  {
    id: 'sumAxis', level: 3, concept: 'vae.latentLoss', src: { lecture: 6, slides: [12, 14] }, eq: 'vaeLatentLossCode',
    prompt: 'Slide 14’s loss = -0.5 * tf.reduce_sum(1 + logvar - tf.exp(logvar) - tf.square(mean), axis=-1) sums over…',
    choices: [
      { label: 'all the features (the n coding dimensions)', text: 'all the features (the n coding dimensions)' },
      { label: 'the instances in the minibatch', text: 'the instances in the minibatch' },
      { label: 'the 784 output pixels', text: 'the 784 output pixels' },
      { label: 'the training epochs', text: 'the training epochs' },
    ],
    why: 'Slide 14’s comment: sum the losses over all the features (axis=-1), which is slide 12’s $\\sum_{i=1}^{n}$ over the codings’ dimension; the mean over the minibatch comes next, in add_loss.',
  },
  {
    id: 'logvarName', level: 3, concept: 'vae.gamma', src: { lecture: 6, slides: [12, 14] }, eq: null,
    prompt: 'codings_log_var = tf.keras.layers.Dense(codings_size)(Z)  # gamma. This head outputs…',
    choices: [
      { label: 'γ = log(σ²), the log of the variance', text: 'γ = log(σ²), the log of the variance' },
      { label: 'log(σ), the log of the standard deviation', text: 'log(σ), the log of the standard deviation' },
      { label: 'σ², the variance', text: 'σ², the variance' },
      { label: 'the sampled codings', text: 'the sampled codings' },
    ],
    why: 'Slide 14 labels codings_log_var “# gamma”, and slide 12 defines γ as log(σ²): a log variance. The sampled codings are the Sampling layer’s output, the encoder’s third output.',
  },
];
