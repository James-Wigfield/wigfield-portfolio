// §14 · GRU cells (slides 48–49)
export default {
  big: 'the GRU cell is a {g|simplified} version of the LSTM cell',
  blocks: [
    {
      id: 'vs',
      h: 'LSTM vs GRU',
      at: '43, 48–49',
      items: [
        {
          table: {
            head: ['', 'LSTM', 'GRU'],
            cols: 'minmax(min-content, max-content) minmax(min-content, max-content) minmax(6.5rem, max-content)',
            rows: [
              ['states', '$\\mathbf{h}_{(t)}$ & $\\mathbf{c}_{(t)}$', '{g|merged} into one, $\\mathbf{h}_{(t)}$'],
              ['forget & input', '$\\mathbf{f}_{(t)}$, $\\mathbf{i}_{(t)}$', '{g|one} controller $\\mathbf{z}_{(t)}$ for both'],
              ['output gate', '$\\mathbf{o}_{(t)}$', '{g|none}: full state vector output every step'],
              ['Keras', '`LSTM(12)`', '`GRU(20)`'],
              ['params', '685', '1,401'],
              ['val MAE', '30,262', '26,497'],
            ],
          },
        },
        {
          title: 'params by layer (totals: slides 43 & 49; breakdowns this page’s)',
          worked: [
            '`lstm_model`: 4 FC layers + `Dense(1)`, $4 \\times (12 + 144 + 12) + 13 = 685$',
            '`gru_model`: 3 FC layers + `Dense(1)`, $3 \\times (20 + 400 + 40) + 21 = 1{,}401$ (Keras keeps two biases per layer; slide 49’s equations show one → 1,341)',
          ],
        },
      ],
      margin: [
        { hook: '3 merges/cuts: $\\mathbf{c}$ + $\\mathbf{h}$ → one $\\mathbf{h}$ · $\\mathbf{f}$ + $\\mathbf{i}$ → one $\\mathbf{z}$ · no $\\mathbf{o}$' },
        { q: 'Name the GRU’s three simplifications of the LSTM.', a: 'One state vector instead of two; one gate controller z for both the forget and input gates; no output gate.' },
      ],
    },
    {
      id: 'gates',
      h: 'Two gate controllers',
      at: '48–49',
      fig: { key: 'gruCell', hl: ['z'], cap: 'Figure 15-13 · $\\mathbf{z}_{(t)}$ in green: on $\\mathbf{h}_{(t-1)}$, and as $1 - \\mathbf{z}$ on $\\mathbf{g}_{(t)}$', place: 'above' },
      items: [
        '$\\mathbf{z}_{(t)}$ & $\\mathbf{r}_{(t)}$: logistic gates from $\\mathbf{x}_{(t)}$ & $\\mathbf{h}_{(t-1)}$',
        { formula: '\\mathbf{z}_{(t)}^{\\top} = \\sigma\\left(\\mathbf{x}_{(t)}^{\\top}\\mathbf{W}_{xz} + \\mathbf{h}_{(t-1)}^{\\top}\\mathbf{W}_{hz} + \\mathbf{b}_{z}^{\\top}\\right)', read: 'the single controller for both forgetting & adding' },
        { formula: '\\mathbf{r}_{(t)}^{\\top} = \\sigma\\left(\\mathbf{x}_{(t)}^{\\top}\\mathbf{W}_{xr} + \\mathbf{h}_{(t-1)}^{\\top}\\mathbf{W}_{hr} + \\mathbf{b}_{r}^{\\top}\\right)', read: 'the 2nd controller: gates the old state on its way to $\\mathbf{g}$' },
      ],
    },
    {
      id: 'state',
      h: 'Candidate & new state',
      at: '49',
      items: [
        { formula: '\\mathbf{g}_{(t)}^{\\top} = \\tanh\\left(\\mathbf{x}_{(t)}^{\\top}\\mathbf{W}_{xg} + \\left(\\mathbf{r}_{(t)}^{\\top}\\mathbf{W}_{hg} \\otimes \\mathbf{h}_{(t-1)}^{\\top}\\right) + \\mathbf{b}_{g}^{\\top}\\right)', tag: 'as typeset on slide 49', read: 'the tanh main layer, the candidate state; $\\mathbf{r}$ gates how much of $\\mathbf{h}_{(t-1)}$ it sees' },
        { formula: '\\mathbf{h}_{(t)} = \\mathbf{z}_{(t)} \\otimes \\mathbf{h}_{(t-1)} + \\left(1 - \\mathbf{z}_{(t)}\\right) \\otimes \\mathbf{g}_{(t)}', read: 'keep a {g|share} $\\mathbf{z}$ of the old state, fill the rest from $\\mathbf{g}$' },
      ],
      margin: [
        { sc: 'slide 49 puts $\\mathbf{r}$ through $\\mathbf{W}_{hg}$ before the ⊗; Fig. 15-13 gates $\\mathbf{h}_{(t-1)}$ first. Both fit: $\\mathbf{W}_{hg}$ is square.' },
        { q: 'If $\\mathbf{z}_{(t)} = 1$, what is $\\mathbf{h}_{(t)}$?', a: '$\\mathbf{h}_{(t-1)}$ — the old state is kept unchanged.' },
      ],
    },
  ],
};
