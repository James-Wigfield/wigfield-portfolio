import { CARDS, CARD_BY_ID, fullLabel } from './cards/index.js';

/* ============================================================================
   CODE LAB — THE NOTEBOOKLM VIDEO PROMPTS
   ----------------------------------------------------------------------------
   Pasted into NotebookLM's Video Overview steering prompt, with the exported
   PDF as the only source. The video should feel like the lecturer walking
   through code on screen in a brisk revision session: labs and projects
   first, then a handful of concept cards, each mark explained while that
   code is highlighted.

   Research, re-checked 2026-10-25:
     · Google's help page (support.google.com/notebooklm/answer/16454555)
       lists three formats: Cinematic ("A rich, immersive experience", 18+,
       English only), Explainer ("A structured, comprehensive overview that
       connects the dots within your sources") and Short (~60-second videos;
       earlier builds and some July 2026 guides call it Brief). You can give
       "a custom topic"; no length limit is published, so each prompt here
       stays under about 1,000 characters (as the exam-practice and Lecture 9
       prompts did on 2026-10-24).
     · Launch coverage (9to5Google, The Decoder, July 2025) says Video
       Overviews make narrated slides that pull in images, diagrams, quotes
       and numbers from the sources. Nothing published says they crop
       regions of a PDF or draw highlights on them. So the highlighting lives
       in the PDF: each code panel is one image with its marks drawn in
       (bands, underlines, circled numbers) and the card label in its title
       bar, and each legend quotes the marked code.
   Format: Explainer, the only one with room for a structured walk through
   five labs/projects and several cards; Short covers one idea; Cinematic
   dramatises rather than teaches.

   Each prompt (and each part) ends with the brief's recipe: draw it, count
   it, say what it's for; Part 1 first recaps what the exam asks of any lab
   (the shapes of X and y, the loss, the output layer).

   The concept cards, in the order the video takes them (labels come from
   the card ids, so they always match the PDF; check-cards.mjs and pdf.mjs
   check them). The one-video prompt names the first seven, the two-part
   variant all eight. All core, across six lectures (L1, L3, L4, L6–7, L8, L9);
   four carry Count it (Wide & Deep, Conv2D, LSTM/GRU, GAN) and two Draw it
   (Wide & Deep, GAN), the sample paper's Q1(c) stimulus types:
     wide-deep           L1   sample Q1(c) itself: draw, count, what for
     conv-shapes         L3   sample Q1(a): what defines a conv layer
     lstm-gru            L4   the GRU count trap (two biases in Keras 3)
     vae-sampling        L6–7 sample Q2(b): the VAE loss term by term
     gan-build           L6–7 GANs are a learning outcome; draw + count
     positional-encoding L8   sample Q2(c): a transformer key component
     q-iteration         L9   sample Q2(e): the update equation in code
     dqn-step            L9   practice paper B Q4(d): target, runs, mask
   ========================================================================== */

export const NLM_FORMAT = 'Explainer';

export const NLM_PICKS = ['wide-deep', 'conv-shapes', 'lstm-gru', 'vae-sampling', 'gan-build', 'positional-encoding', 'q-iteration', 'dqn-step'];

// cards the one-video prompt walks: every lab and project card + seven picks
const ONE_VIDEO_CARDS = CARDS.filter((c) => c.section === 'labs').length + NLM_PICKS.length - 1;

const named = (ids) => ids.map((id) => fullLabel(CARD_BY_ID[id])).join('; ');

const OPEN = 'Use only this PDF: a lecturer walks through code on screen, brisk revision.';

const LABS = 'First the labs and projects: Lab 2, Lab 3, Lab 4, Project 1, Project 2. For each, say its goal as printed, show its code panels, and walk through each panel’s marks ① ② ③ in order, underlining exactly the marked code as you explain it.';

const CONCEPTS = (ids) => `Then only these cards: ${named(ids)}. For each, show the panel, highlight each mark’s code as you explain it, and show its Draw it, Count it or equation.`;

const RULES = 'Quote code exactly as printed, never invent code, use the PDF’s numbers; skip all other cards.';

const RECIPE_TEXT = 'a three-step recipe for “given this code” questions: draw it, count it, say what it’s for.';
const RECIPE = `End with ${RECIPE_TEXT}`;

// the one-video prompt names seven of them (dqn-step goes, to stay near
// 1,000 characters); the two-part variant's part 2 has room for all eight
export const NLM_PROMPT = `${OPEN} ${LABS} ${CONCEPTS(NLM_PICKS.filter((id) => id !== 'dqn-step'))} ${RULES} ${RECIPE}`;

export const NLM_PARTS = [
  {
    label: 'Part 1 of 2 · Labs & projects',
    text: `Part 1 of 2. ${OPEN} Cover only the Labs & Projects section, in order: Lab 2, Lab 3, Lab 4, Project 1, Project 2. For each, say its goal as printed, give its data shapes and its result or target, then show its code panels and walk through each panel’s marks ① ② ③ in order, highlighting or underlining exactly the marked code as you explain it. Quote code exactly as printed, never invent code, use the PDF’s numbers. End with what the exam asks of any lab (the shapes of X and y, the loss, the output layer), then ${RECIPE_TEXT}`,
  },
  {
    label: 'Part 2 of 2 · Key concept code',
    text: `Part 2 of 2. ${OPEN} ${CONCEPTS(NLM_PICKS).replace('Then only these cards', 'Cover only these cards, in order')} ${RULES} ${RECIPE}`,
  },
];

export const NLM_STEPS = [
  'Export the PDF with the button above (in the print dialog, choose “Save as PDF”).',
  'In NotebookLM, add the PDF as the only source in a new notebook.',
  `Studio → Video Overview → customise: choose the Explainer format, paste the prompt as the steering prompt, then generate. If one video feels rushed (it walks ${ONE_VIDEO_CARDS} cards), use Two parts and generate once per part.`,
];

export const NLM_NOTE = 'NotebookLM’s help page lists the Cinematic, Explainer and Short formats and publishes no length limit for the steering prompt (checked October 2026), and nothing says a video can highlight part of a PDF, so the PDF carries the highlights: every code panel is one image with its marks drawn in and its card label in the title bar.';
