// §13.1 · The LSTM cell and its long-term state (slides 42–45)
export default {
  big: 'an LSTM cell adds a {g|long-term state} $\\mathbf{c}_{(t)}$ beside the short-term $\\mathbf{h}_{(t)}$',
  blocks: [
    {
      id: 'why',
      h: 'Why LSTM?',
      at: '42–43',
      items: [
        'basic RNN: some info lost at each step → after a while, virtually {g|no trace of the first inputs}',
        'LSTM cell (1997): long-term memory; training converges faster & it detects long-term dependencies',
        { line: 'Keras: `LSTM` for `SimpleRNN` · `lstm_model` (`LSTM(12)`): 685 params, val MAE 30,262' },
      ],
    },
    {
      id: 'states',
      h: 'Two state vectors',
      at: '43',
      items: [
        { table: { head: ['state', 'think of it as'], rows: [['$\\mathbf{h}_{(t)}$', 'the short-term state'], ['$\\mathbf{c}_{(t)}$', 'the long-term state']] } },
        'learns what to store in $\\mathbf{c}_{(t)}$, what to throw away & what to read from it',
      ],
      margin: [
        { nb: '“c” stands for “cell”' },
        { hook: 'Long Short-Term Memory: long → $\\mathbf{c}$, short-term → $\\mathbf{h}$' },
        { q: 'Which LSTM state is the long-term one?', a: '$\\mathbf{c}_{(t)}$; $\\mathbf{h}_{(t)}$ is the short-term state (and the output).' },
      ],
    },
    {
      id: 'path',
      h: 'The long-term path',
      at: '44–45',
      fig: { key: 'lstmCell', hl: ['c'], cap: 'Figure 15-12 · the long-term path in green' },
      items: [
        {
          steps: [
            '$\\mathbf{c}_{(t-1)}$ → {g|forget gate} ⊗: drops some memories',
            '+ adds new memories, selected by the input gate',
            'the result $\\mathbf{c}_{(t)}$ leaves with no further transformation',
            '$\\mathbf{c}_{(t)}$ also → tanh → output gate → $\\mathbf{h}_{(t)} = \\mathbf{y}_{(t)}$',
          ],
        },
      ],
      margin: [
        { q: 'What happens to $\\mathbf{c}_{(t-1)}$ on its way through the cell?', a: 'The forget gate drops some memories, then new memories selected by the input gate are added; the result leaves as $\\mathbf{c}_{(t)}$.' },
        { sc: 'Figure 15-12 writes the output $\\hat{\\mathbf{y}}_{(t)}$; the slide text and equations write $\\mathbf{y}_{(t)}$.' },
      ],
    },
  ],
};
