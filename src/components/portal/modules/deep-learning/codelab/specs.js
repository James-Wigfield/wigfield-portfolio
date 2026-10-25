/* ============================================================================
   CODE LAB — LAYER SPECS (one per model card)
   ----------------------------------------------------------------------------
   Each spec is the card's model as data: inputs (shape without the batch
   axis) and layers in call order; a layer reads `from` (an id or a list of
   ids) or else the layer before it. counts.js turns a spec into shapes and
   parameter counts, diagrams.jsx into the "Draw it" picture, and
   tools/dl-codelab/verify_counts.py builds the same spec in TensorFlow and
   checks both. `group` draws a bracket (encoder, decoder…); `diagram.fold`
   folds a long chain into columns.
   ========================================================================== */

const S = {
  // L1 s44: Wide & Deep on California housing (8 features)
  wideDeep: {
    inputs: [{ id: 'input_', shape: [8] }],
    layers: [
      { id: 'normalized', type: 'Normalization' },
      { id: 'hidden1', type: 'Dense', units: 30, act: 'relu' },
      { id: 'hidden2', type: 'Dense', units: 30, act: 'relu' },
      { id: 'concat', type: 'Concatenate', from: ['normalized', 'hidden2'] },
      { id: 'output', type: 'Dense', units: 1 },
    ],
  },
  // Lab 4 Task 2: noisy squares, clockwise or not
  lab4Clockwise: {
    inputs: [{ id: 'input', shape: [null, 2] }],
    layers: [
      { type: 'SimpleRNN', units: 16 },
      { type: 'Dense', units: 1, act: 'sigmoid' },
    ],
  },
};

export const SPECS = Object.fromEntries(Object.entries(S).map(([id, s]) => [id, { id, ...s }]));
