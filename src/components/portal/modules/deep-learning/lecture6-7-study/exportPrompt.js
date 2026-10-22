/* ============================================================================
   LECTURES 6–7 STUDY — THE NOTEBOOKLM VIDEO PROMPT
   ----------------------------------------------------------------------------
   Pasted into NotebookLM's Video Overview steering prompt, with the exported
   PDF (Read + Play) as the only source. Checked 2026-10-22: Google's help
   page (support.google.com/notebooklm/answer/16454555) lists the formats
   Cinematic (18+, English only), Explainer ("a structured, comprehensive
   overview that connects the dots within your sources") and Short (about 60
   seconds), and an optional steering prompt with no stated length limit; a
   July 2026 guide (chromestory.com) still says Brief for the short one. The
   prompt stays under 1,000 characters, and the dropdown says to pick
   Explainer, the format in every list. The page shows this text and never
   prints it.
   ========================================================================== */

export const NLM_PROMPT = `Use only this PDF: a CITS5017 study page on convolutional, denoising and variational autoencoders, GANs and DCGANs. Teach a student revising for a test who knows MLPs, CNNs, Keras and basic autoencoders but is new to VAEs and GANs. Follow its sections in order, §0 to §12, with its notation (μ, σ, γ = log(σ²)) and Keras names. For each idea, give the intuition, then state it precisely. Walk through conv_ae's shapes and parameter counts, and the latent loss formula term by term. Make clear why a VAE is probabilistic and generative, and how sampling and semantic interpolation work. Explain the two GAN training phases: each batch, its labels, and why each phase freezes what it does. Cover the Nash equilibrium, mode collapse, oscillation and the DCGAN guidelines. Point out each Slide check, and say which numbers and images are the page's own run. End with a short recap and three self-test questions.`;

export const NLM_STEPS = [
  'Export the PDF with the button above (in the print dialog, choose “Save as PDF”).',
  'In NotebookLM, add the PDF as a source in a new notebook.',
  'Studio → Video Overview → customise: choose the Explainer format, paste this prompt as the steering prompt, then generate.',
];
