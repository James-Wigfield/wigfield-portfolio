/* ============================================================================
   TOPIC 1 · PARAMETER COUNTS — THE NOTEBOOKLM VIDEO PROMPTS
   ----------------------------------------------------------------------------
   Pasted into NotebookLM's Video Overview steering prompt with this topic's
   exported PDF as the only source (format notes: ../../nlm.js). One prompt
   for a single video and a two-part variant (steps 1–7: dense and conv;
   steps 8–12: recurrent, generative, frozen, five forms). Each < 1,000
   characters.
   ========================================================================== */

export const PROMPTS = {
  single: {
    label: 'One video · format: Explainer',
    text: 'Use only this PDF: a CITS5017 study page on counting a network’s parameters. Teach a student who finds it hard, from zero: a parameter is a weight or a bias. Use the PDF’s pictures (lines and bias beads, the filter brick, the unrolled cell) and walk its worked examples: slide 36’s 266,610; Wide & Deep, where Concatenate feeds 38 inputs to the last layer; BatchNormalization’s non-trainable half; Conv2D’s (k × k × c_in + 1) × filters and slide 22’s 15,200; SimpleRNN, LSTM ×4, GRU ×3. Stress three traps: stride, image size and time steps never change a count. Say when a number is marked “this page’s own” and when something is “beyond the slides”. End with three self-test questions.',
  },
  parts: [
    {
      label: 'Part 1 of 2 · steps 1–7 · Explainer',
      text: 'Part 1 of 2. Use only this PDF, steps 1 to 7: a CITS5017 study page on counting parameters. Teach a student who finds it hard, from zero. Start with the six-step method and what a weight and a bias are, using the lines-and-beads picture. Then walk the worked examples: slide 36’s Dense layers (266,610, mostly in the first layer); counting arrows in Figure 10-5; zero-parameter layers and why Concatenate widens Wide & Deep’s last layer to 38 inputs; Normalization (2n + 1, non-trainable) and BatchNormalization (4n, half non-trainable); Conv2D’s filter brick, slide 22’s 15,200 against 675 million, and slide 35’s CNN with Flatten versus global average pooling. Say which numbers are “this page’s own” and what is “beyond the slides”. End with three self-test questions.',
    },
    {
      label: 'Part 2 of 2 · steps 8–12 · Explainer',
      text: 'Part 2 of 2. Use only this PDF, steps 8 to 12: a CITS5017 study page on counting parameters. Teach a student who can count Dense and conv layers but finds recurrent models hard. Use the unrolled-cell picture: W_x, W_h and b are reused at every time step, so sequence length never changes a count (slides 25 to 29 print model totals of 3, 1,121 and 5,281). Then LSTM as four blocks (model total 685), GRU as three plus Keras’s extra bias (model total 1,401; 1,341 with one bias per gate), Bidirectional as two copies (674); tied autoencoder weights (163,814 to 82,414); frozen layers, which move to non-trainable; and one model in five forms. Say which numbers are “this page’s own” and what is “beyond the slides”. End with three self-test questions.',
    },
  ],
};
