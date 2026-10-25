/* ============================================================================
   CODE LAB — THE TABS, IN ORDER
   ----------------------------------------------------------------------------
   One tab per model or concept. `n` gives every card its printed label
   ("Card 7.2" = the 2nd card of tab 7) and the PDF its section order; `tags`
   are the outlined source labels shown on the tab (lectures, labs,
   projects). The Labs & Projects tab comes first: the PDF opens with it and
   the NotebookLM video starts there.
   ========================================================================== */

export const SECTIONS = [
  { id: 'labs', n: 1, title: 'Labs & Projects', short: 'Labs & projects', tags: ['Labs 2–4', 'P1', 'P2'] },
  { id: 'keras', n: 2, title: 'Keras models', short: 'Keras models', tags: ['L1'] },
  { id: 'training', n: 3, title: 'Training deep nets', short: 'Training', tags: ['L2'] },
  { id: 'optim', n: 4, title: 'Optimizers & LR schedules', short: 'Optimizers', tags: ['L2'] },
  { id: 'transfer', n: 5, title: 'Transfer learning', short: 'Transfer', tags: ['L2', 'L3'] },
  { id: 'cnn', n: 6, title: 'CNNs', short: 'CNNs', tags: ['L3'] },
  { id: 'rnn', n: 7, title: 'RNNs & time series', short: 'RNNs', tags: ['L4'] },
  { id: 'ae', n: 8, title: 'Autoencoders', short: 'Autoencoders', tags: ['L5', 'L6–7'] },
  { id: 'gen', n: 9, title: 'VAEs & GANs', short: 'VAEs & GANs', tags: ['L6–7'] },
  { id: 'transformer', n: 10, title: 'Transformers', short: 'Transformers', tags: ['L8'] },
  { id: 'rl', n: 11, title: 'Reinforcement learning', short: 'RL', tags: ['L9'] },
];

export const SECTION_BY_ID = Object.fromEntries(SECTIONS.map((s) => [s.id, s]));
