/* ============================================================================
   TOPIC 2 · SHAPES — THE NOTEBOOKLM VIDEO PROMPT
   ----------------------------------------------------------------------------
   Pasted into NotebookLM's Video Overview steering prompt with this topic's
   exported PDF as the only source (format notes: ../../nlm.js). < 1,000
   characters.
   ========================================================================== */

export const PROMPTS = {
  single: {
    label: 'One video · format: Explainer',
    text: 'Use only this PDF: a CITS5017 study page on tensor shapes. Teach a student who only vaguely knows what a shape is, starting from zero. Use the PDF’s box pictures and its fixed axis colours (batch, height, width, channels, time steps, features). Walk its examples: (2, 70, 120, 3) read number by number; why summary() prints None for the batch; why recurrent layers want [batch size, time steps, dimensionality]; how Flatten, Dense, Conv2D, pooling, global average pooling and return_sequences change a shape, traced through slide 35’s CNN (28 to 14 to 7 to 3); weight shapes versus data shapes; and turning a scenario into the shapes of X and y, like the sample paper’s star (N, 4, 2) and (N, 2). Point out slide 19’s typo, 3 for 32. Say clearly what is marked “beyond the slides”. End with three self-test questions.',
  },
  parts: [],
};
