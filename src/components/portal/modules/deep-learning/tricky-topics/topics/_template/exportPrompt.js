/* ============================================================================
   TOPIC · __TOPIC_TITLE__ — THE NOTEBOOKLM VIDEO PROMPT(S)
   ----------------------------------------------------------------------------
   Pasted into NotebookLM's Video Overview steering prompt, with this topic's
   exported PDF as the only source (how-to and format notes: ../../nlm.js).
   Keep each prompt under 1,000 characters (page-check.mjs asserts it): a
   short explainer for a student who finds the topic hard — start from zero,
   use the PDF's pictures, walk the worked examples, say clearly what is
   beyond the slides, end with three self-test questions. `parts` is an
   optional multi-video variant. REPLACE ME.
   ========================================================================== */

export const PROMPTS = {
  single: {
    label: 'One video · format: Explainer',
    text: 'REPLACE ME. Use only this PDF: a CITS5017 study page on __TOPIC_TITLE__. Teach a student who finds it hard, starting from zero. Use the PDF’s pictures and walk its worked examples. Say clearly when something is marked “beyond the slides”. End with three self-test questions.',
  },
  parts: [],
};
