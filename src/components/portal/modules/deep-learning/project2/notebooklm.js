/* ============================================================================
   DL PROJECT 2 — NOTEBOOKLM PROMPT
   ----------------------------------------------------------------------------
   The prompt James pastes into NotebookLM's Video Overview "customise" box,
   with the exported PDF as the only source. Written after the notebook was
   analysed, for this PDF. NotebookLM publishes no length limit for that box
   (decisions.md), so the rules that matter most come in the first sentences
   and a compact variant stays under 500 characters. The page shows both in the
   dropdown under Export PDF and never prints them.
   ========================================================================== */

export const NLM_PROMPT = `Source: the attached PDF only. Use every number exactly as it is printed there, never estimate or re-round one, and in a diagram labelled "schematic" treat the drawing as an illustration: a number printed in it is real unless its schematic line calls it illustrative. "Out [n]" in the PDF means the output printed under the code cell marked In [n]. Numbers followed by the source note "experiments/log.md" (the author's tuning log) or "handover" (the author's notes), and numbers the notebook's own text attributes to runs it "tried", come from outside the notebook's printed outputs: say which source when you use them. Don't read the source notes (In [n], Out [n], cell k, experiments/log.md, handover, the brief) aloud, and don't read code line by line: say what it does.

Audience: me, James. I know Python and basic neural networks and want to genuinely understand what this notebook built and why. The PDF is my CITS5017 (Deep Learning, UWA) Project 2 notebook, every cell in order, with numbered "plates" between the sections that explain each part.

1. Open with the overview plates 0·1 and 0·2, then walk through the notebook in its own order and name each section as you reach it: 1 Setup, 2 Loading the data, 3 Splitting, 4 Visualising, 5 Shared helpers (Part (i) runs from section 3 to 9), then 6 Model 1, 7 Model 2, 8 Model 3, 9 Comparing models 2 and 3 over longer horizons; then Part (ii): 10 Data preparation, 11 VAE model, 12 Synthesised sequences; and 13 Summary. For each, cover the task, what was done, how it works, the actual results and the problems found. Explain why a choice was made only where the PDF gives the reason or names alternatives that were tried. Keep sections 1, 3 and 4 brief.
2. Spend the most time on the hard parts:
   a. that the data are overlapping sliding windows over a few station records rather than independent samples, and what that means: about 1770 distinct months behind 1522 training rows, and a test MAE that describes one station's history rather than 297 independent cases (section 2);
   b. why the temperatures become z-scores inside the model, and why a tanh GRU needs that;
   c. inside a GRU cell: the update and reset gates, and where model 1's 960 and 1,632 parameters come from;
   d. model 2's recursive loop with a sliding 72-month window, how its errors feed forward, and why the rise from a 1-month test MAE of 1.188 to 1.407 over 12 months is not all feedback (the explainer's own reading, not the notebook's: a warm or cool spell in the last input months helps forecast month 73 but not a month a year out);
   e. model 3: one set of layers shared by three Keras models (5,218 = 2,592 + 2,626), each encoder layer's final state starting the matching decoder layer, teacher forcing in training against free running at test time, exposure bias, and why the teacher-forced curves make it look better than it really is (0.962 against 1.178 on validation; on the explainer's reading, not the notebook's, only part of that 0.216 gap is exposure bias, because a teacher-forced score is always one month ahead while the free-running one averages lead months 1 to 12);
   f. how the seasonal-naive and climatology baselines are built from the 72 input months alone;
   g. reading the error-against-horizon plot together with the error-by-lead-month plot: a horizon's MAE averages every month up to it, so it hides how bad the last months are;
   h. why every model over-predicts Bickley's maximum temperatures (bias here is the mean signed error, predicted minus actual, not a layer's bias term) and loses to both baselines on the test station, while models 1 and 2 match climatology on the validation station and model 3 is about 0.2 behind it;
   i. the VAE: the Conv1D encoder and decoder shapes, the reparameterisation trick, the KL weight of 0.5/84, the dead latent dimension, and why its samples are smooth and about a fifth of them are too flat. The notebook leaves the flat-sample explanation untested; a check made during review, outside the notebook and on a CPU re-run rather than the saved model, reported in the handover, found the phase ring it guessed at. Say both.
3. Show the PDF's plots, model summaries and plate storyboards on screen while you talk about them.
4. End with what worked, what did not, and what limited the results: the shift between stations, overlapping windows rather than independent samples, teacher-forced curves that flatter model 3, a decoder trained for only 12 steps, seed noise (model 3's free-running validation MAE ranged from 1.09 to 1.25 over five seeds in tuning), and the blur from an MSE decoder. Finish with the two next steps the notebook proposes: predicting each month's deviation from the input window's own average year, and, for the VAE, adding noise around the decoded mean or giving the decoder more capacity near its output.`;

export const NLM_COMPACT = `Source: this PDF only; numbers exactly as printed; name log.md/handover numbers; schematics: drawing illustrative, numbers real unless its line says not. Don't read code or source notes aloud. For James. Sections in order: task, method, results, problems. Focus: sliding windows, z-scores + tanh, GRU gates, model 2's loop, model 3's shared layers and teacher forcing, horizon vs lead-month error, Bickley bias vs baselines, VAE KL weight, dead dimension, blur. End: what worked, what didn't, why.`;

export const NLM_NOTE = 'Paste into NotebookLM → Video Overview → Customise, with the exported PDF as the only source.';
