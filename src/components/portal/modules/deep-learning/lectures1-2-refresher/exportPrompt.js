/* ============================================================================
   LECTURES 1–2 REFRESHER — THE NOTEBOOKLM VIDEO PROMPTS
   ----------------------------------------------------------------------------
   Pasted into NotebookLM's Video Overview steering prompt, with the exported
   PDF (Read + Play) as the only source. Checked 2026-10-24 on Google's help
   page (support.google.com/notebooklm/answer/16454555): the formats are now
   Cinematic (Ultra, 18+, English only), Explainer ("a structured,
   comprehensive overview") and Short (~60-second videos; the Lecture 8
   module's notes called it Brief); visual styles Classic, Whiteboard,
   Watercolor, Retro Print, Heritage, Paper-craft, Kawaii and Anime, plus
   auto-select and a custom style; the steering prompt is optional ("a
   suggested topic … or a custom topic") and no length limit is stated. So
   each prompt here stays under 1,000 characters, and Explainer is the format
   to pick.

   A refresher video for a student who has already studied both lectures,
   plus a two-part variant: part 1 = Lecture 1, part 2 = Lecture 2. The page
   shows these and never prints them.
   ========================================================================== */

export const NLM_PROMPT = `Use only this PDF: a CITS5017 refresher of Lecture 1 (Introduction to ANNs) and Lecture 2 (Training Deep Neural Networks). The viewer has studied both and wants a brisk, accurate recap of the key concepts in the PDF's order. Say which lecture each part is from (L1 or L2) and use the PDF's notation. L1: the TLU and the perceptron rule, why XOR needs an MLP, backprop's four steps, sigmoid, tanh and ReLU, output layers and losses, the three Keras APIs, the learning-rate rules of thumb. L2: vanishing and exploding gradients, Glorot, He and LeCun, nonsaturating activations, batch norm, clipping, transfer learning, the optimizers, learning-rate schedules, ℓ1/ℓ2, dropout, the default configurations. Make the comparisons vivid: activations, initializations, optimizers, schedules. Numbers marked "this page's own" are illustrations, not lecture results. Mention the Slide checks briefly. End with five quick self-test questions.`;

export const NLM_PARTS = [
  {
    label: 'Part 1 of 2 · Lecture 1',
    text: `Part 1 of 2. Use only Part 1 of this PDF (Lecture 1: Introduction to Artificial Neural Networks, §1.0–§1.8) of a CITS5017 refresher. The viewer has studied it and wants a brisk, accurate recap in the PDF's order and notation. Cover: the TLU, z = wᵀx + b and the step; the perceptron learning rule and Hebb's rule; why it converges for linearly separable data, and why its linear boundary fails on XOR; the MLP and backpropagation's four steps; sigmoid, tanh and ReLU and their derivatives; output layers and losses for regression and classification; Keras's Sequential, Functional and Subclassing APIs, compile, fit and callbacks; and the hyperparameter guidelines, especially both learning-rate rules of thumb. Make the activation and output-layer tables vivid. Numbers marked "this page's own" are illustrations. Mention the Slide checks briefly. End with five quick self-test questions.`,
  },
  {
    label: 'Part 2 of 2 · Lecture 2',
    text: `Part 2 of 2. Use only Part 2 of this PDF (Lecture 2: Training Deep Neural Networks, §2.0–§2.9) of a CITS5017 refresher. The viewer has studied it and wants a brisk, accurate recap in the PDF's order and notation. Cover: vanishing and exploding gradients and their cause; Glorot, He and LeCun initialization; the nonsaturating activations and which to use; batch normalization's four equations; gradient clipping by value vs by norm; transfer learning; momentum, NAG, AdaGrad, RMSProp and Adam with their update rules and defaults; the learning-rate schedules; ℓ1/ℓ2 regularization and dropout; and the two default-configuration tables. Make the initialization, optimizer and schedule comparisons vivid. Numbers marked "this page's own" are illustrations. Mention the Slide checks briefly. End with five quick self-test questions.`,
  },
];

export const NLM_STEPS = [
  'Export the PDF with the button above (in the print dialog, choose “Save as PDF”).',
  'In NotebookLM, add the PDF as a source in a new notebook.',
  'Studio → Video Overview → customise: choose the Explainer format, paste one prompt as the steering prompt, then generate (for the two-part variant, generate twice, once per part).',
];

export const NLM_NOTE = 'NotebookLM’s help page lists Cinematic, Explainer and Short formats and states no length limit for the steering prompt (checked October 2026), so each prompt stays under 1,000 characters. They ask for the PDF’s sections in order, each part’s lecture, and the Slide checks.';
