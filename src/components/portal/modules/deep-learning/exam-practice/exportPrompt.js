/* ============================================================================
   EXAM PRACTICE — THE NOTEBOOKLM VIDEO PROMPT
   ----------------------------------------------------------------------------
   Pasted into NotebookLM's Video Overview steering prompt, with the exported
   PDF (three papers, each followed by its model answers) as the only
   source. The video should feel like the lecturer working through a few
   sample questions at the whiteboard in a revision session, not a tour of
   every question.

   Format: Explainer. Re-checked 2026-10-24: Google's help page
   (support.google.com/notebooklm/answer/16454555) lists Cinematic (18+,
   English only), Explainer ("a structured, comprehensive overview") and
   Brief (a bite-sized video; July 2026 blog posts call it "Short", about
   60 s, vertical), plus an optional steering prompt; neither Google nor the
   guides state a character limit, so the prompt stays under 1,000
   characters (as Lecture 8 found on 2026-10-22). Explainer is the format
   with room for five worked parts; Brief/Short covers one idea; Cinematic
   is a dramatised film, not a revision session.

   The picks, in the order the video takes them. Difficulty is the question
   validators' 1–5 rating; four of the five are the only parts rated 4 across
   all three papers (the top band); together they span L1, L4, L8 and L9,
   include given code → draw/count (Sample Q1(c), B Q2(b)) and calculations
   (Sample Q1(c), B Q2(b), A Q4(a) ii., B Q4(b)):
     1. Sample Paper · Question 1 (c)       difficulty 4  L1  draw a two-path
        functional model, count with two traps (Concatenate width 30,
        Normalization's 21 statistics are non-trainable), infer the task
     2. Sample Paper · Question 2 (a) iii.  difficulty 4  L4  an open design
        question: last-step output + Dense(4), X (m, 3, 2) → y (m, 4)
     3. Practice Paper B · Question 2 (b)   difficulty 4  L4/L3  "valid"
        padding 30 → 28, the Conv1D rule, the LSTM ×4 rule: 1,673
     4. Practice Paper A · Question 4 (a) ii.  difficulty 3  L8  Q, K, V and
        QKᵀ shapes, with the V-has-one-row-per-key trap
     5. Practice Paper B · Question 4 (b)   difficulty 4  L9  two value-
        iteration steps by hand on the slides' MDP: six values, easy slips
   Every pick prints a "Common slip:" line in its model answer, so the video
   never has to invent one. check-papers.mjs checks each pick exists, has a
   slip, and that its label appears in the prompt verbatim; page-check.mjs
   checks each label is in the PDF's text.
   ========================================================================== */

export const NLM_FORMAT = 'Explainer';

// the parts the video works through, in order (ids from ./papers)
export const NLM_PICKS = [
  { id: 's-q1-c', difficulty: 4 },
  { id: 's-q2-a-iii', difficulty: 4 },
  { id: 'b-q2-b', difficulty: 4 },
  { id: 'a-q4-a-ii', difficulty: 3 },
  { id: 'b-q4-b', difficulty: 4 },
];

export const NLM_PROMPT = `Use only this PDF. Make a revision session in which the CITS5017 lecturer works through five exam parts at the whiteboard, in this order: Sample Paper · Question 1 (c); Sample Paper · Question 2 (a) iii.; Practice Paper B · Question 2 (b); Practice Paper A · Question 4 (a) ii.; Practice Paper B · Question 4 (b). Skip every other question. For each part: read it out, with the stem it depends on, and its marks; say what the marks and the command word signal about how much to write; think aloud through the approach; give the model answer exactly as printed under that label in the PDF's Model answers, in its notation and with its numbers, adding nothing from outside the PDF; then point out where the ticks fall and the common slip printed with it. End with a short recap of exam technique: the marks guide the depth, at about 1.5 minutes per mark.`;

export const NLM_STEPS = [
  'Export the PDF with the button above (in the print dialog, choose “Save as PDF”).',
  'In NotebookLM, add the PDF as the only source in a new notebook.',
  'Studio → Video Overview → customise: choose the Explainer format, paste the prompt as the steering prompt, then generate.',
];

export const NLM_NOTE = 'NotebookLM publishes no length limit for the steering prompt (checked October 2026), so the prompt stays under 1,000 characters. It names five parts by the exact labels printed in the PDF, mostly the hardest ones, and asks the video to skip the rest; in the papers, those parts carry a small "in the NotebookLM video" label.';
