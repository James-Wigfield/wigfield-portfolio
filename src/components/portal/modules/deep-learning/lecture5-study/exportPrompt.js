/* ============================================================================
   LECTURE 5 STUDY — THE NOTEBOOKLM VIDEO PROMPT
   ----------------------------------------------------------------------------
   Pasted into NotebookLM's Video Overview steering prompt, with the exported
   PDF (Read + Play) as the only source. Checked 2026-10-21: Google's help
   page (support.google.com/notebooklm/answer/16454555, now titled "Gemini
   Notebook") lists the formats Cinematic, Explainer and Short and an
   optional "steering prompt"; a July 2026 guide (chromestory.com) lists
   Explainer, Brief and Cinematic. Neither states a character limit, so the
   prompt stays well under 1,000 characters. Explainer is in both lists and
   is the "structured, comprehensive overview", so the dropdown says to pick
   it. The page shows this text and never prints it.
   ========================================================================== */

export const NLM_PROMPT = `Use only this PDF: a CITS5017 study page on autoencoders. Teach a student revising for a test who knows MLPs and Keras but is new to autoencoders. Follow its sections in order, §0 to §10, with its notation, Keras names and figure numbers. For each idea, give the intuition, then state it precisely, walking through its diagrams and numbers step by step. Most time on: encoder, decoder, codings, undercomplete; a linear autoencoder with MSE performs PCA (it finds PCA's plane, not necessarily its axes); stacked autoencoders and the 163,814 parameters layer by layer; tied weights, W_(N−ℓ+1) = W_ℓᵀ, and tied_ae's 82,414; unsupervised pretraining; training one autoencoder at a time. Keep t-SNE and reconstructions brief. Point out each Slide check. Say which numbers are the page's own run, not the slides'. End with a recap and three self-test questions.`;

export const NLM_STEPS = [
  'Export the PDF with the button above (in the print dialog, choose “Save as PDF”).',
  'In NotebookLM, add the PDF as a source in a new notebook.',
  'Studio → Video Overview → customise: choose the Explainer format, paste this prompt as the steering prompt, then generate.',
];
