/* ============================================================================
   DL PROJECT 2 — RUN FACTS (shown under the notebook chrome)
   ----------------------------------------------------------------------------
   From the notebook's own outputs (Out [1], cell 0, cell 2) and the handover
   (§1: final run time). Cell and execution-count facts come from NB_META,
   which the extractor computes.
   ========================================================================== */

export const RUN_FACTS = [
  { k: 'stack', v: 'TensorFlow 2.21.0 · Keras 3.15.1 · NumPy 2.5.2', src: 'Out [1]' },
  { k: 'gpu', v: 'NVIDIA RTX 5070 Ti', src: 'cell 0' },
  { k: 'seed', v: '42 + op determinism', src: 'In [1]' },
  { k: 'final run', v: '3 min 49 s, top to bottom', src: 'handover' },
];
