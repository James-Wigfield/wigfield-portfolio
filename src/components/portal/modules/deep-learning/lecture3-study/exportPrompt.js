/* ============================================================================
   LECTURE 3 STUDY — PDF EXPORT + NOTEBOOKLM VIDEO PROMPT (data only)
   ----------------------------------------------------------------------------
   Export PDF prints the Read + Play beats of every section (print.js); this
   file holds the PDF's default filename and the prompts pasted into
   NotebookLM's Video Overview steering box with that PDF as the only source.

   What NotebookLM (now "Gemini Notebook") offers, checked 2026-10-21 against
   support.google.com/notebooklm/answer/16454555 (see the dev log):
     · Studio panel → Video Overview → customise: Format · Language · Visual
       style · optional steering prompt ("a suggested topic … or provide a
       custom topic") → Generate
     · formats: Explainer ("a structured, comprehensive overview"), Short
       (~60 s) and Cinematic (18+, English only); no length setting
     · visual styles (Classic, Whiteboard, …) are 18+ only and not for Short
       or Cinematic
     · no published character limit for the steering prompt, so every prompt
       here stays well under 1,000 characters, most important rules first
     · no published Explainer length either; third-party tests report roughly
       5–10 minutes, thin for 16 sections — hence the optional two-part variant
   ========================================================================== */

export const PDF_TITLE = 'CITS5017 L3 CNNs — Read + Play';

export const NLM_FORMAT = 'Explainer';

export const NLM_STEPS = [
  'Export PDF, then choose “Save as PDF” in the print dialog.',
  'In NotebookLM (now Gemini Notebook), create a new notebook and upload the PDF as its only source.',
  `In the Studio panel, open Video Overview’s customise options: Format = ${NLM_FORMAT}, visual style Whiteboard or Classic, paste the prompt as the custom topic, then Generate.`,
];

export const NLM_PROMPT = `Use only this PDF (CITS5017 Lecture 3, CNNs). Follow its sections in order, §0 to §15, with its notation, terms and figure numbers (Figure 14-n). Audience: a university student preparing for a test, who knows basic neural networks but is new to CNNs. For each idea, build intuition first, then state it precisely. Spend most time on §2–§9 and §11 (convolution, filters and feature maps, stacking, padding and stride, memory, pooling, the typical CNN), walking through the output sizes, parameter counts and memory estimates step by step. Flag every "Slide check" note and the §5 notation note. Keep §0, §1, §10, §12 and §15 short; treat pretrained models and transfer learning as a practical workflow. Never read code aloud or narrate "Try this" lines or on-screen controls. End with a recap of the key formulas and ideas, then three self-test questions with answers.`;

export const NLM_SPLIT_NOTE = 'Google publishes no Explainer length; reported ones run roughly 5–10 minutes, thin for 16 sections. For more depth, make two videos from the same PDF with these prompts.';

export const NLM_PARTS = [
  {
    label: 'Part 1 · §0–§8',
    text: `Use only this PDF (CITS5017 Lecture 3, CNNs). This is part 1 of 2: cover only §0 to §8, in order — the roadmap and origins briefly, then convolution, convolutional layers and stride, filters and feature maps, stacking feature maps, Conv2D in Keras, padding, memory. Use its notation, terms and figure numbers (Figure 14-n). Audience: a university student preparing for a test, who knows basic neural networks but is new to CNNs. Intuition first, then the precise statement. Walk through the numbers step by step: receptive fields, output sizes, tensor shapes, parameter counts, memory estimates. Flag every "Slide check" note and the §5 notation note. Never read code aloud or narrate "Try this" lines or on-screen controls. End with a recap of the formulas and ideas, then three self-test questions with answers.`,
  },
  {
    label: 'Part 2 · §9–§15',
    text: `Use only this PDF (CITS5017 Lecture 3, CNNs). This is part 2 of 2: cover only §9 to §15, in order — pooling, hyperparameters, the typical CNN and the Fashion-MNIST model, classic architectures (brief: §12 only), pretrained models, transfer learning, summary. Audience: a university student preparing for a test, who knows basic neural networks and met convolution, padding, stride and memory in part 1. Intuition first, then the precise statement. Give most time to pooling and the typical architecture, walking through shapes and parameter counts step by step, and point out the pitfalls the PDF flags. Treat pretrained models and transfer learning as a practical workflow. Never read code aloud or narrate "Try this" lines or on-screen controls. End with a recap of the formulas and ideas, then three self-test questions with answers.`,
  },
];
