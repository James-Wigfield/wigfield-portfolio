/* ============================================================================
   TOPIC 3 · SOFTMAX — THE NOTEBOOKLM VIDEO PROMPT
   ----------------------------------------------------------------------------
   Pasted into NotebookLM's Video Overview steering prompt with this topic's
   exported PDF as the only source (format notes: ../../nlm.js). < 1,000
   characters.
   ========================================================================== */

export const PROMPTS = {
  single: {
    label: 'One video · format: Explainer',
    text: 'Use only this PDF: a CITS5017 study page on softmax. Teach a student who has met softmax many times but never seen what it does, starting from zero. Use the PDF’s pictures: score bars turning into probability bars that fill exactly 100%. Walk the worked example by hand, z = (2, 1, 0.1) giving 0.659, 0.242 and 0.099, and show that adding the same number to every score changes nothing. Then: when to use softmax, one sigmoid, or a sigmoid per label; cross-entropy as minus the log of the true class’s probability, and argmax; attention weights that sum to 1, and why the scores are divided by the square root of d_keys; the last layer over a vocabulary. Say clearly that the formula is printed only for attention weights and is otherwise marked “beyond the slides”. End with three self-test questions.',
  },
  parts: [],
};
