/* ============================================================================
   TRICKY TOPICS — NOTEBOOKLM: HOW TO USE A TOPIC'S PROMPT (shared)
   ----------------------------------------------------------------------------
   Every topic's prompts (topics/<id>/exportPrompt.js) are pasted into
   NotebookLM's Video Overview steering prompt, with that topic's exported
   PDF as the only source. Format findings, re-checked 2026-10-25 (see the
   note below): Google's help page for Video Overviews lists the Cinematic,
   Explainer and Short formats and an optional steering prompt, and states
   no character limit for it, so every prompt here stays under 1,000
   characters (checks: tools/dl-tricky-topics/page-check.mjs). Explainer is
   the format to pick.
   ========================================================================== */

export const NLM_LIMIT = 1000;

export const NLM_STEPS = [
  'Export this topic’s PDF with the button above (in the print dialog, choose “Save as PDF”).',
  'In NotebookLM, add the PDF as a source in a new notebook.',
  'Studio → Video Overview → customise: choose the Explainer format, paste one prompt as the steering prompt, then generate (for a multi-part variant, generate once per part).',
];

export const NLM_NOTE =
  'NotebookLM’s help page lists the Cinematic, Explainer and Short formats and publishes no length limit for the steering prompt (checked October 2026), so each prompt stays under 1,000 characters. Each one asks the video to start from zero, use the PDF’s pictures and worked examples, say clearly what is beyond the slides, and end with three self-test questions.';
