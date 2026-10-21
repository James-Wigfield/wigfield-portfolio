/* The parts of each diagrams.jsx figure a sheet can draw in green
   (`hl: [...]`). They are the <P k="…"> marks in diagrams.jsx;
   tools/dl-lecture4-study/check-sheets.mjs checks both sides agree. */
export const FIG_PARTS = {
  unroll: ['loop', 'zero', 'feed', 'time'],
  hiddenState: ['h', 'y'],
  weatherRnn: ['h0', 'h', 'discard', 'last'],
  seqModes: ['s2s', 's2v', 'v2s', 'ed'],
  bptt: ['fwd', 'grad', 'loss'],
  naive: ['lag', 'err'],
  windows: ['w0', 'w1', 'w2', 'batch'],
  univar: ['state', 'dense'],
  deepRnn: ['up', 'side', 'out', 'last'],
  mulvar: ['series', 'onehot', 'd1', 'd2'],
  loop: ['append', 'shape'],
  aheadSplit: ['in', 'tgt', 'rest'],
  normAxes: ['bn', 'ln', 'cell'],
  lstmCell: ['c', 'f', 'g', 'i', 'o', 'input', 'out', 'in'],
  lstmGates: ['f', 'i', 'g', 'o'],
  gruCell: ['h', 'z', 'r', 'g', 'in'],
  conv1d: ['s1', 's2'],
};
