/* ============================================================================
   LECTURES 1–2 REFRESHER — THE NOTEBOOKLM VIDEO PROMPTS (placeholder; the
   final prompts are written once the page is complete)
   ========================================================================== */

export const NLM_PROMPT = 'Use only this PDF: a CITS5017 refresher of Lecture 1 (Introduction to ANNs) and Lecture 2 (Training DNNs).';

export const NLM_PARTS = [
  { label: 'Part 1 of 2 · Lecture 1', text: 'Part 1 of 2. Use only this PDF, Part 1 (Lecture 1).' },
  { label: 'Part 2 of 2 · Lecture 2', text: 'Part 2 of 2. Use only this PDF, Part 2 (Lecture 2).' },
];

export const NLM_STEPS = [
  'Export the PDF with the button above (in the print dialog, choose “Save as PDF”).',
  'In NotebookLM, add the PDF as a source in a new notebook.',
  'Studio → Video Overview → customise: choose the format, paste one prompt as the steering prompt, then generate.',
];

export const NLM_NOTE = 'Each prompt is kept under 1,000 characters.';
