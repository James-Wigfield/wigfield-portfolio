/* ============================================================================
   LECTURE 9 STUDY — THE NOTEBOOKLM VIDEO PROMPTS
   ----------------------------------------------------------------------------
   Pasted into NotebookLM's Video Overview steering prompt, with the exported
   PDF (Read + Play) as the only source. Checked 2026-10-22: Google's help
   page (support.google.com/notebooklm/answer/16454555) lists the formats
   Cinematic, Explainer and Brief and a custom prompt that steers the video;
   a July 2026 guide (eesel.ai) calls the short one "Short" and gives it
   about 60 seconds. Neither states a character limit for the prompt, so each
   prompt here stays under 1,000 characters. Explainer ("a structured,
   comprehensive overview") is the format to pick.

   The deck is long, so there is a single-video prompt and a two-part
   variant: part 1 = §0–§8 (RNN encoder–decoders to attention in Keras),
   part 2 = §9–§17 (transformers and ViT). The page shows these and never
   prints them.
   ========================================================================== */

export const NLM_PROMPT = `Use only this PDF: a CITS5017 study page on attention, transformers and vision transformers. Teach a student revising for a test who knows RNNs, LSTMs and Keras but is new to attention. Follow its sections in order, in its notation, with its running example "I like soccer" → "me gusta el fútbol". Intuition first, then the precise statement. Most time on: attention as a shorter path (a weighted sum of encoder outputs, the alignment model); Bahdanau (additive) vs Luong (multiplicative) and Luong's three scores; queries, keys and values; scaled dot-product attention, its shapes and why we divide by √d_keys; multi-head attention; positional encodings; masking and ⟨SOS⟩ → ⟨EOS⟩ generation; self- vs cross-attention; the transformer's data flow; visual attention and ViT. Keep the bus/rail code light; skip §16 (not examined). Numbers marked "this page's own" are illustrations, not the lecture's results: say so. Point out the Slide checks. End with a recap and three self-test questions.`;

export const NLM_PARTS = [
  {
    label: 'Part 1 of 2 · §0–§8',
    text: `Part 1 of 2. Use only this PDF, sections §0 to §8: a CITS5017 study page on encoder-decoders and attention. Teach a student revising for a test who knows RNNs, LSTMs and Keras but is new to attention. Follow the sections in order, in the PDF's notation, with the running example "I like soccer" → "me gusta el fútbol". Intuition first, then the precise statement. Briefly: encoder-decoders for NMT, why a causal RNN can't look ahead, bidirectional layers, the bus/rail encoder-decoder's training vs testing stage. Most time on: attention as a shorter path, the weights α(t, i) and the weighted sum of encoder outputs, the alignment model; Bahdanau (additive) vs Luong (multiplicative) and Luong's three scores; Keras's Attention and AdditiveAttention, return_sequences=True; queries, keys and values. Numbers marked "this page's own" are illustrations, not the lecture's results. Point out the Slide checks. End with a recap and three self-test questions.`,
  },
  {
    label: 'Part 2 of 2 · §9–§17',
    text: `Part 2 of 2. Use only this PDF, sections §9 to §17: a CITS5017 study page on transformers and vision transformers. Teach a student revising for a test who already knows attention, queries, keys and values. Follow the sections in order, in the PDF's notation, with the running example "I like soccer" → "me gusta el fútbol". Intuition first, then the precise statement. Most time on: the transformer's structure and why it isn't recurrent; where each attention layer's queries, keys and values come from; positional encodings; scaled dot-product attention, its shapes and why we divide by √d_keys; multi-head attention; self- vs cross-attention; masking and ⟨SOS⟩ → ⟨EOS⟩ generation; visual attention; the ViT recipe and why it needs so much data. Keep the Keras code light; skip §16 (not examined). Numbers marked "this page's own" are illustrations, not the lecture's results. Point out the Slide checks. End with a recap and three self-test questions.`,
  },
];

export const NLM_STEPS = [
  'Export the PDF with the button above (in the print dialog, choose “Save as PDF”).',
  'In NotebookLM, add the PDF as a source in a new notebook.',
  'Studio → Video Overview → customise: choose the Explainer format, paste one prompt as the steering prompt, then generate (for the two-part variant, generate twice, once per part).',
];
