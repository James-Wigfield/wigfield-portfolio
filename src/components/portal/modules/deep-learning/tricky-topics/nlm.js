/* ============================================================================
   TRICKY TOPICS — NOTEBOOKLM: HOW TO USE A TOPIC'S PROMPT (shared)
   ----------------------------------------------------------------------------
   Every topic's prompts (topics/<id>/exportPrompt.js) are pasted into
   NotebookLM's Video Overview steering prompt, with that topic's exported
   PDF as the only source. Re-checked by web search on 2026-10-25: Google's
   help page (support.google.com/notebooklm/answer/16454555) lists the
   formats Cinematic (18+, English only), Explainer ("a structured,
   comprehensive overview that connects the dots within your sources") and
   Brief; a third-party guide (eesel.ai) says the short format is now called
   Short (about 60 seconds, vertical). The two disagree on that name; Exam
   Practice's note of 2026-10-24 had "Short". Neither states a character
   limit for the steering prompt, so every prompt here stays under 1,000
   characters (page-check.mjs asserts it). Explainer is the format to pick.
   ========================================================================== */

export const NLM_LIMIT = 1000;

export const NLM_STEPS = [
  'Export this topic’s PDF with the button above (in the print dialog, choose “Save as PDF”).',
  'In NotebookLM, add the PDF as a source in a new notebook.',
  'Studio → Video Overview → customise: choose the Explainer format, paste one prompt as the steering prompt, then generate (for a multi-part variant, generate once per part).',
];

export const NLM_NOTE =
  'NotebookLM’s help page lists the Cinematic, Explainer and Brief formats (some guides now call the short one Short) and publishes no length limit for the steering prompt (checked October 2026), so each prompt stays under 1,000 characters. Each asks the video to start from zero, use the PDF’s pictures and worked examples, say clearly what is beyond the slides, and end with three self-test questions.';
