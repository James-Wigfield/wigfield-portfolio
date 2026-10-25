/* ============================================================================
   CODE LAB — THE LABS & PROJECTS PANELS (tab 1)
   ----------------------------------------------------------------------------
   One compact panel per lab sheet and project: the goal (≤ 30 words), the
   data's shapes, the model(s) one line each, and the result — for the labs
   the target the sheet states, for the projects my numbers verbatim from my
   notebook's saved outputs — followed by its key-code cards (cards/labs.js,
   listed by id in `cards`).
   ========================================================================== */

export const LAB_PANELS = [
  {
    id: 'lp-lab4',
    title: 'Lab 4 · Noisy squares with a simple RNN',
    sources: ['Lab Sheet 4', 'L4'],
    goal: 'Train a small RNN on 4-vertex noisy squares: classify each sequence as clockwise or anti-clockwise, then predict the 4th vertex from the first three.',
    data: ['`X_train` (200, 4, 2), `y_train` (200,); `X_val` (60, 4, 2), `y_val` (60,)', 'Task 3: input `X_train[:, :3, :]` (200, 3, 2) → output `X_train[:, 3, :]` (200, 2)'],
    models: ['Task 2: SimpleRNN, about 16 units → 1 sigmoid output', 'Task 3: SimpleRNN, about 16 units → 2 linear outputs'],
    resultKind: 'target',
    result: ['“You should be able to achieve 100% validation accuracy easily.” (Task 2)'],
    cards: ['lab4-clockwise'],
  },
];
