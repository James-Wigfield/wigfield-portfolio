/* The parts of each diagrams.jsx figure a notebook page can highlight
   (`hl: [...]`). They are the <P k="…"> marks in diagrams.jsx;
   tools/dl-lecture8-study/page-check.mjs checks both sides agree. */
export const FIG_PARTS = {
  birnn: ['fwd', 'bwd', 'cat'],
  bahdanau: ['sum', 'align'],
  transformer: ['enc', 'dec', 'pe', 'cross'],
  pewave: ['fast', 'slow', 'col'],
  sdpa: ['scores', 'scale', 'soft', 'out'],
  mha: ['lin', 'split', 'att', 'concat'],
  mask: ['mask', 'ok'],
  vit: ['patch', 'flat', 'pos'],
};
