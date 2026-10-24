/* The parts of each diagrams.jsx figure a notebook page can highlight
   (`hl: [...]`). They are the <P k="…"> marks in diagrams.jsx;
   tools/dl-lecture9-study/page-check.mjs checks both sides agree. */
export const FIG_PARTS = {
  rlLoop: ['agent', 'env', 'act', 'obs'],
  policyNet: ['hidden', 'out', 'sample'],
  returns: ['ret', 'gamma'],
  mdp: ['plus10', 'fire', 'plus40'],
  sample: ['pick', 'arrays'],
  dqnStep: ['target', 'q', 'loss'],
};
