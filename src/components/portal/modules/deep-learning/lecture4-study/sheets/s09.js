// §9 · Deep RNNs (slides 28–29)
export default {
  big: 'stack several layers of cells → a {g|deep RNN}',
  blocks: [
    {
      id: 'stack',
      h: 'Stacking layers',
      at: '28',
      fig: { key: 'deepRnn', hl: ['up'], place: 'side', cap: 'Figure 15-10, unrolled: 3 layers × 4 steps' },
      items: [
        'each layer’s outputs → the {g|inputs of the layer above}',
        'unrolled: each layer also passes its state sideways → its own next time step',
      ],
    },
    {
      id: 'keras',
      h: 'In Keras',
      at: '29',
      items: [
        'just stack the recurrent layers; {g|`return_sequences=True`} on every `SimpleRNN` except the last',
        { code: 'SimpleRNN(32, return_sequences=True)\nSimpleRNN(32)' },
        { arrow: ['`return_sequences=True`: its state at every step', 'the next layer gets a sequence'] },
        { arrow: ['last `SimpleRNN(32)`: only its final state', '`Dense(1)` → the forecast'] },
      ],
      margin: [
        { ne: 'Fig. 15-10 draws an output at every step; `deep_model`’s last layer passes on only its last' },
        { q: 'Which layers of a deep RNN need `return_sequences=True`?', a: 'Every recurrent layer except the last one.' },
      ],
    },
    {
      id: 'result',
      h: 'The result',
      at: '29',
      items: [
        {
          table: {
            head: ['layer', 'breakdown (this page’s)', 'params'],
            cols: 'max-content minmax(0, max-content) max-content',
            rows: [
              ['layer 1', '1×32 + 32×32 + 32', '1,088'],
              ['layer 2', '32×32 + 32×32 + 32', '2,080'],
              ['layer 3', 'as layer 2', '2,080'],
              ['`Dense(1)`', '32 + 1', '33'],
              ['`deep_model`', '1,088 + 2,080 + 2,080 + 33', '{g|5,281}'],
            ],
          },
        },
        { arrow: ['val MAE ≈ 29,672 vs `univar_model`’s 27,703', '{g|worse}: looks a bit too large for the task'] },
      ],
      margin: [
        { q: 'Did `deep_model` beat `univar_model`?', a: 'No: about 29,672 against 27,703 — the deeper RNN looks a bit too large for the task.' },
      ],
    },
  ],
};
