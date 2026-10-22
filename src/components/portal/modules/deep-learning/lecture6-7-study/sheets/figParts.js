/* The parts of each diagrams.jsx figure a notebook page (or a lab) can
   highlight (`hl: [...]`). They are the <P k="…"> marks in diagrams.jsx;
   tools/dl-lecture6-7-study/check-gen.mjs checks both sides agree. */
export const FIG_PARTS = {
  dae: ['noise', 'dropout'],
  vae: ['enc', 'codings', 'sample', 'dec'],
  gan: ['gen', 'real', 'disc'],
  phases: ['learn', 'fixed'],
};
