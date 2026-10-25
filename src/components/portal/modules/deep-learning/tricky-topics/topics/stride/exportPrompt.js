/* ============================================================================
   TOPIC 4 · STRIDE — THE NOTEBOOKLM VIDEO PROMPT
   ----------------------------------------------------------------------------
   Pasted into NotebookLM's Video Overview steering prompt with this topic's
   exported PDF as the only source (format notes: ../../nlm.js). < 1,000
   characters.
   ========================================================================== */

export const PROMPTS = {
  single: {
    label: 'One video · format: Explainer',
    text: 'Use only this PDF: a CITS5017 study page on stride in convolutional and pooling layers. Teach a student who roughly knows stride is how far the window moves, starting from zero. Use the PDF’s pictures: the window hopping along a strip, and Figure 14-8 rebuilt, where 10 inputs with kernel 7 and stride 2 give 2 outputs with "valid" (the last input ignored) and 5 with "same" (2 zeros on the left, 3 on the right). Walk the worked sizes: 70 to 64, AlexNet’s 227 to 55 to 27, max pooling halving and rounding down, and transposed convolutions growing 3 to 7 to 14 to 28. Say clearly that the output-size formulas are marked “beyond the slides”. Stress that stride changes the output size and the work but never the parameter count. End with three self-test questions.',
  },
  parts: [],
};
