/* ============================================================================
   LECTURE 4 STUDY — NOTEBOOKLM VIDEO OVERVIEW PROMPT
   ----------------------------------------------------------------------------
   What James pastes into NotebookLM's Video Overview steering prompt, with
   the exported "Read + Play" PDF as the notebook's only source. Shown in the
   dropdown under Export PDF (NotebookLmPrompt.jsx), never printed.

   What NotebookLM's help page said when this was written (21 Oct 2026,
   support.google.com/notebooklm/answer/16454555): Studio → Video Overview →
   customise: Format (Cinematic · Explainer · Short), language, visual style,
   and an optional steering prompt. Explainer is "a structured, comprehensive
   overview"; Short runs ~60 s; Cinematic is 18+ and English only. No length
   limit is published for the steering prompt and no running time for the
   formats (third-party guides put an Explainer at roughly 6–10 minutes),
   so every prompt here stays well under 1,000 characters, and a two-part
   variant splits the 52 slides over two videos.
   ========================================================================== */

export const NLM_STEPS = [
  'Export PDF, then add the PDF as the only source of a new NotebookLM notebook.',
  'Studio → Video Overview → customise (the pencil): Format “Explainer”, any visual style.',
  'Paste a prompt below into the steering prompt box, then Generate.',
];

export const NLM_FORMAT = 'Pick Explainer: Short is a ~60-second clip and Cinematic is a story-style video (18+, English only), neither built to cover a whole lecture.';

export const NLM_PROMPT = `Use only the uploaded PDF and follow its section order, §0 to §16. Audience: a student preparing for a test, who knows MLPs, CNNs and Keras but is new to RNNs. For each concept give the intuition first, then state it precisely in the PDF's notation (row vectors with ⊤, time subscripts like h(t), σ, ⊗), its Keras names (univar_model, mulvar_model, ahead_model) and figure numbers. Walk through the numbers step by step: matrix shapes, parameter counts, the windowing example, the naive forecast's MAE. Tell the forecasting part as one story of models scored by validation MAE. Prioritise recurrent neurons, unrolling and memory cells; the RNN equations with shapes; sequence input/output types; BPTT; the forecasting workflow; unstable gradients and layer normalization; LSTM and GRU gate by gate; Conv1D. Mention what the Slide check notes flag. Keep code light. End with a recap of the key formulas and three self-test questions.`;

export const NLM_SPLIT = 'One video skims a 52-slide deck. For full coverage make two videos from the same PDF, one per prompt.';

export const NLM_PARTS = [
  {
    label: 'Part 1 · §0–§9',
    text: `Use only the uploaded PDF, sections §0 to §9 in order (part 1 of 2). Audience: a student preparing for a test, who knows MLPs, CNNs and Keras but is new to RNNs. Intuition first, then precise in the PDF's notation (row vectors with ⊤, time subscripts) and figure numbers. Cover: what RNNs are for; recurrent neurons and unrolling (Figure 15-1); memory cells and the hidden state; slide 9's equations with every matrix shape; the weather example; the four input/output sequence types (Figure 15-4); BPTT (Figure 15-5). Then the forecasting story, each model scored by validation MAE: the ridership data, the naive 7-day forecast and its MAE, windows and batches, the linear model, SimpleRNN and univar_model with their parameter counts, deep RNNs. Walk numbers step by step, mention the Slide check notes, keep code light. End with a recap and three self-test questions.`,
  },
  {
    label: 'Part 2 · §10–§16',
    text: `Use only the uploaded PDF, sections §10 to §16 in order (part 2 of 2; part 1 covered RNN basics up to deep RNNs). Audience: a student preparing for a test, new to RNNs. Intuition first, then precise in the PDF's notation (row vectors with ⊤, time subscripts, σ, ⊗) and figure numbers. Continue the forecasting story scored by validation MAE: multivariate input (mulvar_model), multiple outputs, forecasting 14 days ahead (the slide-34 loop vs ahead_model). Then unstable gradients over many steps and layer vs batch normalization; the LSTM cell gate by gate, its long-term state c(t) and its equations (Figure 15-12); the GRU and how it simplifies the LSTM (Figure 15-13); Conv1D for sequences and cnn_gru_model; the learning outcomes. Walk shapes and parameter counts step by step, mention the Slide check notes, keep code light. End with a recap of the key formulas and three self-test questions.`,
  },
];
