/* ============================================================================
   CODE LAB — THE TABS, IN ORDER
   ----------------------------------------------------------------------------
   One tab per model or concept. `n` gives every card its printed label
   ("Card 6.2" = the 2nd card of tab 6) and the PDF its section order; `tags`
   are the outlined source labels shown on the tab (lectures, labs,
   projects). The Labs & Projects tab comes first: the PDF opens with it and
   the NotebookLM video starts there.
   ========================================================================== */

export const SECTIONS = [
  { id: 'labs', n: 1, title: 'Labs & Projects', tags: ['Labs 2–4', 'P1', 'P2'] },
  { id: 'keras', n: 2, title: 'Keras models', tags: ['L1'] },
  { id: 'training', n: 3, title: 'Training deep nets', tags: ['L2'] },
  { id: 'optim', n: 4, title: 'Optimizers & LR schedules', tags: ['L2'] },
  { id: 'cnn', n: 5, title: 'CNNs', tags: ['L3'] },
  { id: 'rnn', n: 6, title: 'RNNs & time series', tags: ['L4'] },
  { id: 'ae', n: 7, title: 'Autoencoders', tags: ['L5', 'L6–7'] },
  { id: 'gen', n: 8, title: 'VAEs & GANs', tags: ['L6–7'] },
  { id: 'transformer', n: 9, title: 'Attention & transformers', tags: ['L8'] },
  { id: 'rl', n: 10, title: 'Reinforcement learning', tags: ['L9'] },
];

export const SECTION_BY_ID = Object.fromEntries(SECTIONS.map((s) => [s.id, s]));
