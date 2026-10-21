/* The parts of each diagrams.jsx figure a notebook page (or a lab) can
   highlight (`hl: [...]`). They are the <P k="…"> marks in diagrams.jsx;
   tools/dl-lecture5-study/check-ae.mjs checks both sides agree. */
export const FIG_PARTS = {
  fig171: ['enc', 'dec', 'code'],
  sandwich: ['enc', 'dec', 'coding'],
  tied: ['w1', 'w2', 'coding'],
  pretrain: ['p1', 'copy', 'p2', 'head'],
  phases: ['p1', 'p2', 'p3', 'copy'],
};
